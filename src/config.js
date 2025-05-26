/**
 * Application configuration settings
 */

// Define API base URL for backward compatibility with existing code
const API_BASE_URL = 'http://localhost:8000/api';

export const config = {
  /**
   * Gemini API key for direct model access
   * 
   * To use the Gemini API directly:
   * 1. Get an API key from https://aistudio.google.com/app/apikey
   * 2. Replace 'your_api_key_here' with your actual API key
   * 3. Keep this key secure and don't commit it to public repositories
   */
  GEMINI_API_KEY: "Your_API_KEY",
  
  /**
   * API base URL
   * Points to the backend server for API requests
   */
  API_BASE_URL: API_BASE_URL,
  
  /**
   * Editor settings
   */
  EDITOR: {
    /**
     * Default font size in pixels
     */
    DEFAULT_FONT_SIZE: 16,
    
    /**
     * Auto-save interval in milliseconds (60 seconds)
     */
    AUTO_SAVE_INTERVAL: 60000,
  }
};

// Export API_BASE_URL as default for backward compatibility
export default API_BASE_URL; 
