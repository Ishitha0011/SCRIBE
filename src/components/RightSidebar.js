import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'; // Icons
import '../css/RightSidebar.css';

const RightSidebar = () => {
  const [selectedOption, setSelectedOption] = useState('AI');
  const [isOpen, setIsOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false); // Manage collapsed state

  const dropdownRef = useRef(null);

  // Toggle dropdown open/close
  const toggleDropdown = () => setIsOpen((prev) => !prev);

  // Handle selecting an option
  const handleOptionSelect = (option) => {
    setSelectedOption(option);
    setIsOpen(false);
  };

  // Close dropdown if clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Toggle sidebar collapse
  const toggleCollapse = () => setIsCollapsed((prev) => !prev);

  return (
    <div className={`RightSidebar ${isCollapsed ? 'collapsed' : ''}`}>
      <div className="TopSection">
        <div className="Logo">{!isCollapsed && 'Scribe*'}</div>
        <div className="DropdownContainer" ref={dropdownRef}>
          {!isCollapsed && (
            <div className="SelectDropdown" onClick={toggleDropdown}>
              <span>{selectedOption}</span>
              <ChevronDown size={18} className={`DropdownIcon ${isOpen ? 'open' : ''}`} />
            </div>
          )}
          {isOpen && !isCollapsed && (
            <div className="DropdownList">
              <div className="Option" onClick={() => handleOptionSelect('AI')}>
                AI
              </div>
              <div className="Option" onClick={() => handleOptionSelect('Notes')}>
                Notes
              </div>
              <div className="Option" onClick={() => handleOptionSelect('Labs')}>
                Labs
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Dynamic Content Based on Selected Option */}
      <div className="DynamicContent">
        {selectedOption === 'AI' && !isCollapsed && (
          <div className="AskAIContainer">
            <input
              type="text"
              placeholder="Ask Scribe..."
              className="AskAIInput"
            />
          </div> 
        )}
        {/* Add other options' content as needed */}
      </div>

      {/* Collapsible icon at the bottom */}
      <div className="CollapseIcon" onClick={toggleCollapse}>
        {isCollapsed ? <ChevronLeft size={24} /> : <ChevronRight size={24} />}
      </div>
    </div>
  );
};

export default RightSidebar;
