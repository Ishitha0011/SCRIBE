import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronRight, faChevronLeft } from '@fortawesome/free-solid-svg-icons';

const RightSidebar = () => {
  const [selectedOption, setSelectedOption] = useState('AI');
  const [isOpen, setIsOpen] = useState(true);

  const handleSelectChange = (event) => {
    setSelectedOption(event.target.value);
  };

  const toggleSidebar = () => {
    setIsOpen(!isOpen);
  };

  return (
    <div className={`RightSidebar ${isOpen ? 'open' : 'closed'}`}>
      {isOpen ? (
        <>
          <div className="RightSidebarHeader">
            <h1>SCRIBE*</h1>
            <select value={selectedOption} onChange={handleSelectChange}>
              <option value="AI">AI</option>
              <option value="Notes">Notes</option>
              <option value="Labs">Labs</option>
            </select>
          </div>
          <div className="RightSidebarContent">
            <button>Summarize the Notes</button>
            <button>Generate Ideas</button>
            <button>Translate to Spanish</button>
            <button>Explain this concept</button>
          </div>
        </>
      ) : null}
      
      <button 
        className="SidebarToggle" 
        onClick={toggleSidebar}
      >
        <FontAwesomeIcon icon={isOpen ? faChevronRight : faChevronLeft} />
      </button>
    </div>
  );
};

export default RightSidebar;