import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown } from 'lucide-react'; // Using Lucide icon for dropdown indicator
import '../css/RightSidebar.css';

const RightSidebar = () => {
  const [selectedOption, setSelectedOption] = useState('AI');
  const [isOpen, setIsOpen] = useState(false);

  const dropdownRef = useRef(null); // Ref to the dropdown container

  // Toggle dropdown open/close
  const toggleDropdown = () => setIsOpen((prev) => !prev);

  // Handle selecting an option
  const handleOptionSelect = (option) => {
    setSelectedOption(option);
    setIsOpen(false); // Close dropdown after selecting an option
  };

  // Close dropdown if clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside); // Attach event listener
    return () => {
      document.removeEventListener('mousedown', handleClickOutside); // Clean up listener
    };
  }, []);

  return (
    <div className="RightSidebar">
      <div className="TopSection">
        <div className="Logo">Scribe*</div>
        <div className="DropdownContainer" ref={dropdownRef}>
          <div className="SelectDropdown" onClick={toggleDropdown}>
            <span>{selectedOption}</span>
            <ChevronDown size={18} className={`DropdownIcon ${isOpen ? 'open' : ''}`} />
          </div>
          {isOpen && (
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
    </div>
  );
};

export default RightSidebar;
