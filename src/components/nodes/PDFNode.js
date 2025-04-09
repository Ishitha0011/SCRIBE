import React, { useState, useEffect } from 'react';
import { Handle, Position } from 'reactflow';
import '../../css/Nodes.css';
import { FileText, Upload, X, Eye, Download } from 'lucide-react';

const PDFNode = ({ data, isConnectable }) => {
  const [file, setFile] = useState(data.file || null);
  const [preview, setPreview] = useState(data.preview || null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = React.useRef(null);
  
  // Update data when file changes
  useEffect(() => {
    if (data.onChange) {
      data.onChange({ file, preview });
    }
  }, [file, preview, data]);
  
  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;
    
    // Check file type
    const fileType = selectedFile.type;
    const validTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'image/jpeg',
      'image/png',
      'image/gif'
    ];
    
    if (!validTypes.includes(fileType)) {
      alert('Please select a valid file (PDF, DOC, DOCX, PPTX, or image)');
      return;
    }
    
    setIsUploading(true);
    
    // Create a preview for the file
    if (fileType.startsWith('image/')) {
      // For images, create a direct preview
      const reader = new FileReader();
      reader.onload = (e) => {
        setPreview(e.target.result);
        setFile(selectedFile);
        setIsUploading(false);
      };
      reader.readAsDataURL(selectedFile);
    } else {
      // For documents, we'd normally use a library like pdf.js
      // For now, we'll just set the file without a preview
      setFile(selectedFile);
      setPreview(null);
      setIsUploading(false);
    }
  };
  
  const handleUploadClick = () => {
    fileInputRef.current.click();
  };
  
  const handleRemoveFile = () => {
    setFile(null);
    setPreview(null);
  };
  
  const handleViewFile = () => {
    if (file) {
      // In a real implementation, this would open the file in a viewer
      // For now, we'll just show an alert
      alert(`Viewing file: ${file.name}`);
    }
  };
  
  const handleDownloadFile = () => {
    if (file) {
      // Create a download link
      const url = URL.createObjectURL(file);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  return (
    <div className="pdf-node node-container">
      <Handle
        type="target"
        position={Position.Top}
        isConnectable={isConnectable}
      />
      <div className="node-header">
        <FileText size={16} />
        <div className="node-title">Document</div>
      </div>
      <div className="node-content">
        <input 
          type="file" 
          ref={fileInputRef}
          onChange={handleFileChange}
          accept=".pdf,.doc,.docx,.ppt,.pptx,.jpg,.jpeg,.png,.gif"
          style={{ display: 'none' }}
        />
        
        {file ? (
          <div className="file-preview-container">
            {preview ? (
              <div className="image-preview">
                <img src={preview} alt="Preview" />
              </div>
            ) : (
              <div className="document-preview">
                <FileText size={32} />
                <div className="file-name">{file.name}</div>
                <div className="file-size">
                  {(file.size / 1024).toFixed(1)} KB
                </div>
              </div>
            )}
            
            <div className="file-actions">
              <button 
                className="file-action-btn"
                onClick={handleViewFile}
                title="View file"
              >
                <Eye size={14} />
              </button>
              <button 
                className="file-action-btn"
                onClick={handleDownloadFile}
                title="Download file"
              >
                <Download size={14} />
              </button>
              <button 
                className="file-action-btn"
                onClick={handleRemoveFile}
                title="Remove file"
              >
                <X size={14} />
              </button>
            </div>
          </div>
        ) : (
          <div className="upload-container">
            <button 
              className="upload-btn"
              onClick={handleUploadClick}
              disabled={isUploading}
            >
              {isUploading ? (
                <span>Uploading...</span>
              ) : (
                <>
                  <Upload size={16} />
                  <span>Upload PDF/DOC/Image</span>
                </>
              )}
            </button>
            <div className="upload-hint">
              Supports PDF, DOC, DOCX, PPTX, and images
            </div>
          </div>
        )}
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        isConnectable={isConnectable}
      />
    </div>
  );
};

export default PDFNode; 