import React, { useState, useRef, memo, useCallback } from 'react';
import { X, Send } from 'lucide-react';
import { config } from '../config';

/**
 * FlashcardGeneratorUI Component
 * A popup interface for generating flashcards and inserting them directly into the editor
 */
const FlashcardGeneratorUI = ({ info, onCancel, theme, onFlashcardsGenerated, style, editor }) => {
  const [topic, setTopic] = useState(info.topic || '');
  const [error, setError] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const inputRef = useRef(null);

  // Function to generate images for flashcards using Gemini API
  const generateImageForTerm = useCallback(async (term) => {
    const apiKey = config.GEMINI_API_KEY;
    
    if (!apiKey || apiKey === 'your_api_key_here') {
      throw new Error("Gemini API key not configured. Please update the API key in src/config.js");
    }
    
    // Use the gemini-2.0-flash-preview-image-generation model with streamGenerateContent endpoint
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-preview-image-generation:streamGenerateContent?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              {
                text: `Create a high-quality educational image that represents the concept: ${term}`
              }
            ]
          }
        ],
        generationConfig: {
          responseModalities: ["IMAGE", "TEXT"],
          responseMimeType: "text/plain",
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to generate image: ${response.status} ${response.statusText}`);
    }

    // Handle the stream response
    const reader = response.body.getReader();
    let chunks = [];
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }

    // Combine chunks and parse the response
    const allChunks = new Uint8Array(chunks.reduce((acc, chunk) => acc + chunk.length, 0));
    let position = 0;
    for (const chunk of chunks) {
      allChunks.set(chunk, position);
      position += chunk.length;
    }
    
    const responseText = new TextDecoder().decode(allChunks);
    const responseLines = responseText.split('\n');

    // Extract the image data from the response
    let imageUrl = '';
    for (const line of responseLines) {
      if (line.trim() === '') continue;
      
      try {
        const data = JSON.parse(line);
        if (data.candidates && data.candidates[0]?.content?.parts) {
          for (const part of data.candidates[0].content.parts) {
            if (part.inlineData?.data) {
              imageUrl = `data:image/jpeg;base64,${part.inlineData.data}`;
              break;
            }
          }
        }
      } catch (e) {
        console.error('Error parsing response line:', e);
      }
      
      if (imageUrl) break;
    }

    if (!imageUrl) {
      throw new Error('No image data received from Gemini API.');
    }

    return imageUrl;
  }, []);

  const handleGenerateFlashcards = async () => {
    if (!topic.trim() || !editor) return;
    
    setIsGenerating(true);
    setError(null);
    setSuccessMessage('');
    
    try {
      const apiKey = config.GEMINI_API_KEY;
      
      if (!apiKey || apiKey === 'your_api_key_here') {
        throw new Error("Gemini API key not configured. Please update the API key in src/config.js");
      }
      
      // Call the Gemini API
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [{ text: `Create 15 flashcards about "${topic}". Each flashcard should have a term and a definition. Format your response as a JSON array with objects having 'term' and 'definition' fields.` }]
            }
          ],
          generationConfig: {
            temperature: 0.7,
            topK: 32,
            topP: 1,
            maxOutputTokens: 1024,
          }
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to generate flashcards');
      }
      
      const data = await response.json();
      
      if (!data.candidates || !data.candidates[0]?.content?.parts?.[0]?.text) {
        throw new Error('Invalid response format from API');
      }
      
      const responseText = data.candidates[0].content.parts[0].text;
      
      // Extract JSON from the response text (it might be surrounded by markdown code block)
      let jsonMatch = responseText.match(/```json\n([\s\S]*?)\n```/) || 
                      responseText.match(/```\n([\s\S]*?)\n```/) ||
                      [null, responseText];
      
      const jsonText = jsonMatch[1] || responseText;
      
      try {
        const parsedFlashcards = JSON.parse(jsonText);
        if (!Array.isArray(parsedFlashcards)) {
          throw new Error('Response is not an array');
        }
        
        // Insert flashcard set into the editor
        if (editor && parsedFlashcards.length > 0) {
          // Create the flashcard nodes with the onGenerateImage property
          const flashcardNodes = parsedFlashcards.map(card => ({
            type: 'flashcardNode',
            attrs: {
              term: card.term,
              definition: card.definition,
              hasImage: false,
              imageUrl: '',
              // Note: We can't pass the function directly as an attribute
              // The flashcard node will use the generateImageForTerm function during rendering
            }
          }));
          
          editor.chain().focus().insertContent({
            type: 'flashcardSet',
            attrs: { topic },
            content: flashcardNodes
          }).run();
        }
        
        // Call the callback with generated flashcards (for compatibility with old code)
        if (onFlashcardsGenerated) {
          // Pass the generateImageForTerm function to enable image generation
          const flashcardsWithImageFn = parsedFlashcards.map(card => ({
            ...card,
            onGenerateImage: generateImageForTerm
          }));
          onFlashcardsGenerated(flashcardsWithImageFn);
        }
        
        // Show success message and close the popup
        setSuccessMessage('Flashcards inserted into the editor');
        setTimeout(() => {
          setTopic('');
          onCancel(); // Close the popup after success
        }, 1500);
      } catch (jsonError) {
        console.error('Failed to parse JSON:', jsonError, 'Raw text:', jsonText);
        throw new Error('Could not parse the flashcard data');
      }
    } catch (error) {
      console.error('Error generating flashcards:', error);
      setError(error.message || 'Failed to generate flashcards');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className={`FlashcardGeneratorUI ${theme === 'dark' ? 'dark' : ''}`} style={style}>
      <div className="GeneratorHeader">
        <span>Generate Flashcards</span>
        <button className="CloseButton" onClick={onCancel} disabled={isGenerating}>
          <X size={14} />
        </button>
      </div>
      
      <div className="GeneratorInputContainer">
        <textarea
          ref={inputRef}
          className="TopicInput"
          placeholder="Enter a topic to generate flashcards about..."
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          disabled={isGenerating}
        />
        
        <button 
          className="GenerateButton"
          onClick={handleGenerateFlashcards}
          disabled={isGenerating || !topic.trim()}
        >
          {isGenerating ? (
            <span className="ProcessingIndicator"></span>
          ) : (
            <Send size={16} />
          )}
        </button>
        
        {error && (
          <div className="ErrorMessage">
            {error}
          </div>
        )}
        
        {successMessage && (
          <div className="SuccessMessage">
            {successMessage}
          </div>
        )}
      </div>
    </div>
  );
};

export default memo(FlashcardGeneratorUI); 