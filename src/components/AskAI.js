import React, { useEffect, useState } from 'react';
import { Send, Plus, Clock, Copy } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { supabase } from '../supabaseClient';
import { v4 as uuidv4 } from 'uuid';
import '../css/AskAI.css';

const AskAI = ({ messages, setMessages }) => {
  const [userInput, setUserInput] = useState('');
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentTitle, setCurrentTitle] = useState('New Chat');
  const [showSessionList, setShowSessionList] = useState(false);
  const [copiedMessageId, setCopiedMessageId] = useState(null);

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
        const response = await fetch('http://localhost:8000/generate-title', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            session_id: currentSessionId,
            conversation_history: messages
          }),
        });

        if (!response.ok) {
          throw new Error(`Failed to generate title: ${response.statusText}`);
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
          }
          
          // Refresh sessions list to show new title
          await fetchSessions();
        }
      } catch (error) {
        console.error('Error generating title:', error);
      }
    }
  };

  // Initialize session on component mount
  useEffect(() => {
    const initializeSession = async () => {
      const sessionId = uuidv4();
      setCurrentSessionId(sessionId);
      
      // Create new session in Supabase
      await supabase.from('chat_sessions').insert([{
        session_id: sessionId,
        created_at: new Date().toISOString(),
        last_updated: new Date().toISOString(),
        title: 'New Chat'
      }]);
    };

    initializeSession();
    fetchSessions();

    // Add keyboard shortcut for chat history
    const handleKeyboardShortcut = (e) => {
      // Alt+H to toggle chat history
      if (e.altKey && e.key === 'h') {
        setShowSessionList(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyboardShortcut);

    // Cleanup on unmount
    return () => {
      if (currentSessionId) {
        cleanupSession(currentSessionId);
      }
      window.removeEventListener('keydown', handleKeyboardShortcut);
    };
  }, []);

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

  const handleSubmit = async () => {
    if (!userInput.trim() || !currentSessionId || isSubmitting) return;

    setIsSubmitting(true);

    const newMessage = {
      text: userInput,
      sender: 'user',
      session_id: currentSessionId,
      timestamp: new Date().toISOString()
    };

    try {
      // Update messages optimistically
      const updatedMessages = [...messages, newMessage];
      setMessages(updatedMessages);
      
      // Store user message in Supabase
      await supabase.from('messages').insert([newMessage]);

      // Update session last_updated timestamp
      await supabase
        .from('chat_sessions')
        .update({ last_updated: new Date().toISOString() })
        .eq('session_id', currentSessionId);

      // Get AI response
      const response = await fetch('http://localhost:8000/ask-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          question: userInput,
          session_id: currentSessionId,
          conversation_history: updatedMessages
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get AI response');
      }

      const data = await response.json();

      const aiMessage = {
        text: data.response,
        sender: 'ai',
        session_id: currentSessionId,
        timestamp: new Date().toISOString()
      };

      // Update messages with AI response
      const finalMessages = [...updatedMessages, aiMessage];
      setMessages(finalMessages);
      await supabase.from('messages').insert([aiMessage]);
      
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
      
      await cleanupSession(currentSessionId);
      const newSessionId = uuidv4();
      setCurrentSessionId(newSessionId);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNewChat = async () => {
    if (currentSessionId) {
      await cleanupSession(currentSessionId);
    }

    const sessionId = uuidv4();
    setCurrentSessionId(sessionId);
    setMessages([]);
    setUserInput('');
    setCurrentTitle('New Chat');

    await supabase.from('chat_sessions').insert([{
      session_id: sessionId,
      created_at: new Date().toISOString(),
      last_updated: new Date().toISOString(),
      title: 'New Chat'
    }]);

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

  return (
    <div className="ChatContainer">
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
                onClick={() => setShowSessionList(!showSessionList)} 
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
                      <span className="SessionTitle">{session.title || 'Untitled Chat'}</span>
                      <span className="SessionDate">
                        {new Date(session.last_updated).toLocaleDateString()}
                      </span>
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
          <div key={index} className={`Message ${message.sender}`}>
            {message.sender === 'ai' && isSubmitting && index === messages.length - 1 ? (
              <div className="LoadingSpinner" />
            ) : (
              <>
                {message.sender === 'ai' && (
                  <button 
                    className={`CopyButton ${copiedMessageId === index ? 'copied' : ''}`}
                    onClick={() => copyToClipboard(message.text, index)}
                    aria-label="Copy message"
                  >
                    {copiedMessageId === index ? 'Copied!' : <Copy size={16} />}
                  </button>
                )}
                <div className="MessageContent">
                  <ReactMarkdown>{message.text}</ReactMarkdown>
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
    </div>
  );
};

export default AskAI;
