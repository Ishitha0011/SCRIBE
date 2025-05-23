/**
 * Utility functions for working with YouTube URLs and data
 */

/**
 * Extract YouTube video ID from a URL
 * Supports various YouTube URL formats including:
 * - https://www.youtube.com/watch?v=VIDEO_ID
 * - https://youtu.be/VIDEO_ID
 * - https://youtube.com/shorts/VIDEO_ID
 * - https://www.youtube.com/embed/VIDEO_ID
 * 
 * @param {string} url - YouTube URL
 * @returns {string|null} - Video ID or null if not found
 */
export function getYouTubeVideoId(url) {
  if (!url) return null;
  
  // Regular expression to match YouTube video ID from different URL formats
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|shorts\/|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  
  if (match && match[2].length === 11) {
    return match[2];
  }

  return null;
}

/**
 * Get YouTube embed URL from a video ID
 * 
 * @param {string} videoId - YouTube video ID
 * @returns {string} - Embed URL
 */
export function getYouTubeEmbedUrl(videoId) {
  if (!videoId) return '';
  return `https://www.youtube.com/embed/${videoId}`;
}

/**
 * Get YouTube thumbnail URL for a video
 * 
 * @param {string} videoId - YouTube video ID
 * @param {string} quality - Thumbnail quality (default, mqdefault, hqdefault, sddefault, maxresdefault)
 * @returns {string} - Thumbnail URL
 */
export function getYouTubeThumbnailUrl(videoId, quality = 'hqdefault') {
  if (!videoId) return '';
  return `https://img.youtube.com/vi/${videoId}/${quality}.jpg`;
}

/**
 * Extract the title of a YouTube video from its URL
 * Uses the oEmbed API to get video metadata
 * 
 * @param {string} url - YouTube URL
 * @returns {Promise<string>} - Promise resolving to the video title
 */
export async function extractYouTubeTitle(url) {
  if (!url) return '';
  
  try {
    const videoId = getYouTubeVideoId(url);
    if (!videoId) return '';

    const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
    const response = await fetch(oembedUrl);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch video title: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.title || '';
  } catch (error) {
    console.error('Error extracting YouTube title:', error);
    return '';
  }
}

// Helper function to normalize language name
export function normalizeLanguageName(lang) {
  if (!lang) return 'text';
  
  const langMap = {
    'js': 'javascript',
    'ts': 'typescript',
    'py': 'python',
    'rb': 'ruby',
    'cs': 'csharp',
    'c#': 'csharp',
    'c++': 'cpp',
    'md': 'markdown',
    'sh': 'bash',
    'yml': 'yaml',
    'jsx': 'jsx',
    'tsx': 'tsx'
  };
  
  return langMap[lang.toLowerCase()] || lang.toLowerCase();
}

/**
 * Extract code snippets from a YouTube video using Gemini API
 * 
 * @param {string} url - YouTube URL
 * @param {string} apiKey - Gemini API key
 * @returns {Promise<Object>} - Promise resolving to the extracted code data
 */
