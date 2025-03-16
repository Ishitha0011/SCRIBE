from fastapi import FastAPI, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv  # Import load_dotenv
import google.generativeai as genai
from uuid import uuid4  # Import uuid4 for session IDs
import os
import json
import shutil
from pathlib import Path
from typing import List, Optional, Dict, Union
import tkinter as tk
from tkinter import filedialog

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

# Store workspace info - will be saved to a config file
workspace_info = {
    "last_directory": None  # Last opened directory
}

CONFIG_FILE = "workspace_config.json"


# Load config if it exists
def load_config():
    global workspace_info
    try:
        if os.path.exists(CONFIG_FILE):
            with open(CONFIG_FILE, 'r') as f:
                workspace_info = json.load(f)
    except Exception as e:
        print(f"Error loading config: {e}")


# Save config
def save_config():
    try:
        with open(CONFIG_FILE, 'w') as f:
            json.dump(workspace_info, f)
    except Exception as e:
        print(f"Error saving config: {e}")


# Load config at startup
load_config()


class Message(BaseModel):
    text: str
    sender: str
    timestamp: str


class QuestionRequest(BaseModel):
    question: str
    session_id: str
    conversation_history: Optional[List[dict]] = []  # Accept dictionaries instead of Message objects


class TitleRequest(BaseModel):
    session_id: str
    conversation_history: List[dict]  # Accept dictionaries instead of Message objects


# File operation request models
class FileRequest(BaseModel):
    path: str
    content: Optional[str] = None


class DirectoryRequest(BaseModel):
    path: str


class RenameRequest(BaseModel):
    old_path: str
    new_path: str


class CreateFileRequest(BaseModel):
    path: str
    type: str
    parent_path: Optional[str] = None
    name: str


class WorkspaceRequest(BaseModel):
    directory: str


# Helper function to convert dict to Message
def dict_to_message(message_dict):
    if isinstance(message_dict, dict):
        return Message(
            text=message_dict.get('text', ''),
            sender=message_dict.get('sender', 'user'),
            timestamp=message_dict.get('timestamp', '')
        )
    return message_dict  # Return as is if already a Message object


class ScribeAIResponse:
    @staticmethod
    def generate_title(conversation_history: List[Message]) -> str:
        try:
            api_key = os.getenv("GEMINI_API_KEY")
            if not api_key:
                print("Warning: GEMINI_API_KEY not found in environment variables")
                return "New Chat"

            genai.configure(api_key=api_key)

            # Validate conversation history
            if not conversation_history or len(conversation_history) < 2:
                print("Not enough messages for title generation")
                return "New Chat"

            # Create a prompt for title generation
            title_prompt = """Based on the following conversation, generate a very concise and descriptive title (maximum 5 words).
            The title should capture the main topic or theme of the conversation.

            Conversation:
            """

            # Add the first few messages for context
            context_messages = conversation_history[:3]  # Use first 3 messages
            for msg in context_messages:
                try:
                    role = "User" if msg.sender == "user" else "Assistant"
                    title_prompt += f"\n{role}: {msg.text}"
                except AttributeError as e:
                    print(f"Error accessing message attributes: {e}")
                    print(f"Problematic message: {msg}")
                    continue

            title_prompt += "\n\nTitle (5 words max, no quotes):"

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
                print(f"Error generating title with Gemini API: {e}")
                return "New Chat"
        except Exception as e:
            print(f"Unexpected error in generate_title: {e}")
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


# File system operations
@app.post("/api/workspace/set")
async def set_workspace(request: WorkspaceRequest):
    """Set the current workspace directory"""
    try:
        directory = request.directory
        if not os.path.exists(directory):
            raise HTTPException(status_code=404, detail="Directory not found")

        # Save to global config
        workspace_info["last_directory"] = directory
        save_config()

        return {"status": "success", "directory": directory}
    except Exception as e:
        print(f"Error setting workspace: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/workspace/get")
