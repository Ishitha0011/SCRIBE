import express from 'express'
import ViteExpress from 'vite-express'
import multer from 'multer'
import {checkProgress, promptVideo, uploadVideo} from './upload.mjs'
import path from 'path'
import dotenv from 'dotenv'

// Load environment variables
dotenv.config()

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
import fs from 'fs'
try {
  if (!fs.existsSync(path.join(process.cwd(), 'tmp'))) {
    fs.mkdirSync(path.join(process.cwd(), 'tmp'), { recursive: true });
    console.log("Created tmp directory");
  }
} catch (err) {
  console.error("Error creating tmp directory:", err);
}

app.post('/api/upload', upload.single('video'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    console.log("File received:", req.file);
    const resp = await uploadVideo(req.file);
    return res.json({ data: resp });
  } catch (error) {
    console.error("Upload error:", error);
    return res.status(500).json({ error: error.toString() });
  }
});

app.post('/api/progress', async (req, res) => {
  try {
    if (!req.body.fileId) {
      return res.status(400).json({ error: 'No fileId provided' });
    }
    
    const progress = await checkProgress(req.body.fileId);
    return res.json({ progress });
  } catch (error) {
    console.error("Progress check error:", error);
    return res.status(500).json({ error: error.toString() });
  }
});

app.post('/api/prompt', async (req, res) => {
  try {
    const reqData = req.body;
    
    if (!reqData.uploadResult || !reqData.prompt || !reqData.model) {
      return res.status(400).json({ 
        error: 'Missing required parameters: uploadResult, prompt, or model' 
      });
    }
    
    console.log("Prompt request:", {
      model: reqData.model,
      prompt: reqData.prompt.substring(0, 50) + '...'
    });
    
    const videoResponse = await promptVideo(
      reqData.uploadResult,
      reqData.prompt,
      reqData.model
    );
    
    return res.json(videoResponse);
  } catch (error) {
    console.error("Prompt error:", error);
    return res.status(400).json({ error: error.toString() });
  }
});

// Serve the React app in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(process.cwd(), 'build')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(process.cwd(), 'build', 'index.html'));
  });
}

// Try to start server on multiple ports if needed
const startServer = (portsToTry) => {
  if (portsToTry.length === 0) {
    console.error("Failed to start server on any port");
    process.exit(1);
  }

  const port = portsToTry[0];
  const server = app.listen(port, () => {
    console.log(`Server is listening on port ${port}`);
    console.log(`API key configured: ${process.env.VITE_GEMINI_API_KEY ? 'Yes' : 'No - please set VITE_GEMINI_API_KEY'}`);
    
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
      console.log(`Updated .env file with SERVER_PORT=${port}`);
    }
  }).on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`Port ${port} is in use, trying next port...`);
      startServer(portsToTry.slice(1));
    } else {
      console.error("Error starting server:", err);
      process.exit(1);
    }
  });
};

// Try these ports in order
const portsToTry = [8001, 8002, 8003, 8004, 8005];
startServer(portsToTry); 