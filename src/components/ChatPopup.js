import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Send, 
  Copy, 
  Trash2, 
  Check
} from 'lucide-react';
import '../css/ChatPopup.css';
import { useTheme } from '../ThemeContext';

const ChatPopup = ({ 
  isOpen, 
  onClose, 
  chatHistory, 
  focusedMessageId,
  onSendMessage,
  onDeleteMessage
}) => {
  const [message, setMessage] = useState('');
  const messageContainerRef = useRef(null);
  const inputRef = useRef(null);
  const focusedMessageRef = useRef(null);
  const [copySuccess, setCopySuccess] = useState(null);
  const { theme } = useTheme();

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
    if (messageContainerRef.current) {
      messageContainerRef.current.scrollTop = messageContainerRef.current.scrollHeight;
    }
  }, [chatHistory]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (message.trim()) {
      onSendMessage(message);
      setMessage('');
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

  if (!isOpen) return null;

  return (
    <div className={`ChatPopupOverlay ${theme}`} onClick={onClose}>
      <div 
        className={`ChatPopupContainer ${theme}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`ChatPopupHeader ${theme}`}>
          <h3>Conversation</h3>
          <button className="CloseButton" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        
        <div className="ChatPopupMessages" ref={messageContainerRef}>
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
                  
                  {msg.sender === 'user' && (
                    <button 
                      className="MessageActionButton" 
                      onClick={() => onDeleteMessage(msg.id)}
                      title="Delete message"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>
              <div className="MessageContent">
                {msg.content}
              </div>
            </div>
          ))}
        </div>
        
        <form className={`ChatPopupInput ${theme}`} onSubmit={handleSubmit}>
          <textarea
            ref={inputRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your message..."
            rows={3}
          />
          <button 
            type="submit" 
            className="SendButton"
            disabled={!message.trim()}
          >
            <Send size={20} />
          </button>
        </form>
      </div>
    </div>
  );
};

export default ChatPopup; 