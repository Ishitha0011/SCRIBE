from fastapi import FastAPI, HTTPException, Response, Request, UploadFile, File, Form, Query, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
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
from datetime import datetime
import asyncio
import logging
import requests
from threading import Thread
import queue
import time
import httpx
from bs4 import BeautifulSoup
import aiohttp
from urllib.parse import urlparse, parse_qs
import base64
import io
import traceback

# Imports for Gemini image processing
from google import genai as gemini_ai # Renamed to avoid conflict with genai used for text
from google.genai import types as gemini_types

# PDF Processing Imports
from langchain_community.document_loaders import PyPDFLoader
from groq import Groq
import tempfile

# Load environment variables from .env file
load_dotenv()

app = FastAPI()

# Initialize Groq client for Llama3 PDF Q&A
llama_api_key = os.getenv("LLAMA_API_KEY")
groq_client = None # Initialize to None

if not llama_api_key:
    # Log a warning instead of raising an error to allow other functionalities
    logging.warning("LLAMA_API_KEY not found in .env file. PDF Q&A feature will not work.")
else:
    try:
        # Explicitly create an httpx client.
        # This allows httpx to use its default proxy handling (e.g., from environment variables)
        # and bypasses potential issues with Groq's internal client wrapper mis-passing the 'proxies' argument.
        custom_httpx_client = httpx.Client()
        groq_client = Groq(api_key=llama_api_key, http_client=custom_httpx_client)
        logging.info("Groq client initialized successfully with custom httpx client.")
    except Exception as e:
        logging.error(f"Failed to initialize Groq client: {e}", exc_info=True)
        # groq_client remains None if initialization fails

# Allow CORS for frontend communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Add your frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve static files from the assets directory
@app.on_event("startup")
async def startup_event():
    if not os.path.exists("assets"):
        os.makedirs("assets", exist_ok=True)
    app.mount("/assets", StaticFiles(directory="assets"), name="assets")

# Store chat sessions and their history in memory
chat_sessions: Dict[str, dict] = {}

# Store workspace info - will be saved to a config file
workspace_info = {
    "last_directory": None  # Last opened directory
}

CONFIG_FILE = "workspace_config.json"


# Path normalization function for cross-platform compatibility
def normalize_path(path):
    """Normalize path for cross-platform compatibility (Windows/macOS/Linux)"""
    # Convert to Path object which handles different separators
    return os.path.normpath(path)


# Load config if it exists
def load_config():
    global workspace_info
    try:
        if os.path.exists(CONFIG_FILE):
            with open(CONFIG_FILE, 'r') as f:
                workspace_info = json.load(f)
                # Normalize path if it exists
                if workspace_info.get("last_directory"):
                    workspace_info["last_directory"] = normalize_path(workspace_info["last_directory"])
    except Exception as e:
        logging.error(f"Error loading config: {e}", exc_info=True)


# Save config
def save_config():
    try:
        with open(CONFIG_FILE, 'w') as f:
            json.dump(workspace_info, f)
    except Exception as e:
        logging.error(f"Error saving config: {e}", exc_info=True)


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


class ImageProcessRequest(BaseModel):
    image_url: str  # Relative URL like /assets/image.png
    prompt_text: Optional[str] = None


class CreateFileRequest(BaseModel):
    path: str
    type: str
    parent_path: Optional[str] = None
    name: str


class WorkspaceRequest(BaseModel):
    directory: str


class LogEntry(BaseModel):
    log: str


class YouTubeAnalyzeRequest(BaseModel):
    youtube_url: str
    prompt: Optional[str] = None


class YouTubeCodeExtractRequest(BaseModel):
    youtube_url: str


class PDFQuestionRequest(BaseModel):
    pdf_text: str
    question: str


# Add new model for web scraping request
class ScrapeRequest(BaseModel):
    url: str


# Add new model for base64 image upload
class Base64UploadRequest(BaseModel):
    base64_data: str
    filename: str
    directory: str = "assets"


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
                logging.warning("Warning: GEMINI_API_KEY not found in environment variables")
                return "New Chat"

            genai.configure(api_key=api_key)

            # Validate conversation history
            if not conversation_history or len(conversation_history) < 2:
                logging.warning("Warning: Not enough messages for title generation")
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
                    logging.warning(f"Error accessing message attributes: {e}")
                    logging.warning(f"Problematic message: {msg}")
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
                logging.error(f"Error generating title with Gemini API: {e}")
                return "New Chat"
        except Exception as e:
            logging.error(f"Unexpected error in generate_title: {e}")
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
                logging.warning("Warning: Gemini API returned a response with empty content.")
                return ""
        except Exception as e:
            logging.error(f"Error calling Gemini API: {e}")
            if session_id in chat_sessions:
                del chat_sessions[session_id]  # Clear problematic session
            return ""


