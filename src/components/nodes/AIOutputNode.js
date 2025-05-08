/* eslint-disable */

import React, { useState, useEffect, useRef } from 'react';
import { Handle, Position } from 'reactflow';
import '../../css/Nodes.css';
import { Bot, Copy, Download, CheckCircle, AlertCircle, RefreshCw as ProcessingIcon, Code, FileText } from 'lucide-react';
import { useTheme } from '../../ThemeContext'; // Import useTheme hook

const AIOutputNode = ({ data, isConnectable, id }) => {
  const { theme } = useTheme(); // Access the current theme
  const [copied, setCopied] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [nodeState, setNodeState] = useState('idle'); // idle, processing, complete, error
  const [displayMode, setDisplayMode] = useState('plain'); // 'plain', 'formatted', 'code'
  const [errorMessage, setErrorMessage] = useState(null);
  const responseRef = useRef(null);
  const nodeIdRef = useRef(id);
  
  // Store the actual response text separately
  const [responseText, setResponseText] = useState(data.response || '');

  // Ensure we capture the node ID even if it changes
  useEffect(() => {
    nodeIdRef.current = id;
  }, [id]);
  
  // Update external data store (if onChange is provided)
  useEffect(() => {
    if (data.onChange) {
      data.onChange({ 
        response: responseText, // Pass the actual text
        displayMode,
        errorMessage
      });
    }
  }, [responseText, displayMode, errorMessage, data]);
  
  // Update internal state based on flow execution props
  useEffect(() => {
    let timer;
    if (data.isExecuting) {
      setNodeState('processing');
      setIsProcessing(true);
      setErrorMessage(null); // Clear previous errors
      // Optionally clear previous response
      // setResponseText(''); 
    } else if (data.executionComplete) {
      setNodeState('complete');
      setIsProcessing(false);
      timer = setTimeout(() => setNodeState('idle'), 2000);
    } else if (data.executionError) {
      setNodeState('error');
      setIsProcessing(false);
      setErrorMessage(data.executionError || 'An unspecified error occurred during flow execution.');
      timer = setTimeout(() => setNodeState('idle'), 3000);
    } else if (!data.isInExecutionPath) {
      setNodeState('idle');
      setIsProcessing(false);
    }
    return () => clearTimeout(timer);
  }, [data.isExecuting, data.executionComplete, data.executionError, data.isInExecutionPath]);
  
  const handleCopy = () => {
    if (!responseText) return;
    navigator.clipboard.writeText(responseText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  
  const handleDownload = () => {
    if (!responseText) return;
    
    const blob = new Blob([responseText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ai-response.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
  
  const toggleDisplayMode = () => {
    if (displayMode === 'plain') {
      setDisplayMode('formatted');
    } else if (displayMode === 'formatted') {
      setDisplayMode('code');
    } else {
      setDisplayMode('plain');
    }
  };

  // Format the response based on display mode
  const formatResponse = (text) => {
    // Ensure it handles empty/null text gracefully
    if (!text) return null;

    if (displayMode === 'plain') {
      // Use pre for better whitespace handling in plain text
      return <pre className="plain-text">{text}</pre>; 
    } 
    
    if (displayMode === 'formatted') {
      // Simple markdown-like formatting (can be enhanced)
      return (
        <div className="formatted-text">
          {text.split('\n').map((line, i) => {
            if (line.startsWith('# ')) return <h1 key={i}>{line.substring(2)}</h1>;
            if (line.startsWith('## ')) return <h2 key={i}>{line.substring(3)}</h2>;
            if (line.startsWith('### ')) return <h3 key={i}>{line.substring(4)}</h3>;
            // Basic bold/italic - enhance as needed
            line = line.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
            line = line.replace(/\*([^*]+)\*/g, '<em>$1</em>');
            return line ? <p key={i} dangerouslySetInnerHTML={{ __html: line }} /> : <br key={i} />;
          })}
        </div>
      );
    }
    
    if (displayMode === 'code') {
      const codeBlockRegex = /```(\w+)?\n?([\s\S]*?)```/g; // Improved regex
      const parts = [];
      let lastIndex = 0;
      let match;
      
      // Check if there are code blocks
      const testMatch = text.match(codeBlockRegex);
      
      if (testMatch) {
        while ((match = codeBlockRegex.exec(text)) !== null) {
          if (match.index > lastIndex) {
            parts.push({ type: 'text', content: text.substring(lastIndex, match.index) });
          }
          parts.push({ type: 'code', language: match[1] || '', content: match[2] });
          lastIndex = match.index + match[0].length;
        }
        if (lastIndex < text.length) {
          parts.push({ type: 'text', content: text.substring(lastIndex) });
        }
      } else {
        // No triple-backtick blocks, check if it looks like code
        // Simple check: more than 2 lines and common code characters
        const lines = text.split('\n');
        if (lines.length > 2 && /[{};()=<>]/.test(text)) {
           parts.push({ type: 'code', language: '', content: text });
        } else {
           // Treat as plain text if no blocks and doesn't look like code
           parts.push({ type: 'text', content: text });
        }
      }
        
      return (
        <div className="code-view">
          {parts.map((part, i) => (
            part.type === 'code' ? (
              <div className="code-block" key={i}>
                {part.language && (
                  <div className="code-language">{part.language}</div>
                )}
                <pre><code>{part.content}</code></pre>
                <button 
                  className="code-copy-btn"
                  onClick={() => {
                    navigator.clipboard.writeText(part.content);
                    setCopied(true); // Use main copied state
                    setTimeout(() => setCopied(false), 2000);
                  }}
                  title="Copy Code Block"
                >
                  {copied ? <CheckCircle size={13}/> : <Copy size={13} />}
                </button>
              </div>
            ) : (
              // Render non-code text using similar logic as formatted view
              <div className="text-block" key={i}>
                 {part.content.split('\n').map((line, j) => 
                    line ? <p key={j}>{line}</p> : <br key={j} />
                 )}
              </div>
            )
          ))}
        </div>
      );
    }
    
    return <pre>{text}</pre>; // Fallback to preformatted text
  };
  
  // Handle flow execution: Extract response/error from inputData
  useEffect(() => {
    if (data.registerNodeForFlow && nodeIdRef.current) {
      const unregister = data.registerNodeForFlow(nodeIdRef.current, async (inputData) => {
        setIsProcessing(true);
        setNodeState('processing');
        setErrorMessage(null); // Clear previous errors
        setResponseText(''); // Clear previous response text
        
        // Simulate processing delay
        await new Promise(resolve => setTimeout(resolve, 200)); 
        
        if (inputData?.error) {
          console.error(`AIOutputNode (${nodeIdRef.current}) received error:`, inputData.error);
          setErrorMessage(inputData.error);
          setNodeState('error');
        } else if (inputData?.response) {
          setResponseText(inputData.response);
            setNodeState('complete');
        } else {
          // Handle cases where input is missing expected fields
          console.warn(`AIOutputNode (${nodeIdRef.current}) received unexpected input:`, inputData);
          setErrorMessage('Received invalid data from previous node.');
          setNodeState('error');
        }
        
        setIsProcessing(false);
        
        // Pass data through (could be modified if this node transforms data)
        return inputData;
      });
      
      return unregister;
    }
  }, [data.registerNodeForFlow]); // Re-register only if register function changes

  return (
    // Add theme class to the root container
    <div className={`ai-output-node node-container state-${nodeState} ${theme}`}>
      <Handle type="target" position={Position.Top} id="a" isConnectable={isConnectable} className="node-handle target-handle" />
      
      <div className="node-header ai-output-header">
        <div className="node-header-title">
           <Bot size={15} className="node-title-icon" />
           <span>AI Output</span>
        </div>
        <div className="node-header-actions">
          <button 
            className={`node-action-btn display-mode-btn mode-${displayMode}`}
            onClick={toggleDisplayMode}
            disabled={!responseText || isProcessing}
            title={ /* Dynamic title based on mode */
              displayMode === 'plain' ? 'View Formatted' :
              displayMode === 'formatted' ? 'View Code' :
              'View Plain Text'
            }
          >
            {/* Cycle through icons based on mode */}
            {displayMode === 'plain' ? <FileText size={14} /> :
             displayMode === 'formatted' ? <Code size={14} /> :
             <Bot size={14} />}
          </button>
          <button 
            className="node-action-btn" 
            onClick={handleCopy}
            disabled={!responseText || isProcessing}
            title={copied ? "Copied!" : "Copy Full Response"}
          >
            {copied ? <CheckCircle size={14} /> : <Copy size={14} />}
          </button>
          <button 
            className="node-action-btn" 
            onClick={handleDownload}
            disabled={!responseText || isProcessing}
            title="Download Response"
          >
            <Download size={14} />
          </button>
        </div>
      </div>

      <div className="node-content ai-output-content">
        <div 
          className={`ai-response-container ${isProcessing ? 'processing' : ''}`}
          ref={responseRef}
        >
          {isProcessing && !responseText && !errorMessage ? (
            <div className="processing-placeholder">
              <ProcessingIcon size={18} className="spinning" />
              <span>Processing...</span>
            </div>
          ) : errorMessage ? (
            <div className="error-message-display">
              <AlertCircle size={16} /> 
              <span>Error: {errorMessage}</span>
            </div>
           ) : responseText ? (
            <div className={`ai-response response-mode-${displayMode}`}>
              {formatResponse(responseText)}
            </div>
          ) : (
            <div className="empty-response-placeholder">
              <span>Waiting for input...</span>
            </div>
          )}
        </div>
         {/* Status text can be integrated or removed if node border indicates state */}
         {/* <div className="node-status-indicator">...</div> */}
      </div>

      {/* Output handle might not be needed if this is a terminal node, 
          but keep for potential chaining */}
      <Handle type="source" position={Position.Bottom} id="b" isConnectable={isConnectable} className="node-handle source-handle" />
    </div>
  );
};

export default AIOutputNode; 