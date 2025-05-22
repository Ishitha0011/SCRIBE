import React, { useState, useEffect, useRef } from 'react';
import { Handle, Position } from 'reactflow';
import '../../css/Nodes.css';
import { FileText, Upload, X, Eye, Download, RefreshCw as ProcessingIcon, CheckCircle, AlertCircle } from 'lucide-react';

const PDFNode = ({ data, isConnectable, id }) => {
  const [file, setFile] = useState(data.file || null);
  const [preview, setPreview] = useState(data.preview || null);
  const [isUploading, setIsUploading] = useState(false);
  const [extractedText, setExtractedText] = useState(data.extractedText || null);
  const [extractionError, setExtractionError] = useState(data.extractionError || null);
  const fileInputRef = useRef(null);
  
  // Add flow execution states
  const [nodeState, setNodeState] = useState('idle'); // idle, processing, complete, error
  const nodeIdRef = useRef(id);
  
  // Ensure we track the node ID
  useEffect(() => {
    nodeIdRef.current = id;
  }, [id]);
  
  // Update data when file, preview, extractedText, or error changes
  useEffect(() => {
    if (data.onChange) {
      data.onChange({ 
        file, 
        preview, 
        extractedText, 
        extractionError 
      });
    }
  }, [file, preview, extractedText, extractionError, data]);
  
  // Handle flow execution state changes
  useEffect(() => {
    let timer;
    if (data.isExecuting) {
      setNodeState('processing');
    } else if (data.executionComplete) {
      setNodeState('complete');
      timer = setTimeout(() => setNodeState('idle'), 2000);
    } else if (data.executionError) {
      setNodeState('error');
      timer = setTimeout(() => setNodeState('idle'), 3000);
    } else if (!data.isInExecutionPath) {
      setNodeState('idle');
    }
    return () => clearTimeout(timer);
  }, [data.isExecuting, data.executionComplete, data.executionError, data.isInExecutionPath]);
  
  // Process PDF file and extract text
  const processPDFFile = async (fileToProcess) => {
    if (!fileToProcess || fileToProcess.type !== 'application/pdf') {
      return { error: "No PDF file available to process" };
    }
    
    try {
      setNodeState('processing');
      
      // If we already have extracted text for this file, use it
      if (extractedText && !extractionError) {
        return { 
          success: true, 
          text: extractedText,
          filename: fileToProcess.name,
          filesize: fileToProcess.size
        };
      }
      
      // Otherwise, extract the text
      const formData = new FormData();
      formData.append('file', fileToProcess);

      const response = await fetch('http://localhost:8000/api/pdf/extract-text', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Failed to extract text. Unknown error.' }));
        throw new Error(errorData.detail || `HTTP error ${response.status}`);
      }

      const result = await response.json();
      setExtractedText(result.text);
      setExtractionError(null);
      
      return {
        success: true,
        text: result.text,
        filename: fileToProcess.name,
        filesize: fileToProcess.size,
        contentType: fileToProcess.type
      };
      
    } catch (error) {
      console.error("Error processing PDF:", error);
      setExtractionError(error.message || 'Error processing PDF file');
      setNodeState('error');
      
      return {
        error: error.message || 'Failed to process PDF file',
        filename: fileToProcess.name
      };
    }
  };
  
  const handleFileChange = async (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;

    // Reset states for new file
    setFile(null);
    setPreview(null);
    setExtractedText(null);
    setExtractionError(null);
    
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
      reader.onload = (ev) => {
        setPreview(ev.target.result);
        setFile(selectedFile);
        setIsUploading(false);
      };
      reader.readAsDataURL(selectedFile);
    } else if (fileType === 'application/pdf') {
      // For PDFs, upload to extract text
      setFile(selectedFile); // Set file object immediately for display
      
      // Call the process function directly during upload for immediate feedback
      await processPDFFile(selectedFile);
      setIsUploading(false);
      
    } else {
      // For other documents (DOC, PPTX, etc.), just set the file without a preview or extraction
      setFile(selectedFile);
      setPreview(null); // Ensure preview is null
      setExtractedText(null); // Ensure no old extracted text remains
      setExtractionError(null); // Ensure no old error remains
      setIsUploading(false);
    }
  };
  
  // Register this node for flow execution
  useEffect(() => {
    if (data.registerNodeForFlow && nodeIdRef.current) {
      const unregister = data.registerNodeForFlow(nodeIdRef.current, async (inputData) => {
        console.log(`PDF Node ${nodeIdRef.current} processing as part of flow`);
        
        // Process the current file when the flow runs
        if (file && file.type === 'application/pdf') {
          const result = await processPDFFile(file);
          return result; // This gets passed to the next node
        } else if (file) {
          // If we have a non-PDF file, return basic info
          return {
            success: true,
            filename: file.name,
            filesize: file.size,
            contentType: file.type,
            message: "Non-PDF file. No text extraction performed."
          };
        } else {
          // If no file is uploaded
          return {
            error: "No file available to process", 
            message: "Please upload a file first."
          };
        }
      });
      
      return unregister; // Clean up registration when node unmounts
    }
    // Re-register if registerNodeForFlow changes
  }, [data.registerNodeForFlow, file]);
  
  const handleUploadClick = () => {
    fileInputRef.current.click();
  };
  
  const handleRemoveFile = () => {
    setFile(null);
    setPreview(null);
    setExtractedText(null);
    setExtractionError(null);
  };
  
  const handleViewFile = () => {
    if (file) {
      // Create URL for the file and open in new tab
      const url = URL.createObjectURL(file);
      window.open(url, '_blank');
      // Clean up URL after a short delay
      setTimeout(() => URL.revokeObjectURL(url), 1000);
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

  // Status indicators based on execution state
  const renderStatusIndicator = () => {
    if (nodeState === 'processing') {
      return (
        <div className="node-status-indicator processing">
          <ProcessingIcon size={14} className="spinning" />
          <span>Processing...</span>
        </div>
      );
    } else if (nodeState === 'complete') {
      return (
        <div className="node-status-indicator complete">
          <CheckCircle size={14} />
          <span>Processed</span>
        </div>
      );
    } else if (nodeState === 'error') {
      return (
        <div className="node-status-indicator error">
          <AlertCircle size={14} />
          <span>Error</span>
        </div>
      );
    }
    return null;
  };

  return (
    <div className={`pdf-node node-container state-${nodeState} ${data.isInExecutionPath ? 'in-path' : ''}`}>
      <Handle
        type="target"
        position={Position.Top}
        id="in"
        isConnectable={isConnectable}
        className="node-handle target-handle"
      />
      <div className="node-header">
        <FileText size={16} className="node-title-icon" />
        <div className="node-title">PDF Processor</div>
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
                {/* Display extraction status for PDF */}
                {file.type === 'application/pdf' && (
                  <div className="extraction-status">
                    {isUploading && <span>Extracting text...</span>}
                    {extractionError && <span className="error-text">Error: {extractionError}</span>}
                    {extractedText && !isUploading && !extractionError && <span className="success-text">Text extracted</span>}
                    {!extractedText && !isUploading && !extractionError && <span>Ready to extract text (if re-upload)</span>}
                  </div>
                )}
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
              disabled={isUploading || nodeState === 'processing'}
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
        
        {/* Status indicator for flow execution */}
        {renderStatusIndicator()}
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        id="out"
        isConnectable={isConnectable}
        className="node-handle source-handle"
      />
    </div>
  );
};

export default PDFNode; 