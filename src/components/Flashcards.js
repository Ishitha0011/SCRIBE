import React, { useState, useEffect } from 'react';
import { GoogleGenerativeAI } from '@google/generative-ai';
import '../css/Flashcards.css'; // Import the CSS file

const Flashcards = () => {
  // State Management
  const [topic, setTopic] = useState('');
  const [flashcards, setFlashcards] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // API Initialization
  // Ensure REACT_APP_GEMINI_API_KEY is set in your .env file for this to work
  const ai = new GoogleGenerativeAI({apiKey: process.env.REACT_APP_GEMINI_API_KEY});

  const handleGenerateFlashcards = async () => {
    if (!topic.trim()) {
      setError("Please enter a topic.");
      return;
    }
    setIsLoading(true);
    setError(null);
    setFlashcards([]); // Clear previous flashcards

    const prompt = `Generate a concise list of key terms and their definitions related to the topic "${topic}". 
      Each item should be in the format: Term: Definition. 
      Provide at least 5 items.
      Focus on fundamental concepts.
      Example for "JavaScript Data Types":
      String: A sequence of characters used to represent text.
      Number: Represents both integer and floating-point numbers.
      Boolean: Represents a logical entity and can have two values: true or false.
      Null: Represents the intentional absence of any object value.
      Undefined: Indicates that a variable has not been assigned a value.`;

    try {
      const model = ai.getGenerativeModel({ model: 'gemini-1.5-flash-latest' }); // Corrected model name
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = await response.text();

      const lines = text.split('\n').filter(line => line.trim() !== '');
      const newFlashcards = lines.map((line, index) => {
        const parts = line.split(':');
        if (parts.length >= 2) {
          const term = parts[0].trim();
          const definition = parts.slice(1).join(':').trim();
          return {
            id: `card-${Date.now()}-${index}`, // More robust key
            term,
            definition,
            isFlipped: false,
            imageUrl: null,
            imageLoading: false,
            imageError: null,
          };
        }
        return null;
      }).filter(card => card !== null);

      if (newFlashcards.length === 0 && lines.length > 0) {
        setError("Could not parse any flashcards from the response. The AI might have returned an unexpected format. Please try a different topic or rephrase.");
      } else if (newFlashcards.length === 0) {
        setError("No flashcards generated. The topic might be too specific or the AI couldn't find relevant information. Please try again.");
      }
      setFlashcards(newFlashcards);

    } catch (err) {
      console.error("Error generating flashcards:", err);
      setError(`Failed to generate flashcards. ${err.message || 'Please check your API key and network connection, then try again.'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const generateImageForCard = async (cardIndex, term) => {
    if (!term) {
      setFlashcards(flashcards.map((card, i) => 
        i === cardIndex ? { ...card, imageError: 'Cannot generate image for an empty term.' } : card
      ));
      return;
    }

    setFlashcards(flashcards.map((card, i) => 
      i === cardIndex ? { ...card, imageLoading: true, imageError: null, imageUrl: null } : card
    ));

    const imagePrompt = `A clear, simple, and illustrative image representing: "${term}". Focus on the core concept. White background if possible.`;

    // Placeholder for image generation:
    // This function will be updated to make a fetch request to a backend endpoint.
    // The backend endpoint will handle the actual image generation using Google Cloud's
    // Vertex AI Imagen or a similar service, and will require its own API key
    // configuration separate from the client-side Gemini key.
    // For now, it simulates an error or a placeholder state.
    try {
      // Simulate an API call delay for realism if needed
      // await new Promise(resolve => setTimeout(resolve, 1000));

      // The following lines implement the placeholder behavior:
      // Set an error message indicating client-side SDK limitations for direct image generation.
      console.warn("Image generation with the current client-side setup (gemini-1.5-flash-latest via @google/generative-ai) for direct text-to-image is not standard. This function is a placeholder and would typically call a backend service for Imagen access.");
      setFlashcards(flashcards.map((card, i) =>
        i === cardIndex ? { ...card, imageError: 'Image generation for this term is not supported with the current client-side AI model configuration. A backend service is required for this feature.', imageLoading: false } : card
      ));

    } catch (err) {
      // This catch block would handle errors if an actual API call was made.
      // For the placeholder, it's less likely to be triggered unless the simulation itself has an error.
      console.error(`Error in placeholder image generation for "${term}":`, err);
      setFlashcards(flashcards.map((card, i) => 
        i === cardIndex ? { ...card, imageError: `Failed to generate image. ${err.message || ''}`, imageLoading: false } : card
      ));
    }
  };

  const toggleFlip = (index) => {
    setFlashcards(flashcards.map((card, i) => 
      i === index ? { ...card, isFlipped: !card.isFlipped } : card
    ));
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>AI Flashcard Generator</h1>
      </header>
      <main className="app-main">
        <div className="input-area">
          <textarea
            id="topicInput"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="Enter a topic (e.g., 'JavaScript Data Types', 'Photosynthesis Process', 'Impressionist Painters')"
          ></textarea>
          <button id="generateButton" onClick={handleGenerateFlashcards} disabled={isLoading}>
            {isLoading ? (
              <>
                <svg className="loading-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12,1A11,11,0,1,0,23,12,11,11,0,0,0,12,1Zm0,19a8,8,0,1,1,8-8A8,8,0,0,1,12,20Z" opacity=".25"/><path d="M10.14,1.16a11,11,0,0,0-9,8.92A1.59,1.59,0,0,0,2.46,12,1.52,1.52,0,0,0,4.11,10.7a8,8,0,0,1,6.66-6.61A1.42,1.42,0,0,0,12,2.69h0A1.57,1.57,0,0,0,10.14,1.16Z" className="spinner_ajPY"/></svg>
                Generating...
              </>
            ) : (
              <>
                <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="currentColor"><path d="M13.548 3.487a.75.75 0 0 0-1.096 0L3.866 12l8.586 8.513a.75.75 0 0 0 1.096-1.026L5.52 12.5h14.73a.75.75 0 0 0 0-1.5H5.52l8.028-7.987a.75.75 0 0 0 0-1.026Z"></path></svg>
                Generate Flashcards
              </>
            )}
          </button>
        </div>

        {isLoading && (
          <div id="loadingSpinner" className="loading-spinner">
            <svg className="loading-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12,1A11,11,0,1,0,23,12,11,11,0,0,0,12,1Zm0,19a8,8,0,1,1,8-8A8,8,0,0,1,12,20Z" opacity=".25"/><path d="M10.14,1.16a11,11,0,0,0-9,8.92A1.59,1.59,0,0,0,2.46,12,1.52,1.52,0,0,0,4.11,10.7a8,8,0,0,1,6.66-6.61A1.42,1.42,0,0,0,12,2.69h0A1.57,1.57,0,0,0,10.14,1.16Z" className="spinner_ajPY"/></svg>
          </div>
        )}

        {error && (
          <div id="errorMessage" className="error-message">
            {error}
          </div>
        )}

        <div id="flashcardsContainer" className="flashcards-container">
          {flashcards.map((card, index) => (
            <div 
              key={card.id} // Changed to card.id for a more robust key
              className={`flashcard ${card.isFlipped ? 'flipped' : ''}`}
              onClick={() => toggleFlip(index)}
            >
              <div className="flashcard-inner">
                <div className="flashcard-front">
                  <div className="term">{card.term}</div>
                </div>
                <div className={`flashcard-back ${card.imageUrl ? 'image-layout-active' : ''}`}>
                  <div className="definition">{card.definition}</div>
                  <div className="flashcard-image-container">
                    {card.imageLoading && (
                       <div className="loading-spinner small">
                           <svg className="loading-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12,1A11,11,0,1,0,23,12,11,11,0,0,0,12,1Zm0,19a8,8,0,1,1,8-8A8,8,0,0,1,12,20Z" opacity=".25"/><path d="M10.14,1.16a11,11,0,0,0-9,8.92A1.59,1.59,0,0,0,2.46,12,1.52,1.52,0,0,0,4.11,10.7a8,8,0,0,1,6.66-6.61A1.42,1.42,0,0,0,12,2.69h0A1.57,1.57,0,0,0,10.14,1.16Z" className="spinner_ajPY"/></svg>
                       </div>
                    )}
                    {card.imageError && <div className="error-message small">{card.imageError}</div>}
                    {card.imageUrl && !card.imageError && <img src={card.imageUrl} alt={card.term} className="flashcard-image" />}
                  </div>
                  {!card.imageUrl && !card.imageLoading && !card.imageError && (
                    <button 
                      className="generate-image-button" 
                      onClick={(e) => {
                        e.stopPropagation(); // Prevent card flip
                        generateImageForCard(index, card.term);
                      }}
                      disabled={card.imageLoading || !card.term} // Disable if no term or loading
                    >
                      <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="currentColor"><path d="M12 2c2.76 0 5 2.24 5 5s-2.24 5-5 5-5-2.24-5-5 2.24-5 5-5zm0 1.5c-1.93 0-3.5 1.57-3.5 3.5S10.07 10.5 12 10.5s3.5-1.57 3.5-3.5S13.93 3.5 12 3.5zm0 8.5c-3.86 0-7 3.14-7 7v1h14v-1c0-3.86-3.14-7-7-7zm0 1.5c2.99 0 5.48 2.22 5.92 5H6.08c.44-2.78 2.93-5 5.92-5z"></path></svg>
                      Generate Image
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
};

export default Flashcards;
