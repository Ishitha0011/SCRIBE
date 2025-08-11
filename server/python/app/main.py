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

from .models.models import *

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

from .api import files
app.include_router(files.router, prefix="/api", tags=["files"])

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


from .api import ai
app.include_router(ai.router, prefix="/api", tags=["ai"])

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

from .api import pdf
app.include_router(pdf.router, prefix="/api", tags=["pdf"])

# Add new model for web scraping request
class ScrapeRequest(BaseModel):
    url: str

# Add new endpoint for web scraping

from .api import web
app.include_router(web.router, prefix="/api", tags=["web"])

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

if __name__ == "__main__":
    import uvicorn
    # Ensure logging setup happens before run
    logger.info("Starting Uvicorn server...")
    uvicorn.run(app, host="0.0.0.0", port=8000)

# Ensure worker thread stops cleanly on exit (though daemon=True helps)
# You might add more sophisticated shutdown logic if needed
# atexit.register(lambda: log_queue.put(None))
