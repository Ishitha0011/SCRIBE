// Configuration file for the application

// API base URL
const API_BASE_URL = 'http://localhost:8000/api';

// API Configuration
export const config = {
  GEMINI_API_KEY: process.env.REACT_APP_GEMINI_API_KEY || 'your_api_key_here',
  API_URL: process.env.REACT_APP_API_URL || 'http://localhost:8000'
};

export default API_BASE_URL; 