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
} from 'lucide-react';
import '../css/LeftSidebar.css';
import { useTheme } from '../ThemeContext';
import CreateItemDialog from './CreateItemDialog';

const LeftSidebar = () => {
  const [structure, setStructure] = useState([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [activeItem, setActiveItem] = useState(null);
  const [menuVisible, setMenuVisible] = useState(null);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [editMode, setEditMode] = useState(null);
  const [newName, setNewName] = useState('');
  const [directoryChosen, setDirectoryChosen] = useState(false);
  const [collapsedFolders, setCollapsedFolders] = useState({});
  const [sidebarWidth, setSidebarWidth] = useState(250);
  const [isResizing, setIsResizing] = useState(false);

  // Use theme from context
  const { theme } = useTheme();

  const menuRef = useRef(null);
  const sidebarRef = useRef(null);
  const resizerRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuVisible(null);
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

    resizerRef.current.addEventListener('mousedown', handleMouseDown);

    return () => {
      resizerRef.current.removeEventListener('mousedown', handleMouseDown);
    };
  }, [isResizing]);

  const openDirectory = async () => {
    try {
      const directoryHandle = await window.showDirectoryPicker();
      const directoryStructure = await readDirectory(directoryHandle);
      setStructure(directoryStructure);
      setDirectoryChosen(true);
    } catch (error) {
      console.error('Error opening directory:', error);
    }
  };

  const readDirectory = async (directoryHandle) => {
    const items = [];
    for await (const entry of directoryHandle.values()) {
      if (entry.kind === 'directory') {
        items.push({
          id: entry.name,
          name: entry.name,
          type: 'folder',
          children: await readDirectory(entry),
        });
      } else {
        items.push({
          id: entry.name,
          name: entry.name,
          type: 'file',
        });
      }
    }
    return items;
  };

  const handleDelete = (id) => {
    const deleteItem = (items) =>
      items.filter((item) => {
        if (item.children) item.children = deleteItem(item.children);
        return item.id !== id;
      });

    setStructure(deleteItem(structure));
    setMenuVisible(null);
  };

  const handleEdit = (id, newName) => {
    const editItem = (items) =>
      items.map((item) => {
        if (item.id === id) item.name = newName;
        if (item.children) item.children = editItem(item.children);
        return item;
      });

    setStructure(editItem(structure));
    setEditMode(null);
    setNewName('');
  };

  const handleAddItem = (type, name) => {
    const newItem = {
      id: Date.now(),
      name,
      type,
      children: type === 'folder' ? [] : undefined,
    };
    setStructure([...structure, newItem]);
  };

  const toggleFolder = (id) => {
    setCollapsedFolders((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const renderTree = (items) =>
    items.map((item) => (
      <div key={item.id} className="TreeNode">
        <div
          className={`TreeNodeItem ${activeItem === item.id ? 'active' : ''}`}
          onClick={() => setActiveItem(item.id)}
        >
          {item.type === 'folder' ? (
            <>
              <button
                className="IconButton"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleFolder(item.id);
                }}
              >
                {collapsedFolders[item.id] ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
              </button>
            </>
          ) : null}

          {editMode === item.id ? (
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onBlur={() => handleEdit(item.id, newName)}
              autoFocus
              className="editable-name"
            />
          ) : (
            <span className="TreeNodeName">{item.name}</span>
          )}

          <div className="TreeNodeActions">
            <button
              className="IconButton"
              onClick={(e) => {
                e.stopPropagation();
                setMenuVisible(menuVisible === item.id ? null : item.id);
              }}
            >
              <MoreVertical size={16} />
            </button>
            {menuVisible === item.id && (
              <div ref={menuRef} className="DropdownMenu">
                <button
                  className="DropdownItem"
                  onClick={() => {
                    setEditMode(item.id);
                    setNewName(item.name);
                  }}
                >
                  <Edit size={14} /> Rename
                </button>
                <button
                  className="DropdownItem delete"
                  onClick={() => handleDelete(item.id)}
                >
                  <Trash2 size={14} /> Delete
                </button>
              </div>
            )}
          </div>
        </div>
        {item.type === 'folder' && item.children && !collapsedFolders[item.id] && (
          <div className="TreeNodeChildren">{renderTree(item.children)}</div>
        )}
      </div>
    ));

  return (
    <div
      className={`LeftSidebar ${theme} ${isCollapsed ? 'collapsed' : ''}`}
      style={{ width: isCollapsed ? '50px' : `${sidebarWidth}px` }}
      ref={sidebarRef}
    >
      <div className="TopButtons">
        <button className="IconButton" title="Search">
          <Search size={18} />
        </button>
        <button className="IconButton" title="Settings">
          <Settings size={18} />
        </button>
      </div>

      {/* Plus Button */}
      <button
        className="IconButton PlusButton"
        title="Add"
        onClick={() => setIsDialogOpen(true)}
      >
        <Plus size={18} />
      </button>

      {/* File Tree */}
      {!isCollapsed && directoryChosen && structure.length > 0 ? (
        <div className="FileTree">{renderTree(structure)}</div>
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
          onClose={() => setIsDialogOpen(false)}
          onCreate={handleAddItem}
        />
      )}

      {/* Workspace Selection Section */}
      {!isCollapsed && (
        <div className="WorkspaceSelection">
          <button className="OpenDirectoryButton" onClick={openDirectory}>
            {directoryChosen ? 'Switch Workspaces' : 'Open Directory'}
          </button>
        </div>
      )}

      {/* Resizer */}
      <div className={`Resizer ${isResizing ? 'active' : ''}`} ref={resizerRef} />
    </div>
  );
};

export default LeftSidebar;
