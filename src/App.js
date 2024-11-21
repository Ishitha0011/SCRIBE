import React from 'react';
import './App.css';
import LeftSidebar from './components/LeftSidebar';
import Editor from './components/Editor'; 
import RightSidebar from './components/RightSidebar';
import { ThemeProvider } from './ThemeContext'; // Import ThemeProvider

function App() {
  return (
    <ThemeProvider>
      <div className="App">
        <LeftSidebar />
        <Editor />
        <RightSidebar />
      </div>
    </ThemeProvider>
  );
}

export default App;
