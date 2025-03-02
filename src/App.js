import React from 'react';
import './App.css';
import LeftSidebar from './components/LeftSidebar';
import Editor from './components/Editor'; 
import RightSidebar from './components/RightSidebar';
import { ThemeProvider } from './ThemeContext'; // Import ThemeProvider
import { FileProvider } from './FileContext'; // Import FileProvider

function App() {
  return (
    <ThemeProvider>
      <FileProvider>
        <div className="App">
          <LeftSidebar />
          <Editor />
          <RightSidebar />
        </div>
      </FileProvider>
    </ThemeProvider>
  );
}

export default App;
