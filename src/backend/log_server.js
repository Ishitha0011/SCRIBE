const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const app = express();
const PORT = 9999;
const LOG_DIR = path.join(__dirname, '../../logs');
const WORKER_LOG_FILE = path.join(LOG_DIR, 'worker.logs');
const SYSTEM_LOG_FILE = path.join(LOG_DIR, 'system.logs');
const BACKEND_LOG_FILE = path.join(LOG_DIR, 'backend.logs');

// ASCII art for SCRIBE
const SCRIBE_ASCII = `
███████╗ ██████╗██████╗ ██╗██████╗ ███████╗      
██╔════╝██╔════╝██╔══██╗██║██╔══██╗██╔════╝▄ ██╗▄
███████╗██║     ██████╔╝██║██████╔╝█████╗   ████╗
╚════██║██║     ██╔══██╗██║██╔══██╗██╔══╝  ▀╚██╔▀
███████║╚██████╗██║  ██║██║██████╔╝███████╗  ╚═╝ 
╚══════╝ ╚═════╝╚═╝  ╚═╝╚═╝╚═════╝ ╚══════╝      
`;

// Define source-specific log configurations
const LOG_SOURCES = {
  worker: {
    file: WORKER_LOG_FILE,
    color: 'var(--source-worker)',
    icon: '⚙️',
    displayName: 'Worker'
  },
  system: {
    file: SYSTEM_LOG_FILE, 
    color: 'var(--source-system)',
    icon: '🖥️',
    displayName: 'System'
  },
  backend: {
    file: BACKEND_LOG_FILE,
    color: 'var(--source-backend)',
    icon: '🔧',
    displayName: 'Backend'
  },
  python: {
    file: path.join(LOG_DIR, 'python.logs'),
    color: 'var(--accent-purple)',
    icon: '🐍',
    displayName: 'Python'
  },
  nodejs: {
    file: path.join(LOG_DIR, 'nodejs.logs'),
    color: 'var(--accent-green)',
    icon: '📦',
    displayName: 'Node.js'  
  },
  filesystem: {
    file: path.join(LOG_DIR, 'filesystem.logs'),
    color: 'var(--accent-blue)',
    icon: '📂',
    displayName: 'File System'
  },
  supabase: {
    file: path.join(LOG_DIR, 'supabase.logs'),
    color: '#3ECF8E',
    icon: '📊',
    displayName: 'Supabase'
  }
};

// Ensure logs directory exists
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

// In-memory log storage
const MAX_LOGS_PER_SOURCE = 5000; // Maximum logs per source to keep in memory
const memoryLogs = {};

// Initialize memory logs for each source
Object.keys(LOG_SOURCES).forEach(source => {
  memoryLogs[source] = [];
});

// Load existing logs from files into memory on startup
function loadLogsFromDisk() {
  console.log('Loading logs from disk into memory...');
  Object.entries(LOG_SOURCES).forEach(([source, config]) => {
    try {
      const logs = readAndParseLogs(config.file);
      memoryLogs[source] = logs.slice(-MAX_LOGS_PER_SOURCE); // Keep only the latest logs
      console.log(`Loaded ${memoryLogs[source].length} logs for ${source}`);
    } catch (error) {
      console.error(`Failed to load logs for ${source}:`, error);
      memoryLogs[source] = [];
    }
  });
}

// Save in-memory logs to disk periodically
function persistMemoryLogsToDisk() {
  Object.entries(LOG_SOURCES).forEach(([source, config]) => {
    try {
      const logs = memoryLogs[source];
      if (logs.length > 0) {
        // Create a backup of the current log file
        const backupFile = `${config.file}.bak`;
        if (fs.existsSync(config.file)) {
          fs.copyFileSync(config.file, backupFile);
        }
        
        // Write logs to file
        const logsText = logs.map(log => JSON.stringify(log)).join('\n') + '\n';
        fs.writeFileSync(config.file, logsText);
      }
    } catch (error) {
      console.error(`Failed to persist logs for ${source}:`, error);
    }
  });
}

// Add a new log to memory
function addLogToMemory(source, log) {
  if (!memoryLogs[source]) {
    memoryLogs[source] = [];
  }
  
  memoryLogs[source].push(log);
  
  // Keep memory logs limited to max size
  if (memoryLogs[source].length > MAX_LOGS_PER_SOURCE) {
    memoryLogs[source] = memoryLogs[source].slice(-MAX_LOGS_PER_SOURCE);
  }
}

// Set up periodic log persistence
const PERSIST_INTERVAL = 15 * 60 * 1000; // 15 minutes
setInterval(persistMemoryLogsToDisk, PERSIST_INTERVAL);

// Load logs on startup
loadLogsFromDisk();

// Track clients for server-sent events
let clients = [];
let lastLogSizes = {};

// Initialize log sizes
Object.values(LOG_SOURCES).forEach(source => {
  try {
    lastLogSizes[path.basename(source.file, '.logs')] = fs.statSync(source.file).size;
  } catch (error) {
    console.error(`Error getting log size for ${source.file}:`, error);
    lastLogSizes[path.basename(source.file, '.logs')] = 0;
  }
});

// Enable CORS for all routes
app.use(cors());

// Parse JSON bodies
app.use(express.json());

