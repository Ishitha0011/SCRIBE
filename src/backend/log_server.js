const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

// Initialize Express app
const app = express();
const PORT = 9999;

// Configure paths
const LOG_DIR = path.join(__dirname, '../../logs');
const LOG_SOURCES = {
  worker: {
    file: path.join(LOG_DIR, 'worker.logs'),
    color: 'var(--source-worker)',
    icon: '⚙️',
    displayName: 'Worker'
  },
  system: {
    file: path.join(LOG_DIR, 'system.logs'),
    color: 'var(--source-system)',
    icon: '🖥️',
    displayName: 'System'
  },
  backend: {
    file: path.join(LOG_DIR, 'backend.logs'),
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

// ASCII art for SCRIBE
const SCRIBE_ASCII = `
███████╗ ██████╗██████╗ ██╗██████╗ ███████╗      
██╔════╝██╔════╝██╔══██╗██║██╔══██╗██╔════╝▄ ██╗▄
███████╗██║     ██████╔╝██║██████╔╝█████╗   ████╗
╚════██║██║     ██╔══██╗██║██╔══██╗██╔══╝  ▀╚██╔▀
███████║╚██████╗██║  ██║██║██████╔╝███████╗  ╚═╝ 
╚══════╝ ╚═════╝╚═╝  ╚═╝╚═╝╚═════╝ ╚══════╝      
`;


// Memory store configuration
const MAX_LOGS_PER_SOURCE = 5000;
const memoryLogs = {};

// Initialize Express middleware
app.use(cors());
app.use(express.json());

// Initialize memory logs and ensure log directory exists
function initializeLogSystem() {
  // Create logs directory if it doesn't exist
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }

  // Initialize memory logs for each source
  Object.keys(LOG_SOURCES).forEach(source => {
    memoryLogs[source] = [];
    
    // Create log file if it doesn't exist
    const logFile = LOG_SOURCES[source].file;
    if (!fs.existsSync(logFile)) {
      fs.writeFileSync(logFile, '');
    }
  });
}

// Log parsing and validation
function parseLogEntry(line, sourceName) {
  try {
    let logObject = typeof line === 'string' ? JSON.parse(line) : line;
    
    // Ensure required fields exist
    logObject = {
      timestamp: new Date().toISOString(),
      level: 'INFO',
      message: '',
      source: sourceName,
      ...logObject
    };

    // Validate and sanitize fields
    return {
      timestamp: logObject.timestamp,
      level: String(logObject.level || 'INFO').toUpperCase(),
      message: logObject.message,
      source: logObject.source || sourceName,
      ...logObject
    };
  } catch (error) {
    // Return a sanitized log object for unparseable entries
    return {
      timestamp: new Date().toISOString(),
      level: 'RAW',
      message: String(line),
      source: sourceName
    };
  }
}

// File operations
function readLogsFromFile(filePath, sourceName) {
  try {
    if (!fs.existsSync(filePath)) {
      return [];
    }

    const content = fs.readFileSync(filePath, 'utf8');
    return content
      .split('\n')
      .filter(line => line.trim())
      .map(line => parseLogEntry(line, sourceName));
  } catch (error) {
    console.error(`Error reading logs from ${filePath}:`, error);
    return [];
  }
}

function writeLogsToFile(filePath, logs) {
  try {
    const content = logs.map(log => JSON.stringify(log)).join('\n') + '\n';
    fs.writeFileSync(filePath, content);
    return true;
  } catch (error) {
    console.error(`Error writing logs to ${filePath}:`, error);
    return false;
  }
}

// Memory management
function addLogToMemory(source, log) {
  if (!memoryLogs[source]) {
    memoryLogs[source] = [];
  }
  
  memoryLogs[source].push(log);
  
  // Keep memory logs limited
  if (memoryLogs[source].length > MAX_LOGS_PER_SOURCE) {
    memoryLogs[source] = memoryLogs[source].slice(-MAX_LOGS_PER_SOURCE);
  }
}

// SSE client management
let sseClients = [];

function sendEventToClients(data) {
  const message = `data: ${JSON.stringify(data)}\n\n`;
  sseClients = sseClients.filter(client => {
    try {
      client.res.write(message);
      return true;
    } catch (error) {
      console.error('Error sending to client:', error);
      return false;
    }
  });
}

// Load logs from disk
function loadLogsFromDisk() {
  Object.entries(LOG_SOURCES).forEach(([source, config]) => {
    try {
      const logs = readLogsFromFile(config.file, source);
      memoryLogs[source] = logs.slice(-MAX_LOGS_PER_SOURCE);
    } catch (error) {
      console.error(`Failed to load logs for ${source}:`, error);
      memoryLogs[source] = [];
    }
  });
}

// API Routes

// Serve the log viewer HTML
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'log-viewer.html'));
});

