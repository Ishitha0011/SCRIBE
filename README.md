# Scribe: Your AI-Powered Workspace

Scribe is a versatile, AI-driven web application designed to be your intelligent workspace. It seamlessly integrates several powerful functionalities: an advanced video analysis lab, a feature-rich rich-text editor with comprehensive AI assistance, a flexible canvas mode for visual note-taking and diagramming, a dedicated AI chat interface for broader queries, and robust local file management capabilities. Powered by Google's Gemini AI, Scribe aims to enhance your productivity and creativity across various tasks.

## ✨ Core Features of **Scribe**

Scribe offers a powerful suite of tools to supercharge your workflow and creativity. Here's what you get:

---

### 🎥 1. Video Analysis Lab

Upload videos and let Gemini AI do the heavy lifting with deep insights:

- 📜 **Captions** — Generate audio/video captions automatically  
- ⏱ **Key Moments** — Highlight important timestamps and events  
- 📝 **Summaries** — Paragraph-level summaries for quick understanding  
- 🎬 **Scene Table** — Breakdown of scenes with descriptions  
- 🎨 **Creative Content** — Generate haikus and more  
- 📊 **Insight Charts** — Analyze excitement, importance & number of people  
- 🗣 **Speaker ID** — Identify who’s speaking when  
- 📚 **Chapters** — Auto-generate logical divisions  
- 🧾 **Full Script** — Extract the complete transcript  
- 🧭 **Interactive Timeline** — Clickable markers to navigate insights  
- 🖥 **Multiple Display Modes** — Present analysis in various styles

---

### 📝 2. AI-Enhanced Editor & Workspace

Create and manage documents with a powerful, smart editing environment:

#### ✒️ Rich Text Editor (powered by Tiptap)

- Headings, paragraphs, and list support (• Bullet, 1. Ordered, ☑ Task)
- **Bold**, *Italic*, _Underline_, ~~Strikethrough~~  
- `Code`, Blockquotes, and Syntax Highlighting  
- 📎 Links, 🖼 Image Embedding, 📊 Tables  
- 🔤 Text Alignment, Custom Fonts, Sizes & Colors  
- ➗ Math Equation support (KaTeX)

#### 🤖 Inline AI Assistance (Gemini-powered)

- 🪄 Write, summarize, rephrase, or improve selected text  
- 🖼 Analyze images & generate smart insights or answers  

#### 🧠 Canvas Mode

- Visual note-taking with `.canvas` files  
- 🧩 Create nodes for mind maps, flowcharts & diagrams  
- ⚛ Powered by React Flow

#### 🗂 Local File Workspace

- 📁 Open and manage a local directory  
- 🔍 Search files by name or content  
- ✏️ Create, rename, delete files & folders  
- 📂 Multi-tab interface for managing multiple documents  
- 💾 Auto-save & manual save options

---

### 💬 3. Scribe AI Chat

A dedicated chat interface for interacting with Gemini AI:

- 🧠 Ask general-purpose questions or get help anytime  
- 💬 View and manage **chat history** (stored via Supabase)  
- 📎 Attach files to provide more context to your chat  

---

### 📟 4. Centralized Logging Integration

Stay on top of your system’s health with real-time logging:

- 🧾 View logs from all parts of the app via a dedicated web interface  
- 🛠 Diagnose issues quickly and efficiently

## YouTube Analysis Features

Scribe includes two powerful YouTube integration features:

1. **YouTube Analyzer**: Extracts key points, summaries, and timestamps from any YouTube video
2. **Code from YouTube**: Automatically extracts code snippets and implementation steps from coding tutorials

## Setting Up Gemini API for YouTube Features

To use the YouTube analysis features, you'll need to set up a Gemini API key:

