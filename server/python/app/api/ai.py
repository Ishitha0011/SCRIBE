from fastapi import APIRouter, HTTPException
from typing import List, Optional
from ..models.models import QuestionRequest, TitleRequest, AIChatRequest, ImageProcessRequest, Message
from uuid import uuid4
import os
import logging
import google.generativeai as genai
from ..main import chat_sessions, ScribeAIResponse, dict_to_message, gemini_ai, gemini_types, logger

router = APIRouter()

@router.post("/create-session")
async def create_session():
    session_id = str(uuid4())
    return {"session_id": session_id}

@router.post("/generate-title")
async def generate_title(request: TitleRequest):
    try:
        # Debug logging
        logging.info(f"Received title request for session: {request.session_id}")
        logging.info(f"Conversation history length: {len(request.conversation_history)}")

        # Validate conversation history
        if not request.conversation_history:
            logging.warning("Warning: Empty conversation history received")
            return {"title": "New Chat"}

        # Convert dictionary messages to Message objects
        message_objects = []
        for msg_dict in request.conversation_history:
            try:
                # Convert each dictionary to a Message object
                message = dict_to_message(msg_dict)
                message_objects.append(message)
            except Exception as e:
                logging.warning(f"Error converting message: {e} - Problematic: {msg_dict}")
                # Skip invalid messages
                continue

        if not message_objects:
            logging.warning("No valid messages after conversion")
            return {"title": "New Chat"}

        title = ScribeAIResponse.generate_title(message_objects)
        logging.info(f"Generated title: {title}")
        return {"title": title}
    except Exception as e:
        logging.error(f"Error in generate_title endpoint: {str(e)}", exc_info=True)
        # Return a default title instead of raising an exception
        return {"title": "New Chat"}

@router.post("/ask-ai")
async def ask_ai(request: QuestionRequest):
    try:
        # Debug logging
        logging.info(f"Received question for session: {request.session_id}")
        logging.info(f"Question: {request.question}")
        logging.info(f"Conversation history length: {len(request.conversation_history)}")

        # Convert dictionary messages to Message objects
        message_objects = []
        for msg_dict in request.conversation_history:
            try:
                message = dict_to_message(msg_dict)
                message_objects.append(message)
            except Exception as e:
                logging.warning(f"Error converting message in ask-ai: {e}")
                # Skip invalid messages
                continue

        # Get AI response with conversation history
        ai_response = ScribeAIResponse.get_scribe_response(
            request.question,
            message_objects,
            request.session_id
        )
        return {"response": ai_response}
    except Exception as e:
        logging.error(f"Error in ask_ai endpoint: {str(e)}", exc_info=True)
        # Clean up session on error
        if request.session_id in chat_sessions:
            del chat_sessions[request.session_id]
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/clear-session/{session_id}")
async def clear_session(session_id: str):
    if session_id in chat_sessions:
        del chat_sessions[session_id]
    return {"status": "success"}

@router.post("/ai-chat")
async def handle_ai_chat(request: AIChatRequest):
    """Handle AI chat requests from the AIChatNode"""
    try:
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise HTTPException(status_code=500, detail="GEMINI_API_KEY not found in environment variables")

        genai.configure(api_key=api_key)

        generation_config = {
            "temperature": 1,
            "top_p": 0.95,
            "top_k": 40,
            "max_output_tokens": 8192,
        }

        try:
            model = genai.GenerativeModel(
                model_name="gemini-2.0-flash",
                generation_config=generation_config
            )

            # Combine system prompt and user prompt
            full_prompt = f"{request.system_prompt}\n\nUser: {request.user_prompt}"

            # Send the prompt
            response = model.generate_content(full_prompt)

            if not response.text:
                raise HTTPException(status_code=500, detail="Empty response from Gemini API")

            return {"response": response.text}

        except Exception as e:
            logging.error(f"Error calling Gemini API: {e}")
            raise HTTPException(status_code=500, detail=str(e))

    except Exception as e:
        logging.error(f"Error in AI chat endpoint: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/image/process")
async def process_image_with_ai(request: ImageProcessRequest):
    """Process an image with an optional prompt using Gemini."""
    try:
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            logger.error("GEMINI_API_KEY not found in environment variables")
            raise HTTPException(status_code=500, detail="GEMINI_API_KEY not configured")

        gemini_client = gemini_ai.Client(api_key=api_key)

        # Construct the local file path from the image_url
        # image_url is like "/assets/image.png", local path should be "assets/image.png"
        if not request.image_url.startswith("/assets/"):
            raise HTTPException(status_code=400, detail="Invalid image_url format. Must start with /assets/")

        local_image_path = request.image_url.lstrip('/') # Remove leading slash

        if not os.path.exists(local_image_path):
            logger.error(f"Image file not found at local path: {local_image_path}")
            raise HTTPException(status_code=404, detail=f"Image file not found: {local_image_path}")

        logger.info(f"Processing image: {local_image_path} with prompt: '{request.prompt_text}'")

        # 1. Upload the file to Gemini
        try:
            uploaded_files = [
                gemini_client.files.upload(file=local_image_path),
            ]
            logger.info(f"Successfully uploaded image to Gemini: {uploaded_files[0].uri}")
        except Exception as e:
            logger.error(f"Error uploading image to Gemini: {e}", exc_info=True)
            raise HTTPException(status_code=500, detail=f"Failed to upload image to Gemini: {str(e)}")

        # 2. Prepare content for the model
        prompt_to_use = request.prompt_text if request.prompt_text else "Describe this image comprehensively."

        model_contents = [
            gemini_types.Content(
                role="user",
                parts=[
                    gemini_types.Part.from_uri(
                        file_uri=uploaded_files[0].uri,
                        mime_type=uploaded_files[0].mime_type,
                    ),
                    gemini_types.Part.from_text(text=prompt_to_use),
                ],
            ),
        ]

        generate_content_config = gemini_types.GenerateContentConfig(
            response_mime_type="text/plain",
        )

        model_name = "gemini-2.5-flash-preview-04-17" # As requested

        # 3. Generate content
        response_chunks = []
        try:
            for chunk in gemini_client.models.generate_content_stream(
                model=model_name,
                contents=model_contents,
                config=generate_content_config,
            ):
                if chunk.text is not None: # Check if chunk.text is not None
                    response_chunks.append(chunk.text)

            full_response = "".join(response_chunks)
            logger.info(f"Successfully received response from Gemini model for image.")

            # 4. Clean up the uploaded file (optional, but good practice)
            # try:
            #     gemini_client.files.delete(name=uploaded_files[0].name)
            #     logger.info(f"Successfully deleted temporary file from Gemini: {uploaded_files[0].name}")
            # except Exception as e:
            #     logger.warning(f"Could not delete temporary file from Gemini: {e}", exc_info=True)

            return {"status": "success", "response": full_response}

        except Exception as e:
            logger.error(f"Error generating content with Gemini model: {e}", exc_info=True)
            # Attempt to delete file even if generation fails
            # try:
            #     gemini_client.files.delete(name=uploaded_files[0].name)
            # except Exception as del_e:
            #     logger.warning(f"Failed to delete temporary file after generation error: {del_e}")
            raise HTTPException(status_code=500, detail=f"Failed to generate content from Gemini: {str(e)}")

    except HTTPException:
        raise # Re-raise HTTPExceptions directly
    except Exception as e:
        logger.error(f"Unexpected error in process_image_with_ai: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"An unexpected error occurred: {str(e)}")