export async function extractCodeFromYoutube(url, apiKey) {
  const videoId = getYouTubeVideoId(url);
  if (!videoId) {
    throw new Error("Invalid YouTube URL");
  }
  
  // Try to get the video title for better context
  let title = '';
  try {
    title = await extractYouTubeTitle(url);
  } catch (error) {
    console.warn("Could not extract YouTube title:", error);
  }
  
  // Build system instruction for code extraction
  const systemInstruction = `Analyze this YouTube coding tutorial and extract ONLY the actual code snippets shown or explained in the video.

IMPORTANT FORMATTING RULES:
1. Each code block MUST be wrapped in triple backticks with the language specified: \`\`\`language
2. ONLY include actual code inside code blocks - NO explanatory text, comments, or instructions
3. Put explanations and context BETWEEN code blocks as normal text
4. Each code block MUST end with \`\`\` on its own line
5. If there are multiple files, clearly indicate which code belongs to which file before the code block
6. DO NOT include explanations, instructions, or comments in the code blocks unless they are part of the actual code

Example of CORRECT formatting:

This is the HTML file:

\`\`\`html
<!DOCTYPE html>
<html>
<head>
  <title>Example</title>
</head>
<body>
  <h1>Hello World</h1>
</body>
</html>
\`\`\`

And here is the JavaScript:

\`\`\`javascript
document.addEventListener('DOMContentLoaded', () => {
  console.log('Hello world!');
});
\`\`\`

Also provide a summary of the implementation steps explained in the video.`;
  
  // Prepare request body
  const requestBody = {
    contents: [
      {
        role: "user",
        parts: [
          {
            fileData: {
              fileUri: `https://youtu.be/${videoId}`,
              mimeType: "video/*",
            }
          },
          {
            text: "Extract ONLY the actual code snippets from this programming tutorial video. Put explanations between code blocks, not inside them.",
          }
        ]
      }
    ],
    generationConfig: {
      temperature: 0.1,
      topP: 0.95,
      topK: 40,
      maxOutputTokens: 8192,
      responseMimeType: "text/plain"
    },
    systemInstruction: {
      parts: [{ text: systemInstruction }]
    }
  };
  
  // Make the API call
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody)
  });
  
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(`Gemini API error: ${errorData.error?.message || response.statusText}`);
  }
  
  const data = await response.json();
  
  // Extract the code and instructions
  if (data.candidates && data.candidates[0] && data.candidates[0].content) {
    const rawText = data.candidates[0].content.parts[0].text;
    
    // Parse the response to extract code blocks and instructions
    const codeBlocks = [];
    let instructions = "";
    
    // Enhanced parsing of code blocks with better language and filename detection
    const codeBlockRegex = /```(\w+)?\s*([\s\S]*?)```/g;
    let match;
    let lastIndex = 0;
    let textParts = [];
    
    // First pass to extract all code blocks and text parts
    while ((match = codeBlockRegex.exec(rawText)) !== null) {
      // Get the text before this code block
      if (match.index > lastIndex) {
        const textBefore = rawText.substring(lastIndex, match.index).trim();
        if (textBefore) {
          textParts.push(textBefore);
        }
      }
      
      const rawLanguage = match[1] ? match[1].toLowerCase() : 'text';
      const language = normalizeLanguageName(rawLanguage);
      const code = match[2].trim();
      
      // Look for filename hints in the text before this code block
      const contextBeforeBlock = textParts.length > 0 ? textParts[textParts.length - 1] : '';
      let filename = '';
      
      // Check for filename patterns in the context
      const filenameMatch = contextBeforeBlock.match(/(?:file|filename|path)(?:\s*:|=|\s+)?\s*['"]*([a-zA-Z0-9_.-]+\.[a-zA-Z0-9]+)['""]*/i);
      if (filenameMatch) {
        filename = filenameMatch[1];
      }
      
      // Look for "create a file called" pattern
      const createFileMatch = contextBeforeBlock.match(/create\s+(?:a|the)?\s+(?:file|script)?\s+(?:called|named)?\s+['"]*([a-zA-Z0-9_.-]+\.[a-zA-Z0-9]+)['""]*/i);
      if (createFileMatch) {
        filename = createFileMatch[1];
      }
      
      // If we have a filename but no language, try to infer language from extension
      if (filename && language === 'text') {
        const ext = filename.split('.').pop().toLowerCase();
        const langFromExt = {
          'js': 'javascript',
          'ts': 'typescript',
          'py': 'python',
          'html': 'html',
          'css': 'css',
          'java': 'java',
          'rb': 'ruby',
          'php': 'php',
          'go': 'go',
          'rs': 'rust',
          'cs': 'csharp',
          'cpp': 'cpp',
          'c': 'c',
          'jsx': 'jsx',
          'tsx': 'tsx',
          'md': 'markdown',
          'json': 'json',
          'yml': 'yaml',
          'yaml': 'yaml',
          'sh': 'bash',
          'sql': 'sql'
        };
        
        const inferredLang = langFromExt[ext] || 'text';
        codeBlocks.push({
          language: inferredLang,
          code,
          filename
        });
      } else {
        codeBlocks.push({
          language,
          code,
          filename
        });
      }
      
      lastIndex = match.index + match[0].length;
    }
    
    // Get any remaining text after the last code block
    if (lastIndex < rawText.length) {
      const textAfter = rawText.substring(lastIndex).trim();
      if (textAfter) {
        textParts.push(textAfter);
      }
    }
    
    // Join all text parts to form the instructions
    instructions = textParts.join('\n\n');
    
    // Get video title if available
    const videoTitle = title || `YouTube video (${videoId})`;
    
    return {
      title: videoTitle,
      extracted_code: codeBlocks,
      instructions,
      video_id: videoId
    };
  } else {
    throw new Error("Unexpected response format from Gemini API");
  }
}

/**
 * Analyze YouTube video content using Gemini API
 * 
 * @param {string} url - YouTube URL
 * @param {string} apiKey - Gemini API key
 * @param {string} customPrompt - Custom analysis prompt (optional)
 * @returns {Promise<Object>} - Promise resolving to the analysis data
 */
export async function analyzeYoutubeVideo(url, apiKey, customPrompt = '') {
  const videoId = getYouTubeVideoId(url);
  if (!videoId) {
    throw new Error("Invalid YouTube URL");
  }
  
  if (!apiKey) {
    throw new Error("Gemini API key is required");
  }
  
  // Try to get the video title for better context
  let title = '';
  try {
    title = await extractYouTubeTitle(url);
  } catch (error) {
    console.warn("Could not extract YouTube title:", error);
  }
  
  // Build system instruction for video content analysis
  const defaultSystemInstruction = `Analyze this YouTube video and provide a comprehensive summary. Include:

1. Main topics and key points discussed
2. Important visual elements (diagrams, charts, graphs)
3. Key timestamps for important moments
4. Overall summary of the content

Format the output in a clear, structured way that can be used for answering questions about the video.`;

  const systemInstruction = customPrompt || defaultSystemInstruction;
  
  // Prepare request body
  const requestBody = {
    contents: [
      {
        role: "user",
        parts: [
          {
            fileData: {
              fileUri: `https://youtu.be/${videoId}`,
              mimeType: "video/*",
            }
          },
          {
            text: "Analyze this video and provide a comprehensive summary of its content.",
          }
        ]
      }
    ],
    generationConfig: {
      temperature: 0.7,
      topP: 0.95,
      topK: 40,
      maxOutputTokens: 8192,
      responseMimeType: "text/plain"
    },
    systemInstruction: {
      parts: [{ text: systemInstruction }]
    }
  };
  
  try {
    // Make direct API call to Gemini
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Gemini API error: ${errorData.error?.message || response.statusText}`);
    }
    
    const data = await response.json();
    
    // Extract the analysis text
    if (data.candidates && data.candidates[0] && data.candidates[0].content) {
      const analysisText = data.candidates[0].content.parts[0].text;
      return {
        analysis_text: analysisText,
        video_id: videoId,
        title: title
      };
    } else {
      throw new Error("Unexpected response format from Gemini API");
    }
  } catch (error) {
    console.error('Error in analyzeYoutubeVideo:', error);
    throw error;
  }
} 