import React, { useState } from 'react';
import '../css/CreateItemDialog.css';

const CreateItemDialog = ({ onClose, onCreate, theme }) => {
  const [newItemType, setNewItemType] = useState('folder');
  const [newItemName, setNewItemName] = useState('');

  const handleCreate = () => {
    if (newItemName.trim() === '') {
      alert('Please enter a name.');
      return;
    }
    onCreate(newItemType, newItemName);
    onClose();
  };

  return (
    <div className={`DialogOverlay ${theme}`}>
      <div className={`DialogContent ${theme}`}>
        <div className="DialogHeader">
          <h2>Create New</h2>
        </div>
        <div className="DialogBody">
          <div className="HorizontalGroup">
            <select
              value={newItemType}
              onChange={(e) => setNewItemType(e.target.value)}
              className="Dropdown"
            >
              <option value="folder">Folder</option>
              <option value="file">File</option>
            </select>
            <input
              type="text"
              placeholder="Enter name"
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              className="Input"
            />
          </div>
        </div>
        <div className="DialogFooter">
          <button className="Button CancelButton" onClick={onClose}>
            Cancel
          </button>
          <button className="Button CreateButton" onClick={handleCreate}>
            Create
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreateItemDialog;
