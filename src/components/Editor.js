import React, { useState } from 'react';
import { Plus, X, Moon, Sun } from 'lucide-react'; // Importing original icons (Moon, Sun)
import { marked } from 'marked'; // Corrected import for marked
import '../css/Editor.css';

const Editor = () => {
  const [tabs, setTabs] = useState([
    { id: 1, name: 'Untitled', content: '', active: true },
  ]);
  const [activeTab, setActiveTab] = useState(1);
  const [charCount, setCharCount] = useState(0);
  const [viewMarkdown, setViewMarkdown] = useState(false); // State for markdown view toggle
  const [darkMode, setDarkMode] = useState(false); // State for dark mode toggle

  // Create a new untitled file
  const handleNewFile = () => {
    const newTab = {
      id: Date.now(),
      name: 'Untitled',
      content: '',
      active: true,
    };
    setTabs([...tabs, newTab]);
    setActiveTab(newTab.id);
  };

  // Switch to a tab
  const handleTabClick = (id) => {
    setActiveTab(id);
  };

  // Handle content change
  const handleContentChange = (e) => {
    const updatedTabs = tabs.map((tab) =>
      tab.id === activeTab ? { ...tab, content: e.target.value } : tab
    );
    setTabs(updatedTabs);
    setCharCount(e.target.value.length); // Update character count
  };

  // Close a tab
  const handleTabClose = (id) => {
    const remainingTabs = tabs.filter((tab) => tab.id !== id);
    setTabs(remainingTabs);
    if (remainingTabs.length > 0) {
      setActiveTab(remainingTabs[remainingTabs.length - 1].id);
    }
  };

  // Get the active tab's content
  const activeTabContent = tabs.find((tab) => tab.id === activeTab)?.content || '';

  // Toggle dark mode
  const toggleDarkMode = () => setDarkMode((prevMode) => !prevMode);

  // Toggle view markdown
  const toggleViewMarkdown = () => setViewMarkdown((prevView) => !prevView);

  // Render Markdown using the marked library
  const renderMarkdown = marked(activeTabContent, {
    breaks: true,  // Allows line breaks for markdown
  });

  return (
    <div className={`Editor ${darkMode ? 'dark' : ''}`}>
      {/* Tabs */}
      <div className="Tabs">
        <div className="TabsLeft">
          {tabs.map((tab) => (
            <div
              key={tab.id}
              className={`Tab ${tab.id === activeTab ? 'active' : ''}`}
              onClick={() => handleTabClick(tab.id)}
            >
              {tab.name}
              <button
                className="CloseTab"
                onClick={(e) => {
                  e.stopPropagation();
                  handleTabClose(tab.id);
                }}
              >
                <X size={12} />
              </button>
            </div>
          ))}
          <button className="AddTab" onClick={handleNewFile}>
            <Plus size={18} />
          </button>
        </div>
        <div className="TabsRight">
          {/* Swap positions of buttons */}
          <button className="MarkdownButton" onClick={toggleViewMarkdown}>
            {viewMarkdown ? 'Edit Markdown' : 'View Markdown'}
          </button>
          {/* Moon/Sun icon for theme toggle */}
          {darkMode ? (
            <button className="ThemeToggle" onClick={toggleDarkMode}>
              <Sun size={18} />
            </button>
          ) : (
            <button className="ThemeToggle" onClick={toggleDarkMode}>
              <Moon size={18} />
            </button>
          )}
        </div>
      </div>

      {/* Text Editor Canvas */}
      <div className="TextEditorCanvas">
        {viewMarkdown ? (
          <div
            className="MarkdownView"
            dangerouslySetInnerHTML={{ __html: renderMarkdown }}
          />
        ) : (
          <textarea
            value={activeTabContent}
            onChange={handleContentChange}
            placeholder="Start typing..."
            className="TextArea"
          />
        )}
      </div>

      {/* Footer with character count */}
      <div className="Footer">
        <span>{charCount} Characters</span>
      </div>
    </div>
  );
};

export default Editor;
