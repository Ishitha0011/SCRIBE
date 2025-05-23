/* eslint-disable */
import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  Settings,
  Plus,
  MoreVertical,
  Edit,
  Trash2,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Folder,
  FileText,
  FolderPlus,
  FilePlus,
  X,
  FileCode,
  FileBox,
  Loader,
  AlertCircle,
} from 'lucide-react';
import '../css/LeftSidebar.css';
import { useTheme } from '../ThemeContext';
import { useFileContext } from '../FileContext';
import CreateItemDialog from './CreateItemDialog';
import TreeNode from './TreeNode';
import SettingsPanel from './SettingsPanel'; // Import the SettingsPanel

const LeftSidebar = () => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedParentFolder, setSelectedParentFolder] = useState(null);
  const [activeItem, setActiveItem] = useState(null);
  const [menuVisible, setMenuVisible] = useState(null);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [editMode, setEditMode] = useState(null);
  const [newName, setNewName] = useState('');
  const [collapsedFolders, setCollapsedFolders] = useState({});
  const [sidebarWidth, setSidebarWidth] = useState(250);
  const [isResizing, setIsResizing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [addMenuVisible, setAddMenuVisible] = useState(false);
  const [contentSearchActive, setContentSearchActive] = useState(false);
  const [searchMode, setSearchMode] = useState('filename'); // 'filename' or 'content'

  // State for SettingsPanel
  const [isSettingsPanelOpen, setIsSettingsPanelOpen] = useState(false);
  const [editorFontFamily, setEditorFontFamily] = useState('JetBrains Mono'); // Default font
  const [editorFontSize, setEditorFontSize] = useState(14); // Default font size

  // Use theme from context
  const { theme } = useTheme();
  
  // Use file context
  const { 
    openFile, 
    activeFileId,
    fileStructure,
    workspacePath,
    setWorkspace,
    loadFileStructure,
    createItem,
    deleteItem,
    renameItem,
    loading,
    error,
    searchInContent,
    searchResults,
    isSearching,
    updateFileContent,
    updateFileType,
  } = useFileContext();

  const menuRef = useRef(null);
  const sidebarRef = useRef(null);
  const resizerRef = useRef(null);
  const searchInputRef = useRef(null);
  const addMenuRef = useRef(null);

  useEffect(() => {
    if (workspacePath) {
      loadFileStructure();
    }
  }, [workspacePath]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuVisible(null);
      }
      
      if (addMenuRef.current && !addMenuRef.current.contains(e.target)) {
        setAddMenuVisible(false);
      }
    };

    document.addEventListener('click', handleClickOutside);

    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (isResizing) {
        const newWidth = e.clientX - sidebarRef.current.getBoundingClientRect().left;
        if (newWidth > 50 && newWidth < 500) {
          setSidebarWidth(newWidth);
          if (newWidth <= 100) {
            setIsCollapsed(true);
          } else {
            setIsCollapsed(false);
          }
        }
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = '';
    };

    const handleMouseDown = (e) => {
      e.preventDefault();
      setIsResizing(true);
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = 'none';
    };

    const resizer = resizerRef.current;
    if (resizer) { // Check if resizer exists
        resizer.addEventListener('mousedown', handleMouseDown);
    }

    return () => {
      if (resizer) { // Check if resizer exists before removing listener
        resizer.removeEventListener('mousedown', handleMouseDown);
      }
      // Clean up global listeners on mouseup/mousemove if component unmounts while resizing
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = '';
    };
  }, [isResizing]); // Removed sidebarRef and resizerRef from deps as they shouldn't change

  const openDirectory = async () => {
    try {
      const response = await fetch('http://localhost:8000/api/workspace/select-directory', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to open directory selector (Status: ${response.status})`);
      }
      
      const result = await response.json();
      
      if (result.status === 'success' && result.directory) {
        const success = await setWorkspace(result.directory);
        if (success) {
          console.log('Workspace set successfully to:', result.directory);
        } else {
          console.error('Failed to set workspace:', result.directory);
          alert('Failed to set workspace. Please try again.');
        }
      } else if (result.status === 'cancelled') {
        console.log('Workspace selection cancelled');
      } else {
        throw new Error('Invalid response from directory selector');
      }
    } catch (error) {
      console.error('Error opening directory:', error);
      alert('Error opening directory: ' + error.message);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this item?')) {
      const success = await deleteItem(id);
      if (success) {
        setMenuVisible(null);
        setActiveItem(null);
      } else {
        alert('Failed to delete item');
      }
    }
  };

  const handleEdit = async (id, currentNewName) => { // Renamed newName to currentNewName to avoid conflict with state
    if (currentNewName && currentNewName.trim() !== '') {
      const success = await renameItem(id, currentNewName);
      if (success) {
        setEditMode(null);
        setNewName(''); // Clear state newName
      } else {
        alert('Failed to rename item');
      }
    } else {
      alert('Name cannot be empty');
    }
  };

  // const handleNameInputKeyDown = (e, id) => { // This function seems to be using the state `newName`
  //   if (e.key === 'Enter') {
  //     handleEdit(id, newName); // Pass the state `newName`
  //   }
  // };

  const handleAddItem = async (type, name, parentPath = null) => {
    if (!name || name.trim() === '') {
      return;
    }
    
    const effectiveParentPath = parentPath ?? selectedParentFolder;
    
    try {
      if (type === 'canvas') {
        const fileName = name.includes('.') ? name : `${name}.canvas`;
        const result = await createItem(fileName, 'file', effectiveParentPath);
        
        if (result) {
          const initialCanvasData = JSON.stringify({ 
            nodes: [], 
            edges: [], 
            format: "canvas", 
            version: "1.0",
            created: new Date().toISOString(),
            name: fileName
          });
          await updateFileContent(result.id, initialCanvasData);
          await updateFileType(result.id, 'canvas');
          openFile({ id: result.id, name: result.name, type: 'canvas' });
          setIsDialogOpen(false);
          setSelectedParentFolder(null);
          if (effectiveParentPath && collapsedFolders[effectiveParentPath]) {
            toggleFolder(effectiveParentPath);
          }
        }
      } else {
        const result = await createItem(name, type, effectiveParentPath);
        if (result) {
          setIsDialogOpen(false);
          setSelectedParentFolder(null);
          if (type === 'file') {
            openFile({ id: result.id, name: result.name, type: 'file' });
          }
          if (effectiveParentPath && collapsedFolders[effectiveParentPath]) {
            toggleFolder(effectiveParentPath);
          }
        }
      }
    } catch (error) {
      console.error('Error creating item:', error);
    }
  };

  const toggleFolder = (id) => {
    setCollapsedFolders((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  // const handleSearch = (e) => { // This function is unused as searchTerm is directly set by handleSearchChange
  //   setSearchTerm(e.target.value);
  // };
  
  // const clearSearch = () => { // This function is unused
  //   setSearchTerm('');
  //   if (searchInputRef.current) { // Check if ref exists
  //       searchInputRef.current.focus();
  //   }
  // };

  const handleItemClick = (item) => {
    setActiveItem(item.id);
    
    if (item.type === 'folder') {
      setSelectedParentFolder(item.id);
    } else {
      if (item.type === 'canvas' || (item.name && item.name.toLowerCase().endsWith('.canvas'))) {
        if (item.type !== 'canvas') {
          updateFileType(item.id, 'canvas');
          openFile({ ...item, type: 'canvas' });
        } else {
          openFile(item);
        }
      } else {
        const fileExtension = item.name.split('.').pop().toLowerCase();
        const supportedExtensions = ['txt', 'md', 'markdown', 'js', 'jsx', 'ts', 'tsx', 'html', 'css', 'json', 'csv', 'xml', 'yml', 'yaml', 'ini', 'config', 'sh', 'bat', 'ps1', 'canvas'];
        if (supportedExtensions.includes(fileExtension)) {
          openFile(item);
        } else {
          console.warn('This file type may not be fully supported for editing.');
          // Optionally open unsupported files too, or provide a message
          // openFile(item); 
        }
      }
    }
  };

  const filterStructure = (items, currentSearchTerm) => { // Renamed searchTerm to currentSearchTerm
    if (!currentSearchTerm) return items;
    
    return items.filter(item => {
      const nameMatch = item.name.toLowerCase().includes(currentSearchTerm.toLowerCase());
      if (item.type === 'folder' && item.children) {
        const filteredChildren = filterStructure(item.children, currentSearchTerm);
        // A folder matches if its name matches OR if any of its children match
        return nameMatch || filteredChildren.length > 0;
      }
      return nameMatch;
    }).map(item => {
      if (item.type === 'folder' && item.children) {
        // If a folder is included, make sure its children are also filtered
        return { ...item, children: filterStructure(item.children, currentSearchTerm) };
      }
      return item;
    });
  };

  const renderTree = (items) => {
    const filteredItems = filterStructure(items, searchTerm); // Use state `searchTerm` here
    
    if (filteredItems.length === 0 && searchTerm) { // Show "No items found" only if searching and no results
      return <div className="EmptyMessage">No items found matching "{searchTerm}"</div>;
    }
    if (filteredItems.length === 0 && !searchTerm && items.length > 0) {
        // This case shouldn't happen if items.length > 0 and no search term,
        // but as a fallback, or if original items itself were empty after initial load.
        return <div className="EmptyMessage">No items to display.</div>; 
    }
    
    return filteredItems.map((item) => (
      <TreeNode
        key={item.id}
        item={item}
        level={0}
        activeItem={activeFileId} // Use activeFileId from context for consistent active state
        collapsedFolders={collapsedFolders}
        menuVisible={menuVisible}
        onItemClick={handleItemClick}
        onToggleFolder={toggleFolder}
        onMenuToggle={setMenuVisible}
        onEdit={(id, name) => {
          setEditMode(id);
          setNewName(name); // Set the initial name for editing
        }}
        onDelete={handleDelete}
        onAddItem={(id) => {
          setSelectedParentFolder(id);
          setIsDialogOpen(true);
        }}
        editMode={editMode}
        newName={newName} // Pass the state for controlled input
        onNewNameChange={setNewName} // Directly use setNewName
        onRename={(itemId, updatedName) => handleEdit(itemId, updatedName)} // Pass updatedName from TreeNode
        onKeyDown={handleRenameKeyDown} // Add the missing onKeyDown prop
      />
    ));
  };

  // Removed handleNewNameChange as setNewName is passed directly

  const handleRenameKeyDown = (e, itemId) => { // This is likely used within TreeNode directly, not here
    if (e.key === 'Enter') {
      e.preventDefault();
      handleEdit(itemId, newName); // Pass the current newName state to handleEdit
    } else if (e.key === 'Escape') {
      setEditMode(null);
      setNewName(''); // Clear newName on escape
    }
  };

  const handleRename = async (itemId) => { // This is the actual rename submission logic
    if (!newName.trim()) { // Check if newName (from state) is empty
      setEditMode(null); // Exit edit mode if name is empty after trim
      setNewName('');   // Clear newName
      // alert('Name cannot be empty'); // Optional: Or just exit edit mode
      return;
    }
    
    try {
      const success = await renameItem(itemId, newName); // Use state `newName`
      if (success) {
        setEditMode(null);
        setNewName(''); // Clear newName on successful rename
      } else {
        // renameItem should ideally throw an error or return a message for alerts
        // alert('Failed to rename item. The name might be invalid or already exist.');
      }
    } catch (error) {
      console.error('Error renaming item:', error);
      // alert('An error occurred while renaming the item.');
    }
  };
  
  const toggleSearch = () => {
    setIsSearchOpen(prev => !prev); // Use functional update for state based on previous state
    if (!isSearchOpen) { // If it was closed and is now opening
      setTimeout(() => {
        if (searchInputRef.current) {
          searchInputRef.current.focus();
        }
      }, 100);
    } else { // If it was open and is now closing
      setSearchTerm('');
      setContentSearchActive(false);
      setSearchMode('filename');
    }
  };
  
  const toggleSearchMode = () => {
    setSearchMode(prev => {
      const newMode = prev === 'filename' ? 'content' : 'filename';
      // If switching to content search with existing term, perform the search
      if (searchTerm && newMode === 'content' && prev === 'filename') {
        // Directly call handleContentSearch, no need for useEffect dependency on searchMode here
        // as it's part of the same synchronous logic flow.
        // Ensure handleContentSearch is prepared to be called like this.
        handleContentSearch(); 
      }
      return newMode;
    });
    setContentSearchActive(false); // Always reset contentSearchActive when mode toggles
  };
  
  const handleContentSearch = async () => {
    if (!searchTerm || searchTerm.trim() === '') return;
    setContentSearchActive(true); // This indicates that a content search has been initiated
    await searchInContent(searchTerm);
  };
  
  const [searchDebounce, setSearchDebounce] = useState(null);
  
  const handleSearchChange = (e) => {
    const value = e.target.value;
    setSearchTerm(value);
    
    if (searchDebounce) {
      clearTimeout(searchDebounce);
    }
    
    if (searchMode === 'content') {
      if (value.trim() === '') { // If search term is cleared in content mode
        setContentSearchActive(false); // Reset content active state
        // Optionally clear searchResults if they are managed in FileContext and you want them cleared immediately
      } else {
        setSearchDebounce(setTimeout(() => {
          handleContentSearch();
        }, 500));
      }
    } else {
        // For filename search, filtering happens live in renderTree, no debounce needed here
        // If the search term is cleared, filterStructure will return all items.
    }
  };

  const handleSearchResultClick = (file, match) => {
    openFile(file, searchTerm, match ? match.line : undefined); // Pass match.line if available
    setIsSearchOpen(false);
    setSearchTerm('');
    setContentSearchActive(false);
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        toggleSearch();
      }
      
      if (e.key === 'Escape' && isSearchOpen) {
        e.preventDefault(); // Prevent other escape actions if search is open
        setIsSearchOpen(false);
        setSearchTerm('');
        setContentSearchActive(false);
        // setSearchMode('filename'); // Optionally reset search mode
      }
      
      if (e.key === 'Enter' && isSearchOpen && searchTerm) {
        e.preventDefault();
        
        if (searchMode === 'filename') {
          // For filename search, results are implicitly filtered in the displayed list
          const results = filterStructure(fileStructure, searchTerm);
          if (results.length > 0) {
            // Decide what 'selecting' the first means. If it's a folder, expand? If a file, open?
            // For now, let's assume clicking the first displayed item.
            // This requires identifying the first item in the rendered list.
            // Or, if you want to open the first match directly:
            handleItemClick(results[0]); // This will open file or select folder
            setIsSearchOpen(false);
            setSearchTerm('');
          }
        } else if (searchMode === 'content') {
          if (!contentSearchActive && !isSearching) { // If content search hasn't run yet (or not currently running)
            handleContentSearch(); // Trigger it on Enter
          } else if (contentSearchActive && searchResults && searchResults.length > 0) {
            const firstResult = searchResults[0];
            handleSearchResultClick(firstResult.file, firstResult.matches[0]);
          }
        }
      }
      
      if (e.altKey && e.key.toLowerCase() === 'f' && isSearchOpen) {
        e.preventDefault();
        toggleSearchMode();
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [
    isSearchOpen, 
    searchTerm, 
    fileStructure, // filterStructure depends on this
    searchMode, 
    contentSearchActive, 
    searchResults, // For Enter key on content results
    isSearching,   // To avoid re-triggering content search if already searching
    // toggleSearch, toggleSearchMode, handleContentSearch, handleItemClick, handleSearchResultClick, openFile, searchInContent // These are functions, ensure they are stable or memoized if complex
  ]); // Added missing dependencies

  // Function to toggle SettingsPanel
  const toggleSettingsPanel = () => {
    setIsSettingsPanelOpen(!isSettingsPanelOpen);
  };

  return (
    <div
      className={`LeftSidebar ${theme} ${isCollapsed ? 'collapsed' : ''}`}
      style={{ width: isCollapsed ? '50px' : `${sidebarWidth}px` }}
      ref={sidebarRef}
    >
      <div className="TopButtons">
        <button className="IconButton" title="Search files (Cmd/Ctrl+K)" onClick={toggleSearch}>
          <Search size={18} />
        </button>
        <button className="IconButton" title="Settings" onClick={toggleSettingsPanel}> {/* Attach toggle function */}
          <Settings size={18} />
        </button>
        <div className="AddFileButton" ref={addMenuRef}>
          <button
            className="IconButton" 
            title="Add file or folder"
            id='Addbuttonfiles'
            onClick={() => {
              setSelectedParentFolder(null); // Add to root if no folder selected
              setIsDialogOpen(true);
            }}
          >
            <Plus size={18} />
          </button>
        </div>
      </div>

      {!isCollapsed && fileStructure.length > 0 ? (
        <div className="FileTree">
          {loading ? (
            <div className="LoadingIndicator">Loading...</div>
          ) : error ? (
            <div className="ErrorMessage">{error}</div>
          ) : (
            renderTree(fileStructure)
          )}
        </div>
      ) : (
        !isCollapsed && (
          <div className="NoDirectory">
            {/* Display message based on whether workspacePath is set */}
            {workspacePath ? (
              <p className="EmptyMessage">This workspace is empty. Add a file or folder to get started!</p>
            ) : (
              <p className="EmptyMessage">Wow, such empty. Open a workspace to see your files.</p>
            )}
          </div>
        )
      )}

      <button
        className="CollapseButton"
        title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
        onClick={() => setIsCollapsed((prev) => !prev)}
      >
        {isCollapsed ? <ChevronRight size={24} /> : <ChevronLeft size={24} />}
      </button>

      {isDialogOpen && (
        <CreateItemDialog
          onClose={() => {
            setIsDialogOpen(false);
            setSelectedParentFolder(null); // Reset selected parent on close
          }}
          onCreate={(type, name) => handleAddItem(type, name, selectedParentFolder)}
          theme={theme}
          parentFolderName={
            selectedParentFolder 
            ? fileStructure.find(item => item.id === selectedParentFolder)?.name || selectedParentFolder.split('/').pop() // Try to find name from structure
            : 'workspace root'
          }
        />
      )}

      {!isCollapsed && (
        <div className="WorkspaceSelection">
          <button className="OpenDirectoryButton" onClick={openDirectory}>
            {workspacePath ? 'Switch Workspace' : 'Open Workspace'}
          </button>
          {workspacePath && (
            <div className="CurrentWorkspace" title={workspacePath}>
              {workspacePath.split(/[/\\]/).pop()} {/* Handles both / and \ separators */}
            </div>
          )}
        </div>
      )}

      {isSearchOpen && (
        <div className={`SpotlightOverlay ${theme}`} onClick={() => {
            setIsSearchOpen(false); 
            // Optionally clear search term when clicking overlay
            // setSearchTerm(''); 
            // setContentSearchActive(false);
          }}>
          <div className={`SpotlightSearch ${theme}`} onClick={(e) => e.stopPropagation()}>
            <div className={`SpotlightSearchHeader ${theme}`}>
              <Search size={18} className="SpotlightSearchIcon" />
              <input
                type="text"
                placeholder={searchMode === 'filename' ? "Search files by name..." : "Search in file contents..."}
                value={searchTerm}
                onChange={handleSearchChange}
                className={`SpotlightSearchInput ${theme}`}
                ref={searchInputRef}
                autoFocus // autoFocus on open
              />
              <button 
                className={`SpotlightModeToggle ${theme} ${searchMode === 'content' ? 'active' : ''}`}
                onClick={toggleSearchMode}
                title={searchMode === 'filename' ? "Switch to content search (Alt+F)" : "Switch to filename search (Alt+F)"}
              >
                {searchMode === 'filename' ? <FileText size={16}/> : <FileCode size={16}/> } {/* Example: Different icons */}
              </button>
              {searchTerm && (
                <button 
                    className={`SpotlightClearButton ${theme}`} 
                    onClick={() => { setSearchTerm(''); if (searchInputRef.current) searchInputRef.current.focus(); setContentSearchActive(false); }}
                    title="Clear search"
                >
                    <X size={16} />
                </button>
              )}
              <button className={`SpotlightCloseButton ${theme}`} onClick={toggleSearch} title="Close (Esc)">
                <X size={16} />
              </button>
            </div>
            
            {searchMode === 'content' && isSearching && (
              <div className={`SearchLoadingIndicator ${theme}`}>
                <Loader size={18} className="Spinner" />
                <span>Searching in files...</span>
              </div>
            )}
            
            {searchTerm === '' && !isSearching && ( // Hint shown only if search term is empty and not searching
              <div className={`SpotlightHint ${theme}`}>
                <span>Type to search. Press <kbd>Alt+F</kbd> to toggle search mode.</span>
              </div>
            )}
            
            {searchMode === 'content' && contentSearchActive && searchTerm && !isSearching && (
              <div className={`SpotlightResults ${theme}`}>
                {searchResults.length > 0 ? (
                  <div className={`ContentSearchResults ${theme}`}>
                    <div className={`ResultsCount ${theme}`}>
                      Found {searchResults.reduce((acc, result) => acc + result.matches.length, 0)} matches in {searchResults.length} files for "{searchTerm}"
                    </div>
                    {searchResults.map((result) => (
                      <div key={result.file.id} className={`ContentResultFile ${theme}`}>
                        <div className={`ContentResultFileName ${theme}`} onClick={() => handleSearchResultClick(result.file, result.matches[0])}>
                          {getFileIcon(result.file)}
                          <span>{result.file.name}</span>
                          <span className="MatchCount">({result.matches.length} {result.matches.length === 1 ? 'match' : 'matches'})</span>
                        </div>
                        <div className={`ContentResultMatches ${theme}`}>
                          {result.matches.map((match, matchIndex) => (
                            <div
                              key={`${result.file.id}-match-${matchIndex}`}
                              className={`ContentResultMatch ${theme}`}
                              onClick={() => handleSearchResultClick(result.file, match)}
                            >
                              <div className="LineNumber" title={`Line ${match.line}`}>{match.line}</div>
                              <div className="MatchPreview">
                                <span className="PreviewBefore">{match.preview.before}</span>
                                <span className="MatchHighlight">{match.preview.match}</span>
                                <span className="PreviewAfter">{match.preview.after}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                   <div className={`SpotlightNoResults ${theme}`}>No content matches found for "{searchTerm}"</div>
                )}
              </div>
            )}
            
            {searchMode === 'filename' && searchTerm && ( // Show filename results only in filename mode and if searchterm exists
              <div className={`SpotlightResults ${theme}`}>
                {filterStructure(fileStructure, searchTerm).length > 0 ? (
                  filterStructure(fileStructure, searchTerm).map((item) => (
                    <div 
                      key={item.id} 
                      className={`SpotlightResultItem ${theme} ${activeFileId === item.id ? 'active' : ''}`}
                      onClick={() => {
                        handleItemClick(item);
                        setIsSearchOpen(false);
                        setSearchTerm('');
                      }}
                      title={item.path || item.name} // Show full path on hover if available
                    >
                      {getFileIcon(item)}
                      <span>{item.name}</span>
                      {/* Optionally show item path or breadcrumbs if nested */}
                    </div>
                  ))
                ) : (
                  <div className={`SpotlightNoResults ${theme}`}>No files or folders found matching "{searchTerm}"</div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Render SettingsPanel */}
      <SettingsPanel
        isOpen={isSettingsPanelOpen}
        onClose={toggleSettingsPanel}
        theme={theme}
        editorFontFamily={editorFontFamily}
        setEditorFontFamily={setEditorFontFamily}
        editorFontSize={editorFontSize}
        setEditorFontSize={setEditorFontSize}
      />

      <div className={`Resizer ${isResizing ? 'active' : ''}`} ref={resizerRef} />
    </div>
  );
};

const getFileIcon = (item) => {
  if (item.type === 'folder') return <Folder size={16} className="FileIcon" />;
  
  const extension = item.name.split('.').pop().toLowerCase();
  
  switch (extension) {
    case 'js': case 'jsx': case 'ts': case 'tsx':
      return <FileCode size={16} className="FileIcon js" />;
    case 'md': case 'markdown':
      return <FileBox size={16} className="FileIcon md" />; // Using FileBox for markdown
    case 'canvas':
        return <AlertCircle size={16} className="FileIcon canvas" />; // Example: Placeholder for canvas
    case 'html': case 'css': case 'json': // Add more specific icons if desired
    case 'txt':
      return <FileText size={16} className="FileIcon txt" />;
    default:
      return <FileText size={16} className="FileIcon generic" />;
  }
};

export default LeftSidebar;