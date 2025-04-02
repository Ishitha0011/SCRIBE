/* eslint-disable */

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

  // Search within file contents
  async searchContent(searchTerm, maxResults = 50) {
    try {
      const allFiles = await this.getAllFiles();
      const results = [];
      
      // Process files in parallel with a limit of 10 concurrent operations
      const batchSize = 10;
      for (let i = 0; i < allFiles.length; i += batchSize) {
        const batch = allFiles.slice(i, i + batchSize);
        const batchPromises = batch.map(async (file) => {
          try {
            // Skip binary files and very large files
            const extension = file.name.split('.').pop().toLowerCase();
            const binaryExtensions = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'ico', 'pdf', 'zip', 'gz', 'tar', 'exe', 'dll', 'bin'];
            
            if (binaryExtensions.includes(extension)) {
              return null;
            }
            
            const content = await this.readFile(file.id);
            if (!content) return null;
            
            // Search for matches in content
            const matches = [];
            const lines = content.split('\n');
            const searchTermLower = searchTerm.toLowerCase();
            
            lines.forEach((line, index) => {
              const lineContent = line.trim();
              if (lineContent.toLowerCase().includes(searchTermLower)) {
                // Find the position of the match in the line
                const matchIndex = lineContent.toLowerCase().indexOf(searchTermLower);
                
                // Extract context (text before and after the match)
                const contextStart = Math.max(0, matchIndex - 30);
                const contextEnd = Math.min(lineContent.length, matchIndex + searchTermLower.length + 30);
                
                // Get preview with ellipsis if needed
                const preview = {
                  before: contextStart > 0 ? '...' + lineContent.substring(contextStart, matchIndex) : lineContent.substring(0, matchIndex),
                  match: lineContent.substring(matchIndex, matchIndex + searchTermLower.length),
                  after: contextEnd < lineContent.length ? lineContent.substring(matchIndex + searchTermLower.length, contextEnd) + '...' : lineContent.substring(matchIndex + searchTermLower.length)
                };
                
                matches.push({
                  line: index + 1,
                  content: lineContent,
                  preview: preview
                });
              }
            });
            
            if (matches.length > 0) {
              results.push({
                file: file,
                matches: matches
              });
              
              // Stop if we've reached the max results
              if (results.length >= maxResults) {
                return 'max_reached';
              }
            }
            
            return null;
          } catch (error) {
            console.error(`Error searching file ${file.name}:`, error);
            return null;
          }
        });
        
        const batchResults = await Promise.all(batchPromises);
        if (batchResults.includes('max_reached')) {
          break;
        }
      }
      
      return results;
    } catch (error) {
      console.error('Error searching content:', error);
      throw error;
    }
  }
  
  // Helper method to get all files recursively
  async getAllFiles(directory = '') {
    try {
      const items = await this.listFiles(directory);
      let files = [];
      
      for (const item of items) {
        if (item.type === 'file') {
          files.push(item);
        } else if (item.type === 'folder') {
          const childFiles = await this.getAllFiles(item.id);
          files = [...files, ...childFiles];
        }
      }
      
      return files;
    } catch (error) {
      console.error('Error getting all files:', error);
      return [];
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