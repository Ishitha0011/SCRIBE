import React, { useState, useEffect } from 'react';
import { Handle, Position } from 'reactflow';
import '../../css/Nodes.css';
import { Bot, Copy, Download, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';

const AIOutputNode = ({ data, isConnectable }) => {
  const [copied, setCopied] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [nodeState, setNodeState] = useState('idle'); // idle, processing, complete, error
  
  // Update data when response changes
  useEffect(() => {
    if (data.onChange) {
      data.onChange({ response: data.response });
    }
  }, [data.response, data]);
  
  // Update state based on flow execution
  useEffect(() => {
    if (data.isExecuting) {
      setNodeState('processing');
      setIsProcessing(true);
    } else if (data.executionComplete) {
      setNodeState('complete');
      setIsProcessing(false);
    } else if (data.executionError) {
      setNodeState('error');
      setIsProcessing(false);
    } else if (!data.isInExecutionPath) {
      setNodeState('idle');
      setIsProcessing(false);
    }
  }, [data.isExecuting, data.executionComplete, data.executionError, data.isInExecutionPath]);
  
  const handleCopy = () => {
    navigator.clipboard.writeText(data.response || '');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  
  const handleDownload = () => {
    if (!data.response) return;
    
    const blob = new Blob([data.response], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ai-response.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
  
  // Handle flow execution when this node is triggered
  useEffect(() => {
    if (data.registerNodeForFlow) {
      // Register this node for flow execution
      data.registerNodeForFlow(data.id, async (inputData) => {
        setIsProcessing(true);
        setNodeState('processing');
        
        try {
          // If we receive a response from a previous node, update our data
          if (inputData?.response) {
            // Small delay to visualize the flow
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Update our response
            if (data.onChange) {
              data.onChange({ response: inputData.response });
            }
            
            setNodeState('complete');
          }
        } catch (error) {
          console.error('Error processing response:', error);
          setNodeState('error');
        } finally {
          setIsProcessing(false);
        }
        
        // Pass through any data for downstream nodes
        return inputData;
      });
    }
  }, [data]);

  return (
    <div className={`ai-output-node node-container ${data.isInExecutionPath ? 'in-path' : ''} ${nodeState}`}>
      <Handle
        type="target"
        position={Position.Top}
        isConnectable={isConnectable}
        style={{ background: '#7952b3' }}
      />
      <div className="node-header">
        <Bot size={16} />
        <div className="node-title">AI Response</div>
      </div>
      <div className="node-content">
        <div className={`ai-response-container ${nodeState === 'processing' ? 'processing' : ''}`}>
          {nodeState === 'processing' && !data.response ? (
            <div className="processing-placeholder">
              <RefreshCw size={18} className="spinning" />
              <span>Processing response...</span>
            </div>
          ) : data.response ? (
            <div className="ai-response">
              {data.response}
            </div>
          ) : (
            <div className="empty-response">
              {nodeState === 'error' ? (
                <>
                  <AlertCircle size={24} />
                  <p>Error receiving response</p>
                </>
              ) : (
                <>
                  No response yet. Connect to an AI Chat node to generate a response.
                </>
              )}
            </div>
          )}
        </div>
        <div className="node-actions">
          <button 
            className="node-action-btn" 
            onClick={handleCopy}
            disabled={!data.response || isProcessing}
            title={copied ? "Copied!" : "Copy response"}
          >
            {copied ? <CheckCircle size={14} /> : <Copy size={14} />}
          </button>
          <button 
            className="node-action-btn" 
            onClick={handleDownload}
            disabled={!data.response || isProcessing}
            title="Download response"
          >
            <Download size={14} />
          </button>
        </div>
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        isConnectable={isConnectable}
        style={{ background: '#7952b3' }}
      />
    </div>
  );
};

export default AIOutputNode; 