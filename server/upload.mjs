import {GoogleGenerativeAI} from '@google/generative-ai'
import fs from 'fs'
import path from 'path'
import mime from 'mime-types'

const key = process.env.VITE_GEMINI_API_KEY
const genAI = new GoogleGenerativeAI(key)

// Helper function to convert file to a base64 encoded data URI
async function fileToGenerativePart(filePath, mimeType) {
  const fileBuffer = await fs.promises.readFile(filePath);
  const fileData = fileBuffer.toString('base64');
  return {
    inlineData: {
      data: fileData,
      mimeType
    }
  };
}

export const uploadVideo = async file => {
  try {
    // Store the file info for later use
    const fileInfo = {
      name: file.filename || path.basename(file.path),
      path: file.path,
      mimeType: file.mimetype,
      originalname: file.originalname,
      // We'll construct a fake URI format that we can use later
      uri: `file://${file.path}`
    };
    
    console.log("File received:", fileInfo);
    return fileInfo;
  } catch (error) {
    console.error("Error in uploadVideo:", error);
    throw error;
  }
}

export const checkProgress = async fileId => {
  try {
    // Check if the file exists
    const filePath = path.join(process.cwd(), 'tmp', fileId);
    const fileExists = fs.existsSync(filePath);
    
    // Check if API key is configured properly
    if (!key || key === 'your_gemini_api_key_here') {
      console.warn("Gemini API key not properly configured in .env file");
      return {
        state: 'WARNING',
        message: 'API key not configured. Please set VITE_GEMINI_API_KEY in your .env file.',
        fileId
      };
    }
    
    if (!fileExists) {
      console.warn(`File not found: ${filePath}`);
      return {
        state: 'FAILED',
        message: 'File not found or has been removed',
        fileId
      };
    }
    
    // Since we're not actually using Google's FileManager, we consider the file active
    // if it exists and the API key is configured
    return {
      state: 'ACTIVE',
      fileId
    };
  } catch (error) {
    console.error("Error in checkProgress:", error);
    return {
      state: 'FAILED',
      message: error.toString(),
      fileId
    };
  }
}

export const promptVideo = async (uploadResult, prompt, model) => {
  try {
    console.log("Processing video with prompt:", prompt);
    console.log("Upload result:", uploadResult);
    
    // Check if API key is configured properly
    if (!key || key === 'your_gemini_api_key_here') {
      throw new Error('Gemini API key not properly configured. Please set VITE_GEMINI_API_KEY in your .env file.');
    }
    
    // Convert the file to a generative part
    const filePart = await fileToGenerativePart(uploadResult.path, uploadResult.mimeType);
    
    // Create the generative model
    const genModel = genAI.getGenerativeModel({ model });
    
    // Generate content
    const result = await genModel.generateContent([
      prompt,
      filePart
    ]);
    
    const response = result.response;
    
    return {
      text: response.text(),
      candidates: response.candidates,
      feedback: response.promptFeedback
    };
  } catch (error) {
    console.error("Error in promptVideo:", error);
    return {error: error.toString()};
  }
} 