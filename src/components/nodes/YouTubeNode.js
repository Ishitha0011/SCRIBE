import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Handle, Position } from 'reactflow';
import { Link, X, AlertCircle, RefreshCw, CheckCircle, Play, Film, Eye, Bot, FileText } from 'lucide-react';
import { getYouTubeVideoId, extractYouTubeTitle, getYouTubeEmbedUrl, getYouTubeThumbnailUrl } from '../../utils/youtubeUtils';
import { registerNode } from '../../utils/flowUtils';

function YouTubeNode({ id, data, isConnectable }) {
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
  const nodeIdRef = useRef(id);
  
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
        customPrompt
      });
    }
  }, [data, url, title, videoId, videoAnalysis, customPrompt]);

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

  // Function to analyze the YouTube video using Gemini API
  const analyzeVideo = async () => {
    if (!videoId || !url) {
      setAnalysisError("Please enter a valid YouTube URL first");
      return;
    }
    
    setAnalysisState('analyzing');
    setAnalysisError(null);
    setVideoAnalysis(null);
    
    try {
      // Get API key from environment
      //const apiKey = process.env.GEMINI_API_KEY;
      const apiKey = "AIzaSyAHP5Y8yYaaLBj9QGknvIRA5gp0Ab5oZkk";
      if (!apiKey) {
        throw new Error("Gemini API key not found. Please set REACT_APP_GEMINI_API_KEY in your environment.");
      }
      
      // Build system instruction
      const defaultSystemInstruction = `Provide a comprehensive timestamp breakdown and detailed summary of this YouTube video, including:
      
1. Key points and main topics discussed
2. Important quotes or statements
3. Any demonstrations, examples, or visual elements shown
4. Main takeaways and conclusions
5. Links or references mentioned
6. Technical specifications or equipment used (if relevant)
7. Chapter markers or natural segment breaks
8. Notable audience interactions or comments addressed

Please organize the information chronologically and highlight particularly significant moments.`;

      const systemInstruction = customPrompt || defaultSystemInstruction;
      
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
                text: "Please analyze this video in detail.",
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
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro-exp-03-25:generateContent?key=${apiKey}`, {
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
      
      // Extract the analysis text
      if (data.candidates && data.candidates[0] && data.candidates[0].content) {
        const analysisText = data.candidates[0].content.parts[0].text;
        setVideoAnalysis(analysisText);
        setAnalysisState('complete');
      } else {
        throw new Error("Unexpected response format from Gemini API");
      }
    } catch (error) {
      console.error("Error analyzing video with Gemini:", error);
      setAnalysisError(error.message);
      setAnalysisState('error');
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
            setAnalysisState('analyzing');
            await analyzeVideo();
          }
          
          // Wait for analysis to complete if it's in progress
          if (analysisState === 'analyzing') {
            // Poll for completion - this is a simplified approach
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
            hasAnalysis: !!videoAnalysis
          };
          
          // Include analysis if available
          if (videoAnalysis) {
            output.analysis = videoAnalysis;
            output.analysisType = 'gemini';
          }
          
          // Include any error
          if (analysisError) {
            output.error = analysisError;
          }
          
          return output;
        } catch (error) {
          console.error(`Error in YouTube Node flow execution: ${error.message}`);
          return { 
            error: error.message,
            videoId,
            url,
            title
          };
        }
      });
      
      return unregister;
    }
  }, [data.registerNodeForFlow, videoId, url, title, videoAnalysis, analysisState, analysisError]);
  
  // Function to truncate analysis for display
  const getTruncatedAnalysis = useCallback(() => {
    if (!videoAnalysis) return '';
    return videoAnalysis.length > 300 
      ? videoAnalysis.substring(0, 300) + '...' 
      : videoAnalysis;
  }, [videoAnalysis]);

  return (
    <div className={`node-container youtube-node state-${nodeState} ${data.isInExecutionPath ? 'in-path' : ''}`}>
      <Handle 
        type="target" 
        position={Position.Top} 
        id="youtube-input" 
        isConnectable={isConnectable}
        className="node-handle target-handle"
      />
      
      <div className="node-header">
        <Film size={18} className="node-title-icon" />
        <div className="node-title">YouTube Video</div>
      </div>
      
      <div className="node-content">
        <div className="url-input-container">
          <input
            type="text"
            value={url}
            onChange={handleUrlChange}
            placeholder="Enter YouTube URL"
            className="url-input"
            disabled={nodeState === 'processing' || isProcessing || analysisState === 'analyzing'}
          />
          <div className="input-icon">
            {isProcessing ? (
              <RefreshCw size={16} className="spinning" />
            ) : url ? (
              <Link size={16} />
            ) : null}
          </div>
        </div>
        
        {videoId && (
          <div className="video-preview">
            <div className="video-thumbnail">
              <img 
                src={getYouTubeThumbnailUrl(videoId)} 
                alt={title || "YouTube video thumbnail"} 
                className="thumbnail-img"
              />
              {!showEmbed && (
                <div className="thumbnail-overlay" onClick={toggleEmbed}>
                  <Play size={32} />
                </div>
              )}
            </div>
            
            <div className="video-info">
              <div className="video-title">{title || "YouTube Video"}</div>
              <div className="video-actions">
                <button 
                  className="video-action-btn"
                  onClick={toggleEmbed}
                  disabled={nodeState === 'processing' || analysisState === 'analyzing'}
                  title={showEmbed ? "Hide embed" : "Show embed"}
                >
                  <Eye size={16} />
                </button>
                <button 
                  className="video-action-btn"
                  onClick={removeVideo}
                  disabled={nodeState === 'processing' || analysisState === 'analyzing'}
                  title="Remove video"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
          </div>
        )}
        
        {showEmbed && videoId && (
          <div className="video-embed-container">
            <iframe
              src={getYouTubeEmbedUrl(videoId)}
              title={title || "YouTube video player"}
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="youtube-embed"
            ></iframe>
          </div>
        )}
        
        {/* Gemini Analysis Section */}
        {videoId && (
          <div className="video-analysis-section">
            <div className="analysis-header">
              <div className="analysis-title">
                <Bot size={16} />
                <span>Gemini Video Analysis</span>
              </div>
              <button
                className={`custom-prompt-toggle ${showCustomPrompt ? 'active' : ''}`}
                onClick={toggleCustomPrompt}
                title="Customize analysis prompt"
              >
                <FileText size={14} />
              </button>
            </div>
            
            {showCustomPrompt && (
              <div className="custom-prompt-container">
                <textarea
                  value={customPrompt}
                  onChange={handleCustomPromptChange}
                  placeholder="Enter custom instructions for video analysis..."
                  className="custom-prompt-input"
                  rows={3}
                  disabled={analysisState === 'analyzing'}
                />
              </div>
            )}
            
            <div className="analysis-controls">
              <button
                className={`analyze-button ${analysisState}`}
                onClick={analyzeVideo}
                disabled={!videoId || analysisState === 'analyzing' || nodeState === 'processing'}
              >
                {analysisState === 'analyzing' ? (
                  <>
                    <RefreshCw size={14} className="spinning" />
                    <span>Analyzing...</span>
                  </>
                ) : analysisState === 'complete' ? (
                  <>
                    <CheckCircle size={14} />
                    <span>Reanalyze</span>
                  </>
                ) : analysisState === 'error' ? (
                  <>
                    <AlertCircle size={14} />
                    <span>Retry Analysis</span>
                  </>
                ) : (
                  <>
                    <Bot size={14} />
                    <span>Analyze with Gemini</span>
                  </>
                )}
              </button>
            </div>
            
            {analysisError && (
              <div className="analysis-error">
                <AlertCircle size={14} />
                <span>{analysisError}</span>
              </div>
            )}
            
            {videoAnalysis && (
              <div className="analysis-preview">
                <div className="analysis-content">{getTruncatedAnalysis()}</div>
                {videoAnalysis.length > 300 && (
                  <div className="analysis-info">Full analysis will be passed to connected nodes</div>
                )}
              </div>
            )}
          </div>
        )}

        <div className={`flow-info ${nodeState !== 'idle' ? 'active' : ''}`}>
          {nodeState === 'processing' ? (
            <div className="processing-indicator">
              <RefreshCw size={16} className="spinning" />
              <span>Processing video...</span>
            </div>
          ) : nodeState === 'complete' ? (
            <div className="complete-indicator">
              <CheckCircle size={16} />
              <span>Video processed successfully</span>
            </div>
          ) : nodeState === 'error' ? (
            <div className="error-indicator">
              <AlertCircle size={16} />
              <span>Error processing video</span>
            </div>
          ) : videoId ? (
            <div className="flow-instruction">
              <span>Ready for flow execution</span>
            </div>
          ) : (
            <div className="flow-instruction">
              <span>Add a YouTube URL to process</span>
            </div>
          )}
        </div>
      </div>
      
      <Handle 
        type="source" 
        position={Position.Bottom} 
        id="youtube-output" 
        isConnectable={isConnectable}
        className="node-handle source-handle"
      />
    </div>
  );
}

export default YouTubeNode; 