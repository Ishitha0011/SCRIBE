import React, { useEffect, useState, useRef, useCallback } from 'react';
// Combine necessary icons from both versions
import { Send, Plus, Clock, Copy, Trash2, Maximize2, X, Paperclip, Check, MoreHorizontal, ArrowUp, Edit2, Search, Upload, FileText } from 'lucide-react';
import ReactMarkdown from 'react-markdown'; // Keep for rendering
import { supabase } from '../supabaseClient'; // Ensure path is correct
import { v4 as uuidv4 } from 'uuid';
import '../css/AskAI.css'; // Use the MODERN CSS file path
import { useTheme } from '../ThemeContext'; // Your existing theme hook
import { useFileContext } from '../FileContext'; // Add FileContext
import ChatPopup from './ChatPopup'; // Your existing popup

// --- Helper Hook (Keep from Modern Version) ---
const useAutoResizeTextArea = (value) => {
    const ref = useRef(null);
    useEffect(() => {
        const textArea = ref.current;
        if (textArea) {
            textArea.style.height = 'auto';
            const scrollHeight = textArea.scrollHeight;
            textArea.style.height = `${Math.min(scrollHeight, 120)}px`; // Max height 120px
        }
    }, [value]);
    return ref;
};

// --- Main Component ---
const AskAI = ({ messages, setMessages }) => {
    // --- State Variables (Combined from Original + Modern adaptations) ---
    const { theme } = useTheme(); // Your theme hook
    const { fileStructure, workspacePath } = useFileContext(); // Add FileContext hook
    const [userInput, setUserInput] = useState('');
    const [currentSessionId, setCurrentSessionId] = useState(null);
    const [sessions, setSessions] = useState([]);
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [currentTitle, setCurrentTitle] = useState('New Chat');
    const [showSessionList, setShowSessionList] = useState(false);
    const [copiedMessageId, setCopiedMessageId] = useState(null);
    const [hoveredMessageId, setHoveredMessageId] = useState(null); // Used for showing action trigger
    const [activeActionMenu, setActiveActionMenu] = useState(null); // For the modern action menu
    const [typingMessage, setTypingMessage] = useState({ index: null, text: '', fullText: '', isTyping: false });
    const [isPopupOpen, setIsPopupOpen] = useState(false);
    const [focusedMessageIndex, setFocusedMessageIndex] = useState(null);
    const [isTitleGenerating, setIsTitleGenerating] = useState(false); // Keep from original if needed for UI
    const [isTitleEditing, setIsTitleEditing] = useState(false);
    const [editableTitle, setEditableTitle] = useState('');
    const [selectedFiles, setSelectedFiles] = useState([]);
    const [isTitleGenerated, setIsTitleGenerated] = useState(false);
    
    // New state variables for file selection
    const [showFileSelector, setShowFileSelector] = useState(false);
    const [fileSearchTerm, setFileSearchTerm] = useState('');
    const [filteredFiles, setFilteredFiles] = useState([]);
    const [isFileUploading, setIsFileUploading] = useState(false);

    // --- Refs (Combined from Original + Modern) ---
    const typingRef = useRef(null);
    const messagesEndRef = useRef(null);
    const fileInputRef = useRef(null);
    const sessionHistoryRef = useRef(null);
    const actionMenuRef = useRef(null); // For modern action menu
    const fileSelectorRef = useRef(null);
    const textAreaRef = useAutoResizeTextArea(userInput); // For auto-resize

    const typingSpeed = 15; // From original

    // --- Logic Functions (Mostly from Original, adapted slightly if needed) ---

    // Cleanup backend session
    const cleanupSession = useCallback(async (sessionId) => {
        if (!sessionId) return;
        try {
            await fetch(`http://localhost:8000/clear-session/${sessionId}`, { method: 'DELETE' });
            console.log(`Cleaned up backend session: ${sessionId}`);
        } catch (error) {
            console.error('Error cleaning up backend session:', error);
        }
    }, []);

    // Fetch sessions (used for history dropdown)
    const fetchSessions = useCallback(async () => {
        setIsLoadingHistory(true); // Indicate loading history
        const { data, error } = await supabase
            .from('chat_sessions')
            .select('*')
            .order('last_updated', { ascending: false });

        if (error) {
            console.error('Error fetching sessions:', error);
        } else {
            setSessions(data || []);
        }
        setIsLoadingHistory(false);
    }, []); // Keep useCallback

    // Generate Title (Adapted from original, ensure it works with current states)
    const generateTitle = useCallback(async (currentMessages, sessionId) => {
        if (!sessionId || isTitleGenerated || currentMessages.length < 2) {
            return;
        }
        // Optional: Add back isTitleGenerating state changes if you have UI for it
        // setIsTitleGenerating(true);
        try {
            const formattedMessages = currentMessages.map(msg => ({
                text: msg.text || '', sender: msg.sender || 'user', timestamp: msg.timestamp || new Date().toISOString()
            }));

            const response = await fetch('http://localhost:8000/generate-title', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ session_id: sessionId, conversation_history: formattedMessages }),
            });

            if (!response.ok) {
                console.error(`Title generation failed: ${response.status} ${await response.text()}`);
                return;
            }

            const data = await response.json();
            if (data.title && data.title.trim() !== '' && data.title !== 'New Chat') {
                const newTitle = data.title.substring(0, 100);
                setCurrentTitle(newTitle);
                setIsTitleGenerated(true);

                const { error } = await supabase.from('chat_sessions').update({ title: newTitle }).eq('session_id', sessionId);
                if (error) { console.error('Error updating title in Supabase:', error); }
                else { await fetchSessions(); } // Refresh list after title update
            }
        } catch (error) {
            console.error('Error generating title:', error);
        } finally {
            // setIsTitleGenerating(false);
        }
    }, [isTitleGenerated, fetchSessions]); // Added fetchSessions dependency


    // Create New Session (from original)
    const createNewSession = useCallback(async () => {
        const sessionId = uuidv4();
        const timestamp = new Date().toISOString();
        const newSessionData = {
            session_id: sessionId, created_at: timestamp, last_updated: timestamp, title: 'New Chat'
        };
        const { error } = await supabase.from('chat_sessions').insert([newSessionData]);
        if (error) { console.error("Error creating new session:", error); return null; }

        // Optimistically add to local state AND fetch to ensure consistency
        setSessions(prev => [newSessionData, ...prev]);
        await fetchSessions(); // Ensure list is fully up-to-date after insert

        return sessionId;
    }, [fetchSessions]); // Added fetchSessions

    // Simulate Typing (from original, adapted for useCallback)
    const simulateTyping = useCallback((fullText, messageIndex) => {
        let currentCharIndex = 0;
        setTypingMessage({ index: messageIndex, text: '', fullText: fullText, isTyping: true });
        if (typingRef.current) clearInterval(typingRef.current);
        typingRef.current = setInterval(() => {
            if (currentCharIndex < fullText.length) {
                setTypingMessage(prev => ({ ...prev, text: fullText.substring(0, currentCharIndex + 1) }));
                currentCharIndex++;
            } else {
                clearInterval(typingRef.current); typingRef.current = null;
                setTypingMessage(prev => ({ ...prev, isTyping: false }));
            }
        }, typingSpeed);
    }, [typingSpeed]); // Added dependency

    // Handle Submit (Modernized file handling, kept core logic)
     const handleSubmit = useCallback(async () => {
        const textInput = userInput.trim();
        if ((!textInput && selectedFiles.length === 0) || isSubmitting) return;

        setIsSubmitting(true);
        let sessionId = currentSessionId;

        try {
            if (!sessionId) {
                sessionId = await createNewSession();
                if (!sessionId) throw new Error("Failed to create session");
                setCurrentSessionId(sessionId);
                setIsTitleGenerated(false); // Reset flag for new session
            }

            let messageText = textInput;
            let fileInfo = "";
            if (selectedFiles.length > 0) {
                fileInfo = `[Attached: ${selectedFiles.map(f => f.name).join(', ')}]`;
                messageText = `${fileInfo}${textInput ? '\n' + textInput : ''}`;
            }

            const userMessage = {
                text: messageText, sender: 'user', session_id: sessionId, timestamp: new Date().toISOString(),
                // Optionally store file metadata if your backend/display needs it separately
                // metadata: selectedFiles.length > 0 ? { files: selectedFiles.map(f => ({ name: f.name, type: f.type, size: f.size })) } : null
            };

            const updatedMessages = [...messages, userMessage];
            setMessages(updatedMessages); // Optimistic UI update
            setUserInput('');       // Clear input
            setSelectedFiles([]);   // Clear selected files

            // Save user message & update session timestamp
            await Promise.all([
                supabase.from('messages').insert([userMessage]),
                supabase.from('chat_sessions').update({ last_updated: userMessage.timestamp }).eq('session_id', sessionId)
            ]);

            // Prepare history for backend (includes the user message with file info)
            const formattedHistory = updatedMessages.map(msg => ({
                text: msg.text, sender: msg.sender, timestamp: msg.timestamp
            }));

            // Determine the actual question/prompt for the AI
            const questionForAI = textInput || (selectedFiles.length > 0 ? "Describe the attached file(s)." : "");

            // Get AI response
            const response = await fetch('http://localhost:8000/ask-ai', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    question: questionForAI, // Send original text or file prompt
                    session_id: sessionId,
                    conversation_history: formattedHistory // History includes the file info prefix
                }),
            });

            if (!response.ok) throw new Error(`Failed to get AI response: ${response.statusText}`);

            const data = await response.json();
            const aiMessage = { text: data.response, sender: 'ai', session_id: sessionId, timestamp: new Date().toISOString() };

            const finalMessages = [...updatedMessages, aiMessage];
            setMessages(finalMessages); // Update UI with AI message
            await supabase.from('messages').insert([aiMessage]); // Save AI message

            simulateTyping(data.response, finalMessages.length - 1); // Start typing effect
            await generateTitle(finalMessages, sessionId); // Attempt to generate title

        } catch (error) {
            console.error('Error in chat interaction:', error);
            setMessages((prev) => [...prev, { text: "Sorry, an error occurred. Please try again.", sender: 'ai', session_id: sessionId || 'error', timestamp: new Date().toISOString() }]);
            // Consider more robust error handling - maybe revert optimistic updates?
        } finally {
            setIsSubmitting(false);
            textAreaRef.current?.focus(); // Refocus input
        }
    }, [userInput, selectedFiles, isSubmitting, currentSessionId, messages, setMessages, createNewSession, simulateTyping, generateTitle]);


    // Handle New Chat (from original, adapted for useCallback)
    const handleNewChat = useCallback(async () => {
        // Optional: Decide if cleanup needed for the *previous* session
        // Consider only cleaning up if the previous session had no messages
        // if (currentSessionId && messages.length === 0) {
        //     await cleanupSession(currentSessionId);
        // }

        setCurrentSessionId(null); // Will trigger useEffect to clear messages
        setCurrentTitle('New Chat');
        setUserInput('');
        setSelectedFiles([]);
        setIsTitleGenerated(false);
        setTypingMessage({ index: null, text: '', fullText: '', isTyping: false });
        setIsTitleEditing(false);
        await fetchSessions(); // Refresh list
    }, [fetchSessions, currentSessionId, messages.length, cleanupSession]); // Added dependencies


    // Handle Load Session (from original, adapted for useCallback)
    const handleLoadSession = useCallback(async (sessionId) => {
        if (sessionId === currentSessionId || isLoadingHistory) return;

        setIsLoadingHistory(true);
        // Optional: Cleanup previous session?
        // await cleanupSession(currentSessionId);

        try {
            // Fetch session details AND messages together
            const [sessionRes, messagesRes] = await Promise.all([
                supabase.from('chat_sessions').select('title').eq('session_id', sessionId).single(),
                supabase.from('messages').select('*').eq('session_id', sessionId).order('timestamp', { ascending: true })
            ]);

            if (sessionRes.error) throw sessionRes.error;
            if (messagesRes.error) throw messagesRes.error;

            const sessionData = sessionRes.data;
            const messagesData = messagesRes.data;

            setCurrentSessionId(sessionId);
            setCurrentTitle(sessionData?.title || 'New Chat');
            setMessages(messagesData || []);
            setIsTitleGenerated(sessionData?.title !== 'New Chat' && !!sessionData?.title);
            setShowSessionList(false);
            setTypingMessage({ index: null, text: '', fullText: '', isTyping: false });
            setIsTitleEditing(false);

        } catch (error) {
            console.error('Error loading session:', error);
            // TODO: Show user feedback?
        } finally {
            setIsLoadingHistory(false);
        }
    }, [currentSessionId, isLoadingHistory, setMessages, cleanupSession]); // Added dependencies


    // Handle Key Press (from original)
    const handleKeyPress = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
        }
    };

    // Copy to Clipboard (from original, adapted for useCallback)
    const copyToClipboard = useCallback((text, index) => {
        navigator.clipboard.writeText(text).then(() => {
            setCopiedMessageId(index);
            setActiveActionMenu(null); // Close menu after copy
            setTimeout(() => setCopiedMessageId(null), 1500); // Reset after 1.5s
        }).catch(err => console.error('Failed to copy text:', err));
    }, []);

    // Delete Session (from original, adapted for useCallback)
    const handleDeleteSession = useCallback(async (sessionId, e) => {
        e.stopPropagation();
        try {
            // Delete messages first (important for foreign keys)
            await supabase.from('messages').delete().eq('session_id', sessionId);
            // Then delete the session
            await supabase.from('chat_sessions').delete().eq('session_id', sessionId);

            // If deleting the current session, start a new chat
            if (sessionId === currentSessionId) {
                handleNewChat(); // This resets state
            } else {
                // Otherwise, just refresh the list
                await fetchSessions();
            }

            // Cleanup backend state
            await cleanupSession(sessionId);

        } catch (error) {
            console.error('Error deleting session:', error);
        }
    }, [currentSessionId, handleNewChat, fetchSessions, cleanupSession]);

    // Delete Message (from original, adapted for useCallback)
    const handleDeleteMessage = useCallback(async (messageIndex, e) => {
        e?.stopPropagation(); // Allow calling without event
         // Add confirmation
         if (!window.confirm("Delete this message?")) {
            return;
         }

        const messageToDelete = messages[messageIndex];
        if (!messageToDelete?.session_id || !messageToDelete?.timestamp) {
            console.error("Cannot delete message: Invalid data", messageToDelete);
            return;
        }

        try {
            const { error } = await supabase
                .from('messages')
                .delete()
                .eq('session_id', messageToDelete.session_id)
                .eq('timestamp', messageToDelete.timestamp); // Use timestamp for precision

            if (error) throw error;

            // Stop typing effect if deleting the message being typed
            if (typingMessage.index === messageIndex && typingMessage.isTyping) {
                if (typingRef.current) clearInterval(typingRef.current);
                setTypingMessage({ index: null, text: '', fullText: '', isTyping: false });
            }

            // Update local state
            const updatedMessages = messages.filter((_, index) => index !== messageIndex);
            setMessages(updatedMessages);
            setActiveActionMenu(null); // Close action menu

            // Logic to reset title if necessary
            if (updatedMessages.length < 2 && isTitleGenerated) {
                 setCurrentTitle('New Chat');
                 setIsTitleGenerated(false);
                 // Update title in DB as well
                 if(currentSessionId) {
                    await supabase.from('chat_sessions').update({ title: 'New Chat' }).eq('session_id', currentSessionId);
                 }
            }
            // Optional: Consider regenerating title if context changed significantly
            // else if (updatedMessages.length >= 2 && isTitleGenerated) {
            //    await generateTitle(updatedMessages, currentSessionId);
            // }

            // Optional: Update session last_updated? Depends on desired behavior.
            // if(currentSessionId){
            //    await supabase.from('chat_sessions').update({ last_updated: new Date().toISOString() }).eq('session_id', currentSessionId);
            // }

        } catch (error) {
            console.error('Error deleting message:', error);
             // TODO: Show user feedback?
        }
    }, [messages, setMessages, typingMessage, isTitleGenerated, currentSessionId, generateTitle]); // Added dependencies


    // Expand Message (from original, adapted for useCallback)
    const handleExpandMessage = useCallback((messageIndex) => {
        setFocusedMessageIndex(messageIndex);
        setIsPopupOpen(true);
        setActiveActionMenu(null); // Close action menu
    }, []);

    // Send Message From Popup (from original, adapted for useCallback)
    const handlePopupSendMessage = useCallback((text) => {
        // Option 1: Just populate the main input and focus it
        setUserInput(text);
        textAreaRef.current?.focus();
        setIsPopupOpen(false);

        // Option 2: Directly trigger handleSubmit (more complex state mgmt)
        // This would require handleSubmit to potentially accept arguments
        // or read state differently. For simplicity, Option 1 is often better.

    }, [setUserInput]); // Dependency on setUserInput


    // File Handling (from original, minor tweaks)
    const handleFileButtonClick = () => {
        setShowFileSelector(prev => !prev); // Toggle file selector instead of direct file input
    };

    const handleFileChange = (e) => {
        if (e.target.files) {
            const newFiles = Array.from(e.target.files);
            // Limit number of files (e.g., 5)
            setSelectedFiles(prev => [...prev, ...newFiles].slice(0, 5));
            e.target.value = null; // Allow re-selecting the same file
            setShowFileSelector(false); // Close selector after selection
        }
    };

    // Filter workspace files based on search term
    const filterWorkspaceFiles = useCallback((searchTerm) => {
        if (!fileStructure) return [];
        
        const searchFiles = (items, term) => {
            let results = [];
            
            for (const item of items) {
                if (item.type === 'file' && item.name.toLowerCase().includes(term.toLowerCase())) {
                    results.push(item);
                }
                
                if (item.type === 'folder' && item.children) {
                    results = [...results, ...searchFiles(item.children, term)];
                }
            }
            
            return results;
        };
        
        return searchFiles(fileStructure, searchTerm);
    }, [fileStructure]);

    // Update filtered files when search term changes
    useEffect(() => {
        if (showFileSelector) {
            setFilteredFiles(filterWorkspaceFiles(fileSearchTerm));
        }
    }, [fileSearchTerm, showFileSelector, filterWorkspaceFiles]);

    // Handle workspace file selection
    const handleWorkspaceFileSelect = async (file) => {
        try {
            const response = await fetch(`http://localhost:8000/files/read?path=${encodeURIComponent(file.id)}`);
            const data = await response.json();
            
            if (data.error) {
                console.warn(`Warning reading file: ${data.error}`);
                return;
            }
            
            // Create a File object from the content
            const fileBlob = new Blob([data.content], { type: 'text/plain' });
            const fileObject = new File([fileBlob], file.name, { type: 'text/plain' });
            
            setSelectedFiles(prev => [...prev, fileObject].slice(0, 5));
            setShowFileSelector(false);
            setFileSearchTerm('');
        } catch (error) {
            console.error('Error reading workspace file:', error);
        }
    };

    const removeSelectedFile = (indexToRemove) => {
        setSelectedFiles(prev => prev.filter((_, index) => index !== indexToRemove));
    };

    // Handle click outside file selector
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (fileSelectorRef.current && !fileSelectorRef.current.contains(e.target)) {
                setShowFileSelector(false);
            }
        };

        if (showFileSelector) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [showFileSelector]);


    // Title Editing (from original, adapted for useCallback)
    const handleEditTitle = useCallback(() => {
        if (!currentSessionId) return; // Prevent editing if no session
        setEditableTitle(currentTitle);
        setIsTitleEditing(true);
    }, [currentSessionId, currentTitle]);

    const handleTitleChange = (e) => setEditableTitle(e.target.value);

    const handleSaveTitle = useCallback(async () => {
        const newTitle = editableTitle.trim().substring(0, 100); // Trim and limit
        if (newTitle && newTitle !== currentTitle && currentSessionId) {
            setCurrentTitle(newTitle); // Optimistic update
            setIsTitleGenerated(true); // Mark as edited/generated

            const { error } = await supabase
                .from('chat_sessions')
                .update({ title: newTitle, last_updated: new Date().toISOString() })
                .eq('session_id', currentSessionId);

            if (error) {
                console.error("Error saving title:", error);
                setCurrentTitle(currentTitle); // Revert on error
                 // TODO: Show user feedback
            } else {
                await fetchSessions(); // Refresh list to show new title
            }
        }
        setIsTitleEditing(false);
    }, [editableTitle, currentTitle, currentSessionId, fetchSessions]); // Added dependencies

    const handleTitleKeyDown = (e) => {
        if (e.key === 'Enter') {
            handleSaveTitle();
        } else if (e.key === 'Escape') {
            setIsTitleEditing(false);
            setEditableTitle(currentTitle); // Revert visual change
        }
    };


    // Toggle Action Menu (from modern version)
    const toggleActionMenu = (index) => {
        setActiveActionMenu(prev => (prev === index ? null : index));
    };


    // --- Effects (Combined & Reviewed) ---

    // Initial Load & Event Listeners (from original, adapted)
    useEffect(() => {
        fetchSessions(); // Fetch initial sessions

        // Keyboard shortcut for history
        const handleKeyboardShortcut = async (e) => {
            if (e.altKey && e.key === 'h') {
                e.preventDefault();
                if (!showSessionList) await fetchSessions(); // Fetch fresh data on open
                setShowSessionList(prev => !prev);
            }
        };

        // Click outside for menus
        const handleClickOutside = (event) => {
            // Close session history dropdown
            if (sessionHistoryRef.current && !sessionHistoryRef.current.contains(event.target)) {
                setShowSessionList(false);
            }
            // Close message action menu
            if (actionMenuRef.current && !actionMenuRef.current.contains(event.target)) {
                 // Prevent closing if clicking the trigger button itself
                 const isTriggerButton = event.target.closest('.MessageActionTrigger');
                 if (!isTriggerButton) {
                     setActiveActionMenu(null);
                 }
            }
             // Close title editing on outside click
             const isTitleInput = event.target.closest('.HeaderTitleEditInput');
             const isTitleDisplay = event.target.closest('.HeaderTitleText');
             if (isTitleEditing && !isTitleInput && !isTitleDisplay) {
                handleSaveTitle(); // Save changes on clicking away
             }
        };

        window.addEventListener('keydown', handleKeyboardShortcut);
        document.addEventListener('mousedown', handleClickOutside);

        // Cleanup function
        return () => {
            window.removeEventListener('keydown', handleKeyboardShortcut);
            document.removeEventListener('mousedown', handleClickOutside);
            // Original cleanup logic (optional: clean unsaved session?)
            // if (currentSessionId && messages.length === 0) {
            //     cleanupSession(currentSessionId);
            // }
        };
        // Added handleSaveTitle to dependencies for outside click logic
    }, [fetchSessions, showSessionList, isTitleEditing, handleSaveTitle]);


    // Fetch messages when session changes (from original)
    useEffect(() => {
        const fetchMessages = async () => {
            if (!currentSessionId) {
                setMessages([]); // Clear messages when no session
                return;
            }
            // Indicate loading messages? (Optional UI state)
            const { data, error } = await supabase
                .from('messages')
                .select('*')
                .eq('session_id', currentSessionId)
                .order('timestamp', { ascending: true });

            if (error) {
                console.error('Error fetching messages:', error);
                // TODO: Show error state?
            } else {
                setMessages(data || []);
                // Check if title is already generated for this session
                 const currentSession = sessions.find(s => s.session_id === currentSessionId);
                 setIsTitleGenerated(currentSession?.title !== 'New Chat' && !!currentSession?.title);
            }
            // End loading messages indication
        };
        fetchMessages();
    }, [currentSessionId, setMessages, sessions]); // Added sessions dependency


    // Typing effect cleanup (from original)
    useEffect(() => {
        return () => {
            if (typingRef.current) {
                clearInterval(typingRef.current);
            }
        };
    }, []);

    // Auto-scroll effect (from modern version)
    useEffect(() => {
        // Add a small delay to allow rendering after typing stops
         const timer = setTimeout(() => {
             messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
         }, 50);
         return () => clearTimeout(timer);
    }, [messages, typingMessage.isTyping]); // Trigger on messages change and when typing *stops*


    // --- JSX (Modern Structure, Connected to Full Logic) ---
    return (
        // Use theme from context for the main class
        <div className={`ModernChatContainer ${theme}`} style={{ backgroundColor: 'var(--dark-bg-color)' }}>
            {/* --- Header (Modern Style, Full Logic) --- */}
            <div className="ModernChatHeader">
                <div className="HeaderTitleContainer">
                    {isTitleEditing ? (
                        <input
                            type="text"
                            value={editableTitle}
                            onChange={handleTitleChange}
                            onBlur={handleSaveTitle} // Save on blur
                            onKeyDown={handleTitleKeyDown} // Enter/Escape
                            className="HeaderTitleEditInput"
                            autoFocus
                        />
                    ) : (
                        <span
                            className="HeaderTitleText"
                            onClick={handleEditTitle} // Use handler
                            title={currentSessionId ? "Edit title" : currentTitle}
                        >
                            {currentTitle}
                            {/* Show edit icon only when not editing and session exists */}
                            {currentSessionId && !isTitleEditing && <Edit2 size={14} className="HeaderEditIcon" />}
                        </span>
                    )}
                    {/* Optional: Add back isTitleGenerating spinner if needed */}
                    {/* {isTitleGenerating && <div className="TitleLoadingSpinner" />} */}
                </div>
                <div className="HeaderActions">
                    {/* New Chat Button */}
                    <button onClick={handleNewChat} disabled={isSubmitting} className="HeaderButton" aria-label="New Chat" title="New Chat"><Plus size={18} /></button>
                    {/* History Button & Dropdown */}
                    <div className="history-container" ref={sessionHistoryRef}>
                        <button
                            onClick={async () => { if (!showSessionList) await fetchSessions(); setShowSessionList(prev => !prev); }}
                            disabled={isLoadingHistory || isSubmitting}
                            className={`HeaderButton ${showSessionList ? 'active' : ''}`}
                            aria-label="Chat History" title="Chat History (Alt+H)">
                                { isLoadingHistory ? <div className="TinySpinner"></div> : <Clock size={18} /> }
                        </button>
                        {showSessionList && (
                            <div className="ModernSessionHistoryDropdown">
                                <div className="SessionHistory_Header">History</div>
                                {sessions.length === 0 ? (<div className="SessionHistory_NoItems">No history</div>)
                                 : (sessions.map((session) => (
                                    <div
                                        key={session.session_id}
                                        className={`SessionHistory_Item ${session.session_id === currentSessionId ? 'active' : ''}`}
                                        onClick={() => handleLoadSession(session.session_id)} // Use handler
                                        title={session.title || 'Untitled Chat'}
                                    >
                                        <span className="SessionHistory_ItemTitle">{session.title || 'Untitled Chat'}</span>
                                        {/* Include date from original if desired */}
                                        {/* <span className="SessionHistory_ItemDate">{new Date(session.last_updated).toLocaleDateString()}</span> */}
                                        <button className="SessionHistory_DeleteBtn" onClick={(e) => handleDeleteSession(session.session_id, e)} aria-label="Delete session"><Trash2 size={14} /></button>
                                    </div>))
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* --- Message Display (Modern Style, Full Logic) --- */}
            <div className="ModernChatDisplay">
                {messages.map((message, index) => (
                    <div
                        key={message.timestamp + '-' + index} // Use timestamp + index
                        className={`MessageItem ${message.sender}`}
                        onMouseEnter={() => setHoveredMessageId(index)}
                        onMouseLeave={() => setHoveredMessageId(null)}
                    >
                        <div className="MessageMeta">
                            <span className="SenderLabel">{message.sender === 'user' ? 'You' : 'AI'}</span>
                            {/* Action Trigger - Show on hover or if menu is active */}
                            {(hoveredMessageId === index || activeActionMenu === index) && (
                                <div className="MessageActionsContainer">
                                    <button className="MessageActionTrigger" onClick={() => toggleActionMenu(index)} aria-label="Actions"><MoreHorizontal size={18} /></button>
                                    {/* Action Menu Dropdown */}
                                    {activeActionMenu === index && (
                                        <div className="ModernActionMenu" ref={actionMenuRef}>
                                            {/* Copy Button (AI only) */}
                                            {message.sender === 'ai' && (
                                                <button onClick={() => copyToClipboard(message.text, index)}>
                                                    {copiedMessageId === index ? <Check size={14} className="copied"/> : <Copy size={14} />} Copy
                                                </button>
                                            )}
                                            {/* Expand Button */}
                                            <button onClick={() => handleExpandMessage(index)}>
                                                <Maximize2 size={14} /> Expand
                                            </button>
                                            {/* Delete Button */}
                                            <button onClick={(e) => handleDeleteMessage(index, e)} className="delete">
                                                <Trash2 size={14} /> Delete
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                        <div className="MessageContent">
                            {/* Typing Effect or Rendered Markdown */}
                            {typingMessage.isTyping && typingMessage.index === index ? (
                                <><ReactMarkdown>{typingMessage.text}</ReactMarkdown><span className="typing-cursor"></span></>
                            ) : (
                                // Render markdown content safely
                                <ReactMarkdown components={{
                                     // Optional: Add custom renderers if needed for security or styling
                                     // Example: link: ({node, ...props}) => <a {...props} target="_blank" rel="noopener noreferrer" />
                                }}>{message.text || ''}</ReactMarkdown>
                            )}
                        </div>
                    </div>
                ))}
                {/* Loading Indicator for AI response (from modern version) */}
                 {isSubmitting && messages.length > 0 && messages[messages.length - 1]?.sender === 'user' && (
                    <div className="MessageItem ai typing-indicator">
                        <div className="MessageMeta"><span className="SenderLabel">AI</span></div>
                        <div className="MessageContent">
                            <div className="ModernLoadingDots"><span></span><span></span><span></span></div>
                        </div>
                    </div>
                )}
                {/* Scroll Target */}
                <div ref={messagesEndRef} />
            </div>

            {/* --- Input Zone (Modern Style, Full Logic) --- */}
            <div className="ModernChatInputZone">
                {/* Attached Files Preview */}
                {selectedFiles.length > 0 && (
                    <div className="AttachedFilesPreview">
                        {selectedFiles.map((file, index) => (
                            <div key={index} className="FileChip" title={file.name}>
                                <Paperclip size={12} className="FileChipIcon"/>
                                <span className="FileChipName">{file.name}</span>
                                <button onClick={() => removeSelectedFile(index)} className="FileChipRemoveBtn" aria-label={`Remove ${file.name}`}><X size={12} /></button>
                            </div>
                        ))}
                         {/* Optional: Show file limit */}
                         {selectedFiles.length >= 5 && <span className="FileLimitText">(Max: 5 files)</span>}
                    </div>
                )}
                {/* Input Bar */}
                <div className="ModernInputBar">
                    {/* Attach Button */}
                    <button
                        className="InputBarButton attach"
                        onClick={handleFileButtonClick}
                        disabled={isSubmitting || selectedFiles.length >= 5}
                        title="Attach file (max 5)"
                        aria-label="Attach file"
                    >
                        <Paperclip size={20} />
                    </button>

                    {/* File Selector Dropdown */}
                    {showFileSelector && (
                        <div className="FileSelector" ref={fileSelectorRef}>
                            <div className="FileSelectorHeader">
                                <div className="SearchBox">
                                    <Search size={14} />
                                    <input
                                        type="text"
                                        placeholder="Search files..."
                                        value={fileSearchTerm}
                                        onChange={(e) => setFileSearchTerm(e.target.value)}
                                    />
                                </div>
                            </div>
                            <div className="FileSelectorContent">
                                <div className="FileSelectorSection">
                                    <div className="SectionTitle">Workspace Files</div>
                                    <div className="FileList">
                                        {workspacePath ? (
                                            filteredFiles.length > 0 ? (
                                                filteredFiles.map((file) => (
                                                    <button
                                                        key={file.id}
                                                        className="FileItem"
                                                        onClick={() => handleWorkspaceFileSelect(file)}
                                                    >
                                                        <FileText size={14} />
                                                        <span>{file.name}</span>
                                                    </button>
                                                ))
                                            ) : fileSearchTerm ? (
                                                <div className="NoResults">No matching files found</div>
                                            ) : (
                                                <div className="NoResults">Start typing to search files</div>
                                            )
                                        ) : (
                                            <div className="NoResults">No workspace selected</div>
                                        )}
                                    </div>
                                </div>
                                <div className="FileSelectorDivider">or</div>
                                <div className="FileSelectorSection">
                                    <button
                                        className="UploadButton"
                                        onClick={() => fileInputRef.current?.click()}
                                        disabled={isFileUploading}
                                    >
                                        <Upload size={14} />
                                        <span>Upload from Computer</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Hidden File Input */}
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        style={{ display: 'none' }}
                        multiple
                        accept="*"
                    />

                    {/* Textarea */}
                    <textarea
                        ref={textAreaRef}
                        className="InputBarTextarea"
                        value={userInput}
                        onChange={(e) => setUserInput(e.target.value)}
                        onKeyDown={handleKeyPress}
                        placeholder="Ask AI..."
                        disabled={isSubmitting}
                        rows={1}
                    />

                    {/* Send Button */}
                    <button
                        className="InputBarButton send"
                        onClick={handleSubmit}
                        disabled={(!userInput.trim() && selectedFiles.length === 0) || isSubmitting}
                        title="Send message"
                        aria-label="Send message"
                    >
                        {isSubmitting ? <div className="InputLoadingSpinner"></div> : <ArrowUp size={20} />}
                    </button>
                </div>
            </div>

            {/* Chat Popup (Using original logic) */}
             {isPopupOpen && (
                <ChatPopup
                    isOpen={isPopupOpen}
                    onClose={() => setIsPopupOpen(false)}
                    chatHistory={messages.map((msg, idx) => ({
                        id: idx, // Use index as ID for popup list
                        sender: msg.sender,
                        content: msg.text,
                        timestamp: msg.timestamp
                    }))}
                    focusedMessageId={focusedMessageIndex}
                    onSendMessage={handlePopupSendMessage} // Use handler
                    // Pass delete handler correctly (might need wrapper if event is expected)
                    onDeleteMessage={(msgId) => handleDeleteMessage(msgId)}
                    chatTitle={currentTitle}
                    // Ensure ChatPopup is styled appropriately for modern look
                />
             )}
        </div>
    );
};

export default AskAI;