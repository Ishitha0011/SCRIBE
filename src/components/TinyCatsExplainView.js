import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GoogleGenAI, Modality } from '@google/genai';
import { marked } from 'marked';
import { X, Send, Loader2, AlertTriangle, Cat, Trash2, History } from 'lucide-react';
import { config } from '../config';
import '../css/TinyCatsExplainView.css';

const LOCAL_STORAGE_KEY = 'tinyCatsGenerationHistory';
const MAX_HISTORY_ITEMS = 20;
const ASSETS_PATH = 'assets';

const TinyCatsExplainView = ({ isVisible, onClose, theme }) => {
  const [userInput, setUserInput] = useState('');
  const [slides, setSlides] = useState([]);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [modelResponseOutput, setModelResponseOutput] = useState('');
  const [generationHistory, setGenerationHistory] = useState([]);
  const [selectedHistoryId, setSelectedHistoryId] = useState(null);

  const genAI = useRef(null);
  const chat = useRef(null);
  const slideshowRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    try {
      const storedHistory = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (storedHistory) {
        setGenerationHistory(JSON.parse(storedHistory));
      }
    } catch (e) {
      console.error("Failed to load history from localStorage:", e);
    }
  }, []);

  useEffect(() => {
    if (isVisible) {
      if (!genAI.current && config.GEMINI_API_KEY && config.GEMINI_API_KEY !== 'your_api_key_here') {
        try {
          genAI.current = new GoogleGenAI({ apiKey: config.GEMINI_API_KEY });
          chat.current = genAI.current.chats.create({
            model: 'gemini-2.0-flash-preview-image-generation',
            config: {
              responseModalities: [Modality.TEXT, Modality.IMAGE],
            },
            history: [],
          });
          setError('');
        } catch (e) {
          console.error("Error initializing GenAI:", e);
          setError('Error initializing AI: ' + e.message + '. Please check API key.');
          genAI.current = null;
          chat.current = null;
        }
      } else if (!genAI.current) {
        setError("Gemini API key not configured or AI not initialized. Please set it in src/config.js.");
      }
      
      if (inputRef.current) {
        inputRef.current.focus();
      }
    } else {
      setIsLoading(false);
    }
  }, [isVisible]);

  // Save image to backend assets folder and return URL path
  const saveImageToAssets = async (base64Data, id) => {
    try {
      const timestamp = new Date().toISOString().replace(/[-:T.Z]/g, '');
      const filename = `tinycats_${id}_${timestamp}.png`;
      
      // Convert base64 data (remove the data:image/png;base64, prefix)
      const base64Image = base64Data.replace(/^data:image\/\w+;base64,/, '');
      
      // Send the image data to backend to save
      const response = await fetch('http://localhost:8000/api/files/upload-base64', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          filename: filename, 
          base64_data: base64Image,
          directory: ASSETS_PATH
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to upload image to server');
      }
      
      const result = await response.json();
      return result.path; // Return the path to the saved image
    } catch (error) {
      console.error('Error saving image to assets:', error);
      // Return original base64 as fallback
      return base64Data;
    }
  };

  // Save history data to localStorage
  const saveHistory = useCallback(async (newHistory) => {
    try {
      // Save metadata and references to images (not the full base64 data)
      const storageHistory = newHistory.map(item => ({
        ...item,
        slides: item.slides.map(slide => ({
          ...slide,
          // If the image is a server path (not base64), keep it, otherwise null
          image: slide.image && !slide.image.startsWith('data:') ? slide.image : null
        }))
      }));
      
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(storageHistory));
      return true;
    } catch (e) {
      console.error("Failed to save history to localStorage:", e);
      
      // Try with reduced data if first attempt failed
      try {
        // Further reduce by keeping only minimal data
        const minimalHistory = newHistory.map(item => ({
          id: item.id,
          prompt: item.prompt,
          timestamp: item.timestamp,
          slides: item.slides.map(slide => ({
            text: slide.text,
            image: slide.image && !slide.image.startsWith('data:') ? slide.image : null
          }))
        }));
        
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(minimalHistory));
        return true;
      } catch (e2) {
        console.error("Failed to save even minimal history:", e2);
        setError("Could not save to history due to storage limits. Try clearing history first.");
        return false;
      }
    }
  }, []);

  const addSlide = useCallback(async (text, imageBase64, historyId) => {
    const slideContent = await marked.parse(text);
    
    // First set with base64 for immediate display
    setSlides(prevSlides => [
      ...prevSlides,
      { text: slideContent, image: 'data:image/png;base64,' + imageBase64 }
    ]);
    
    // Then upload to server and get path
    try {
      const imagePath = await saveImageToAssets('data:image/png;base64,' + imageBase64, historyId);
      
      // Update with server path instead of base64
      setSlides(prevSlides => 
        prevSlides.map((slide, idx) => 
          idx === prevSlides.length - 1 ? { ...slide, image: imagePath } : slide
        )
      );
      
      return {
        text: slideContent,
        image: imagePath
      };
    } catch (error) {
      console.error("Failed to save image to server:", error);
      return {
        text: slideContent,
        image: 'data:image/png;base64,' + imageBase64
      };
    } finally {
      if (slideshowRef.current) {
        slideshowRef.current.scrollLeft = slideshowRef.current.scrollWidth;
      }
    }
  }, []);

  const parseGenAIError = (e) => {
    console.error("Raw GenAI Error:", e);
    if (e.message) {
        if (e.message.includes("API key not valid")) {
            return "API key not valid. Please check your configuration.";
        }
        if (e.message.includes("quota")) {
            return "You have exceeded your API quota.";
        }
        if (e.message.toLowerCase().includes("model_not_found")) {
            return "The specified AI model was not found. Please check the model name.";
        }
        try {
            const errorObj = JSON.parse(e.message);
            if (errorObj.error && errorObj.error.message) {
                return errorObj.error.message;
            }
        } catch (parseErr) {
            // Not JSON
        }
        return e.message;
    }
    return "An unknown error occurred with the AI model.";
  };

  const handleGenerate = async (promptMessage) => {
    if (!promptMessage.trim()) {
      setError("Please enter a topic.");
      return;
    }
    if (!chat.current) {
      setError("AI Model not initialized. Check API Key in src/config.js and ensure it's correct.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError('');
    setSlides([]);
    setModelResponseOutput('');
    setSelectedHistoryId(null);

    // Generate a unique ID for this generation
    const generationId = Date.now().toString();

    try {
      const parsedUserMessage = await marked.parse(promptMessage);
      setModelResponseOutput(parsedUserMessage);

      chat.current.history.length = 0;

      const additionalInstructions = 
        "Use a fun story about lots of tiny cats as a metaphor.\n" +
        "Keep sentences short but conversational, casual, and engaging.\n" +
        "Generate a cute, minimal illustration for each sentence using black ink on white background.\n" +
        "No commentary, just begin your explanation.\n" +
        "Keep going until you're done.";
      
      const result = await chat.current.sendMessageStream({
        message: promptMessage + additionalInstructions,
      });

      let currentText = '';
      let currentImageBase64 = null;
      const generatedSlides = [];

      for await (const chunk of result) {
        for (const candidate of chunk.candidates) {
          for (const part of candidate.content.parts ?? []) {
            if (part.text) {
              currentText += part.text;
            } else if (part.inlineData && part.inlineData.data) {
              currentImageBase64 = part.inlineData.data;
            }
            
            if (currentText.trim() && currentImageBase64) {
              // Add slide with image saved to server
              const slide = await addSlide(currentText, currentImageBase64, generationId);
              generatedSlides.push(slide);
              currentText = '';
              currentImageBase64 = null;
            }
          }
        }
      }
      
      if (currentText.trim() && currentImageBase64) {
        const slide = await addSlide(currentText, currentImageBase64, generationId);
        generatedSlides.push(slide);
      } else if (currentText.trim() && !currentImageBase64 && generatedSlides.length > 0) {
        const slideContent = await marked.parse(currentText);
        const textOnlySlide = { text: slideContent, image: null };
        generatedSlides.push(textOnlySlide);
        setSlides(prevSlides => [...prevSlides, textOnlySlide]);
      }
      
      if (generatedSlides.length > 0) {
        const newHistoryEntry = {
          id: generationId,
          prompt: promptMessage,
          slides: generatedSlides,
          timestamp: new Date().toISOString(),
        };

        // Update history with new entry
        const updatedHistory = [newHistoryEntry, ...generationHistory].slice(0, MAX_HISTORY_ITEMS);
        setGenerationHistory(updatedHistory);
        
        // Save to localStorage (with image references not base64)
        saveHistory(updatedHistory);
      }

    } catch (e) {
      console.error("Error generating explanation:", e);
      setError('Something went wrong: ' + parseGenAIError(e));
    } finally {
      setIsLoading(false);
      setUserInput('');
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    handleGenerate(userInput);
  };

  const handleExampleClick = (exampleText) => {
    setUserInput(exampleText);
  };

  const handleHistoryItemClick = async (historyItem) => {
    setUserInput(historyItem.prompt);
    setError('');
    setSelectedHistoryId(historyItem.id);
    setIsLoading(true);
    
    try {
      // Display slides from history
      setSlides(historyItem.slides);
      setModelResponseOutput('');
    } catch (error) {
      console.error("Error processing history item slides:", error);
      setError("Failed to load history item properly.");
    } finally {
      setIsLoading(false);
      if(slideshowRef.current) slideshowRef.current.scrollLeft = 0;
    }
  };

  const handleClearHistory = async () => {
    if (window.confirm("Are you sure you want to clear all generation history?")) {
      try {
        setGenerationHistory([]);
        setSelectedHistoryId(null);
        saveHistory([]);
        setError(''); // Clear any storage-related error messages
        
        // Clean up image files from the server
        try {
          await fetch('http://localhost:8000/api/files/cleanup-tinycats', { 
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            }
          });
        } catch (error) {
          console.error("Error cleaning up TinyCats images:", error);
        }
      } catch (error) {
        console.error("Error clearing history:", error);
      }
    }
  };

  if (!isVisible) {
    return null;
  }

  const examplePrompts = [
    "Explain how neural networks work.",
    "Explain how The Matrix works.",
    "Explain how spaghettification works.",
    "Explain how photosynthesis works.",
    "Explain what a black hole is."
  ];

  const mainContentIsScrollable = slides.length > 2 || modelResponseOutput || error;

  return (
    <div className={`TinyCatsModalOverlay ${theme}`}>
      <div className={`TinyCatsContainer ${theme}`}>
        <div className="TinyCatsHeader">
          <h2><Cat size={28} style={{ marginRight: '10px', verticalAlign: 'bottom' }} />Explain with Tiny Cats</h2>
          <button onClick={onClose} className="CloseButton" aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <div className="TinyCatsBody">
          <div className={`TinyCatsHistoryPanel ${theme}`}>
            <div className="HistoryHeader">
              <h3><History size={18} style={{marginRight: '8px'}}/> History</h3>
              {generationHistory.length > 0 && (
                <button onClick={handleClearHistory} className="ClearHistoryButton" title="Clear all history">
                  <Trash2 size={16} /> Clear All
                </button>
              )}
            </div>
            {generationHistory.length === 0 ? (
              <p className="NoHistoryMessage">No generations saved yet.</p>
            ) : (
              <ul>
                {generationHistory.map(item => (
                  <li 
                    key={item.id} 
                    onClick={() => handleHistoryItemClick(item)}
                    className={selectedHistoryId === item.id ? 'active' : ''}
                    tabIndex={0}
                    onKeyDown={(e) => e.key === 'Enter' && handleHistoryItemClick(item)}
                  >
                    <span className="HistoryPrompt">{item.prompt}</span>
                    <span className="HistoryTimestamp">{new Date(item.timestamp).toLocaleString()}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className={`TinyCatsMainContent ${theme} ${mainContentIsScrollable ? 'scrollable' : ''}`}>
            <p className="InstructionText">Enter a topic, and we'll explain it with a story about tiny cats and cute illustrations!</p>
            
            <div className="ExamplePrompts">
              <p>Try an example (click to load, then press Explain):</p>
              <ul>
                {examplePrompts.map((prompt, index) => (
                  <li key={index} onClick={() => handleExampleClick(prompt)} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && handleExampleClick(prompt)}>
                    {prompt}
                  </li>
                ))}
              </ul>
            </div>

            <form onSubmit={handleSubmit} className="InputForm">
              <textarea
                ref={inputRef}
                id="tinyCatsInput"
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                placeholder="e.g., Explain how black holes work..."
                rows={3}
                disabled={isLoading}
              />
              <button type="submit" disabled={isLoading || !userInput.trim()} className="GenerateButtonPill">
                {isLoading && slides.length === 0 ? (
                  <>
                    <Loader2 size={18} className="spin" /> Generating...
                  </>
                ) : isLoading && slides.length > 0 ? (
                  <>
                    <Loader2 size={18} className="spin" /> More Cats...
                  </>
                ) : (
                  <>
                    <Send size={18} /> Explain
                  </>
                )}
              </button>
            </form>

            {error && (
              <div className="ErrorMessage">
                <AlertTriangle size={20} style={{ marginRight: '8px' }} />
                {error}
              </div>
            )}

            {modelResponseOutput && !isLoading && slides.length === 0 && !error && (
              <div className="UserTurnOutput" dangerouslySetInnerHTML={{ __html: modelResponseOutput }}></div>
            )}
            
            {slides.length > 0 && (
              <div className="SlideshowWrapper">
                <h3>Cat Story Explanation:</h3>
                <div id="slideshow" ref={slideshowRef} className="Slideshow">
                  {slides.map((slide, index) => (
                    <div key={index} className="slide">
                      {slide.image && <img src={typeof slide.image === 'string' && slide.image.startsWith('data:') ? 
                        slide.image : 
                        `http://localhost:8000${slide.image}`} 
                        alt={'Illustration for slide ' + (index + 1)} />}
                      <div className="caption" dangerouslySetInnerHTML={{ __html: slide.text }}></div>
                    </div>
                  ))}
                </div>
              </div>
            )}
             {isLoading && slides.length > 0 && (
              <div className="LoadingMoreSlides">
                <Loader2 size={22} className="spin" />
                <p>Generating more slides...</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TinyCatsExplainView; 