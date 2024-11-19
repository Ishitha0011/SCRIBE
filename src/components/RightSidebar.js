import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronRight, faChevronLeft } from '@fortawesome/free-solid-svg-icons';

const RightSidebar = ({ selectedPage, setSelectedPage }) => {
  const [isOpen, setIsOpen] = useState(true);

  const handleSelectChange = (event) => {
    setSelectedPage(event.target.value);
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
            <select value={selectedPage} onChange={handleSelectChange}>
              <option value="AI">AI</option>
              <option value="Notes">Notes</option>
              <option value="Labs">Labs</option>
            </select>
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
