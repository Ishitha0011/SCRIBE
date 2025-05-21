/* eslint-disable */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
    Play, Pause, FileVideo, List, Text, MessageSquare, Clock, FileText, Music, User, BrainCircuit, // Using User/BrainCircuit for sender
    Volume2, VolumeX, Pencil, Copy, Maximize2, Wand2, ChevronRight, ChevronLeft,
    Loader2, X, ChevronUp, ChevronDown, Trash2, Settings, Save, FolderOpen, Info // Added Settings, Save, FolderOpen, Info
} from 'lucide-react';
import { useTheme } from '../ThemeContext';
import '../css/Labs.css'; // We will update this file
import ChatPopup from './ChatPopup'; // Assuming this exists and is styled
import Flashcards from './Flashcards'; // Import Flashcards component

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
    const [activeTool, setActiveTool] = useState('videoAnalysis'); // State for active tool

    // --- State Variables (Updated for multiple videos) ---
    const [videos, setVideos] = useState([]); // Array of video objects with file metadata and UI state
    const [activeVideoIndex, setActiveVideoIndex] = useState(null); // Currently expanded/playing video
    const [isLoadingVideo, setIsLoadingVideo] = useState(false);
    const [videoError, setVideoError] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [selectedMode, setSelectedMode] = useState('A/V captions'); // Default mode
    const [timecodeList, setTimecodeList] = useState(null); // Parsed results
    const [isProcessing, setIsProcessing] = useState(false);
    const [displayMode, setDisplayMode] = useState('list'); // 'list' or 'paragraph' for results
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
    const [uploadProgress, setUploadProgress] = useState({}); // Track upload progress for each file

    // --- Refs (Updated for multiple videos) ---
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

    const handleFileChange = (e) => {
        if (e.target.files && e.target.files.length > 0) {
            const filesToProcess = Array.from(e.target.files);
            const remainingSlots = 5 - videos.length;
            
            if (remainingSlots <= 0) {
                alert("Maximum of 5 videos allowed. Please remove some videos first.");
                return;
            }
            
            // Process only up to the remaining slot limit
            const filesToUpload = filesToProcess.slice(0, remainingSlots);
            for (const file of filesToUpload) {
                handleVideoUpload(file);
            }
        }
    };

    const handleDrop = (e) => {
        e.preventDefault();
        if (e.dataTransfer.files?.length > 0) {
            const filesToProcess = Array.from(e.dataTransfer.files);
            const remainingSlots = 5 - videos.length;
            
            if (remainingSlots <= 0) {
                alert("Maximum of 5 videos allowed. Please remove some videos first.");
                return;
            }
            
            // Process only up to the remaining slot limit
            const filesToUpload = filesToProcess.slice(0, remainingSlots);
            for (const file of filesToUpload) {
                handleVideoUpload(file);
            }
        }
    };
    
    const handleDragOver = (e) => e.preventDefault();

    const handleVideoUpload = useCallback(async (videoFile) => {
        if (!videoFile) return;
        
        setIsLoadingVideo(true);
        setVideoError(false);
        
        // Create a temporary video object with loading state
        const tempVideoId = Date.now().toString();
        const newVideo = {
            id: tempVideoId,
            originalFileName: videoFile.name,
            size: videoFile.size,
            url: URL.createObjectURL(videoFile),
            isExpanded: false, // Don't auto-expand anymore
            isLoading: true,
            error: false,
            file: null, // Will be populated after server upload
            uploadProgress: 0 // Start with 0% progress
        };
        
        // Initialize progress tracking
        setUploadProgress(prev => ({
            ...prev,
            [tempVideoId]: 0
        }));
        
        // Add to videos array
        setVideos(prevVideos => [...prevVideos, newVideo]);
        
        await writeToLog({ 
            type: 'info', 
            action: 'upload_video', 
            status: 'started', 
            filename: videoFile.name, 
            fileSize: videoFile.size 
        });
        
        try {
            const formData = new FormData();
            formData.set('video', videoFile);
            
            // Adjust API URL as needed
            const serverPort = process.env.REACT_APP_SERVER_PORT || '';
            const apiUrl = serverPort ? `http://localhost:${serverPort}/api/upload` : '/api/upload';
            
            // Create XHR for progress tracking
            const xhr = new XMLHttpRequest();
            
            // Set up progress tracking
            xhr.upload.addEventListener('progress', (event) => {
                if (event.lengthComputable) {
                    const progress = Math.round((event.loaded / event.total) * 100);
                    setUploadProgress(prev => ({
                        ...prev,
                        [tempVideoId]: progress
                    }));
                    
                    // Also update the video object's progress
                    setVideos(prevVideos => 
                        prevVideos.map(video => 
                            video.id === tempVideoId
                                ? { ...video, uploadProgress: progress }
                                : video
                        )
                    );
                }
            });
            
            // Use a promise to handle XHR response
            const response = await new Promise((resolve, reject) => {
                xhr.open('POST', apiUrl);
                xhr.onload = () => {
                    if (xhr.status >= 200 && xhr.status < 300) {
                        resolve(xhr.responseText);
                    } else {
                        reject(new Error(`Upload failed: ${xhr.status}. ${xhr.responseText}`));
                    }
                };
                xhr.onerror = () => reject(new Error('Network error during upload'));
                xhr.send(formData);
            });
            
            const data = JSON.parse(response);
            if (!data?.data?.name) throw new Error(`Invalid upload response format: ${response}`);
            
            await writeToLog({ 
                type: 'info', 
                action: 'upload_video', 
                status: 'success', 
                filename: videoFile.name, 
                fileId: data.data.name 
            });
            
            // Update the video in the array with the server data
            setVideos(prevVideos => prevVideos.map(video => 
                video.id === tempVideoId
                    ? { 
                        ...video, 
                        isLoading: false,
                        file: data.data,
                        uploadProgress: 100
                      }
                    : video
            ));
            
            // Start checking progress
            await checkProgress(data.data.name, tempVideoId);
            
        } catch (error) {
            console.error('Error uploading video:', error);
            
            // Update the video in the array with the error state
            setVideos(prevVideos => prevVideos.map(video => 
                video.id === tempVideoId
                    ? { 
                        ...video, 
                        isLoading: false,
                        error: true,
                        uploadProgress: 0
                      }
                    : video
            ));
            
            await writeToLog({ 
                type: 'error', 
                action: 'upload_video', 
                status: 'error', 
                error: error.message 
            });
            
            // User-friendly alerts
            if (error.message.includes('413') || error.message.includes('Payload Too Large')) 
                alert('Video file too large (Max ~100MB).');
            else if (error.message.includes('Failed to fetch')) 
                alert('Network error. Ensure server is running.');
            else 
                alert(`Error uploading video: ${error.message}`);
        } finally {
            setIsLoadingVideo(false);
            
            // Clean up progress tracking after either success or failure
            setUploadProgress(prev => {
                const newProgress = {...prev};
                delete newProgress[tempVideoId];
                return newProgress;
            });
        }
    }, [videos]); // Added videos to dependencies

    const checkProgress = useCallback(async (fileId, videoId) => {
        if (!fileId) return;
        
        try {
            // Adjust API URL
            const serverPort = process.env.REACT_APP_SERVER_PORT || '';
            const apiUrl = serverPort ? `http://localhost:${serverPort}/api/progress` : '/api/progress';
            const response = await fetch(apiUrl, { 
                method: 'POST', 
                headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' }, 
                body: JSON.stringify({ fileId }) 
            });
            
            const responseText = await response.text();
            if (!response.ok) throw new Error(`Progress check failed: ${response.status}. ${responseText}`);
            
            const data = JSON.parse(responseText);
            if (!data?.progress?.state) throw new Error(`Invalid progress response: ${responseText}`);
            
            await writeToLog({ 
                type: 'info', 
                action: 'check_progress', 
                fileId, 
                state: data.progress.state, 
                message: data.progress.message 
            });

            switch (data.progress.state) {
                case 'ACTIVE':
                    // Video is ready and active
                    setVideos(prevVideos => prevVideos.map(video => 
                        video.id === videoId
                            ? { ...video, isLoading: false }
                            : video
                    ));
                    break;
                case 'WARNING':
                    // Warning status
                    setVideos(prevVideos => prevVideos.map(video => 
                        video.id === videoId
                            ? { ...video, isLoading: false, error: true, errorMessage: data.progress.message }
                            : video
                    ));
                    alert(`Warning: ${data.progress.message}`);
                    break;
                case 'FAILED':
                    // Failed status
                    setVideos(prevVideos => prevVideos.map(video => 
                        video.id === videoId
                            ? { ...video, isLoading: false, error: true, errorMessage: data.progress.message || 'Unknown error' }
                            : video
                    ));
                    alert(`Processing failed: ${data.progress.message || 'Unknown error'}`);
                    break;
                default:
                    // Keep checking for pending states
                    setTimeout(() => checkProgress(fileId, videoId), 1500);
                    break;
            }
        } catch (error) {
            console.error('Error checking progress:', error);
            
            // Update the video with error state
            setVideos(prevVideos => prevVideos.map(video => 
                video.id === videoId
                    ? { ...video, isLoading: false, error: true, errorMessage: error.message }
                    : video
            ));
            
            await writeToLog({ 
                type: 'error', 
                action: 'check_progress', 
                fileId, 
                error: error.message 
            });
            
            // Only alert if not a specific backend failure state
            if (!error.message.includes('failed:') && !error.message.includes('Invalid progress response')) {
               alert(`Error checking video progress: ${error.message}`);
            }
        }
    }, []);

    // New function to handle video changes
    const handleVideoActivation = (index) => {
        // Reset video state for clean switching
        setCurrentTime(0);
        setDuration(0);
        setIsPlaying(false);
        
        // Update expanded state and set active index
        setVideos(prevVideos => prevVideos.map((video, idx) => ({
            ...video,
            isExpanded: idx === index ? !video.isExpanded : false
        })));
        setActiveVideoIndex(index);
    };

    // Update toggle function to use the new handler
    const toggleVideoExpanded = (index) => {
        handleVideoActivation(index);
    };

    // Update toggle play to handle the video ref better
    const togglePlay = () => { 
        if (videoRef.current) { 
            if (videoRef.current.paused) {
                videoRef.current.play().catch(err => {
                    console.warn("Error playing video:", err);
                });
            } else {
                videoRef.current.pause();
            }
        }
    };

    // Use this function when video loads to get correct duration
    const handleVideoLoad = () => {
        if (videoRef.current) {
            setDuration(videoRef.current.duration);
            setCurrentTime(videoRef.current.currentTime);
        }
    };

    // New function to remove a specific video
    const removeVideo = (videoId) => {
        setVideos(prevVideos => prevVideos.filter(video => video.id !== videoId));
        
        // Adjust active index if needed
        if (videos.length <= 1) {
            setActiveVideoIndex(null);
        } else if (activeVideoIndex >= videos.length - 1) {
            setActiveVideoIndex(videos.length - 2);
        }
    };

    const toggleMute = () => {
        if (videoRef.current) { 
            videoRef.current.muted = !videoRef.current.muted; 
            setIsMuted(videoRef.current.muted); 
        }
    };

    const handleModeSelect = (mode) => {
        setSelectedMode(mode);
        setDisplayMode('list'); // Default result view
        // Don't reset customPrompt if selecting 'Custom' again
        if (mode !== 'Custom') setCustomPrompt(''); // Clear custom prompt if preset selected
    };

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text).then(() => console.log('Text copied'), (err) => console.error('Copy failed: ', err));
    };

    const cancelProcessing = () => {
        if (abortController) { 
            abortController.abort(); 
            setIsProcessing(false); 
            writeToLog({ type: 'info', action: 'cancel_processing' }); 
        }
    };

    const saveToHistory = (mode, results, rawResponse) => {
        const activeVideo = videos[activeVideoIndex];
        if (!activeVideo) return;

        const newAnalysis = { 
            id: Date.now(), 
            timestamp: new Date().toISOString(), 
            mode, 
            results, 
            rawResponse, 
            videoIds: videos.map(v => v.id), // Store all video IDs
            videoUrls: videos.map(v => v.url), // Store all video URLs
            originalFileNames: videos.map(v => v.originalFileName), // Store all original file names
            activeVideoIndex // Store which video was active
        };
        
        const updatedHistory = [newAnalysis, ...analysisHistory];
        setAnalysisHistory(updatedHistory);
        localStorage.setItem('analysisHistory', JSON.stringify(updatedHistory));
    };

    const loadFromHistory = (analysis) => {
        // Clear existing videos
        setVideos([]);
        setTimecodeList(analysis.results);
        setRawAIResponse(analysis.rawResponse);
        setSelectedMode(analysis.mode);
        
        // Handle different history data formats (old single video vs new multiple videos)
        if (analysis.videoIds && analysis.videoUrls && analysis.originalFileNames) {
            // New format with multiple videos
            const loadedVideos = analysis.videoIds.map((id, idx) => ({
                id,
                url: analysis.videoUrls[idx],
                originalFileName: analysis.originalFileNames[idx],
                isExpanded: idx === analysis.activeVideoIndex,
                isLoading: false,
                error: false,
                file: { name: 'loaded_from_history' } // Set a dummy file state
            }));
            setVideos(loadedVideos);
            setActiveVideoIndex(analysis.activeVideoIndex || 0);
        } else if (analysis.videoUrl) {
            // Old format with single video
            const newVideo = {
                id: Date.now().toString(),
                url: analysis.videoUrl,
                originalFileName: analysis.originalFileName || '',
                isExpanded: true,
                isLoading: false,
                error: false,
                file: { name: 'loaded_from_history' } // Set a dummy file state
            };
            setVideos([newVideo]);
            setActiveVideoIndex(0);
        }
        
        setShowHistoryPanel(false); // Close panel
        setDisplayMode(analysis.mode === 'Paragraph' ? 'paragraph' : 'list');
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

    const generateContent = useCallback(async () => {
        // Verify we have at least one video
        if (videos.length === 0) { 
            alert("Please upload at least one video first."); 
            return; 
        }

        // Get all files for the uploaded videos
        const videoFiles = videos
            .filter(v => v.file && !v.error)
            .map(v => v.file);

        if (videoFiles.length === 0) {
            alert("No valid video files found. Please ensure at least one video is successfully uploaded.");
            return;
        }

        setIsProcessing(true);
        setTimecodeList(null);
        setRawAIResponse(null); // Reset results
        
        const controller = new AbortController();
        setAbortController(controller);

        try {
            const isCustom = selectedMode === 'Custom';
            const finalPrompt = isCustom ? customPrompt : modes[selectedMode]?.prompt;
            
            if (!finalPrompt || (isCustom && !finalPrompt.trim())) {
                throw new Error("No valid prompt selected or entered.");
            }
            
            await writeToLog({ 
                type: 'request', 
                action: 'generate_content', 
                mode: selectedMode, 
                useCustomPrompt: isCustom, 
                prompt: finalPrompt,
                videoCount: videoFiles.length
            });
            
            // Adjust API URL
            const serverPort = process.env.REACT_APP_SERVER_PORT || '';
            const apiUrl = serverPort ? `http://localhost:${serverPort}/api/prompt` : '/api/prompt';
            
            const response = await fetch(apiUrl, {
                method: 'POST', 
                headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    uploadResult: videoFiles, // Changed from uploadResults to uploadResult
                    prompt: finalPrompt, 
                    model: 'gemini-2.0-flash' // Use newer model that supports multiple videos
                }), 
                signal: controller.signal
            });
            
            const responseText = await response.text();
            if (!response.ok) throw new Error(`Content generation failed: ${response.status}. ${responseText}`);
            
            const data = JSON.parse(responseText);
            if (data.error) throw new Error(data.error);
            
            await writeToLog({ 
                type: 'response', 
                action: 'generate_content', 
                mode: selectedMode, 
                status: 'success', 
                rawResponse: data.text 
            });

            // Determine display mode and parse results
            const currentDisplayMode = selectedMode === 'Paragraph' ? 'paragraph' : 'list';
            setDisplayMode(currentDisplayMode);
            const parsedResults = parseTimecodes(data.text); // Use consistent parsing

            setTimecodeList(parsedResults);
            setRawAIResponse(data.text);
            saveToHistory(selectedMode, parsedResults, data.text); // Save successful result

        } catch (error) {
            if (error.name === 'AbortError') { 
                console.log('Request cancelled.'); 
                return; 
            }
            
            console.error('Error generating content:', error);
            
            await writeToLog({ 
                type: 'error', 
                action: 'generate_content', 
                mode: selectedMode, 
                error: error.message 
            });
            
            if (error.message.includes('API key')) alert('API key error. Check configuration.');
            else if (error.message.includes('Failed to fetch')) alert('Network error. Ensure server is running.');
            else alert(`Error: ${error.message}`);
        } finally {
            setIsProcessing(false);
            setAbortController(null);
        }
    }, [videos, activeVideoIndex, selectedMode, customPrompt, saveToHistory, modes]); // Updated dependencies

    const parseTimecodes = (text) => {
        if (!text) return [];
        
        // Split by newlines first to handle bullet points
        const lines = text.split('\n');
        const results = [];
        
        for (let line of lines) {
            line = line.trim();
            // Skip empty lines
            if (!line) continue;
            
            // Remove bullet point markers (* or -)
            line = line.replace(/^[*-]\s*/, '');
            
            // Extract timecode and text
            const timecodeMatch = line.match(/^(\d{1,2}:\d{2}(?::\d{2})?)\s*(.*)/);
            if (timecodeMatch) {
                results.push({
                    time: timecodeMatch[1],
                    text: timecodeMatch[2].trim()
                });
            } else if (line.length > 0) {
                // Handle lines without timecodes
                results.push({
                    time: 'N/A',
                    text: line
                });
            }
        }
        
        return results;
    };

    const handleTimeUpdate = () => { /* ... keep time update logic ... */ if (videoRef.current) setCurrentTime(videoRef.current.currentTime); };
    const handleDurationChange = () => { /* ... keep duration logic ... */ if (videoRef.current) setDuration(videoRef.current.duration); };
    const handleScrubberChange = (e) => { /* ... keep scrubber logic ... */
         const newTime = parseFloat(e.target.value); setCurrentTime(newTime); if (videoRef.current) videoRef.current.currentTime = newTime;
    };
    
    // Function to jump to a specific timecode
    const jumpToTimecode = (time) => {
        if (videoRef.current && time !== 'N/A') { 
            videoRef.current.currentTime = timeToSecs(time); 
        }
    };
    
    // Function to convert timecode to seconds
    const timeToSecs = (timecode) => {
         if (!timecode || timecode === 'N/A') return 0;
         const parts = timecode.split(':').map(Number);
         if (parts.length === 2) return parts[0] * 60 + parts[1];
         if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
         return 0; // Fallback
    };
    
    const handleRemoveVideo = () => {
        if (videoRef.current) videoRef.current.pause();
        setVideos([]);
        setCurrentTime(0);
        setDuration(0);
        setIsPlaying(false);
        setTimecodeList(null);
        setRawAIResponse(null);
        setIsProcessing(false);
        setActiveVideoIndex(null);
        if (abortController) abortController.abort();
        writeToLog({ type: 'info', action: 'remove_all_videos' });
    };
    const clearResults = () => {
        setTimecodeList(null);
        setRawAIResponse(null);
    };

    // New function to close video player without removing the video
    const closeVideoPlayer = (e, videoId) => {
        e.stopPropagation(); // Prevent triggering the click on the parent div
        
        // Find index of the video to close
        const index = videos.findIndex(v => v.id === videoId);
        if (index !== -1) {
            // Close video player by setting isExpanded to false
            setVideos(prevVideos => prevVideos.map((video, idx) => 
                idx === index ? { ...video, isExpanded: false } : video
            ));
            
            // Reset video state if the active video is being closed
            if (activeVideoIndex === index) {
                if (videoRef.current) videoRef.current.pause();
                setIsPlaying(false);
            }
        }
    };

    // --- Render Functions (Using New Structure) ---

    const renderVideoSection = () => (
        <div className="LabsSectionCard VideoSection">
            {videos.length > 0 ? (
                <div className="VideoListContainer">
                    <div className="VideoCounter">
                        <span className="VideoCounterText">
                            {videos.length} video{videos.length !== 1 ? 's' : ''} 
                            <span className="VideoCountLimit">(max 5)</span>
                        </span>
                        <div className="MultiVideo-Controls">
                            <button 
                                className="LabsTextButton compact" 
                                onClick={handleFileButtonClick} 
                                disabled={videos.length >= 5}
                                title="Add more videos"
                            >
                                <FileVideo size={14} /> Add
                            </button>
                            <button 
                                className="LabsTextButton danger compact" 
                                onClick={() => setVideos([])} 
                                disabled={videos.length === 0}
                                title="Remove all videos"
                            >
                                <Trash2 size={14} /> Clear
                            </button>
                        </div>
                    </div>
                    
                    <div className="VideoItemsList">
                        {videos.map((video, index) => (
                            <div 
                                key={video.id} 
                                className={`VideoListItem ${video.isExpanded ? 'expanded' : ''} ${video.error ? 'error' : ''}`}
                                onClick={() => toggleVideoExpanded(index)}
                            >
                                {/* Video info header (always shown) */}
                                <div className="VideoItemHeader">
                                    <div className="VideoItemThumbnail">
                                        <FileVideo size={18} />
                                    </div>
                                    
                                    <div className="VideoItemInfo">
                                        <div className="VideoItemName">
                                            {video.originalFileName}
                                            {video.isExpanded ? (
                                                <ChevronUp size={16} className="VideoExpandIcon" />
                                            ) : (
                                                <ChevronDown size={16} className="VideoExpandIcon" />
                                            )}
                                        </div>
                                        <div className="VideoItemMeta">
                                            {video.isLoading ? (
                                                <><Loader2 className="spinning" size={12} /> Processing...</>
                                            ) : video.error ? (
                                                <span className="error">Error: {video.errorMessage || 'Failed to process'}</span>
                                            ) : (
                                                <span>{Math.round(video.size / 1024 / 1024 * 10) / 10} MB</span>
                                            )}
                                        </div>
                                        
                                        {/* Upload progress bar */}
                                        {video.uploadProgress !== undefined && video.uploadProgress < 100 && (
                                            <div className="UploadProgressBar">
                                                <div 
                                                    className="UploadProgressBarFill" 
                                                    style={{ width: `${video.uploadProgress}%` }}
                                                ></div>
                                                <span className="UploadProgressText">{video.uploadProgress}%</span>
                                            </div>
                                        )}
                                    </div>
                                    
                                    <div className="VideoItemActions" onClick={e => e.stopPropagation()}>
                                        {video.isExpanded ? (
                                            <button 
                                                className="LabsIconButton small" 
                                                onClick={(e) => closeVideoPlayer(e, video.id)}
                                                title="Close player"
                                            >
                                                <X size={14} />
                                            </button>
                                        ) : (
                                            <button 
                                                className="LabsIconButton small danger" 
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    removeVideo(video.id);
                                                }}
                                                title="Remove video"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                                
                                {/* Video player (only shown when expanded) */}
                                {video.isExpanded && (
                <div className="VideoPlayerContainer">
                    <video
                                            ref={videoRef} 
                                            src={video.url} 
                                            className="VideoElement"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                togglePlay();
                                            }} 
                                            onTimeUpdate={handleTimeUpdate} 
                                            onLoadedMetadata={handleVideoLoad}
                                            onPlay={() => setIsPlaying(true)} 
                                            onPause={() => setIsPlaying(false)}
                                            muted={isMuted} 
                                            crossOrigin="anonymous" 
                                            playsInline
                                        />
                                        <div className="VideoFileNameDisplay">{video.originalFileName}</div>
                    <div className="VideoControlsBar">
                                            <button 
                                                className="LabsIconButton small" 
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    togglePlay();
                                                }} 
                                                title={isPlaying ? 'Pause' : 'Play'}
                                            >
                                                {isPlaying ? <Pause size={16} /> : <Play size={16} />}
                        </button>
                        <input
                                                type="range" 
                                                min="0" 
                                                max={duration || 0} 
                                                value={currentTime || 0}
                                                onChange={handleScrubberChange} 
                                                className="VideoScrubberInput"
                            aria-label="Video progress scrubber"
                            style={{ backgroundSize: `${(currentTime / (duration || 1)) * 100}% 100%` }}
                                                onClick={e => e.stopPropagation()}
                                            />
                                            <span className="VideoTimeDisplay">
                                                {formatTime(currentTime)} / {formatTime(duration)}
                                            </span>
                                            <button 
                                                className="LabsIconButton small" 
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    toggleMute();
                                                }} 
                                                title={isMuted ? 'Unmute' : 'Mute'}
                                            >
                                                {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
                        </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            ) : (
                <label className="VideoUploadArea" htmlFor="labs-video-upload" onDragOver={handleDragOver} onDrop={handleDrop}>
                    <input 
                        id="labs-video-upload" 
                        type="file" 
                        ref={fileInputRef} 
                        onChange={handleFileChange} 
                        accept="video/*,audio/*" 
                        style={{ display: 'none' }} 
                        multiple
                    />
                    {isLoadingVideo ? (
                        <div className="UploadStatusIndicator">
                            <Loader2 className="spinning" size={24} /><span>Processing...</span>
                        </div>
                    ) : videoError ? (
                        <div className="UploadStatusIndicator error">
                            <X size={24} /><span>Error processing. Try again.</span>
                        </div>
                    ) : (
                        <div className="UploadPromptContent">
                            <FileVideo size={32} />
                            <span>Drag videos/audio or click to upload</span>
                            <span className="UploadHintText">MP4, MOV, MP3, WAV etc. (Max 100MB/file, up to 5 files)</span>
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
                         </div>
                         <div className="tooltip">
                            <button className="LabsTextButton" onClick={() => setShowTemplatesPanel(true)} title="Save as Template">
                                 <Save size={16}/> Save
                            </button>
                         </div>
                    </div>
                </div>
            )}

            <button
                className="LabsPrimaryButton GenerateButton"
                onClick={isProcessing ? cancelProcessing : generateContent}
                disabled={
                    videos.length === 0 || 
                    videos.every(v => v.isLoading || v.error) || 
                    (selectedMode === 'Custom' && !customPrompt.trim())
                }
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
                         </div>
                          <div className="tooltip">
                            <button className={`LabsIconButton ${displayMode === 'paragraph' ? 'active' : ''}`} onClick={() => setDisplayMode('paragraph')} title="Paragraph View"><Text size={18} /></button>
                          </div>
                         <div className="tooltip">
                            <button className="LabsIconButton" onClick={() => copyToClipboard(rawAIResponse || '')} title="Copy Raw Response"><Copy size={18} /></button>
                         </div>
                         <div className="tooltip">
                            <button className="LabsIconButton" onClick={() => setShowEnlargedView(true)} title="Enlarge View"><Maximize2 size={18} /></button>
                         </div>
                         <div className="tooltip">
                            <button className="LabsIconButton danger" onClick={clearResults} title="Clear Results"><X size={18} /></button>
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
                                    {' '}{item.text}{index < timecodeList.length - 1 ? '\n' : ''}
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

    // --- Overlay Panel Render Functions ---
     const renderOverlayPanel = (title, showState, setShowState, content) => (
        showState && (
            <div className="LabsOverlayPanel">
                <div className="OverlayPanelHeader">
                    <h3>{title}</h3>
                     <div className="tooltip">
                        <button className="LabsIconButton" onClick={() => setShowState(false)} title={`Close ${title}`}>
                            <X size={18} />
                        </button>
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
            {analysisHistory.length === 0 ? (
                <p className="EmptyStateText">No analysis history yet.</p>
            ) : (
             analysisHistory.map((analysis) => (
                <div key={analysis.id} className="HistoryListItem">
                    <div className="HistoryItemInfo">
                        <span className="HistoryItemMode">{analysis.mode}</span>
                            {analysis.originalFileNames && analysis.originalFileNames.length > 0 && (
                                <span className="HistoryItemFile" title={analysis.originalFileNames.join(', ')}>
                                    ({analysis.originalFileNames.length} video{analysis.originalFileNames.length !== 1 ? 's' : ''})
                                </span>
                            )}
                        <span className="HistoryItemDate">{new Date(analysis.timestamp).toLocaleString()}</span>
                    </div>
                    <div className="HistoryItemActions">
                         <div className="tooltip">
                                <button className="LabsIconButton" onClick={() => loadFromHistory(analysis)} title="Load">
                                    <ChevronRight size={18} />
                                </button>
                         </div>
                         <div className="tooltip">
                                <button 
                                    className="LabsIconButton danger" 
                                    onClick={() => deleteFromHistory(analysis.id)} 
                                    title="Delete"
                                >
                                    <Trash2 size={18} />
                                </button>
                         </div>
                    </div>
                </div>
             ))
            )}
        </div>
    );

    const templatesContent = (
        <>
            <div className="TemplatesList">
                {customTemplates.length === 0 ? (
                    <p className="EmptyStateText">No saved templates.</p>
                ) : (
                 customTemplates.map((template) => (
                    <div key={template.id} className="TemplateListItem">
                        <span className="TemplateItemName">{template.name}</span>
                        <div className="TemplateItemActions">
                            <div className="tooltip">
                                    <button className="LabsIconButton" onClick={() => loadTemplate(template)} title="Load">
                                        <ChevronRight size={18} />
                                    </button>
                            </div>
                            <div className="tooltip">
                                    <button 
                                        className="LabsIconButton danger" 
                                        onClick={() => deleteTemplate(template.id)} 
                                        title="Delete"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                            </div>
                        </div>
                    </div>
                 ))
                )}
            </div>
            <div className="SaveTemplateArea">
                 <p>Save current custom prompt as a template:</p>
                <input
                    type="text" placeholder="Template Name" value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)} className="TemplateNameInput"
                />
                <button 
                    className="LabsTextButton save-template" 
                    onClick={saveTemplate} 
                    disabled={!templateName.trim() || !customPrompt.trim()}
                >
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
                <div className="LabsHeaderNav">
                    <button
                        className={`LabsNavButton ${activeTool === 'videoAnalysis' ? 'active' : ''}`}
                        onClick={() => setActiveTool('videoAnalysis')}
                    >
                        Video Analysis
                    </button>
                    <button
                        className={`LabsNavButton ${activeTool === 'flashcards' ? 'active' : ''}`}
                        onClick={() => setActiveTool('flashcards')}
                    >
                        Flashcards
                    </button>
                </div>
                <div className="HeaderActions">
                     <div className="tooltip">
                        <button className="HeaderButton" onClick={() => setShowHistoryPanel(true)} title="Analysis History"><Clock size={18} /></button>
                     </div>
                     <div className="tooltip">
                        <button className="HeaderButton" onClick={() => setShowTemplatesPanel(true)} title="Custom Templates"><Settings size={18} /></button>
                     </div>
                </div>
            </div>

            {/* Scrollable Content Area */}
            <div className="LabsContentWrapper">
              {activeTool === 'videoAnalysis' && (
                <>
                  {renderVideoSection()}
                  {videos.length > 0 && videos.some(v => !v.isLoading && !v.error) && renderModesSection()}
                  {renderResultsSection()}
                </>
              )}
              {activeTool === 'flashcards' && (
                <Flashcards />
              )}
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
                            <div className="ResultActionsGroup">
                                <div className="tooltip"><button className="LabsIconButton" onClick={() => copyToClipboard(rawAIResponse || '')} title="Copy Raw"><Copy size={18} /></button></div>
                                <div className="tooltip"><button className="LabsIconButton danger" onClick={() => setShowEnlargedView(false)} title="Close"><X size={18} /></button></div>
                            </div>
                        </div>
                        <div className="EnlargedViewBody">
                             {displayMode === 'paragraph' ? (
                                <div className="ResultsParagraph enlarged">
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
        </div>
    );
};

export default Labs;