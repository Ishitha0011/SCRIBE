const { createProxyMiddleware } = require('http-proxy-middleware');
const fs = require('fs');
const path = require('path');

// Function to get server port from environment
const getServerPort = () => {
  try {
    // First try to get from .env.development.local which has React app variables
    const reactEnvPath = path.join(__dirname, '..', '.env.development.local');
    if (fs.existsSync(reactEnvPath)) {
      const reactEnvContent = fs.readFileSync(reactEnvPath, 'utf8');
      const portMatch = reactEnvContent.match(/REACT_APP_SERVER_PORT=(\d+)/);
      if (portMatch) return portMatch[1];
    }
    
    // Then try to get from .env which has server variables
    const envPath = path.join(__dirname, '..', '.env');
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf8');
      const portMatch = envContent.match(/SERVER_PORT=(\d+)/);
      if (portMatch) return portMatch[1];
    }
    
    // Default fallback
    return '8001';
  } catch (error) {
    console.error('Error reading server port from environment:', error);
    return '8001';
  }
};

module.exports = function(app) {
  const serverPort = getServerPort();
  console.log(`Setting up proxy to http://localhost:${serverPort}`);
  
  app.use(
    '/api',
    createProxyMiddleware({
      target: `http://localhost:${serverPort}`,
      changeOrigin: true,
      pathRewrite: {
        '^/api': '/api', // No rewrite needed, just keeping path as is
      },
      // Log for debugging
      onProxyReq: (proxyReq, req, res) => {
        console.log(`Proxying request: ${req.method} ${req.url} to http://localhost:${serverPort}${req.url}`);
      },
      // Handle errors
      onError: (err, req, res) => {
        console.error('Proxy error:', err);
        res.writeHead(500, {
          'Content-Type': 'application/json',
        });
        res.end(JSON.stringify({ error: 'Proxy error connecting to server' }));
      },
    })
  );
}; 