# File system operations
@app.post("/api/workspace/set")
async def set_workspace(request: WorkspaceRequest):
    """Set the current workspace directory"""
    try:
        directory = normalize_path(request.directory)
        if not os.path.exists(directory):
            raise HTTPException(status_code=404, detail="Directory not found")

        # Save to global config
        workspace_info["last_directory"] = directory
        save_config()

        return {"status": "success", "directory": directory}
    except Exception as e:
        logging.error(f"Error setting workspace: {e}", exc_info=True)
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
        logging.error(f"Error getting workspace: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/files/list")
async def list_files(directory: Optional[str] = None):
    """List all files in a directory"""
    try:
        if not directory:
            directory = workspace_info.get("last_directory")
            if not directory:
                return {"items": [], "error": "No workspace set"}

        directory = normalize_path(directory)
        if not os.path.exists(directory):
            raise HTTPException(status_code=404, detail="Directory not found")

        # Get file structure recursively
        structure = read_directory_structure(directory)
        return {"items": structure}
    except Exception as e:
        logging.error(f"Error listing files: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


def read_directory_structure(directory, base_path=None):
    """Read directory structure recursively with enhanced metadata"""
    items = []
    if base_path is None:
        base_path = directory

    try:
        for entry in os.scandir(directory):
            relative_path = os.path.relpath(entry.path, base_path)
            
            # Get basic file stats
            stats = entry.stat()
            
            if entry.is_dir():
                items.append({
                    "id": relative_path,
                    "name": entry.name,
                    "type": "folder",
                    "modified": datetime.fromtimestamp(stats.st_mtime).isoformat(),
                    "children": read_directory_structure(entry.path, base_path)
                })
            else:
                # Get file extension
                _, ext = os.path.splitext(entry.name)
                
                items.append({
                    "id": relative_path,
                    "name": entry.name,
                    "type": "file",
                    "size": stats.st_size,
                    "extension": ext.lower()[1:] if ext else "",
                    "modified": datetime.fromtimestamp(stats.st_mtime).isoformat()
                })
        return items
    except Exception as e:
        logging.error(f"Error reading directory structure: {e}", exc_info=True)
        return []


@app.get("/api/files/read")
async def read_file(path: str):
    """Read file content"""
    try:
        current_workspace_dir_from_config = workspace_info.get("last_directory")
        logger.info(f"[READ_FILE] Received request for path parameter: '{path}'")
        logger.info(f"[READ_FILE] Current workspace_info['last_directory'] from config: '{current_workspace_dir_from_config}'")

        if not current_workspace_dir_from_config:
            logger.error("[READ_FILE] No workspace set in workspace_info. The 'last_directory' is missing or null.")
            raise HTTPException(status_code=400, detail="No workspace set. Please select a workspace directory first.")

        # Normalize both the workspace directory from config and the incoming path parameter
        workspace_dir = normalize_path(current_workspace_dir_from_config)
        # The 'path' parameter should already be a relative path like 'file.txt' or 'folder/file.txt'
        # It comes from file.id on the frontend, which is os.path.relpath from the backend's list_files
        normalized_relative_path_param = normalize_path(path)
        
        logger.info(f"[READ_FILE] Normalized workspace_dir from config: '{workspace_dir}'")
        logger.info(f"[READ_FILE] Normalized relative_path_param from request: '{normalized_relative_path_param}'")

        # Construct the full absolute path
        full_path = os.path.join(workspace_dir, normalized_relative_path_param)
        logger.info(f"[READ_FILE] Constructed full_path to check: '{full_path}'")
        
        # Check for existence and if it's a file
        path_exists = os.path.exists(full_path)
        is_file = False
        if path_exists:
            is_file = os.path.isfile(full_path)
        
        logger.info(f"[READ_FILE] Does full_path ('{full_path}') exist? {path_exists}")
        if path_exists:
            logger.info(f"[READ_FILE] Is full_path ('{full_path}') a file? {is_file}")
        else:
            # If path doesn't exist, list directory contents of workspace_dir for debugging
            logger.warning(f"[READ_FILE] The path '{full_path}' does not exist. Debugging information follows.")
            try:
                if os.path.exists(workspace_dir) and os.path.isdir(workspace_dir):
                    logger.info(f"[READ_FILE] Listing contents of workspace_dir ('{workspace_dir}') for debugging:")
                    for item_count, item_name in enumerate(os.listdir(workspace_dir)):
                        logger.info(f"[READ_FILE]   - Item {item_count + 1}: '{item_name}'")
                        if item_count > 50: # Limit logging if directory is too large
                            logger.info(f"[READ_FILE]   ... (and more items)")
                            break
                else:
                    logger.warning(f"[READ_FILE] workspace_dir ('{workspace_dir}') itself does not exist or is not a directory.")
                
                # Also check one level deeper if normalized_relative_path_param contains a directory structure
                # e.g. if normalized_relative_path_param is "folder/file.txt"
                path_parts = Path(normalized_relative_path_param).parts
                if len(path_parts) > 1: # Path contains subdirectories
                    potential_subdir_name = path_parts[0]
                    potential_subdir_full_path = os.path.join(workspace_dir, potential_subdir_name)
                    logger.info(f"[READ_FILE] Checking if first part of relative path ('{potential_subdir_name}') is a directory: '{potential_subdir_full_path}'")
                    if os.path.exists(potential_subdir_full_path) and os.path.isdir(potential_subdir_full_path):
                        logger.info(f"[READ_FILE] Listing contents of potential subdirectory ('{potential_subdir_full_path}'):")
                        for item_count, item_name in enumerate(os.listdir(potential_subdir_full_path)):
                            logger.info(f"[READ_FILE]     - Item {item_count + 1}: '{item_name}'")
                            if item_count > 50:
                                logger.info(f"[READ_FILE]     ... (and more items)")
                                break
                    else:
                        logger.info(f"[READ_FILE] Potential subdirectory ('{potential_subdir_full_path}') does not exist or is not a directory.")
            except Exception as list_err:
                logger.error(f"[READ_FILE] Error listing directory contents for debugging: {list_err}", exc_info=True)


        if not path_exists:
            logger.error(f"[READ_FILE] File/Directory not found at full_path: '{full_path}'. Raising 404.")
            raise HTTPException(status_code=404, detail=f"File or directory not found. Attempted path: {normalized_relative_path_param}")

        if not is_file:
            logger.error(f"[READ_FILE] Path is not a file at full_path: '{full_path}'. It might be a directory or other type. Raising 400.")
            raise HTTPException(status_code=400, detail=f"The specified path '{normalized_relative_path_param}' is not a regular file.")

        try:
            with open(full_path, 'r', encoding='utf-8') as f:
                content = f.read()
            logger.info(f"[READ_FILE] Successfully read content from: '{full_path}'")
            return {"content": content}
        except UnicodeDecodeError:
            logger.warning(f"[READ_FILE] UnicodeDecodeError for file: '{full_path}'. It might be a binary file.")
            return {"content": "", "error": "Binary file content cannot be displayed."}
        except Exception as read_err:
            logger.error(f"[READ_FILE] Error reading file content from '{full_path}': {read_err}", exc_info=True)
            raise HTTPException(status_code=500, detail=f"Could not read file: {str(read_err)}")
            
    except HTTPException as http_exc: # Re-raise HTTPExceptions directly
        # No need to log again here if it's one of the specific ones raised above, but general HTTPExceptions are caught.
        if not (http_exc.status_code == 404 and "File or directory not found" in http_exc.detail) and \
           not (http_exc.status_code == 400 and ("No workspace set" in http_exc.detail or "not a regular file" in http_exc.detail)):
            logger.error(f"[READ_FILE] HTTPException occurred: {http_exc.status_code} - {http_exc.detail}", exc_info=True)
        raise http_exc
    except Exception as e:
        logger.error(f"[READ_FILE] Unexpected error in read_file endpoint: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"An unexpected server error occurred: {str(e)}")


@app.post("/api/files/write")
async def write_file(request: FileRequest):
    """Write content to a file"""
    try:
        if not workspace_info.get("last_directory"):
            raise HTTPException(status_code=400, detail="No workspace set")

        workspace_dir = normalize_path(workspace_info["last_directory"])
        path = normalize_path(request.path)
        full_path = os.path.join(workspace_dir, path)

        # Create directories if they don't exist
        os.makedirs(os.path.dirname(full_path), exist_ok=True)

        with open(full_path, 'w', encoding='utf-8') as f:
            f.write(request.content or "")

        return {"status": "success"}
    except Exception as e:
        logging.error(f"Error writing file: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/files/create")
async def create_file_or_folder(request: CreateFileRequest):
    """Create a new file or folder"""
    try:
        if not workspace_info.get("last_directory"):
            raise HTTPException(status_code=400, detail="No workspace set")

        workspace_dir = normalize_path(workspace_info["last_directory"])
        
        # Determine the parent directory
        if request.parent_path:
            parent_path = normalize_path(request.parent_path)
            parent_dir = os.path.join(workspace_dir, parent_path)
        else:
            parent_dir = workspace_dir

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
        relative_path = os.path.relpath(full_path, workspace_dir)

        return {
            "status": "success",
            "id": relative_path,
            "name": request.name,
            "type": request.type
        }
    except Exception as e:
        logging.error(f"Error creating file/folder: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/files/delete")
async def delete_file(path: str):
    """Delete a file or directory"""
    try:
        if not workspace_info.get("last_directory"):
            raise HTTPException(status_code=400, detail="No workspace set")

        workspace_dir = normalize_path(workspace_info["last_directory"])
        path = normalize_path(path)
        full_path = os.path.join(workspace_dir, path)

        if not os.path.exists(full_path):
            raise HTTPException(status_code=404, detail="File not found")

        if os.path.isdir(full_path):
            shutil.rmtree(full_path)
        else:
            os.remove(full_path)

        return {"status": "success"}
    except Exception as e:
        logging.error(f"Error deleting file: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/files/rename")
async def rename_file(request: RenameRequest):
    """Rename a file or directory"""
    try:
        if not workspace_info.get("last_directory"):
            raise HTTPException(status_code=400, detail="No workspace set")

        workspace_dir = normalize_path(workspace_info["last_directory"])
        old_path = normalize_path(request.old_path)
        new_path = normalize_path(request.new_path)
        
        old_full_path = os.path.join(workspace_dir, old_path)
        new_full_path = os.path.join(workspace_dir, new_path)

        if not os.path.exists(old_full_path):
            raise HTTPException(status_code=404, detail="File not found")

        # Create parent directories if they don't exist
        os.makedirs(os.path.dirname(new_full_path), exist_ok=True)

        # Rename/move the file
        shutil.move(old_full_path, new_full_path)

        return {"status": "success"}
    except Exception as e:
        logging.error(f"Error renaming file: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/create-session")
async def create_session():
    session_id = str(uuid4())
    return {"session_id": session_id}


@app.post("/generate-title")
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


@app.post("/ask-ai")
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
        
        # Force to the foreground on macOS
        root.attributes("-topmost", True)
        
        # Open the native file dialog with improved UI handling
        selected_dir = filedialog.askdirectory(
            title='Select Workspace Directory',
            mustexist=True,  # Ensure the directory exists
            parent=root  # Explicitly set parent to ensure proper modal behavior
        )
        
        # Immediately kill the window to prevent hanging
        root.destroy()

        if selected_dir:
            # Normalize path and update workspace info
            selected_dir = normalize_path(selected_dir)
            workspace_info["last_directory"] = selected_dir
            save_config()
            return {"status": "success", "directory": selected_dir}
        else:
            return {"status": "cancelled", "directory": None}

    except Exception as e:
        logging.error(f"Error selecting directory: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/files/select-file")
async def select_file(multiple: bool = False):
    """Open native file dialog to select file(s)"""
    try:
        # Create a root window but hide it
        root = tk.Tk()
        root.withdraw()  # Hide the main window
        
        # Force to the foreground on macOS
        root.attributes("-topmost", True)
        
        # Open the native file dialog
        if multiple:
            selected_files = filedialog.askopenfilenames(
                title='Select Files',
                parent=root  # Explicitly set parent
            )
            files = list(selected_files)  # Convert to list
        else:
            selected_file = filedialog.askopenfilename(
                title='Select File',
                parent=root  # Explicitly set parent
            )
            files = [selected_file] if selected_file else []
        
        # Immediately destroy the window
        root.destroy()
        
        # Normalize paths
        normalized_files = [normalize_path(f) for f in files if f]
        
        return {"status": "success" if normalized_files else "cancelled", "files": normalized_files}
    
    except Exception as e:
        logging.error(f"Error selecting file(s): {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/workspace/browse")
async def browse_workspace():
    """Get the file structure from the current workspace"""
    try:
        directory = workspace_info.get("last_directory")
        if not directory:
            return {"items": [], "error": "No workspace set"}
            
        directory = normalize_path(directory)
        if not os.path.exists(directory):
            raise HTTPException(status_code=404, detail="Directory not found")
            
        # Get file structure recursively with more details
        structure = read_directory_structure(directory)
        return {
            "status": "success",
            "directory": directory,
            "items": structure
        }
    except Exception as e:
        logging.error(f"Error browsing workspace: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/write-log")
async def write_log(log_entry: LogEntry):
    try:
        # Create logs directory if it doesn't exist
        os.makedirs("logs", exist_ok=True)
        
        # Get current date for the log file name
        current_date = datetime.now().strftime("%Y-%m-%d")
        log_file_path = f"logs/scribe_ai_{current_date}.log"
        
        # Append the log entry to the file
        with open(log_file_path, "a", encoding="utf-8") as f:
            f.write(log_entry.log)
        
        return {"status": "success", "message": "Log entry written successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to write log: {str(e)}")


@app.post("/api/files/upload")
async def upload_file(file: UploadFile = File(...)):
    """Upload a file (primarily for images)"""
    try:
        # Create an assets directory in the root folder if it doesn't exist
        assets_dir = "assets"
        os.makedirs(assets_dir, exist_ok=True)

        # Generate unique filename
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        original_filename = file.filename
        extension = os.path.splitext(original_filename)[1]
        new_filename = f"image_{timestamp}{extension}"
        
        # Full path for the file
        file_path = os.path.join(assets_dir, new_filename)
        
        # Save the file
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        # Return the relative path for markdown with forward slashes
        relative_path = f"/assets/{new_filename}"
        
        return {
            "status": "success",
            "path": relative_path,
            "filename": new_filename
        }
    except Exception as e:
        logging.error(f"Error uploading file: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/files/upload-base64")
async def upload_base64_image(request: Base64UploadRequest):
    """Upload a base64-encoded image (primarily for TinyCats feature)"""
    try:
        # Ensure the directory exists
        os.makedirs(request.directory, exist_ok=True)
        
        # Generate full path for the file
        file_path = os.path.join(request.directory, request.filename)
        
        # Decode the base64 data
        try:
            image_data = base64.b64decode(request.base64_data)
        except Exception as e:
            logging.error(f"Error decoding base64 data: {e}")
            raise HTTPException(status_code=400, detail="Invalid base64 data")
        
        # Save the decoded image
        with open(file_path, "wb") as f:
            f.write(image_data)
        
        # Return the relative path for accessing the image
        relative_path = f"/{request.directory}/{request.filename}"
        
        return {
            "status": "success",
            "path": relative_path,
            "filename": request.filename
        }
    except Exception as e:
        logging.error(f"Error uploading base64 image: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/files/cleanup-tinycats")
async def cleanup_tinycats_images():
    """Clean up old TinyCats images from the assets directory"""
    try:
        assets_dir = "assets"
        
        # Check if directory exists
        if not os.path.exists(assets_dir):
            return {"status": "success", "message": "No assets directory found"}
        
        # Count how many files were deleted
        deleted_count = 0
        
        # Get all tinycats image files
        for filename in os.listdir(assets_dir):
            if filename.startswith("tinycats_") and (filename.endswith(".png") or filename.endswith(".jpg")):
                file_path = os.path.join(assets_dir, filename)
                try:
                    # Get file age in days
                    file_age = (datetime.now() - datetime.fromtimestamp(os.path.getmtime(file_path))).days
                    
                    # Delete files older than 7 days
                    if file_age > 7:
                        os.remove(file_path)
                        deleted_count += 1
                except Exception as inner_e:
                    logging.warning(f"Error processing file {filename}: {inner_e}")
        
        return {
            "status": "success", 
            "message": f"Cleaned up {deleted_count} TinyCats images"
        }
    except Exception as e:
        logging.error(f"Error cleaning up TinyCats images: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# --- Centralized Logging Setup ---
LOG_SERVER_URL = "http://localhost:9999/log"
log_queue = queue.Queue()

def send_log_worker():
    """Worker thread to send logs without blocking the main thread."""
    while True:
        try:
            log_record = log_queue.get()
            if log_record is None: # Sentinel to stop the worker
                break
            
            log_entry = {
                "timestamp": datetime.fromtimestamp(log_record.created).isoformat(),
                "level": log_record.levelname,
                "message": log_record.getMessage(),
                "source": "python",
                "application": "python",
                "loggerName": log_record.name,
                "fileName": log_record.filename,
                "lineNumber": log_record.lineno
            }
            
            # Add exception info if available
            if log_record.exc_info:
                exc_type, exc_value, exc_traceback = log_record.exc_info
                if exc_type and exc_value:
                    log_entry["error"] = {
                        "type": exc_type.__name__,
                        "message": str(exc_value),
                        "traceback": format_traceback(exc_traceback) if exc_traceback else None
                    }
            
            # Format as a single line of JSON text
            log_string = json.dumps(log_entry) + '\n' 
            
            try:
                requests.post(LOG_SERVER_URL, 
                              json={"log": log_string, "type": "python", "application": "python"}, 
                              timeout=1.0) # Slightly longer timeout
            except requests.exceptions.RequestException as e:
                # Fall back to stdout if log server is down
                print(f"[LOG] {log_entry['level']} - {log_entry['message']}") 
        except Exception as e:
            print(f"Error in log sending worker: {e}")
        finally:
            log_queue.task_done()

def format_traceback(tb):
    """Format a traceback object into a list of strings"""
    import traceback
    if tb:
        return traceback.format_tb(tb)
    return []

class HttpLogHandler(logging.Handler):
    """A logging handler that sends records to the Node.js log server via a queue."""
    def __init__(self, url):
        super().__init__()
        self.url = url

    def emit(self, record):
        try:
            # Put the log record onto the queue for the worker to process
            log_queue.put(record)
        except Exception as e:
            print(f"Error in HttpLogHandler.emit: {e}")

# Configure root logger
root_logger = logging.getLogger()
root_logger.setLevel(logging.INFO)

# Remove existing handlers to avoid duplicates
for handler in root_logger.handlers[:]:
    root_logger.removeHandler(handler)

# Add file handler for local logs
logs_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'logs')
os.makedirs(logs_dir, exist_ok=True)
file_handler = logging.FileHandler(os.path.join(logs_dir, 'python.logs'))
file_formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
file_handler.setFormatter(file_formatter)
root_logger.addHandler(file_handler)

# Add HTTP handler for remote logging
http_handler = HttpLogHandler(LOG_SERVER_URL)
http_formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
http_handler.setFormatter(http_formatter)
root_logger.addHandler(http_handler)

# Add console handler
console_handler = logging.StreamHandler()
console_formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
console_handler.setFormatter(console_formatter)
root_logger.addHandler(console_handler)

# Start the log sending worker thread
log_worker_thread = Thread(target=send_log_worker, daemon=True)
log_worker_thread.start()

# Set up module-specific loggers
logger = logging.getLogger("scribe-backend")
logger.info("Python backend logging initialized and configured to send to Node.js log server.")
# --- End Centralized Logging Setup ---


class AIChatRequest(BaseModel):
    user_prompt: str
    system_prompt: str = "You are a helpful assistant."

@app.post("/api/ai-chat")
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


@app.post("/api/image/process")
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


# PDF Processing Helper Functions
def extract_text_from_pdf_file(pdf_path: str):
    """Extract all text from a PDF file using LangChain."""
    try:
        loader = PyPDFLoader(pdf_path)
        documents = loader.load()
        text = "\\n".join(doc.page_content for doc in documents)
        return text
    except Exception as e:
        logging.error(f"Error extracting text from PDF {pdf_path}: {e}", exc_info=True)
        return f"Error extracting text: {e}"

def ask_question_to_pdf_text(pdf_text: str, question: str):
    """Ask a question based on the content of the PDF using Llama3 via Groq."""
    if not groq_client:
        return "Llama3 client not initialized due to missing LLAMA_API_KEY."
    try:
        # Truncate pdf_text if it's too long for the context window,
        # keeping in mind the model's limits (e.g., llama3-8b-8192)
        # A rough estimate for token to char ratio is 1 token ~ 4 chars.
        # 8192 tokens * 3 chars/token (conservative) = ~24000 chars.
        # We also need space for the question and system prompt.
        max_text_len = 20000 # Max length for the PDF text part of the prompt
        
        messages = [
            {"role": "system", "content": "You are a helpful assistant analyzing PDF content. Answer the user's question based on the provided text from a PDF document."},
            {"role": "user", "content": f"The PDF contains the following text (potentially truncated): {pdf_text[:max_text_len]}"},
            {"role": "user", "content": question}
        ]
        completion = groq_client.chat.completions.create(
            model="llama3-8b-8192", # Or any other suitable model available via Groq
            messages=messages,
            temperature=0.7,
            max_tokens=1000, # Allow for longer answers
            top_p=1,
            stream=False
        )
        
        if hasattr(completion, 'choices') and len(completion.choices) > 0:
            return completion.choices[0].message.content
        else:
            logging.warning("Unexpected response structure from Llama3 API via Groq.")
            return "Unexpected response structure from Llama3 API."
    except Exception as e:
        logging.error(f"Error interacting with Llama3 via Groq: {e}", exc_info=True)
        return f"Error interacting with Llama3: {e}"


# PDF Processing Endpoints
@app.post("/api/pdf/extract-text")
async def pdf_extract_text(file: UploadFile = File(...)):
    """
    Uploads a PDF file, extracts text from it, and returns the extracted text.
    """
    try:
        # Create a temporary file to store the uploaded PDF
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp_pdf:
            shutil.copyfileobj(file.file, tmp_pdf)
            tmp_pdf_path = tmp_pdf.name
        
        extracted_text = extract_text_from_pdf_file(tmp_pdf_path)
        
    except Exception as e:
        logging.error(f"Error processing uploaded PDF for text extraction: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to process PDF: {str(e)}")
    finally:
        # Ensure the temporary file is deleted
        if 'tmp_pdf_path' in locals() and os.path.exists(tmp_pdf_path):
            os.remove(tmp_pdf_path)
        # Close the uploaded file
        if file and hasattr(file, 'file') and not file.file.closed:
            file.file.close()

    if extracted_text.startswith("Error extracting text:"):
        raise HTTPException(status_code=500, detail=extracted_text)
        
    return {"text": extracted_text}

@app.post("/api/pdf/ask")
async def pdf_ask_question(request: PDFQuestionRequest):
    """
    Receives extracted PDF text and a question, then returns an answer
    generated by Llama3 via Groq.
    """
    if not groq_client:
        raise HTTPException(status_code=503, detail="PDF Q&A service is unavailable due to missing API key.")
    try:
        if not request.pdf_text or not request.pdf_text.strip():
            raise HTTPException(status_code=400, detail="PDF text cannot be empty.")
        if not request.question or not request.question.strip():
            raise HTTPException(status_code=400, detail="Question cannot be empty.")
            
        answer = ask_question_to_pdf_text(request.pdf_text, request.question)
        
        if answer.startswith("Error interacting with Llama3:") or \
           answer == "Unexpected response structure from Llama3 API." or \
           answer == "Llama3 client not initialized due to missing LLAMA_API_KEY.":
            raise HTTPException(status_code=500, detail=answer)
            
        return {"answer": answer}
    except HTTPException:
        raise # Re-raise HTTPExceptions directly
    except Exception as e:
        logging.error(f"Error in PDF ask question endpoint: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"An unexpected error occurred: {str(e)}")


# Add new model for web scraping request
class ScrapeRequest(BaseModel):
    url: str

# Add new endpoint for web scraping
@app.post("/api/scrape")
async def scrape_website(request: ScrapeRequest):
    """Scrape content from a website"""
    try:
        # Validate URL
        parsed_url = urlparse(request.url)
        if not parsed_url.scheme or not parsed_url.netloc:
            raise HTTPException(status_code=400, detail="Invalid URL format")

        # Set up headers to mimic a browser
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }

        async with aiohttp.ClientSession() as session:
            async with session.get(request.url, headers=headers) as response:
                if response.status != 200:
                    raise HTTPException(status_code=response.status, detail=f"Failed to fetch website: {response.status}")

                html = await response.text()
                
                # Parse HTML with BeautifulSoup
                soup = BeautifulSoup(html, 'html.parser')
                
                # Remove script and style elements
                for script in soup(["script", "style"]):
                    script.decompose()
                
                # Get text content
                text = soup.get_text(separator='\n', strip=True)
                
                # Clean up text
                lines = (line.strip() for line in text.splitlines())
                chunks = (phrase.strip() for line in lines for phrase in line.split("  "))
                text = '\n'.join(chunk for chunk in chunks if chunk)
                
                # Get title
                title = soup.title.string if soup.title else "No title found"
                
                # Get meta description
                meta_desc = soup.find('meta', attrs={'name': 'description'})
                description = meta_desc['content'] if meta_desc else None
                
                # Get main content (try to find the main article or content area)
                main_content = None
                for tag in ['article', 'main', '[role="main"]', '#content', '.content']:
                    content = soup.select_one(tag)
                    if content:
                        main_content = content.get_text(separator='\n', strip=True)
                        break
                
                return {
                    "title": title,
                    "description": description,
                    "text": text,
                    "main_content": main_content,
                    "url": request.url
                }

    except aiohttp.ClientError as e:
        raise HTTPException(status_code=500, detail=f"Error fetching website: {str(e)}")
    except Exception as e:
        logging.error(f"Error scraping website: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error scraping website: {str(e)}")


# --- YouTube Helper Endpoints ---
async def fetch_youtube_transcript(video_url: str):
    try:
        parsed_url = urlparse(video_url)
        video_id = None
        if 'youtube.com' in parsed_url.netloc:
            video_id = parse_qs(parsed_url.query).get('v', [None])[0]
        elif 'youtu.be' in parsed_url.netloc:
            video_id = parsed_url.path.lstrip('/')

        if not video_id:
            raise ValueError("Invalid YouTube URL or could not extract video ID.")

        # This is a placeholder for actual transcript fetching logic.
        # You'll need to integrate a library like `youtube-transcript-api`
        # or use a more direct approach if Google provides an API for this.
        # For now, we simulate a transcript.
        logger.info(f"Fetching transcript for video ID: {video_id}")
        # from youtube_transcript_api import YouTubeTranscriptApi
        # transcript_list = YouTubeTranscriptApi.get_transcript(video_id)
        # transcript = " ".join([item['text'] for item in transcript_list])
        # return transcript
        
        # SIMULATED TRANSCRIPT FOR NOW:
        simulated_transcript = f"This is a simulated transcript for YouTube video {video_id}. " \
                               "In this video, we will learn how to write a simple Python script. " \
                               "First, create a file named main.py. Inside main.py, write: print('Hello, World!'). " \
                               "Then, create an HTML file, index.html. Add a basic structure: <html><body><h1>Test</h1></body></html>. " \
                               "For styling, create style.css and add: body {{ font-family: Arial; }}. " \
                               "Finally, a JavaScript file, script.js, can log to console: console.log('Script loaded');"
        logger.info(f"Returning SIMULATED transcript for {video_id}")
        return simulated_transcript

    except Exception as e:
        logger.error(f"Error fetching YouTube transcript for {video_url}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to fetch YouTube transcript: {str(e)}")

@app.post("/api/youtube/analyze")
async def youtube_analyze(request: YouTubeAnalyzeRequest):
    try:
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise HTTPException(status_code=500, detail="GEMINI_API_KEY not found")
        genai.configure(api_key=api_key)

        transcript = await fetch_youtube_transcript(request.youtube_url)
        if not transcript:
            raise HTTPException(status_code=404, detail="Could not retrieve transcript for the video.")

        prompt_text = request.prompt if request.prompt else "Provide a detailed analysis and summary of the following YouTube video transcript for note-taking purposes. Break down key concepts, main points, and any actionable information. Format it clearly."
        
        full_prompt = f"Video Transcript:\n\n{transcript}\n\nAnalysis Task:\n{prompt_text}"

        model = genai.GenerativeModel('gemini-2.0-flash')
        response = await asyncio.to_thread(model.generate_content, full_prompt)
        
        if not response.text:
            raise HTTPException(status_code=500, detail="AI analysis returned an empty response.")
            
        return {"analysis_text": response.text}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in YouTube analysis endpoint: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error analyzing YouTube video: {str(e)}")

@app.post("/api/youtube/extract-code")
async def youtube_extract_code(request: YouTubeCodeExtractRequest):
    try:
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise HTTPException(status_code=500, detail="GEMINI_API_KEY not found")
        genai.configure(api_key=api_key)

        transcript = await fetch_youtube_transcript(request.youtube_url)
        if not transcript:
            raise HTTPException(status_code=404, detail="Could not retrieve transcript for the video.")

        system_prompt = ('''
            You are an AI assistant specialized in extracting code and instructions from YouTube video transcripts.
            Analyze the provided transcript and perform the following tasks:
            1.  Identify all distinct code blocks mentioned or shown. For each code block:
                *   Infer a filename (e.g., `index.html`, `main.py`, `style.css`). If multiple snippets belong to the same file but are shown at different times, consolidate them under that filename if logical.
                *   Infer the programming language (e.g., `python`, `javascript`, `html`, `css`).
                *   Extract the code exactly as it would appear in a file. Do NOT add any explanations or comments within the code itself unless they are part of the original code in the transcript.
                *   If a part of the code is clearly described but not explicitly shown (e.g., "...and then we close the div tag..."), you can infer and add that missing part if it's unambiguous and essential for completeness.
            2.  Summarize the steps or instructions provided in the video in a clear, point-by-point, or easily readable text format. This should explain how to use or set up the extracted code, or the general process being taught.

            Return the response as a JSON object with two keys:
            *   `extracted_code`: A list of objects, where each object has `filename`, `language`, and `code` keys.
            *   `instructions`: A string containing the summarized steps/instructions.

            If no code is found, `extracted_code` should be an empty list. If no specific instructions are found, `instructions` can be a brief message indicating that.
            Focus on accuracy and completeness of the code. The output should be directly usable by a developer.
            Example JSON output format:
            ```json
            {
              "extracted_code": [
                {
                  "filename": "index.html",
                  "language": "html",
                  "code": "<!DOCTYPE html>\\n<html>\\n<head><title>Test</title></head>\\n<body><h1>Hello</h1></body>\\n</html>"
                },
                {
                  "filename": "main.py",
                  "language": "python",
                  "code": "print(\'Hello from Python!\')"
                }
              ],
              "instructions": "1. Create an HTML file named index.html with the provided content.\\n2. Create a Python file named main.py with the print statement.\\n3. Run the Python script."
            }
            ```
        ''')
        
        full_prompt = f"{system_prompt}\n\nVideo Transcript:\n\n{transcript}"

        model = genai.GenerativeModel(
            model_name='gemini-2.0-flash', 
            generation_config=genai.types.GenerationConfig(response_mime_type="application/json")
        )
        response = await asyncio.to_thread(model.generate_content, full_prompt)
        
        if not response.text:
            raise HTTPException(status_code=500, detail="AI code extraction returned an empty response.")
        
        try:
            # The model is configured to return JSON, so we parse it directly.
            json_response = json.loads(response.text)
            # Validate basic structure
            if (not isinstance(json_response.get('extracted_code'), list) or 
               not isinstance(json_response.get('instructions'), str)):
                logger.error(f"AI response is not in the expected JSON format. Response: {response.text}")
                # Fallback: Try to wrap the raw text in a basic structure if it's not JSON
                # This is a very basic fallback, ideally the model always returns valid JSON.
                return {
                    "extracted_code": [],
                    "instructions": "Could not parse AI response. Raw output: " + response.text
                }
            return json_response
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse JSON response from AI: {e}. Response: {response.text}")
            # If JSON parsing fails, return the raw text as instructions for debugging or simple cases
            return {
                "extracted_code": [],
                "instructions": "Failed to parse AI response. Raw output: " + response.text
            }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in YouTube code extraction: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error extracting code from YouTube video: {str(e)}")


if __name__ == "__main__":
    import uvicorn
    # Ensure logging setup happens before run
    logger.info("Starting Uvicorn server...")
    uvicorn.run(app, host="0.0.0.0", port=8000)

# Ensure worker thread stops cleanly on exit (though daemon=True helps)
# You might add more sophisticated shutdown logic if needed
# atexit.register(lambda: log_queue.put(None))
