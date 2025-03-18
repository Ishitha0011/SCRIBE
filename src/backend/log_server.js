const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const app = express();
const PORT = 9999;
const LOG_FILE = path.join(__dirname, '../../worker.logs');

// ASCII art for SCRIBE
const SCRIBE_ASCII = `
███████╗ ██████╗██████╗ ██╗██████╗ ███████╗      
██╔════╝██╔════╝██╔══██╗██║██╔══██╗██╔════╝▄ ██╗▄
███████╗██║     ██████╔╝██║██████╔╝█████╗   ████╗
╚════██║██║     ██╔══██╗██║██╔══██╗██╔══╝  ▀╚██╔▀
███████║╚██████╗██║  ██║██║██████╔╝███████╗  ╚═╝ 
╚══════╝ ╚═════╝╚═╝  ╚═╝╚═╝╚═════╝ ╚══════╝      
`;

// Create log file if it doesn't exist
if (!fs.existsSync(LOG_FILE)) {
  fs.writeFileSync(LOG_FILE, `--- Log File Created ---\n`);
}

// Track clients for server-sent events
const clients = [];
let lastLogSize = fs.statSync(LOG_FILE).size;

// Enable CORS for all routes
app.use(cors());

// Parse JSON bodies
app.use(express.json());

// Endpoint to write logs
app.post('/log', (req, res) => {
  try {
    const { log } = req.body;
    
    if (!log) {
      return res.status(400).json({ error: 'Log entry is required' });
    }
    
    // Append to log file
    fs.appendFileSync(LOG_FILE, log);
    
    // Also log to console for debug
    console.log('Log entry received:', log.trim());
    
    // Notify all connected clients
    const newSize = fs.statSync(LOG_FILE).size;
    const newData = fs.readFileSync(LOG_FILE, 'utf8').slice(lastLogSize);
    lastLogSize = newSize;
    
    clients.forEach(client => {
      client.res.write(`data: ${JSON.stringify({ update: true, newData })}\n\n`);
    });
    
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error writing log:', error);
    return res.status(500).json({ error: 'Failed to write log' });
  }
});

// SSE endpoint for real-time updates
app.get('/sse', (req, res) => {
  // Set up SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });
  
  // Send initial data
  const data = fs.readFileSync(LOG_FILE, 'utf8');
  res.write(`data: ${JSON.stringify({ initial: true, data })}\n\n`);
  
  // Keep track of this client
  const clientId = Date.now();
  const newClient = { id: clientId, res };
  clients.push(newClient);
  
  // Remove client on connection close
  req.on('close', () => {
    const index = clients.findIndex(client => client.id === clientId);
    if (index !== -1) {
      clients.splice(index, 1);
    }
  });
});

