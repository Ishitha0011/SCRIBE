import React, { useState, useRef, useEffect } from 'react';
import { 
  Play, Pause, FileVideo, List, Text, 
  MessageSquare, Clock, FileText, Music,
  Volume2, VolumeX, Pencil, Copy, Maximize2,
  Wand2, ChevronRight, ChevronLeft, Loader2, X, ChevronUp, ChevronDown, Trash2
} from 'lucide-react';
import { useTheme } from '../ThemeContext';
import '../css/Labs.css';
import ChatPopup from './ChatPopup';

// Utility function to write logs to a file
const writeToLog = async (logEntry) => {
  try {
    const timestamp = new Date().toISOString();
    const formattedLog = `[${timestamp}] ${JSON.stringify(logEntry)}\n`;
    
    // Use the fetch API to log to a file via a simple endpoint
    const response = await fetch('http://localhost:9999/log', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ log: formattedLog })
    });
    
    if (!response.ok) {
      console.error('Failed to write to log file');
    }
  } catch (error) {
    console.error('Error writing to log file:', error);
  }
};

const Labs = ({ darkMode }) => {
  const { theme } = useTheme();
  // Monitor actual dark mode status from both theme context and prop
  const isDarkMode = typeof darkMode !== 'undefined' ? darkMode : theme === 'dark';
  
  const [vidUrl, setVidUrl] = useState(null);
  const [file, setFile] = useState(null);
  const [isLoadingVideo, setIsLoadingVideo] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedMode, setSelectedMode] = useState('A/V captions');
  const [timecodeList, setTimecodeList] = useState(null);
  const [requestedTimecode, setRequestedTimecode] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [displayMode, setDisplayMode] = useState('list');
  const [hoveredTimecode, setHoveredTimecode] = useState(null);
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const [rawAIResponse, setRawAIResponse] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [showModes, setShowModes] = useState(true);
  const [isCustomMode, setIsCustomMode] = useState(false);
  const [showEnlargedView, setShowEnlargedView] = useState(false);
  const [abortController, setAbortController] = useState(null);
  const [analysisHistory, setAnalysisHistory] = useState([]);
  const [customTemplates, setCustomTemplates] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [currentTemplate, setCurrentTemplate] = useState('');
  const [templateName, setTemplateName] = useState('');
  
  const videoRef = useRef(null);
  const fileInputRef = useRef(null);
  const chartRef = useRef(null);
  const responseContainerRef = useRef(null);

  // Modes available for video analysis
  const modes = {
    'Key moments': {
      emoji: '🔑',
      icon: <Clock size={24} />,
      prompt: `Generate bullet points for the key moments in this video.`,
      description: 'Identifies important moments in the video with timestamps'
    },
    'Paragraph': {
      emoji: '📝',
      icon: <FileText size={24} />,
      prompt: `Generate a paragraph that summarizes this video. Keep it to 3 to 5 sentences.`,
      description: 'Creates a concise paragraph summary of the entire video'
    },
    'Haiku': {
      emoji: '🌸',
      icon: <Music size={24} />,
      prompt: `Generate a haiku for the video. Make sure to follow the syllable count rules (5-7-5).`,
      description: 'Generates a creative Japanese-style poem with 5-7-5 syllable pattern'
    },
    'A/V captions': {
      emoji: '👀',
      icon: <MessageSquare size={24} />,
      prompt: `For each scene in this video, generate captions that describe the scene along with any spoken text placed in quotation marks.`,
      description: 'Creates captions describing both visual content and dialog for each scene'
    },
    'Custom': {
      emoji: '🔧',
      icon: <Pencil size={24} />,
      prompt: customPrompt => customPrompt,
      description: 'Create your own custom prompt for analyzing the video'
    }
  };

  // State for custom prompt
  const [customPrompt, setCustomPrompt] = useState('');
  const [showCustomPrompt, setShowCustomPrompt] = useState(false);

  // Scroll to response when generated
  useEffect(() => {
    if (timecodeList && timecodeList.length > 0 && responseContainerRef.current) {
      responseContainerRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [timecodeList]);

  // Handle window resize for responsive design
  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Format time for display
  const formatTime = (time) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleFileButtonClick = () => {
    fileInputRef.current.click();
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      handleVideoUpload(file);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      handleVideoUpload(file);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleVideoUpload = async (videoFile) => {
    setIsLoadingVideo(true);
    setVidUrl(URL.createObjectURL(videoFile));
    setVideoError(false);

    try {
      // Log the start of video upload
      await writeToLog({
        type: 'info',
        action: 'upload_video',
        status: 'started',
        filename: videoFile.name,
        fileSize: videoFile.size,
        timestamp: new Date().toISOString()
      });
      
      const formData = new FormData();
      formData.set('video', videoFile);
      
      const serverPort = process.env.REACT_APP_SERVER_PORT || '';
      const apiUrl = serverPort ? `http://localhost:${serverPort}/api/upload` : '/api/upload';
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        body: formData
      });
      
      const responseText = await response.text();
      
      if (!response.ok) {
        const errorMsg = `Failed to upload video. Status: ${response.status}. ${responseText}`;
        await writeToLog({
          type: 'error',
          action: 'upload_video',
          status: 'failed',
          error: errorMsg,
          timestamp: new Date().toISOString()
        });
        throw new Error(errorMsg);
      }
      
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (e) {
        const errorMsg = `Invalid JSON response: ${responseText}`;
        await writeToLog({
          type: 'error',
          action: 'upload_video',
          status: 'failed',
          error: errorMsg,
          timestamp: new Date().toISOString()
        });
        throw new Error(errorMsg);
      }
      
      if (!data || !data.data) {
        const errorMsg = `Invalid response format: ${JSON.stringify(data)}`;
        await writeToLog({
          type: 'error',
          action: 'upload_video', 
          status: 'failed',
          error: errorMsg,
          timestamp: new Date().toISOString()
        });
        throw new Error(errorMsg);
      }

      // Log successful upload
      await writeToLog({
        type: 'info',
        action: 'upload_video',
        status: 'success',
        filename: videoFile.name,
        fileId: data.data.name,
        timestamp: new Date().toISOString()
      });

      setFile(data.data);
      checkProgress(data.data.name);
    } catch (error) {
      console.error('Error uploading video:', error);
      setVideoError(true);
      setIsLoadingVideo(false);
      
      if (error.message.includes('413') || error.message.includes('Payload Too Large')) {
        alert('The video file is too large. Please try a smaller file (under 100MB).');
      } else if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
        alert('Network error. Please check your connection and ensure the server is running.');
      } else {
        alert(`Error uploading video: ${error.message}`);
      }
      
      // Log general error if not already logged
      if (!error.message.includes('Failed to upload video') && 
          !error.message.includes('Invalid JSON response') && 
          !error.message.includes('Invalid response format')) {
        await writeToLog({
          type: 'error',
          action: 'upload_video',
          status: 'error',
          error: error.message,
          stack: error.stack,
          timestamp: new Date().toISOString()
        });
      }
    }
  };

  const checkProgress = async (fileId) => {
    try {
      const serverPort = process.env.REACT_APP_SERVER_PORT || '';
      const apiUrl = serverPort ? `http://localhost:${serverPort}/api/progress` : '/api/progress';
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ fileId })
      });
      
      const responseText = await response.text();
      
      if (!response.ok) {
        const errorMsg = `Failed to check progress. Status: ${response.status}. ${responseText}`;
        await writeToLog({
          type: 'error',
          action: 'check_progress',
          fileId,
          error: errorMsg,
          timestamp: new Date().toISOString()
        });
        throw new Error(errorMsg);
      }
      
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (e) {
        const errorMsg = `Invalid JSON response: ${responseText}`;
        await writeToLog({
          type: 'error',
          action: 'check_progress',
          fileId,
          error: errorMsg,
          timestamp: new Date().toISOString()
        });
        throw new Error(errorMsg);
      }
      
      if (!data.progress) {
        const errorMsg = `Invalid progress response format: ${JSON.stringify(data)}`;
        await writeToLog({
          type: 'error',
          action: 'check_progress',
          fileId,
          error: errorMsg,
          timestamp: new Date().toISOString()
        });
        throw new Error(errorMsg);
      }
      
      // Log progress state
      await writeToLog({
        type: 'info',
        action: 'check_progress',
        fileId,
        state: data.progress.state,
        message: data.progress.message || null,
        timestamp: new Date().toISOString()
      });
      
      if (data.progress.state === 'ACTIVE') {
        setIsLoadingVideo(false);
      } else if (data.progress.state === 'WARNING') {
        setVideoError(true);
        setIsLoadingVideo(false);
        alert(`Warning: ${data.progress.message}`);
      } else if (data.progress.state === 'FAILED') {
        setVideoError(true);
        setIsLoadingVideo(false);
      } else {
        setTimeout(() => checkProgress(fileId), 1000);
      }
    } catch (error) {
      console.error('Error checking progress:', error);
      setVideoError(true);
      setIsLoadingVideo(false);
      
      // Only log if not already logged
      if (!error.message.includes('Failed to check progress') && 
          !error.message.includes('Invalid JSON response') && 
          !error.message.includes('Invalid progress response format')) {
        await writeToLog({
          type: 'error',
          action: 'check_progress',
          fileId,
          error: error.message,
          stack: error.stack,
          timestamp: new Date().toISOString()
        });
      }
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      const newMutedState = !videoRef.current.muted;
      videoRef.current.muted = newMutedState;
      setIsMuted(newMutedState);
    }
  };

  const handleModeSelect = (mode) => {
    setSelectedMode(mode);
    // Reset display mode when changing modes
    setDisplayMode('list');
    // If custom mode, show custom prompt
    if (mode === 'Custom') {
      setShowCustomPrompt(true);
      setIsCustomMode(true);
    } else {
      setShowCustomPrompt(false);
      setIsCustomMode(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(
      () => {
        // You could add a visual confirmation here if desired
        console.log('Text copied to clipboard');
      },
      (err) => {
        console.error('Could not copy text: ', err);
      }
    );
  };

  const cancelProcessing = () => {
    if (abortController) {
      abortController.abort();
      setIsProcessing(false);
      
      // Log cancellation
      writeToLog({
        type: 'info',
        action: 'cancel_processing',
        timestamp: new Date().toISOString()
      });
    }
  };

  const toggleCustomMode = () => {
    setIsCustomMode(!isCustomMode);
  };

  const saveToHistory = (mode, results, rawResponse) => {
    const newAnalysis = {
      id: Date.now(),
      timestamp: new Date().toISOString(),
      mode: mode,
      results: results,
      rawResponse: rawResponse,
      videoUrl: vidUrl
    };
    
    setAnalysisHistory(prev => [newAnalysis, ...prev]);
    
    // Save to localStorage
    const savedHistory = JSON.parse(localStorage.getItem('analysisHistory') || '[]');
    localStorage.setItem('analysisHistory', JSON.stringify([newAnalysis, ...savedHistory]));
  };

  const saveTemplate = () => {
    if (!templateName.trim() || !customPrompt.trim()) return;
    
    const newTemplate = {
      id: Date.now(),
      name: templateName,
      prompt: customPrompt
    };
    
    setCustomTemplates(prev => [...prev, newTemplate]);
    setTemplateName('');
    
    // Save to localStorage
    const savedTemplates = JSON.parse(localStorage.getItem('customTemplates') || '[]');
    localStorage.setItem('customTemplates', JSON.stringify([...savedTemplates, newTemplate]));
  };

  const loadTemplate = (template) => {
    setCustomPrompt(template.prompt);
    setIsCustomMode(true);
    setSelectedMode('Custom');
  };

  const deleteTemplate = (templateId) => {
    setCustomTemplates(prev => prev.filter(t => t.id !== templateId));
    
    // Update localStorage
    const savedTemplates = JSON.parse(localStorage.getItem('customTemplates') || '[]');
    localStorage.setItem('customTemplates', JSON.stringify(savedTemplates.filter(t => t.id !== templateId)));
  };

  useEffect(() => {
    const savedHistory = JSON.parse(localStorage.getItem('analysisHistory') || '[]');
    const savedTemplates = JSON.parse(localStorage.getItem('customTemplates') || '[]');
    setAnalysisHistory(savedHistory);
    setCustomTemplates(savedTemplates);
  }, []);

  const generateContent = async () => {
    if (!file) return;
    
    setIsProcessing(true);
    setTimecodeList(null);
    
    const controller = new AbortController();
    setAbortController(controller);
    
    try {
      let prompt;
      
      if (selectedMode === 'Custom' || isCustomMode) {
        prompt = customPrompt;
      } else {
        prompt = typeof modes[selectedMode].prompt === 'function' 
          ? modes[selectedMode].prompt(customPrompt) 
          : modes[selectedMode].prompt;
      }
      
      // Log the generation request
      await writeToLog({
        type: 'request',
        action: 'generate_content',
        mode: isCustomMode ? 'Custom' : selectedMode,
        useCustomPrompt: isCustomMode,
        prompt,
        timestamp: new Date().toISOString()
      });
      
      const serverPort = process.env.REACT_APP_SERVER_PORT || '';
      const apiUrl = serverPort ? `http://localhost:${serverPort}/api/prompt` : '/api/prompt';
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          uploadResult: file,
          prompt: prompt,
          model: 'gemini-2.0-flash'
        }),
        signal: controller.signal
      });
      
      const responseText = await response.text();
      
      if (!response.ok) {
        throw new Error(`Failed to generate content. Status: ${response.status}. ${responseText}`);
      }
      
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (e) {
        throw new Error(`Invalid JSON response: ${responseText}`);
      }
      
      if (data.error) {
        throw new Error(data.error);
      }
      
      // Log the successful response
      await writeToLog({
        type: 'response',
        action: 'generate_content',
        mode: isCustomMode ? 'Custom' : selectedMode,
        status: 'success',
        rawResponse: data.text,
        timestamp: new Date().toISOString()
      });
      
      let parsedTimecodes;
      
      if (selectedMode === 'Paragraph') {
        parsedTimecodes = parseTimecodes(data.text);
        setDisplayMode('paragraph');
      } else {
        parsedTimecodes = parseTimecodes(data.text);
        setDisplayMode('list');
      }
      
      // After successful generation, save to history
      saveToHistory(selectedMode, parsedTimecodes, data.text);
      
      setTimecodeList(parsedTimecodes);
      setRawAIResponse(data.text);
    } catch (error) {
      console.error('Error generating content:', error);
      
      // Don't show the error if it was a deliberate abort
      if (error.name === 'AbortError') {
        console.log('Request was cancelled');
        return;
      }
      
      // Log the error
      await writeToLog({
        type: 'error',
        action: 'generate_content',
        mode: isCustomMode ? 'Custom' : selectedMode,
        error: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      });
      
      if (error.message.includes('API key not properly configured')) {
        alert('API key not configured. Please set VITE_GEMINI_API_KEY in your .env file.');
      } else if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
        alert('Network error. Please check your connection and ensure the server is running.');
      } else {
        alert(`Error generating content: ${error.message}`);
      }
    } finally {
      setIsProcessing(false);
      setAbortController(null);
    }
  };

  // Parse timecodes from the API response
  const parseTimecodes = (text) => {
    const regex = /\[(\d+:\d+)\]\s*(.*?)(?=\[\d+:\d+\]|$)/gs;
    const matches = [...text.matchAll(regex)];
    
    return matches.map(match => ({
      time: match[1],
      text: match[2].trim()
    }));
  };

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
    }
  };

  const jumpToTimecode = (time) => {
    if (videoRef.current) {
      const seconds = timeToSecs(time);
      videoRef.current.currentTime = seconds;
    }
  };

  const timeToSecs = (timecode) => {
    const split = timecode.split(':').map(parseFloat);
    return split.length === 2
      ? split[0] * 60 + split[1]
      : split[0] * 3600 + split[1] * 60 + split[2];
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handleDurationChange = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
    }
  };

  const handleScrubberChange = (e) => {
    const newTime = e.target.value;
    setCurrentTime(newTime);
    if (videoRef.current) {
      videoRef.current.currentTime = newTime;
    }
  };

  // Function to remove the current video
  const handleRemoveVideo = () => {
    // Stop video playback if it's playing
    if (videoRef.current && isPlaying) {
      videoRef.current.pause();
    }
    
    // Reset video-related states
    setVidUrl(null);
    setFile(null);
    setCurrentTime(0);
    setDuration(0);
    setIsPlaying(false);
    setTimecodeList(null);
    setRawAIResponse(null);
    
    // Log video removal
    writeToLog({
      type: 'info',
      action: 'remove_video',
      timestamp: new Date().toISOString()
    });
  };

  const clearResults = () => {
    setTimecodeList(null);
  };
  
  // Render the appropriate content display based on display mode
  const renderContent = () => {
    if (!timecodeList || timecodeList.length === 0) return null;
    
    if (displayMode === 'paragraph') {
      return (
        <div className="ResultsParagraph">
          {timecodeList.map((item, index) => (
            <span 
              className="TimecodeSpan" 
              key={index}
              onClick={() => jumpToTimecode(item.time)}
            >
              <span className="TimecodeTime">[{item.time}]</span> {item.text}
            </span>
          ))}
        </div>
      );
    } else {
      // Default to list mode
      return (
        <div className="ResultsList">
          {timecodeList.map((item, index) => (
            <div 
              className="TimecodeItem" 
              key={index}
              onMouseEnter={() => setHoveredTimecode(item.time)}
              onMouseLeave={() => setHoveredTimecode(null)}
              onClick={() => jumpToTimecode(item.time)}
            >
              <div className="TimecodeTime">{item.time}</div>
              <div className="TimecodeText">{item.text}</div>
            </div>
          ))}
        </div>
      );
    }
  };

  // Render video player or upload area
  const renderVideoSection = () => (
    <div className="VideoSection">
      {vidUrl && !isLoadingVideo ? (
        <div className="VideoPlayerWrapper">
          <video
            ref={videoRef}
            src={vidUrl}
            className="VideoPlayer"
            onClick={togglePlay}
            onTimeUpdate={handleTimeUpdate}
            onDurationChange={handleDurationChange}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            crossOrigin="anonymous"
            muted={isMuted}
          />
          
          <div className="VideoControls">
            <div className="VideoScrubber">
              <input
                type="range"
                min="0"
                max={duration || 0}
                value={currentTime}
                onChange={handleScrubberChange}
                className="ScrubberInput"
                style={{
                  backgroundSize: `${(currentTime / (duration || 1)) * 100}% 100%`
                }}
              />
            </div>
            
            <div className="VideoControlsBottom">
              <div className="VideoControlsLeft">
                <button className="PlayButton" onClick={togglePlay}>
                  {isPlaying ? <Pause size={20} /> : <Play size={20} />}
                </button>
                
                <button className="VolumeButton" onClick={toggleMute}>
                  {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
                </button>
              </div>
              
              <div className="VideoTime">
                {formatTime(currentTime)} / {formatTime(duration)}
              </div>
              
              <button className="RemoveVideoButton" onClick={handleRemoveVideo} title="Remove video">
                <X size={18} />
              </button>
            </div>
          </div>
        </div>
      ) : (
        <label className="VideoUploadArea" htmlFor="video-upload" onDragOver={handleDragOver} onDrop={handleDrop}>
          <input
            id="video-upload"
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="video/*"
            style={{ display: 'none' }}
          />
          {isLoadingVideo ? (
            <div className="LoadingIndicator">
              <div className="Spinner"></div>
              <p>Processing video...</p>
            </div>
          ) : videoError ? (
            <div className="ErrorMessage">
              <p>Error processing video. Please try again.</p>
            </div>
          ) : (
            <div className="UploadPrompt">
              <FileVideo size={48} className="UploadIcon" />
              <p>Drag and drop a video file here or click to browse</p>
              <p className="UploadHint">Supported formats: MP4, MOV, WebM</p>
            </div>
          )}
        </label>
      )}
    </div>
  );

  // Render the modes grid
  const renderModesGrid = () => (
    <div className="ModesGridSection">
      <div className="ModesGridHeader">
        <h3>Analysis Mode</h3>
        <button 
          className="ModesToggleButton" 
          onClick={() => setShowModes(!showModes)}
          title={showModes ? "Hide modes" : "Show modes"}
        >
          {showModes ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
      </div>
      
      {showModes && (
        <>
          <div className="ModeToggleContainer">
            <button 
              className={`ModeToggleButton ${!isCustomMode ? 'active' : ''}`} 
              onClick={() => setIsCustomMode(false)}
            >
              Presets
            </button>
            <button 
              className={`ModeToggleButton ${isCustomMode ? 'active' : ''}`} 
              onClick={() => setIsCustomMode(true)}
            >
              Custom
            </button>
          </div>
          
          {!isCustomMode ? (
            <div className="ModesGridContainer">
              {Object.entries(modes).filter(([mode]) => mode !== 'Custom').map(([mode, { emoji, description }]) => (
                <div
                  key={mode}
                  className={`ModeCard ${selectedMode === mode && !isCustomMode ? 'active' : ''}`}
                  onClick={() => handleModeSelect(mode)}
                  title={description}
                >
                  <div className="ModeCardContent">
                    <span className="ModeEmoji">{emoji}</span> 
                    <span className="ModeName">{mode}</span>
                    <div className="ModeDescription">{description}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="CustomPromptContainer">
              <div className="CustomPromptHeader">Custom Prompt:</div>
              <textarea
                className="CustomPromptInput"
                placeholder="Enter your custom prompt here..."
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                rows={4}
              />
            </div>
          )}
        </>
      )}
      
      <button 
        className={`GenerateButton ${isProcessing ? 'processing' : ''}`}
        onClick={isProcessing ? cancelProcessing : generateContent}
        disabled={!vidUrl || (isCustomMode && !customPrompt.trim())}
      >
        {isProcessing ? (
          <>
            <Loader2 className="spinning" size={16} />
            <span>Processing...</span>
            <X size={16} />
          </>
        ) : (
          <>
            <Wand2 size={16} />
            Generate
          </>
        )}
      </button>
    </div>
  );

  // Render results section
  const renderResultsSection = () => (
    timecodeList && timecodeList.length > 0 && (
      <div className="ResultsOuterSection" ref={responseContainerRef}>
        <div className="ResultsHeader">
          <h3>Results</h3>
          <div className="ResultsActions">
            <div className="DisplayModeToggle">
              <button 
                className={`DisplayModeButton ${displayMode === 'list' ? 'active' : ''}`}
                onClick={() => setDisplayMode('list')}
                title="List view"
              >
                <List size={16} />
              </button>
              <button 
                className={`DisplayModeButton ${displayMode === 'paragraph' ? 'active' : ''}`}
                onClick={() => setDisplayMode('paragraph')}
                title="Paragraph view"
              >
                <Text size={16} />
              </button>
            </div>
            <button 
              className="ActionButton" 
              onClick={() => setShowEnlargedView(true)}
              title="View in large window"
            >
              <Maximize2 size={16} />
            </button>
            <button 
              className="ActionButton" 
              onClick={clearResults}
              title="Clear results"
            >
              <X size={16} />
            </button>
          </div>
        </div>
        
        <div className="ResultsContent">
          {renderContent()}
        </div>
      </div>
    )
  );

  // Render raw response section
  const renderRawResponse = () => (
    rawAIResponse && (
      <div className="RawResponseSection">
        <div className="RawResponseHeader">
          <h3>AI Response</h3>
          <button 
            className="ActionButton" 
            onClick={() => copyToClipboard(rawAIResponse)}
            title="Copy to clipboard"
          >
            <Copy size={16} />
          </button>
        </div>
        <div className="RawResponseContent">
          {rawAIResponse}
        </div>
      </div>
    )
  );

  // Render enlarged view modal
  const renderEnlargedView = () => (
    showEnlargedView && (
      <div className="EnlargedViewOverlay" onClick={() => setShowEnlargedView(false)}>
        <div className="EnlargedViewContent" onClick={(e) => e.stopPropagation()}>
          <div className="EnlargedViewHeader">
            <h3>Video Analysis Results</h3>
            <div className="EnlargedViewActions">
              <button 
                className="ActionButton" 
                onClick={() => copyToClipboard(rawAIResponse)}
                title="Copy to clipboard"
              >
                <Copy size={16} />
              </button>
              <button 
                className="ActionButton" 
                onClick={() => setShowEnlargedView(false)}
                title="Close"
              >
                <X size={16} />
              </button>
            </div>
          </div>
          <div className="EnlargedViewBody">
            {displayMode === 'paragraph' ? (
              <div className="ResultsParagraph enlarged">
                {timecodeList.map((item, index) => (
                  <span 
                    className="TimecodeSpan" 
                    key={index}
                    onClick={() => jumpToTimecode(item.time)}
                  >
                    <span className="TimecodeTime">[{item.time}]</span> {item.text}
                  </span>
                ))}
              </div>
            ) : (
              <div className="ResultsList enlarged">
                {timecodeList.map((item, index) => (
                  <div 
                    className="TimecodeItem" 
                    key={index}
                    onClick={() => jumpToTimecode(item.time)}
                  >
                    <div className="TimecodeTime">{item.time}</div>
                    <div className="TimecodeText">{item.text}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    )
  );

  // Add function to load analysis from history
  const loadFromHistory = (analysis) => {
    setTimecodeList(analysis.results);
    setRawAIResponse(analysis.rawResponse);
    setSelectedMode(analysis.mode);
    setVidUrl(analysis.videoUrl);
  };

  // Add function to delete analysis from history
  const deleteFromHistory = (analysisId) => {
    setAnalysisHistory(prev => prev.filter(a => a.id !== analysisId));
    
    // Update localStorage
    const savedHistory = JSON.parse(localStorage.getItem('analysisHistory') || '[]');
    localStorage.setItem('analysisHistory', JSON.stringify(savedHistory.filter(a => a.id !== analysisId)));
  };

  // Add new render functions for history and templates
  const renderAnalysisHistory = () => (
    <div className="AnalysisHistorySection">
      <div className="SectionHeader">
        <h3>Analysis History</h3>
        <button 
          className="CloseButton" 
          onClick={() => setShowHistory(false)}
        >
          <X size={16} />
        </button>
      </div>
      <div className="HistoryList">
        {analysisHistory.map((analysis) => (
          <div key={analysis.id} className="HistoryItem">
            <div className="HistoryItemHeader">
              <span className="HistoryMode">#{analysis.mode}</span>
              <span className="HistoryDate">
                {new Date(analysis.timestamp).toLocaleString()}
              </span>
            </div>
            <div className="HistoryActions">
              <button 
                className="ActionButton"
                onClick={() => loadFromHistory(analysis)}
                title="Load analysis"
              >
                <ChevronRight size={16} />
              </button>
              <button 
                className="ActionButton"
                onClick={() => deleteFromHistory(analysis.id)}
                title="Delete analysis"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderCustomTemplates = () => (
    <div className="CustomTemplatesSection">
      <div className="SectionHeader">
        <h3>Custom Templates</h3>
        <button 
          className="CloseButton" 
          onClick={() => setShowTemplates(false)}
        >
          <X size={16} />
        </button>
      </div>
      <div className="TemplatesList">
        {customTemplates.map((template) => (
          <div key={template.id} className="TemplateItem">
            <div className="TemplateName">{template.name}</div>
            <div className="TemplateActions">
              <button 
                className="ActionButton"
                onClick={() => loadTemplate(template)}
                title="Load template"
              >
                <ChevronRight size={16} />
              </button>
              <button 
                className="ActionButton"
                onClick={() => deleteTemplate(template.id)}
                title="Delete template"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>
      <div className="SaveTemplateForm">
        <input
          type="text"
          placeholder="Template name"
          value={templateName}
          onChange={(e) => setTemplateName(e.target.value)}
          className="TemplateNameInput"
        />
        <button 
          className="SaveTemplateButton"
          onClick={saveTemplate}
          disabled={!templateName.trim() || !customPrompt.trim()}
        >
          Save Template
        </button>
      </div>
    </div>
  );

  return (
    <div className={`LabsContainer ${theme} ${isDarkMode ? 'dark' : ''}`}>
      <div className="LabsHeader">
        <h2>Video Analysis</h2>
        <div className="HeaderActions">
          <button 
            className="ActionButton"
            onClick={() => setShowHistory(true)}
            title="View analysis history"
          >
            <Clock size={16} />
          </button>
          <button 
            className="ActionButton"
            onClick={() => setShowTemplates(true)}
            title="View custom templates"
          >
            <FileText size={16} />
          </button>
          <button 
            className="ActionButton"
            onClick={() => setShowEnlargedView(true)}
            title="Enlarge view"
          >
            <Maximize2 size={16} />
          </button>
        </div>
      </div>
      <div className="LabsContentWrapper">
        {renderVideoSection()}
        {vidUrl && !isLoadingVideo && renderModesGrid()}
        {renderResultsSection()}
        {renderRawResponse()}
        {showHistory && renderAnalysisHistory()}
        {showTemplates && renderCustomTemplates()}
        {showEnlargedView && (
          <ChatPopup
            isOpen={showEnlargedView}
            onClose={() => setShowEnlargedView(false)}
            chatHistory={[
              {
                id: 0,
                sender: 'ai',
                content: rawAIResponse || '',
                timestamp: new Date().toISOString()
              }
            ]}
            focusedMessageId={0}
            onSendMessage={() => {}}
            onDeleteMessage={() => {}}
            chatTitle="Video Analysis Results"
          />
        )}
      </div>
    </div>
  );
};

export default Labs; 