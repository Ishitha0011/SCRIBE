import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
    Play, Pause, FileVideo, List, Text, MessageSquare, Clock, FileText, Music, User, BrainCircuit, // Using User/BrainCircuit for sender
    Volume2, VolumeX, Pencil, Copy, Maximize2, Wand2, ChevronRight, ChevronLeft,
    Loader2, X, ChevronUp, ChevronDown, Trash2, Settings, Save, FolderOpen, Info // Added Settings, Save, FolderOpen, Info
} from 'lucide-react';
import { useTheme } from '../ThemeContext';
import '../css/Labs.css'; // We will update this file
import ChatPopup from './ChatPopup'; // Assuming this exists and is styled

// --- Helper Hook (Keep) ---
const useAutoResizeTextArea = (value, maxHeight = 100) => {
    const ref = useRef(null);
    useEffect(() => {
        const textArea = ref.current;
        if (textArea) {
            textArea.style.height = 'auto';
            const scrollHeight = textArea.scrollHeight;
            textArea.style.height = `${Math.min(scrollHeight, maxHeight)}px`;
        }
    }, [value, maxHeight]);
    return ref;
};

// --- Utility function for logging ---
const writeToLog = async (logEntry) => {
    try {
        // Add timestamp if not present
        if (!logEntry.timestamp) {
            logEntry.timestamp = new Date().toISOString();
        }
        
        // Format the log entry as JSON with timestamp
        const logString = `[${logEntry.timestamp}] ${JSON.stringify(logEntry)}\n`;
        
        // Send to log server
        await fetch('http://localhost:9999/log', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ log: logString }),
        });
        
        // Also log to console for debugging
        console.log('Log entry:', logEntry);
    } catch (error) {
        console.error('Error writing log:', error);
    }
};

