import {GoogleGenerativeAI} from '@google/generative-ai'
import fs from 'fs'
import path from 'path'
import mime from 'mime-types'
import dotenv from 'dotenv'

// Load environment variables
dotenv.config()

// Get API key from environment variables
const key = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY

// Validate API key
if (!key) {
  console.error('Error: Gemini API key not found in environment variables')
  console.error('Please set GEMINI_API_KEY or VITE_GEMINI_API_KEY in your .env file')
  process.exit(1)
}

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
    // Return file info for now - we'll implement actual upload later
    return {
      name: file.filename,
      path: file.path,
      mimeType: file.mimetype,
      originalname: file.originalname,
      uri: `file://${file.path}`
    }
  } catch (error) {
    console.error('Error in uploadVideo:', error)
    throw error
  }
}

export const checkProgress = async fileId => {
  try {
    // For now, just return ACTIVE state
    return {
      state: 'ACTIVE',
      fileId
    }
  } catch (error) {
    console.error('Error in checkProgress:', error)
    return {
      state: 'FAILED',
      message: error.message,
      fileId
    }
  }
}

export const promptVideo = async (uploadResult, prompt, model) => {
  try {
    if (!key) {
      throw new Error('API key not properly configured in .env file')
    }

    const modelInstance = genAI.getGenerativeModel({model})
    const result = await modelInstance.generateContent([
      {text: prompt},
      {
        fileData: {
          mimeType: uploadResult.mimeType,
          fileUri: uploadResult.uri
        }
      }
    ])

    return {
      text: result.response.text(),
      candidates: result.response.candidates,
      feedback: result.response.promptFeedback
    }
  } catch (error) {
    console.error('Error in promptVideo:', error)
    throw error
  }
} 