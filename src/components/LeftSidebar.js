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
    isSearching
  } = useFileContext();

  const menuRef = useRef(null);
  const sidebarRef = useRef(null);
  const resizerRef = useRef(null);
  const searchInputRef = useRef(null);
  const addMenuRef = useRef(null);

  // Add a new useEffect to handle the workspace path change
  useEffect(() => {
    if (workspacePath) {
      // Workspace is already set, no need to prompt
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
      document.body.style.userSelect = ''; // Re-enable text selection
    };

    const handleMouseDown = (e) => {
      e.preventDefault(); // Prevent text selection
      setIsResizing(true);
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = 'none'; // Disable text selection
    };

    const resizer = resizerRef.current;
    resizer.addEventListener('mousedown', handleMouseDown);

    return () => {
      resizer.removeEventListener('mousedown', handleMouseDown);
    };
  }, [isResizing]);

  const openDirectory = async () => {
    try {
      // We'll use a simple prompt for now since we're using server-side file handling
      const directory = prompt('Enter the full path to your workspace directory:');
      if (directory) {
        const success = await setWorkspace(directory);
        if (success) {
          console.log('Workspace set successfully');
        } else {
          alert('Failed to set workspace. Check the path and try again.');
        }
      }
    } catch (error) {
      console.error('Error opening directory:', error);
      alert('Error opening directory');
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this item?')) {
      const success = await deleteItem(id);
      if (success) {
        setMenuVisible(null);
        setActiveItem(null); // Clear active item if it was deleted
      } else {
        alert('Failed to delete item');
      }
    }
  };

  const handleEdit = async (id, newName) => {
    if (newName && newName.trim() !== '') {
      const success = await renameItem(id, newName);
      if (success) {
    setEditMode(null);
    setNewName('');
      } else {
        alert('Failed to rename item');
      }
    } else {
      alert('Name cannot be empty');
    }
  };

  const handleNameInputKeyDown = (e, id) => {
    if (e.key === 'Enter') {
      handleEdit(id, newName);
    }
  };

  const handleAddItem = async (type, name, parentPath = null) => {
    if (!name || name.trim() === '') {
      return;
    }
    
    // If no parent path is explicitly provided, use the selectedParentFolder
    const effectiveParentPath = parentPath ?? selectedParentFolder;
    
    try {
      const result = await createItem(name, type, effectiveParentPath);
      if (result) {
        // Close the dialog
        setIsDialogOpen(false);
        
        // Clear selected parent folder
        setSelectedParentFolder(null);
        
        // If it's a file, automatically open it
        if (type === 'file') {
          openFile({
            id: result.id,
            name: result.name,
            type: 'file'
          });
        }
        
        // If the folder was previously collapsed, expand it to show the new item
        if (effectiveParentPath && collapsedFolders[effectiveParentPath]) {
          toggleFolder(effectiveParentPath);
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

  // Function to handle search
  const handleSearch = (e) => {
    setSearchTerm(e.target.value);
  };
  
  // Clear search
  const clearSearch = () => {
    setSearchTerm('');
    searchInputRef.current.focus();
  };

  // Handle file/folder click
  const handleItemClick = (item) => {
    setActiveItem(item.id);
    
    // If it's a folder, remember it as the selected parent
    if (item.type === 'folder') {
      setSelectedParentFolder(item.id);
    } else {
      // If it's a file, open it in the editor
      // Check if it's a supported file type (text, markdown, etc.)
      const fileExtension = item.name.split('.').pop().toLowerCase();
      const supportedExtensions = ['txt', 'md', 'markdown', 'js', 'jsx', 'ts', 'tsx', 'html', 'css', 'json', 'csv', 'xml', 'yml', 'yaml', 'ini', 'config', 'sh', 'bat', 'ps1'];
      
      if (supportedExtensions.includes(fileExtension)) {
        openFile(item);
      } else {
        // Inform the user about unsupported file types without blocking alert
        console.warn('This file type may not be fully supported for editing.');
      }
    }
  };

  // Function to filter the file structure based on search term
  const filterStructure = (items, searchTerm) => {
    if (!searchTerm) return items;
    
    return items.filter(item => {
      const nameMatch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
      
      // If it's a folder, also check its children
      if (item.type === 'folder' && item.children) {
        const filteredChildren = filterStructure(item.children, searchTerm);
        return nameMatch || filteredChildren.length > 0;
      }
      
      return nameMatch;
    }).map(item => {
      if (item.type === 'folder' && item.children) {
        return {
          ...item,
          children: filterStructure(item.children, searchTerm)
        };
      }
      return item;
    });
  };

  const renderTree = (items) => {
    // Filter items based on search term
    const filteredItems = filterStructure(items, searchTerm);
    
    if (filteredItems.length === 0) {
      return <div className="EmptyMessage">No items found</div>;
    }
    
    return filteredItems.map((item) => (
      <TreeNode
        key={item.id}
        item={item}
        level={0}
        activeItem={activeFileId}
        collapsedFolders={collapsedFolders}
        menuVisible={menuVisible}
        onItemClick={handleItemClick}
        onToggleFolder={toggleFolder}
        onMenuToggle={setMenuVisible}
        onEdit={(id, name) => {
          setEditMode(id);
          setNewName(name);
        }}
        onDelete={handleDelete}
        onAddItem={(id) => {
          setSelectedParentFolder(id);
          setIsDialogOpen(true);
        }}
        editMode={editMode}
        newName={newName}
        onNewNameChange={handleNewNameChange}
        onRename={handleRename}
        onKeyDown={handleRenameKeyDown}
      />
    ));
  };

  // Handle rename input change
  const handleNewNameChange = (value) => {
    setNewName(value);
  };

  // Handle keydown in rename input
  const handleRenameKeyDown = (e, itemId) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleRename(itemId);
    } else if (e.key === 'Escape') {
      setEditMode(null);
    }
  };

  // Handle rename submit
  const handleRename = async (itemId) => {
    if (!newName.trim() || newName === '') {
      setEditMode(null);
      return;
    }
    
    try {
      const success = await renameItem(itemId, newName);
      if (success) {
        setEditMode(null);
      }
    } catch (error) {
      console.error('Error renaming item:', error);
    }
  };
  
  // Toggle spotlight search
  const toggleSearch = () => {
    setIsSearchOpen(!isSearchOpen);
    if (!isSearchOpen) {
      setTimeout(() => {
        if (searchInputRef.current) {
          searchInputRef.current.focus();
        }
      }, 100);
    } else {
      // Clear search when closing
      setSearchTerm('');
      setContentSearchActive(false);
      setSearchMode('filename');
    }
  };
  
  // Handle search mode toggle
  const toggleSearchMode = () => {
    setSearchMode(prev => prev === 'filename' ? 'content' : 'filename');
    setContentSearchActive(false);
    
    // If switching to content search with existing term, perform the search
    if (searchTerm && searchMode === 'filename') {
      handleContentSearch();
    }
  };
  
  // Handle content search
  const handleContentSearch = async () => {
    if (!searchTerm || searchTerm.trim() === '') return;
    
    setContentSearchActive(true);
    await searchInContent(searchTerm);
  };
  
  // Handle search term change with debounce for content search
  const [searchDebounce, setSearchDebounce] = useState(null);
  
  const handleSearchChange = (e) => {
    const value = e.target.value;
    setSearchTerm(value);
    
    // Clear previous debounce timer
    if (searchDebounce) {
      clearTimeout(searchDebounce);
    }
    
    // If content search is active, debounce the search
    if (searchMode === 'content') {
      setSearchDebounce(setTimeout(() => {
        handleContentSearch();
      }, 500)); // 500ms debounce
    }
  };

  // Handle item click from search results
  const handleSearchResultClick = (file, match) => {
    // Open the file with search highlighting info
    openFile(file, searchTerm, match.line);
    setIsSearchOpen(false);
    setSearchTerm('');
    setContentSearchActive(false);
  };

  // Function to handle keyboard shortcut for search
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Cmd/Ctrl + K to open search
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        toggleSearch();
      }
      
      // Escape to close search
      if (e.key === 'Escape' && isSearchOpen) {
        setIsSearchOpen(false);
        setSearchTerm('');
        setContentSearchActive(false);
      }
      
      // Enter to select first search result
      if (e.key === 'Enter' && isSearchOpen && searchTerm) {
        e.preventDefault();
        
        if (searchMode === 'filename') {
          const results = filterStructure(fileStructure, searchTerm);
          if (results.length > 0) {
            handleItemClick(results[0]);
            setIsSearchOpen(false);
            setSearchTerm('');
          }
        } else if (searchMode === 'content' && !contentSearchActive) {
          // Trigger content search on Enter key
          handleContentSearch();
        } else if (searchMode === 'content' && contentSearchActive && searchResults.length > 0) {
          // Open the first search result
          const firstResult = searchResults[0];
          handleSearchResultClick(firstResult.file, firstResult.matches[0]);
        }
      }
      
      // Alt+F to toggle search mode (changed from Ctrl+F)
      if (e.altKey && e.key.toLowerCase() === 'f' && isSearchOpen) {
        e.preventDefault();
        toggleSearchMode();
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isSearchOpen, searchTerm, fileStructure, searchMode, contentSearchActive, searchResults]);

  return (
    <div
      className={`LeftSidebar ${theme} ${isCollapsed ? 'collapsed' : ''}`}
      style={{ width: isCollapsed ? '50px' : `${sidebarWidth}px` }}
      ref={sidebarRef}
    >
      <div className="TopButtons">
        <button className="IconButton" title="Search files" onClick={toggleSearch}>
          <Search size={18} />
        </button>
        <button className="IconButton" title="Settings">
          <Settings size={18} />
        </button>
        <div className="AddFileButton" ref={addMenuRef}>
      <button
            className="IconButton" 
            title="Add file or folder"
            id='Addbuttonfiles'
            onClick={() => setAddMenuVisible(!addMenuVisible)}
      >
        <Plus size={18} />
      </button>
          
          {addMenuVisible && (
            <div className="AddMenu">
              <button 
                className="AddMenuItem" 
                onClick={() => {
                  setAddMenuVisible(false);
                  setSelectedParentFolder(null);
                  setIsDialogOpen(true);
                }}
              >
                <FilePlus size={16} />
                <span>New File</span>
              </button>
              <button 
                className="AddMenuItem" 
                onClick={() => {
                  setAddMenuVisible(false);
                  setSelectedParentFolder(null);
                  setIsDialogOpen(true);
                }}
              >
                <FolderPlus size={16} />
                <span>New Folder</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* File Tree */}
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
            <p className="EmptyMessage">Wow, such empty. Start by selecting the files.</p>
          </div>
        )
      )}

      <button
        className="CollapseButton"
        title="Collapse Sidebar"
        onClick={() => setIsCollapsed((prev) => !prev)}
      >
        {isCollapsed ? <ChevronRight size={24} /> : <ChevronLeft size={24} />}
      </button>

      {isDialogOpen && (
        <CreateItemDialog
          onClose={() => {
            setIsDialogOpen(false);
            setSelectedParentFolder(null);
          }}
          onCreate={(type, name) => handleAddItem(type, name, selectedParentFolder)}
          theme={theme}
          parentFolderName={selectedParentFolder ? 
            selectedParentFolder.split('/').pop() : 
            'workspace'
          }
        />
      )}

      {/* Workspace Selection Section */}
      {!isCollapsed && (
        <div className="WorkspaceSelection">
          <button className="OpenDirectoryButton" onClick={openDirectory}>
            {workspacePath ? 'Switch Workspace' : 'Open Workspace'}
          </button>
          {workspacePath && (
            <div className="CurrentWorkspace" title={workspacePath}>
              {workspacePath.split('/').pop()}
            </div>
          )}
        </div>
      )}

      {/* Spotlight Search */}
      {isSearchOpen && (
        <div className={`SpotlightOverlay ${theme}`} onClick={() => setIsSearchOpen(false)}>
          <div className={`SpotlightSearch ${theme}`} onClick={(e) => e.stopPropagation()}>
            <div className={`SpotlightSearchHeader ${theme}`}>
              <Search size={18} className="SpotlightSearchIcon" />
              <input
                type="text"
                placeholder={searchMode === 'filename' ? "Search files..." : "Search in file contents..."}
                value={searchTerm}
                onChange={handleSearchChange}
                className={`SpotlightSearchInput ${theme}`}
                ref={searchInputRef}
              />
              <button 
                className={`SpotlightModeToggle ${theme} ${searchMode === 'content' ? 'active' : ''}`}
                onClick={toggleSearchMode}
                title={searchMode === 'filename' ? "Switch to content search" : "Switch to filename search"}
              >
                {searchMode === 'filename' ? 'Aa' : 'Aa'}
              </button>
              <button className={`SpotlightCloseButton ${theme}`} onClick={() => setIsSearchOpen(false)}>
                <X size={16} />
              </button>
            </div>
            
            {/* Search loading indicator */}
            {searchMode === 'content' && isSearching && (
              <div className={`SearchLoadingIndicator ${theme}`}>
                <Loader size={18} className="Spinner" />
                <span>Searching in files...</span>
              </div>
            )}
            
            {/* Keyboard shortcut hint */}
            {searchTerm === '' && (
              <div className={`SpotlightHint ${theme}`}>
                <span>Press <kbd>Alt+F</kbd> to {searchMode === 'filename' ? 'search in content' : 'search filenames'}</span>
              </div>
            )}
            
            {/* Content search results */}
            {searchMode === 'content' && contentSearchActive && searchTerm && (
              <div className={`SpotlightResults ${theme}`}>
                {searchResults.length > 0 ? (
                  <div className={`ContentSearchResults ${theme}`}>
                    <div className={`ResultsCount ${theme}`}>
                      Found {searchResults.reduce((acc, result) => acc + result.matches.length, 0)} matches in {searchResults.length} files
                    </div>
                    {searchResults.map((result) => (
                      <div key={result.file.id} className={`ContentResultFile ${theme}`}>
                        <div className={`ContentResultFileName ${theme}`}>
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
                              <div className="LineNumber">{match.line}</div>
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
                  !isSearching && <div className={`SpotlightNoResults ${theme}`}>No matches found in file contents</div>
                )}
              </div>
            )}
            
            {/* Filename search results */}
            {(searchMode === 'filename' || !contentSearchActive) && searchTerm && (
              <div className={`SpotlightResults ${theme}`}>
                {filterStructure(fileStructure, searchTerm).length > 0 ? (
                  filterStructure(fileStructure, searchTerm).map((item) => (
                    <div 
                      key={item.id} 
                      className={`SpotlightResultItem ${theme}`}
                      onClick={() => {
                        handleItemClick(item);
                        setIsSearchOpen(false);
                        setSearchTerm('');
                      }}
                    >
                      {getFileIcon(item)}
                      <span>{item.name}</span>
                    </div>
                  ))
                ) : (
                  <div className={`SpotlightNoResults ${theme}`}>No files found</div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Resizer */}
      <div className={`Resizer ${isResizing ? 'active' : ''}`} ref={resizerRef} />
    </div>
  );
};

// Helper function for spotlight search
const getFileIcon = (item) => {
  if (item.type === 'folder') return <Folder size={16} />;
  
  const extension = item.name.split('.').pop().toLowerCase();
  
  switch (extension) {
    case 'js':
    case 'jsx':
    case 'ts':
    case 'tsx':
      return <FileCode size={16} />;
    case 'md':
    case 'txt':
      return <FileBox size={16} />;
    default:
      return <FileText size={16} />;
  }
};

export default LeftSidebar;
