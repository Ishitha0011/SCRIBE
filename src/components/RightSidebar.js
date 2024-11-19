import React, { useState } from 'react';

const RightSidebar = () => {
  const [selectedOption, setSelectedOption] = useState('AI');

  const handleSelectChange = (event) => {
    setSelectedOption(event.target.value);
  };

  return (
    <div className="RightSidebar">
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
    </div>
  );
};

export default RightSidebar;
