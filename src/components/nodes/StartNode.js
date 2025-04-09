import React, { useState, useEffect } from 'react';
import { Handle, Position } from 'reactflow';
import '../../css/Nodes.css';
import { Play, Loader, CheckCircle, AlertCircle } from 'lucide-react';

const StartNode = ({ data, isConnectable }) => {
  const [isRunning, setIsRunning] = useState(false);
  const [runState, setRunState] = useState('idle'); // 'idle', 'running', 'complete', 'error'
  
  // Update run state based on execution status
  useEffect(() => {
    if (data.isExecuting) {
      setRunState('running');
      setIsRunning(true);
    } else if (data.executionComplete) {
      setRunState('complete');
      setIsRunning(false);
    } else if (data.executionError) {
      setRunState('error');
      setIsRunning(false);
    }
  }, [data.isExecuting, data.executionComplete, data.executionError]);
  
  // Reset state after a while
  useEffect(() => {
    if (runState === 'complete' || runState === 'error') {
      const timer = setTimeout(() => {
        setRunState('idle');
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [runState]);
  
  const handleRun = async () => {
    if (isRunning) return;
    
    setIsRunning(true);
    setRunState('running');
    
    try {
      // Gather all connected nodes to get the execution flow
      if (data.onNodeRun) {
        await data.onNodeRun(data.id);
      }
    } catch (error) {
      console.error('Error running node flow:', error);
      setRunState('error');
      setIsRunning(false);
    }
  };
  
  return (
    <div className={`start-node node-container ${data.isInExecutionPath ? 'in-path' : ''} ${runState}`}>
      <div className="node-header">
        <div className="node-header-icon">
          {runState === 'running' ? (
            <Loader size={16} className="spinning" />
          ) : runState === 'complete' ? (
            <CheckCircle size={16} />
          ) : runState === 'error' ? (
            <AlertCircle size={16} />
          ) : (
            <Play size={16} />
          )}
        </div>
        <div className="node-title">Start</div>
      </div>
      <div className="node-content">
        <div className="start-instruction">
          Connect this node to begin the execution flow.
        </div>
        <button 
          className={`run-button ${runState}`}
          onClick={handleRun}
          disabled={isRunning || !data.hasConnections}
        >
          {runState === 'running' ? (
            <>
              <Loader size={14} className="spinning" />
              <span>Running...</span>
            </>
          ) : runState === 'complete' ? (
            <>
              <CheckCircle size={14} />
              <span>Completed</span>
            </>
          ) : runState === 'error' ? (
            <>
              <AlertCircle size={14} />
              <span>Error</span>
            </>
          ) : (
            <>
              <Play size={14} />
              <span>Run Flow</span>
            </>
          )}
        </button>
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        id="out"
        isConnectable={isConnectable}
        style={{ background: '#7952b3' }}
      />
    </div>
  );
};

export default StartNode; 