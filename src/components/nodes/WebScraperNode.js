/* eslint-disable */

import React, { useState, useEffect, useRef } from 'react';
import { Handle, Position } from 'reactflow';
import '../../css/Nodes.css';
import { Globe, Copy, Trash2, CheckCircle, AlertCircle, RefreshCw as ProcessingIcon } from 'lucide-react';
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
    <div className={`web-scraper-node node-container state-${nodeState} ${theme} ${data.isInExecutionPath ? 'in-path' : ''}`}>
      <Handle
        type="target"
        position={Position.Top}
        isConnectable={isConnectable}
        className="node-handle target-handle"
      />
      <div className="node-header">
        <Globe size={16} className="node-title-icon" />
        <div className="node-title">Web Scraper</div>
      </div>
      
      <div className="node-content">
        {isEditing ? (
          <textarea
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            autoFocus
            onBlur={() => setIsEditing(false)}
            className="node-textarea"
            placeholder="Enter website URL to scrape..."
          />
        ) : (
          <div
            className="node-text"
            onClick={() => setIsEditing(true)}
          >
            {url || <span className="placeholder-text">Click to enter URL</span>}
          </div>
        )}
        
        <div className="node-actions">
          <button 
            className="node-action-btn" 
            onClick={handleCopy}
            title={copied ? "Copied!" : "Copy URL"}
          >
            <Copy size={14} />
          </button>
          <button 
            className="node-action-btn" 
            onClick={handleClear}
            title="Clear URL"
          >
            <Trash2 size={14} />
          </button>
          <button 
            className="node-action-btn" 
            onClick={scrapeWebsite}
            disabled={!url || nodeState === 'processing'}
            title="Scrape Website"
          >
            {nodeState === 'processing' ? <ProcessingIcon size={14} className="spinning" /> : 'Scrape'}
          </button>
        </div>

        {/* Status Indicator */}
        <div className="node-status-indicator">
          {nodeState === 'processing' && (
            <>
              <ProcessingIcon size={14} className="spinning" />
              <span className="status-text status-processing">Scraping...</span>
            </>
          )}
          {nodeState === 'complete' && (
            <>
              <CheckCircle size={14} />
              <span className="status-text status-complete">Completed</span>
            </>
          )}
          {nodeState === 'error' && (
            <>
              <AlertCircle size={14} />
              <span className="status-text status-error">{errorMessage || 'Error'}</span>
            </>
          )}
        </div>

        {scrapedContent && (
          <div className="scraped-content">
            <h4>Scraped Content:</h4>
            <div className="content-preview">
              <strong>Title:</strong> {scrapedContent.title}<br/>
              {scrapedContent.description && (
                <>
                  <strong>Description:</strong> {scrapedContent.description}<br/>
                </>
              )}
              <strong>URL:</strong> {scrapedContent.url}
            </div>
          </div>
        )}
      </div>
      
      <Handle
        type="source"
        position={Position.Bottom}
        isConnectable={isConnectable}
        className="node-handle source-handle"
      />
    </div>
  );
};

export default WebScraperNode; 