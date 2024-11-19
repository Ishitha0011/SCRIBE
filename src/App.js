import React, { useState } from 'react';
import './App.css';
import Sidebar from './components/Sidebar';
import RightSidebar from './components/RightSidebar';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMoon } from '@fortawesome/free-solid-svg-icons';
import { ThemeProvider, useTheme } from './ThemeContext';

// Import your pages
import NotesPage from './pages/NotesPage';
import AiPage from './pages/AiPage';
import LabsPage from './pages/LabsPage';

function App() {
  const { theme, toggleTheme } = useTheme();

  // State to track the selected page
  const [selectedPage, setSelectedPage] = useState('AI');

  // Function to render the selected page
  const renderSelectedPage = () => {
    switch (selectedPage) {
      case 'Notes':
        return <NotesPage />;
      case 'Labs':
        return <LabsPage />;
      default:
        return <AiPage />;
    }
  };

  return (
    <div className={`App ${theme}`}>
      <Sidebar />
      <div className="Editor">
        <textarea placeholder="Type your markdown here..." />
      </div>
      {/* Pass the setSelectedPage function to RightSidebar */}
      <RightSidebar selectedPage={selectedPage} setSelectedPage={setSelectedPage} />
      <div className="Content">
        {renderSelectedPage()}
      </div>
      <button
        className={`ThemeSwitcher ${theme === 'dark' ? 'dark' : ''}`}
        onClick={toggleTheme}
      >
        <FontAwesomeIcon icon={faMoon} />
      </button>
    </div>
  );
}

export default App;
