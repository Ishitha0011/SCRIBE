from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv  # Import load_dotenv
import google.generativeai as genai 
from uuid import uuid4  # Import uuid4 for session IDs
import os
from typing import List, Optional, Dict

# Load environment variables from .env file
load_dotenv()

app = FastAPI()

# Allow CORS for frontend communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Store chat sessions and their history in memory
chat_sessions: Dict[str, dict] = {}

class Message(BaseModel):
    text: str
    sender: str
    timestamp: str

class QuestionRequest(BaseModel):
    question: str
    session_id: str
    conversation_history: Optional[List[Message]] = []

class TitleRequest(BaseModel):
    session_id: str
    conversation_history: List[Message]

class ScribeAIResponse:
    @staticmethod
    def generate_title(conversation_history: List[Message]) -> str:
        api_key = os.getenv("GEMINI_API_KEY")
        genai.configure(api_key=api_key)

        # Create a prompt for title generation
        title_prompt = """Based on the following conversation, generate a very concise and descriptive title (maximum in few 2-5 characters).
        The title should capture the main topic or theme of the conversation.
        
        Conversation:
        """
        
        # Add the first few messages for context
        context_messages = conversation_history[:3]  # Use first 3 messages
        for msg in context_messages:
            role = "User" if msg.sender == "user" else "Assistant"
            title_prompt += f"\n{role}: {msg.text}"
        
        title_prompt += "\n\nTitle ( 2-5 chars max, no quotes):"

        try:
            model = genai.GenerativeModel(
                model_name="gemini-2.0-flash",
                generation_config={
                    "temperature": 0.7,
                    "max_output_tokens": 50,
                    "top_p": 1,
                    "top_k": 40,
                }
            )
            
            response = model.generate_content(title_prompt)
            
            if not response.text:
                return "New Chat"
                
            # Clean up the title
            title = response.text.strip()
            title = title.replace('"', '').replace("'", "")  # Remove quotes
            title = ' '.join(title.split())  # Normalize whitespace
            
            # Ensure title length
            if len(title) > 40:
                title = title[:37] + "..."
                
            return title
        except Exception as e:
            print(f"Error generating title: {e}")
            return "New Chat"

    @staticmethod
    def format_messages_for_context(messages: List[Message]) -> List[dict]:
        formatted_history = []
        for msg in messages:
            # Convert to Gemini's expected format
            if msg.sender == "user":
                formatted_history.append({
                    "role": "user",
                    "parts": [{"text": msg.text}]
                })
            else:
                formatted_history.append({
                    "role": "model",
                    "parts": [{"text": msg.text}]
                })
        return formatted_history

    @staticmethod
    def get_scribe_response(current_question: str, conversation_history: List[Message], session_id: str):
        api_key = os.getenv("GEMINI_API_KEY")
        genai.configure(api_key=api_key)

        system_prompt = """
        You are Scribe AI, a friendly, helpful, and versatile AI assistant. Your primary goal is to assist users in a wide range of tasks and conversations. You can:

        * **Answer questions accurately and informatively.** Draw upon a vast knowledge base to provide relevant and up-to-date information.
        * **Engage in natural and engaging conversations.** Be conversational, polite, and attentive to the user's needs and tone.
        * **Help with creative tasks.** Assist with brainstorming, writing different kinds of creative content (stories, poems, code, scripts, musical pieces, email, letters, etc.), and exploring ideas.
        * **Provide summaries and explanations.** Simplify complex topics and offer clear, concise explanations.
        * **Offer suggestions and recommendations.**  When appropriate and asked, offer helpful suggestions based on the user's requests (e.g., suggesting related topics, resources, or next steps).
        * **Be respectful and unbiased.** Treat all users with respect and avoid expressing personal opinions or biases.
        * **If you don't know the answer, say "I'm not sure, but I can try to find out more" or suggest alternative approaches.**
        * **Maintain context awareness.** Use the conversation history to provide more relevant and contextual responses.

        Remember to be helpful, informative, and engaging in all interactions.
        """

        generation_config = {
            "temperature": 1,
            "top_p": 0.95,
            "top_k": 40,
            "max_output_tokens": 8192,
        }

        try:
            # Format the conversation history including the system prompt
            formatted_history = ScribeAIResponse.format_messages_for_context(conversation_history)
            
            # Initialize model
            model = genai.GenerativeModel(
                model_name="gemini-2.0-flash",
                generation_config=generation_config
            )

            # Start chat with history if session exists, otherwise start new
            if session_id in chat_sessions:
                chat = model.start_chat(history=chat_sessions[session_id]["history"])
            else:
                # Initialize with system prompt for new sessions
                chat = model.start_chat(history=[])
                system_message = {
                    "role": "model",
                    "parts": [{"text": system_prompt}]
                }
                chat.history.append(system_message)
                chat_sessions[session_id] = {"history": [system_message]}

            # Send the current question
            response = chat.send_message(current_question)
            
            if response.text:
                # Update session history
                chat_sessions[session_id]["history"] = chat.history
                return response.text
            else:
                print("Warning: Gemini API returned a response with empty content.")
                return ""
        except Exception as e:
            print(f"Error calling Gemini API: {e}")
            if session_id in chat_sessions:
                del chat_sessions[session_id]  # Clear problematic session
            return ""

@app.post("/create-session")
async def create_session():
    session_id = str(uuid4())
    return {"session_id": session_id}

@app.post("/generate-title")
async def generate_title(request: TitleRequest):
    try:
        title = ScribeAIResponse.generate_title(request.conversation_history)
        return {"title": title}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/ask-ai")
async def ask_ai(request: QuestionRequest):
    try:
        # Get AI response with conversation history
        ai_response = ScribeAIResponse.get_scribe_response(
            request.question,
            request.conversation_history,
            request.session_id
        )
        return {"response": ai_response}
    except Exception as e:
        # Clean up session on error
        if request.session_id in chat_sessions:
            del chat_sessions[request.session_id]
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/clear-session/{session_id}")
async def clear_session(session_id: str):
    if session_id in chat_sessions:
        del chat_sessions[session_id]
    return {"status": "success"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
