import React, { useState, useEffect } from 'react';
import { Plus, FileDigit, Clock, Search, FolderOpen } from 'lucide-react';
import '../css/NotesManager.css';
import { useTheme } from '../ThemeContext';

const NotesManager = ({ onCreateCanvas, onOpenCanvas }) => {
  const { theme } = useTheme();
  const [canvasList, setCanvasList] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  // Load canvas list on mount
  useEffect(() => {
    // In a real app, this would load from API/localStorage
    // For now, use dummy data
    const dummyCanvases = [
      { 
        id: 'canvas1', 
        name: 'Research Notes',
        lastModified: new Date('2023-06-10').toISOString(),
        nodeCount: 12,
        thumbnail: null
      },
      { 
        id: 'canvas2', 
        name: 'Project Ideas',
        lastModified: new Date('2023-06-15').toISOString(),
        nodeCount: 8,
        thumbnail: null
      },
      { 
        id: 'canvas3', 
        name: 'Meeting Notes',
        lastModified: new Date('2023-06-18').toISOString(),
        nodeCount: 5,
        thumbnail: null
      },
    ];
    
    setCanvasList(dummyCanvases);
    setLoading(false);
  }, []);

  // Filter canvas list based on search term
  const filteredCanvases = canvasList.filter(canvas => 
    canvas.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Format date for display
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    }).format(date);
  };

  // Handle canvas creation
  const handleCreateCanvas = () => {
    const canvasId = `canvas-${Date.now()}`;
    console.log('NotesManager: Creating canvas with ID:', canvasId);
    
    const newCanvas = {
      id: canvasId,
      name: 'Untitled Canvas',
      lastModified: new Date().toISOString(),
      nodeCount: 0,
      thumbnail: null
    };
    
    // In a real app, save this to storage
    setCanvasList([newCanvas, ...canvasList]);
    
    // Notify parent component
    onCreateCanvas(canvasId);
  };

  return (
    <div className={`NotesManager ${theme === 'dark' ? 'dark' : ''}`}>
      <div className="NotesManager-header">
        <h2>Canvas Library</h2>
        <button 
          className="create-canvas-btn" 
          onClick={handleCreateCanvas}
          title="Create a new canvas"
        >
          <Plus size={16} />
          <span>New Canvas</span>
        </button>
      </div>

      <div className="NotesManager-search">
        <Search size={18} className="search-icon" />
        <input
          type="text"
          placeholder="Search canvases..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="NotesManager-list">
        {loading ? (
          <div className="loading-state">Loading canvases...</div>
        ) : filteredCanvases.length > 0 ? (
          filteredCanvases.map(canvas => (
            <div 
              key={canvas.id} 
              className="canvas-item"
              onClick={() => onOpenCanvas(canvas.id, canvas.name)}
            >
              <div className="canvas-icon">
                <FileDigit size={24} />
              </div>
              <div className="canvas-details">
                <div className="canvas-name">{canvas.name}</div>
                <div className="canvas-meta">
                  <span className="canvas-date">
                    <Clock size={14} />
                    {formatDate(canvas.lastModified)}
                  </span>
                  <span className="canvas-nodes">
                    {canvas.nodeCount} {canvas.nodeCount === 1 ? 'node' : 'nodes'}
                  </span>
                </div>
              </div>
            </div>
          ))
        ) : searchTerm ? (
          <div className="empty-state">
            <Search size={32} />
            <p>No results found for "{searchTerm}"</p>
          </div>
        ) : (
          <div className="empty-state">
            <FolderOpen size={32} />
            <p>No canvases yet</p>
            <button onClick={handleCreateCanvas} className="empty-create-btn">
              Create your first canvas
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default NotesManager; 