// Serve logs as HTML
app.get('/', (req, res) => {
  try {
    // Create a more terminal-like HTML page with SSE for real-time updates
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Worker Logs - SCRIBE</title>
        <style>
          :root {
            --bg-color: #1e1e1e;
            --text-color: #f0f0f0;
            --header-color: #4CAF50;
            --timestamp-color: #64B5F6;
            --error-color: #FF5252;
            --info-color: #4CAF50;
            --warning-color: #FFC107;
            --border-color: #333;
          }
          
          body {
            background-color: var(--bg-color);
            color: var(--text-color);
            font-family: 'Cascadia Code', 'Fira Code', Consolas, monospace;
            padding: 0;
            margin: 0;
            line-height: 1.5;
            overflow: hidden;
            height: 100vh;
            display: flex;
            flex-direction: column;
          }
          
          header {
            background-color: rgba(0, 0, 0, 0.3);
            padding: 10px;
            border-bottom: 1px solid var(--border-color);
          }
          
          .ascii-art {
            color: var(--header-color);
            font-size: 12px;
            line-height: 1;
            white-space: pre;
            font-family: monospace;
            text-align: center;
            margin-bottom: 10px;
          }
          
          .status-bar {
            display: flex;
            justify-content: space-between;
            font-size: 12px;
            padding: 5px 10px;
            background-color: rgba(0, 0, 0, 0.2);
            border-bottom: 1px solid var(--border-color);
          }
          
          .container {
            flex: 1;
            overflow: hidden;
            display: flex;
            flex-direction: column;
          }
          
          .terminal {
            flex: 1;
            padding: 10px;
            overflow-y: auto;
            font-size: 14px;
            white-space: pre-wrap;
          }
          
          .log-entry {
            padding: 3px 0;
            border-bottom: 1px solid rgba(255, 255, 255, 0.05);
            animation: fadeIn 0.3s ease;
          }
          
          .timestamp {
            color: var(--timestamp-color);
            margin-right: 8px;
          }
          
          .error {
            color: var(--error-color);
          }
          
          .info {
            color: var(--info-color);
          }
          
          .warning {
            color: var(--warning-color);
          }
          
          .status-indicator {
            display: inline-block;
            width: 8px;
            height: 8px;
            border-radius: 50%;
            margin-right: 6px;
            background-color: #4CAF50;
          }
          
          .disconnected .status-indicator {
            background-color: #FF5252;
          }
          
          @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          
          /* Custom scrollbar */
          .terminal::-webkit-scrollbar {
            width: 8px;
          }
          
          .terminal::-webkit-scrollbar-track {
            background: rgba(0, 0, 0, 0.2);
          }
          
          .terminal::-webkit-scrollbar-thumb {
            background-color: rgba(255, 255, 255, 0.2);
            border-radius: 4px;
          }
          
          /* Footer with controls */
          footer {
            padding: 8px;
            background-color: rgba(0, 0, 0, 0.3);
            border-top: 1px solid var(--border-color);
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          
          button {
            background-color: rgba(255, 255, 255, 0.1);
            border: none;
            color: var(--text-color);
            padding: 5px 10px;
            border-radius: 3px;
            cursor: pointer;
            font-family: inherit;
            transition: background-color 0.2s;
          }
          
          button:hover {
            background-color: rgba(255, 255, 255, 0.2);
          }
          
          /* Blinking cursor effect */
          .cursor {
            display: inline-block;
            width: 8px;
            height: 15px;
            background-color: #fff;
            animation: blink 1s step-end infinite;
            margin-left: 2px;
            vertical-align: middle;
          }
          
          @keyframes blink {
            0%, 100% { opacity: 1; }
            50% { opacity: 0; }
          }
        </style>
      </head>
      <body>
        <header>
          <div class="ascii-art">${SCRIBE_ASCII}</div>
        </header>
        <div class="status-bar">
          <div class="connection-status">
            <span class="status-indicator"></span>
            <span class="status-text">Connected</span>
          </div>
          <div class="file-info">Log file: worker.logs</div>
        </div>
        <div class="container">
          <div id="terminal" class="terminal"></div>
        </div>
        <footer>
          <div>
            <button id="clear-btn">Clear Display</button>
            <button id="pause-btn">Pause Updates</button>
          </div>
          <div>
            <span id="last-update"></span>
          </div>
        </footer>
        
        <script>
          const terminal = document.getElementById('terminal');
          const clearBtn = document.getElementById('clear-btn');
          const pauseBtn = document.getElementById('pause-btn');
          const lastUpdateEl = document.getElementById('last-update');
          const statusBar = document.querySelector('.status-bar');
          const statusText = document.querySelector('.status-text');
          const connectionStatus = document.querySelector('.connection-status');
          
          let isPaused = false;
          let lastTimestamp = null;
          
          // Format log entry with syntax highlighting
          function formatLogEntry(entry) {
            // Extract the timestamp from between brackets
            const timestampMatch = entry.match(/\\[(.*?)\\]/);
            if (!timestampMatch) return entry;
            
            const timestamp = timestampMatch[0];
            const content = entry.replace(timestamp, '');
            
            // Determine log type for color coding
            let logClass = '';
            if (content.includes('"type":"error"') || content.includes('error')) {
              logClass = 'error';
            } else if (content.includes('"type":"info"')) {
              logClass = 'info';
            } else if (content.includes('"type":"warning"')) {
              logClass = 'warning';
            }
            
            return \`<div class="log-entry \${logClass}">
              <span class="timestamp">\${timestamp}</span>
              <span class="content">\${content}</span>
            </div>\`;
          }
          
          // Initialize SSE connection
          const evtSource = new EventSource('/sse');
          
          evtSource.onmessage = function(event) {
            if (isPaused) return;
            
            const data = JSON.parse(event.data);
            
            if (data.initial) {
              // Initial load - display all existing logs
              const formattedLogs = data.data
                .split('\\n')
                .filter(line => line.trim())
                .map(formatLogEntry)
                .join('');
              
              terminal.innerHTML = formattedLogs;
              scrollToBottom();
            } else if (data.update) {
              // New logs added - append only new content
              const newLogs = data.newData
                .split('\\n')
                .filter(line => line.trim())
                .map(formatLogEntry)
                .join('');
              
              terminal.innerHTML += newLogs;
              scrollToBottom();
            }
            
            lastTimestamp = new Date();
            lastUpdateEl.textContent = 'Last update: ' + lastTimestamp.toLocaleTimeString();
          };
          
          evtSource.onerror = function() {
            connectionStatus.classList.add('disconnected');
            statusText.textContent = 'Disconnected';
          };
          
          // Scroll to the bottom of the terminal
          function scrollToBottom() {
            terminal.scrollTop = terminal.scrollHeight;
          }
          
          // Clear display button
          clearBtn.addEventListener('click', function() {
            terminal.innerHTML = '';
          });
          
          // Pause updates button
          pauseBtn.addEventListener('click', function() {
            isPaused = !isPaused;
            pauseBtn.textContent = isPaused ? 'Resume Updates' : 'Pause Updates';
          });
          
          // Check connection status periodically
          setInterval(() => {
            if (lastTimestamp && (new Date() - lastTimestamp) > 10000) {
              connectionStatus.classList.add('disconnected');
              statusText.textContent = 'Disconnected';
            }
          }, 5000);
        </script>
      </body>
      </html>
    `;
    
    res.send(html);
  } catch (error) {
    console.error('Error serving logs:', error);
    res.status(500).send('Error retrieving logs');
  }
});

// Serve raw logs as text
app.get('/raw', (req, res) => {
  try {
    const logs = fs.readFileSync(LOG_FILE, 'utf8');
    res.setHeader('Content-Type', 'text/plain');
    res.send(logs);
  } catch (error) {
    console.error('Error serving raw logs:', error);
    res.status(500).send('Error retrieving logs');
  }
});

// Watch file for changes (backup method for updates)
fs.watchFile(LOG_FILE, (curr, prev) => {
  if (curr.size > prev.size) {
    // Get only the new content
    const newData = fs.readFileSync(LOG_FILE, 'utf8').slice(lastLogSize);
    lastLogSize = curr.size;
    
    // Notify all clients
    clients.forEach(client => {
      client.res.write(`data: ${JSON.stringify({ update: true, newData })}\n\n`);
    });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Log server running at http://localhost:${PORT}`);
  console.log(`Logs are being written to: ${LOG_FILE}`);
}); 