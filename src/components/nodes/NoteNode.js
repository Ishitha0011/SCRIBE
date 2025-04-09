import React, { useState, useEffect } from 'react';
import { Handle, Position } from 'reactflow';
import '../../css/Nodes.css';
import { StickyNote, FileText, X, Plus } from 'lucide-react';

const NoteNode = ({ data, isConnectable }) => {
  const [selectedFiles, setSelectedFiles] = useState(data.selectedFiles || []);
  const [showFileSelector, setShowFileSelector] = useState(false);
  const [availableFiles, setAvailableFiles] = useState([]);
  
  // Mock function to get available files - replace with actual implementation
  useEffect(() => {
    // This would be replaced with actual file fetching logic
    const fetchFiles = async () => {
      // Mock data - replace with actual API call
      const mockFiles = [
        { id: 'file1', name: 'Research Notes.md' },
        { id: 'file2', name: 'Project Ideas.md' },
        { id: 'file3', name: 'Meeting Notes.md' },
        { id: 'file4', name: 'Todo List.md' },
      ];
      setAvailableFiles(mockFiles);
    };
    
    fetchFiles();
  }, []);
  
  // Update data when selected files change
  useEffect(() => {
    if (data.onChange) {
      data.onChange({ selectedFiles });
    }
  }, [selectedFiles, data]);
  
  const handleFileSelect = (file) => {
    if (selectedFiles.length >= 10) {
      alert('Maximum 10 files allowed');
      return;
    }
    
    if (!selectedFiles.find(f => f.id === file.id)) {
      setSelectedFiles([...selectedFiles, file]);
    }
    setShowFileSelector(false);
  };
  
  const handleRemoveFile = (fileId) => {
    setSelectedFiles(selectedFiles.filter(file => file.id !== fileId));
  };
  
  const handleAddFile = () => {
    setShowFileSelector(true);
  };

  return (
    <div className="note-node node-container">
      <Handle
        type="target"
        position={Position.Top}
        isConnectable={isConnectable}
      />
      <div className="node-header">
        <StickyNote size={16} />
        <div className="node-title">Notes</div>
      </div>
      <div className="node-content">
        <div className="notes-container">
          {selectedFiles.length > 0 ? (
            <div className="selected-files">
              {selectedFiles.map(file => (
                <div key={file.id} className="file-item">
                  <FileText size={14} />
                  <span className="file-name">{file.name}</span>
                  <button 
                    className="remove-file-btn"
                    onClick={() => handleRemoveFile(file.id)}
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <p>No files selected</p>
            </div>
          )}
          
          {selectedFiles.length < 10 && (
            <button 
              className="add-file-btn"
              onClick={handleAddFile}
            >
              <Plus size={14} />
              <span>Add File</span>
            </button>
          )}
          
          {showFileSelector && (
            <div className="file-selector">
              <div className="file-selector-header">
                <h4>Select Files</h4>
                <button 
                  className="close-selector-btn"
                  onClick={() => setShowFileSelector(false)}
                >
                  <X size={14} />
                </button>
              </div>
              <div className="file-list">
                {availableFiles.map(file => (
                  <div 
                    key={file.id} 
                    className="file-option"
                    onClick={() => handleFileSelect(file)}
                  >
                    <FileText size={14} />
                    <span>{file.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        isConnectable={isConnectable}
      />
    </div>
  );
};

export default NoteNode; 