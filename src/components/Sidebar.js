import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSearch, faCog, faPlus } from '@fortawesome/free-solid-svg-icons';

const Sidebar = () => {
  return (
    <div className="Sidebar">
      <div className="SidebarIcons">
        <FontAwesomeIcon icon={faSearch} />
        <FontAwesomeIcon icon={faCog} />
        <FontAwesomeIcon icon={faPlus} />
      </div>
      <div className="SidebarContent">
        <h2>Notes</h2>
        <ul>
          <li>Quick Notes</li>
          <li>Project Ideas</li>
          <li>Thoughts</li>
        </ul>
      </div>
    </div>
  );
};

export default Sidebar;
