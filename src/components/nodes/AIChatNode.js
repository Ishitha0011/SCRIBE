/* eslint-disable */

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
  const [lastOutput, setLastOutput] = useState(null); // Store last generated output
  const [lastInputData, setLastInputData] = useState(null); // Store incoming data
  const [hasIncomingData, setHasIncomingData] = useState(false); // Flag to show if we have data from previous node
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
        userPrompt, // Ensure userPrompt is always part of the saved data
        lastOutput, // Track the last output for this node
        lastInputData // Track the last input data that came into this node
      });
    }
  }, [systemPrompt, userPrompt, lastOutput, lastInputData, data]);
  
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

  // Helper to create a composite prompt using incoming data
  const createEnhancedPrompt = (basePrompt, inputData) => {
    console.log('Creating enhanced prompt with:', { basePrompt, inputData });
    
    // First, ensure we have valid input
    if (!basePrompt && !inputData) {
      console.warn('No base prompt or input data available');
      return "";
    }
    if (!inputData) {
      console.log('No input data, using base prompt only');
      return basePrompt;
    }
    
    // Initialize the enhanced prompt with the user's base prompt
    let enhancedPrompt = basePrompt || "";
    
    // Extract the most relevant content from inputData
    let context = "";
    
    // If inputData has video analysis data
    if (inputData.analysis) {
      console.log('Processing video analysis data');
      context += `VIDEO ANALYSIS:\n${inputData.analysis}\n\n`;
      if (inputData.title) {
        context += `Video Title: ${inputData.title}\n`;
      }
      if (inputData.url) {
        context += `Video URL: ${inputData.url}\n\n`;
      }
    }
    // If inputData has web scraping data
    else if (inputData.title || inputData.text || inputData.main_content) {
      console.log('Processing web scraping data');
      context += `WEBPAGE CONTENT:\n`;
      if (inputData.title) {
        context += `Title: ${inputData.title}\n`;
      }
      if (inputData.description) {
        context += `Description: ${inputData.description}\n`;
      }
      if (inputData.main_content) {
        context += `Main Content:\n${inputData.main_content}\n\n`;
      } else if (inputData.text) {
        context += `Content:\n${inputData.text}\n\n`;
      }
      if (inputData.url) {
        context += `Source URL: ${inputData.url}\n\n`;
      }
    }
    // If inputData has PDF text, format it appropriately
    else if (inputData.text) {
      console.log('Processing PDF data');
      context += `PDF CONTENT:\n${inputData.text}\n\n`;
      if (inputData.filename) {
        context += `This content is from file: ${inputData.filename}\n\n`;
      }
    } 
    // If inputData has AI-generated response, format it as context
    else if (inputData.response) {
      console.log('Processing previous AI output');
      context += `PREVIOUS AI OUTPUT:\n${inputData.response}\n\n`;
    }
    // Fallback if other data types are received
    else if (typeof inputData === 'object') {
      console.log('Processing generic object data');
      // Try to create a readable context from whatever data is available
      const safeStringify = (obj) => {
        try {
          // Get all non-null values as a formatted string
          return Object.entries(obj)
            .filter(([key, value]) => value !== null && value !== undefined && key !== 'error')
            .map(([key, value]) => {
              if (typeof value === 'object') {
                return `${key}: (complex data)`;
              }
              return `${key}: ${value}`;
            })
            .join('\n');
        } catch (e) {
          return "Unparseable data";
        }
      };
      
      context += `CONTEXT DATA:\n${safeStringify(inputData)}\n\n`;
    }
    
    // Combine context with user prompt if there's any user input
    let finalPrompt;
    if (enhancedPrompt && context) {
      finalPrompt = `${context}Please answer the following question or complete the following task based on the above context:\n\n${enhancedPrompt}`;
    } 
    // If there's only context but no user input, make a generic prompt
    else if (context && !enhancedPrompt) {
      finalPrompt = `${context}Please analyze the above information and provide insights or a summary.`;
    }
    // Fallback to just the user's prompt if we have nothing else
    else {
      finalPrompt = enhancedPrompt;
    }
    
    console.log('Final enhanced prompt:', finalPrompt);
    return finalPrompt;
  };

  // Main processing function called by the flow
  const generateAIResponse = async (inputData) => {
    console.log('AIChatNode received input data:', inputData);
    
    // Set incoming data flag and store input
    setHasIncomingData(!!inputData && Object.keys(inputData).length > 0);
    setLastInputData(inputData || null);
    
    // Create an enhanced prompt that incorporates incoming data if available
    const enhancedPrompt = createEnhancedPrompt(userPrompt, inputData);
    
    // Fall back to user prompt if enhancedPrompt is empty
    const currentPrompt = enhancedPrompt || userPrompt;

    // Input validation
    if (!currentPrompt || !currentPrompt.trim()) {
      console.warn(`AI Chat Node (${nodeIdRef.current}): No usable prompt available.`);
      setNodeState('error');
      setIsGenerating(false);
      return { 
        error: "No usable prompt available.",
        originalData: inputData // Pass through original data
      }; 
    }
    
    setIsGenerating(true);
    setNodeState('processing');
    
    try {
      // Log the request for debugging
      console.log('Sending request to AI API:', {
        systemPrompt,
        currentPrompt,
        hasInputData: !!inputData
      });

      const response = await fetch('http://localhost:8000/api/ai-chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          system_prompt: systemPrompt,
          user_prompt: currentPrompt
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Unknown API error' }));
        console.error('API error response:', errorData);
        throw new Error(`API error ${response.status}: ${errorData.detail || response.statusText}`);
      }

      const responseData = await response.json();
      console.log('Received response from AI API:', responseData);
      
      const aiResponse = responseData.response;

      if (!aiResponse) {
        console.error('Empty response from AI API');
        throw new Error("Received empty response from API");
      }
      
      setIsGenerating(false);
      setNodeState('complete');
      
      // Store the last output
      const output = { 
        response: aiResponse,
        generatedFrom: { 
          userPrompt: userPrompt,
          systemPrompt: systemPrompt,
          inputData: inputData // Reference to incoming data that informed this response
        }
      };
      
      setLastOutput(output);
      
      // Log the output for debugging
      console.log('AI Chat Node final output:', output);
      
      // Output the response in JSON format for the next node
      return output; 

    } catch (error) {
      console.error(`AI Chat Node (${nodeIdRef.current}) Error:`, error);
      setIsGenerating(false);
      setNodeState('error');
      // Output an error object, but also pass through original data
      return { 
        error: error.message || 'Failed to generate response',
        originalData: inputData // Pass through original data
      }; 
    }
  };
  
  // Register node for flow execution
  useEffect(() => {
    if (data.registerNodeForFlow && nodeIdRef.current) {
      const unregister = data.registerNodeForFlow(nodeIdRef.current, async (inputData) => {
        console.log(`AI Processor Node ${nodeIdRef.current} triggered with input:`, inputData);
        return await generateAIResponse(inputData);
      });
      
      return unregister; // Cleanup registration
    }
    // Reregister if the core function or ID changes
  }, [data.registerNodeForFlow, systemPrompt, userPrompt]); // Depend on userPrompt now

  return (
    // Add theme class alongside other classes
    <div className={`ai-chat-node node-container state-${nodeState} ${theme} ${data.isInExecutionPath ? 'in-path' : ''}`}>
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

        {/* User Prompt Input Section */}
        <div className="user-prompt-section">
          <label className="user-prompt-label">
            User Prompt
            {hasIncomingData && lastInputData && (
              <span className="input-data-indicator">
                (Using data from previous node)
              </span>
            )} 
          </label>
          <textarea 
            value={userPrompt} 
            onChange={handleUserPromptChange} 
            className="user-prompt-input node-textarea" 
            rows={4}
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