// Serve ASCII art
app.get('/ascii', (req, res) => {
  res.type('text/plain').send(SCRIBE_ASCII);
});

// Main log ingestion endpoint
app.post('/log', (req, res) => {
  try {
    const { log, type = 'worker', application = null } = req.body;
    
    if (!log) {
      return res.status(400).json({ error: 'Log entry is required' });
    }
    
    // Determine the source type
    let sourceType = type.toLowerCase();
    
    // Map application-specific logs
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
    
    // Validate source type
    if (!LOG_SOURCES[sourceType]) {
      sourceType = 'worker'; // Default to worker if invalid source
    }
    
    // Parse and validate log entry
    const parsedLog = parseLogEntry(log, sourceType);
    
    // Store in memory
    addLogToMemory(sourceType, parsedLog);
    
    // Write to file
    const logEntry = JSON.stringify(parsedLog) + '\n';
    fs.appendFileSync(LOG_SOURCES[sourceType].file, logEntry);
    
    // Notify clients
    sendEventToClients({
      type: 'log',
      source: sourceType,
      payload: parsedLog
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
  
  // Send initial logs
  const initialLogs = {};
  Object.entries(memoryLogs).forEach(([source, logs]) => {
    initialLogs[source] = logs;
  });
  
  const client = {
    id: Date.now(),
    res,
    isAlive: true
  };
  
  sseClients.push(client);
  
  // Send initial data
  sendEventToClients({
    type: 'initial',
    payload: initialLogs
  });
  
  // Set up ping interval
  const pingInterval = setInterval(() => {
    if (!client.isAlive) {
      clearInterval(pingInterval);
      sseClients = sseClients.filter(c => c.id !== client.id);
      try {
        client.res.end();
      } catch (error) {
        console.error('Error closing dead client connection:', error);
      }
      return;
    }
    
    try {
      client.res.write('event: ping\ndata: ping\n\n');
      client.isAlive = false;
    } catch (error) {
      clearInterval(pingInterval);
      sseClients = sseClients.filter(c => c.id !== client.id);
    }
  }, 15000);
  
  // Handle client disconnect
  req.on('close', () => {
    clearInterval(pingInterval);
    sseClients = sseClients.filter(c => c.id !== client.id);
  });
});

// Clear logs endpoints
app.post('/api/logs/clear', (req, res) => {
  try {
    const { source } = req.body;
    
    if (!source || !LOG_SOURCES[source]) {
      return res.status(400).json({ error: 'Invalid source specified' });
    }
    
    // Clear memory logs
    memoryLogs[source] = [];
    
    // Clear log file
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

// Initialize and start server
function startServer() {
  initializeLogSystem();
  loadLogsFromDisk();
  
  app.listen(PORT, () => {
    console.log(`\n${SCRIBE_ASCII}\n`);
    console.log(`Log Server running at http://localhost:${PORT}`);
    console.log(`Watching log files in: ${LOG_DIR}`);
  });
}

startServer(); 