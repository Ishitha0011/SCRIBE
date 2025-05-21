import React from 'react';
import LeftSidebar from './components/LeftSidebar';
import RightSidebar from './components/RightSidebar';
import Editor from './components/Editor';
import { FileProvider } from './FileContext';
import { ThemeProvider } from './ThemeContext';
import './App.css';

function App() {
  return (
    <ThemeProvider>
      <FileProvider>
        <div className="AppWrapper">
          <LeftSidebar />
          <main className="MainContent">
            <Editor />
          </main>
          <RightSidebar />
        </div>
      </FileProvider>
    </ThemeProvider>
  );
}

export default App;
