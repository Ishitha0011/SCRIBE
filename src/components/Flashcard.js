import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Image as ImageIcon, RefreshCw, AlertTriangle } from 'lucide-react';
// import '../css/Flashcard.css'; // We will create this later

const Flashcard = ({ term, definition, onGenerateImage, theme }) => {
  const [isFlipped, setIsFlipped] = useState(false);
  const [imageData, setImageData] = useState(null);
  const [isImageLoading, setIsImageLoading] = useState(false);
  const [imageError, setImageError] = useState(null);
  const [showImageButton, setShowImageButton] = useState(true);

  const cardBackRef = useRef(null);

  const handleFlip = () => {
    setIsFlipped(!isFlipped);
  };

  const handleGenerateImage = async (event) => {
    event.stopPropagation(); // Prevent card flip when clicking button
    if (!onGenerateImage || isImageLoading) return;

    setIsImageLoading(true);
    setImageError(null);
    
    if (cardBackRef.current) {
        cardBackRef.current.classList.remove('image-layout-active');
    }

    try {
      // onGenerateImage should return a base64 data URL for the image directly
      const generatedImageData = await onGenerateImage(term);
      
      // Check if the response is valid
      if (!generatedImageData || typeof generatedImageData !== 'string' || !generatedImageData.startsWith('data:')) {
        throw new Error('Invalid image data returned');
      }
      
      setImageData(generatedImageData);
      setShowImageButton(false); // Hide button after successful generation
      
      if (cardBackRef.current) {
        cardBackRef.current.classList.add('image-layout-active');
      }
    } catch (err) {
      console.error(`Error generating image for ${term}:`, err);
      setImageError(err.message || 'Failed to load image.');
      setShowImageButton(true); // Show button again on error
      if (cardBackRef.current) {
        cardBackRef.current.classList.remove('image-layout-active');
      }
    } finally {
      setIsImageLoading(false);
    }
  };

  return (
    <div 
      className={`Flashcard ${isFlipped ? 'flipped' : ''} ${theme === 'dark' ? 'dark' : ''}`}
      onClick={handleFlip}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && handleFlip()}
      tabIndex={0}
      role="button"
      aria-pressed={isFlipped}
      aria-label={`Flashcard: ${term}. ${isFlipped ? `Definition: ${definition}` : 'Press to see definition.'}`}
    >
      <div className="FlashcardInner">
        <div className="FlashcardFront">
          <div className="Term">{term}</div>
        </div>
        <div className="FlashcardBack" ref={cardBackRef}>
          <div className="Definition">{definition}</div>
          <div className="FlashcardImageContainer">
            {isImageLoading && (
              <div className="ImageSpinner">
                <RefreshCw size={24} className="spinning" />
              </div>
            )}
            {imageError && !isImageLoading && (
              <div className="ImageError">
                <AlertTriangle size={20} />
                <span>{imageError.substring(0,100)}</span>
              </div>
            )}
            {imageData && !isImageLoading && !imageError && (
              <img src={imageData} alt={`Generated for ${term}`} className="GeneratedImage" />
            )}
          </div>
          {showImageButton && !isImageLoading && (
            <button 
              className="GenerateImageButton" 
              onClick={handleGenerateImage} 
              disabled={isImageLoading}
              aria-label={`Generate image for ${term}`}
            >
              <ImageIcon size={18} />
              <span>Generate Image</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default Flashcard; 