import React, { useState, useRef, memo } from 'react';
import { X, Send } from 'lucide-react';
// Ensure CSS for YouTubeHelperUI is imported if styles are specific and not all in Editor.css
// import '../css/YouTubeHelperUI.css'; // If you create a separate CSS file for it

/**
 * YouTube Helper UI Component
 * Allows users to analyze YouTube videos or extract code from them
 */
const YouTubeHelperUI = ({ info, onCancel, onSubmit, theme, onLinkChange, onPromptChange, style }) => {
    const [localLink, setLocalLink] = useState(info.link || '');
    const [localPrompt, setLocalPrompt] = useState(info.customPrompt || '');
    const linkInputRef = useRef(null);

    const handleLinkChange = (e) => {
        const newLink = e.target.value;
        setLocalLink(newLink);
        onLinkChange(newLink);
    };

    const handlePromptChange = (e) => {
        const newPrompt = e.target.value;
        setLocalPrompt(newPrompt);
        onPromptChange(newPrompt);
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        onSubmit();
    };

    return (
        <div className={`YoutubeHelperUI ${theme === 'dark' ? 'dark' : ''} ${info.isProcessing ? 'processing' : ''}`} style={style}>
            <div className="HelperHeader">
                <span>{info.mode === 'analyzer' ? 'YouTube Video Analysis' : 'Extract Code from YouTube'}</span>
                <button className="CloseButton" onClick={onCancel} disabled={info.isProcessing}>
                    <X size={14} />
                </button>
            </div>
            <form onSubmit={handleSubmit}>
                <div className="HelperInputContainer">
                    <input
                        ref={linkInputRef}
                        type="text"
                        value={localLink}
                        onChange={handleLinkChange}
                        placeholder="Enter YouTube video URL..."
                        className="HelperInput"
                        disabled={info.isProcessing}
                    />
                    {info.mode === 'analyzer' && (
                        <textarea
                            value={localPrompt}
                            onChange={handlePromptChange}
                            placeholder="Custom analysis instructions (optional)..."
                            className="HelperTextarea HelperInput"
                            disabled={info.isProcessing}
                        />
                    )}
                    <button
                        type="submit"
                        className="SubmitButton"
                        disabled={info.isProcessing || !localLink.trim()}
                    >
                        {info.isProcessing ? (
                            <span className="ProcessingIndicator"></span>
                        ) : (
                            <Send size={16} />
                        )}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default memo(YouTubeHelperUI); 