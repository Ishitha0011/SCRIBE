/* eslint-disable */

import React from 'react';
import { Handle, Position } from 'reactflow';
import '../../css/Nodes.css';
import { FileText, File } from 'lucide-react';

const FileNode = ({ data, isConnectable }) => {
  // Helper to determine icon based on file extension
  const getFileIcon = () => {
    const ext = data.filename ? data.filename.split('.').pop()?.toLowerCase() : '';
    if (['txt', 'md', 'doc', 'docx', 'rtf'].includes(ext)) {
      return <FileText size={32} />;
    }
    return <File size={32} />;
  };

  return (
    <div className="file-node node-container">
      <Handle
        type="target"
        position={Position.Top}
        isConnectable={isConnectable}
      />
      <div className="node-header">
        <File size={16} />
        <div className="node-title">File</div>
      </div>
      <div className="node-content">
        <div className="file-preview">
          <div className="file-icon">
            {getFileIcon()}
          </div>
          <div className="file-name">{data.filename || 'document.txt'}</div>
        </div>
        <div className="file-path">{data.path || '/documents/'}</div>
        <button className="node-action-btn">Open File</button>
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        isConnectable={isConnectable}
      />
    </div>
  );
};

export default FileNode; 