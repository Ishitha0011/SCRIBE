import API_BASE_URL from './config';

// Default log server URL
const LOG_SERVER_URL = 'http://localhost:9999/log';

// Log levels
const LOG_LEVELS = {
  ERROR: 0,
  WARNING: 1,
  INFO: 2,
  DEBUG: 3
};

// Batch logs to reduce network requests
let logQueue = [];
let isProcessingQueue = false;
const MAX_QUEUE_SIZE = 10;
const FLUSH_INTERVAL = 2000; // 2 seconds

// Initialize timer for periodic flushing
setInterval(() => {
  if (logQueue.length > 0) {
    flushLogs();
  }
}, FLUSH_INTERVAL);

/**
 * Flush logs from the queue to the server
 */
const flushLogs = async () => {
  if (isProcessingQueue || logQueue.length === 0) return;
  
  isProcessingQueue = true;
  const logsToSend = [...logQueue];
  logQueue = [];
  
  try {
    // Send logs in batch
    await fetch(LOG_SERVER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        log: {
          timestamp: new Date().toISOString(),
          level: 'INFO',
          message: 'Batch log event',
          source: 'frontend',
          application: 'web',
          events: logsToSend
        },
        type: 'frontend',
        application: 'web'
      })
    });
  } catch (error) {
    // Silent fail - we don't want to flood console with errors if log server is down
    console.debug('Failed to send logs to server:', error);
  } finally {
    isProcessingQueue = false;
  }
};

/**
 * Log an event to the centralized logging system
 * @param {Object} eventData - The event data to log
 * @param {string} level - The log level (ERROR, WARNING, INFO, DEBUG)
 */
export const logEvent = (eventData = {}, level = 'INFO') => {
  // Normalize log level
  const normalizedLevel = (eventData.level || level).toUpperCase();
  
  // Create the log entry
  const logEntry = {
    timestamp: new Date().toISOString(),
    level: normalizedLevel,
    message: eventData.message || 'Log event',
    source: eventData.source || 'frontend',
    application: eventData.application || 'web',
    ...eventData
  };
  
  // Add to queue
  logQueue.push(logEntry);
  
  // Flush immediately for errors or if queue is large enough
  if (normalizedLevel === 'ERROR' || logQueue.length >= MAX_QUEUE_SIZE) {
    flushLogs();
  }
  
  // Also log to console for debugging
  const consoleMethod = normalizedLevel === 'ERROR' ? 'error' : 
                        normalizedLevel === 'WARNING' ? 'warn' : 
                        normalizedLevel === 'DEBUG' ? 'debug' : 'log';
  
  console[consoleMethod](`[${logEntry.source}] ${logEntry.message}`, eventData);
};

/**
 * Log an error to the centralized logging system
 * @param {Error|string} error - The error to log
 * @param {Object} context - Additional context for the error
 */
export const logError = (error, context = {}) => {
  // Extract error information
  const errorObj = error instanceof Error ? error : new Error(error);
  
  logEvent({
    level: 'ERROR',
    message: errorObj.message,
    stack: errorObj.stack,
    name: errorObj.name,
    ...context
  });
};

/**
 * Initialize error tracking for the application
 */
export const initErrorTracking = () => {
  // Track unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    logError(event.reason, {
      type: 'unhandledRejection',
      message: 'Unhandled Promise Rejection'
    });
  });
  
  // Track uncaught exceptions
  window.addEventListener('error', (event) => {
    logError(event.error || event.message, {
      type: 'uncaughtException',
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno
    });
  });
  
  // Override console methods to capture logs
  const originalConsole = {
    error: console.error,
    warn: console.warn,
    info: console.info,
    debug: console.debug
  };
  
  // Override console.error
  console.error = (...args) => {
    // Call original method
    originalConsole.error.apply(console, args);
    
    // Log to centralized system
    if (args.length > 0) {
      if (args[0] instanceof Error) {
        logError(args[0], { consoleArgs: args.slice(1) });
      } else {
        logEvent({
          level: 'ERROR',
          message: args.map(arg => String(arg)).join(' '),
          consoleArgs: args
        });
      }
    }
  };
  
  // Override console.warn
  console.warn = (...args) => {
    // Call original method
    originalConsole.warn.apply(console, args);
    
    // Log to centralized system
    if (args.length > 0) {
      logEvent({
        level: 'WARNING',
        message: args.map(arg => String(arg)).join(' '),
        consoleArgs: args
      });
    }
  };
  
  // Monitor for Supabase client errors
  monitorSupabase();
};

/**
 * Setup monitoring for Supabase client if it exists in the app
 */
const monitorSupabase = () => {
  // Wait for window.supabase to be defined (if using global instance)
  const checkForSupabase = () => {
    if (window.supabase) {
      // Add event listeners to supabase client
      try {
        logEvent({
          level: 'INFO',
          source: 'supabase',
          message: 'Supabase client detected and monitoring initialized'
        });
        
        // Monitor auth state changes
        window.supabase.auth.onAuthStateChange((event, session) => {
          logEvent({
            level: 'INFO',
            source: 'supabase',
            message: `Auth state changed: ${event}`,
            event,
            user: session?.user?.email || session?.user?.id
          });
        });
      } catch (e) {
        logEvent({
          level: 'WARNING',
          source: 'supabase',
          message: 'Failed to initialize Supabase monitoring',
          error: e.message
        });
      }
    } else {
      // Not found, check again later
      setTimeout(checkForSupabase, 1000);
    }
  };
  
  // Start checking
  checkForSupabase();
};

// Export a default logger function
export default logEvent; 