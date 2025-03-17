import React, { useState, useRef, useEffect } from 'react';
import { 
  Play, Pause, FileVideo, List, Table, BarChart3, 
  AlignLeft, MessageSquare, Clock, Activity, FileText, Music,
  Volume2, VolumeX, Pencil, BookOpen, ListChecks,
  Wand2, ChevronRight, ChevronLeft, Text, Album, Speech,
  PieChart, LineChart, Maximize, Layers, Bug
} from 'lucide-react';
import { useTheme } from '../ThemeContext';
import '../css/Labs.css';

const Labs = ({ darkMode }) => {
  const { theme } = useTheme();
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
  const [chartMode, setChartMode] = useState('Excitement');
  const [hoveredTimecode, setHoveredTimecode] = useState(null);
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const [logs, setLogs] = useState([]);
  const [showLogs, setShowLogs] = useState(false);
  
  const videoRef = useRef(null);
  const fileInputRef = useRef(null);
  const chartRef = useRef(null);
  const logsEndRef = useRef(null);

  // Add log function
  const addLog = (message) => {
    const timestamp = new Date().toLocaleTimeString();
    const newLog = `[${timestamp}] ${message}`;
    console.log(newLog);
    setLogs(prevLogs => [...prevLogs, newLog]);
    
    // Scroll to bottom of logs
    setTimeout(() => {
      if (logsEndRef.current) {
        logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
      }
    }, 100);
  };

  // Modes available for video analysis - adapted from g_code.txt
  const modes = {
    'A/V captions': {
      emoji: '👀',
      icon: <MessageSquare size={24} />,
      prompt: `For each scene in this video, generate captions that describe the scene along with any spoken text placed in quotation marks.`
    },
    'Key moments': {
      emoji: '🔑',
      icon: <Clock size={24} />,
      prompt: `Generate bullet points for the key moments in this video.`
    },
    'Paragraph': {
      emoji: '📝',
      icon: <FileText size={24} />,
      prompt: `Generate a paragraph that summarizes this video. Keep it to 3 to 5 sentences.`
    },
    'Table': {
      emoji: '🤓',
      icon: <Table size={24} />,
      prompt: `Choose 5 key shots from this video and describe what's in each scene, including a list of objects visible.`
    },
    'Haiku': {
      emoji: '🌸',
      icon: <Music size={24} />,
      prompt: `Generate a haiku for the video. Make sure to follow the syllable count rules (5-7-5).`
    },
    'Chart': {
      emoji: '📈',
      icon: <Activity size={24} />,
      prompt: chartMode => {
        const chartPrompts = {
          'Excitement': 'for each scene, estimate the level of excitement on a scale of 1 to 10',
          'Importance': 'for each scene, estimate the level of overall importance to the video on a scale of 1 to 10',
          'Number of people': 'for each scene, count the number of people visible'
        };
        return `Generate chart data for this video based on the following instructions: ${chartPrompts[chartMode]}.`;
      }
    },
    'Speakers': {
      emoji: '🔊',
      icon: <Speech size={24} />,
      prompt: `Identify different speakers in this video and provide timestamps for when each person is speaking.`
    },
    'Chapters': {
      emoji: '📑',
      icon: <Layers size={24} />,
      prompt: `Divide this video into logical chapters, providing a title and timestamp for each chapter.`
    },
    'Script': {
      emoji: '📜',
      icon: <Album size={24} />,
      prompt: `Create a detailed script for this video, including descriptions of visuals and any spoken dialogue.`
    }
  };

  // Chart modes
  const chartModes = ['Excitement', 'Importance', 'Number of people'];

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
      addLog(`File selected: ${file.name} (${(file.size / (1024 * 1024)).toFixed(2)} MB)`);
      handleVideoUpload(file);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      addLog(`File dropped: ${file.name}`);
      handleVideoUpload(file);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleVideoUpload = async (videoFile) => {
    setIsLoadingVideo(true);
    setVidUrl(URL.createObjectURL(videoFile));
    setVideoError(false); // Reset error state
    addLog(`Creating ObjectURL for video preview`);

    try {
      addLog(`Uploading video to server...`);
      const formData = new FormData();
      formData.set('video', videoFile);
      
      // Get the server port from environment or use default
      const serverPort = process.env.REACT_APP_SERVER_PORT || '';
      const apiUrl = serverPort ? `http://localhost:${serverPort}/api/upload` : '/api/upload';
      
      addLog(`Sending API request to ${apiUrl}`);
      const response = await fetch(apiUrl, {
        method: 'POST',
        body: formData
      });
      
      const responseText = await response.text();
      addLog(`Response received [${response.status}]: ${responseText.substring(0, 150)}`);
      
      if (!response.ok) {
        throw new Error(`Failed to upload video. Status: ${response.status}. ${responseText}`);
      }
      
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (e) {
        throw new Error(`Invalid JSON response: ${responseText}`);
      }
      
      if (!data || !data.data) {
        throw new Error(`Invalid response format: ${JSON.stringify(data)}`);
      }

      addLog(`Video uploaded successfully. File ID: ${data.data.name}`);
      setFile(data.data);
      checkProgress(data.data.name);
    } catch (error) {
      addLog(`Error uploading video: ${error.message}`);
      console.error('Error uploading video:', error);
      setVideoError(true);
      setIsLoadingVideo(false);
      
      // Display a more user-friendly error message
      if (error.message.includes('413') || error.message.includes('Payload Too Large')) {
        alert('The video file is too large. Please try a smaller file (under 100MB).');
      } else if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
        alert('Network error. Please check your connection and ensure the server is running.');
      } else {
        alert(`Error uploading video: ${error.message}`);
      }
    }
  };

  const checkProgress = async (fileId) => {
    try {
      addLog(`Checking processing progress for file ID: ${fileId}`);
      
      // Get the server port from environment or use default
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
      addLog(`Progress response [${response.status}]: ${responseText.substring(0, 100)}`);
      
      if (!response.ok) {
        throw new Error(`Failed to check progress. Status: ${response.status}. ${responseText}`);
      }
      
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (e) {
        throw new Error(`Invalid JSON response: ${responseText}`);
      }
      
      if (!data.progress) {
        throw new Error(`Invalid progress response format: ${JSON.stringify(data)}`);
      }
      
      addLog(`Processing state: ${data.progress.state}`);
      
      if (data.progress.state === 'ACTIVE') {
        addLog(`Video processing complete`);
        setIsLoadingVideo(false);
      } else if (data.progress.state === 'WARNING') {
        // Handle warning state (e.g., API key not configured)
        addLog(`Warning: ${data.progress.message}`);
        setVideoError(true);
        setIsLoadingVideo(false);
        // Display a more specific error message to the user
        alert(`Warning: ${data.progress.message}`);
      } else if (data.progress.state === 'FAILED') {
        addLog(`Video processing failed: ${data.progress.message}`);
        setVideoError(true);
        setIsLoadingVideo(false);
      } else {
        addLog(`Video still processing, checking again in 1 second...`);
        setTimeout(() => checkProgress(fileId), 1000);
      }
    } catch (error) {
      addLog(`Error checking progress: ${error.message}`);
      console.error('Error checking progress:', error);
      setVideoError(true);
      setIsLoadingVideo(false);
    }
  };

  const generateContent = async () => {
    if (!file) {
      addLog(`Cannot generate content: No file uploaded`);
      return;
    }
    
    setIsProcessing(true);
    addLog(`Starting content generation for mode: ${selectedMode}`);
    
    try {
      // Determine the prompt based on selected mode
      let prompt = modes[selectedMode].prompt;
      if (selectedMode === 'Chart') {
        prompt = modes[selectedMode].prompt(chartMode);
        addLog(`Using chart mode: ${chartMode}`);
      }
      
      // Get the server port from environment or use default
      const serverPort = process.env.REACT_APP_SERVER_PORT || '';
      const apiUrl = serverPort ? `http://localhost:${serverPort}/api/prompt` : '/api/prompt';
      
      addLog(`Sending prompt to API: ${prompt.substring(0, 50)}...`);
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
        })
      });
      
      const responseText = await response.text();
      addLog(`Response received [${response.status}]: ${responseText.substring(0, 150)}`);
      
      if (!response.ok) {
        throw new Error(`Failed to generate content. Status: ${response.status}. ${responseText}`);
      }
      
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (e) {
        throw new Error(`Invalid JSON response: ${responseText}`);
      }
      
      // Check for error in the response
      if (data.error) {
        throw new Error(data.error);
      }
      
      addLog(`Received response from API`);
      
      // Parse the response to extract timecodes and text
      let parsedTimecodes;
      
      if (selectedMode === 'Chart') {
        parsedTimecodes = parseChartData(data.text);
        addLog(`Parsed ${parsedTimecodes.length} data points for chart`);
        // Auto-switch to chart display mode
        setDisplayMode('chart');
      } else if (selectedMode === 'Table') {
        parsedTimecodes = parseTableData(data.text);
        addLog(`Parsed ${parsedTimecodes.length} rows for table`);
        // Auto-switch to table display mode
        setDisplayMode('table');
      } else {
        parsedTimecodes = parseTimecodes(data.text);
        addLog(`Parsed ${parsedTimecodes.length} timecodes`);
        // For Paragraph, set paragraph display mode
        if (selectedMode === 'Paragraph') {
          setDisplayMode('paragraph');
        } else {
          setDisplayMode('list');
        }
      }
      
      setTimecodeList(parsedTimecodes);
      addLog(`Content generation complete`);
    } catch (error) {
      addLog(`Error generating content: ${error.message}`);
      console.error('Error generating content:', error);
      
      // Display a more user-friendly error message
      if (error.message.includes('API key not properly configured')) {
        alert('API key not configured. Please set VITE_GEMINI_API_KEY in your .env file.');
      } else if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
        alert('Network error. Please check your connection and ensure the server is running.');
      } else {
        alert(`Error generating content: ${error.message}`);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  // Parse different types of data from the API response
  const parseTimecodes = (text) => {
    const regex = /\[(\d+:\d+)\]\s*(.*?)(?=\[\d+:\d+\]|$)/gs;
    const matches = [...text.matchAll(regex)];
    
    return matches.map(match => ({
      time: match[1],
      text: match[2].trim()
    }));
  };

  const parseTableData = (text) => {
    // Simple regex to extract time, description, and objects
    const regex = /\[(\d+:\d+)\]\s*Text: (.*?)\s*Objects: (.*?)(?=\[\d+:\d+\]|$)/gs;
    const matches = [...text.matchAll(regex)];
    
    return matches.map(match => ({
      time: match[1],
      text: match[2].trim(),
      objects: match[3].split(',').map(obj => obj.trim())
    }));
  };

  const parseChartData = (text) => {
    // Extract time and numeric values for chart
    const regex = /\[(\d+:\d+)\]\s*Value: (\d+(?:\.\d+)?)/gs;
    const matches = [...text.matchAll(regex)];
    
    return matches.map(match => ({
      time: match[1],
      value: parseFloat(match[2])
    }));
  };

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
        addLog(`Video paused at ${formatTime(currentTime)}`);
      } else {
        videoRef.current.play();
        addLog(`Video playing from ${formatTime(currentTime)}`);
      }
    }
  };

  const jumpToTimecode = (time) => {
    if (videoRef.current) {
      const seconds = timeToSecs(time);
      videoRef.current.currentTime = seconds;
      addLog(`Jumped to timecode ${time} (${seconds}s)`);
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
      addLog(`Video duration: ${formatTime(videoRef.current.duration)}`);
    }
  };

  const handleScrubberChange = (e) => {
    const newTime = e.target.value;
    setCurrentTime(newTime);
    if (videoRef.current) {
      videoRef.current.currentTime = newTime;
    }
  };

  const handleModeSelect = (mode) => {
    addLog(`Selected mode: ${mode}`);
    setSelectedMode(mode);
  };

  // Render chart component
  const renderChart = () => {
    if (!timecodeList || !timecodeList.length) return null;
    
    const chartHeight = 240;
    const chartWidth = chartRef.current ? chartRef.current.clientWidth : 300;
    const padding = { top: 20, right: 20, bottom: 40, left: 40 };
    
    // Find min and max values for scaling
    const values = timecodeList.map(item => item.value);
    const maxValue = Math.max(...values);
    const minValue = Math.min(...values);
    
    // Calculate scales
    const xScale = index => ((chartWidth - padding.left - padding.right) / (timecodeList.length - 1)) * index + padding.left;
    const yScale = value => chartHeight - padding.bottom - ((value - minValue) / (maxValue - minValue)) * (chartHeight - padding.top - padding.bottom);
    
    // Generate SVG path for the line
    const pathData = timecodeList.map((point, index) => {
      const x = xScale(index);
      const y = yScale(point.value);
      return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
    }).join(' ');
    
    return (
      <div className="ChartContainer" ref={chartRef}>
        <div className="ChartTitle">{chartMode} over time</div>
        <svg width="100%" height={chartHeight} className="Chart">
          {/* Y-axis */}
          <line 
            x1={padding.left} 
            y1={padding.top} 
            x2={padding.left} 
            y2={chartHeight - padding.bottom} 
            stroke="rgba(0,0,0,0.2)" 
            strokeWidth="1" 
          />
          
          {/* X-axis */}
          <line 
            x1={padding.left} 
            y1={chartHeight - padding.bottom} 
            x2={chartWidth - padding.right} 
            y2={chartHeight - padding.bottom} 
            stroke="rgba(0,0,0,0.2)" 
            strokeWidth="1" 
          />
          
          {/* Chart line */}
          <path 
            d={pathData} 
            fill="none" 
            stroke="#bb44f0" 
            strokeWidth="2" 
          />
          
          {/* Data points */}
          {timecodeList.map((point, index) => (
            <g key={index}>
              <circle 
                cx={xScale(index)} 
                cy={yScale(point.value)} 
                r="4" 
                fill="#bb44f0" 
                onMouseEnter={() => setHoveredTimecode(index)}
                onMouseLeave={() => setHoveredTimecode(null)}
                onClick={() => jumpToTimecode(point.time)}
                style={{ cursor: 'pointer' }}
              />
              
              {/* Value labels */}
              <text 
                x={xScale(index)} 
                y={yScale(point.value) - 10} 
                textAnchor="middle" 
                fill="#333" 
                fontSize="12"
                className={theme === 'dark' ? 'darkText' : ''}
              >
                {point.value}
              </text>
              
              {/* Time labels */}
              <text 
                x={xScale(index)} 
                y={chartHeight - padding.bottom + 20} 
                textAnchor="middle" 
                fill="#666" 
                fontSize="10"
                className={theme === 'dark' ? 'darkText' : ''}
              >
                {point.time}
              </text>
            </g>
          ))}
          
          {/* Tooltip for hovered point */}
          {hoveredTimecode !== null && (
            <g className="Tooltip">
              <rect 
                x={xScale(hoveredTimecode) - 50} 
                y={yScale(timecodeList[hoveredTimecode].value) - 40} 
                width="100" 
                height="30" 
                rx="4" 
                fill="rgba(0,0,0,0.7)" 
              />
              <text 
                x={xScale(hoveredTimecode)} 
                y={yScale(timecodeList[hoveredTimecode].value) - 20} 
                textAnchor="middle" 
                fill="white" 
                fontSize="12"
              >
                {`${timecodeList[hoveredTimecode].time} - ${timecodeList[hoveredTimecode].value}`}
              </text>
            </g>
          )}
        </svg>
      </div>
    );
  };

  // Render the appropriate content display based on display mode
  const renderContent = () => {
    if (!timecodeList || !timecodeList.length) return null;
    
    switch (displayMode) {
      case 'list':
        return (
          <div className="ResultsList">
            {timecodeList.map((item, index) => (
              <div 
                key={index} 
                className="TimecodeItem"
                onClick={() => jumpToTimecode(item.time)}
              >
                <div className="TimecodeTime">{item.time}</div>
                <div className="TimecodeText">{item.text}</div>
              </div>
            ))}
          </div>
        );
        
      case 'paragraph':
        return (
          <div className="ResultsParagraph">
            {timecodeList.map((item, index) => (
              <span 
                key={index}
                className="TimecodeSpan"
                onClick={() => jumpToTimecode(item.time)}
              >
                <span className="TimecodeTime">[{item.time}]</span>
                <span className="TimecodeText">{item.text}</span>
                {index < timecodeList.length - 1 ? ' ' : ''}
              </span>
            ))}
          </div>
        );
        
      case 'table':
        return (
          <div className="ResultsTable">
            <table>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Description</th>
                  <th>Objects</th>
                </tr>
              </thead>
              <tbody>
                {timecodeList.map((item, index) => (
                  <tr 
                    key={index}
                    onClick={() => jumpToTimecode(item.time)}
                    className="TableRow"
                  >
                    <td>{item.time}</td>
                    <td>{item.text}</td>
                    <td>{item.objects ? item.objects.join(', ') : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
        
      case 'chart':
        return renderChart();
        
      default:
        return null;
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
          />
          
          <div className="VideoControls">
            <div className="VideoScrubber">
              <input
                type="range"
                min="0"
                max={duration || 0}
                value={currentTime || 0}
                step="0.1"
                onChange={handleScrubberChange}
                className="ScrubberInput"
              />
              
              {timecodeList && (
                <div className="TimecodeMarkers">
                  {timecodeList.map((item, index) => {
                    const secs = timeToSecs(item.time);
                    const percent = (secs / duration) * 100;
                    
                    return (
                      <div 
                        key={index}
                        className="TimecodeMarker"
                        style={{ left: `${percent}%` }}
                        onClick={(e) => {
                          e.stopPropagation();
                          jumpToTimecode(item.time);
                        }}
                        title={item.text || `Value: ${item.value}`}
                      />
                    );
                  })}
                </div>
              )}
            </div>
            <div className="VideoControlsBottom">
              <button className="PlayButton" onClick={togglePlay}>
                {isPlaying ? <Pause size={16} /> : <Play size={16} />}
              </button>
              <button className="PlayButton" onClick={() => videoRef.current.muted = !videoRef.current.muted}>
                {videoRef.current?.muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
              </button>
              <div className="VideoTime">
                {formatTime(currentTime)} / {formatTime(duration)}
              </div>
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

  // Render the modes grid - simplify the UI as requested
  const renderModesGrid = () => (
    <div className="ModesGridSection">
      <div className="ModesGrid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
        {Object.entries(modes).map(([mode, { emoji }]) => (
          <div
            key={mode}
            className={`ModeCard ${selectedMode === mode ? 'active' : ''}`}
            onClick={() => handleModeSelect(mode)}
            style={{ 
              height: 'auto', 
              padding: '8px', 
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: selectedMode === mode ? '1px solid #bb44f0' : '1px solid rgba(0, 0, 0, 0.1)'
            }}
          >
            <div style={{ fontSize: '14px' }}>
              <span style={{ marginRight: '4px' }}>{emoji}</span> 
              {mode}
            </div>
          </div>
        ))}
      </div>
      
      {selectedMode === 'Chart' && (
        <div style={{ 
          marginTop: '8px', 
          padding: '8px', 
          borderRadius: '4px', 
          backgroundColor: 'rgba(0, 0, 0, 0.03)',
          border: '1px solid rgba(0, 0, 0, 0.1)'
        }}>
          <div style={{ fontSize: '13px', marginBottom: '4px' }}>Chart by:</div>
          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
            {chartModes.map(mode => (
              <button
                key={mode}
                style={{ 
                  padding: '4px 8px',
                  backgroundColor: chartMode === mode ? 'rgba(187, 68, 240, 0.1)' : 'transparent',
                  border: chartMode === mode ? '1px solid rgba(187, 68, 240, 0.3)' : '1px solid rgba(0, 0, 0, 0.1)',
                  borderRadius: '4px',
                  fontSize: '12px',
                  cursor: 'pointer'
                }}
                onClick={() => {
                  setChartMode(mode);
                  addLog(`Selected chart mode: ${mode}`);
                }}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>
      )}
      
      <button 
        style={{
          marginTop: '12px',
          padding: '8px 12px',
          backgroundColor: '#bb44f0',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: isProcessing || !vidUrl ? 'not-allowed' : 'pointer',
          opacity: isProcessing || !vidUrl ? 0.6 : 1
        }}
        onClick={generateContent}
        disabled={isProcessing || !vidUrl}
      >
        {isProcessing ? 'Processing...' : 'Generate'}
      </button>
    </div>
  );

  // Render results section
  const renderResultsSection = () => (
    timecodeList && timecodeList.length > 0 && (
      <div className="ResultsOuterSection">
        <div className="ResultsHeader">
          <h3>Results</h3>
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
            <button 
              className={`DisplayModeButton ${displayMode === 'table' ? 'active' : ''}`}
              onClick={() => setDisplayMode('table')}
              title="Table view"
            >
              <Table size={16} />
            </button>
            {selectedMode === 'Chart' && (
              <button 
                className={`DisplayModeButton ${displayMode === 'chart' ? 'active' : ''}`}
                onClick={() => setDisplayMode('chart')}
                title="Chart view"
              >
                <BarChart3 size={16} />
              </button>
            )}
          </div>
        </div>
        
        <div className="ResultsContent">
          {renderContent()}
        </div>
      </div>
    )
  );

  // Render logs panel directly in the component, not as a popup
  const renderLogsPanel = () => (
    <div style={{ 
      marginTop: '12px', 
      maxHeight: '150px', 
      overflow: 'auto', 
      fontSize: '12px', 
      fontFamily: 'monospace',
      border: '1px solid rgba(0, 0, 0, 0.1)',
      borderRadius: '4px',
      padding: '8px',
      backgroundColor: 'rgba(0, 0, 0, 0.02)'
    }}>
      {logs.map((log, index) => (
        <div key={index} style={{ marginBottom: '4px' }}>{log}</div>
      ))}
      <div ref={logsEndRef} />
    </div>
  );

  return (
    <div className={`LabsContainer ${theme} ${darkMode ? 'dark' : ''}`}>
      {renderVideoSection()}
      {vidUrl && !isLoadingVideo && renderModesGrid()}
      {renderResultsSection()}
      {renderLogsPanel()}
    </div>
  );
};

export default Labs; 