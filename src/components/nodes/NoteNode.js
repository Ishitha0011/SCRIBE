/* eslint-disable */

import React, { useState, useRef, useEffect } from 'react';
import '../../css/Nodes.css';
import { StickyNote, Maximize, Minimize } from 'lucide-react';

const NoteNode = ({ data }) => {
  const [noteContent, setNoteContent] = useState(data.content || '');
  const [isExpanded, setIsExpanded] = useState(false);
  const textareaRef = useRef(null);
  
  // Update data when content changes
  useEffect(() => {
    if (data.onChange) {
      data.onChange({ content: noteContent });
    }
  }, [noteContent, data]);
  
  // Auto-resize textarea based on content
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [noteContent, isExpanded]);
  
  const handleContentChange = (e) => {
    setNoteContent(e.target.value);
  };
  
  const toggleExpand = () => {
    setIsExpanded(!isExpanded);
  };

  return (
    <div className={`note-node node-container sticky-note ${isExpanded ? 'expanded' : ''}`}>
      <div className="node-header">
        <StickyNote size={16} />
        <div className="node-title">Sticky Note</div>
        <button 
          className="expand-btn"
          onClick={toggleExpand}
          title={isExpanded ? "Collapse" : "Expand"}
        >
          {isExpanded ? <Minimize size={14} /> : <Maximize size={14} />}
        </button>
      </div>
      <div className="node-content">
        <div className="sticky-note-container">
          <textarea
            ref={textareaRef}
            value={noteContent}
            onChange={handleContentChange}
            placeholder="Type your notes here..."
            className="sticky-note-textarea"
            rows={isExpanded ? 10 : 4}
          />
        </div>
      </div>
    </div>
  );
};

export default NoteNode;