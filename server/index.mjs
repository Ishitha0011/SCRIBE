import express from 'express'
import ViteExpress from 'vite-express'
import multer from 'multer'
import {checkProgress, promptVideo, uploadVideo} from './upload.mjs'
import path from 'path'
import dotenv from 'dotenv'
import fs from 'fs'
import { fileURLToPath } from 'url'
import { createLogger } from './logger.mjs'

// Get the directory path of the current module
const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Load environment variables
dotenv.config()

// Initialize logger
const logger = createLogger('nodejs', 'server')

const app = express()
app.use(express.json())

// Set up CORS to allow requests from your React app
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

// Configure multer to store files in /tmp or a platform-appropriate temp directory
const upload = multer({
  dest: path.join(process.cwd(), 'tmp'),
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB limit
})

// Create tmp directory if it doesn't exist
try {
  if (!fs.existsSync(path.join(process.cwd(), 'tmp'))) {
    fs.mkdirSync(path.join(process.cwd(), 'tmp'), { recursive: true });
    logger.info("Created tmp directory");
  }
} catch (err) {
  logger.error("Error creating tmp directory:", err);
}

// Middleware to log requests
app.use((req, res, next) => {
  const start = Date.now()
  
  // Log when request completes
  res.on('finish', () => {
    const duration = Date.now() - start
    logger.info({
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      duration: `${duration}ms`,
      userAgent: req.get('User-Agent')
    });
  });
  
  next();
});

app.post('/api/upload', upload.single('video'), async (req, res) => {
  try {
    if (!req.file) {
      logger.warn("No file uploaded in request");
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    logger.info(`File received: ${req.file.originalname}, size: ${req.file.size} bytes`);
    const resp = await uploadVideo(req.file);
    return res.json({ data: resp });
  } catch (error) {
    logger.error("Upload error:", error);
    return res.status(500).json({ error: error.toString() });
  }
});

app.post('/api/progress', async (req, res) => {
  try {
    if (!req.body.fileId) {
      logger.warn("No fileId provided in progress check");
      return res.status(400).json({ error: 'No fileId provided' });
    }
    
    const progress = await checkProgress(req.body.fileId);
    return res.json({ progress });
  } catch (error) {
    logger.error("Progress check error:", error);
    return res.status(500).json({ error: error.toString() });
  }
});

app.post('/api/prompt', async (req, res) => {
  try {
    const reqData = req.body;
    
    // Check for single file or multiple files mode
    const isMultipleFiles = Array.isArray(reqData.uploadResults);
    
    if (isMultipleFiles) {
      // Multiple files mode
      if (!reqData.uploadResults || !reqData.uploadResults.length || !reqData.prompt || !reqData.model) {
        logger.warn("Missing required parameters for prompt API with multiple files");
        return res.status(400).json({ 
          error: 'Missing required parameters: uploadResults array, prompt, or model' 
        });
      }
      
      logger.info({
        message: "Prompt request with multiple files",
        model: reqData.model,
        fileCount: reqData.uploadResults.length,
        promptPreview: reqData.prompt.substring(0, 50) + '...'
      });
      
      const videoResponse = await promptVideo(
        reqData.uploadResults,
        reqData.prompt,
        reqData.model
      );
      
      return res.json(videoResponse);
    } else {
      // Single file mode (backward compatibility)
      if (!reqData.uploadResult || !reqData.prompt || !reqData.model) {
        logger.warn("Missing required parameters for prompt API with single file");
        return res.status(400).json({ 
          error: 'Missing required parameters: uploadResult, prompt, or model' 
        });
      }
      
      logger.info({
        message: "Prompt request",
        model: reqData.model,
        promptPreview: reqData.prompt.substring(0, 50) + '...'
      });
      
      const videoResponse = await promptVideo(
        reqData.uploadResult,
        reqData.prompt,
        reqData.model
      );
      
      return res.json(videoResponse);
    }
  } catch (error) {
    logger.error("Prompt error:", error);
    return res.status(400).json({ error: error.toString() });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve the React app in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(process.cwd(), 'build')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(process.cwd(), 'build', 'index.html'));
  });
}

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error("Unhandled error:", err);
  res.status(500).json({ error: 'Internal Server Error' });
});

// Try to start server on multiple ports if needed
const startServer = (portsToTry) => {
  if (portsToTry.length === 0) {
    logger.error("Failed to start server on any port");
    process.exit(1);
  }

  const port = portsToTry[0];
  const server = app.listen(port, () => {
    logger.info(`Server is listening on port ${port}`);
    logger.info(`API key configured: ${process.env.VITE_GEMINI_API_KEY ? 'Yes' : 'No - please set VITE_GEMINI_API_KEY'}`);
    
    // Update the port in the .env file for the frontend
    const envPath = path.join(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
      let envContent = fs.readFileSync(envPath, 'utf8');
      // Add or replace SERVER_PORT
      if (envContent.includes('SERVER_PORT=')) {
        envContent = envContent.replace(/SERVER_PORT=\d+/, `SERVER_PORT=${port}`);
      } else {
        envContent += `\nSERVER_PORT=${port}\n`;
      }
      fs.writeFileSync(envPath, envContent);
      logger.info(`Updated .env file with SERVER_PORT=${port}`);
    }
  }).on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      logger.warn(`Port ${port} is in use, trying next port...`);
      startServer(portsToTry.slice(1));
    } else {
      logger.error("Error starting server:", err);
      process.exit(1);
    }
  });
};

// Try these ports in order
const portsToTry = [8001, 8002, 8003, 8004, 8005];
startServer(portsToTry);

// Handle process termination
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});

// Log uncaught exceptions
process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection at:', promise, 'reason:', reason);
}); 