async def get_workspace():
    """Get the current workspace directory"""
    try:
        directory = workspace_info.get("last_directory")
        if directory and os.path.exists(directory):
            return {"directory": directory}
        return {"directory": None}
    except Exception as e:
        print(f"Error getting workspace: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/files/list")
async def list_files(directory: Optional[str] = None):
    """List all files in a directory"""
    try:
        if not directory:
            directory = workspace_info.get("last_directory")
            if not directory:
                return {"items": [], "error": "No workspace set"}

        if not os.path.exists(directory):
            raise HTTPException(status_code=404, detail="Directory not found")

        # Get file structure recursively
        structure = read_directory_structure(directory)
        return {"items": structure}
    except Exception as e:
        print(f"Error listing files: {e}")
        raise HTTPException(status_code=500, detail=str(e))


def read_directory_structure(directory, base_path=None):
    """Read directory structure recursively"""
    items = []
    if base_path is None:
        base_path = directory

    try:
        for entry in os.scandir(directory):
            relative_path = os.path.relpath(entry.path, base_path)

            if entry.is_dir():
                items.append({
                    "id": relative_path,
                    "name": entry.name,
                    "type": "folder",
                    "children": read_directory_structure(entry.path, base_path)
                })
            else:
                items.append({
                    "id": relative_path,
                    "name": entry.name,
                    "type": "file"
                })
        return items
    except Exception as e:
        print(f"Error reading directory structure: {e}")
        return []


@app.get("/api/files/read")
async def read_file(path: str):
    """Read file content"""
    try:
        if not workspace_info.get("last_directory"):
            raise HTTPException(status_code=400, detail="No workspace set")

        full_path = os.path.join(workspace_info["last_directory"], path)

        if not os.path.exists(full_path):
            raise HTTPException(status_code=404, detail="File not found")

        if not os.path.isfile(full_path):
            raise HTTPException(status_code=400, detail="Path is not a file")

        try:
            with open(full_path, 'r', encoding='utf-8') as f:
                content = f.read()
            return {"content": content}
        except UnicodeDecodeError:
            # Return a message for binary files
            return {"content": "", "error": "Binary file cannot be displayed"}
    except Exception as e:
        print(f"Error reading file: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/files/write")
async def write_file(request: FileRequest):
    """Write content to a file"""
    try:
        if not workspace_info.get("last_directory"):
            raise HTTPException(status_code=400, detail="No workspace set")

        full_path = os.path.join(workspace_info["last_directory"], request.path)

        # Create directories if they don't exist
        os.makedirs(os.path.dirname(full_path), exist_ok=True)

        with open(full_path, 'w', encoding='utf-8') as f:
            f.write(request.content or "")

        return {"status": "success"}
    except Exception as e:
        print(f"Error writing file: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/files/create")
async def create_file_or_folder(request: CreateFileRequest):
    """Create a new file or folder"""
    try:
        if not workspace_info.get("last_directory"):
            raise HTTPException(status_code=400, detail="No workspace set")

        # Determine the parent directory
        if request.parent_path:
            parent_dir = os.path.join(workspace_info["last_directory"], request.parent_path)
        else:
            parent_dir = workspace_info["last_directory"]

        # Create full path
        full_path = os.path.join(parent_dir, request.name)

        if request.type == "folder":
            # Create directory
            os.makedirs(full_path, exist_ok=True)
        else:
            # Create file
            # Make sure parent directories exist
            os.makedirs(os.path.dirname(full_path), exist_ok=True)

            # Create empty file
            with open(full_path, 'w', encoding='utf-8') as f:
                pass

        # Get relative path from workspace root
        relative_path = os.path.relpath(full_path, workspace_info["last_directory"])

        return {
            "status": "success",
            "id": relative_path,
            "name": request.name,
            "type": request.type
        }
    except Exception as e:
        print(f"Error creating file/folder: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/files/delete")
