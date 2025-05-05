import React, { useState, useEffect, useRef } from 'react';
import { Handle, Position } from 'reactflow';
import '../../css/Nodes.css';
import { MessageSquare, CheckCircle, AlertCircle, Edit2, RefreshCw as ProcessingIcon } from 'lucide-react';
import { useTheme } from '../../ThemeContext'; // Import useTheme hook

const AIChatNode = ({ data, isConnectable, id }) => {
  const { theme } = useTheme(); // Access the current theme
  const [systemPrompt, setSystemPrompt] = useState(data.systemPrompt || 'You are a helpful AI assistant.');
  const [userPrompt, setUserPrompt] = useState(data.userPrompt || '');
  const [isEditingSystem, setIsEditingSystem] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [nodeState, setNodeState] = useState('idle'); // idle, processing, complete, error
  const systemPromptRef = useRef(null);
  const nodeIdRef = useRef(id);
  
  // Ensure we track the node ID
  useEffect(() => {
    nodeIdRef.current = id;
  }, [id]);
  
  // Update node data when internal state changes
  useEffect(() => {
    if (data.onChange) {
      data.onChange({ 
        systemPrompt, 
        userPrompt // Ensure userPrompt is always part of the saved data
      });
    }
  }, [systemPrompt, userPrompt, data]);
  
  // Focus system prompt input when editing
  useEffect(() => {
    if (isEditingSystem && systemPromptRef.current) {
      systemPromptRef.current.focus();
      systemPromptRef.current.select(); 
    }
  }, [isEditingSystem]);

  // Update node state based on flow execution props
  useEffect(() => {
    let timer;
    if (data.isExecuting) {
      setNodeState('processing');
      setIsGenerating(true);
    } else if (data.executionComplete) {
      setNodeState('complete');
      setIsGenerating(false);
      timer = setTimeout(() => setNodeState('idle'), 2000);
    } else if (data.executionError) {
      setNodeState('error');
      setIsGenerating(false);
      timer = setTimeout(() => setNodeState('idle'), 3000);
    } else if (!data.isInExecutionPath) {
      setNodeState('idle');
      setIsGenerating(false);
    }
    return () => clearTimeout(timer); // Cleanup timer
  }, [data.isExecuting, data.executionComplete, data.executionError, data.isInExecutionPath]);
  
  const handleSystemPromptChange = (e) => {
    setSystemPrompt(e.target.value);
  };
  
  // Handler for the node's own prompt input
  const handleUserPromptChange = (e) => {
    setUserPrompt(e.target.value);
  };
  
  const toggleSystemPromptEdit = () => {
    setIsEditingSystem(!isEditingSystem);
  };

  const handleSystemPromptBlur = () => {
    setIsEditingSystem(false);
  };

  // Main processing function called by the flow
  const generateAIResponse = async () => { // No longer takes inputPrompt argument here
    // Use the component's userPrompt state
    const currentPrompt = userPrompt;

    // Input validation
    if (!currentPrompt || !currentPrompt.trim()) {
      console.warn(`AI Chat Node (${nodeIdRef.current}): User prompt is empty.`);
      setNodeState('error');
      setIsGenerating(false);
      return { error: "User prompt is empty." }; 
    }
    
    setIsGenerating(true);
    setNodeState('processing');
    
    try {
      const response = await fetch('http://localhost:8000/api/ai-chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          system_prompt: systemPrompt,
          user_prompt: currentPrompt // Use the node's internal prompt
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Unknown API error' }));
        throw new Error(`API error ${response.status}: ${errorData.detail || response.statusText}`);
      }

      const responseData = await response.json();
      const aiResponse = responseData.response;

      if (!aiResponse) {
        throw new Error("Received empty response from API");
      }
      
      setIsGenerating(false);
      setNodeState('complete');
      
      // Output the response in JSON format for the next node
      return { response: aiResponse }; 

    } catch (error) {
      console.error(`AI Chat Node (${nodeIdRef.current}) Error:`, error);
      setIsGenerating(false);
      setNodeState('error');
      // Output an error object
      return { error: error.message || 'Failed to generate response' }; 
    }
  };
  
  // Register node for flow execution
  useEffect(() => {
    if (data.registerNodeForFlow && nodeIdRef.current) {
      const unregister = data.registerNodeForFlow(nodeIdRef.current, async (inputData) => {
        // Ignore inputData for prompt source, always use the node's own prompt
        // inputData is only used to trigger the execution
        console.log(`AI Processor Node ${nodeIdRef.current} triggered. Using internal prompt.`);
        return await generateAIResponse(); // Call with no arguments
      });
      
      return unregister; // Cleanup registration
    }
    // Reregister if the core function or ID changes
  }, [data.registerNodeForFlow, systemPrompt, userPrompt]); // Depend on userPrompt now

  return (
    // Add theme class alongside other classes
    <div className={`ai-chat-node node-container state-${nodeState} ${theme}`}>
      <Handle type="target" position={Position.Top} id="a" isConnectable={isConnectable} className="node-handle target-handle" />
      
      <div className="node-header ai-chat-header">
        <div className="node-header-title">
          <MessageSquare size={15} className="node-title-icon" />
          <span>AI Processor</span>
        </div>
        {/* No actions needed in header for intermediary node */}
      </div>

      <div className="node-content ai-chat-content">
        {/* System Prompt Section - Still useful for configuration */}
        <div className="system-prompt-section">
          <label className="system-prompt-label">
            System Prompt
            <button 
              className={`system-prompt-edit-btn ${isEditingSystem ? 'editing' : ''}`}
              onClick={toggleSystemPromptEdit}
              title={isEditingSystem ? "Finish Editing" : "Edit System Prompt"}
            >
              <Edit2 size={13} />
            </button>
          </label>
          {isEditingSystem ? (
            <textarea
              ref={systemPromptRef}
              value={systemPrompt}
              onChange={handleSystemPromptChange}
              onBlur={handleSystemPromptBlur}
              placeholder="Define AI behavior..."
              className="system-prompt-input node-textarea"
              rows={3}
            />
          ) : (
            <div 
              className="system-prompt-display node-text-display"
              onClick={toggleSystemPromptEdit}
              title="Click to edit system prompt"
            >
              {systemPrompt || "(Default prompt)"}
            </div>
          )}
        </div>

        {/* User Prompt Input Section - Added Back */}
        <div className="user-prompt-section">
          <label className="user-prompt-label">User Prompt</label>
          <textarea 
            value={userPrompt} 
            onChange={handleUserPromptChange} 
            className="user-prompt-input node-textarea" 
            rows={4} // Give it a bit more space 
            placeholder="Enter the prompt for the AI..."
            disabled={isGenerating} />
        </div> 

        {/* Status Indicator */} 
        <div className="node-status-indicator">
           {nodeState === 'processing' ? <ProcessingIcon size={14} className="spinning" /> : 
            nodeState === 'complete' ? <CheckCircle size={14} /> : 
            nodeState === 'error' ? <AlertCircle size={14} /> : 
            null} 
          <span className={`status-text status-${nodeState}`}>
            {nodeState === 'processing' ? 'Processing...' :
             nodeState === 'complete' ? 'Complete' :
             nodeState === 'error' ? 'Error' :
             'Ready'}
           </span>
        </div>
      </div>

      <Handle type="source" position={Position.Bottom} id="b" isConnectable={isConnectable} className="node-handle source-handle" />
    </div>
  );
};

export default AIChatNode;