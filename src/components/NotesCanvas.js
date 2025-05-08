/* eslint-disable */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import ReactFlow, {
  addEdge,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  Panel,
  getOutgoers,
  getConnectedEdges
} from 'reactflow';
import 'reactflow/dist/style.css';
import '../css/NotesCanvas.css';
import { Save, RefreshCw, ZoomIn, ZoomOut, Maximize2, Grid, Trash2 } from 'lucide-react';
import { useTheme } from '../ThemeContext';

// Custom Node Types (will be implemented separately)
import TextNode from './nodes/TextNode';
import PDFNode from './nodes/PDFNode';
import YouTubeNode from './nodes/YouTubeNode';
import AIChatNode from './nodes/AIChatNode';
import AIOutputNode from './nodes/AIOutputNode';
import FileNode from './nodes/FileNode';
import NoteNode from './nodes/NoteNode';
import StartNode from './nodes/StartNode';

// Function to create node component wrappers that pass the ID properly
const createNodeWrapper = (NodeComponent) => {
  return (props) => {
    // Extract the id from props which comes from ReactFlow
    const { id } = props;
    return <NodeComponent {...props} id={id} />;
  };
};

// Map of node types to their components, with proper ID passing
const nodeTypes = {
  textNode: createNodeWrapper(TextNode),
  pdfNode: createNodeWrapper(PDFNode),
  youtubeNode: createNodeWrapper(YouTubeNode),
  aiChatNode: createNodeWrapper(AIChatNode),
  aiOutputNode: createNodeWrapper(AIOutputNode),
  fileNode: createNodeWrapper(FileNode),
  noteNode: createNodeWrapper(NoteNode),
  startNode: createNodeWrapper(StartNode),
};

