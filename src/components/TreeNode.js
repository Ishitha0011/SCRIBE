import React, { useRef, useEffect } from 'react';
import {
  ChevronRight,
  ChevronDown,
  Folder,
  FileText,
  FileCode,
  FileBox,
  FileJson,
  ImageIcon,
  MoreVertical,
  Edit,
  Trash2,
  Plus,
} from 'lucide-react';
import '../css/TreeNode.css';

const TreeNode = ({
  item,
  level = 0,
  activeItem,
  collapsedFolders,
  menuVisible,
  onItemClick,
  onToggleFolder,
  onMenuToggle,
  onEdit,
  onDelete,
  onAddItem,
  editMode,
  newName,
  onNewNameChange,
  onRename,
  onKeyDown,
}) => {
  const inputRef = useRef(null);
  const menuRef = useRef(null);
  
  // Focus input when edit mode is activated
  useEffect(() => {
    if (editMode === item.id && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editMode, item.id]);

  // Click outside handler for dropdown menu
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        onMenuToggle(null);
      }
    };

    if (menuVisible === item.id) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [menuVisible, item.id, onMenuToggle]);

  // Determine file icon based on file extension
  const getFileIcon = () => {
    if (item.type !== 'file') return <Folder size={16} />;
    
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
      case 'json':
        return <FileJson size={16} />;
      case 'jpg':
      case 'jpeg':
      case 'png':
      case 'gif':
      case 'svg':
        return <ImageIcon size={16} />;
      default:
        return <FileText size={16} />;
    }
  };

  return (
    <div className="TreeNode">
      <div 
        className={`TreeNodeRow ${activeItem === item.id ? 'active' : ''}`}
        style={{ paddingLeft: `${level * 16}px` }}
        onClick={() => onItemClick(item)}
      >
        <div className="TreeNodeLabel">
          {item.type === 'folder' && (
            <button
              className="FolderToggle"
              onClick={(e) => {
                e.stopPropagation();
                onToggleFolder(item.id);
              }}
            >
              {collapsedFolders[item.id] ? (
                <ChevronRight size={16} />
              ) : (
                <ChevronDown size={16} />
              )}
            </button>
          )}
          
          <span className="TreeNodeIcon">{getFileIcon()}</span>
          
          {editMode === item.id ? (
            <input
              ref={inputRef}
              className="RenameInput"
              value={newName}
              onChange={(e) => onNewNameChange(e.target.value)}
              onKeyDown={(e) => onKeyDown(e, item.id)}
              onBlur={() => onRename(item.id)}
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span className="TreeNodeName">{item.name}</span>
          )}
        </div>
        
        <div className="TreeNodeActions">
          {item.type === 'folder' && (
            <button
              className="IconButton AddItemToFolder"
              title="Create in this folder"
              onClick={(e) => {
                e.stopPropagation();
                onAddItem(item.id);
              }}
            >
              <Plus size={14} />
            </button>
          )}
          
          <button
            className="IconButton"
            onClick={(e) => {
              e.stopPropagation();
              onMenuToggle(menuVisible === item.id ? null : item.id);
            }}
          >
            <MoreVertical size={16} />
          </button>
          
          {menuVisible === item.id && (
            <div ref={menuRef} className="DropdownMenu">
              <button
                className="DropdownItem"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(item.id, item.name);
                }}
              >
                <Edit size={14} /> Rename
              </button>
              <button
                className="DropdownItem delete"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(item.id);
                }}
              >
                <Trash2 size={14} /> Delete
              </button>
            </div>
          )}
        </div>
      </div>
      
      {item.type === 'folder' && item.children && !collapsedFolders[item.id] && (
        <div className="TreeNodeChildren">
          {item.children.map((childItem) => (
            <TreeNode
              key={childItem.id}
              item={childItem}
              level={level + 1}
              activeItem={activeItem}
              collapsedFolders={collapsedFolders}
              menuVisible={menuVisible}
              onItemClick={onItemClick}
              onToggleFolder={onToggleFolder}
              onMenuToggle={onMenuToggle}
              onEdit={onEdit}
              onDelete={onDelete}
              onAddItem={onAddItem}
              editMode={editMode}
              newName={newName}
              onNewNameChange={onNewNameChange}
              onRename={onRename}
              onKeyDown={onKeyDown}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default TreeNode; 