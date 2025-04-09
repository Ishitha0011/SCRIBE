import React from 'react';
import { Type, FileText, Youtube, MessageSquare, File, StickyNote, Folder, Bot, Play } from 'lucide-react';
import '../css/NodeSelector.css';
import { useTheme } from '../ThemeContext';

const NodeSelector = ({ isCanvasActive }) => {
  const { theme } = useTheme();
  
  // Handle drag start
  const onDragStart = (event, nodeType, data = {}) => {
    if (!isCanvasActive) {
      event.preventDefault();
      return;
    }
    
    const nodeData = {
      type: nodeType,
      data: data
    };
    
    event.dataTransfer.setData('application/reactflow', JSON.stringify(nodeData));
    event.dataTransfer.effectAllowed = 'move';
  };

  // Node types and their configurations
  const nodeTypes = [
    {
      type: 'startNode',
      label: 'Start',
      icon: <Play size={18} />,
      description: 'Starting point for flow execution'
    },
    { 
      type: 'textNode', 
      label: 'Text',
      icon: <Type size={18} />,
      description: 'Add a simple text block'
    },
    { 
      type: 'noteNode', 
      label: 'Note',
      icon: <StickyNote size={18} />,
      description: 'Create a sticky note'
    },
    { 
      type: 'pdfNode', 
      label: 'Document',
      icon: <FileText size={18} />,
      description: 'Add document/PDF/image'
    },
    { 
      type: 'youtubeNode', 
      label: 'Video',
      icon: <Youtube size={18} />,
      description: 'Process YouTube video or upload'
    },
    { 
      type: 'aiChatNode', 
      label: 'AI Chat',
      icon: <MessageSquare size={18} />,
      description: 'AI conversation with prompt'
    },
    { 
      type: 'aiOutputNode', 
      label: 'AI Output',
      icon: <Bot size={18} />,
      description: 'Display AI response'
    },
    { 
      type: 'fileNode', 
      label: 'File',
      icon: <File size={18} />,
      description: 'Link to a file'
    }
  ];

  // Node categories
  const categories = [
    {
      title: 'Flow',
      nodes: ['startNode']
    },
    {
      title: 'Basic',
      nodes: ['textNode', 'noteNode']
    },
    {
      title: 'Media',
      nodes: ['pdfNode', 'youtubeNode', 'fileNode']
    },
    {
      title: 'AI',
      nodes: ['aiChatNode', 'aiOutputNode']
    }
  ];

  return (
    <div className={`NodeSelector ${theme === 'dark' ? 'dark' : ''}`}>
      <div className="NodeSelector-header">
        <h3>Node Library</h3>
        {!isCanvasActive && (
          <div className="NodeSelector-warning">
            <p>Open a canvas to use nodes</p>
          </div>
        )}
      </div>

      {categories.map((category) => (
        <div key={category.title} className="NodeCategory">
          <div className="CategoryTitle">
            <Folder size={16} />
            <span>{category.title}</span>
          </div>
          <div className="CategoryNodes">
            {nodeTypes
              .filter(node => category.nodes.includes(node.type))
              .map(node => (
                <div
                  key={node.type}
                  className={`NodeItem ${!isCanvasActive ? 'disabled' : ''}`}
                  draggable={isCanvasActive}
                  onDragStart={(e) => onDragStart(e, node.type)}
                >
                  <div className="NodeItem-icon">
                    {node.icon}
                  </div>
                  <div className="NodeItem-content">
                    <div className="NodeItem-title">{node.label}</div>
                    <div className="NodeItem-description">{node.description}</div>
                  </div>
                </div>
              ))}
          </div>
        </div>
      ))}
    </div>
  );
};

export default NodeSelector; 