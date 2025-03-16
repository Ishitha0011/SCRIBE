import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Send, 
  Copy, 
  Trash2, 
  Check,
  ChevronDown,
  Paperclip
} from 'lucide-react';
import '../css/ChatPopup.css';
import { useTheme } from '../ThemeContext';

const ChatPopup = ({ 
  isOpen, 
  onClose, 
  chatHistory, 
  focusedMessageId,
  onSendMessage,
  onDeleteMessage,
  chatTitle = "Conversation" // Default title if none provided
}) => {
  const [message, setMessage] = useState('');
  const messageContainerRef = useRef(null);
  const inputRef = useRef(null);
  const focusedMessageRef = useRef(null);
  const [copySuccess, setCopySuccess] = useState(null);
  const { theme } = useTheme();
  const [autoScroll, setAutoScroll] = useState(true);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const fileInputRef = useRef(null);
  // Add state to track current title for display
  const [displayTitle, setDisplayTitle] = useState(chatTitle);
  // Add a dedicated ref for scrolling to the end of messages
  const messagesEndRef = useRef(null);

  // Update display title when chatTitle prop changes
  useEffect(() => {
    setDisplayTitle(chatTitle);
  }, [chatTitle]);

  // Focus input when popup opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => {
        inputRef.current.focus();
      }, 100);
    }
  }, [isOpen]);

  // Scroll to focused message
  useEffect(() => {
    if (focusedMessageRef.current) {
      focusedMessageRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });
      
      // Add highlight effect
      focusedMessageRef.current.classList.add('highlight');
      setTimeout(() => {
        if (focusedMessageRef.current) {
          focusedMessageRef.current.classList.remove('highlight');
        }
      }, 2000);
    }
  }, [focusedMessageId, isOpen]);

  // Improve the auto-scroll behavior to ensure it always scrolls to new messages
  useEffect(() => {
    // Always scroll to the latest message when new messages arrive
    if (messageContainerRef.current && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
      setAutoScroll(true); // Reset auto-scroll to true when new messages come in
    }
  }, [chatHistory]);

  // Handle scroll to detect if user has scrolled up
  const handleScroll = () => {
    if (messageContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = messageContainerRef.current;
      const isAtBottom = scrollTop + clientHeight >= scrollHeight - 10;
      setAutoScroll(isAtBottom);
    }
  };

  const handleSubmit = (e) => {
    if (e) e.preventDefault();
    
    if (message.trim() || selectedFiles.length > 0) {
      let finalMessage = message;
      
      // Update for multiple files
      if (selectedFiles.length > 0) {
        const fileNames = selectedFiles.map(file => file.name).join(', ');
        finalMessage = `[Files: ${fileNames}] ${message}`;
      }
      
      onSendMessage(finalMessage);
      setMessage('');
      setSelectedFiles([]);
      
      // Ensure we scroll to the bottom after sending a message
      setTimeout(() => {
        if (messagesEndRef.current) {
          messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
      }, 100);
      
      if (inputRef.current) {
        inputRef.current.focus();
      }
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(
      () => {
        setCopySuccess(text);
        setTimeout(() => setCopySuccess(null), 2000);
      },
      () => {
        console.error('Could not copy text');
      }
    );
  };

  // Scroll to bottom button
  const scrollToBottom = () => {
    if (messageContainerRef.current) {
      messageContainerRef.current.scrollTop = messageContainerRef.current.scrollHeight;
      setAutoScroll(true);
    }
  };

  // File handling
  const handleFileButtonClick = () => {
    fileInputRef.current.click();
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      // Add new files to existing files
      const newFiles = Array.from(e.target.files);
      setSelectedFiles(prev => [...prev, ...newFiles]);
    }
  };

  const removeSelectedFile = (index) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  if (!isOpen) return null;

  return (
    <div className={`ChatPopupOverlay ${theme}`} onClick={onClose}>
      <div 
        className={`ChatPopupContainer ${theme}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`ChatPopupHeader ${theme}`}>
          <h3>{displayTitle}</h3>
          <button className="CloseButton" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        
        <div 
          className="ChatPopupMessages" 
          ref={messageContainerRef}
          onScroll={handleScroll}
        >
          {chatHistory.map((msg) => (
            <div 
              key={msg.id} 
              className={`ChatMessage ${msg.sender === 'user' ? 'UserMessage' : 'AIMessage'}`}
              ref={msg.id === focusedMessageId ? focusedMessageRef : null}
            >
              <div className="MessageHeader">
                <div className="MessageSender">
                  {msg.sender === 'user' ? 'You' : 'AI Assistant'}
                </div>
                <div className="MessageActions">
                  <button 
                    className="MessageActionButton" 
                    onClick={() => copyToClipboard(msg.content)}
                    title="Copy message"
                  >
                    {copySuccess === msg.content ? <Check size={16} /> : <Copy size={16} />}
                  </button>
                  
                  <button 
                    className="MessageActionButton" 
                    onClick={() => onDeleteMessage(msg.id)}
                    title="Delete message"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
              <div className="MessageContent">
                {msg.content}
              </div>
            </div>
          ))}
          {/* Add div for automatic scrolling to latest message */}
          <div ref={messagesEndRef} />
        </div>
        
        {!autoScroll && (
          <button className="ScrollToBottomButton" onClick={scrollToBottom}>
            <ChevronDown size={20} />
          </button>
        )}
        
        <div className="ChatPopupInput">
          {/* Files display */}
          {selectedFiles.length > 0 && (
            <div className="SelectedFilesContainer">
              {selectedFiles.slice(0, 5).map((file, index) => (
                <div key={index} className="SelectedFileTag">
                  <span className="FileTagName">{file.name}</span>
                  <button 
                    type="button" 
                    onClick={() => removeSelectedFile(index)}
                    className="RemoveFileButton"
                    aria-label={`Remove ${file.name}`}
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
              {selectedFiles.length > 5 && (
                <div className="MoreFilesIndicator">
                  +{selectedFiles.length - 5} more
                </div>
              )}
            </div>
          )}
          <div className="InputWrapper">
            <button 
              className="FileButton"
              onClick={handleFileButtonClick}
              title="Attach file"
            >
              <Paperclip size={16} />
            </button>
            <textarea
              ref={inputRef}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your message..."
            />
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              style={{ display: 'none' }}
              multiple
            />
            <button
              className="SendButton"
              onClick={handleSubmit}
              disabled={!message.trim() && selectedFiles.length === 0}
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatPopup; 