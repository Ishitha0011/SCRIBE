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
  const [selectedFile, setSelectedFile] = useState(null);
  const fileInputRef = useRef(null);

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

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messageContainerRef.current && autoScroll) {
      messageContainerRef.current.scrollTop = messageContainerRef.current.scrollHeight;
    }
  }, [chatHistory, autoScroll]);

  // Handle scroll to detect if user has scrolled up
  const handleScroll = () => {
    if (messageContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = messageContainerRef.current;
      const isAtBottom = scrollTop + clientHeight >= scrollHeight - 10;
      setAutoScroll(isAtBottom);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (message.trim() || selectedFile) {
      let finalMessage = message;
      
      if (selectedFile) {
        // In a real implementation, you'd process the file here
        finalMessage = `[File: ${selectedFile.name}] ${message}`;
      }
      
      onSendMessage(finalMessage);
      setMessage('');
      setSelectedFile(null);
      setAutoScroll(true);
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
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  if (!isOpen) return null;

  return (
    <div className={`ChatPopupOverlay ${theme}`} onClick={onClose}>
      <div 
        className={`ChatPopupContainer ${theme}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`ChatPopupHeader ${theme}`}>
          <h3>{chatTitle}</h3>
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
        </div>
        
        {!autoScroll && (
          <button className="ScrollToBottomButton" onClick={scrollToBottom}>
            <ChevronDown size={20} />
          </button>
        )}
        
        <form className={`ChatPopupInput ${theme}`} onSubmit={handleSubmit}>
          {selectedFile && (
            <div className="SelectedFileTag">
              {selectedFile.name}
              <button 
                type="button" 
                onClick={() => setSelectedFile(null)}
                className="RemoveFileButton"
              >
                <X size={14} />
              </button>
            </div>
          )}
          <textarea
            ref={inputRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your message..."
            rows={1}
          />
          <button 
            type="button" 
            className="FileButton"
            onClick={handleFileButtonClick}
            title="Attach file"
          >
            <Paperclip size={18} />
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />
          </button>
          <button 
            type="submit" 
            className="SendButton"
            disabled={!message.trim() && !selectedFile}
          >
            <Send size={20} />
          </button>
        </form>
      </div>
    </div>
  );
};

export default ChatPopup; 