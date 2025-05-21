/* eslint-disable */

import React, { useState, useEffect, useRef } from 'react';
import { Handle, Position } from 'reactflow';
import '../../css/Nodes.css';
import { Bot, Copy, Download, CheckCircle, AlertCircle, RefreshCw as ProcessingIcon, Code, FileText, File } from 'lucide-react';
import { useTheme } from '../../ThemeContext'; // Import useTheme hook

const AIOutputNode = ({ data, isConnectable, id }) => {
  const { theme } = useTheme(); // Access the current theme
  const [copied, setCopied] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [nodeState, setNodeState] = useState('idle'); // idle, processing, complete, error
  const [displayMode, setDisplayMode] = useState('plain'); // 'plain', 'formatted', 'code'
  const [errorMessage, setErrorMessage] = useState(null);
  const [contentType, setContentType] = useState('text'); // 'text', 'pdf', 'image', etc.
  const [sourceInfo, setSourceInfo] = useState(null); // Information about where the data came from
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
        errorMessage,
        contentType,
        sourceInfo
      });
    }
  }, [responseText, displayMode, errorMessage, contentType, sourceInfo, data]);
  
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

  // Process incoming data and extract displayable content
  const processIncomingData = (inputData) => {
    // Reset states
    setErrorMessage(null);
    setSourceInfo(null);
    
    // Handle null or undefined input
    if (!inputData) {
      setErrorMessage("No data received");
      return null;
    }
    
    // Handle error objects from any node
    if (inputData.error) {
      setErrorMessage(inputData.error);
      
      // If we have original data despite error, try to display it
      if (inputData.originalData) {
        return processIncomingData(inputData.originalData);
      }
      return null;
    }
    
    // Handle PDF text extraction data
    if (inputData.text && inputData.filename) {
      setContentType('pdf');
      setSourceInfo({
        type: 'PDF',
        filename: inputData.filename,
        filesize: inputData.filesize
      });
      return inputData.text;
    }
    
    // Handle AI chat response data
    if (inputData.response) {
      setContentType('ai');
      // If we have metadata about what generated this response
      if (inputData.generatedFrom) {
        setSourceInfo({
          type: 'AI',
          prompt: inputData.generatedFrom.userPrompt,
          system: inputData.generatedFrom.systemPrompt
        });
      }
      return inputData.response;
    }
    
    // Generic object handling - try to extract meaningful text
    if (typeof inputData === 'object') {
      // Look for any text/content properties
      const possibleContentProps = ['content', 'message', 'text', 'data', 'output', 'result'];
      for (const prop of possibleContentProps) {
        if (inputData[prop] && typeof inputData[prop] === 'string') {
          setContentType('generic');
          return inputData[prop];
        }
      }
      
      // If no recognizable fields, convert the object to a readable string
      try {
        setContentType('json');
        return JSON.stringify(inputData, null, 2);
      } catch (e) {
        setErrorMessage("Could not parse data");
        return null;
      }
    }
    
    // If it's just a string, display it directly
    if (typeof inputData === 'string') {
      setContentType('text');
      return inputData;
    }
    
    // Fallback: unknown data format
    setErrorMessage("Unsupported data format");
    return null;
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

  // Display source information if available
  const renderSourceInfo = () => {
    if (!sourceInfo) return null;
    
    return (
      <div className="source-info">
        {sourceInfo.type === 'PDF' && (
          <div className="pdf-source">
            <File size={12} />
            <span>Source: {sourceInfo.filename}</span>
          </div>
        )}
        {sourceInfo.type === 'AI' && (
          <div className="ai-source">
            <Bot size={12} />
            <span>AI-generated response</span>
          </div>
        )}
      </div>
    );
  };
  
  // Handle flow execution: Extract response/error from inputData
  useEffect(() => {
    if (data.registerNodeForFlow && nodeIdRef.current) {
      const unregister = data.registerNodeForFlow(nodeIdRef.current, async (inputData) => {
        setIsProcessing(true);
        setNodeState('processing');
        
        // Process the input data to extract displayable content
        const processedText = processIncomingData(inputData);
        
        // Small delay to show processing state
        await new Promise(resolve => setTimeout(resolve, 200)); 
        
        if (processedText !== null) {
          setResponseText(processedText);
          setNodeState('complete');
        } else if (!errorMessage) {
          // Only set a generic error if no specific error was set during processing
          setErrorMessage('Could not display the incoming data');
          setNodeState('error');
        }
        
        setIsProcessing(false);
        
        // Pass data through (could be modified if this node transforms data)
        return inputData;
      });
      
      return unregister;
    }
  }, [data.registerNodeForFlow]); // Re-register only if register function changes

  // Icon to show based on content type
  const getContentTypeIcon = () => {
    switch(contentType) {
      case 'pdf': return <FileText size={15} />;
      case 'ai': return <Bot size={15} />;
      case 'json': return <Code size={15} />;
      default: return <Bot size={15} />;
    }
  };

  return (
    // Add theme class to the root container
    <div className={`ai-output-node node-container state-${nodeState} ${theme} ${data.isInExecutionPath ? 'in-path' : ''}`}>
      <Handle type="target" position={Position.Top} id="a" isConnectable={isConnectable} className="node-handle target-handle" />
      
      <div className="node-header ai-output-header">
        <div className="node-header-title">
           {getContentTypeIcon()}
           <span>Output</span>
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
        {/* Source information */}
        {renderSourceInfo()}
        
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
      </div>

      {/* Output handle for potential chaining */}
      <Handle type="source" position={Position.Bottom} id="b" isConnectable={isConnectable} className="node-handle source-handle" />
    </div>
  );
};

export default AIOutputNode; 