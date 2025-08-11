from pydantic import BaseModel
from typing import List, Optional, Dict, Union

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

class AIChatRequest(BaseModel):
    user_prompt: str
    system_prompt: str = "You are a helpful assistant."