const NotesCanvas = ({ canvasData, onSave, canvasId }) => {
  const { theme } = useTheme();
  const reactFlowWrapper = useRef(null);
  const [nodes, setNodes, onNodesChange] = useNodesState(canvasData?.nodes || []);
  const [edges, setEdges, onEdgesChange] = useEdgesState(canvasData?.edges || []);
  const [reactFlowInstance, setReactFlowInstance] = useState(null);
  const [isDirty, setIsDirty] = useState(false);
  const [isExecutingFlow, setIsExecutingFlow] = useState(false);
  const [selectedNode, setSelectedNode] = useState(null);
  const [executionPath, setExecutionPath] = useState([]);
  
  // Store node execution handlers
  const nodeExecutionHandlers = useRef(new Map());
  const nodeRegistrationLog = useRef(new Set());

  // Register a node for flow execution
  const registerNodeForFlow = useCallback((nodeId, executionHandler) => {
    if (!nodeId) {
      console.error('Cannot register node: undefined node ID');
      return () => {};
    }
    
    if (typeof executionHandler !== 'function') {
      console.error(`Cannot register node ${nodeId}: execution handler is not a function`);
      return () => {};
    }
    
    if (!nodeRegistrationLog.current.has(nodeId)) {
      console.log(`Registering node ${nodeId} for flow execution`);
      nodeRegistrationLog.current.add(nodeId);
    }
    
    // Set the execution handler
    nodeExecutionHandlers.current.set(nodeId, executionHandler);
    
    // Update node connections status for start nodes
    updateStartNodeConnections();
    
    return () => {
      console.log(`Unregistering node ${nodeId} from flow execution`);
      nodeExecutionHandlers.current.delete(nodeId);
      nodeRegistrationLog.current.delete(nodeId);
    };
  }, []);
  
  // Update start nodes to reflect if they have connections
  const updateStartNodeConnections = useCallback(() => {
    setNodes(currentNodes => 
      currentNodes.map(node => {
        if (node.type === 'startNode') {
          // Check if this start node has outgoing connections
          const hasConnections = edges.some(edge => edge.source === node.id);
          
          return {
            ...node,
            data: {
              ...node.data,
              hasConnections
            }
          };
        }
        return node;
      })
    );
  }, [edges, setNodes]);
  
  // Update connections when edges change
  useEffect(() => {
    updateStartNodeConnections();
  }, [edges, updateStartNodeConnections]);

  // Calculate execution path from a start node
  const calculateExecutionPath = useCallback((startNodeId) => {
    if (!startNodeId) {
      console.error('Cannot calculate execution path: undefined start node ID');
      return [];
    }
    
    const path = new Set();
    const visited = new Set();
    
    const traverse = (nodeId) => {
      if (!nodeId || visited.has(nodeId)) return;
      visited.add(nodeId);
      path.add(nodeId);
      
      // Find all edges where this node is the source
      const outgoingEdges = edges.filter(edge => edge.source === nodeId);
      
      // Process each outgoing edge
      outgoingEdges.forEach(edge => {
        if (edge.target) {
        traverse(edge.target);
        }
      });
    };
    
    traverse(startNodeId);
    const executionPath = Array.from(path);
    
    console.log(`Calculated execution path from ${startNodeId}:`, executionPath);
    return executionPath;
  }, [edges]);

  // Execute the flow starting from a node
  const executeFlow = useCallback(async (startNodeId) => {
    if (isExecutingFlow || !startNodeId) {
      console.warn('Cannot execute flow: flow already executing or invalid start node ID');
      return;
    }
    
    try {
      setIsExecutingFlow(true);
      const executionPath = calculateExecutionPath(startNodeId);
      
      // Validate execution path contains valid node IDs
      if (!executionPath || executionPath.length === 0 || !executionPath[0]) {
        console.error('Invalid execution path:', executionPath);
        setIsExecutingFlow(false);
        return;
      }
      
      setExecutionPath(executionPath);
      
      console.log('Execution path:', executionPath);
      
      // Mark nodes in execution path
      setNodes(currentNodes => 
        currentNodes.map(node => ({
          ...node,
          data: {
            ...node.data,
            isInExecutionPath: executionPath.includes(node.id),
            executionComplete: false,
            executionError: false,
            executionPosition: executionPath.indexOf(node.id)
          }
        }))
      );
      
      // Execute nodes in sequence
      let previousNodeOutput = null;
      for (let i = 0; i < executionPath.length; i++) {
        const nodeId = executionPath[i];
        if (!nodeId) {
          console.error(`Invalid node ID at position ${i} in execution path`);
          continue;
        }
        
        const node = nodes.find(n => n.id === nodeId);
        
        if (!node) {
          console.error(`Node with ID ${nodeId} not found`);
          continue;
        }
        
        // Mark current node as executing
        setNodes(currentNodes => 
          currentNodes.map(n => ({
            ...n,
            data: {
              ...n.data,
              isExecuting: n.id === nodeId,
              executionComplete: n.id === nodeId ? false : n.data?.executionComplete
            }
          }))
        );
        
        // Execute the node with the output from the previous node
        if (nodeExecutionHandlers.current.has(nodeId)) {
          try {
            console.log(`Executing node ${nodeId} (${node.type})`);
            const handlerFn = nodeExecutionHandlers.current.get(nodeId);
            
            // Pass the output from the previous node to the current node
            previousNodeOutput = await handlerFn(previousNodeOutput);
            
            // Mark node as complete
            setNodes(currentNodes => 
              currentNodes.map(n => ({
                ...n,
                data: {
                  ...n.data,
                  isExecuting: false,
                  executionComplete: n.id === nodeId ? true : n.data?.executionComplete
                }
              }))
            );
          } catch (error) {
            console.error(`Error executing node ${nodeId}:`, error);
            
            // Mark node as error
            setNodes(currentNodes => 
              currentNodes.map(n => ({
                ...n,
                data: {
                  ...n.data,
                  isExecuting: false,
                  executionError: n.id === nodeId ? true : n.data?.executionError
                }
              }))
            );
            break;
          }
        } else {
          console.warn(`No execution handler registered for node ${nodeId}`);
        }
        
        // Add a small delay between node executions to prevent UI issues
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      // Mark all nodes as not executing
      setNodes(currentNodes => 
        currentNodes.map(node => ({
          ...node,
          data: {
            ...node.data,
            isExecuting: false
          }
        }))
      );
      
      console.log('Flow execution completed successfully');
    } catch (error) {
      console.error('Error executing flow:', error);
    } finally {
      setIsExecutingFlow(false);
      
      // Reset execution path after a delay
      setTimeout(() => {
        setNodes(currentNodes => 
          currentNodes.map(node => ({
            ...node,
            data: {
              ...node.data,
              isInExecutionPath: false,
              executionComplete: false,
              executionError: false,
              executionPosition: null
            }
          }))
        );
        setExecutionPath([]);
      }, 3000);
    }
  }, [nodes, edges, isExecutingFlow, calculateExecutionPath, setNodes]);

  // Register the execution handler for start nodes with debounced updates
  useEffect(() => {
    const debounceTimeout = setTimeout(() => {
      setNodes(nds => 
        nds.map(node => {
          if (!node.id) {
            console.warn('Found node without ID during registration');
            return node;
          }
          
          return {
          ...node,
          data: {
            ...node.data,
            registerNodeForFlow,
              onNodeRun: node.type === 'startNode' ? 
                (startNodeId) => {
                  // Ensure we have a valid start node ID, fall back to the node's own ID
                  const validStartNodeId = (startNodeId && startNodeId !== 'undefined') 
                    ? startNodeId 
                    : node.id;
                    
                  console.log(`Executing flow using start node ID: ${validStartNodeId}`);
                  return executeFlow(validStartNodeId);
                } : 
                undefined
          }
          };
        })
      );
    }, 100);
    
    return () => clearTimeout(debounceTimeout);
  }, [setNodes, registerNodeForFlow, executeFlow]);

  // Log component mounting
  useEffect(() => {
    console.log('NotesCanvas mounted with ID:', canvasId);
    console.log('Initial canvas data:', canvasData);

    return () => {
      console.log('NotesCanvas unmounting, ID:', canvasId);
    };
  }, [canvasId]);

  // Reset dirty state when canvas changes
  useEffect(() => {
    console.log('Canvas ID changed to:', canvasId);
    setIsDirty(false);
  }, [canvasId]);

  // Update start nodes and connection info after edges change
  useEffect(() => {
    // Only run this effect when edges actually change
    const edgeCount = edges.length;
    
    // Log all edges for debugging but limit verbosity
    if (edgeCount > 0) {
      console.log(`Current edges (${edgeCount}):`);
    }
    
    // Count outgoing connections for each node
    const connectionCounts = {};
    const targetCounts = {};
    
    edges.forEach(edge => {
      // Update source connections
      connectionCounts[edge.source] = (connectionCounts[edge.source] || 0) + 1;
      
      // Update target connections
      targetCounts[edge.target] = (targetCounts[edge.target] || 0) + 1;
    });
    
    // Only log if there are actually counts to report
    if (Object.keys(connectionCounts).length > 0) {
      console.log("Connection counts:", connectionCounts);
    }
    
    // Update all nodes with connection information, but only if we have nodes
    setNodes(currentNodes => {
      // Find any start nodes that need updating
      const startNodes = currentNodes.filter(node => node.type === 'startNode');
      
      if (startNodes.length === 0) return currentNodes;
      
      // Only log once per update
      let hasLoggedUpdate = false;
      
      const updatedNodes = currentNodes.map(node => {
        const hasOutgoingConnections = connectionCounts[node.id] > 0;
        const hasIncomingConnections = targetCounts[node.id] > 0;
        const connectionCount = connectionCounts[node.id] || 0;
        
        // Only update start nodes with hasConnections property
        if (node.type === 'startNode') {
          // Check if the connection status has actually changed
          const currentHasConnections = node.data?.hasConnections || false;
          const currentConnectionCount = node.data?.connectionCount || 0;
          
          if (currentHasConnections !== hasOutgoingConnections || currentConnectionCount !== connectionCount) {
            if (!hasLoggedUpdate) {
              console.log(`Updating start node ${node.id} - connections: ${connectionCount}`);
              hasLoggedUpdate = true;
            }
            
            return {
              ...node,
              data: {
                ...node.data,
                hasConnections: hasOutgoingConnections,
                connectionCount
              }
            };
          }
        }
        return node;
      });
      
      return updatedNodes;
    });
  }, [edges, setNodes]);

  // Handle connections between nodes
  const onConnect = useCallback((params) => {
    if (!params.source || !params.target) {
      console.warn('Invalid connection: missing source or target node ID');
      return;
    }
    
    console.log('Creating edge connection:', params);
    
    // Create a unique edge ID
    const edgeId = `edge-${params.source}-${params.target}-${Date.now()}`;
    const newEdge = { 
      ...params, 
      id: edgeId,
      animated: true,
      // Add visual styling based on types
      style: { stroke: '#7952b3', strokeWidth: 2 }
    };
    
    // Get current nodes and edges before adding the new edge
    const currentEdges = [...edges];
    
    // Add the new edge using functional update to ensure we get the latest state
    setEdges(edgeList => {
      const updatedEdges = addEdge(newEdge, edgeList);
      return updatedEdges;
    });
    
    setIsDirty(true);
    
    // Configure data flow between nodes based on their types
      const sourceNode = nodes.find(node => node.id === params.source);
      const targetNode = nodes.find(node => node.id === params.target);
      
    if (!sourceNode || !targetNode) {
      console.warn('Could not find source or target node');
      return;
    }
    
    console.log(`Connected ${sourceNode.type} to ${targetNode.type}`);
    
    // Only update nodes if we have a specific data flow to configure
    // (like aiChatNode to aiOutputNode)
    // Otherwise, rely on the edges effect to update connection counts
    if (sourceNode.type === 'aiChatNode' && targetNode.type === 'aiOutputNode') {
      setNodes(currentNodes => {
        return currentNodes.map(node => {
          if (node.id === sourceNode.id) {
            return {
              ...node,
              data: {
                ...node.data,
                onOutputChange: (response) => {
                  // Update the target node's response
                  setNodes(nodes => 
                    nodes.map(n => 
                      n.id === targetNode.id 
                        ? { ...n, data: { ...n.data, response } } 
                        : n
                    )
                  );
                }
              }
            };
          }
          return node;
        });
      });
    }
    
    // The rest of the connection tracking will be handled by the useEffect
    // that watches the edges array and updates the nodes accordingly
  }, [setEdges, nodes, edges, setNodes]);

  // Save the current canvas state
  const handleSaveCanvas = () => {
    if (onSave && reactFlowInstance) {
      const flow = reactFlowInstance.toObject();
      
      // Add version and format information
      const enhancedFlow = {
        ...flow,
        format: "canvas",
        version: "1.0",
        lastSaved: new Date().toISOString()
      };
      
      onSave(enhancedFlow);
      setIsDirty(false);
    }
  };

  // Initialize ReactFlow instance
  const onInit = useCallback((instance) => {
    setReactFlowInstance(instance);
  }, []);

  // Handle node drop from the sidebar
  const onDrop = useCallback((event) => {
    event.preventDefault();
    console.log('Drop event detected');

    if (!reactFlowInstance) {
      console.error('No ReactFlow instance available');
      return;
    }

    try {
      const reactFlowBounds = reactFlowWrapper.current.getBoundingClientRect();
      const nodeData = JSON.parse(event.dataTransfer.getData('application/reactflow'));
      console.log('Dropped node data:', nodeData);

      // Check if the dropped element is valid
      if (typeof nodeData.type === 'undefined') {
        console.error('Invalid node data: missing type');
        return;
      }

      const position = reactFlowInstance.project({
        x: event.clientX - reactFlowBounds.left,
        y: event.clientY - reactFlowBounds.top,
      });

      // Create a unique node ID
      const newNodeId = `${nodeData.type}_${Date.now()}`;
      console.log('Creating new node with ID:', newNodeId);
      
      const initialData = {
        ...nodeData.data,
        label: `New ${nodeData.type}`,
        registerNodeForFlow, // Add flow registration to all nodes
      };
      
      // Add specific properties for start nodes
      if (nodeData.type === 'startNode') {
        initialData.hasConnections = false;
        initialData.connectionCount = 0;
        initialData.workflowName = 'My Workflow';
      }
      
      const newNode = {
        id: newNodeId,
        type: nodeData.type,
        position,
        data: initialData,
      };

      setNodes((nds) => nds.concat(newNode));
      setIsDirty(true);
    } catch (error) {
      console.error('Error handling node drop:', error);
    }
  }, [reactFlowInstance, setNodes, registerNodeForFlow]);

  const onDragOver = useCallback((event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  // Fit view to see all nodes
  const fitView = () => {
    if (reactFlowInstance) {
      reactFlowInstance.fitView({ padding: 0.2 });
    }
  };

  // Handle node selection
  const onNodeClick = useCallback((event, node) => {
    setSelectedNode(node);
  }, []);

  // Handle node deletion
  const handleDeleteNode = useCallback(() => {
    if (selectedNode) {
      // Get all edges connected to this node
      const connectedEdges = getConnectedEdges([selectedNode], edges);
      
      // Delete the edges
      setEdges(eds => eds.filter(edge => !connectedEdges.some(ce => ce.id === edge.id)));
      
      // Delete the node
      setNodes(nds => nds.filter(node => node.id !== selectedNode.id));
      
      // Clear selection
      setSelectedNode(null);
      
      // Update connection statuses after deletion
      setTimeout(() => {
        const remainingEdges = edges.filter(edge => 
          !connectedEdges.some(ce => ce.id === edge.id)
        );
        
        // Count connections again
        const connectionCounts = {};
        remainingEdges.forEach(edge => {
          connectionCounts[edge.source] = (connectionCounts[edge.source] || 0) + 1;
        });
        
        // Update start nodes
        setNodes(currentNodes => 
          currentNodes.map(node => {
            if (node.type === 'startNode') {
              const hasConnections = connectionCounts[node.id] > 0;
              const connectionCount = connectionCounts[node.id] || 0;
              return {
                ...node,
                data: {
                  ...node.data,
                  hasConnections,
                  connectionCount
                }
              };
            }
            return node;
          })
        );
      }, 0);
      
      // Mark as dirty since we made changes
      setIsDirty(true);
    }
  }, [selectedNode, edges, setEdges, setNodes]);

  // Clear selection when clicking on canvas
  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
  }, []);

  return (
    <div 
      className={`NotesCanvas ${theme === 'dark' ? 'dark' : ''}`} 
      ref={reactFlowWrapper}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onInit={onInit}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        nodeTypes={nodeTypes}
        fitView
        attributionPosition="bottom-right"
      >
        <Background />
        <Controls />
        <MiniMap />
        
        <Panel position="top-right" className="canvas-actions">
          <button 
            className={`canvas-action-btn ${isDirty ? 'dirty' : ''}`} 
            onClick={handleSaveCanvas} 
            title="Save Canvas"
          >
            <Save size={16} />
          </button>
          <button 
            className="canvas-action-btn" 
            onClick={fitView} 
            title="Fit View"
          >
            <Maximize2 size={16} />
          </button>
          <button 
            className="canvas-action-btn" 
            onClick={() => reactFlowInstance?.zoomIn()} 
            title="Zoom In"
          >
            <ZoomIn size={16} />
          </button>
          <button 
            className="canvas-action-btn" 
            onClick={() => reactFlowInstance?.zoomOut()} 
            title="Zoom Out"
          >
            <ZoomOut size={16} />
          </button>
        </Panel>
        
        {selectedNode && (
          <Panel position="top-left" className="node-actions">
            <div className="selected-node-info">
              Selected: {selectedNode.type.replace('Node', '')}
            </div>
            <button 
              className="canvas-action-btn delete-btn" 
              onClick={handleDeleteNode}
              title="Delete Node"
            >
              <Trash2 size={16} />
              <span>Delete</span>
            </button>
          </Panel>
        )}
      </ReactFlow>
    </div>
  );
};

export default NotesCanvas;