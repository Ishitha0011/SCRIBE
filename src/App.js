import React from 'react';
import './App.css';
import LeftSidebar from './components/LeftSidebar';
import Editor from './components/Editor'; 
import RightSidebar from './components/RightSidebar';

function App() {
  return (
    <div className="App">
      <LeftSidebar />
      <Editor />
      <RightSidebar />
    </div>
  );
}

export default App;
