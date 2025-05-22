// Template configuration file
// Copy this file to src/config.js and replace the placeholder values with your actual API keys

const config = {
  // Gemini API configuration
  GEMINI_API_KEY: 'your_gemini_api_key_here',
  GEMINI_API_URL: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent',

  // Local AI API configuration
  API_URL: 'http://localhost:8000/api/ai-chat',

  // Add other API configurations here
  // Example:
  // OPENAI_API_KEY: 'your_openai_api_key_here',
  // ANTHROPIC_API_KEY: 'your_anthropic_api_key_here',
};

export default config; 