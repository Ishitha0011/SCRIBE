import React, { useState, useEffect } from 'react';
import { useTheme } from '../ThemeContext';
import NodeSelector from './NodeSelector';
import NotesManager from './NotesManager';
import '../css/Notes.css';

const Notes = ({ onCreateCanvas, onOpenCanvas, isCanvasActive }) => {
  const { theme } = useTheme();
  const [activeTab, setActiveTab] = useState('canvases'); // 'canvases' or 'nodes'

  // Toggle between canvases list and node library
  const handleTabChange = (tab) => {
    setActiveTab(tab);
  };

  // If canvas is active, automatically show nodes tab
  useEffect(() => {
    if (isCanvasActive) {
      setActiveTab('nodes');
    }
  }, [isCanvasActive]);

  // Handle creating a canvas
  const handleCreateCanvasLocal = (canvasId) => {
    console.log('Notes: Creating canvas with ID:', canvasId);
    onCreateCanvas(canvasId);
  };

  // Handle opening a canvas
  const handleOpenCanvasLocal = (canvasId, canvasName) => {
    console.log('Notes: Opening canvas with ID:', canvasId);
    onOpenCanvas(canvasId, canvasName);
  };

  return (
    <div className={`Notes ${theme === 'dark' ? 'dark' : ''}`}>
      <div className="Notes-tabs">
        <button 
          className={`Notes-tab ${activeTab === 'canvases' ? 'active' : ''}`}
          onClick={() => handleTabChange('canvases')}
        >
          Canvases
        </button>
        <button 
          className={`Notes-tab ${activeTab === 'nodes' ? 'active' : ''}`}
          onClick={() => handleTabChange('nodes')}
        >
          Nodes
        </button>
      </div>

      <div className="Notes-content">
        {activeTab === 'canvases' ? (
          <NotesManager 
            onCreateCanvas={handleCreateCanvasLocal} 
            onOpenCanvas={handleOpenCanvasLocal} 
          />
        ) : (
          <NodeSelector 
            isCanvasActive={isCanvasActive} 
          />
        )}
      </div>
    </div>
  );
};

export default Notes; 