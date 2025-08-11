from fastapi import APIRouter, HTTPException, UploadFile, File
from typing import Optional
from ..models.models import WorkspaceRequest, FileRequest, CreateFileRequest, RenameRequest, Base64UploadRequest
import os
import shutil
from datetime import datetime
from pathlib import Path
import logging
import tkinter as tk
from tkinter import filedialog
import base64

router = APIRouter()

# This is a temporary solution. In a real application, this should be handled by a proper dependency injection system.
# For now, we will access the global workspace_info and config functions from main.
# This will be refactored later.
from ..main import workspace_info, save_config, normalize_path, read_directory_structure, logger

@router.post("/workspace/set", tags=["workspace"])
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
        logger.error(f"Error setting workspace: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/workspace/get", tags=["workspace"])
async def get_workspace():
    """Get the current workspace directory"""
    try:
        directory = workspace_info.get("last_directory")
        if directory and os.path.exists(directory):
            return {"directory": directory}
        return {"directory": None}
    except Exception as e:
        logger.error(f"Error getting workspace: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/files/list")
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
        logger.error(f"Error listing files: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/files/read")
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

@router.post("/files/write")
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
        logger.error(f"Error writing file: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/files/create")
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
        logger.error(f"Error creating file/folder: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/files/delete")
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
        logger.error(f"Error deleting file: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/files/rename")
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
        logger.error(f"Error renaming file: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/workspace/select-directory", tags=["workspace"])
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
        logger.error(f"Error selecting directory: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/files/select-file")
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
        logger.error(f"Error selecting file(s): {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/workspace/browse", tags=["workspace"])
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
        logger.error(f"Error browsing workspace: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/files/upload")
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
        logger.error(f"Error uploading file: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/files/upload-base64")
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
            logger.error(f"Error decoding base64 data: {e}")
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
        logger.error(f"Error uploading base64 image: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/files/cleanup-tinycats")
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
                    logger.warning(f"Error processing file {filename}: {inner_e}")

        return {
            "status": "success",
            "message": f"Cleaned up {deleted_count} TinyCats images"
        }
    except Exception as e:
        logger.error(f"Error cleaning up TinyCats images: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
