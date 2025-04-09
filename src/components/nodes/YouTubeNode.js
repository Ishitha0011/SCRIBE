import React, { useState, useEffect, useCallback } from 'react';
import { Handle } from 'reactflow';
import { Link, Upload, X, AlertCircle, RefreshCw, CheckCircle, Play, Film, Eye } from 'lucide-react';
import { getYouTubeVideoId, extractYouTubeTitle, getYouTubeEmbedUrl, getYouTubeThumbnailUrl } from '../../utils/youtubeUtils';
import { registerNode } from '../../utils/flowUtils';

function YouTubeNode({ id, data }) {
  const [url, setUrl] = useState(data.url || '');
  const [title, setTitle] = useState(data.title || '');
  const [videoId, setVideoId] = useState(data.videoId || '');
  const [showEmbed, setShowEmbed] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [nodeState, setNodeState] = useState('idle'); // 'idle', 'processing', 'complete', 'error'

  // Effect to update data when our state changes
  useEffect(() => {
    data.url = url;
    data.title = title;
    data.videoId = videoId;
  }, [data, url, title, videoId]);

  // Effect to handle flow execution states
  useEffect(() => {
    if (data.isExecuting) {
      setNodeState('processing');
    } else if (data.executionComplete) {
      setNodeState('complete');
      // Reset after 3 seconds
      const timer = setTimeout(() => {
        setNodeState('idle');
      }, 3000);
      return () => clearTimeout(timer);
    } else if (data.executionError) {
      setNodeState('error');
      // Reset after 3 seconds
      const timer = setTimeout(() => {
        setNodeState('idle');
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [data.isExecuting, data.executionComplete, data.executionError]);

  // Register this node for flow execution
  useEffect(() => {
    registerNode(id, async (data, setNodeData) => {
      setNodeData({ ...data, isExecuting: true });
      
      try {
        // Simulate processing time
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Process the YouTube URL
        if (url && videoId) {
          console.log(`Processing YouTube video: ${url}`);
          // Here you would typically process the YouTube video further in a real scenario
        } else {
          throw new Error('No valid YouTube URL found');
        }
        
        // Set execution as complete
        setNodeData({ 
          ...data, 
          isExecuting: false, 
          executionComplete: true,
          output: {
            videoProcessed: true,
            videoSource: 'youtube',
            videoId: videoId,
            videoTitle: title || 'YouTube Video',
            videoUrl: url
          }
        });
      } catch (error) {
        console.error("Error processing video:", error);
        setNodeData({ 
          ...data, 
          isExecuting: false, 
          executionError: true,
          errorMessage: error.message
        });
      }
    });
  }, [id, url, title, videoId]);

  const handleUrlChange = useCallback(async (e) => {
    const newUrl = e.target.value;
    setUrl(newUrl);
    
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
  }, []);

  const toggleEmbed = useCallback(() => {
    setShowEmbed(!showEmbed);
  }, [showEmbed]);

  return (
    <div className="node-container youtube-node">
      <Handle type="target" position="top" id="youtube-input" />
      <div className="node-header">
        <Film size={18} />
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
            disabled={nodeState === 'processing' || isProcessing}
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
                  disabled={nodeState === 'processing'}
                  title={showEmbed ? "Hide embed" : "Show embed"}
                >
                  <Eye size={16} />
                </button>
                <button 
                  className="video-action-btn"
                  onClick={removeVideo}
                  disabled={nodeState === 'processing'}
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

        <div className={`flow-info ${nodeState !== 'idle' ? 'active' : ''}`}>
          {nodeState === 'processing' ? (
            <div className="processing-indicator">
              <RefreshCw size={16} className="spinning" />
              Processing video...
            </div>
          ) : nodeState === 'complete' ? (
            <div className="complete-indicator">
              <CheckCircle size={16} />
              Video processed successfully
            </div>
          ) : nodeState === 'error' ? (
            <div className="error-indicator">
              <AlertCircle size={16} />
              Error processing video
            </div>
          ) : videoId ? (
            <div className="flow-instruction">
              YouTube video is ready for flow execution
            </div>
          ) : (
            <div className="flow-instruction">
              Add a YouTube URL to process during flow execution
            </div>
          )}
        </div>
      </div>
      <Handle type="source" position="bottom" id="youtube-output" />
    </div>
  );
}

export default YouTubeNode; 