const Labs = () => {
    const { theme } = useTheme(); // Use your theme

    // --- State Variables (Keep all from your original code) ---
    const [vidUrl, setVidUrl] = useState(null);
    const [file, setFile] = useState(null); // Holds the upload result { name: fileId }
    const [originalFileName, setOriginalFileName] = useState(''); // Store original name for display
    const [isLoadingVideo, setIsLoadingVideo] = useState(false);
    const [videoError, setVideoError] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [selectedMode, setSelectedMode] = useState('A/V captions'); // Default mode
    const [timecodeList, setTimecodeList] = useState(null); // Parsed results
    // const [requestedTimecode, setRequestedTimecode] = useState(null); // Keep if used
    const [isProcessing, setIsProcessing] = useState(false);
    const [displayMode, setDisplayMode] = useState('list'); // 'list' or 'paragraph' for results
    // const [hoveredTimecode, setHoveredTimecode] = useState(null); // Less needed with new result UI
    const [rawAIResponse, setRawAIResponse] = useState(null); // Full AI text
    const [isMuted, setIsMuted] = useState(false);
    const [abortController, setAbortController] = useState(null);
    const [analysisHistory, setAnalysisHistory] = useState([]);
    const [customTemplates, setCustomTemplates] = useState([]);
    const [showHistoryPanel, setShowHistoryPanel] = useState(false); // State for overlay panels
    const [showTemplatesPanel, setShowTemplatesPanel] = useState(false);
    const [showEnlargedView, setShowEnlargedView] = useState(false); // For popup results
    const [customPrompt, setCustomPrompt] = useState('');
    const [templateName, setTemplateName] = useState(''); // For saving templates

    // --- Refs (Keep all) ---
    const videoRef = useRef(null);
    const fileInputRef = useRef(null);
    const responseContainerRef = useRef(null); // To scroll to results
    const customPromptRef = useAutoResizeTextArea(customPrompt); // Auto-resize

    // --- Modes Definition (Keep structure) ---
     const modes = {
        'A/V captions': { emoji: '👀', prompt: `For each scene in this video, generate captions that describe the scene along with any spoken text placed in quotation marks.`, description: 'Scene descriptions with dialogue' },
        'Key moments': { emoji: '🔑', prompt: `Generate bullet points for the key moments in this video.`, description: 'Important moments with timestamps' },
        'Paragraph': { emoji: '📝', prompt: `Generate a paragraph that summarizes this video. Keep it to 3 to 5 sentences.`, description: 'Concise paragraph summary' },
        'Haiku': { emoji: '🌸', prompt: `Generate a haiku for the video. Make sure to follow the syllable count rules (5-7-5).`, description: 'Creative 5-7-5 poem' },
        // Custom is handled separately via state now
    };

    // --- Logic Functions (Keep all, ensure they work with new state/UI) ---

    const formatTime = (time) => { /* ... keep existing time format logic ... */
        const minutes = Math.floor(time / 60);
        const seconds = Math.floor(time % 60);
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    };

    const handleFileButtonClick = () => fileInputRef.current?.click();

    const handleFileChange = (e) => { /* ... keep existing file change logic ... */
        if (e.target.files && e.target.files.length > 0) handleVideoUpload(e.target.files[0]);
    };
    const handleDrop = (e) => { /* ... keep existing drop logic ... */
         e.preventDefault(); if (e.dataTransfer.files?.length > 0) handleVideoUpload(e.dataTransfer.files[0]);
    };
    const handleDragOver = (e) => e.preventDefault();

    const handleVideoUpload = useCallback(async (videoFile) => { /* ... keep existing upload logic ... */
        if (!videoFile) return;
        setIsLoadingVideo(true); setVideoError(false); setTimecodeList(null); setRawAIResponse(null);
        setOriginalFileName(videoFile.name); // Store original name
        setVidUrl(URL.createObjectURL(videoFile));
        await writeToLog({ type: 'info', action: 'upload_video', status: 'started', filename: videoFile.name, fileSize: videoFile.size });
        try {
            const formData = new FormData(); formData.set('video', videoFile);
            // Adjust API URL as needed
            const serverPort = process.env.REACT_APP_SERVER_PORT || '';
            const apiUrl = serverPort ? `http://localhost:${serverPort}/api/upload` : '/api/upload';
            const response = await fetch(apiUrl, { method: 'POST', body: formData });
            const responseText = await response.text();
            if (!response.ok) throw new Error(`Upload failed: ${response.status}. ${responseText}`);
            const data = JSON.parse(responseText); // Assume response is { data: { name: fileId } }
            if (!data?.data?.name) throw new Error(`Invalid upload response format: ${responseText}`);
            await writeToLog({ type: 'info', action: 'upload_video', status: 'success', filename: videoFile.name, fileId: data.data.name });
            setFile(data.data); // Store { name: fileId }
            await checkProgress(data.data.name); // Start checking progress
        } catch (error) {
            console.error('Error uploading video:', error); setVideoError(true); setIsLoadingVideo(false); setVidUrl(null); setOriginalFileName('');
            await writeToLog({ type: 'error', action: 'upload_video', status: 'error', error: error.message });
            // User-friendly alerts
            if (error.message.includes('413') || error.message.includes('Payload Too Large')) alert('Video file too large (Max ~100MB).');
            else if (error.message.includes('Failed to fetch')) alert('Network error. Ensure server is running.');
            else alert(`Error uploading video: ${error.message}`);
        }
    }, []); // Removed checkProgress from dependencies, called directly

    const checkProgress = useCallback(async (fileId) => { /* ... keep existing progress check logic ... */
        if (!fileId) return; // Guard against calls without fileId
        try {
            // Adjust API URL
            const serverPort = process.env.REACT_APP_SERVER_PORT || '';
            const apiUrl = serverPort ? `http://localhost:${serverPort}/api/progress` : '/api/progress';
            const response = await fetch(apiUrl, { method: 'POST', headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' }, body: JSON.stringify({ fileId }) });
            const responseText = await response.text();
            if (!response.ok) throw new Error(`Progress check failed: ${response.status}. ${responseText}`);
            const data = JSON.parse(responseText);
            if (!data?.progress?.state) throw new Error(`Invalid progress response: ${responseText}`);
            await writeToLog({ type: 'info', action: 'check_progress', fileId, state: data.progress.state, message: data.progress.message });

            switch (data.progress.state) {
                case 'ACTIVE': setIsLoadingVideo(false); break; // Processing started successfully
                case 'WARNING': setVideoError(true); setIsLoadingVideo(false); alert(`Warning: ${data.progress.message}`); break;
                case 'FAILED': setVideoError(true); setIsLoadingVideo(false); alert(`Processing failed: ${data.progress.message || 'Unknown error'}`); break;
                default: setTimeout(() => checkProgress(fileId), 1500); break; // Check again
            }
        } catch (error) {
            console.error('Error checking progress:', error); setVideoError(true); setIsLoadingVideo(false);
            await writeToLog({ type: 'error', action: 'check_progress', fileId, error: error.message });
            // Only alert if not a specific backend failure state
            if (!error.message.includes('failed:') && !error.message.includes('Invalid progress response')) {
               alert(`Error checking video progress: ${error.message}`);
            }
        }
    }, []); // Empty dependency array is okay here


    const toggleMute = () => { /* ... keep mute logic ... */
        if (videoRef.current) { videoRef.current.muted = !videoRef.current.muted; setIsMuted(videoRef.current.muted); }
    };

    const handleModeSelect = (mode) => { /* Updated for new UI */
        setSelectedMode(mode);
        setDisplayMode('list'); // Default result view
        // Don't reset customPrompt if selecting 'Custom' again
        if (mode !== 'Custom') setCustomPrompt(''); // Clear custom prompt if preset selected
    };

    const copyToClipboard = (text) => { /* ... keep copy logic ... */
        navigator.clipboard.writeText(text).then(() => console.log('Text copied'), (err) => console.error('Copy failed: ', err));
    };

    const cancelProcessing = () => { /* ... keep cancel logic ... */
         if (abortController) { abortController.abort(); setIsProcessing(false); writeToLog({ type: 'info', action: 'cancel_processing' }); }
    };

    const saveToHistory = (mode, results, rawResponse) => { /* ... keep history saving logic ... */ 
        const newAnalysis = { id: Date.now(), timestamp: new Date().toISOString(), mode, results, rawResponse, videoUrl: vidUrl, originalFileName };
        const updatedHistory = [newAnalysis, ...analysisHistory];
        setAnalysisHistory(updatedHistory);
        localStorage.setItem('analysisHistory', JSON.stringify(updatedHistory));
    };

    const loadFromHistory = (analysis) => { /* ... keep history loading logic ... */
        setTimecodeList(analysis.results); setRawAIResponse(analysis.rawResponse);
        setSelectedMode(analysis.mode); setVidUrl(analysis.videoUrl); setOriginalFileName(analysis.originalFileName || '');
        setFile({ name: 'loaded_from_history' }); // Set a dummy file state if needed for generate button logic
        setShowHistoryPanel(false); // Close panel
        // Determine display mode based on loaded mode
        setDisplayMode(analysis.mode === 'Paragraph' ? 'paragraph' : 'list');
         // If loaded analysis was custom, set the prompt (though it's not stored in history item)
        // maybe store the prompt used in the history item?
        // setCustomPrompt(analysis.promptUsed || '');
    };

    const deleteFromHistory = (analysisId) => { /* ... keep history delete logic ... */
        const updatedHistory = analysisHistory.filter(a => a.id !== analysisId);
        setAnalysisHistory(updatedHistory);
        localStorage.setItem('analysisHistory', JSON.stringify(updatedHistory));
    };

    const saveTemplate = () => { /* ... keep template saving logic ... */
        if (!templateName.trim() || !customPrompt.trim()) return;
        const newTemplate = { id: Date.now(), name: templateName, prompt: customPrompt };
        const updatedTemplates = [...customTemplates, newTemplate];
        setCustomTemplates(updatedTemplates);
        setTemplateName(''); // Clear name input
        localStorage.setItem('customTemplates', JSON.stringify(updatedTemplates));
    };

    const loadTemplate = (template) => { /* ... keep template loading logic ... */
         setCustomPrompt(template.prompt); setSelectedMode('Custom'); setShowTemplatesPanel(false);
    };

    const deleteTemplate = (templateId) => { /* ... keep template delete logic ... */
        const updatedTemplates = customTemplates.filter(t => t.id !== templateId);
        setCustomTemplates(updatedTemplates);
        localStorage.setItem('customTemplates', JSON.stringify(updatedTemplates));
    };

    // Load history/templates on mount
    useEffect(() => {
        setAnalysisHistory(JSON.parse(localStorage.getItem('analysisHistory') || '[]'));
        setCustomTemplates(JSON.parse(localStorage.getItem('customTemplates') || '[]'));
    }, []);

    const generateContent = useCallback(async () => { /* ... keep generate content logic, ensuring prompt selection works ... */
        if (!file) { alert("Please upload a video first."); return; }
        setIsProcessing(true); setTimecodeList(null); setRawAIResponse(null); // Reset results
        const controller = new AbortController(); setAbortController(controller);

        try {
            const isCustom = selectedMode === 'Custom';
            const finalPrompt = isCustom ? customPrompt : modes[selectedMode]?.prompt;
            if (!finalPrompt || (isCustom && !finalPrompt.trim())) {
                throw new Error("No valid prompt selected or entered.");
            }
            await writeToLog({ type: 'request', action: 'generate_content', mode: selectedMode, useCustomPrompt: isCustom, prompt: finalPrompt });
            // Adjust API URL
            const serverPort = process.env.REACT_APP_SERVER_PORT || '';
            const apiUrl = serverPort ? `http://localhost:${serverPort}/api/prompt` : '/api/prompt';
            const response = await fetch(apiUrl, {
                method: 'POST', headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
                body: JSON.stringify({ uploadResult: file, prompt: finalPrompt, model: 'gemini-2.0-flash' }), // Use correct model name
                signal: controller.signal
            });
            const responseText = await response.text();
            if (!response.ok) throw new Error(`Content generation failed: ${response.status}. ${responseText}`);
            const data = JSON.parse(responseText);
            if (data.error) throw new Error(data.error);
            await writeToLog({ type: 'response', action: 'generate_content', mode: selectedMode, status: 'success', rawResponse: data.text });

            // Determine display mode and parse results
            const currentDisplayMode = selectedMode === 'Paragraph' ? 'paragraph' : 'list';
            setDisplayMode(currentDisplayMode);
            const parsedResults = parseTimecodes(data.text); // Use consistent parsing

            setTimecodeList(parsedResults);
            setRawAIResponse(data.text);
            saveToHistory(selectedMode, parsedResults, data.text); // Save successful result

        } catch (error) {
            if (error.name === 'AbortError') { console.log('Request cancelled.'); return; }
            console.error('Error generating content:', error);
            await writeToLog({ type: 'error', action: 'generate_content', mode: selectedMode, error: error.message });
            if (error.message.includes('API key')) alert('API key error. Check configuration.');
            else if (error.message.includes('Failed to fetch')) alert('Network error. Ensure server is running.');
            else alert(`Error: ${error.message}`);
        } finally {
            setIsProcessing(false); setAbortController(null);
        }
    }, [file, selectedMode, customPrompt, saveToHistory]); // Dependencies

    const parseTimecodes = (text) => { /* ... keep parsing logic ... */
        if (!text) return [];
        // Improved regex to handle potential missing spaces and different list formats
        const regex = /(\[(\d{1,2}:\d{2}(?::\d{2})?)\]|\*|-)\s*(.*?)(?=\[(\d{1,2}:\d{2}(?::\d{2})?)\]|\*|-|\n\n|$)/gs;
        const matches = [...text.matchAll(regex)];
        // Handle cases where the response might just be text without timecodes
        if (matches.length === 0 && text.trim().length > 0) {
           return [{ time: 'N/A', text: text.trim() }];
        }
        return matches.map(match => ({
           time: match[2] || 'N/A', // Use timecode if captured, otherwise N/A
           text: match[3].trim().replace(/^- /, '') // Remove leading list markers if any
        })).filter(item => item.text); // Filter out empty text entries
    };


    const togglePlay = () => { /* ... keep play toggle logic ... */
        if (videoRef.current) { videoRef.current.paused ? videoRef.current.play() : videoRef.current.pause(); }
    };
    const jumpToTimecode = (time) => { /* ... keep jump logic ... */
        if (videoRef.current && time !== 'N/A') { videoRef.current.currentTime = timeToSecs(time); }
    };
    const timeToSecs = (timecode) => { /* ... keep time conversion logic ... */
         if (!timecode || timecode === 'N/A') return 0;
         const parts = timecode.split(':').map(Number);
         if (parts.length === 2) return parts[0] * 60 + parts[1];
         if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
         return 0; // Fallback
    };
    const handleTimeUpdate = () => { /* ... keep time update logic ... */ if (videoRef.current) setCurrentTime(videoRef.current.currentTime); };
    const handleDurationChange = () => { /* ... keep duration logic ... */ if (videoRef.current) setDuration(videoRef.current.duration); };
    const handleScrubberChange = (e) => { /* ... keep scrubber logic ... */
         const newTime = parseFloat(e.target.value); setCurrentTime(newTime); if (videoRef.current) videoRef.current.currentTime = newTime;
    };
    const handleRemoveVideo = () => { /* ... keep remove video logic ... */
        if (videoRef.current) videoRef.current.pause();
        setVidUrl(null); setFile(null); setOriginalFileName(''); setCurrentTime(0); setDuration(0); setIsPlaying(false);
        setTimecodeList(null); setRawAIResponse(null); setIsProcessing(false); // Reset state
        if (abortController) abortController.abort(); // Cancel any ongoing processing
        writeToLog({ type: 'info', action: 'remove_video' });
    };
    const clearResults = () => { /* ... keep clear results logic ... */
         setTimecodeList(null); setRawAIResponse(null);
    };

    // --- Render Functions (Using New Structure) ---

    const renderVideoSection = () => (
        <div className="LabsSectionCard VideoSection">
            {vidUrl && !isLoadingVideo ? (
                <div className="VideoPlayerContainer">
                    <video
                        ref={videoRef} src={vidUrl} className="VideoElement"
                        onClick={togglePlay} onTimeUpdate={handleTimeUpdate} onDurationChange={handleDurationChange}
                        onPlay={() => setIsPlaying(true)} onPause={() => setIsPlaying(false)}
                        muted={isMuted} crossOrigin="anonymous" playsInline // Added playsInline
                    />
                    {originalFileName && <div className="VideoFileNameDisplay">{originalFileName}</div>}
                    <div className="VideoControlsBar">
                        <button className="LabsIconButton" onClick={togglePlay} title={isPlaying ? 'Pause' : 'Play'}>
                            {isPlaying ? <Pause size={18} /> : <Play size={18} />}
                        </button>
                        <input
                            type="range" min="0" max={duration || 0} value={currentTime}
                            onChange={handleScrubberChange} className="VideoScrubberInput"
                            aria-label="Video progress scrubber"
                            style={{ backgroundSize: `${(currentTime / (duration || 1)) * 100}% 100%` }}
                        />
                        <span className="VideoTimeDisplay">{formatTime(currentTime)} / {formatTime(duration)}</span>
                        <button className="LabsIconButton" onClick={toggleMute} title={isMuted ? 'Unmute' : 'Mute'}>
                            {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
                        </button>
                        <button className="LabsIconButton danger" onClick={handleRemoveVideo} title="Remove video">
                            <X size={18} />
                        </button>
                    </div>
                </div>
            ) : (
                <label className="VideoUploadArea" htmlFor="labs-video-upload" onDragOver={handleDragOver} onDrop={handleDrop}>
                    <input id="labs-video-upload" type="file" ref={fileInputRef} onChange={handleFileChange} accept="video/*,audio/*" style={{ display: 'none' }} />
                    {isLoadingVideo ? (
                        <div className="UploadStatusIndicator">
                            <Loader2 className="spinning" size={32} /><span>Processing...</span>
                        </div>
                    ) : videoError ? (
                        <div className="UploadStatusIndicator error">
                            <X size={32} /><span>Error processing. Try again.</span>
                        </div>
                    ) : (
                        <div className="UploadPromptContent">
                            <FileVideo size={40} />
                            <span>Drag & drop video/audio or click</span>
                            <span className="UploadHintText">MP4, MOV, MP3, WAV etc. (Max ~100MB)</span>
                        </div>
                    )}
                </label>
            )}
        </div>
    );

    const renderModesSection = () => (
        <div className="LabsSectionCard ModesSection">
            <label htmlFor="mode-select" className="SectionSubHeader">Analysis Mode</label>
            <div className="ModeSelectionRow">
                <select id="mode-select" className="ModeSelectDropdown" value={selectedMode} onChange={(e) => handleModeSelect(e.target.value)}>
                    {Object.entries(modes).map(([key, { emoji }]) => (
                        <option key={key} value={key}>{emoji} {key}</option>
                    ))}
                    <option value="Custom">🔧 Custom</option>
                </select>
                 <div className="tooltip">
                     <button className="LabsIconButton" onClick={() => alert(selectedMode === 'Custom' ? 'Enter your custom analysis instructions below.' : modes[selectedMode]?.description || 'Select a mode')} title="Mode Info">
                         <Info size={18}/>
                    </button>
                    {/* Tooltip text could be dynamic based on selected mode if needed */}
                    {/* <span className="tooltiptext">{selectedMode === 'Custom' ? 'Enter custom instructions' : modes[selectedMode]?.description}</span> */}
                 </div>
            </div>

            {selectedMode === 'Custom' && (
                <div className="CustomPromptArea">
                    <textarea
                        ref={customPromptRef}
                        className="CustomPromptTextarea"
                        placeholder="Enter custom analysis instructions here..."
                        value={customPrompt}
                        onChange={(e) => setCustomPrompt(e.target.value)}
                        rows={3}
                    />
                    <div className="TemplateActionsBar">
                         <div className="tooltip">
                             <button className="LabsTextButton" onClick={() => setShowTemplatesPanel(true)} title="Load Template">
                                 <FolderOpen size={16}/> Load
                            </button>
                            {/* <span className="tooltiptext">Load a saved template</span> */}
                         </div>
                         <div className="tooltip">
                            <button className="LabsTextButton" onClick={() => setShowTemplatesPanel(true)} title="Save as Template">
                                 <Save size={16}/> Save
                            </button>
                            {/* <span className="tooltiptext">Save current prompt as template</span> */}
                         </div>
                    </div>
                </div>
            )}

            <button
                className="LabsPrimaryButton GenerateButton"
                onClick={isProcessing ? cancelProcessing : generateContent}
                disabled={!vidUrl || isLoadingVideo || (selectedMode === 'Custom' && !customPrompt.trim())}
            >
                {isProcessing ? (
                    <><Loader2 className="spinning" size={18} /> Processing... <X size={16} onClick={(e) => {e.stopPropagation(); cancelProcessing();}} style={{ cursor: 'pointer' }} title="Cancel"/></>
                ) : (
                    <><Wand2 size={18} /> Generate Analysis</>
                )}
            </button>
        </div>
    );

    const renderResultsSection = () => (
        timecodeList && ( // Only render if there are results
            <div className="LabsSectionCard ResultsSection" ref={responseContainerRef}>
                <div className="ResultsHeader">
                    <span className="SectionSubHeader">Results</span>
                    <div className="ResultActionsGroup">
                         <div className="tooltip">
                            <button className={`LabsIconButton ${displayMode === 'list' ? 'active' : ''}`} onClick={() => setDisplayMode('list')} title="List View"><List size={18} /></button>
                            {/* <span className="tooltiptext">List View</span> */}
                         </div>
                          <div className="tooltip">
                            <button className={`LabsIconButton ${displayMode === 'paragraph' ? 'active' : ''}`} onClick={() => setDisplayMode('paragraph')} title="Paragraph View"><Text size={18} /></button>
                            {/* <span className="tooltiptext">Paragraph View</span> */}
                          </div>
                         <div className="tooltip">
                            <button className="LabsIconButton" onClick={() => copyToClipboard(rawAIResponse || '')} title="Copy Raw Response"><Copy size={18} /></button>
                            {/* <span className="tooltiptext">Copy Raw AI Response</span> */}
                         </div>
                         <div className="tooltip">
                            <button className="LabsIconButton" onClick={() => setShowEnlargedView(true)} title="Enlarge View"><Maximize2 size={18} /></button>
                            {/* <span className="tooltiptext">Enlarge View</span> */}
                         </div>
                         <div className="tooltip">
                            <button className="LabsIconButton danger" onClick={clearResults} title="Clear Results"><X size={18} /></button>
                            {/* <span className="tooltiptext">Clear Results</span> */}
                         </div>
                    </div>
                </div>
                <div className="ResultsContentArea">
                    {displayMode === 'paragraph' ? (
                        <div className="ResultsParagraph">
                            {timecodeList.map((item, index) => (
                                <React.Fragment key={index}>
                                    {item.time !== 'N/A' && (
                                         <span className="TimecodeInline" onClick={() => jumpToTimecode(item.time)} title={`Jump to ${item.time}`}>[{item.time}]</span>
                                    )}
                                    {' '}{item.text}{' '}
                                </React.Fragment>
                            ))}
                        </div>
                    ) : ( // List view
                        <div className="ResultsList">
                            {timecodeList.map((item, index) => (
                                <div className="ResultItem" key={index} onClick={() => jumpToTimecode(item.time)} title={item.time !== 'N/A' ? `Jump to ${item.time}` : ''}>
                                    {item.time !== 'N/A' && <span className="ResultItemTimecode">{item.time}</span>}
                                    <span className="ResultItemText">{item.text}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        )
    );

    // --- Overlay Panel Render Functions (Keep Structure, ensure styling matches) ---
     const renderOverlayPanel = (title, showState, setShowState, content) => (
        showState && (
            <div className="LabsOverlayPanel">
                <div className="OverlayPanelHeader">
                    <h3>{title}</h3>
                     <div className="tooltip">
                        <button className="LabsIconButton" onClick={() => setShowState(false)} title={`Close ${title}`}>
                            <X size={18} />
                        </button>
                        {/* <span className="tooltiptext">Close</span> */}
                     </div>
                </div>
                <div className="OverlayPanelContent">
                    {content}
                </div>
            </div>
        )
    );

    const historyContent = (
        <div className="HistoryList">
            {analysisHistory.length === 0 ? (<p className="EmptyStateText">No analysis history yet.</p>) :
             analysisHistory.map((analysis) => (
                <div key={analysis.id} className="HistoryListItem">
                    <div className="HistoryItemInfo">
                        <span className="HistoryItemMode">{analysis.mode}</span>
                         {analysis.originalFileName && <span className="HistoryItemFile" title={analysis.originalFileName}>({analysis.originalFileName})</span>}
                        <span className="HistoryItemDate">{new Date(analysis.timestamp).toLocaleString()}</span>
                    </div>
                    <div className="HistoryItemActions">
                         <div className="tooltip">
                            <button className="LabsIconButton" onClick={() => loadFromHistory(analysis)} title="Load"><ChevronRight size={18} /></button>
                            {/* <span className="tooltiptext">Load this analysis</span> */}
                         </div>
                         <div className="tooltip">
                            <button className="LabsIconButton danger" onClick={() => deleteFromHistory(analysis.id)} title="Delete"><Trash2 size={18} /></button>
                            {/* <span className="tooltiptext">Delete this entry</span> */}
                         </div>
                    </div>
                </div>
             ))
            }
        </div>
    );

    const templatesContent = (
        <>
            <div className="TemplatesList">
                 {customTemplates.length === 0 ? (<p className="EmptyStateText">No saved templates.</p>) :
                 customTemplates.map((template) => (
                    <div key={template.id} className="TemplateListItem">
                        <span className="TemplateItemName">{template.name}</span>
                        <div className="TemplateItemActions">
                            <div className="tooltip">
                                <button className="LabsIconButton" onClick={() => loadTemplate(template)} title="Load"><ChevronRight size={18} /></button>
                                {/* <span className="tooltiptext">Load Template</span> */}
                            </div>
                            <div className="tooltip">
                                <button className="LabsIconButton danger" onClick={() => deleteTemplate(template.id)} title="Delete"><Trash2 size={18} /></button>
                                {/* <span className="tooltiptext">Delete Template</span> */}
                            </div>
                        </div>
                    </div>
                 ))
                }
            </div>
            <div className="SaveTemplateArea">
                 <p>Save current custom prompt as a template:</p>
                <input
                    type="text" placeholder="Template Name" value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)} className="TemplateNameInput"
                />
                <button className="LabsTextButton save-template" onClick={saveTemplate} disabled={!templateName.trim() || !customPrompt.trim()}>
                    <Save size={16}/> Save Current Prompt
                </button>
            </div>
        </>
    );

     // --- Main Return ---
    return (
        <div className={`LabsContainer ${theme}`}> {/* Use theme class */}
            {/* Header with Global Actions */}
            <div className="LabsHeader">
                <h2>Labs</h2>
                <div className="HeaderActions">
                     <div className="tooltip">
                        <button className="HeaderButton" onClick={() => setShowHistoryPanel(true)} title="Analysis History"><Clock size={18} /></button>
                        {/* <span className="tooltiptext">Analysis History</span> */}
                     </div>
                     <div className="tooltip">
                        <button className="HeaderButton" onClick={() => setShowTemplatesPanel(true)} title="Custom Templates"><Settings size={18} /></button>
                        {/* <span className="tooltiptext">Manage Custom Templates</span> */}
                     </div>
                    {/* Add other global actions if needed */}
                </div>
            </div>

            {/* Scrollable Content Area */}
            <div className="LabsContentWrapper">
                {renderVideoSection()}
                {vidUrl && !isLoadingVideo && !videoError && renderModesSection()}
                {renderResultsSection()}
                {/* Optional: Keep raw response section if needed */}
                {/* {renderRawResponse()} */}
            </div>

            {/* Overlay Panels */}
            {renderOverlayPanel("Analysis History", showHistoryPanel, setShowHistoryPanel, historyContent)}
            {renderOverlayPanel("Custom Templates", showTemplatesPanel, setShowTemplatesPanel, templatesContent)}

            {/* Enlarged View Popup (Modal) */}
            {showEnlargedView && timecodeList && (
                 <div className="EnlargedViewOverlay" onClick={() => setShowEnlargedView(false)}>
                     <div className="EnlargedViewModal" onClick={(e) => e.stopPropagation()}>
                        <div className="EnlargedViewHeader">
                            <h3>Analysis Results</h3>
                            <div className="ResultActionsGroup"> {/* Reuse styles */}
                                <div className="tooltip"><button className="LabsIconButton" onClick={() => copyToClipboard(rawAIResponse || '')} title="Copy Raw"><Copy size={18} /></button></div>
                                <div className="tooltip"><button className="LabsIconButton danger" onClick={() => setShowEnlargedView(false)} title="Close"><X size={18} /></button></div>
                            </div>
                        </div>
                        <div className="EnlargedViewBody">
                            {/* Reuse result rendering logic */}
                             {displayMode === 'paragraph' ? (
                                <div className="ResultsParagraph enlarged"> {/* Add enlarged class for potential style tweaks */}
                                     {timecodeList.map((item, index) => (
                                        <React.Fragment key={index}>
                                            {item.time !== 'N/A' && <span className="TimecodeInline" onClick={() => jumpToTimecode(item.time)} title={`Jump to ${item.time}`}>[{item.time}]</span>}
                                            {' '}{item.text}{' '}
                                        </React.Fragment>
                                    ))}
                                </div>
                            ) : (
                                <div className="ResultsList enlarged">
                                     {timecodeList.map((item, index) => (
                                        <div className="ResultItem" key={index} onClick={() => jumpToTimecode(item.time)} title={item.time !== 'N/A' ? `Jump to ${item.time}` : ''}>
                                            {item.time !== 'N/A' && <span className="ResultItemTimecode">{item.time}</span>}
                                            <span className="ResultItemText">{item.text}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
             {/* ChatPopup can be removed if EnlargedViewModal replaces its functionality */}
             {/* {isPopupOpen && <ChatPopup ... />} */}
        </div>
    );
};

export default Labs;