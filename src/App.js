import React from 'react';
import './App.css';
import Sidebar from './components/Sidebar';
import RightSidebar from './components/RightSidebar';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMoon } from '@fortawesome/free-solid-svg-icons';
import { ThemeProvider, useTheme } from './ThemeContext';

function App() {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className={`App ${theme}`}>
      <Sidebar />
      <div className="Editor">
        <textarea placeholder="Type your markdown here..." />
      </div>
      <RightSidebar />
      <button className={`ThemeSwitcher ${theme === 'dark' ? 'dark' : ''}`} onClick={toggleTheme}>
        <FontAwesomeIcon icon={faMoon} />
      </button>
    </div>
  );
}

export default App;