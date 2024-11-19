import React, { useState } from 'react';
import './App.css';
import Sidebar from './components/Sidebar';
import RightSidebar from './components/RightSidebar';

function App() {
  const [markdown, setMarkdown] = useState('');

  return (
    <div className="App">
      {/* Left Sidebar */}
      <Sidebar />

      {/* Main Editor */}
      <div className="Editor">
        <textarea
          value={markdown}
          onChange={(e) => setMarkdown(e.target.value)}
          placeholder="Type your markdown here..."
        />
      </div>

      {/* Right Sidebar */}
      <RightSidebar />
    </div>
  );
}

export default App;
