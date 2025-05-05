import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Handle, Position } from 'reactflow';
import '../../css/Nodes.css';
import { Play, Loader, CheckCircle, AlertCircle, ArrowRight } from 'lucide-react';

const StartNode = ({ data, isConnectable, id }) => {
  const [isRunning, setIsRunning] = useState(false);
  const [runState, setRunState] = useState('idle'); // 'idle', 'running', 'complete', 'error'
  const [workflowName, setWorkflowName] = useState(data.workflowName || 'My Workflow');
  const [isEditingName, setIsEditingName] = useState(false);
  
  // Instead of using state for these values that trigger re-renders,
  // we'll use refs to track them internally without causing re-renders
  const prevConnectionStateRef = useRef({
    hasConnections: false,
    connectionCount: 0
  });
  
  // Track if we've already updated onChange to prevent loops
  const hasUpdatedRef = useRef(false);
  
  // Make sure we always have the current node ID
  useEffect(() => {
    // Log the StartNode ID for debugging
    console.log(`StartNode mounted with ID: ${id}`);
  }, [id]);
  
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
  
  // Update workflow name when data changes
  useEffect(() => {
    if (data.workflowName && data.workflowName !== workflowName) {
      setWorkflowName(data.workflowName);
    }
  }, [data.workflowName]);
  
  // Update name in parent when it changes
  useEffect(() => {
    if (data.onChange && !hasUpdatedRef.current) {
      hasUpdatedRef.current = true;
      data.onChange({ 
        workflowName
      });
      setTimeout(() => {
        hasUpdatedRef.current = false;
      }, 50);
    }
  }, [workflowName, data.onChange]);
  
  // Reset state after a while
  useEffect(() => {
    if (runState === 'complete' || runState === 'error') {
      const timer = setTimeout(() => {
        setRunState('idle');
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [runState]);
  
  const handleNameChange = (e) => {
    setWorkflowName(e.target.value);
  };
  
  const toggleNameEdit = () => {
    setIsEditingName(!isEditingName);
  };
  
  const handleRun = async () => {
    if (isRunning || !data.hasConnections) return;
    
    setIsRunning(true);
    setRunState('running');
    
    try {
      // Gather all connected nodes to get the execution flow
      if (data.onNodeRun) {
        // Make sure we use the current node ID
        if (!id) {
          console.error('StartNode: Cannot run flow - missing node ID');
          setRunState('error');
          setIsRunning(false);
          return;
        }
        
        console.log('Starting workflow execution from node:', id);
        await data.onNodeRun(id);
        console.log('Workflow execution completed successfully');
        setRunState('complete');
      }
    } catch (error) {
      console.error('Error running node flow:', error);
      setRunState('error');
    } finally {
      setIsRunning(false);
    }
  };
  
  // Get current connection state directly from props
  const connectionState = data.hasConnections || false;
  const countState = data.connectionCount || 0;
  
  // Check if connection state has changed (for logging only)
  if (prevConnectionStateRef.current.hasConnections !== connectionState || 
      prevConnectionStateRef.current.connectionCount !== countState) {
    // Update our ref to prevent future logs
    prevConnectionStateRef.current = {
      hasConnections: connectionState,
      connectionCount: countState
    };
  }
  
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
        <div className="node-title">
          {isEditingName ? (
            <input
              type="text"
              value={workflowName}
              onChange={handleNameChange}
              onBlur={toggleNameEdit}
              className="workflow-name-input"
              autoFocus
            />
          ) : (
            <div 
              className="workflow-name"
              onClick={toggleNameEdit}
              title="Click to edit workflow name"
            >
              {workflowName}
            </div>
          )}
        </div>
      </div>
      <div className="node-content">
        <div className="workflow-info">
          <div className="connection-status">
            {connectionState ? (
              <div className="has-connections">
                <ArrowRight size={14} /> Connected to {countState || 'next'} node{countState > 1 ? 's' : ''}
              </div>
            ) : (
              <div className="no-connections">
                <AlertCircle size={14} /> No connections
              </div>
            )}
          </div>
        </div>
        <div className="start-instruction">
          {connectionState ? 
            'Click Run to start the workflow.' : 
            'Connect this node to other nodes to create a workflow.'}
        </div>
        <button 
          className={`run-button ${runState}`}
          onClick={handleRun}
          disabled={isRunning || !connectionState}
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