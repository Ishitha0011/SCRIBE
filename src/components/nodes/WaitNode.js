import React, { useState, useEffect, useRef } from 'react';
import { Handle, Position } from 'reactflow';
import { Clock, CheckCircle, AlertCircle, RefreshCw, ArrowRight } from 'lucide-react';
import { useTheme } from '../../ThemeContext';

const WaitNode = ({ data, isConnectable, id }) => {
  const { theme } = useTheme();
  const [inputSources, setInputSources] = useState({});
  const [nodeState, setNodeState] = useState('waiting'); // waiting, complete, error
  const [outputData, setOutputData] = useState(null);
  const [isReady, setIsReady] = useState(false);
  const nodeIdRef = useRef(id);
  const connectedEdgesRef = useRef([]);

  // Ensure we track the node ID
  useEffect(() => {
    nodeIdRef.current = id;
  }, [id]);

  // Effect to handle flow execution states
  useEffect(() => {
    let timer;
    if (data.isExecuting) {
      setNodeState('processing');
    } else if (data.executionComplete) {
      setNodeState('complete');
      timer = setTimeout(() => setNodeState('waiting'), 3000);
    } else if (data.executionError) {
      setNodeState('error');
      timer = setTimeout(() => setNodeState('waiting'), 3000);
    }
    return () => clearTimeout(timer);
  }, [data.isExecuting, data.executionComplete, data.executionError]);

  // Register this node for the flow execution
  useEffect(() => {
    if (data.registerNodeForFlow && nodeIdRef.current) {
      console.log(`Registering Wait Node ${nodeIdRef.current} for flow execution`);
      
      const unregister = data.registerNodeForFlow(nodeIdRef.current, async (inputData) => {
        console.log(`Wait Node ${nodeIdRef.current} received input:`, inputData);
        
        // Force immediate check of connected edges to ensure we're tracking all connections
        if (data.getConnectedEdges) {
          const edges = data.getConnectedEdges(id);
          const incomingEdges = edges.filter(edge => edge.target === id);
          const connectedSources = incomingEdges.map(edge => edge.source);
          
          // Initialize any new connections as waiting
          connectedSources.forEach(sourceId => {
            if (!inputSources[sourceId]) {
              setInputSources(prev => ({
                ...prev,
                [sourceId]: {
                  status: 'waiting',
                  receivedAt: null,
                  data: null
                }
              }));
            }
          });
        }
        
        let sourceId = null;
        // Extract sourceNodeId from the input data
        if (inputData && inputData.sourceNodeId) {
          sourceId = inputData.sourceNodeId;
        } 
        // Try to identify source from node type in the data
        else if (inputData && (inputData.nodeType || inputData.type || inputData.contentType)) {
          // Try to find a matching source node already connected
          const sourceType = inputData.nodeType || inputData.type || inputData.contentType;
          sourceId = `anonymous-${sourceType}-${Date.now()}`;
        }
        // Default anonymous ID if no other identification possible
        else {
          sourceId = `anonymous-${Object.keys(inputSources).length + 1}-${Date.now()}`;
        }
        
        // Store this input with its source ID
        console.log(`Wait Node: storing input from source ${sourceId}`);
        setInputSources(prev => ({
          ...prev,
          [sourceId]: {
            data: inputData,
            receivedAt: new Date().toISOString(),
            status: 'received'
          }
        }));
        
        // After storing input, check if all inputs are received
        // Use a longer delay to ensure state is fully updated
        const allInputsReceived = await new Promise(resolve => {
          setTimeout(() => {
            const result = checkAllInputsReceived();
            console.log(`Wait Node: all inputs received check result: ${result}`);
            resolve(result);
          }, 200);
        });
        
        // If all inputs are received, return the combined data
        if (allInputsReceived) {
          console.log(`Wait Node ${nodeIdRef.current} - All inputs received, outputting combined data:`, outputData);
          
          // Create a flattened, AI-friendly format of the data
          const aiReadyData = {
            youtube: null,
            webScraper: null,
            document: null,
            combined: outputData ? outputData.combinedData : null
          };
          
          // Extract and organize data from different sources
          Object.entries(inputSources).forEach(([sourceId, source]) => {
            if (!source || !source.data) return;
            const data = source.data;
            
            // Check if this is YouTube data
            if (sourceId.includes('youtube') || 
                (data && (data.videoId || data.analysis || (data.title && data.url && data.url.includes('youtube'))))) {
              aiReadyData.youtube = {
                title: data.title,
                url: data.url,
                videoId: data.videoId,
                analysis: data.analysis || data.videoAnalysis
              };
            }
            
            // Check if this is web scraper data
            if (sourceId.includes('scraper') || 
                (data && (data.scrapedContent || (data.title && data.main_content) || (data.title && data.url)))) {
              aiReadyData.webScraper = {
                title: data.title,
                url: data.url,
                content: data.main_content || data.text || (data.scrapedContent ? data.scrapedContent.main_content : null),
                description: data.description || (data.scrapedContent ? data.scrapedContent.description : null)
              };
            }
            
            // Check if this is PDF/document data
            if (sourceId.includes('pdf') || (data && (data.type === 'document' || data.contentType === 'pdf' || data.nodeType === 'pdfNode'))) {
              aiReadyData.document = {
                text: data.text,
                filename: data.filename,
                filesize: data.filesize,
                contentType: data.contentType || 'pdf'
              };
            }
            
            // For other data types, store in their own category
            if (data && !sourceId.includes('youtube') && !sourceId.includes('scraper') && !sourceId.includes('pdf')) {
              aiReadyData[sourceId] = data;
            }
          });
          
          // Return a combined object that's easy for downstream nodes to consume
          return {
            ...aiReadyData,
            timestamp: new Date().toISOString(),
            sources: Object.keys(inputSources).length,
            message: "Combined data from multiple sources"
          };
        }
        
        // If not all inputs are received yet, return a waiting message
        return { 
          status: 'waiting',
          message: 'Waiting for all inputs to be ready',
          currentSources: Object.keys(inputSources).length
        };
      });
      
      return unregister;
    }
  }, [data.registerNodeForFlow, id, outputData, inputSources]);

  // Update data when inputSources or outputData changes
  useEffect(() => {
    if (data.onChange) {
      data.onChange({
        inputSources,
        outputData,
        isReady,
        nodeState
      });
    }
  }, [inputSources, outputData, isReady, nodeState, data]);

  // Subscribe to edge changes to track connections
  useEffect(() => {
    if (data.getConnectedEdges) {
      const checkEdges = () => {
        const edges = data.getConnectedEdges(id);
        connectedEdgesRef.current = edges;
        
        // Extract the source nodes that are connected to this wait node
        const incomingEdges = edges.filter(edge => edge.target === id);
        const connectedSources = incomingEdges.map(edge => edge.source);
        
        console.log(`WaitNode: Detected ${connectedSources.length} incoming connections:`, connectedSources);
        
        // Initialize input sources for newly connected nodes
        const newSources = {};
        connectedSources.forEach(sourceId => {
          if (!inputSources[sourceId]) {
            newSources[sourceId] = {
              status: 'waiting',
              receivedAt: null,
              data: null
            };
          }
        });
        
        // Only update if there are new sources
        if (Object.keys(newSources).length > 0) {
          console.log('WaitNode: Adding new sources:', Object.keys(newSources));
          setInputSources(prev => ({
            ...prev,
            ...newSources
          }));
        }
        
        // Clean up sources that are no longer connected
        const sourcesToRemove = Object.keys(inputSources).filter(
          sourceId => !connectedSources.includes(sourceId) && !sourceId.startsWith('anonymous')
        );
        
        if (sourcesToRemove.length > 0) {
          console.log('WaitNode: Removing disconnected sources:', sourcesToRemove);
          setInputSources(prev => {
            const updated = { ...prev };
            sourcesToRemove.forEach(id => delete updated[id]);
            return updated;
          });
        }
      };
      
      // Check edges immediately when component mounts/updates
      checkEdges();
      
      // Then set up interval to poll for changes
      const interval = setInterval(checkEdges, 1000);
      
      return () => clearInterval(interval);
    }
  }, [data.getConnectedEdges, id, inputSources]);

  // Check if all inputs have been received and prepare the output data
  const checkAllInputsReceived = () => {
    const connectedSourceIds = Object.keys(inputSources);
    
    if (connectedSourceIds.length === 0) {
      console.log('WaitNode: No input sources available yet');
      return false;
    }
    
    // Log state for debugging
    console.log('WaitNode: Checking input sources:', inputSources);
    
    const allReceived = connectedSourceIds.every(
      sourceId => inputSources[sourceId].status === 'received'
    );
    
    console.log(`WaitNode: ${allReceived ? 'All' : 'Not all'} inputs received. ${
      connectedSourceIds.filter(id => inputSources[id].status === 'received').length
    } of ${connectedSourceIds.length} inputs received.`);
    
    if (allReceived) {
      // Combine all input data
      const combinedData = {};
      
      // Extract and organize the actual data, not just the container objects
      connectedSourceIds.forEach(sourceId => {
        const sourceObj = inputSources[sourceId];
        const sourceData = sourceObj.data;
        
        // Store the raw data directly
        combinedData[sourceId] = sourceData;
        
        // Also try to extract specific data types for easier access
        if (sourceId.includes('youtube') || (sourceData && sourceData.videoId)) {
          combinedData.youtubeData = {
            title: sourceData.title,
            url: sourceData.url,
            videoId: sourceData.videoId,
            analysis: sourceData.analysis || sourceData.videoAnalysis
          };
        }
        
        if (sourceId.includes('scraper') || (sourceData && sourceData.scrapedContent)) {
          combinedData.webData = {
            title: sourceData.title || (sourceData.scrapedContent ? sourceData.scrapedContent.title : null),
            url: sourceData.url || (sourceData.scrapedContent ? sourceData.scrapedContent.url : null),
            content: sourceData.main_content || sourceData.text || 
                    (sourceData.scrapedContent ? sourceData.scrapedContent.main_content : null),
            description: sourceData.description || 
                        (sourceData.scrapedContent ? sourceData.scrapedContent.description : null)
          };
        }
        
        // Extract PDF/document data
        if (sourceId.includes('pdf') || (sourceData && (sourceData.type === 'document' || sourceData.contentType === 'pdf'))) {
          combinedData.documentData = {
            text: sourceData.text,
            filename: sourceData.filename,
            filesize: sourceData.filesize,
            type: 'document'
          };
        }
      });
      
      // If we have exactly two input sources, create specific format
      if (connectedSourceIds.length === 2) {
        const [source1, source2] = connectedSourceIds;
        
        // Check if one is YouTube and one is web scraper
        const hasYouTube = 
          (source1.includes('youtube') || (inputSources[source1].data && inputSources[source1].data.videoId)) || 
          (source2.includes('youtube') || (inputSources[source2].data && inputSources[source2].data.videoId));
        
        const hasScraper = 
          (source1.includes('scraper') || (inputSources[source1].data && inputSources[source1].data.scrapedContent)) || 
          (source2.includes('scraper') || (inputSources[source2].data && inputSources[source2].data.scrapedContent));
        
        const hasPDF = 
          (source1.includes('pdf') || (inputSources[source1].data && (inputSources[source1].data.type === 'document'))) ||
          (source2.includes('pdf') || (inputSources[source2].data && (inputSources[source2].data.type === 'document')));
          
        if (hasYouTube && hasScraper) {
          combinedData.format = 'youtube_and_web';
          combinedData.type = 'research';
        } else if (hasYouTube && hasPDF) {
          combinedData.format = 'youtube_and_document';
          combinedData.type = 'research';
        } else if (hasScraper && hasPDF) {
          combinedData.format = 'web_and_document';
          combinedData.type = 'research';
        }
      }
      
      setOutputData({
        combinedData,
        timestamp: new Date().toISOString(),
        sources: connectedSourceIds.length,
        sourceIds: connectedSourceIds
      });
      
      setIsReady(true);
      return true;
    }
    
    setIsReady(false);
    return false;
  };

  // Reset the node to clear all inputs
  const handleReset = () => {
    setInputSources({});
    setOutputData(null);
    setIsReady(false);
    setNodeState('waiting');
  };

  // Calculate the status summary
  const getStatusSummary = () => {
    const totalSources = Object.keys(inputSources).length;
    const receivedCount = Object.values(inputSources).filter(s => s.status === 'received').length;
    
    if (totalSources === 0) {
      return 'No input sources connected';
    }
    
    return `${receivedCount} of ${totalSources} inputs received`;
  };

  return (
    <div 
      className={`wait-node node-container state-${nodeState} ${theme === 'dark' ? 'dark' : ''} ${data.isInExecutionPath ? 'in-path' : ''}`}
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
          background: '#6c5ce7', 
          border: 'none' 
        }}
      />
      
      <div className="node-header" style={{ 
        background: 'linear-gradient(90deg, #6c5ce7, #8e44ad)',
        padding: '12px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        color: 'white',
        fontWeight: 600,
        fontSize: '14px',
        borderBottom: '1px solid rgba(255,255,255,0.1)'
      }}>
        <Clock size={16} className="node-title-icon" />
        <div className="node-title">Wait Node</div>
      </div>
      
      <div className="node-content" style={{ padding: '16px' }}>
        <div className="status-summary" style={{
          padding: '10px',
          borderRadius: '6px',
          background: isReady ? '#edf7ed' : '#f0f7ff',
          marginBottom: '12px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontSize: '13px',
          color: isReady ? '#1e7e34' : '#0d47a1',
          border: `1px solid ${isReady ? '#c8e6c9' : '#bbdefb'}`
        }}>
          {isReady ? (
            <>
              <CheckCircle size={14} />
              <span>All inputs received!</span>
            </>
          ) : nodeState === 'processing' ? (
            <>
              <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} />
              <span>Processing inputs...</span>
            </>
          ) : (
            <>
              <Clock size={14} />
              <span>{getStatusSummary()}</span>
            </>
          )}
        </div>
        
        <div className="inputs-list" style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          marginBottom: '16px'
        }}>
          <div style={{ fontSize: '13px', fontWeight: '500', color: theme === 'dark' ? '#adb5bd' : '#555' }}>
            Input Sources:
          </div>
          
          {Object.keys(inputSources).length > 0 ? (
            Object.entries(inputSources).map(([sourceId, info]) => (
              <div 
                key={sourceId}
                style={{
                  padding: '8px 12px',
                  borderRadius: '6px',
                  background: info.status === 'received' ? '#f1f8e9' : '#f5f5f5',
                  border: `1px solid ${info.status === 'received' ? '#dcedc8' : '#e0e0e0'}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: '12px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {info.status === 'received' ? (
                    <CheckCircle size={14} color="#689f38" />
                  ) : (
                    <Clock size={14} color="#757575" />
                  )}
                  <span style={{ 
                    maxWidth: '150px', 
                    overflow: 'hidden', 
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    color: theme === 'dark' ? '#e1e1e6' : '#333'
                  }}>
                    {sourceId.includes('node') ? `Node ${sourceId.split('-')[1]}` : sourceId}
                  </span>
                </div>
                <span style={{ 
                  fontSize: '11px', 
                  color: info.status === 'received' ? '#689f38' : '#757575',
                  fontWeight: info.status === 'received' ? '500' : 'normal'
                }}>
                  {info.status === 'received' ? 'Received' : 'Waiting...'}
                </span>
              </div>
            ))
          ) : (
            <div style={{
              padding: '12px',
              background: '#f5f5f5',
              borderRadius: '6px',
              color: '#666',
              fontSize: '12px',
              textAlign: 'center',
              fontStyle: 'italic'
            }}>
              Connect input sources to this wait node
            </div>
          )}
        </div>
        
        <div className="output-status" style={{
          marginTop: '12px',
          padding: '10px',
          borderRadius: '6px',
          background: '#f8f9fa',
          border: '1px solid #e9ecef',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between',
            fontSize: '13px',
            fontWeight: '500',
            color: theme === 'dark' ? '#adb5bd' : '#555'
          }}>
            <span>Output Status:</span>
            <button 
              onClick={handleReset} 
              style={{
                background: 'transparent',
                border: '1px solid #ddd',
                borderRadius: '4px',
                padding: '4px 8px',
                fontSize: '11px',
                cursor: 'pointer',
                color: '#666'
              }}
            >
              Reset
            </button>
          </div>
          
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px',
            background: isReady ? '#edf7ed' : '#f0f7ff',
            borderRadius: '4px',
            fontSize: '12px',
            color: isReady ? '#1e7e34' : '#0d47a1'
          }}>
            {isReady ? (
              <>
                <ArrowRight size={14} />
                <span>Ready to send combined data</span>
              </>
            ) : (
              <>
                <Clock size={14} />
                <span>Waiting for all inputs</span>
              </>
            )}
          </div>
        </div>
      </div>
      
      <Handle
        type="source"
        position={Position.Bottom}
        isConnectable={isConnectable}
        className="node-handle source-handle"
        style={{ 
          background: '#6c5ce7', 
          border: 'none' 
        }}
      />
    </div>
  );
};

export default WaitNode; 