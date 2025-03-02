import React, { useEffect, useState, useRef } from 'react';
import { Send, Plus, Clock, Copy, Trash2, Maximize2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { supabase } from '../supabaseClient';
import { v4 as uuidv4 } from 'uuid';
import '../css/AskAI.css';
import { useTheme } from '../ThemeContext';
import ChatPopup from './ChatPopup';

const AskAI = ({ messages, setMessages }) => {
  const { theme } = useTheme();
  const [userInput, setUserInput] = useState('');
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentTitle, setCurrentTitle] = useState('New Chat');
  const [showSessionList, setShowSessionList] = useState(false);
  const [copiedMessageId, setCopiedMessageId] = useState(null);
  const [hoveredMessageId, setHoveredMessageId] = useState(null);
  const [typingMessage, setTypingMessage] = useState({ index: null, text: '', fullText: '', isTyping: false });
  const typingSpeed = 15; // milliseconds per character
  const typingRef = useRef(null);
  
  // Add new state for popup chat
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [focusedMessageIndex, setFocusedMessageIndex] = useState(null);

  // Cleanup function for chat sessions
  const cleanupSession = async (sessionId) => {
    try {
      await fetch(`http://localhost:8000/clear-session/${sessionId}`, {
        method: 'DELETE'
      });
    } catch (error) {
      console.error('Error cleaning up session:', error);
    }
  };

  // Generate title after a few messages
  const generateTitle = async (messages) => {
    if (messages.length >= 2) { // Generate title after 2 messages
      try {
        console.log('Generating title for messages:', messages);
        
        // Format messages to match the backend's expected schema
        const formattedMessages = messages.map(msg => ({
          text: msg.text || '',
          sender: msg.sender || 'user',
          timestamp: msg.timestamp || new Date().toISOString()
        }));
        
        console.log('Formatted messages for title generation:', formattedMessages);
        
        const response = await fetch('http://localhost:8000/generate-title', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            session_id: currentSessionId || '',
            conversation_history: formattedMessages
          }),
        });

        if (!response.ok) {
          console.error(`Title generation failed with status: ${response.status}`);
          const errorText = await response.text();
          console.error(`Error details: ${errorText}`);
          return; // Exit early
        }

        const data = await response.json();
        console.log('Generated title:', data.title);
        
        if (data.title && data.title !== 'New Chat') {
          setCurrentTitle(data.title);
          
          // Update session title in Supabase
          const { error } = await supabase
            .from('chat_sessions')
            .update({ title: data.title })
            .eq('session_id', currentSessionId);
            
          if (error) {
            console.error('Error updating title in Supabase:', error);
          } else {
            // Immediately refresh sessions list to show new title
            await fetchSessions();
            console.log('Sessions list refreshed after title update');
          }
        }
      } catch (error) {
        console.error('Error generating title:', error);
      }
    }
  };

  // Initialize by just fetching existing sessions
  useEffect(() => {
    fetchSessions();

    // Add keyboard shortcut for chat history
    const handleKeyboardShortcut = async (e) => {
      // Alt+H to toggle chat history
      if (e.altKey && e.key === 'h') {
        // Refresh sessions list when opening the dropdown
        if (!showSessionList) {
          await fetchSessions();
        }
        setShowSessionList(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyboardShortcut);

    // Cleanup on unmount - only cleanup if there's an active session
    return () => {
      if (currentSessionId) {
        // Only cleanup if the session has no messages
        const hasMessages = messages.length > 0;
        if (!hasMessages) {
          cleanupSession(currentSessionId);
        }
      }
      window.removeEventListener('keydown', handleKeyboardShortcut);
    };
  }, [currentSessionId, messages, showSessionList]);

  // Fetch messages for current session
  useEffect(() => {
    const fetchMessages = async () => {
      if (!currentSessionId) return;

      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('session_id', currentSessionId)
        .order('timestamp', { ascending: true });

      if (error) {
        console.error('Error fetching messages:', error);
      } else {
        setMessages(data || []);
      }
    };

    fetchMessages();
  }, [currentSessionId, setMessages]);

  // Fetch all sessions
  const fetchSessions = async () => {
    const { data, error } = await supabase
      .from('chat_sessions')
      .select('*')
      .order('last_updated', { ascending: false });

    if (error) {
      console.error('Error fetching sessions:', error);
    } else {
      setSessions(data || []);
    }
  };

  // Create a new session
  const createNewSession = async () => {
    const sessionId = uuidv4();
    setCurrentSessionId(sessionId);
    
    await supabase.from('chat_sessions').insert([{
      session_id: sessionId,
      created_at: new Date().toISOString(),
      last_updated: new Date().toISOString(),
      title: 'New Chat'
    }]);

    return sessionId;
  };

  // Function to simulate typing effect
  const simulateTyping = (fullText, messageIndex) => {
    let currentCharIndex = 0;
    setTypingMessage({
      index: messageIndex,
      text: '',
      fullText: fullText,
      isTyping: true
    });
    
    // Clear any existing typing interval
    if (typingRef.current) {
      clearInterval(typingRef.current);
    }
    
    // Set up typing interval
    typingRef.current = setInterval(() => {
      if (currentCharIndex < fullText.length) {
        setTypingMessage(prev => ({
          ...prev,
          text: fullText.substring(0, currentCharIndex + 1)
        }));
        currentCharIndex++;
      } else {
        // Typing complete
        clearInterval(typingRef.current);
        setTypingMessage(prev => ({ ...prev, isTyping: false }));
      }
    }, typingSpeed);
  };
  
  // Clean up typing interval on unmount
  useEffect(() => {
    return () => {
      if (typingRef.current) {
        clearInterval(typingRef.current);
      }
    };
  }, []);

  const handleSubmit = async () => {
    if (!userInput.trim() || isSubmitting) return;

    setIsSubmitting(true);
    let newSessionId = null;  // Declare newSessionId at the start

    try {
      // Create new session if this is the first message
      if (!currentSessionId) {
        newSessionId = await createNewSession();
        setCurrentSessionId(newSessionId);
        
        // Immediately fetch sessions to update the history dropdown
        await fetchSessions();
      }

      const sessionId = currentSessionId || newSessionId;  // Use a consistent sessionId

      const newMessage = {
        text: userInput,
        sender: 'user',
        session_id: sessionId,
        timestamp: new Date().toISOString()
      };

      // Update messages optimistically
      const updatedMessages = [...messages, newMessage];
      setMessages(updatedMessages);
      
      // Store user message in Supabase
      await supabase.from('messages').insert([newMessage]);

      // Update session last_updated timestamp
      await supabase
        .from('chat_sessions')
        .update({ last_updated: new Date().toISOString() })
        .eq('session_id', sessionId);

      // Format messages for the backend
      const formattedMessages = updatedMessages.map(msg => ({
        text: msg.text,
        sender: msg.sender,
        timestamp: msg.timestamp
      }));

      // Get AI response
      const response = await fetch('http://localhost:8000/ask-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          question: userInput,
          session_id: sessionId,
          conversation_history: formattedMessages
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get AI response');
      }

      const data = await response.json();

      const aiMessage = {
        text: data.response,
        sender: 'ai',
        session_id: sessionId,
        timestamp: new Date().toISOString()
      };

      // Update messages with AI response
      const finalMessages = [...updatedMessages, aiMessage];
      setMessages(finalMessages);
      await supabase.from('messages').insert([aiMessage]);
      
      // Start typing effect for the AI message
      simulateTyping(data.response, finalMessages.length - 1);
      
      // Generate title after adding new messages
      await generateTitle(finalMessages);
      
      setUserInput('');
    } catch (error) {
      console.error('Error in chat interaction:', error);
      setMessages((prevMessages) => [
        ...prevMessages,
        {
          text: "I apologize, but I encountered an error. Please try again.",
          sender: 'ai',
          session_id: currentSessionId,
          timestamp: new Date().toISOString()
        }
      ]);
      
      if (currentSessionId) {
        await cleanupSession(currentSessionId);
      }
      setCurrentSessionId(null);
      setMessages([]);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNewChat = async () => {
    if (currentSessionId) {
      // Only cleanup if the session has no messages
      const hasMessages = messages.length > 0;
      if (!hasMessages) {
        await cleanupSession(currentSessionId);
      }
    }

    setCurrentSessionId(null);
    setMessages([]);
    setUserInput('');
    setCurrentTitle('New Chat');
    // Reset typing state when starting a new chat
    setTypingMessage({ index: null, text: '', fullText: '', isTyping: false });
    await fetchSessions();
  };

  const handleLoadSession = async (sessionId) => {
    setIsLoadingHistory(true);
    try {
      if (currentSessionId) {
        await cleanupSession(currentSessionId);
      }

      const { data: sessionData } = await supabase
        .from('chat_sessions')
        .select('title')
        .eq('session_id', sessionId)
        .single();

      const { data: messagesData, error } = await supabase
        .from('messages')
        .select('*')
        .eq('session_id', sessionId)
        .order('timestamp', { ascending: true });

      if (error) throw error;

      setCurrentSessionId(sessionId);
      setMessages(messagesData || []);
      setCurrentTitle(sessionData?.title || 'New Chat');
      setShowSessionList(false);
      
      // Reset typing state when loading a session
      setTypingMessage({ index: null, text: '', fullText: '', isTyping: false });
    } catch (error) {
      console.error('Error loading session:', error);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const copyToClipboard = (text, index) => {
    navigator.clipboard.writeText(text)
      .then(() => {
        console.log('Text copied to clipboard');
        setCopiedMessageId(index);
        setTimeout(() => {
          setCopiedMessageId(null);
        }, 2000); // Reset after 2 seconds
      })
      .catch(err => {
        console.error('Failed to copy text: ', err);
      });
  };

  const handleDeleteSession = async (sessionId, e) => {
    e.stopPropagation(); // Prevent triggering the session load
    try {
      // Delete messages first (due to foreign key constraint)
      await supabase
        .from('messages')
        .delete()
        .eq('session_id', sessionId);

      // Delete the session
      await supabase
        .from('chat_sessions')
        .delete()
        .eq('session_id', sessionId);

      // Clear current session if it's the one being deleted
      if (sessionId === currentSessionId) {
        setCurrentSessionId(null);
        setMessages([]);
        setCurrentTitle('New Chat');
      }

      // Cleanup backend session
      await cleanupSession(sessionId);

      // Refresh the sessions list
      await fetchSessions();
    } catch (error) {
      console.error('Error deleting session:', error);
    }
  };

  // Add function to delete individual messages
  const handleDeleteMessage = async (messageIndex, e) => {
    e.stopPropagation(); // Prevent any parent handlers from firing
    
    try {
      const messageToDelete = messages[messageIndex];
      
      // Delete from Supabase
      const { error } = await supabase
        .from('messages')
        .delete()
        .eq('session_id', messageToDelete.session_id)
        .eq('timestamp', messageToDelete.timestamp);
        
      if (error) throw error;
      
      // If this message is currently being typed, stop the typing effect
      if (typingMessage.index === messageIndex && typingMessage.isTyping) {
        if (typingRef.current) {
          clearInterval(typingRef.current);
        }
        setTypingMessage({ index: null, text: '', fullText: '', isTyping: false });
      }
      
      // Update local state by removing the message
      const updatedMessages = messages.filter((_, index) => index !== messageIndex);
      setMessages(updatedMessages);
      
      // If we deleted all messages, consider resetting the title
      if (updatedMessages.length === 0) {
        setCurrentTitle('New Chat');
        
        // Update session title in Supabase
        await supabase
          .from('chat_sessions')
          .update({ title: 'New Chat' })
          .eq('session_id', currentSessionId);
      }
      
      // Update session last_updated timestamp
      await supabase
        .from('chat_sessions')
        .update({ last_updated: new Date().toISOString() })
        .eq('session_id', currentSessionId);
        
    } catch (error) {
      console.error('Error deleting message:', error);
    }
  };

  // Function to handle expanding a message to a popup
  const handleExpandMessage = (messageIndex) => {
    setFocusedMessageIndex(messageIndex);
    setIsPopupOpen(true);
  };

  // Function to send a message from the popup
  const handlePopupSendMessage = (text) => {
    // Reuse the existing handleSubmit logic but with the provided text
    const sendNewMessage = async () => {
      try {
        let sessionId = currentSessionId;
        
        // Create new session if needed
        if (!sessionId) {
          sessionId = await createNewSession();
          setCurrentSessionId(sessionId);
          await fetchSessions();
        }

        const newMessage = {
          text: text,
          sender: 'user',
          session_id: sessionId,
          timestamp: new Date().toISOString()
        };

        // Update messages optimistically
        const updatedMessages = [...messages, newMessage];
        setMessages(updatedMessages);
        
        // Store user message in Supabase
        await supabase.from('messages').insert([newMessage]);

        // Update session last_updated timestamp
        await supabase
          .from('chat_sessions')
          .update({ last_updated: new Date().toISOString() })
          .eq('session_id', sessionId);

        // Format messages for the backend
        const formattedMessages = updatedMessages.map(msg => ({
          text: msg.text,
          sender: msg.sender,
          timestamp: msg.timestamp
        }));

        // Get AI response
        const response = await fetch('http://localhost:8000/ask-ai', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            question: text,
            session_id: sessionId,
            conversation_history: formattedMessages
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to get AI response');
        }

        const data = await response.json();

        const aiMessage = {
          text: data.response,
          sender: 'ai',
          session_id: sessionId,
          timestamp: new Date().toISOString()
        };

        // Update messages with AI response
        const finalMessages = [...updatedMessages, aiMessage];
        setMessages(finalMessages);
        await supabase.from('messages').insert([aiMessage]);
        
        // Start typing effect for the AI message
        simulateTyping(data.response, finalMessages.length - 1);
        
        // Generate title after adding new messages
        await generateTitle(finalMessages);
      } catch (error) {
        console.error('Error in chat interaction:', error);
        setMessages((prevMessages) => [
          ...prevMessages,
          {
            text: "I apologize, but I encountered an error. Please try again.",
            sender: 'ai',
            session_id: currentSessionId,
            timestamp: new Date().toISOString()
          }
        ]);
      }
    };

    sendNewMessage();
  };

  return (
    <div className={`ChatContainer ${theme}`}>
      {/* Chat Control Buttons and Title */}
      <div className="ChatControlContainer">
        <div className="ChatTitle">{currentTitle}</div>
        <div className="ButtonGroup">
          <div className="tooltip">
            <button 
              onClick={handleNewChat} 
              className="NewChatButton"
              disabled={isSubmitting}
            >
              <Plus size={18} />
              <span className="tooltiptext">New Chat</span>
            </button>
          </div>
          <div className="history-container">
            <div className="tooltip">
              <button 
                onClick={async () => {
                  // Refresh sessions list when opening the dropdown
                  if (!showSessionList) {
                    await fetchSessions();
                  }
                  setShowSessionList(!showSessionList);
                }} 
                className={`PreviousChatButton ${showSessionList ? 'active' : ''}`}
                disabled={isLoadingHistory || isSubmitting}
              >
                <Clock size={18} />
                <div className="SessionListIndicator"></div>
                <span className="tooltiptext">Chat History (Alt+H)</span>
              </button>
            </div>
            
            {/* Session List Dropdown */}
            {showSessionList && (
              <div className="SessionHistoryDropdown">
                <div className="SessionHistoryHeader">
                  <h3>Chat History</h3>
                </div>
                {sessions.length === 0 ? (
                  <div className="NoSessionsMessage">No previous chats found</div>
                ) : (
                  sessions.map((session) => (
                    <div
                      key={session.session_id}
                      className={`SessionItem ${session.session_id === currentSessionId ? 'active' : ''}`}
                      onClick={() => handleLoadSession(session.session_id)}
                    >
                      <div className="SessionItemContent">
                        <div className="SessionInfo">
                          <span className="SessionTitle">{session.title || 'Untitled Chat'}</span>
                          <span className="SessionDate">
                            {new Date(session.last_updated).toLocaleDateString()}
                          </span>
                        </div>
                        <button
                          className="DeleteSessionButton"
                          onClick={(e) => handleDeleteSession(session.session_id, e)}
                          aria-label="Delete session"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Chat display */}
      <div className="ChatDisplayContainer">
        {messages.map((message, index) => (
          <div 
            key={index} 
            className={`Message ${message.sender}`}
            onMouseEnter={() => setHoveredMessageId(index)}
            onMouseLeave={() => setHoveredMessageId(null)}
          >
            {message.sender === 'ai' && isSubmitting && index === messages.length - 1 ? (
              <div className="LoadingSpinner" />
            ) : (
              <>
                <div className="MessageActions">
                  {message.sender === 'ai' && (
                    <button 
                      className={`CopyButton ${copiedMessageId === index ? 'copied' : ''}`}
                      onClick={() => copyToClipboard(message.text, index)}
                      aria-label="Copy message"
                    >
                      {copiedMessageId === index ? 'Copied!' : <Copy size={16} />}
                    </button>
                  )}
                  {/* Always show the buttons instead of only when hovering */}
                  <button 
                    className="ExpandMessageButton"
                    onClick={() => handleExpandMessage(index)}
                    aria-label="Expand conversation"
                  >
                    <Maximize2 size={16} />
                  </button>
                  <button 
                    className="DeleteMessageButton"
                    onClick={(e) => handleDeleteMessage(index, e)}
                    aria-label="Delete message"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
                <div className="MessageContent">
                  {typingMessage.isTyping && typingMessage.index === index ? (
                    <>
                      <ReactMarkdown>{typingMessage.text}</ReactMarkdown>
                      <span className="typing-cursor">*</span>
                    </>
                  ) : (
                    <ReactMarkdown>{message.text}</ReactMarkdown>
                  )}
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      {/* Chat input */}
      <div className="ChatInputContainer">
        <textarea
          placeholder={isSubmitting ? "Please wait..." : "Ask Scribe..."}
          className="AskAIInput"
          value={userInput}
          onChange={(e) => setUserInput(e.target.value)}
          onKeyPress={handleKeyPress}
          disabled={isSubmitting}
        />
        <button 
          onClick={handleSubmit} 
          className="SubmitButton"
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <div className="LoadingSpinner" />
          ) : (
            <Send />
          )}
        </button>
      </div>

      {/* Chat Popup */}
      {isPopupOpen && (
        <ChatPopup 
          isOpen={isPopupOpen}
          onClose={() => setIsPopupOpen(false)}
          chatHistory={messages.map((msg, idx) => ({
            id: idx, // Using index as id
            sender: msg.sender,
            content: msg.text,
            timestamp: msg.timestamp
          }))}
          focusedMessageId={focusedMessageIndex}
          onSendMessage={handlePopupSendMessage}
          onDeleteMessage={(msgId) => handleDeleteMessage(msgId, new Event('click'))}
        />
      )}
    </div>
  );
};

export default AskAI;