async def delete_file(path: str):
    """Delete a file or directory"""
    try:
        if not workspace_info.get("last_directory"):
            raise HTTPException(status_code=400, detail="No workspace set")

        full_path = os.path.join(workspace_info["last_directory"], path)

        if not os.path.exists(full_path):
            raise HTTPException(status_code=404, detail="File not found")

        if os.path.isdir(full_path):
            shutil.rmtree(full_path)
        else:
            os.remove(full_path)

        return {"status": "success"}
    except Exception as e:
        print(f"Error deleting file: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/files/rename")
async def rename_file(request: RenameRequest):
    """Rename a file or directory"""
    try:
        if not workspace_info.get("last_directory"):
            raise HTTPException(status_code=400, detail="No workspace set")

        old_full_path = os.path.join(workspace_info["last_directory"], request.old_path)
        new_full_path = os.path.join(workspace_info["last_directory"], request.new_path)

        if not os.path.exists(old_full_path):
            raise HTTPException(status_code=404, detail="File not found")

        # Create parent directories if they don't exist
        os.makedirs(os.path.dirname(new_full_path), exist_ok=True)

        # Rename/move the file
        shutil.move(old_full_path, new_full_path)

        return {"status": "success"}
    except Exception as e:
        print(f"Error renaming file: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/create-session")
async def create_session():
    session_id = str(uuid4())
    return {"session_id": session_id}


@app.post("/generate-title")
async def generate_title(request: TitleRequest):
    try:
        # Debug logging
        print(f"Received title request for session: {request.session_id}")
        print(f"Conversation history length: {len(request.conversation_history)}")

        # Validate conversation history
        if not request.conversation_history:
            print("Warning: Empty conversation history received")
            return {"title": "New Chat"}

        # Convert dictionary messages to Message objects
        message_objects = []
        for msg_dict in request.conversation_history:
            try:
                # Convert each dictionary to a Message object
                message = dict_to_message(msg_dict)
                message_objects.append(message)
            except Exception as e:
                print(f"Error converting message: {e}")
                print(f"Problematic message: {msg_dict}")
                # Skip invalid messages
                continue

        if not message_objects:
            print("No valid messages after conversion")
            return {"title": "New Chat"}

        title = ScribeAIResponse.generate_title(message_objects)
        print(f"Generated title: {title}")
        return {"title": title}
    except Exception as e:
        print(f"Error in generate_title endpoint: {str(e)}")
        # Return a default title instead of raising an exception
        return {"title": "New Chat"}


@app.post("/ask-ai")
async def ask_ai(request: QuestionRequest):
    try:
        # Debug logging
        print(f"Received question for session: {request.session_id}")
        print(f"Question: {request.question}")
        print(f"Conversation history length: {len(request.conversation_history)}")

        # Convert dictionary messages to Message objects
        message_objects = []
        for msg_dict in request.conversation_history:
            try:
                message = dict_to_message(msg_dict)
                message_objects.append(message)
            except Exception as e:
                print(f"Error converting message in ask-ai: {e}")
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
        print(f"Error in ask_ai endpoint: {str(e)}")
        # Clean up session on error
        if request.session_id in chat_sessions:
            del chat_sessions[request.session_id]
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/clear-session/{session_id}")
async def clear_session(session_id: str):
    if session_id in chat_sessions:
        del chat_sessions[session_id]
    return {"status": "success"}


@app.post("/api/workspace/select-directory")
async def select_directory():
    """Open native file dialog to select directory"""
    try:
        # Create a root window but hide it
        root = tk.Tk()
        root.withdraw()  # Hide the main window

        # Open the native file dialog
        selected_dir = filedialog.askdirectory(
            title='Select Workspace Directory',
            mustexist=True  # Ensure the directory exists
        )

        # Destroy the root window
        root.destroy()

        if selected_dir:
            # Update workspace info
            workspace_info["last_directory"] = selected_dir
            save_config()
            return {"status": "success", "directory": selected_dir}
        else:
            return {"status": "cancelled", "directory": None}

    except Exception as e:
        print(f"Error selecting directory: {e}")
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
