import React from 'react';
import { X } from 'lucide-react';
import '../css/SettingsPanel.css'; // We'll create this CSS file next

const SettingsPanel = ({ 
  isOpen, 
  onClose, 
  theme, 
  editorFontFamily, 
  setEditorFontFamily, 
  editorFontSize, 
  setEditorFontSize,
  geminiApiKey,
  setGeminiApiKey,
  llamaApiKey,
  setLlamaApiKey
}) => {
  if (!isOpen) {
    return null;
  }

  // List of available fonts (add more as needed)
  const availableFonts = [
    'JetBrains Mono',
    'Georgia',
    'Arial',
    'Verdana',
    'Courier New',
    'Times New Roman'
  ];

  return (
    <div className={`SettingsOverlay ${theme}`} onClick={onClose}>
      <div className={`SettingsPanel ${theme}`} onClick={(e) => e.stopPropagation()}>
        <div className="SettingsHeader">
          <h2>Settings</h2>
          <button onClick={onClose} className="CloseButton">
            <X size={20} />
          </button>
        </div>
        
        <div className="SettingsContent">
          {/* Editor Font Settings */}
          <div className="SettingSection">
            <h3>Editor Appearance</h3>
            <div className="SettingItem">
              <label htmlFor="editor-font-family">Font Family:</label>
              <select 
                id="editor-font-family"
                value={editorFontFamily}
                onChange={(e) => setEditorFontFamily(e.target.value)}
              >
                {availableFonts.map(font => (
                  <option key={font} value={font}>{font}</option>
                ))}
              </select>
            </div>
            <div className="SettingItem">
              <label htmlFor="editor-font-size">Font Size (px):</label>
              <input 
                type="number"
                id="editor-font-size"
                value={editorFontSize}
                onChange={(e) => setEditorFontSize(parseInt(e.target.value, 10) || 14)} // Default to 14 if parsing fails
                min="10"
                max="30"
              />
            </div>
          </div>

          {/* API Keys Section */}
          <div className="SettingSection">
            <h3>API Keys</h3>
            <div className="SettingItem">
              <label htmlFor="gemini-api-key">Gemini API Key:</label>
              <input 
                type="password"
                id="gemini-api-key"
                value={geminiApiKey}
                onChange={(e) => setGeminiApiKey(e.target.value)}
                placeholder="Enter your Gemini API key"
                className="ApiKeyInput"
              />
            </div>
            <div className="SettingItem">
              <label htmlFor="llama-api-key">Llama API Key:</label>
              <input 
                type="password"
                id="llama-api-key"
                value={llamaApiKey}
                onChange={(e) => setLlamaApiKey(e.target.value)}
                placeholder="Enter your Llama API key"
                className="ApiKeyInput"
              />
            </div>
            <p className="ApiKeyHelp">
              API keys are stored locally and are used to access AI services.
            </p>
          </div>

          {/* Placeholder for Global Settings */}
          {/* 
          <div className="SettingSection">
            <h3>Global Appearance</h3>
            <p>(Global settings coming soon)</p>
          </div>
          */}
        </div>
      </div>
    </div>
  );
};

export default SettingsPanel; 