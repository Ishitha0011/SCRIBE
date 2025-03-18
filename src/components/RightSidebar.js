import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, MessageSquare, BookOpen, FlaskConical } from 'lucide-react';
import AskAI from './AskAI';
import Labs from './Labs';
import '../css/RightSidebar.css';
import { useTheme } from '../ThemeContext';

const RightSidebar = () => {
  const [selectedOption, setSelectedOption] = useState('AI');
  const [isOpen, setIsOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [messages, setMessages] = useState([]);
  const [prevCollapsedState, setPrevCollapsedState] = useState(false);

  const { theme } = useTheme();
  const dropdownRef = useRef(null);
  const sidebarRef = useRef(null);
  
  // Create refs for components to persist them
  const labsRef = useRef(<Labs />);

  const toggleDropdown = () => setIsOpen((prev) => !prev);
  
  const handleOptionSelect = (option) => {
    setSelectedOption(option);
    setIsOpen(false);
  };
  
  const toggleCollapse = () => {
    // Store the previous state for restoration
    setPrevCollapsedState(isCollapsed);
    setIsCollapsed((prev) => !prev);
    // If opening from collapsed state, ensure dropdown is closed
    if (isCollapsed) {
      setIsOpen(false);
    }
  };

  // Handle clicks outside the dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Get icon based on selected option
  const getOptionIcon = (option) => {
    switch (option) {
      case 'AI':
        return <MessageSquare size={16} />;
      case 'Notes':
        return <BookOpen size={16} />;
      case 'Labs':
        return <FlaskConical size={16} />;
      default:
        return <MessageSquare size={16} />;
    }
  };

  // Render the selected component
  const renderSelectedComponent = () => {
    if (isCollapsed) return null;
    
    switch (selectedOption) {
      case 'AI':
        return <AskAI messages={messages} setMessages={setMessages} />;
      case 'Notes':
        return <div className="ComingSoonPlaceholder">Notes feature coming soon</div>;
      case 'Labs':
        return labsRef.current;
      default:
        return null;
    }
  };

  return (
    <div 
      className={`RightSidebar ${theme} ${isCollapsed ? 'collapsed' : ''}`}
      ref={sidebarRef}
    >
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
                  <MessageSquare size={16} />
                  <span>AI</span>
                </div>
              </div>
              <div className="Option" onClick={() => handleOptionSelect('Notes')}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <BookOpen size={16} />
                  <span>Notes</span>
                </div>
              </div>
              <div className="Option" onClick={() => handleOptionSelect('Labs')}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <FlaskConical size={16} />
                  <span>Labs</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="DynamicContent">
        {renderSelectedComponent()}
        
        {/* Collapsible icon */}
        <div className="CollapseIcon" onClick={toggleCollapse} title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}>
          {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </div>
      </div>
    </div>
  );
};

export default RightSidebar;