// Function to send events to clients
const sendEventToClients = (data) => {
  const message = `data: ${JSON.stringify(data)}\n\n`;
  clients.forEach(client => {
    try {
      client.res.write(message);
    } catch (error) {
      console.error('Error sending to client:', error);
      // Remove failed client
      clients = clients.filter(c => c.id !== client.id);
    }
  });
};

// Function to read and parse logs
const readAndParseLogs = (filePath) => {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return content.split('\n')
      .filter(line => line.trim())
      .map(line => {
        try {
          return JSON.parse(line);
        } catch {
          return {
            level: 'RAW',
            message: line,
            timestamp: new Date().toISOString(),
            source: path.basename(filePath, '.logs')
          };
        }
      });
  } catch (error) {
    console.error(`Error reading logs from ${filePath}:`, error);
    return [];
  }
};

// Endpoint to write logs
app.post('/log', (req, res) => {
  try {
    const { log, type = 'worker', application = null } = req.body;
    
    if (!log) {
      return res.status(400).json({ error: 'Log entry is required' });
    }
    
    // Determine the source type
    let sourceType = type.toLowerCase();
    
    // Map application-specific logs to the right source
    if (application) {
      switch(application.toLowerCase()) {
        case 'python':
        case 'fastapi':
        case 'uvicorn':
          sourceType = 'python';
          break;
        case 'node':
        case 'express':
        case 'vite':
          sourceType = 'nodejs';
          break;
        case 'filesystem':
        case 'files':
          sourceType = 'filesystem';
          break;
        case 'supabase':
        case 'postgres':
        case 'database':
          sourceType = 'supabase';
          break;
      }
    }
    
    // Get the target file based on source type
    let targetFile;
    if (LOG_SOURCES[sourceType]) {
      targetFile = LOG_SOURCES[sourceType].file;
    } else {
      // Default to worker logs if source type is unknown
      targetFile = LOG_SOURCES.worker.file;
      sourceType = 'worker';
    }
    
    // Format the log entry with timestamp if not already present
    let logEntry;
    let parsedLog;
    
    if (typeof log === 'string') {
      try {
        parsedLog = JSON.parse(log);
        // Add timestamp if not present
        if (!parsedLog.timestamp) {
          parsedLog.timestamp = new Date().toISOString();
        }
        // Add source if not present
        if (!parsedLog.source) {
          parsedLog.source = sourceType;
        }
        // Stringify back to JSON
        logEntry = JSON.stringify(parsedLog) + '\n';
      } catch (e) {
        // Not JSON, create a new log entry
        parsedLog = {
          level: 'INFO',
          message: log,
          timestamp: new Date().toISOString(),
          source: sourceType
        };
        logEntry = JSON.stringify(parsedLog) + '\n';
      }
    } else {
      // Object log, add missing fields
      parsedLog = {
        level: log.level || 'INFO',
        message: log.message || JSON.stringify(log),
        timestamp: log.timestamp || new Date().toISOString(),
        source: sourceType,
        ...log
      };
      logEntry = JSON.stringify(parsedLog) + '\n';
    }
    
    // Store log in memory
    addLogToMemory(sourceType, parsedLog);
    
    // Append to log file
    fs.appendFileSync(targetFile, logEntry);
    
    // Notify clients about the new log entry
    try {
      sendEventToClients({ 
        type: 'log', 
        source: sourceType,
        payload: parsedLog
      });
    } catch (parseError) {
      console.error('Failed to parse log as JSON:', parseError);
      const rawLogEntry = {
        level: 'RAW',
        message: logEntry,
        timestamp: new Date().toISOString(),
        source: sourceType
      };
      
      // Store raw log in memory
      addLogToMemory(sourceType, rawLogEntry);
      
      sendEventToClients({ 
        type: 'raw_log', 
        source: sourceType,
        payload: rawLogEntry
      });
    }
    
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
  
  // Send initial logs from memory (much faster than reading from disk)
  try {
    const initialLogs = {};
    
    // Use memory logs instead of reading from disk
    Object.entries(memoryLogs).forEach(([source, logs]) => {
      initialLogs[source] = logs;
    });
    
    sendEventToClients({ type: 'initial', payload: initialLogs });
    console.log("Initial logs sent to new client.");
  } catch (readError) {
    console.error("Error sending initial logs:", readError);
  }
  
  // Keep track of this client
  const clientId = Date.now();
  const newClient = { 
    id: clientId, 
    res,
    lastPing: Date.now(),
    isAlive: true
  };
  clients.push(newClient);
  console.log(`Client connected: ${clientId}. Total clients: ${clients.length}`);
  
  // Heartbeat ping to keep connection alive
  const intervalId = setInterval(() => {
    if (!newClient.isAlive) {
      clearInterval(intervalId);
      clients = clients.filter(client => client.id !== clientId);
      try {
        newClient.res.end();
      } catch (error) {
        console.error('Error closing dead client connection:', error);
      }
      return;
    }
    
    try {
      newClient.res.write('event: ping\ndata: ping\n\n');
      newClient.isAlive = false; // Will be set to true when pong is received
    } catch (error) {
      console.error('Error sending ping:', error);
      clearInterval(intervalId);
      clients = clients.filter(client => client.id !== clientId);
    }
  }, 15000); // Send ping every 15 seconds
  
  // Handle client pong
  req.on('close', () => {
    clearInterval(intervalId);
    clients = clients.filter(client => client.id !== clientId);
    console.log(`Client disconnected: ${clientId}. Total clients: ${clients.length}`);
  });
});

// Serve logs as HTML
app.get('/', (req, res) => {
  try {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>System Logs - SCRIBE</title>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
        <style>
          :root {
            /* Core theme colors */
            --bg-primary: #0A0A0A;
            --bg-secondary: #141414;
            --bg-tertiary: #1E1E1E;
            --text-primary: #FFFFFF;
            --text-secondary: rgba(255, 255, 255, 0.7);
            --text-tertiary: rgba(255, 255, 255, 0.5);
            
            /* Accent colors */
            --accent-blue: #2196F3;
            --accent-green: #4CAF50;
            --accent-amber: #FFC107;
            --accent-red: #F44336;
            --accent-purple: #9C27B0;
            
            /* Source colors */
            --source-worker: var(--accent-green);
            --source-system: var(--accent-amber);
            --source-backend: var(--accent-blue);
            
            /* Level colors */
            --level-error: var(--accent-red);
            --level-warning: var(--accent-amber);
            --level-info: var(--accent-blue);
            --level-debug: var(--accent-purple);
            
            /* UI elements */
            --border-color: rgba(255, 255, 255, 0.1);
            --hover-bg: rgba(255, 255, 255, 0.05);
            --active-bg: rgba(255, 255, 255, 0.1);
            --shadow-color: rgba(0, 0, 0, 0.5);
            
            /* Dimensions */
            --header-height: 60px;
            --tab-height: 40px;
            --footer-height: 50px;
            --border-radius: 8px;
            --button-radius: 6px;
            
            /* Add source-specific colors */
            --source-python: var(--accent-purple);
            --source-nodejs: var(--accent-green);
            --source-filesystem: var(--accent-blue);
            --source-supabase: #3ECF8E;
          }
          
          * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
          }
          
          body {
            background-color: var(--bg-primary);
            color: var(--text-primary);
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
            -webkit-font-smoothing: antialiased;
            line-height: 1.5;
            overflow: hidden;
            height: 100vh;
            display: flex;
            flex-direction: column;
          }
          
          header {
            height: var(--header-height);
            background-color: var(--bg-secondary);
            border-bottom: 1px solid var(--border-color);
            display: flex;
            align-items: center;
            padding: 0 24px;
            position: relative;
            z-index: 10;
            box-shadow: 0 1px 2px var(--shadow-color);
          }
          
          .header-content {
            display: flex;
            align-items: center;
            justify-content: space-between;
            width: 100%;
            max-width: 1400px;
            margin: 0 auto;
          }
          
          .ascii-art {
            color: var(--accent-blue);
            font-size: 10px;
            line-height: 1;
            white-space: pre;
            font-family: 'JetBrains Mono', monospace;
          }
          
          .status-bar {
            background-color: var(--bg-tertiary);
            padding: 8px 24px;
            font-size: 13px;
            color: var(--text-secondary);
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 1px solid var(--border-color);
          }
          
          .connection-status {
            display: flex;
            align-items: center;
            gap: 8px;
          }
          
          .status-indicator {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background-color: var(--level-error);
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          }
          
          .status-indicator.connected {
            background-color: var(--accent-green);
            box-shadow: 0 0 8px rgba(76, 175, 80, 0.5);
          }
          
          .status-indicator.reconnecting {
            background-color: var(--accent-amber);
            animation: pulse 1.5s infinite cubic-bezier(0.4, 0, 0.2, 1);
          }
          
          .tabs {
            height: var(--tab-height);
            background: var(--bg-secondary);
            padding: 0 24px;
            display: flex;
            align-items: center;
            gap: 2px;
            overflow-x: auto;
            scrollbar-width: none;
            -ms-overflow-style: none;
          }
          
          .tabs::-webkit-scrollbar {
            display: none;
          }
          
          .tab {
            height: 100%;
            padding: 0 20px;
            display: flex;
            align-items: center;
            gap: 8px;
            color: var(--text-secondary);
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            border-bottom: 2px solid transparent;
            transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
            white-space: nowrap;
          }
          
          .tab:hover {
            color: var(--text-primary);
            background: var(--hover-bg);
          }
          
          .tab.active {
            color: var(--text-primary);
            border-bottom-color: var(--accent-blue);
          }
          
          .source-indicator {
            width: 10px;
            height: 10px;
            border-radius: 50%;
            transition: all 0.2s ease;
          }
          
          .source-worker .source-indicator { background-color: var(--source-worker); }
          .source-system .source-indicator { background-color: var(--source-system); }
          .source-backend .source-indicator { background-color: var(--source-backend); }
          
          .source-python .source-indicator { background-color: var(--source-python); }
          .source-nodejs .source-indicator { background-color: var(--source-nodejs); }
          .source-filesystem .source-indicator { background-color: var(--source-filesystem); }
          .source-supabase .source-indicator { background-color: var(--source-supabase); }
          
          .container {
            flex: 1;
            overflow: hidden;
            display: flex;
            flex-direction: column;
            background: var(--bg-primary);
            position: relative;
          }
          
          .terminal {
            flex: 1;
            overflow-y: auto;
            padding: 16px 24px;
            font-family: 'JetBrains Mono', monospace;
            font-size: 13px;
            line-height: 1.6;
            position: relative;
          }
          
          .terminal::-webkit-scrollbar {
            width: 12px;
            height: 12px;
          }
          
          .terminal::-webkit-scrollbar-track {
            background: var(--bg-secondary);
          }
          
          .terminal::-webkit-scrollbar-thumb {
            background: var(--bg-tertiary);
            border: 3px solid var(--bg-secondary);
            border-radius: 6px;
          }
          
          .terminal::-webkit-scrollbar-thumb:hover {
            background: var(--active-bg);
          }
          
          .log-entry {
            padding: 8px 12px;
            margin: 4px 0;
            border-radius: var(--border-radius);
            background: var(--bg-secondary);
            display: grid;
            grid-template-columns: 160px 80px 120px 1fr;
            gap: 12px;
            align-items: start;
            transition: all 0.2s ease;
            border-left: 3px solid transparent;
          }
          
          .log-entry:hover {
            background: var(--bg-tertiary);
            transform: translateX(2px);
          }
          
          .source-worker { border-left-color: var(--source-worker); }
          .source-system { border-left-color: var(--source-system); }
          .source-backend { border-left-color: var(--source-backend); }
          
          .source-python { border-left-color: var(--source-python); }
          .source-nodejs { border-left-color: var(--source-nodejs); }
          .source-filesystem { border-left-color: var(--source-filesystem); }
          .source-supabase { border-left-color: var(--source-supabase); }
          
          .timestamp {
            color: var(--text-secondary);
            font-size: 12px;
          }
          
          .level {
            font-weight: 500;
            text-transform: uppercase;
            font-size: 12px;
            padding: 2px 8px;
            border-radius: 4px;
            text-align: center;
          }
          
          .level-ERROR {
            color: var(--level-error);
            background: rgba(244, 67, 54, 0.1);
          }
          
          .level-WARNING {
            color: var(--level-warning);
            background: rgba(255, 193, 7, 0.1);
          }
          
          .level-INFO {
            color: var(--level-info);
            background: rgba(33, 150, 243, 0.1);
          }
          
          .level-DEBUG {
            color: var(--level-debug);
            background: rgba(156, 39, 176, 0.1);
          }
          
          .source {
            color: var(--text-secondary);
            font-size: 12px;
          }
          
          .message {
            color: var(--text-primary);
            word-break: break-word;
          }
          
          .message pre {
            margin: 8px 0;
            padding: 12px;
            background: var(--bg-tertiary);
            border-radius: var(--button-radius);
            overflow-x: auto;
            font-size: 12px;
          }
          
          .message pre::-webkit-scrollbar {
            height: 8px;
          }
          
          .error-stack {
            color: var(--level-error);
            background: rgba(244, 67, 54, 0.05);
            padding: 12px;
            border-radius: var(--button-radius);
            border-left: 2px solid var(--level-error);
          }
          
          footer {
            height: var(--footer-height);
            background: var(--bg-secondary);
            border-top: 1px solid var(--border-color);
            padding: 0 24px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 16px;
            position: relative;
            z-index: 10;
          }
          
          .footer-controls {
            display: flex;
            gap: 16px;
            align-items: center;
            flex: 1;
          }
          
          .search-container {
            position: relative;
            flex: 1;
            max-width: 400px;
          }
          
          #filter-input {
            width: 100%;
            height: 36px;
            background: var(--bg-tertiary);
            border: 1px solid var(--border-color);
            border-radius: var(--button-radius);
            color: var(--text-primary);
            padding: 0 36px 0 12px;
            font-family: inherit;
            font-size: 14px;
            transition: all 0.2s ease;
          }
          
          #filter-input:focus {
            outline: none;
            border-color: var(--accent-blue);
            box-shadow: 0 0 0 2px rgba(33, 150, 243, 0.2);
          }
          
          #clear-filter-btn {
            position: absolute;
            right: 8px;
            top: 50%;
            transform: translateY(-50%);
            background: none;
            border: none;
            color: var(--text-tertiary);
            cursor: pointer;
            padding: 4px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s ease;
          }
          
          #clear-filter-btn:hover {
            color: var(--text-primary);
            background: var(--hover-bg);
          }
          
          .button-group {
            display: flex;
            gap: 2px;
            background: var(--bg-tertiary);
            padding: 2px;
            border-radius: var(--button-radius);
          }
          
          button {
            height: 32px;
            padding: 0 12px;
            background: none;
            border: none;
            color: var(--text-secondary);
            font-family: inherit;
            font-size: 13px;
            font-weight: 500;
            cursor: pointer;
            border-radius: 4px;
            transition: all 0.2s ease;
            display: flex;
            align-items: center;
            gap: 6px;
            white-space: nowrap;
          }
          
          button:hover {
            color: var(--text-primary);
            background: var(--hover-bg);
          }
          
          button.active {
            color: var(--text-primary);
            background: var(--active-bg);
          }
          
          .stats {
            display: flex;
            align-items: center;
            gap: 16px;
            color: var(--text-secondary);
            font-size: 13px;
          }
          
          @keyframes pulse {
            0% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.5; transform: scale(0.95); }
            100% { opacity: 1; transform: scale(1); }
          }
          
          .hidden { display: none !important; }
          
          /* Responsive adjustments */
          @media (max-width: 1200px) {
            .log-entry {
              grid-template-columns: 140px 70px 100px 1fr;
              gap: 8px;
            }
          }
          
          @media (max-width: 768px) {
            .log-entry {
              grid-template-columns: 1fr;
              gap: 4px;
            }
            
            .timestamp, .level, .source {
              font-size: 11px;
            }
            
            .footer-controls {
              flex-wrap: wrap;
            }
          }
          
          .log-note {
            background: var(--bg-tertiary);
            color: var(--text-secondary);
            padding: 8px 12px;
            text-align: center;
            font-style: italic;
            margin: 8px 0;
            border-left: 3px solid var(--accent-amber);
          }
          
          .action-button {
            height: 32px;
            padding: 0 12px;
            background: var(--active-bg);
            border: none;
            color: var(--text-primary);
            font-family: inherit;
            font-size: 13px;
            font-weight: 500;
            cursor: pointer;
            border-radius: 4px;
            transition: all 0.2s ease;
            display: flex;
            align-items: center;
            gap: 6px;
            white-space: nowrap;
          }
          
          .action-button:hover {
            background: var(--accent-blue);
          }
          
          .keyboard-shortcut {
            font-size: 11px;
            padding: 1px 5px;
            border-radius: 3px;
            background: var(--bg-tertiary);
            color: var(--text-secondary);
            margin-left: 6px;
          }
        </style>
      </head>
      <body>
        <header>
          <div class="header-content">
          <div class="ascii-art">${SCRIBE_ASCII}</div>
          <div class="connection-status">
            <span class="status-indicator"></span>
              <span class="status-text">Connecting...</span>
              <span class="reconnect-count"></span>
          </div>
        </div>
        </header>
        
        <div class="status-bar">
          <div class="stats">
            <span id="log-count">0 logs</span>
            <span id="last-update"></span>
          </div>
        </div>
        
        <div class="tabs">
          <div class="tab active" data-source="all">
            All Logs
          </div>
          <div class="tab source-worker" data-source="worker">
            <span class="source-indicator"></span>
            <span>⚙️ Worker</span>
          </div>
          <div class="tab source-system" data-source="system">
            <span class="source-indicator"></span>
            <span>🖥️ System</span>
          </div>
          <div class="tab source-backend" data-source="backend">
            <span class="source-indicator"></span>
            <span>🔧 Backend</span>
          </div>
          <div class="tab source-python" data-source="python">
            <span class="source-indicator"></span>
            <span>🐍 Python</span>
          </div>
          <div class="tab source-nodejs" data-source="nodejs">
            <span class="source-indicator"></span>
            <span>📦 Node.js</span>
          </div>
          <div class="tab source-filesystem" data-source="filesystem">
            <span class="source-indicator"></span>
            <span>📂 File System</span>
          </div>
          <div class="tab source-supabase" data-source="supabase">
            <span class="source-indicator"></span>
            <span>📊 Supabase</span>
          </div>
        </div>
        
        <div class="container">
          <div id="terminal" class="terminal"></div>
        </div>
        
        <footer>
          <div class="footer-controls">
            <div class="search-container">
              <input type="text" id="filter-input" placeholder="Filter logs...">
              <button id="clear-filter-btn" title="Clear filter">×</button>
          </div>
            
            <div class="button-group">
              <button class="level-filter active" data-level="all">All Levels</button>
              <button class="level-filter" data-level="ERROR">Errors</button>
              <button class="level-filter" data-level="WARNING">Warnings</button>
              <button class="level-filter" data-level="INFO">Info</button>
              <button class="level-filter" data-level="DEBUG">Debug</button>
            </div>
            
            <div class="button-group">
              <button id="clear-btn" title="Clear logs">Clear</button>
              <button id="download-btn" title="Download logs">Download</button>
              <button id="scroll-lock-btn">Scroll Lock: OFF</button>
            </div>
          </div>
        </footer>
        
        <script>
          const terminal = document.getElementById('terminal');
          const filterInput = document.getElementById('filter-input');
          const clearFilterBtn = document.getElementById('clear-filter-btn');
          const clearBtn = document.getElementById('clear-btn');
          const downloadBtn = document.getElementById('download-btn');
          const scrollLockBtn = document.getElementById('scroll-lock-btn');
          const lastUpdateEl = document.getElementById('last-update');
          const statusText = document.querySelector('.status-text');
          const statusIndicator = document.querySelector('.status-indicator');
          const reconnectCountEl = document.querySelector('.reconnect-count');
          const logCountEl = document.getElementById('log-count');
          
          let isScrollLocked = false;
          let currentFilter = '';
          let currentSource = 'all';
          let currentLevel = 'all';
          let evtSource = null;
          let reconnectAttempts = 0;
          let reconnectTimer;
          let logs = [];
          let initialLoadComplete = false;
          
          // Initialize tabs
          document.querySelectorAll('.tab').forEach(tab => {
            tab.addEventListener('click', () => {
              document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
              tab.classList.add('active');
              currentSource = tab.dataset.source;
              applyFilters();
            });
          });
          
          // Initialize level filters
          document.querySelectorAll('.level-filter').forEach(btn => {
            btn.addEventListener('click', () => {
              document.querySelectorAll('.level-filter').forEach(b => b.classList.remove('active'));
              btn.classList.add('active');
              currentLevel = btn.dataset.level;
              applyFilters();
            });
          });
          
          function connectSSE() {
            if (evtSource) {
              evtSource.close();
            }
            
            updateConnectionStatus('connecting');
            
            evtSource = new EventSource('/sse');
            
            evtSource.onopen = function() {
              console.log("SSE connection opened");
              updateConnectionStatus('connected');
              reconnectAttempts = 0;
              reconnectCountEl.textContent = '';
            };
            
            evtSource.addEventListener('ping', function(event) {
              // Send pong back to server
              fetch('/pong', { method: 'POST' }).catch(console.error);
            });
            
            evtSource.onmessage = function(event) {
            const data = JSON.parse(event.data);
            
              if (data.type === 'initial') {
                logs = [];
                Object.entries(data.payload).forEach(([source, sourceLogs]) => {
                  logs.push(...sourceLogs.map(log => ({ ...log, source })));
                });
                
                // Sort logs by timestamp
                logs.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
                
                renderLogs();
                initialLoadComplete = true;
                lastUpdateEl.textContent = 'Initial load complete';
              } else if (data.type === 'log' || data.type === 'raw_log') {
                const log = data.type === 'log' ? data.payload : {
                  level: 'RAW',
                  message: data.payload,
                  timestamp: new Date().toISOString(),
                  source: data.source
                };
                
                logs.push(log);
                appendLog(log);
                
                if (!isScrollLocked) {
              scrollToBottom();
                }
              } else if (data.type === 'logs_cleared') {
                // Handle logs cleared for specific source
                logs = logs.filter(log => log.source !== data.source);
                renderLogs();
                lastUpdateEl.textContent = \`Logs cleared for \${data.source}\`;
              } else if (data.type === 'all_logs_cleared') {
                // Handle all logs cleared
                logs = [];
                renderLogs();
                lastUpdateEl.textContent = 'All logs cleared';
              }
              
              updateStats();
              if (data.type !== 'initial') {
                lastUpdateEl.textContent = 'Updated: ' + new Date().toLocaleTimeString();
              }
            };
            
            evtSource.onerror = function(err) {
              console.error("SSE error:", err);
              updateConnectionStatus('disconnected');
              evtSource.close();
              
              // Exponential backoff for reconnection
              const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
              reconnectAttempts++;
              
              clearTimeout(reconnectTimer);
              reconnectTimer = setTimeout(connectSSE, delay);
              
              reconnectCountEl.textContent = \`(Attempt \${reconnectAttempts})\`;
            };
          }
          
          function updateConnectionStatus(status) {
            statusIndicator.className = 'status-indicator';
            switch(status) {
              case 'connected':
                statusIndicator.classList.add('connected');
                statusText.textContent = 'Connected';
                break;
              case 'disconnected':
                statusText.textContent = 'Disconnected. Retrying...';
                break;
              case 'connecting':
                statusIndicator.classList.add('reconnecting');
                statusText.textContent = 'Connecting...';
                break;
            }
          }
          
          function updateStats() {
            const visibleLogs = Array.from(terminal.children).filter(el => !el.classList.contains('hidden')).length;
            const totalLogs = logs.length;
            logCountEl.textContent = \`\${visibleLogs}/\${totalLogs} logs\`;
          }
          
          function formatMessage(message) {
            if (typeof message === 'object') {
              // Check if it's an error object or has error-like properties
              if (message.stack || (message.name && message.message)) {
                return \`<pre class="error-stack">\${message.name || 'Error'}: \${message.message || ''}\\n\${message.stack || ''}</pre>\`;
              }
              // Regular object
              return '<pre>' + JSON.stringify(message, null, 2) + '</pre>';
            }
            
            // Check if it's a JSON string and try to pretty-print it
            if (typeof message === 'string') {
              try {
                const parsedJson = JSON.parse(message);
                return '<pre>' + JSON.stringify(parsedJson, null, 2) + '</pre>';
              } catch (e) {
                // Not JSON, return as is
              }
            }
            
            return message;
          }
          
          function appendLog(log) {
            const logElement = document.createElement('div');
            logElement.className = \`log-entry source-\${log.source}\`;
            logElement.dataset.timestamp = new Date(log.timestamp).getTime();
            
            const timestamp = new Date(log.timestamp).toLocaleString();
            const level = log.level?.toUpperCase() || 'UNKNOWN';
            const message = formatMessage(log.message);
            const source = log.source || 'unknown';
            
            logElement.innerHTML = \`
              <span class="timestamp">\${timestamp}</span>
              <span class="level level-\${level}">\${level}</span>
              <span class="source">[\${source}]</span>
              <span class="message">\${message}</span>
            \`;
            
            // Apply current filters
            if (!shouldShowLog(log)) {
              logElement.classList.add('hidden');
            }
            
            terminal.appendChild(logElement);
            updateStats();
          }
          
          function shouldShowLog(log) {
            // Source filter
            if (currentSource !== 'all' && log.source !== currentSource) {
              return false;
            }
            
            // Level filter
            if (currentLevel !== 'all' && log.level?.toUpperCase() !== currentLevel) {
              return false;
            }
            
            // Text filter
            if (currentFilter) {
              const searchText = JSON.stringify(log).toLowerCase();
              return searchText.includes(currentFilter.toLowerCase());
            }
            
            return true;
          }
          
          function renderLogs() {
            terminal.innerHTML = '';
            
            // Sort logs by timestamp if not already sorted
            logs.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
            
            // Apply limit to prevent browser slowdown with too many logs
            const MAX_VISIBLE_LOGS = 2000;
            const logsToRender = logs.length > MAX_VISIBLE_LOGS 
              ? logs.slice(logs.length - MAX_VISIBLE_LOGS) 
              : logs;
            
            if (logs.length > MAX_VISIBLE_LOGS) {
              const note = document.createElement('div');
              note.className = 'log-entry log-note';
              note.innerHTML = \`<span class="message">Note: \${logs.length - MAX_VISIBLE_LOGS} older logs are not shown for performance.</span>\`;
              terminal.appendChild(note);
            }
            
            logsToRender.forEach(log => appendLog(log));
            
            if (!isScrollLocked) {
              scrollToBottom();
            }
          }
          
          function applyFilters() {
            Array.from(terminal.children).forEach(logElement => {
              if (logElement.classList.contains('log-note')) return;
              
              const log = {
                timestamp: logElement.querySelector('.timestamp').textContent,
                level: logElement.querySelector('.level').textContent,
                source: logElement.querySelector('.source').textContent.replace(/[\\[\\]]/g, ''),
                message: logElement.querySelector('.message').textContent
              };
              
              logElement.classList.toggle('hidden', !shouldShowLog(log));
            });
            
            updateStats();
            
            if (!isScrollLocked) {
              scrollToBottom();
            }
          }
          
          function scrollToBottom() {
            terminal.scrollTop = terminal.scrollHeight;
          }
          
          // Clear logs action - sends request to server
          function clearLogs(source = null) {
            const endpoint = source ? '/api/logs/clear' : '/api/logs/clear-all';
            const body = source ? JSON.stringify({ source }) : '';
            
            fetch(endpoint, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: body
            })
            .then(response => response.json())
            .then(data => {
              if (data.success) {
                // Will be handled by SSE event
                console.log(source ? \`Cleared logs for \${source}\` : 'Cleared all logs');
              } else {
                console.error('Failed to clear logs:', data.error);
              }
            })
            .catch(error => {
              console.error('Error clearing logs:', error);
            });
          }
          
          // Event Listeners
          filterInput.addEventListener('input', () => {
            currentFilter = filterInput.value;
            applyFilters();
          });
          
          clearFilterBtn.addEventListener('click', () => {
            filterInput.value = '';
            currentFilter = '';
            applyFilters();
          });
          
          clearBtn.addEventListener('click', () => {
            // Show confirmation dialog
            if (confirm('Are you sure you want to clear all logs? This cannot be undone.')) {
              if (currentSource === 'all') {
                clearLogs(); // Clear all logs
              } else {
                clearLogs(currentSource); // Clear logs for current source
              }
            }
          });
          
          scrollLockBtn.addEventListener('click', () => {
            isScrollLocked = !isScrollLocked;
            scrollLockBtn.textContent = 'Scroll Lock: ' + (isScrollLocked ? 'ON' : 'OFF');
            scrollLockBtn.classList.toggle('active', isScrollLocked);
            if (!isScrollLocked) {
              scrollToBottom();
            }
          });
          
          // Add keyboard shortcuts
          document.addEventListener('keydown', (e) => {
            // Ctrl+K to clear current view
            if (e.ctrlKey && e.key === 'k') {
              e.preventDefault();
              if (currentSource === 'all') {
                // Just ask for confirmation for clearing all logs
                if (confirm('Are you sure you want to clear all logs? This cannot be undone.')) {
                  clearLogs();
                }
              } else {
                clearLogs(currentSource);
              }
            }
            
            // Ctrl+F to focus search
            if (e.ctrlKey && e.key === 'f') {
              e.preventDefault();
              filterInput.focus();
            }
            
            // Escape to clear filter
            if (e.key === 'Escape' && document.activeElement === filterInput) {
              filterInput.value = '';
              currentFilter = '';
              applyFilters();
              filterInput.blur();
            }
          });
          
          // Initial connection
          connectSSE();
          
          // Keep-alive mechanism
          setInterval(() => {
            if (evtSource && evtSource.readyState === EventSource.OPEN) {
              fetch('/ping', { method: 'POST' }).catch(console.error);
            }
          }, 30000);
          
          // Function to download logs
          function downloadLogs() {
            // Get the logs to download based on current filter
            const filteredLogs = logs.filter(log => {
              if (currentSource !== 'all' && log.source !== currentSource) {
                return false;
              }
              
              if (currentLevel !== 'all' && log.level?.toUpperCase() !== currentLevel) {
                return false;
              }
              
              if (currentFilter) {
                const searchText = JSON.stringify(log).toLowerCase();
                return searchText.includes(currentFilter.toLowerCase());
              }
              
              return true;
            });
            
            // Create the content
            let content;
            
            // Ask user if they want JSON or plain text
            const format = confirm('Download as JSON? Click OK for JSON, Cancel for plain text.') ? 'json' : 'txt';
            
            if (format === 'json') {
              content = JSON.stringify(filteredLogs, null, 2);
            } else {
              // Plain text format
              content = filteredLogs.map(log => {
                const timestamp = new Date(log.timestamp).toLocaleString();
                const level = log.level?.toUpperCase() || 'UNKNOWN';
                const source = log.source || 'unknown';
                const message = typeof log.message === 'object' ? JSON.stringify(log.message) : log.message;
                
                return \`[${timestamp}] [${level}] [${source}] ${message}\`;
              }).join('\n');
            }
            
            // Create and trigger download
            const blob = new Blob([content], { type: format === 'json' ? 'application/json' : 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            
            // Create filename with current date
            const date = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
            const source = currentSource === 'all' ? 'all-sources' : currentSource;
            const level = currentLevel === 'all' ? 'all-levels' : currentLevel;
            
            a.href = url;
            a.download = \`scribe-logs-${source}-${level}-${date}.${format}\`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
          }
          
          // Event Listeners
          downloadBtn.addEventListener('click', downloadLogs);
        </script>
      </body>
      </html>
    `;
    
    res.send(html);
  } catch (error) {
    console.error('Error serving logs page:', error);
    res.status(500).send('Error retrieving logs page');
  }
});

