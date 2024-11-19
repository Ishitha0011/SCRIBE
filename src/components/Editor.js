import React, { useState } from 'react';
import { Plus, X } from 'lucide-react';
import Switch from './ui/Switch'; // Import the Switch component
import '../css/Editor.css';

const Editor = () => {
  const [tabs, setTabs] = useState([
    { id: 1, name: 'Untitled', content: '', active: true },
  ]);
  const [activeTab, setActiveTab] = useState(1);
  const [charCount, setCharCount] = useState(0);

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

  return (
    <div className="Editor">
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
          {/* Switch Component */}
          <Switch />
        </div>
      </div>

      {/* Text Editor Canvas */}
      <div className="TextEditorCanvas">
        <textarea
          value={activeTabContent}
          onChange={handleContentChange}
          placeholder="Start typing..."
          className="TextArea"
        />
      </div>

      {/* Footer with character count */}
      <div className="Footer">
        <span>{charCount} Characters</span>
      </div>
    </div>
  );
};

export default Editor;
