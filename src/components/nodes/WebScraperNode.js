/* eslint-disable */

import React, { useState, useEffect, useRef } from 'react';
import { Handle, Position } from 'reactflow';
import '../../css/Nodes.css';
import { Globe, Copy, Trash2, CheckCircle, AlertCircle, RefreshCw as ProcessingIcon, Link } from 'lucide-react';
import { useTheme } from '../../ThemeContext';

const WebScraperNode = ({ data, isConnectable, id }) => {
  const { theme } = useTheme();
  const [url, setUrl] = useState(data.url || '');
  const [isEditing, setIsEditing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [scrapedContent, setScrapedContent] = useState(null);
  const [nodeState, setNodeState] = useState('idle'); // idle, processing, complete, error
  const [errorMessage, setErrorMessage] = useState(null);
  const nodeIdRef = useRef(id);

  // Ensure we track the node ID
  useEffect(() => {
    nodeIdRef.current = id;
  }, [id]);

  // Update data when url or scrapedContent changes
  useEffect(() => {
    if (data.onChange) {
      data.onChange({ 
        url,
        scrapedContent,
        nodeState,
        errorMessage
      });
    }
  }, [url, scrapedContent, nodeState, errorMessage, data]);

  // Handle flow execution states
  useEffect(() => {
    let timer;
    if (data.isExecuting) {
      setNodeState('processing');
    } else if (data.executionComplete) {
      setNodeState('complete');
      timer = setTimeout(() => setNodeState('idle'), 2000);
    } else if (data.executionError) {
      setNodeState('error');
      setErrorMessage(data.executionError);
      timer = setTimeout(() => setNodeState('idle'), 3000);
    } else if (!data.isInExecutionPath) {
      setNodeState('idle');
    }
    return () => clearTimeout(timer);
  }, [data.isExecuting, data.executionComplete, data.executionError, data.isInExecutionPath]);

  const handleCopy = () => {
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClear = () => {
    setUrl('');
    setScrapedContent(null);
    setNodeState('idle');
    setErrorMessage(null);
  };

  const scrapeWebsite = async () => {
    if (!url) return;
    
    setNodeState('processing');
    setErrorMessage(null);
    
    try {
      const response = await fetch('http://localhost:8000/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Failed to scrape website' }));
        throw new Error(errorData.detail || `HTTP error ${response.status}`);
      }
      
      const data = await response.json();
      setScrapedContent(data);
      setNodeState('complete');
      
      // Pass scraped content to the next node (AIChatNode)
      if (data.onChange) {
        data.onChange({ 
          scrapedContent: data,
          nodeState: 'complete'
        });
      }
    } catch (error) {
      console.error('Error scraping website:', error);
      setErrorMessage(error.message);
      setNodeState('error');
    }
  };

  // Register node for flow execution
  useEffect(() => {
    if (data.registerNodeForFlow && nodeIdRef.current) {
      const unregister = data.registerNodeForFlow(nodeIdRef.current, async (inputData) => {
        if (!scrapedContent) {
          return { error: "No scraped content. Please scrape a website first." };
        }
        return scrapedContent;
      });
      return unregister;
    }
  }, [data.registerNodeForFlow, data.id, scrapedContent]);

  return (
    <div 
      className={`web-scraper-node node-container state-${nodeState} ${data.isInExecutionPath ? 'in-path' : ''}`}
      style={{ 
        borderRadius: '12px',
        overflow: 'hidden',
        transition: 'all 0.3s ease',
        boxShadow: '0 4px 8px rgba(0,0,0,0.08)',
        background: theme === 'dark' ? '#2a2d3e' : 'white'
      }}
    >
      <Handle
        type="target"
        position={Position.Top}
        isConnectable={isConnectable}
        className="node-handle target-handle"
        style={{ 
          background: '#3498db',
          border: 'none' 
        }}
      />
      
      <div className="node-header" style={{ 
        background: 'linear-gradient(90deg, #2980b9, #3498db)',
        padding: '12px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        color: 'white',
        fontWeight: 600,
        fontSize: '14px',
        borderBottom: '1px solid rgba(255,255,255,0.1)'
      }}>
        <Globe size={16} className="node-title-icon" />
        <div className="node-title">Web Scraper</div>
      </div>
      
      <div className="node-content" style={{ padding: '16px' }}>
        <div className="url-input-container" style={{
          position: 'relative',
          marginBottom: '12px'
        }}>
          {isEditing ? (
            <textarea
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              autoFocus
              onBlur={() => setIsEditing(false)}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '8px',
                border: '1px solid #ddd',
                fontSize: '14px',
                minHeight: '36px',
                resize: 'vertical',
                fontFamily: 'inherit',
                outline: 'none',
                color: '#333',
                background: 'white'
              }}
              placeholder="Enter website URL to scrape..."
            />
          ) : (
            <div
              onClick={() => setIsEditing(true)}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '8px',
                border: '1px solid #ddd',
                fontSize: '14px',
                minHeight: '36px',
                cursor: 'text',
                background: theme === 'dark' ? '#3a3f55' : 'white',
                color: theme === 'dark' ? '#e1e1e6' : '#333',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              {url ? (
                <>
                  <Link size={14} color={theme === 'dark' ? '#8c94b8' : '#6e7785'} />
                  <span style={{ wordBreak: 'break-all' }}>{url}</span>
                </>
              ) : (
                <span style={{ 
                  color: theme === 'dark' ? '#8c94b8' : '#aaa',
                  fontStyle: 'italic'
                }}>
                  Click to enter URL
                </span>
              )}
            </div>
          )}
        </div>
        
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between',
          marginBottom: '16px',
          gap: '8px'
        }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button 
              onClick={handleCopy}
              title={copied ? "Copied!" : "Copy URL"}
              style={{
                background: 'transparent',
                border: '1px solid #ddd',
                borderRadius: '6px',
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: copied ? '#16a34a' : '#666',
                transition: 'all 0.2s'
              }}
            >
              {copied ? <CheckCircle size={14} /> : <Copy size={14} />}
            </button>
            
            <button 
              onClick={handleClear}
              title="Clear URL"
              style={{
                background: 'transparent',
                border: '1px solid #ddd',
                borderRadius: '6px',
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: '#666',
                transition: 'all 0.2s'
              }}
            >
              <Trash2 size={14} />
            </button>
          </div>
          
          <button 
            onClick={scrapeWebsite}
            disabled={!url || nodeState === 'processing'}
            style={{
              background: !url || nodeState === 'processing' ? '#e0e0e0' : '#3498db',
              color: !url || nodeState === 'processing' ? '#888' : 'white',
              border: 'none',
              borderRadius: '6px',
              padding: '0 16px',
              height: '32px',
              fontWeight: '500',
              fontSize: '13px',
              cursor: !url || nodeState === 'processing' ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.2s'
            }}
          >
            {nodeState === 'processing' ? (
              <>
                <ProcessingIcon size={14} style={{ animation: 'spin 1s linear infinite' }} />
                Scraping...
              </>
            ) : (
              'Scrape Website'
            )}
          </button>
        </div>

        {/* Status Indicator */}
        <div className={`status-box ${nodeState}`} style={{
          padding: '10px',
          borderRadius: '6px',
          background: nodeState === 'processing' ? '#fcf7e6' :
                     nodeState === 'complete' ? '#edf7ed' :
                     nodeState === 'error' ? '#fce8e6' : 
                     '#f5f5f5',
          marginBottom: '16px',
          display: (nodeState === 'idle' && !scrapedContent) ? 'none' : 'flex',
          alignItems: 'center',
          gap: '8px',
          fontSize: '12px',
          color: nodeState === 'processing' ? '#b06000' :
                nodeState === 'complete' ? '#1e7e34' :
                nodeState === 'error' ? '#c62828' : '#555',
          border: `1px solid ${
            nodeState === 'processing' ? '#fee8bc' :
            nodeState === 'complete' ? '#c8e6c9' :
            nodeState === 'error' ? '#fad2cf' : '#e0e0e0'
          }`
        }}>
          {nodeState === 'processing' && (
            <>
              <ProcessingIcon size={14} style={{ animation: 'spin 1s linear infinite' }} />
              <span>Extracting content...</span>
            </>
          )}
          {nodeState === 'complete' && (
            <>
              <CheckCircle size={14} />
              <span>Content extracted successfully</span>
            </>
          )}
          {nodeState === 'error' && (
            <>
              <AlertCircle size={14} />
              <span>{errorMessage || 'Error scraping website'}</span>
            </>
          )}
          {nodeState === 'idle' && scrapedContent && (
            <>
              <CheckCircle size={14} color="#1e7e34" />
              <span style={{ color: '#1e7e34' }}>Content ready</span>
            </>
          )}
        </div>

        {scrapedContent && (
          <div style={{
            background: theme === 'dark' ? '#2c3046' : '#f8f9fa',
            borderRadius: '8px',
            padding: '12px',
            fontSize: '13px',
            color: theme === 'dark' ? '#e1e1e6' : '#333',
            border: `1px solid ${theme === 'dark' ? '#3d4257' : '#e9ecef'}`
          }}>
            <div style={{ 
              fontWeight: '600', 
              marginBottom: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              color: theme === 'dark' ? '#8c94b8' : '#444'
            }}>
              <Globe size={14} />
              <span>Scraped Content</span>
            </div>
            
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '6px'
            }}>
              <div>
                <span style={{ 
                  fontWeight: '600',
                  color: theme === 'dark' ? '#8c94b8' : '#666',
                  fontSize: '12px'
                }}>Title:</span>{' '}
                <span style={{ fontSize: '12px' }}>{scrapedContent.title}</span>
              </div>
              
              {scrapedContent.description && (
                <div>
                  <span style={{ 
                    fontWeight: '600',
                    color: theme === 'dark' ? '#8c94b8' : '#666',
                    fontSize: '12px'
                  }}>Description:</span>{' '}
                  <span style={{ 
                    fontSize: '12px',
                    display: 'block',
                    marginTop: '4px',
                    lineHeight: '1.4'
                  }}>
                    {scrapedContent.description.length > 120 
                      ? `${scrapedContent.description.substring(0, 120)}...` 
                      : scrapedContent.description}
                  </span>
                </div>
              )}
              
              <div>
                <span style={{ 
                  fontWeight: '600',
                  color: theme === 'dark' ? '#8c94b8' : '#666',
                  fontSize: '12px'
                }}>URL:</span>{' '}
                <span style={{ 
                  fontSize: '12px',
                  wordBreak: 'break-all',
                  color: theme === 'dark' ? '#adb5bd' : '#6c757d'
                }}>{scrapedContent.url}</span>
              </div>
            </div>
          </div>
        )}
      </div>
      
      <Handle
        type="source"
        position={Position.Bottom}
        isConnectable={isConnectable}
        className="node-handle source-handle"
        style={{ 
          background: '#3498db',
          border: 'none' 
        }}
      />
    </div>
  );
};

export default WebScraperNode; 