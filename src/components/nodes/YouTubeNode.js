// YouTube node component with modern UI for video analysis
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Handle, Position } from 'reactflow';
import { Link, X, AlertCircle, RefreshCw, CheckCircle, Play, Film, Eye, Bot, FileText, Clock, Camera, Scissors } from 'lucide-react';
import { getYouTubeVideoId, extractYouTubeTitle, getYouTubeEmbedUrl, getYouTubeThumbnailUrl } from '../../utils/youtubeUtils';
import { config } from '../../config';

function YouTubeScreenshotNode({ id, data, isConnectable }) {
  const [url, setUrl] = useState(data.url || '');
  const [title, setTitle] = useState(data.title || '');
  const [videoId, setVideoId] = useState(data.videoId || '');
  const [showEmbed, setShowEmbed] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [nodeState, setNodeState] = useState('idle'); // 'idle', 'processing', 'complete', 'error'
  const [analysisState, setAnalysisState] = useState('idle'); // 'idle', 'analyzing', 'complete', 'error'
  const [videoAnalysis, setVideoAnalysis] = useState(data.videoAnalysis || null);
  const [analysisError, setAnalysisError] = useState(null);
  const [customPrompt, setCustomPrompt] = useState(data.customPrompt || '');
  const [showCustomPrompt, setShowCustomPrompt] = useState(false);
  const [mode, setMode] = useState('screenshot'); // 'screenshot' or 'clip'
  const [timestamps, setTimestamps] = useState(data.timestamps || []);
  const [currentTimestampIndex, setCurrentTimestampIndex] = useState(0);
  const [screenshots, setScreenshots] = useState(data.screenshots || {});
  const [isCapturingScreenshot, setIsCapturingScreenshot] = useState(false);
  
  // Refs
  const nodeIdRef = useRef(id);
  const playerRef = useRef(null);
  const canvasRef = useRef(null);
  const playerContainerRef = useRef(null);
  
  // YouTube Player API initialization
  useEffect(() => {
    // Load YouTube IFrame API if not already loaded
    if (!window.YT) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
    }
  }, []);
  
  // Ensure we track the node ID
  useEffect(() => {
    nodeIdRef.current = id;
  }, [id]);

  // Effect to update data when our state changes using onChange pattern
  useEffect(() => {
    if (data.onChange) {
      data.onChange({
        url,
        title,
        videoId,
        videoAnalysis,
        customPrompt,
        mode,
        timestamps,
        screenshots
      });
    }
  }, [data, url, title, videoId, videoAnalysis, customPrompt, mode, timestamps, screenshots]);

  // Effect to handle flow execution states
  useEffect(() => {
    let timer;
    if (data.isExecuting) {
      setNodeState('processing');
    } else if (data.executionComplete) {
      setNodeState('complete');
      // Reset after 3 seconds
      timer = setTimeout(() => {
        setNodeState('idle');
      }, 3000);
    } else if (data.executionError) {
      setNodeState('error');
      // Reset after 3 seconds
      timer = setTimeout(() => {
        setNodeState('idle');
      }, 3000);
    }
    return () => clearTimeout(timer);
  }, [data.isExecuting, data.executionComplete, data.executionError]);

  const handleUrlChange = useCallback(async (e) => {
    const newUrl = e.target.value;
    setUrl(newUrl);
    setVideoAnalysis(null);
    setAnalysisState('idle');
    setTimestamps([]);
    setScreenshots({});
    
    const extractedVideoId = getYouTubeVideoId(newUrl);
    if (extractedVideoId) {
      setVideoId(extractedVideoId);
      setIsProcessing(true);
      try {
        const videoTitle = await extractYouTubeTitle(newUrl);
        if (videoTitle) {
          setTitle(videoTitle);
        }
      } catch (error) {
        console.error("Error extracting title:", error);
      } finally {
        setIsProcessing(false);
      }
    } else {
      setVideoId('');
      setTitle('');
    }
  }, []);

  const removeVideo = useCallback(() => {
    setUrl('');
    setTitle('');
    setVideoId('');
    setShowEmbed(false);
    setVideoAnalysis(null);
    setAnalysisState('idle');
    setAnalysisError(null);
    setTimestamps([]);
    setScreenshots({});
  }, []);

  const toggleEmbed = useCallback(() => {
    setShowEmbed(!showEmbed);
  }, [showEmbed]);
  
  const toggleCustomPrompt = useCallback(() => {
    setShowCustomPrompt(!showCustomPrompt);
  }, [showCustomPrompt]);
  
  const handleCustomPromptChange = useCallback((e) => {
    setCustomPrompt(e.target.value);
  }, []);

  // Toggle between screenshot and clip mode
  const toggleMode = useCallback(() => {
    setMode(prevMode => prevMode === 'screenshot' ? 'clip' : 'screenshot');
  }, []);

  // Initialize YouTube player
  const initPlayer = useCallback(() => {
    if (window.YT && window.YT.Player && videoId && playerContainerRef.current) {
      if (playerRef.current) {
        playerRef.current.destroy();
      }
      
      playerRef.current = new window.YT.Player(playerContainerRef.current, {
        videoId: videoId,
        height: '180',
        width: '100%',
        playerVars: {
          controls: 1,
          disablekb: 0,
          modestbranding: 1
        },
        events: {
          onReady: (event) => {
            console.log('Player ready');
          },
          onStateChange: (event) => {
            if (event.data === window.YT.PlayerState.PAUSED && isCapturingScreenshot) {
              captureCurrentFrame();
            }
          },
          onError: (error) => {
            console.error('YouTube player error:', error);
          }
        }
      });
    }
  }, [videoId, isCapturingScreenshot]);

  // Create player when video ID changes or component mounts
  useEffect(() => {
    if (videoId && showEmbed) {
      // Wait for YouTube API to load
      if (window.YT && window.YT.Player) {
        initPlayer();
      } else {
        window.onYouTubeIframeAPIReady = initPlayer;
      }
    }
    
    return () => {
      if (playerRef.current) {
        playerRef.current.destroy();
        playerRef.current = null;
      }
    };
  }, [videoId, showEmbed, initPlayer]);

  // Function to format time from seconds to MM:SS
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  // Function to parse timestamp from string (MM:SS) to seconds
  const parseTimestamp = (timestamp) => {
    const parts = timestamp.split(':');
    if (parts.length === 2) {
      return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
    }
    return 0;
  };

  // Function to seek to a specific timestamp
  const seekToTimestamp = (timestamp) => {
    if (playerRef.current && timestamp) {
      const seconds = typeof timestamp === 'string' ? parseTimestamp(timestamp) : timestamp;
      playerRef.current.seekTo(seconds, true);
    }
  };

  // Navigate to next/previous timestamp
  const navigateTimestamps = (direction) => {
    if (timestamps.length === 0) return;
    
    let newIndex;
    if (direction === 'next') {
      newIndex = (currentTimestampIndex + 1) % timestamps.length;
    } else {
      newIndex = (currentTimestampIndex - 1 + timestamps.length) % timestamps.length;
    }
    
    setCurrentTimestampIndex(newIndex);
    if (playerRef.current) {
      seekToTimestamp(timestamps[newIndex].time);
    }
  };

  // Capture screenshot of current frame
  const captureCurrentFrame = () => {
    if (!playerRef.current || !canvasRef.current) return;
    
    try {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      
      // Get the iframe element
      const iframe = document.getElementById(playerRef.current.getIframe().id);
      if (!iframe) return;
      
      // Set canvas dimensions
      const width = iframe.clientWidth;
      const height = iframe.clientHeight;
      canvas.width = width;
      canvas.height = height;
      
      // Draw the frame to canvas
      ctx.drawImage(iframe, 0, 0, width, height);
      
      // Convert to data URL
      const screenshotUrl = canvas.toDataURL('image/png');
      
      // Get current time
      const currentTime = playerRef.current.getCurrentTime();
      const timeKey = formatTime(currentTime);
      
      // Save screenshot
      setScreenshots(prev => ({
        ...prev,
        [timeKey]: screenshotUrl
      }));
      
      // Add timestamp if not already in the list
      if (!timestamps.some(ts => ts.time === currentTime || formatTime(ts.time) === timeKey)) {
        setTimestamps(prev => [
          ...prev,
          {
            time: currentTime,
            label: `Screenshot at ${timeKey}`,
            type: 'screenshot'
          }
        ]);
      }
      
      setIsCapturingScreenshot(false);
      return screenshotUrl;
    } catch (error) {
      console.error('Error capturing screenshot:', error);
      setIsCapturingScreenshot(false);
      return null;
    }
  };

  // Trigger screenshot capture
  const takeScreenshot = () => {
    if (!playerRef.current) return;
    
    setIsCapturingScreenshot(true);
    
    // Pause the video to capture the frame
    playerRef.current.pauseVideo();
    
    // The actual capture will happen in the onStateChange event
    // when the player is confirmed to be paused
  };

  // Function to analyze the YouTube video using Gemini API to identify visual elements
  const analyzeVideo = async () => {
    if (!videoId || !url) {
      setAnalysisError("Please enter a valid YouTube URL first");
      return;
    }
    
    console.log('Starting video analysis for:', { videoId, url, title });
    setAnalysisState('analyzing');
    setAnalysisError(null);
    setVideoAnalysis(null);
    
    try {
      // Get API key from config
      const apiKey = config.GEMINI_API_KEY;
      
      if (!apiKey || apiKey === 'your_api_key_here') {
        const error = "Gemini API key not configured. Please update the API key in src/config.js";
        console.error(error);
        setAnalysisError(error);
        setAnalysisState('error');
        return;
      }
      
      // Build system instruction for video content analysis
      const defaultSystemInstruction = `Analyze this YouTube video and provide a comprehensive summary. Include:

1. Main topics and key points discussed
2. Important visual elements (diagrams, charts, graphs)
3. Key timestamps for important moments
4. Overall summary of the content

Format the output in a clear, structured way that can be used for answering questions about the video.`;

      const systemInstruction = customPrompt || defaultSystemInstruction;
      
      console.log('Sending request to Gemini API with:', {
        videoId,
        systemInstruction
      });
      
      // Prepare request body
      const requestBody = {
        contents: [
          {
            role: "user",
            parts: [
              {
                fileData: {
                  fileUri: `https://youtu.be/${videoId}`,
                  mimeType: "video/*",
                }
              },
              {
                text: "Analyze this video and provide a comprehensive summary of its content.",
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.7,
          topP: 0.95,
          topK: 40,
          maxOutputTokens: 8192,
          responseMimeType: "text/plain"
        },
        systemInstruction: {
          parts: [{ text: systemInstruction }]
        }
      };
      
      // Make the API call
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Gemini API error: ${errorData.error?.message || response.statusText}`);
      }
      
      const data = await response.json();
      console.log('Received response from Gemini API:', data);
      
      // Extract the analysis text
      if (data.candidates && data.candidates[0] && data.candidates[0].content) {
        const analysisText = data.candidates[0].content.parts[0].text;
        console.log('Video analysis completed:', analysisText);
        setVideoAnalysis(analysisText);
        setAnalysisState('complete');
        
        // Notify parent component about the analysis completion
        if (data.onChange) {
          const outputData = {
            url,
            title,
            videoId,
            analysis: analysisText,
            status: 'complete'
          };
          console.log('Notifying parent with analysis data:', outputData);
          data.onChange(outputData);
        }
      } else {
        throw new Error("Unexpected response format from Gemini API");
      }
    } catch (error) {
      console.error("Error analyzing video with Gemini:", error);
      setAnalysisError(error.message);
      setAnalysisState('error');
      
      // Notify parent component about the error
      if (data.onChange) {
        const errorData = {
          url,
          title,
          videoId,
          error: error.message,
          status: 'error'
        };
        console.log('Notifying parent about error:', errorData);
        data.onChange(errorData);
      }
    }
  };

  // Register node for flow execution
  useEffect(() => {
    if (data.registerNodeForFlow && nodeIdRef.current) {
      const unregister = data.registerNodeForFlow(nodeIdRef.current, async (inputData) => {
        console.log(`YouTube Node ${nodeIdRef.current} triggered with input:`, inputData);
        
        try {
          // If we don't have a video yet, check if input data has a YouTube URL to use
          if (!videoId && inputData && typeof inputData === 'object') {
            if (inputData.youtubeUrl || inputData.videoUrl || inputData.url) {
              const inputUrl = inputData.youtubeUrl || inputData.videoUrl || inputData.url;
              console.log('Processing input URL:', inputUrl);
              // Extract video ID and set URL
              const extractedId = getYouTubeVideoId(inputUrl);
              if (extractedId) {
                setVideoId(extractedId);
                setUrl(inputUrl);
                // Try to get title
                try {
                  const videoTitle = await extractYouTubeTitle(inputUrl);
                  if (videoTitle) {
                    setTitle(videoTitle);
                  }
                } catch (error) {
                  console.warn("Could not extract YouTube title:", error);
                }
              }
            }
          }
          
          // If we have a video ID but not analysis, analyze it now
          if (videoId && !videoAnalysis && analysisState !== 'analyzing') {
            console.log('Starting video analysis for flow execution');
            setAnalysisState('analyzing');
            await analyzeVideo();
          }
          
          // Wait for analysis to complete if it's in progress
          if (analysisState === 'analyzing') {
            console.log('Waiting for analysis to complete...');
            // Poll for completion
            for (let i = 0; i < 30; i++) { // Wait up to 30 seconds
              if (analysisState !== 'analyzing') break;
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
          }
          
          // Create output based on current state
          const output = {
            videoId,
            url,
            title: title || 'YouTube Video',
            analysis: videoAnalysis,
            status: analysisState
          };
          
          // Include any error
          if (analysisError) {
            output.error = analysisError;
          }
          
          console.log('YouTube Node final output:', output);
          
          return output;
        } catch (error) {
          console.error(`Error in YouTube Node flow execution: ${error.message}`);
          return { 
            error: error.message,
            videoId,
            url,
            title,
            status: 'error'
          };
        }
      });
      
      return unregister;
    }
  }, [data.registerNodeForFlow, videoId, url, title, videoAnalysis, analysisState, analysisError]);

  // Hidden canvas for screenshots
  const hiddenCanvas = <canvas ref={canvasRef} style={{ display: 'none' }} />;

  return (
    <div className={`node-container youtube-node state-${nodeState} ${data.isInExecutionPath ? 'in-path' : ''}`} style={{ 
      borderRadius: '12px',
      overflow: 'hidden',
      transition: 'all 0.3s ease',
      boxShadow: '0 4px 8px rgba(0,0,0,0.08)'
    }}>
      <Handle 
        type="target" 
        position={Position.Top} 
        id="youtube-input" 
        isConnectable={isConnectable}
        className="node-handle target-handle"
        style={{ background: '#ff0000', border: 'none' }}
      />
      
      <div className="node-header" style={{ 
        background: 'linear-gradient(90deg, #ff0000, #ff4500)',
        padding: '12px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        color: 'white',
        fontWeight: 600,
        fontSize: '14px',
        borderBottom: '1px solid rgba(255,255,255,0.1)'
      }}>
        <Film size={18} className="node-title-icon" />
        <div className="node-title">YouTube Analyzer</div>
      </div>
      
      <div className="node-content" style={{ padding: '16px' }}>
        <div className="url-input-container" style={{
          position: 'relative',
          marginBottom: '12px'
        }}>
          <input
            type="text"
            value={url}
            onChange={handleUrlChange}
            placeholder="Enter YouTube URL"
            className="url-input"
            disabled={nodeState === 'processing' || isProcessing || analysisState === 'analyzing'}
            style={{
              width: '100%',
              padding: '10px 12px',
              paddingRight: '34px',
              borderRadius: '8px',
              border: '1px solid #ddd',
              fontSize: '14px',
              transition: 'border-color 0.2s',
              outline: 'none',
              background: 'white',
              color: '#333'
            }}
          />
          <div className="input-icon" style={{ 
            position: 'absolute',
            right: '12px',
            top: '50%',
            transform: 'translateY(-50%)',
            pointerEvents: 'none',
            color: '#666'
          }}>
            {isProcessing ? (
              <RefreshCw size={16} className="spinning" style={{ animation: 'spin 1s linear infinite' }} />
            ) : url ? (
              <Link size={16} />
            ) : null}
          </div>
        </div>
        
        {videoId && (
          <div className="video-content" style={{ 
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            marginBottom: '12px'
          }}>
            <div className="video-card" style={{
              background: '#f8f9fa',
              borderRadius: '8px',
              overflow: 'hidden',
              boxShadow: '0 2px 6px rgba(0,0,0,0.05)'
            }}>
              <div className="video-thumbnail" style={{
                position: 'relative',
                aspectRatio: '16/9',
                overflow: 'hidden',
                cursor: 'pointer',
                borderBottom: '1px solid #eee'
              }}>
              <img 
                src={getYouTubeThumbnailUrl(videoId)} 
                alt={title || "YouTube video thumbnail"} 
                className="thumbnail-img"
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    transition: 'transform 0.3s',
                    backgroundColor: '#000'
                  }}
              />
              {!showEmbed && (
                  <div className="thumbnail-overlay" onClick={toggleEmbed} style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'rgba(0,0,0,0.4)',
                    transition: 'background 0.2s'
                  }}>
                    <div style={{
                      width: '48px',
                      height: '48px',
                      borderRadius: '50%',
                      background: '#ff0000',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
                    }}>
                      <Play size={24} color="white" />
                    </div>
                </div>
              )}
            </div>
            
              <div className="video-details" style={{
                padding: '12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px'
              }}>
                <div className="video-title" style={{
                  fontSize: '14px',
                  fontWeight: '600',
                  lineHeight: '1.3',
                  color: '#333',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}>{title || "YouTube Video"}</div>
                
                <div className="video-actions" style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginTop: '4px'
                }}>
                <button 
                  className="video-action-btn"
                    onClick={analyzeVideo}
                    disabled={!videoId || analysisState === 'analyzing'}
                    style={{
                      background: '#f0f2f5',
                      border: 'none',
                      padding: '6px 12px',
                      borderRadius: '6px',
                      fontSize: '13px',
                      fontWeight: '500',
                      color: '#333',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      transition: 'background 0.2s'
                    }}
                  >
                    <Bot size={14} />
                    {analysisState === 'analyzing' ? 'Analyzing...' : 
                     analysisState === 'complete' ? 'Analyzed' : 'Analyze Video'}
                  </button>
                  
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button 
                      className="icon-btn"
                  onClick={toggleEmbed}
                  disabled={nodeState === 'processing' || analysisState === 'analyzing'}
                  title={showEmbed ? "Hide player" : "Show player"}
                      style={{
                        background: 'transparent',
                        border: '1px solid #ddd',
                        width: '28px',
                        height: '28px',
                        borderRadius: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        color: '#666',
                        transition: 'all 0.2s'
                      }}
                >
                      <Eye size={14} />
                </button>
                <button 
                      className="icon-btn"
                  onClick={removeVideo}
                  disabled={nodeState === 'processing' || analysisState === 'analyzing'}
                  title="Remove video"
                      style={{
                        background: 'transparent',
                        border: '1px solid #ddd',
                        width: '28px',
                        height: '28px',
                        borderRadius: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        color: '#666',
                        transition: 'all 0.2s'
                      }}
                >
                      <X size={14} />
                </button>
                  </div>
                </div>
              </div>
            </div>
            
            {showEmbed && videoId && (
              <div className="video-player-container" style={{
                borderRadius: '8px',
                overflow: 'hidden',
                background: '#000',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
              }}>
                <div 
                  id="youtube-player" 
                  ref={playerContainerRef} 
                  style={{ width: '100%', aspectRatio: '16/9' }}
                ></div>
                
                {mode === 'screenshot' && (
                  <div className="player-controls" style={{
                    display: 'flex',
                    justifyContent: 'center',
                    padding: '8px',
                    background: '#f8f9fa',
                    borderTop: '1px solid #eee'
                  }}>
                    <button 
                      onClick={takeScreenshot}
                      disabled={isCapturingScreenshot}
                      style={{
                        background: '#3498db',
                        color: 'white',
                        border: 'none',
                        padding: '6px 12px',
                        borderRadius: '4px',
                        fontSize: '13px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      <Camera size={14} />
                      {isCapturingScreenshot ? 'Capturing...' : 'Take Screenshot'}
                    </button>
                  </div>
                )}
              </div>
            )}
            
            {videoAnalysis && analysisState === 'complete' && (
              <div className="analysis-result" style={{
                background: '#f1f8ff',
                padding: '12px',
                borderRadius: '8px',
                fontSize: '13px',
                lineHeight: '1.4',
                maxHeight: '100px',
                overflowY: 'auto',
                border: '1px solid #d1e6ff'
              }}>
                <div style={{ fontWeight: '600', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <CheckCircle size={14} color="#0070f3" />
                  <span>Analysis Complete</span>
                </div>
                <p style={{ margin: '0', color: '#444', fontSize: '12px' }}>
                  Video analysis completed successfully. The results are available for downstream nodes.
                </p>
          </div>
        )}
        
            {analysisError && (
              <div className="analysis-error" style={{
                background: '#fff5f5',
                padding: '12px',
                borderRadius: '8px',
                fontSize: '13px',
                color: '#e53e3e',
                border: '1px solid #fed7d7'
              }}>
                <div style={{ fontWeight: '600', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <AlertCircle size={14} />
                  <span>Analysis Failed</span>
                </div>
                <p style={{ margin: '0', fontSize: '12px' }}>
                  {analysisError}
                </p>
              </div>
            )}
          </div>
        )}

        <div className={`flow-status ${nodeState !== 'idle' || (videoId && videoAnalysis) ? 'active' : ''}`} style={{
          padding: '10px',
          borderRadius: '6px',
          background: nodeState === 'processing' ? '#fcf7e6' :
                     nodeState === 'complete' ? '#edf7ed' :
                     nodeState === 'error' ? '#fce8e6' :
                     videoId && videoAnalysis ? '#f0f7ff' : '#f5f5f5',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontSize: '12px',
          color: nodeState === 'processing' ? '#b06000' :
                 nodeState === 'complete' ? '#1e7e34' :
                 nodeState === 'error' ? '#c62828' :
                 videoId && videoAnalysis ? '#0d47a1' : '#555',
          border: `1px solid ${
            nodeState === 'processing' ? '#fee8bc' :
            nodeState === 'complete' ? '#c8e6c9' :
            nodeState === 'error' ? '#fad2cf' :
            videoId && videoAnalysis ? '#bbdefb' : '#e0e0e0'
          }`
        }}>
          {nodeState === 'processing' ? (
            <>
              <RefreshCw size={14} className="spinning" style={{ animation: 'spin 1s linear infinite' }} />
              <span>Processing video...</span>
            </>
          ) : nodeState === 'complete' ? (
            <>
              <CheckCircle size={14} />
              <span>Video processed successfully</span>
            </>
          ) : nodeState === 'error' ? (
            <>
              <AlertCircle size={14} />
              <span>Error processing video</span>
            </>
          ) : videoId && videoAnalysis ? (
            <>
              <CheckCircle size={14} />
              <span>Video ready for flow execution</span>
            </>
          ) : videoId ? (
            <>
              <Film size={14} />
              <span>Video loaded, needs analysis</span>
            </>
          ) : (
            <>
              <Film size={14} />
              <span>Add a YouTube URL to analyze</span>
            </>
          )}
        </div>
      </div>
      
      {hiddenCanvas}
      
      <Handle 
        type="source" 
        position={Position.Bottom} 
        id="youtube-output" 
        isConnectable={isConnectable}
        className="node-handle source-handle"
        style={{ background: '#ff0000', border: 'none' }}
      />
    </div>
  );
}

export default YouTubeScreenshotNode; 