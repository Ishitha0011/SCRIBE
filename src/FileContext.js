import React, { createContext, useState, useContext, useEffect } from 'react';
import FileService from './FileService';

const FileContext = createContext();

export const useFileContext = () => useContext(FileContext);

export const FileProvider = ({ children }) => {
  const [openFiles, setOpenFiles] = useState([]);
  const [activeFileId, setActiveFileId] = useState(null);
  const [fileContents, setFileContents] = useState({});
  const [workspacePath, setWorkspacePath] = useState(null);
  const [fileStructure, setFileStructure] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [pendingChanges, setPendingChanges] = useState({});

  // Load workspace path and restore open files on mount
  useEffect(() => {
    const loadWorkspace = async () => {
      try {
        const path = await FileService.getWorkspace();
        if (path) {
          setWorkspacePath(path);
          loadFileStructure(path);
          
          // After loading file structure, restore open files
          restoreOpenFiles();
        }
      } catch (error) {
        console.error('Error loading workspace:', error);
        setError('Failed to load workspace');
      }
    };

    loadWorkspace();
  }, []);

  // Restore open files from localStorage
  const restoreOpenFiles = async () => {
    try {
      const savedOpenFiles = localStorage.getItem('scribe-openFiles');
      const savedActiveFileId = localStorage.getItem('scribe-activeFileId');
      const savedFileContents = localStorage.getItem('scribe-fileContents');
      
      if (savedOpenFiles) {
        const parsedOpenFiles = JSON.parse(savedOpenFiles);
        setOpenFiles(parsedOpenFiles);
        
        // Load content for each open file
        const contentPromises = parsedOpenFiles.map(async (file) => {
          if (!file.isNew) {
            try {
              const content = await FileService.readFile(file.id);
              return { id: file.id, content };
            } catch (error) {
              console.error(`Error loading content for file ${file.id}:`, error);
              return { id: file.id, content: '' };
            }
          }
          return { id: file.id, content: '' };
        });
        
        const loadedContents = await Promise.all(contentPromises);
        const contentsMap = loadedContents.reduce((acc, item) => {
          acc[item.id] = item.content;
          return acc;
        }, {});
        
        // If there were cached file contents, merge them with loaded contents
        if (savedFileContents) {
          const parsedContents = JSON.parse(savedFileContents);
          setFileContents({ ...contentsMap, ...parsedContents });
        } else {
          setFileContents(contentsMap);
        }
        
        // Restore active file
        if (savedActiveFileId && parsedOpenFiles.some(file => file.id === savedActiveFileId)) {
          setActiveFileId(savedActiveFileId);
        } else if (parsedOpenFiles.length > 0) {
          setActiveFileId(parsedOpenFiles[0].id);
        }
      }
      
      // Recover pending changes if any
      const savedPendingChanges = localStorage.getItem('scribe-pendingChanges');
      if (savedPendingChanges) {
        setPendingChanges(JSON.parse(savedPendingChanges));
      }
    } catch (error) {
      console.error('Error restoring open files:', error);
    }
  };

  // Save open files to localStorage whenever they change
  useEffect(() => {
    if (openFiles.length > 0) {
      localStorage.setItem('scribe-openFiles', JSON.stringify(openFiles));
    }
  }, [openFiles]);

  // Save active file to localStorage whenever it changes
  useEffect(() => {
    if (activeFileId) {
      localStorage.setItem('scribe-activeFileId', activeFileId);
    }
  }, [activeFileId]);

  // Save file contents to localStorage whenever they change
  useEffect(() => {
    if (Object.keys(fileContents).length > 0) {
      localStorage.setItem('scribe-fileContents', JSON.stringify(fileContents));
    }
  }, [fileContents]);

  // Save pending changes to localStorage whenever they change
  useEffect(() => {
    if (Object.keys(pendingChanges).length > 0) {
      localStorage.setItem('scribe-pendingChanges', JSON.stringify(pendingChanges));
    } else {
      localStorage.removeItem('scribe-pendingChanges');
    }
  }, [pendingChanges]);

  // Load file structure
  const loadFileStructure = async (path = null) => {
    setLoading(true);
    try {
      const structure = await FileService.listFiles(path);
      setFileStructure(structure);
      setError(null);
    } catch (error) {
      console.error('Error loading file structure:', error);
      setError('Failed to load files');
    } finally {
      setLoading(false);
    }
  };

  // Set workspace directory and load its file structure
  const setWorkspace = async (directory) => {
    setLoading(true);
    try {
      await FileService.setWorkspace(directory);
      setWorkspacePath(directory);
      await loadFileStructure();
      setError(null);
      return true;
    } catch (error) {
      console.error('Error setting workspace:', error);
      setError('Failed to set workspace');
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Open a file and set it as active, optionally with a search term to highlight
  const openFile = async (fileItem, searchTerm = null, lineNumber = null) => {
    try {
      // Check if file is a canvas file by its extension before proceeding
      let updatedFileItem = { ...fileItem };
      
      // Ensure canvas files are properly identified by their extension
      if (fileItem.name && fileItem.name.toLowerCase().endsWith('.canvas') && fileItem.type !== 'canvas') {
        updatedFileItem.type = 'canvas';
        // Also update the file type in the open files array if it's already open
        setOpenFiles(prev => prev.map(file => 
          file.id === fileItem.id 
            ? { ...file, type: 'canvas' } 
            : file
        ));
      }
      
      // Check if file is already open
      const isOpen = openFiles.some(file => file.id === updatedFileItem.id);
      
      if (!isOpen) {
        // Add to open files if not already open
        // Include searchTerm and lineNumber if provided
        const fileWithSearch = {
          ...updatedFileItem,
          searchHighlight: searchTerm,
          scrollToLine: lineNumber
        };
        setOpenFiles(prev => [...prev, fileWithSearch]);
      } else if (searchTerm || lineNumber) {
        // Update existing open file with search highlight info
        setOpenFiles(prev => prev.map(file => 
          file.id === updatedFileItem.id 
            ? { ...file, searchHighlight: searchTerm, scrollToLine: lineNumber, type: updatedFileItem.type } 
            : file
        ));
      }
      
      // Set as active
      setActiveFileId(updatedFileItem.id);
      
      // Load file content if not already loaded
      if (!fileContents[updatedFileItem.id] && (updatedFileItem.type === 'file' || updatedFileItem.type === 'canvas')) {
        if (updatedFileItem.isNew) {
          // This is a new file, no need to load content
          setFileContents(prev => ({
            ...prev,
            [updatedFileItem.id]: updatedFileItem.type === 'canvas' 
              ? JSON.stringify({ nodes: [], edges: [], format: "canvas", version: "1.0" })
              : ''
          }));
        } else {
          // Existing file, load from server
          try {
            const content = await FileService.readFile(updatedFileItem.id);
            setFileContents(prev => ({
              ...prev,
              [updatedFileItem.id]: content
            }));
            
            // If this is a canvas file, also make sure the type is set correctly
            if (updatedFileItem.name && updatedFileItem.name.toLowerCase().endsWith('.canvas')) {
              updateFileType(updatedFileItem.id, 'canvas');
            }
          } catch (error) {
            console.error('Error reading file content:', error);
            // Still create an entry to avoid repeated attempts
            setFileContents(prev => ({
              ...prev,
              [updatedFileItem.id]: updatedFileItem.type === 'canvas'
                ? JSON.stringify({ nodes: [], edges: [], format: "canvas", version: "1.0" })
                : ''
            }));
          }
        }
      }
    } catch (error) {
      console.error('Error opening file:', error);
    }
  };

  // Save file content
  const saveFile = async (fileId, content) => {
    try {
      const fileItem = openFiles.find(file => file.id === fileId);
      
      if (fileItem) {
        if (fileItem.isNew) {
          // This is a new file, need to create it first
          // Ask the user for a file name and location
          const fileName = prompt('Enter file name:', fileItem.name);
          
          if (!fileName) return false; // User cancelled
          
          // Determine if file should be created in a specific folder
          let parentPath = null;
          
          try {
            // Create the file on the server
            const result = await FileService.createItem(fileName, 'file', parentPath);
            
            if (result.status === 'success') {
              // Update the file info
              const updatedFile = {
                ...fileItem,
                id: result.id,
                name: fileName,
                isNew: false
              };
              
              // Replace the file in openFiles
              setOpenFiles(prev => prev.map(file => 
                file.id === fileId ? updatedFile : file
              ));
              
              // Set content
              await FileService.writeFile(result.id, content);
              
              // Update in-memory content
              setFileContents(prev => ({
                ...prev,
                [fileId]: content  // Keep old ID for now
              }));
              
              // If this is a brand new file, also add it to the new key
              if (result.id !== fileId) {
                setFileContents(prev => ({
                  ...prev,
                  [result.id]: content
                }));
              }
              
              // Clear pending changes for this file
              setPendingChanges(prev => {
                const newPendingChanges = { ...prev };
                delete newPendingChanges[fileId];
                return newPendingChanges;
              });
              
              // Refresh file structure
              await loadFileStructure();
              
              return true;
            }
          } catch (error) {
            console.error('Error creating new file:', error);
            return false;
          }
        } else {
          // Existing file, just save it
          await FileService.writeFile(fileItem.id, content);
          
          // Update in-memory content
          setFileContents(prev => ({
            ...prev,
            [fileId]: content
          }));
          
          // Clear pending changes for this file
          setPendingChanges(prev => {
            const newPendingChanges = { ...prev };
            delete newPendingChanges[fileId];
            return newPendingChanges;
          });
          
          return true;
        }
      }
      
      return false;
    } catch (error) {
      console.error('Error saving file:', error);
      return false;
    }
  };

  // Create a new file or folder
  const createItem = async (name, type, parentPath = null) => {
    try {
      const result = await FileService.createItem(name, type, parentPath);
      
      if (result.status === 'success') {
        // Refresh file structure
        await loadFileStructure();
        return result;
      }
      
      return null;
    } catch (error) {
      console.error('Error creating item:', error);
      return null;
    }
  };

  // Delete a file or folder
  const deleteItem = async (path) => {
    try {
      const result = await FileService.deleteItem(path);
      
      if (result.status === 'success') {
        // If file is open, close it
        const openFile = openFiles.find(file => file.id === path);
        if (openFile) {
          closeFile(path);
        }
        
        // Refresh file structure
        await loadFileStructure();
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Error deleting item:', error);
      return false;
    }
  };

  // Rename a file or folder
  const renameItem = async (oldPath, newName) => {
    try {
      // Extract directory part from oldPath
      const lastSlashIndex = oldPath.lastIndexOf('/');
      const directory = lastSlashIndex === -1 ? '' : oldPath.substring(0, lastSlashIndex);
      
      // Construct new path
      const newPath = directory ? `${directory}/${newName}` : newName;
      
      const result = await FileService.renameItem(oldPath, newPath);
      
      if (result.status === 'success') {
        // If file is open, update its info
        const openFileIndex = openFiles.findIndex(file => file.id === oldPath);
        
        if (openFileIndex !== -1) {
          const updatedFiles = [...openFiles];
          updatedFiles[openFileIndex] = {
            ...updatedFiles[openFileIndex],
            id: newPath,
            name: newName
          };
          
          setOpenFiles(updatedFiles);
          
          // Update file contents mapping
          if (fileContents[oldPath]) {
            setFileContents(prev => {
              const newContents = { ...prev };
              newContents[newPath] = newContents[oldPath];
              delete newContents[oldPath];
              return newContents;
            });
          }
          
          // Update pending changes if any
          if (pendingChanges[oldPath]) {
            setPendingChanges(prev => {
              const newPendingChanges = { ...prev };
              newPendingChanges[newPath] = newPendingChanges[oldPath];
              delete newPendingChanges[oldPath];
              return newPendingChanges;
            });
          }
          
          // Update active file if needed
          if (activeFileId === oldPath) {
            setActiveFileId(newPath);
          }
        }
        
        // Refresh file structure
        await loadFileStructure();
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Error renaming item:', error);
      return false;
    }
  };

  // Close a file
  const closeFile = (fileId) => {
    setOpenFiles(prev => prev.filter(file => file.id !== fileId));
    
    // Clean up file content
    setFileContents(prev => {
      const newContents = { ...prev };
      delete newContents[fileId];
      return newContents;
    });
    
    // Clear pending changes for this file
    setPendingChanges(prev => {
      const newPendingChanges = { ...prev };
      delete newPendingChanges[fileId];
      return newPendingChanges;
    });
    
    // If closing the active file, set the next available file as active
    if (fileId === activeFileId) {
      const remainingFiles = openFiles.filter(file => file.id !== fileId);
      if (remainingFiles.length > 0) {
        setActiveFileId(remainingFiles[remainingFiles.length - 1].id);
      } else {
        setActiveFileId(null);
      }
    }
  };

  // Update file content in memory and mark pending changes
  const updateFileContent = (fileId, content) => {
    setFileContents(prev => ({
      ...prev,
      [fileId]: content
    }));
    
    // Mark as having pending changes
    setPendingChanges(prev => ({
      ...prev,
      [fileId]: {
        timestamp: Date.now(),
        content
      }
    }));
  };

  // Auto-save any pending changes
  const autoSaveChanges = async () => {
    const now = Date.now();
    const pendingFiles = Object.entries(pendingChanges);
    let savedAny = false;
    
    if (pendingFiles.length === 0) return;
    
    for (const [fileId, { timestamp, content }] of pendingFiles) {
      try {
        // Check if file is still open
        const fileItem = openFiles.find(file => file.id === fileId);
        if (!fileItem) continue;
        
        // Skip new files (require user interaction to name them)
        if (fileItem.isNew) continue;
        
        // Save the file to the backend
        const result = await FileService.writeFile(fileItem.id, content);
        
        if (result.status === 'success') {
          // Update in-memory content to ensure it's available after reload
          setFileContents(prev => ({
            ...prev,
            [fileId]: content
          }));
          
          // Remove from pending changes
          setPendingChanges(prev => {
            const newPendingChanges = { ...prev };
            delete newPendingChanges[fileId];
            return newPendingChanges;
          });
          
          savedAny = true;
          console.log(`Auto-saved file: ${fileItem.name}`);
        } else {
          console.error(`Failed to auto-save file ${fileItem.name}`);
        }
      } catch (error) {
        console.error(`Error auto-saving file ${fileId}:`, error);
      }
    }
    
    // Update the localStorage after auto-saving
    if (savedAny) {
      localStorage.setItem('scribe-fileContents', JSON.stringify(fileContents));
    }
  };

  // Update file type (used for canvas files)
  const updateFileType = (fileId, newType) => {
    setOpenFiles(prev => prev.map(file => 
      file.id === fileId ? { ...file, type: newType } : file
    ));
    
    // Also update the file structure to reflect this change
    loadFileStructure();
  };

  // Get active file content
  const getActiveFileContent = () => {
    return activeFileId ? fileContents[activeFileId] || '' : '';
  };

  // Get active file info
  const getActiveFile = () => {
    return openFiles.find(file => file.id === activeFileId) || null;
  };

  // Search in file contents
  const searchInContent = async (searchTerm) => {
    if (!searchTerm || searchTerm.trim() === '') {
      setSearchResults([]);
      return [];
    }
    
    try {
      setIsSearching(true);
      const results = await FileService.searchContent(searchTerm);
      setSearchResults(results);
      setIsSearching(false);
      return results;
    } catch (error) {
      console.error('Error searching in contents:', error);
      setIsSearching(false);
      return [];
    }
  };

  return (
    <FileContext.Provider
      value={{
        openFiles,
        activeFileId,
        fileContents,
        workspacePath,
        fileStructure,
        loading,
        error,
        searchResults,
        isSearching,
        pendingChanges,
        setWorkspace,
        loadFileStructure,
        openFile,
        saveFile,
        closeFile,
        updateFileContent,
        updateFileType,
        getActiveFileContent,
        getActiveFile,
        createItem,
        deleteItem,
        renameItem,
        searchInContent,
        autoSaveChanges
      }}
    >
      {children}
    </FileContext.Provider>
  );
};

export default FileContext; 