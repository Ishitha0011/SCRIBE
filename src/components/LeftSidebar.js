import React, { useState } from 'react';
import {
  Search,
  Settings,
  Plus,
  Folder,
  FileText,
  MoreVertical,
  Edit,
  Trash2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'; // Import Chevron icons for collapsing
import '../css/LeftSidebar.css';

const LeftSidebar = () => {
  const [structure, setStructure] = useState([
    {
      id: 1,
      name: 'Project Notes',
      type: 'folder',
      children: [
        { id: 2, name: 'README.md', type: 'file' },
        { id: 3, name: 'Ideas.md', type: 'file' },
      ],
    },
  ]);
  const [activeItem, setActiveItem] = useState(null);
  const [menuVisible, setMenuVisible] = useState(null);
  const [isCollapsed, setIsCollapsed] = useState(false); // New state for collapse

  // Add a new file or folder
  const handleAdd = (type) => {
    const newItem = {
      id: Date.now(),
      name: type === 'folder' ? 'New Folder' : 'New File',
      type,
      children: type === 'folder' ? [] : undefined,
    };
    setStructure([...structure, newItem]);
  };

  // Delete an item
  const handleDelete = (id) => {
    const deleteItem = (items) =>
      items.filter((item) => {
        if (item.children) item.children = deleteItem(item.children);
        return item.id !== id;
      });

    setStructure(deleteItem(structure));
    setMenuVisible(null); // Close menu after deletion
  };

  // Edit an item
  const handleEdit = (id, newName) => {
    const editItem = (items) =>
      items.map((item) => {
        if (item.id === id) item.name = newName;
        if (item.children) item.children = editItem(item.children);
        return item;
      });

    setStructure(editItem(structure));
  };

  // Render the folder and file structure
  const renderTree = (items) =>
    items.map((item) => (
      <div key={item.id} className="TreeNode">
        <div
          className={`TreeNodeItem ${activeItem === item.id ? 'active' : ''}`}
          onClick={() => setActiveItem(item.id)}
        >
          {item.type === 'folder' ? <Folder size={16} /> : <FileText size={16} />}
          <span>{item.name}</span>
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
              <div className="DropdownMenu">
                <button
                  className="DropdownItem"
                  onClick={() => {
                    const newName = prompt('Rename to:', item.name);
                    if (newName) handleEdit(item.id, newName);
                    setMenuVisible(null); // Close menu
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
        {item.type === 'folder' && item.children && (
          <div className="TreeNodeChildren">{renderTree(item.children)}</div>
        )}
      </div>
    ));

  return (
    <div className={`LeftSidebar ${isCollapsed ? 'collapsed' : ''}`}>
      <div className="TopButtons">
        <button className="IconButton" title="Search">
          <Search size={18} />
        </button>
        <button className="IconButton" title="Settings">
          <Settings size={18} />
        </button>
        <button
          className="IconButton"
          title="Add"
          onClick={() => handleAdd('folder')}
        >
          <Plus size={18} />
        </button>
      </div>
      {!isCollapsed && <div className="FileTree">{renderTree(structure)}</div>}
      <button
        className="CollapseButton"
        title="Collapse Sidebar"
        onClick={() => setIsCollapsed((prev) => !prev)}
      >
        {isCollapsed ? <ChevronRight size={24} /> : <ChevronLeft size={24} />}
      </button>
    </div>
  );
};

export default LeftSidebar;
