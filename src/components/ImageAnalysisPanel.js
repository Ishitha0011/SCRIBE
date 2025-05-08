import React from 'react';
import { X } from 'lucide-react';

const ImageAnalysisPanel = ({ content, style, onClose, theme }) => {
  if (!content) return null;

  return (
    <div className={`ImageAnalysisPanel ${theme === 'dark' ? 'dark' : ''}`} style={style}>
      <button className="CloseButton" onClick={onClose} title="Close Panel">
        <X size={18} />
      </button>
      <div className="PanelContent">
        {content}
      </div>
    </div>
  );
};

export default ImageAnalysisPanel; 