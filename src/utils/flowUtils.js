/**
 * Utility functions for flow execution
 */

// Storage for registered node handlers
const registeredNodes = new Map();

/**
 * Register a node for flow execution
 * @param {string} nodeId - The ID of the node to register
 * @param {Function} handler - The function to execute when the node is triggered
 * @returns {Function} - Cleanup function to unregister the node
 */
export const registerNode = (nodeId, handler) => {
  if (!nodeId) {
    console.error('Cannot register node: No node ID provided');
    return () => {};
  }
  
  console.log(`Registering node ${nodeId} for flow execution`);
  registeredNodes.set(nodeId, handler);
  
  // Return cleanup function
  return () => {
    console.log(`Unregistering node ${nodeId}`);
    registeredNodes.delete(nodeId);
  };
};

/**
 * Execute a node's flow handler
 * @param {string} nodeId - The ID of the node to execute
 * @param {Object} inputData - Data to pass to the node
 * @returns {Promise<Object>} - The result of the node execution
 */
export const executeNode = async (nodeId, inputData = {}) => {
  const handler = registeredNodes.get(nodeId);
  
  if (!handler) {
    console.error(`No handler registered for node ${nodeId}`);
    return inputData;
  }
  
  console.log(`Executing node ${nodeId}`);
  try {
    const result = await handler(inputData);
    console.log(`Node ${nodeId} execution complete:`, result);
    return result || inputData;
  } catch (error) {
    console.error(`Error executing node ${nodeId}:`, error);
    return inputData;
  }
};

/**
 * Trace execution path through the flow
 * @param {string} startNodeId - The ID of the node to start from
 * @param {Array} nodes - All nodes in the flow
 * @param {Array} edges - All edges in the flow
 * @returns {Array} - Ordered array of node IDs representing the execution path
 */
export const traceExecutionPath = (startNodeId, nodes, edges) => {
  const visited = new Set();
  const path = [];
  
  const traverse = (nodeId) => {
    if (visited.has(nodeId)) return;
    
    visited.add(nodeId);
    path.push(nodeId);
    
    // Find outgoing edges
    const outgoingEdges = edges.filter(edge => edge.source === nodeId);
    
    // Process each target node
    for (const edge of outgoingEdges) {
      traverse(edge.target);
    }
  };
  
  traverse(startNodeId);
  return path;
};

/**
 * Check if a node is connected to the flow
 * @param {string} nodeId - The ID of the node to check
 * @param {Array} edges - All edges in the flow
 * @returns {boolean} - True if the node has connections
 */
export const hasConnections = (nodeId, edges) => {
  return edges.some(edge => edge.source === nodeId || edge.target === nodeId);
};

/**
 * Get all node IDs that are connected to a specific node
 * @param {string} nodeId - The ID of the node to check
 * @param {Array} edges - All edges in the flow
 * @param {string} direction - 'incoming', 'outgoing', or 'both'
 * @returns {Array} - Array of connected node IDs
 */
export const getConnectedNodes = (nodeId, edges, direction = 'both') => {
  const connectedNodes = new Set();
  
  if (direction === 'incoming' || direction === 'both') {
    edges
      .filter(edge => edge.target === nodeId)
      .forEach(edge => connectedNodes.add(edge.source));
  }
  
  if (direction === 'outgoing' || direction === 'both') {
    edges
      .filter(edge => edge.source === nodeId)
      .forEach(edge => connectedNodes.add(edge.target));
  }
  
  return Array.from(connectedNodes);
}; 