1. Visit [Google AI Studio](https://aistudio.google.com/app/apikey) and create a free account if you don't have one
2. Create a new API key from the API Keys section
3. Open `src/config.js` in your project
4. Replace `'your_api_key_here'` with your actual Gemini API key:

```javascript
export const config = {
  GEMINI_API_KEY: 'your-actual-api-key-here',
  // other configuration...
};
```

## Using YouTube Features

1. **YouTube Analyzer**:
   - Create a new document or open an existing one
   - Click on the "YT Analyser" button in the toolbar
   - Paste a YouTube URL and add optional custom prompts
   - Click the submit button to generate a comprehensive summary

2. **Code from YouTube**:
   - Create a new document or open an existing one
   - Click on the "Coder from YT" button in the toolbar
   - Paste a YouTube URL with a coding tutorial
   - Click the submit button to extract all code snippets with proper formatting

## Other Features

- Rich text formatting with markdown support
- Image analysis and AI-powered descriptions
- Canvas mode for creating mind maps
- Auto-save functionality
- Dark/light theme support

## Prerequisites

Before you begin, ensure you have the following installed:

*   Node.js (v16 or higher recommended)
*   npm (usually comes with Node.js) or yarn
*   Python (v3.8 or higher recommended)
*   pip (Python package installer, usually comes with Python)
*   A Gemini API key from Google AI Studio (for all AI features)

## Setup

1.  **Clone the repository:**
    ```bash
    git clone <repository-url>
    cd scribe-project-directory # Or your project's directory name
    ```

2.  **Install Node.js dependencies:**
    This installs dependencies for the React frontend, the Node.js server (video processing), and the Log server.
    ```bash
    npm install
    ```

3.  **Set up Python environment and install dependencies:**
    It's recommended to use a virtual environment for Python projects.
    ```bash
    # Navigate to the Python backend directory
    cd src/backend

    # Create a virtual environment (e.g., using venv)
    python -m venv venv

    # Activate the virtual environment
    # On Windows:
    # venv\Scripts\activate
    # On macOS/Linux:
    # source venv/bin/activate

    # Install Python dependencies
    pip install -r requirements.txt 

    # Return to the project root directory
    cd ../.. 
    ```

4.  **Configure Environment Variables:**
    - Create a `.env` file in the root directory by copying the example:
      ```bash
      cp .env.example .env
      ```
    - Open the `.env` file and add your Gemini API key:
      ```
      VITE_GEMINI_API_KEY=your_gemini_api_key_here
      ```
    *Note: Supabase keys for the AI Chat persistence are hardcoded in `src/supabaseClient.js` and do not need to be added to the `.env` file for the application to run.*

## Getting a Gemini API Key
1. Go to [Google AI Studio](https://ai.google.dev/)
2. Sign in with your Google account
3. Navigate to the API keys section
4. Create a new API key
5. Copy the key and paste it in your `.env` file as `VITE_GEMINI_API_KEY`.

## Running the Application

Scribe consists of multiple services. You can run them individually or use the concurrent script for convenience.

**1. Using the Development Script (Recommended):**

This script runs all necessary services concurrently: React app, Node.js server, Python FastAPI server, and the Log server.
```bash
npm run dev
```

**2. Running Services Individually:**

If you prefer to run services in separate terminals:

*   **React Frontend App:**
    ```bash
    npm start
    ```
    Usually runs on `http://localhost:3000`.

*   **Node.js Server (for Video Processing & related APIs):**
    ```bash
    npm run server
    ```
    The server will attempt to run on port 8001 by default. Check server logs for the exact port if 8001 is in use. It updates `SERVER_PORT` in your `.env` file.

*   **Python FastAPI Backend (for Workspace, Editor AI, Chat AI):**
    ```bash
    npm run fastapi
    # OR directly:
    # cd src/backend && python main.py
    ```
    Usually runs on `http://localhost:8000`.

*   **Log Server:**
    ```bash
    npm run start:logs
    ```
    Runs on `http://localhost:9999`.

**Accessing Scribe:**

*   Once all services are running (or after starting `npm run dev`), open your browser and navigate to `http://localhost:3000`.
*   The Log Viewer can be accessed at `http://localhost:9999`.

## Using the Application

Once Scribe is up and running, you can explore its various features:

**1. Setting Up Your Workspace (First Time):**
   - On your first visit, or if no workspace is set, the file sidebar on the left will prompt you to "Open Workspace".
   - Click this button to open a native directory selection dialog.
   - Choose a local directory on your computer to act as Scribe's main workspace. This is where your files and folders will be managed.

**2. Video Analysis Lab:**
   - Access the Video Analysis Lab section from the application's main interface (look for a "Labs" or "Video Analysis" tab/section).
   - Upload your video file using the provided interface.
   - Once uploaded and processed, select different analysis modes (e.g., captions, summary, key moments) to view the AI-generated results.
   - Use the interactive timeline to navigate through the video and its analyses.


**3. AI-Enhanced Editor & Workspace:**
   - **File Management (Left Sidebar):**
     - Browse your selected workspace directory structure.
     - Click on files (e.g., `.txt`, `.md`, `.py`, `.canvas`) to open them in new tabs in the central editor.
     - Right-click (or use the `...` menu if available) on files or folders to create new items, rename, or delete them.
     - Use the search icon in the sidebar (Ctrl/Cmd+K) to find files by name or search within their content.
   - **Rich Text Editing (Center Panel):**
     - When a text-based file is open, use the intuitive WYSIWYG editor.
     - Formatting options appear in a bubble menu when you select text (e.g., bold, italic, colors, font).
     - Type `/` at the beginning of a new line to trigger slash commands for inserting elements like headings, lists, tables, or code blocks.
     - Drag and drop or paste images directly into the editor.
   - **Inline AI Assistance:**
     - **For Text:** Select text and use the AI options in the bubble menu (e.g., "Improve Writing", "Ask AI") or trigger AI with space at the start of a line or via slash commands.
     - **For Images:** Select an inserted image. Options will appear to "Analyze Image" (get a description) or "Ask AI about Image" (query the AI with specific questions about the image).
   - **Canvas Mode:**
     - Create or open a `.canvas` file.
     - The center panel will switch to a node-based canvas.
     - Add, connect, and arrange nodes to create diagrams, mind maps, or flowcharts.

**4. Scribe AI Chat (Right Sidebar or Dedicated Tab):**
   - Access the "Ask AI" panel/tab.
   - Start a new chat or select a previous chat session from the history (Alt+H or clock icon).
   - Type your questions or prompts in the input field at the bottom.
   - Attach files using the paperclip icon to provide context for your queries.
   - The AI's responses will appear in the chat window. Use message actions (copy, expand, delete) as needed.

**5. Accessing Logs:**
   - If you need to troubleshoot or monitor application activity, open `http://localhost:9999` in your browser.
   - This interface shows logs from the frontend, Node.js server, and Python backend.

## Troubleshooting

- **Gemini API Key Issues**: If you see warnings about the API key, ensure `VITE_GEMINI_API_KEY` is correctly set in your `.env` file in the project root.
- **Server Connection Issues**:
    - **Node.js Server (Video API)**: Ensure it's running (defaults to port 8001). Check its terminal for logs.
    - **Python FastAPI Backend**: Ensure it's running (defaults to port 8000). Check its terminal for logs.
- **Video Upload Issues**: The maximum file size for video analysis is currently 100MB. Try smaller files if you encounter issues.
- **General Processing Errors**: Check the Scribe application's UI for any error messages. For more detailed diagnostics, consult the [Centralized Logging](#centralized-logging) server.
- **Workspace Issues**: If file operations fail, ensure the Python backend has the necessary permissions for the selected workspace directory.

*This section can be expanded with more specific troubleshooting tips as the project evolves. Contributions are welcome!*

## Centralized Logging

The application includes a dedicated log server to help track and diagnose issues across its different components.

### How to Start the Log Server

1.  Open a new terminal in the project root.
2.  Run:
    ```bash
    npm run start:logs
    ```
3.  The log server will start on `http://localhost:9999`.

### Viewing Logs

-   **Web Interface**: Open `http://localhost:9999` in your browser to see logs from various sources with auto-refresh.
-   **Raw Logs**: Access `http://localhost:9999/raw` for plain text logs (if supported by the log server).
-   **Log Files**: Log files for different components (e.g., `python.logs`, `nodejs.logs`, `worker.logs`) are stored in the `logs/` directory in the project root.

### Log Sources

The log server aggregates logs from:
- Python Backend
- Node.js Server
- Frontend (Worker/System)
- Filesystem operations
- Supabase interactions (if any are logged to this server)

Each log entry typically includes a timestamp, log level, message, and source.
