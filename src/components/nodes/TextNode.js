import React, { useState, useEffect } from 'react';
import { Handle, Position } from 'reactflow';
import '../../css/Nodes.css';
import { Type, Copy, Trash2 } from 'lucide-react';

const TextNode = ({ data, isConnectable }) => {
  const [text, setText] = useState(data.text || '');
  const [isEditing, setIsEditing] = useState(false);
  const [copied, setCopied] = useState(false);

  // Update data when text changes
  useEffect(() => {
    if (data.onChange) {
      data.onChange({ text });
    }
  }, [text, data]);

  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClear = () => {
    setText('');
  };

  return (
    <div className="text-node node-container">
      <Handle
        type="target"
        position={Position.Top}
        isConnectable={isConnectable}
      />
      <div className="node-header">
        <Type size={16} />
        <div className="node-title">Text</div>
      </div>
      <div className="node-content">
        {isEditing ? (
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            autoFocus
            onBlur={() => setIsEditing(false)}
            className="node-textarea"
            placeholder="Paste text here for context..."
          />
        ) : (
          <div
            className="node-text"
            onClick={() => setIsEditing(true)}
          >
            {text || <span className="placeholder-text">Click to add text</span>}
          </div>
        )}
        <div className="node-actions">
          <button 
            className="node-action-btn" 
            onClick={handleCopy}
            title={copied ? "Copied!" : "Copy text"}
          >
            <Copy size={14} />
          </button>
          <button 
            className="node-action-btn" 
            onClick={handleClear}
            title="Clear text"
          >
            <Trash2 size={14} />
          </button>
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

export default TextNode; 