// Ping endpoint to keep connection alive
app.post('/ping', (req, res) => {
  res.status(200).send('pong');
});

// Pong endpoint for client responses
app.post('/pong', (req, res) => {
  const clientId = req.headers['client-id'];
  if (clientId) {
    const client = clients.find(c => c.id === parseInt(clientId));
    if (client) {
      client.isAlive = true;
      client.lastPing = Date.now();
    }
  }
  res.status(200).send('ok');
});

// Serve raw logs as text
app.get('/raw', (req, res) => {
  try {
    const { source = 'worker' } = req.query;
    let targetFile;
    
    switch(source.toLowerCase()) {
      case 'system':
        targetFile = SYSTEM_LOG_FILE;
        break;
      case 'backend':
        targetFile = BACKEND_LOG_FILE;
        break;
      default:
        targetFile = WORKER_LOG_FILE;
    }
    
    const logs = fs.readFileSync(targetFile, 'utf8');
    res.setHeader('Content-Type', 'text/plain');
    res.send(logs);
  } catch (error) {
    console.error('Error serving raw logs:', error);
    res.status(500).send('Error retrieving logs');
  }
});

// Serve logs as JSON
app.get('/api/logs', async (req, res) => {
  try {
    const source = req.query.source;
    const limit = parseInt(req.query.limit) || 100;
    const level = req.query.level;
    
    let logs = [];
    
    if (source && source !== 'all' && LOG_SOURCES[source]) {
      // Get logs from a specific source
      logs = readAndParseLogs(LOG_SOURCES[source].file);
    } else {
      // Get logs from all sources
      Object.entries(LOG_SOURCES).forEach(([srcName, config]) => {
        const sourceLogs = readAndParseLogs(config.file);
        logs.push(...sourceLogs.map(log => ({ ...log, source: srcName })));
      });
    }
    
    // Filter by level if specified
    if (level && level !== 'all') {
      logs = logs.filter(log => log.level?.toUpperCase() === level.toUpperCase());
    }
    
    // Sort by timestamp (recent first)
    logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    // Limit the number of logs
    if (limit > 0) {
      logs = logs.slice(0, limit);
    }
    
    res.json({ logs });
  } catch (error) {
    console.error('Error serving logs as JSON:', error);
    res.status(500).json({ error: 'Failed to retrieve logs' });
  }
});

