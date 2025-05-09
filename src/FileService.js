/* eslint-disable */

import API_BASE_URL from './config';

// Create a logger for file operations
const logFileOperation = (operation, details = {}, level = 'INFO') => {
  const logEntry = {
    timestamp: new Date().toISOString(),
    operation,
    level: level.toUpperCase(),
    details,
  };
  
  // Send log entry to the logging system (e.g., console, server)
  console.log(`[${logEntry.timestamp}] [${logEntry.level}] [${logEntry.operation}]`, logEntry.details);
}

class FileService {
  // Get the last workspace directory
  async getWorkspace() {
    try {
      const response = await fetch(`${API_BASE_URL}/workspace/get`);
      const data = await response.json();
      logFileOperation('getWorkspace', { 
        directory: data.directory || 'not set',
        status: response.status
      });
      return data.directory;
    } catch (error) {
      logFileOperation('getWorkspace', { error: error.message }, 'ERROR');
      console.error('Error getting workspace:', error);
      return null;
    }
  }

  // Set the workspace directory
  async setWorkspace(directory) {
    try {
      logFileOperation('setWorkspace', { directory });
      
      const response = await fetch(`${API_BASE_URL}/workspace/set`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ directory }),
      });
      const data = await response.json();
      
      if (!response.ok) {
        logFileOperation('setWorkspace', { 
          directory,
          status: response.status,
          error: data.detail || 'Failed to set workspace'
        }, 'ERROR');
      }
      
      return data.directory;
    } catch (error) {
      logFileOperation('setWorkspace', { 
        directory, 
        error: error.message 
      }, 'ERROR');
      console.error('Error setting workspace:', error);
      throw error;
    }
  }

  // List files in a directory
  async listFiles(directory = null) {
    try {
      logFileOperation('listFiles', { directory });
      
      let url = `${API_BASE_URL}/files/list`;
      if (directory) {
        url += `?directory=${encodeURIComponent(directory)}`;
      }
      const response = await fetch(url);
      const data = await response.json();
      
      // Process the file items to identify canvas files by extension
      if (data.items) {
        data.items = data.items.map(item => {
          // If it's a file and has .canvas extension, set its type to 'canvas'
          if (item.type === 'file' && item.name.toLowerCase().endsWith('.canvas')) {
            return { ...item, type: 'canvas' };
          }
          return item;
        });
      }
      
      logFileOperation('listFiles', { 
        directory, 
        itemCount: data.items?.length || 0,
        status: response.status
      });
      
      return data.items || [];
    } catch (error) {
      logFileOperation('listFiles', { 
        directory, 
        error: error.message 
      }, 'ERROR');
      console.error('Error listing files:', error);
      throw error;
    }
  }

  // Read file content
  async readFile(path) {
    try {
      logFileOperation('readFile', { path });
      
      const response = await fetch(`${API_BASE_URL}/files/read?path=${encodeURIComponent(path)}`);
      const data = await response.json();
      
      if (data.error) {
        logFileOperation('readFile', { 
          path, 
          error: data.error,
          status: response.status 
        }, 'WARNING');
        console.warn(`Warning reading file: ${data.error}`);
        return '';
      }
      
      const fileSize = data.content ? data.content.length : 0;
      logFileOperation('readFile', { 
        path, 
        fileSize,
        status: response.status
      });
      
      // Check if this is a canvas file based on extension and content
      const isCanvasFile = path.toLowerCase().endsWith('.canvas');
      
      if (isCanvasFile && data.content) {
        try {
          // Try to parse as JSON to verify it's a valid canvas file
          const contentObj = JSON.parse(data.content);
          
          // If it already has canvas format attributes, use as is
          if (contentObj.format === 'canvas' || contentObj.nodes !== undefined) {
            logFileOperation('readFile', { 
              path, 
              fileType: 'canvas',
              valid: true
            });
            return data.content;
          } else {
            // Not properly formatted as canvas, initialize with empty canvas structure
            logFileOperation('readFile', { 
              path, 
              fileType: 'canvas',
              valid: false,
              action: 'initializing empty canvas'
            }, 'WARNING');
            return JSON.stringify({ 
              nodes: [], 
              edges: [], 
              format: "canvas", 
              version: "1.0",
              created: new Date().toISOString()
            });
          }
        } catch (e) {
          // Not valid JSON, initialize with empty canvas structure
          logFileOperation('readFile', { 
            path, 
            fileType: 'canvas',
            error: e.message,
            action: 'initializing empty canvas'
          }, 'WARNING');
          return JSON.stringify({ 
            nodes: [], 
            edges: [], 
            format: "canvas", 
            version: "1.0",
            created: new Date().toISOString()
          });
        }
      }
      
      return data.content;
    } catch (error) {
      logFileOperation('readFile', { 
        path, 
        error: error.message 
      }, 'ERROR');
      console.error('Error reading file:', error);
      throw error;
    }
  }

  // Search within file contents
  async searchContent(searchTerm, maxResults = 50) {
    try {
      logFileOperation('searchContent', { 
        searchTerm, 
        maxResults 
      });
      
      const allFiles = await this.getAllFiles();
      const results = [];
      let filesChecked = 0;
      let filesWithMatches = 0;
      let totalMatches = 0;
      
      // Process files in parallel with a limit of 10 concurrent operations
      const batchSize = 10;
      for (let i = 0; i < allFiles.length; i += batchSize) {
        const batch = allFiles.slice(i, i + batchSize);
        const batchPromises = batch.map(async (file) => {
          try {
            filesChecked++;
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
                
                totalMatches++;
              }
            });
            
            if (matches.length > 0) {
              filesWithMatches++;
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
            logFileOperation('searchContent', { 
              searchTerm, 
              file: file.name,
              error: error.message 
            }, 'WARNING');
            console.error(`Error searching file ${file.name}:`, error);
            return null;
          }
        });
        
        const batchResults = await Promise.all(batchPromises);
        if (batchResults.includes('max_reached')) {
          break;
        }
      }
      
      logFileOperation('searchContent', { 
        searchTerm,
        filesChecked,
        filesWithMatches,
        totalMatches,
        resultsReturned: results.length
      });
      
      return results;
    } catch (error) {
      logFileOperation('searchContent', { 
        searchTerm, 
        error: error.message 
      }, 'ERROR');
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
      logFileOperation('getAllFiles', { 
        directory, 
        error: error.message 
      }, 'ERROR');
      console.error('Error getting all files:', error);
      return [];
    }
  }

  // Write file content
  async writeFile(path, content) {
    try {
      const contentLength = content ? content.length : 0;
      logFileOperation('writeFile', { 
        path, 
        contentLength 
      });
      
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
      
      if (!response.ok) {
        logFileOperation('writeFile', { 
          path, 
          status: response.status,
          error: data.detail || 'Failed to write file'
        }, 'ERROR');
        return { status: 'error', error: data.detail || 'Failed to write file' };
      } else {
        logFileOperation('writeFile', { 
          path, 
          status: response.status,
          success: true
        });
        return { status: 'success', ...data };
      }
    } catch (error) {
      logFileOperation('writeFile', { 
        path, 
        error: error.message 
      }, 'ERROR');
      console.error('Error writing file:', error);
      return { status: 'error', error: error.message };
    }
  }

  // Create a new file or folder
  async createItem(name, type, parentPath = null) {
    try {
      logFileOperation('createItem', { 
        name, 
        type, 
        parentPath 
      });
      
      // Ensure we have a valid item type
      if (type !== 'file' && type !== 'folder') {
        const error = 'Invalid item type. Must be "file" or "folder".';
        logFileOperation('createItem', { 
          name, 
          type, 
          parentPath,
          error
        }, 'ERROR');
        throw new Error(error);
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
        logFileOperation('createItem', { 
          name, 
          type, 
          parentPath,
          status: response.status,
          error: errorData.detail || 'Failed to create item'
        }, 'ERROR');
        throw new Error(errorData.detail || 'Failed to create item');
      }
      
      const data = await response.json();
      logFileOperation('createItem', { 
        name, 
        type, 
        parentPath,
        status: response.status,
        id: data.id || null,
        success: true
      });
      
      return data;
    } catch (error) {
      logFileOperation('createItem', { 
        name, 
        type, 
        parentPath,
        error: error.message 
      }, 'ERROR');
      console.error('Error creating item:', error);
      throw error;
    }
  }

  // Delete a file or folder
  async deleteItem(path) {
    try {
      logFileOperation('deleteItem', { path });
      
      const response = await fetch(`${API_BASE_URL}/files/delete?path=${encodeURIComponent(path)}`, {
        method: 'DELETE',
      });
      const data = await response.json();
      
      if (!response.ok) {
        logFileOperation('deleteItem', { 
          path,
          status: response.status,
          error: data.detail || 'Failed to delete item'
        }, 'ERROR');
      } else {
        logFileOperation('deleteItem', { 
          path,
          status: response.status,
          success: true
        });
      }
      
      return data;
    } catch (error) {
      logFileOperation('deleteItem', { 
        path,
        error: error.message 
      }, 'ERROR');
      console.error('Error deleting item:', error);
      throw error;
    }
  }

  // Rename a file or folder
  async renameItem(oldPath, newPath) {
    try {
      logFileOperation('renameItem', { oldPath, newPath });
      
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
      
      if (!response.ok) {
        logFileOperation('renameItem', { 
          oldPath,
          newPath,
          status: response.status,
          error: data.detail || 'Failed to rename item'
        }, 'ERROR');
      } else {
        logFileOperation('renameItem', { 
          oldPath,
          newPath,
          status: response.status,
          success: true
        });
      }
      
      return data;
    } catch (error) {
      logFileOperation('renameItem', { 
        oldPath,
        newPath,
        error: error.message 
      }, 'ERROR');
      console.error('Error renaming item:', error);
      throw error;
    }
  }
}

export default new FileService(); 