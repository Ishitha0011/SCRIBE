import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';

// Get the directory path of the current module
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOG_SERVER_URL = 'http://localhost:9999/log';
const LOG_DIR = path.join(__dirname, '..', 'logs');

// Ensure logs directory exists
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

// Log levels with priority
const LOG_LEVELS = {
  ERROR: 0,
  WARNING: 1,
  INFO: 2,
  DEBUG: 3
};

/**
 * Creates a logger instance
 * @param {string} source - The source of the logs (nodejs, filesystem, supabase, etc.)
 * @param {string} application - The specific application name
 * @param {string} level - The minimum log level to record
 * @returns {object} - The logger instance
 */
export function createLogger(source = 'nodejs', application = null, level = 'INFO') {
  // Normalize source and validate
  const normalizedSource = source.toLowerCase();
  const logFilePath = path.join(LOG_DIR, `${normalizedSource}.logs`);
  
  // Create log file if it doesn't exist
  if (!fs.existsSync(logFilePath)) {
    fs.writeFileSync(logFilePath, `--- Log File Created: ${new Date().toISOString()} ---\n`);
  }
  
  // Get minimum log level
  const minLevel = LOG_LEVELS[level.toUpperCase()] || LOG_LEVELS.INFO;
  
  // Common log function
  function log(level, ...args) {
    const levelUpper = level.toUpperCase();
    if (LOG_LEVELS[levelUpper] > minLevel) return; // Skip if below minimum level
    
    // Process arguments
    let message = '';
    let details = {};
    
    if (args.length === 1) {
      if (typeof args[0] === 'object' && args[0] !== null) {
        message = args[0].message || JSON.stringify(args[0]);
        details = { ...args[0] };
      } else {
        message = String(args[0]);
      }
    } else if (args.length > 1) {
      // First arg is message, rest are details
      message = String(args[0]);
      
      // Combine remaining args
      if (typeof args[1] === 'object' && args[1] !== null) {
        details = { ...args[1] };
      }
      
      // Add any additional args
      for (let i = 2; i < args.length; i++) {
        if (typeof args[i] === 'object' && args[i] !== null) {
          details = { ...details, ...args[i] };
        } else {
          message += ' ' + String(args[i]);
        }
      }
    }
    
    // Get stack trace for errors
    let stack = null;
    if (level.toUpperCase() === 'ERROR') {
      const stackObj = {};
      Error.captureStackTrace(stackObj);
      stack = stackObj.stack;
    }
    
    // Format the log entry
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level: levelUpper,
      message,
      source: normalizedSource,
      application: application || normalizedSource,
      ...details
    };
    
    if (stack) {
      logEntry.stack = stack;
    }
    
    // Convert to string for file logging
    const logString = JSON.stringify(logEntry) + '\n';
    
    // Write to file
    try {
      fs.appendFileSync(logFilePath, logString);
    } catch (err) {
      console.error(`Failed to write to log file: ${err.message}`);
    }
    
    // Send to log server
    try {
      fetch(LOG_SERVER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          log: logEntry,
          type: normalizedSource,
          application: application || normalizedSource
        }),
        timeout: 500
      }).catch(err => {
        // Silent fail, already logging to file
      });
    } catch (err) {
      // Silently fail for network errors
    }
    
    // Also log to console
    const consoleMethod = levelUpper === 'ERROR' ? 'error' : 
                          levelUpper === 'WARNING' ? 'warn' : 
                          levelUpper === 'DEBUG' ? 'debug' : 'log';
    console[consoleMethod](`[${timestamp}] [${levelUpper}] [${normalizedSource}]`, message, details);
  }
  
  // Return logger interface
  return {
    error: (...args) => log('ERROR', ...args),
    warn: (...args) => log('WARNING', ...args),
    warning: (...args) => log('WARNING', ...args),
    info: (...args) => log('INFO', ...args),
    debug: (...args) => log('DEBUG', ...args),
    log: (level, ...args) => log(level, ...args)
  };
}

// Create default logger
export default createLogger(); 