// Clear logs for a specific source
app.post('/api/logs/clear', (req, res) => {
  try {
    const { source } = req.body;
    
    if (!source || !LOG_SOURCES[source]) {
      return res.status(400).json({ error: 'Invalid source specified' });
    }
    
    // Clear memory logs
    memoryLogs[source] = [];
    
    // Clear log file (create empty file)
    fs.writeFileSync(LOG_SOURCES[source].file, `--- Logs Cleared: ${new Date().toISOString()} ---\n`);
    
    // Notify clients
    sendEventToClients({ 
      type: 'logs_cleared', 
      source: source 
    });
    
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error clearing logs:', error);
    return res.status(500).json({ error: 'Failed to clear logs' });
  }
});

// Clear all logs
app.post('/api/logs/clear-all', (req, res) => {
  try {
    // Clear all memory logs
    Object.keys(memoryLogs).forEach(source => {
      memoryLogs[source] = [];
    });
    
    // Clear all log files
    Object.entries(LOG_SOURCES).forEach(([source, config]) => {
      fs.writeFileSync(config.file, `--- Logs Cleared: ${new Date().toISOString()} ---\n`);
    });
    
    // Notify clients
    sendEventToClients({ type: 'all_logs_cleared' });
    
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error clearing all logs:', error);
    return res.status(500).json({ error: 'Failed to clear all logs' });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`\n${SCRIBE_ASCII}\n`);
  console.log(`Enhanced Log Server running at http://localhost:${PORT}`);
  console.log(`Watching log files in: ${LOG_DIR}`);
}); 