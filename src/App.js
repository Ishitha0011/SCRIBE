import React, { useState } from 'react';
import './App.css';
import Sidebar from './components/Sidebar';
import RightSidebar from './components/RightSidebar';

function App() {
  const [theme, setTheme] = useState('light'); // Default theme is light

  const toggleTheme = () => {
    setTheme((prevTheme) => (prevTheme === 'light' ? 'dark' : 'light'));
  };

  return (
    <div className={`App ${theme}`}>
      <Sidebar />
      <div className="Editor">
        <textarea placeholder="Type your markdown here..." />
      </div>
      <RightSidebar />
      <button className="ThemeSwitcher" onClick={toggleTheme}>
        Switch to {theme === 'light' ? 'Dark' : 'Light'} Theme
      </button>
    </div>
  );
}

export default App;
