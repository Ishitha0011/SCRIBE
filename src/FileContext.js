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

  // Load workspace path on mount
  useEffect(() => {
    const loadWorkspace = async () => {
      try {
        const path = await FileService.getWorkspace();
        if (path) {
          setWorkspacePath(path);
          loadFileStructure(path);
        }
      } catch (error) {
        console.error('Error loading workspace:', error);
        setError('Failed to load workspace');
      }
    };

    loadWorkspace();
  }, []);

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

  // Open a file and set it as active
  const openFile = async (fileItem) => {
    try {
      // Check if file is already open
      const isOpen = openFiles.some(file => file.id === fileItem.id);
      
      if (!isOpen) {
        // Add to open files if not already open
        setOpenFiles(prev => [...prev, fileItem]);
      }
      
      // Set as active
      setActiveFileId(fileItem.id);
      
      // Load file content if not already loaded
      if (!fileContents[fileItem.id] && fileItem.type === 'file') {
        if (fileItem.isNew) {
          // This is a new file, no need to load content
          setFileContents(prev => ({
            ...prev,
            [fileItem.id]: ''
          }));
        } else {
          // Existing file, load from server
          try {
            const content = await FileService.readFile(fileItem.id);
            setFileContents(prev => ({
              ...prev,
              [fileItem.id]: content
            }));
          } catch (error) {
            console.error('Error reading file content:', error);
            // Still create an entry to avoid repeated attempts
            setFileContents(prev => ({
              ...prev,
              [fileItem.id]: ''
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

  // Update file content in memory
  const updateFileContent = (fileId, content) => {
    setFileContents(prev => ({
      ...prev,
      [fileId]: content
    }));
  };

  // Get active file content
  const getActiveFileContent = () => {
    return activeFileId ? fileContents[activeFileId] || '' : '';
  };

  // Get active file info
  const getActiveFile = () => {
    return openFiles.find(file => file.id === activeFileId) || null;
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
        setWorkspace,
        loadFileStructure,
        openFile,
        saveFile,
        closeFile,
        updateFileContent,
        getActiveFileContent,
        getActiveFile,
        createItem,
        deleteItem,
        renameItem
      }}
    >
      {children}
    </FileContext.Provider>
  );
};

export default FileContext; 