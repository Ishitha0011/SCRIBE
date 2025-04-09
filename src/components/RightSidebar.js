import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, MessageSquare, BookOpen, FlaskConical } from 'lucide-react';
import AskAI from './AskAI';
import Notes from './Notes';  // Updated import to use new Notes component
import Labs from './Labs';
import '../css/RightSidebar.css';
import { useTheme } from '../ThemeContext';
import { useFileContext } from '../FileContext'; // Import useFileContext to interact with files

// --- Configuration for Resizing ---
const MIN_WIDTH = 200; // Minimum sidebar width in pixels
const MAX_WIDTH = 600; // Maximum sidebar width in pixels
const DEFAULT_WIDTH = 320; // Default sidebar width in pixels
// --- End Configuration ---

const RightSidebar = () => {
  const [selectedOption, setSelectedOption] = useState('AI');
  const [isOpen, setIsOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [messages, setMessages] = useState([]); // Assuming AskAI uses this
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_WIDTH);
  const [isCanvasActive, setIsCanvasActive] = useState(false);

  const { theme } = useTheme();
  const { openFile, openFiles, activeFileId, updateFileContent } = useFileContext();
  const dropdownRef = useRef(null);
  const sidebarRef = useRef(null);
  const resizeHandleRef = useRef(null);
  const isResizingRef = useRef(false);

  // Persist Labs component instance
  const labsRef = useRef(<Labs />);

  const toggleDropdown = () => setIsOpen((prev) => !prev);

  const handleOptionSelect = (option) => {
    setSelectedOption(option);
    setIsOpen(false);
  };

  // Check if active file is a canvas
  useEffect(() => {
    if (activeFileId) {
      const activeFile = openFiles.find(file => file.id === activeFileId);
      setIsCanvasActive(activeFile && activeFile.type === 'canvas');
    } else {
      setIsCanvasActive(false);
    }
  }, [activeFileId, openFiles]);

  // Handle creating a new canvas
  const handleCreateCanvas = (canvasId) => {
    console.log('RightSidebar: Creating canvas with ID:', canvasId);

    // Create the canvas object with proper type
    const newCanvas = {
      id: canvasId,
      name: 'Untitled Canvas',
      type: 'canvas', // Ensure type is set to 'canvas'
      isNew: true,
    };

    // Initialize empty canvas data
    const initialCanvasData = JSON.stringify({ nodes: [], edges: [] });
    
    // Update file content first
    updateFileContent(canvasId, initialCanvasData);
    
    // Then open the canvas in the editor
    openFile(newCanvas);
  };

  // Handle opening an existing canvas
  const handleOpenCanvas = (canvasId, canvasName) => {
    console.log('RightSidebar: Opening canvas with ID:', canvasId);

    // Create the canvas object with proper type
    const canvas = {
      id: canvasId,
      name: canvasName || 'Canvas',
      type: 'canvas', // Ensure type is set to 'canvas'
    };

    // Open the canvas in the editor
    openFile(canvas);
  };

  const toggleCollapse = () => {
    const newState = !isCollapsed;
    setIsCollapsed(newState);
    if (newState === false) {
      setIsOpen(false);
      // Optional: Restore default width on expand, or keep last resized width.
      // If you want to always expand to the last resized width, comment the next line out.
      // If you want to always expand to DEFAULT_WIDTH, keep the next line.
      // setSidebarWidth(DEFAULT_WIDTH);
    }
    // Width when collapsed is handled by CSS class '.collapsed'
  };

  // --- Resizing Logic ---
  const handleMouseDownOnResizeHandle = (e) => {
    // Only allow left mouse button click
    if (e.button !== 0) return;

    e.preventDefault(); // Prevent text selection/drag behavior
    if (isCollapsed) return; // Don't resize if collapsed

    isResizingRef.current = true;
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'col-resize'; // Indicate resizing globally
    document.body.style.userSelect = 'none'; // Prevent text selection during drag
  };

  // Use useCallback for performance and stable referencing in listeners
  const handleMouseMove = useCallback((e) => {
    if (!isResizingRef.current || !sidebarRef.current) return;

    // Calculate new width based on mouse X position relative to the right edge of the viewport
    const newWidth = document.documentElement.clientWidth - e.clientX;

    // Clamp the width within defined MIN and MAX bounds
    const clampedWidth = Math.max(MIN_WIDTH, Math.min(newWidth, MAX_WIDTH));

    // Update the state (can cause re-renders, might feel laggy on complex components)
    setSidebarWidth(clampedWidth);

    // --- Alternative: Direct DOM manipulation for smoother feedback ---
    // sidebarRef.current.style.width = `${clampedWidth}px`;
    // Note: If using direct manipulation, you might want to update the state
    // *only* in handleMouseUp to persist the final width.
    // --- End Alternative ---

  }, []); // No dependencies needed as it uses refs and global properties

  // Use useCallback for performance and stable referencing
  const handleMouseUp = useCallback(() => {
    if (isResizingRef.current) {
      isResizingRef.current = false;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = ''; // Reset global cursor
      document.body.style.userSelect = ''; // Re-enable text selection

      // If using direct DOM manipulation in handleMouseMove, uncomment the next line
      // to update React state with the final width after dragging stops.
      // if (sidebarRef.current) setSidebarWidth(parseInt(sidebarRef.current.style.width, 10));
    }
  }, [handleMouseMove]); // Dependency on handleMouseMove

  // Cleanup listeners on component unmount or if resizing is interrupted
  useEffect(() => {
    return () => {
      if (isResizingRef.current) {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    };
  }, [handleMouseMove, handleMouseUp]); // Add dependencies

  // Handle clicks outside the dropdown to close it
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Helper to get the correct icon for the selected option
  const getOptionIcon = (option) => {
    switch (option) {
      case 'AI': return <MessageSquare size={16} />;
      case 'Notes': return <BookOpen size={16} />;
      case 'Labs': return <FlaskConical size={16} />;
      default: return <MessageSquare size={16} />;
    }
  };

  // Render the main content based on the selected option
  const renderSelectedComponent = () => {
    // Instead of returning null when collapsed, we'll use CSS to hide components
    return (
      <>
        <div style={{ display: selectedOption === 'AI' && !isCollapsed ? 'block' : 'none' }}>
          <AskAI messages={messages} setMessages={setMessages} />
        </div>
        <div style={{ display: selectedOption === 'Notes' && !isCollapsed ? 'block' : 'none' }}>
          <Notes 
            onCreateCanvas={handleCreateCanvas} 
            onOpenCanvas={handleOpenCanvas}
            isCanvasActive={isCanvasActive}
          />
        </div>
        <div style={{ display: selectedOption === 'Labs' && !isCollapsed ? 'block' : 'none' }}>
          {labsRef.current}
        </div>
      </>
    )
  };

  return (
    <div
      className={`RightSidebar ${theme} ${isCollapsed ? 'collapsed' : ''}`}
      ref={sidebarRef}
      // Apply the dynamic width via inline style ONLY when not collapsed
      // The 'collapsed' class CSS will override this when active
      style={!isCollapsed ? { width: `${sidebarWidth}px` } : {}}
    >
      {/* Resize Handle - Only rendered when not collapsed */}
      {!isCollapsed && (
        <div
          ref={resizeHandleRef}
          className="ResizeHandle"
          onMouseDown={handleMouseDownOnResizeHandle}
          title="Drag to resize sidebar" // Tooltip for accessibility
        />
      )}

      {/* Top section with Logo and Dropdown */}
      <div className="TopSection">
        <div className="Logo">{!isCollapsed && 'Scribe'}</div>
        <div className="DropdownContainer" ref={dropdownRef}>
          {!isCollapsed && (
            <div className="SelectDropdown" onClick={toggleDropdown}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                {getOptionIcon(selectedOption)}
                <span>{selectedOption}</span>
              </div>
              <ChevronDown size={16} className={`DropdownIcon ${isOpen ? 'open' : ''}`} />
            </div>
          )}
          {isOpen && !isCollapsed && (
            <div className="DropdownList">
              <div className="Option" onClick={() => handleOptionSelect('AI')}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <MessageSquare size={16} /> <span>AI</span>
                </div>
              </div>
              <div className="Option" onClick={() => handleOptionSelect('Notes')}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <BookOpen size={16} /> <span>Notes</span>
                </div>
              </div>
              <div className="Option" onClick={() => handleOptionSelect('Labs')}>
                 <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <FlaskConical size={16} /> <span>Labs</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main dynamic content area */}
      <div className="DynamicContent">
        {renderSelectedComponent()}

        {/* Collapse/Expand Button Wrapper */}
        {/* Positioned absolutely within DynamicContent */}
        <div className="CollapseIconWrapper">
           <div
             className="CollapseIcon"
             onClick={toggleCollapse}
             title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
           >
            {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </div>
        </div>
      </div>
    </div>
  );
};

export default RightSidebar;