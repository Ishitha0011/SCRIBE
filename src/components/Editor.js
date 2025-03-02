import React, { useState, useEffect, useRef } from 'react';
import { Plus, X, Book, Pencil, Save, FileText, Clock, Hash, Type, AlertCircle, FileCog } from 'lucide-react';
import { marked } from 'marked';
import { useTheme } from '../ThemeContext';
import { useFileContext } from '../FileContext';
import Switch from './ui/Switch';
import '../css/Editor.css';

const Editor = () => {
  const [viewMarkdown, setViewMarkdown] = useState(false);
  const [localContent, setLocalContent] = useState('');
  const [charCount, setCharCount] = useState(0);
  const [wordCount, setWordCount] = useState(0);
  const [cursorPosition, setCursorPosition] = useState({ line: 1, column: 1 });
  const [lastSaved, setLastSaved] = useState(null);
  const [unsavedChanges, setUnsavedChanges] = useState({});
  
  const { theme } = useTheme();
  const {
    openFiles,
    activeFileId,
    fileContents,
    openFile,
    closeFile,
    saveFile,
    updateFileContent
  } = useFileContext();

  // Reference to tabs container for scroll shadow
  const tabsLeftRef = useRef(null);
  const textAreaRef = useRef(null);

  // Update local content when active file changes
  useEffect(() => {
    if (activeFileId && fileContents[activeFileId] !== undefined) {
      setLocalContent(fileContents[activeFileId]);
    } else {
      setLocalContent('');
    }
  }, [activeFileId, fileContents]);

  // Update character and word count when content changes
  useEffect(() => {
    setCharCount(localContent.length);
    const words = localContent.trim() ? localContent.trim().split(/\s+/).length : 0;
    setWordCount(words);
  }, [localContent]);
  
  // Scroll active tab into view when it changes
  useEffect(() => {
    if (activeFileId && tabsLeftRef.current) {
      const activeTab = tabsLeftRef.current.querySelector('.Tab.active');
      if (activeTab) {
        // Scroll the active tab into view with some padding
        const tabsContainer = tabsLeftRef.current;
        const tabRect = activeTab.getBoundingClientRect();
        const containerRect = tabsContainer.getBoundingClientRect();
        
        // Check if the tab is partially or fully out of view
        if (tabRect.left < containerRect.left || tabRect.right > containerRect.right) {
          // Calculate the scroll position to center the tab
          const scrollLeft = activeTab.offsetLeft - (tabsContainer.clientWidth / 2) + (activeTab.clientWidth / 2);
          tabsContainer.scrollTo({ left: scrollLeft, behavior: 'smooth' });
        }
      }
    }
  }, [activeFileId]);

  // Handle scroll shadow indicators
  useEffect(() => {
    const tabsContainer = tabsLeftRef.current;
    if (!tabsContainer) return;

    const checkScroll = () => {
      // Check if we can scroll left
      if (tabsContainer.scrollLeft > 0) {
        tabsContainer.classList.add('can-scroll-left');
      } else {
        tabsContainer.classList.remove('can-scroll-left');
      }

      // Check if we can scroll right
      if (tabsContainer.scrollLeft + tabsContainer.clientWidth < tabsContainer.scrollWidth) {
        tabsContainer.classList.add('can-scroll-right');
      } else {
        tabsContainer.classList.remove('can-scroll-right');
      }
    };

    // Initial check
    checkScroll();

    // Add scroll event listener
    tabsContainer.addEventListener('scroll', checkScroll);

    // Also check when tabs change
    const resizeObserver = new ResizeObserver(checkScroll);
    resizeObserver.observe(tabsContainer);

    return () => {
      tabsContainer.removeEventListener('scroll', checkScroll);
      resizeObserver.disconnect();
    };
  }, [openFiles]);
  
  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = async (e) => {
      // Save file with Ctrl+S
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (activeFileId) {
          await handleSaveFile();
        }
      }
      
      // Toggle markdown view with Ctrl+M
      if ((e.ctrlKey || e.metaKey) && e.key === 'm') {
        e.preventDefault();
        toggleViewMarkdown();
      }
      
      // Close current tab with Ctrl+W
      if ((e.ctrlKey || e.metaKey) && e.key === 'w') {
        e.preventDefault();
        if (activeFileId) {
          handleTabClose(activeFileId);
        }
      }
      
      // New file with Ctrl+N
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        handleNewFile();
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [activeFileId, localContent]);

  const handleNewFile = () => {
    const newTab = {
      id: `new-${Date.now()}`,
      name: 'Untitled',
      type: 'file',
      isNew: true,
    };
    openFile(newTab);
  };

  const handleTabClick = (id) => {
    if (id !== activeFileId) {
      // Save current content before switching
      if (activeFileId && localContent !== fileContents[activeFileId]) {
        updateFileContent(activeFileId, localContent);
        setUnsavedChanges({ ...unsavedChanges, [activeFileId]: true });
      }
      
      // Switch to the selected tab
      openFile(openFiles.find(file => file.id === id));
    }
  };

  const handleCursorPositionChange = (e) => {
    if (!e.target) return;
    
    const textarea = e.target;
    const value = textarea.value;
    
    const start = textarea.selectionStart;
    const lines = value.substr(0, start).split('\n');
    const lineNumber = lines.length;
    const columnNumber = lines[lines.length - 1].length + 1;
    
    setCursorPosition({ line: lineNumber, column: columnNumber });
  };

  const handleContentChange = (e) => {
    const newContent = e.target.value;
    setLocalContent(newContent);
    
    // Mark as unsaved if content changed
    if (activeFileId && newContent !== fileContents[activeFileId]) {
      setUnsavedChanges({ ...unsavedChanges, [activeFileId]: true });
    } else {
      const updatedUnsavedChanges = { ...unsavedChanges };
      delete updatedUnsavedChanges[activeFileId];
      setUnsavedChanges(updatedUnsavedChanges);
    }
  };

  const handleTabClose = (id) => {
    // Check for unsaved changes
    if (unsavedChanges[id]) {
      if (window.confirm('You have unsaved changes. Do you want to save before closing?')) {
        saveFile(id, id === activeFileId ? localContent : fileContents[id]);
      }
    }
    
    closeFile(id);
  };

  const handleSaveFile = async () => {
    if (activeFileId) {
      await saveFile(activeFileId, localContent);
      // Remove from unsaved changes
      const updatedUnsavedChanges = { ...unsavedChanges };
      delete updatedUnsavedChanges[activeFileId];
      setUnsavedChanges(updatedUnsavedChanges);
      
      // Update last saved time
      setLastSaved(new Date());
    }
  };

  const toggleViewMarkdown = () => setViewMarkdown((prevView) => !prevView);

  // Render markdown content if in markdown view mode
  const renderMarkdown = marked(localContent || '', { breaks: true });

  // Get file extension for the active file
  const getFileExtension = () => {
    if (!activeFileId) return '';
    const activeFile = openFiles.find(file => file.id === activeFileId);
    if (!activeFile) return '';
    const parts = activeFile.name.split('.');
    return parts.length > 1 ? parts.pop().toUpperCase() : '';
  };

  // Format the last saved time
  const getLastSavedTime = () => {
    if (!lastSaved) return 'Never';
    
    const now = new Date();
    const diff = Math.floor((now - lastSaved) / 1000); // seconds
    
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} hours ago`;
    return lastSaved.toLocaleTimeString();
  };

  return (
    <div className={`Editor ${theme === 'dark' ? 'dark' : ''}`}>
      {/* Tabs */}
      <div className="Tabs">
        <div className="TabsLeft" ref={tabsLeftRef}>
          {openFiles.map((file) => (
            <div
              key={file.id}
              className={`Tab ${file.id === activeFileId ? 'active' : ''} ${unsavedChanges[file.id] ? 'unsaved' : ''}`}
              onClick={() => handleTabClick(file.id)}
            >
              <span title={file.name}>{file.name}</span>
              {unsavedChanges[file.id] && <span className="UnsavedIndicator">•</span>}
              <button
                className="CloseTab"
                onClick={(e) => {
                  e.stopPropagation();
                  handleTabClose(file.id);
                }}
                title="Close tab"
              >
                <X size={16} />
              </button>
            </div>
          ))}
          <button
            className="AddTab"
            onClick={handleNewFile}
            style={{ color: theme === 'dark' ? '#fff' : '#555' }}
          >
            <Plus size={18} />
          </button>
        </div>
        <div className="TabsRight">
          <button className="SaveButton" onClick={handleSaveFile} disabled={!activeFileId} title="Save (Ctrl+S)">
            <Save size={18} />
          </button>
          <button className="MarkdownButton" onClick={toggleViewMarkdown} title="Toggle Markdown (Ctrl+M)">
            {viewMarkdown ? <Pencil size={18} /> : <Book size={18} />}
          </button>
          <Switch />
        </div>
      </div>

      {/* Text Editor Canvas */}
      <div className="TextEditorCanvas">
        {activeFileId ? (
          viewMarkdown ? (
            <div
              className="MarkdownView markdown-content"
              dangerouslySetInnerHTML={{ __html: renderMarkdown }}
            />
          ) : (
            <textarea
              ref={textAreaRef}
              value={localContent}
              onChange={handleContentChange}
              onKeyUp={handleCursorPositionChange}
              onClick={handleCursorPositionChange}
              placeholder="Start typing..."
              className="TextArea"
            />
          )
        ) : (
          <div className="EmptyState">
            <p>No file selected. Open a file from the sidebar or create a new file.</p>
            <button onClick={handleNewFile} className="NewFileButton">Create New File</button>
          </div>
        )}
      </div>

      {/* Enhanced Footer with more useful information */}
      <div className="Footer">
        {activeFileId ? (
          <>
            <div className="FooterLeft">
              <div className="FooterItem">
                <FileCog size={14} />
                <span>{getFileExtension() || 'TXT'}</span>
              </div>
              <div className="FooterItem optional">
                <Type size={14} />
                <span>UTF-8</span>
              </div>
            </div>
            <div className="FooterRight">
              <div className="FooterItem">
                <Hash size={14} />
                <span>Ln {cursorPosition.line}, Col {cursorPosition.column}</span>
              </div>
              <div className="FooterItem optional">
                <Type size={14} />
                <span>{wordCount} Words</span>
              </div>
              <div className="FooterItem">
                <FileText size={14} />
                <span>{charCount} Chars</span>
              </div>
              {lastSaved && (
                <div className="FooterItem optional">
                  <Clock size={14} />
                  <span>Saved: {getLastSavedTime()}</span>
                </div>
              )}
              {unsavedChanges[activeFileId] && (
                <div className="FooterItem">
                  <AlertCircle size={14} className="UnsavedIndicator" />
                  <span className="UnsavedIndicator">Unsaved</span>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="FooterItem">Ready</div>
        )}
      </div>
    </div>
  );
};

export default Editor;
