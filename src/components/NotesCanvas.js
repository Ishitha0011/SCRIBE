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

// Map of node types to their components
const nodeTypes = {
  textNode: TextNode,
  pdfNode: PDFNode,
  youtubeNode: YouTubeNode,
  aiChatNode: AIChatNode,
  aiOutputNode: AIOutputNode,
  fileNode: FileNode,
  noteNode: NoteNode,
  startNode: StartNode,
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

  // Register a node for flow execution
  const registerNodeForFlow = useCallback((nodeId, executionHandler) => {
    nodeExecutionHandlers.current.set(nodeId, executionHandler);
    
    // Update node connections status for start nodes
    updateStartNodeConnections();
    
    return () => {
      nodeExecutionHandlers.current.delete(nodeId);
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
    const path = new Set();
    const visited = new Set();
    
    const traverse = (nodeId) => {
      if (visited.has(nodeId)) return;
      visited.add(nodeId);
      path.add(nodeId);
      
      // Find all edges where this node is the source
      const outgoingEdges = edges.filter(edge => edge.source === nodeId);
      
      // Process each outgoing edge
      outgoingEdges.forEach(edge => {
        traverse(edge.target);
      });
    };
    
    traverse(startNodeId);
    return Array.from(path);
  }, [edges]);

  // Execute the flow starting from a node
  const executeFlow = useCallback(async (startNodeId) => {
    if (isExecutingFlow) return;
    
    try {
      setIsExecutingFlow(true);
      const executionPath = calculateExecutionPath(startNodeId);
      setExecutionPath(executionPath);
      
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
      
      // Execute nodes in sequence with debounced updates
      for (let i = 0; i < executionPath.length; i++) {
        const nodeId = executionPath[i];
        const node = nodes.find(n => n.id === nodeId);
        
        if (!node) continue;
        
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
        
        // Execute the node
        if (node.data?.onNodeRun) {
          try {
            await node.data.onNodeRun(nodeId);
            
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
        }
        
        // Add a small delay between node executions to prevent ResizeObserver issues
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
      
      console.log('Flow execution completed');
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
        nds.map(node => ({
          ...node,
          data: {
            ...node.data,
            registerNodeForFlow,
            onNodeRun: node.type === 'startNode' ? executeFlow : undefined
          }
        }))
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

  // Handle connections between nodes
  const onConnect = useCallback((params) => {
    console.log('Creating edge connection:', params);
    setEdges((eds) => addEdge({ ...params, animated: true }, eds));
    setIsDirty(true);
    
    // If connecting AI Chat to AI Output, set up data flow
    if (params.source && params.target) {
      const sourceNode = nodes.find(node => node.id === params.source);
      const targetNode = nodes.find(node => node.id === params.target);
      
      if (sourceNode?.type === 'aiChatNode' && targetNode?.type === 'aiOutputNode') {
        // Set up the output change handler
        const updatedNodes = nodes.map(node => {
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
        
        setNodes(updatedNodes);
      }
    }
  }, [setEdges, nodes, setNodes]);

  // Save the current canvas state
  const handleSaveCanvas = () => {
    if (onSave && reactFlowInstance) {
      const flow = reactFlowInstance.toObject();
      onSave(flow);
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
      
      const newNode = {
        id: newNodeId,
        type: nodeData.type,
        position,
        data: {
          ...nodeData.data,
          label: `New ${nodeData.type}`,
          registerNodeForFlow // Add flow registration to all nodes
        },
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