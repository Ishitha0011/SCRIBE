import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSearch, faCog, faPlus } from '@fortawesome/free-solid-svg-icons';

const Sidebar = () => {
  return (
    <div className="Sidebar">
      <ul>
        <li>
          <FontAwesomeIcon icon={faSearch} />
        </li>
        <li>
          <FontAwesomeIcon icon={faCog} />
        </li>
        <li>
          <FontAwesomeIcon icon={faPlus} />
        </li>
      </ul>
    </div>
  );
};

export default Sidebar; 