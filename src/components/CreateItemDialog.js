/* eslint-disable */

import React, { useState, useEffect, useRef } from 'react';
import { Folder, FileText, File, FileCode, FileBox, PenTool } from 'lucide-react';
import '../css/CreateItemDialog.css';

const CreateItemDialog = ({ onClose, onCreate, theme, parentFolderName = 'workspace' }) => {
  const [newItemType, setNewItemType] = useState('file');
  const [newItemName, setNewItemName] = useState('');
  const [fileExtension, setFileExtension] = useState('txt');
  const [error, setError] = useState('');
  const nameInputRef = useRef(null);

  // Auto-focus the input field when dialog opens
  useEffect(() => {
    const timer = setTimeout(() => {
      if (nameInputRef.current) {
        nameInputRef.current.focus();
      }
    }, 100);
    
    return () => clearTimeout(timer);
  }, []);

  // When item type changes, set a default name for the new item
  useEffect(() => {
    if (newItemType === 'canvas' && newItemName === '') {
      setNewItemName('New Canvas');
    }
  }, [newItemType, newItemName]);

  const handleCreate = () => {
    // Validate input
    if (newItemName.trim() === '') {
      setError('Please enter a name');
      return;
    }

    // For files, append the extension if provided
    let finalName = newItemName;
    if (newItemType === 'file' && fileExtension && !newItemName.includes('.')) {
      finalName = `${newItemName}.${fileExtension}`;
    }
    
    // For canvas, append .canvas extension if not already present
    if (newItemType === 'canvas' && !newItemName.includes('.')) {
      finalName = `${newItemName}.canvas`;
    }

    // Call the onCreate function passed from parent
    onCreate(newItemType, finalName);
    onClose();
  };
  
  // Handle Enter key press
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleCreate();
    } else if (e.key === 'Escape') {
      onClose();
    }
    // Clear error when user types
    if (error) {
      setError('');
    }
  };

  const getFileIcon = () => {
    switch(fileExtension) {
      case 'js':
      case 'jsx':
      case 'ts':
      case 'tsx':
        return <FileCode size={18} />;
      case 'md':
      case 'txt':
        return <FileBox size={18} />;
      default:
        return <FileText size={18} />;
    }
  };

  return (
    <div className={`DialogOverlay ${theme}`}>
      <div className={`DialogContent ${theme}`}>
        <div className="DialogHeader">
          <h2>Create New</h2>
        </div>
        <div className="DialogBody">
          <div className="ParentFolderInfo">
            Creating in <span className="ParentFolderName">{parentFolderName}</span>
          </div>
          <div className="ItemTypeSelection">
            <button 
              className={`TypeButton ${newItemType === 'file' ? 'active' : ''}`}
              onClick={() => setNewItemType('file')}
            >
              {fileExtension ? getFileIcon() : <FileText size={18} />}
              <span>File</span>
            </button>
            <button 
              className={`TypeButton ${newItemType === 'folder' ? 'active' : ''}`}
              onClick={() => setNewItemType('folder')}
            >
              <Folder size={18} />
              <span>Folder</span>
            </button>
            <button 
              className={`TypeButton ${newItemType === 'canvas' ? 'active' : ''}`}
              onClick={() => setNewItemType('canvas')}
            >
              <PenTool size={18} />
              <span>Canvas</span>
            </button>
          </div>
          
          {newItemType === 'file' && (
            <div className="InputGroup">
              <label htmlFor="file-extension">File Type:</label>
              <select 
                id="file-extension" 
                className="Input" 
                value={fileExtension} 
                onChange={(e) => setFileExtension(e.target.value)}
              >
                <option value="txt">Text (.txt)</option>
                <option value="md">Markdown (.md)</option>
                <option value="js">JavaScript (.js)</option>
                <option value="jsx">React (.jsx)</option>
                <option value="ts">TypeScript (.ts)</option>
                <option value="tsx">React TS (.tsx)</option>
                <option value="html">HTML (.html)</option>
                <option value="css">CSS (.css)</option>
                <option value="json">JSON (.json)</option>
                <option value="py">Python (.py)</option>
              </select>
            </div>
          )}
          
          <div className="InputGroup">
            <label htmlFor="new-item-name">Name:</label>
            <input
              id="new-item-name"
              ref={nameInputRef}
              type="text"
              placeholder={newItemType === 'canvas' ? 'Enter canvas name...' : `Enter ${newItemType} name...`}
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              onKeyDown={handleKeyDown}
              className="Input"
            />
            {error && <div className="InputError">{error}</div>}
          </div>
        </div>
        <div className="DialogFooter">
          <button className="Button CancelButton" onClick={onClose}>
            Cancel
          </button>
          <button className="Button CreateButton" onClick={handleCreate}>
            Create
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreateItemDialog;
