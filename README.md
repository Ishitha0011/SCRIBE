# Video Analysis Lab

A web application for analyzing videos using Google's Gemini AI. Upload videos and generate various types of analysis including captions, key moments, summaries, and more.

## Features

- Video upload and playback
- Multiple analysis modes:
  - A/V captions
  - Key moments
  - Paragraph summaries
  - Table of scenes
  - Haiku generation
  - Charts (Excitement, Importance, Number of people)
  - Speaker identification
  - Chapter division
  - Script generation
- Interactive timeline with markers
- Multiple display modes for results

## Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- A Gemini API key from Google AI Studio

## Setup

1. Clone the repository
2. Install dependencies:
   ```
   npm install
   ```
3. Create a `.env` file in the root directory (copy from `.env.example`):
   ```
   cp .env.example .env
   ```
4. Get your Gemini API key from https://makersuite.google.com/app/apikey
5. Add your API key to the `.env` file:
   ```
   VITE_GEMINI_API_KEY=your_gemini_api_key_here
   ```

## Getting a Gemini API Key

1. Go to [Google AI Studio](https://ai.google.dev/)
2. Sign in with your Google account
3. Navigate to the API keys section
4. Create a new API key
5. Copy the key and paste it in your `.env` file

## Running the Application

1. Start the development server:
   ```
   npm run server
   ```
2. In a separate terminal, start the React app:
   ```
   npm start
   ```
3. Open your browser and navigate to `http://localhost:3000`

## Troubleshooting

- **API Key Issues**: If you see a warning about the API key not being configured, make sure you've added your Gemini API key to the `.env` file.
- **Server Connection Issues**: Ensure the server is running on port 8000. Check for any error messages in the server terminal.
- **Video Upload Issues**: The maximum file size is 100MB. If you're having trouble uploading larger files, try with a smaller video first.
- **Processing Errors**: Check the logs panel in the UI for detailed error messages.

## License

MIT

## Worker Logs

The application now supports detailed logging to help track and diagnose issues.

### How to Start the Log Server

1. Open a new terminal
2. Run: `npm run start:logs`
3. The log server will start on http://localhost:9999

### Viewing Logs

- **Web Interface**: Open http://localhost:9999 in your browser to see logs with auto-refresh
- **Raw Logs**: Access http://localhost:9999/raw for plain text logs
- **Log File**: All logs are stored in `worker.logs` in the project root directory

### Log Types

The application logs various events:

- **Video Upload**: Start, progress, completion, and errors
- **Content Generation**: Requests, responses, and errors
- **API Interactions**: All API calls and their results

### Log Format

Each log entry includes:
- Timestamp
- Event type (info, error, request, response)
- Action (upload_video, generate_content, etc.)
- Relevant details and data

## Using the Application

// ... rest of README content
