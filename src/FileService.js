// FileService.js - Service for handling file system operations via API

import API_BASE_URL from './config';

class FileService {
  // Get the last workspace directory
  async getWorkspace() {
    try {
      const response = await fetch(`${API_BASE_URL}/workspace/get`);
      const data = await response.json();
      return data.directory;
    } catch (error) {
      console.error('Error getting workspace:', error);
      return null;
    }
  }

  // Set the workspace directory
  async setWorkspace(directory) {
    try {
      const response = await fetch(`${API_BASE_URL}/workspace/set`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ directory }),
      });
      const data = await response.json();
      return data.directory;
    } catch (error) {
      console.error('Error setting workspace:', error);
      throw error;
    }
  }

  // List files in a directory
  async listFiles(directory = null) {
    try {
      let url = `${API_BASE_URL}/files/list`;
      if (directory) {
        url += `?directory=${encodeURIComponent(directory)}`;
      }
      const response = await fetch(url);
      const data = await response.json();
      return data.items || [];
    } catch (error) {
      console.error('Error listing files:', error);
      throw error;
    }
  }

  // Read file content
  async readFile(path) {
    try {
      const response = await fetch(`${API_BASE_URL}/files/read?path=${encodeURIComponent(path)}`);
      const data = await response.json();
      
      if (data.error) {
        console.warn(`Warning reading file: ${data.error}`);
        return '';
      }
      
      return data.content;
    } catch (error) {
      console.error('Error reading file:', error);
      throw error;
    }
  }

  // Write file content
  async writeFile(path, content) {
    try {
      const response = await fetch(`${API_BASE_URL}/files/write`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          path,
          content,
        }),
      });
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error writing file:', error);
      throw error;
    }
  }

  // Create a new file or folder
  async createItem(name, type, parentPath = null) {
    try {
      // Ensure we have a valid item type
      if (type !== 'file' && type !== 'folder') {
        throw new Error('Invalid item type. Must be "file" or "folder".');
      }

      const response = await fetch(`${API_BASE_URL}/files/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
          type,
          parent_path: parentPath,
          path: parentPath ? `${parentPath}/${name}` : name
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to create item');
      }
      
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error creating item:', error);
      throw error;
    }
  }

  // Delete a file or folder
  async deleteItem(path) {
    try {
      const response = await fetch(`${API_BASE_URL}/files/delete?path=${encodeURIComponent(path)}`, {
        method: 'DELETE',
      });
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error deleting item:', error);
      throw error;
    }
  }

  // Rename a file or folder
  async renameItem(oldPath, newPath) {
    try {
      const response = await fetch(`${API_BASE_URL}/files/rename`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          old_path: oldPath,
          new_path: newPath,
        }),
      });
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error renaming item:', error);
      throw error;
    }
  }
}

export default new FileService(); 