import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { NodeViewWrapper, NodeViewContent } from '@tiptap/react';
import { ImageIcon, RefreshCw, AlertTriangle } from 'lucide-react';
import { useTheme } from '../ThemeContext';
import { config } from '../config';

export const FlashcardNodeView = ({ node, updateAttributes, editor }) => {
  const { term, definition, hasImage, imageUrl } = node.attrs;
  const [isFlipped, setIsFlipped] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [generatedImageUrl, setGeneratedImageUrl] = useState(imageUrl || '');
  const [imageError, setImageError] = useState('');
  const { theme } = useTheme();

  // Helper function to create a hash from the image data
  const createImageHash = async (data) => {
    // A simple hash function - in production you'd want something more robust
    let hash = 0;
    for (let i = 0; i < Math.min(data.length, 1000); i++) {
      hash = ((hash << 5) - hash) + data.charCodeAt(i);
      hash |= 0; // Convert to 32bit integer
    }
    return `${Date.now()}-${Math.abs(hash)}`;
  };
  
  // Helper to resolve image URL references
  const resolveImageUrl = (url) => {
    if (!url) return '';
    
    // Check if this is a storage reference
    if (url.startsWith('storage-ref:')) {
      const storageKey = url.substring(12); // Remove 'storage-ref:' prefix
      try {
        // Try to retrieve from sessionStorage
        const imageData = sessionStorage.getItem(storageKey);
        if (imageData) {
          // Determine mime type - default to jpeg if not specified
          const mimeType = url.includes('png') ? 'image/png' : 'image/jpeg';
          return `data:${mimeType};base64,${imageData}`;
        } else {
          console.error(`[FlashcardNodeView] Could not find image data for key ${storageKey}`);
          return '';
        }
      } catch (err) {
        console.error(`[FlashcardNodeView] Error retrieving image from storage:`, err);
        return '';
      }
    }
    
    // Regular data URL, just return as is
    return url;
  };

  // Sync generatedImageUrl with node attribute if it changes externally
  useEffect(() => {
    if (node.attrs.imageUrl !== generatedImageUrl) {
      console.log("[FlashcardNodeView] Syncing imageUrl from node attributes:", node.attrs.imageUrl);
      setGeneratedImageUrl(node.attrs.imageUrl || '');
    }
    if (node.attrs.hasImage && !node.attrs.imageUrl) {
      // If card is marked as having an image but URL is missing (e.g. error during previous load),
      // allow trying again.
      console.log("[FlashcardNodeView] Image marked as hasImage but URL is missing");
      setImageError("Image was expected but not found. Try generating again.");
    }
  }, [node.attrs.imageUrl, node.attrs.hasImage, generatedImageUrl]);
  
  // Ensure changes to generatedImageUrl are properly reflected in node attributes
  useEffect(() => {
    // Only update if there's a meaningful change and we're not in the middle of generating
    if (!isGeneratingImage && generatedImageUrl && generatedImageUrl !== node.attrs.imageUrl) {
      console.log("[FlashcardNodeView] Updating node attributes from state change");
      updateAttributes({
        imageUrl: generatedImageUrl,
        hasImage: true,
      });
    }
  }, [generatedImageUrl, isGeneratingImage, node.attrs.imageUrl, updateAttributes]);
  
  // Resolve the actual image URL for display
  const displayImageUrl = useMemo(() => {
    return resolveImageUrl(generatedImageUrl);
  }, [generatedImageUrl]);
  
  // Handle component cleanup
  useEffect(() => {
    return () => {
      // Clean up any references or resources
      if (generatedImageUrl && generatedImageUrl.startsWith('storage-ref:')) {
        // We don't actually remove the sessionStorage item on unmount
        // because other flashcards might be using the same reference
        console.log("[FlashcardNodeView] Component unmounting, storage references will be kept for potential reuse");
      }
    };
  }, [generatedImageUrl]);

  const handleFlip = () => {
    setIsFlipped(!isFlipped);
  };

  // Helper function to attempt image generation with a specific model
  const generateImageWithModel = async (modelId, apiKey, term) => {
    try {
      console.log(`[FlashcardNodeView] Attempting image generation with model: ${modelId}`);
      
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`, {
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
                  text: `Create a high-quality educational image that represents the concept: ${term}. Make it simple and not too detailed.`
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

      console.log(`[FlashcardNodeView] API response status for ${modelId}: ${response.status} ${response.statusText}`);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: `HTTP error: ${response.status}` }));
        console.error(`[FlashcardNodeView] API error response for ${modelId}:`, errorData);
        return null;
      }

      // Parse the JSON response directly
      const data = await response.json();
      
      // Extract the image data from the response
      let imageUrl = '';
      
      // Look for image content in the response
      if (data.candidates && data.candidates.length > 0 && data.candidates[0].content && data.candidates[0].content.parts) {
        const parts = data.candidates[0].content.parts;
        for (let i = 0; i < parts.length; i++) {
          const part = parts[i];
          if (part.inlineData && part.inlineData.mimeType && part.inlineData.mimeType.startsWith('image/') && part.inlineData.data) {
            const mimeType = part.inlineData.mimeType;
            
            // Determine if the image data is too large
            const base64Data = part.inlineData.data;
            if (base64Data.length > 500000) { // If larger than ~500KB
              console.log(`[FlashcardNodeView] Image data is large (${base64Data.length} bytes), compressing...`);
              
              // Create a small hash of the data instead of storing the whole image
              // This avoids localStorage quota issues
              const imageHash = await createImageHash(base64Data);
              
              // Store the actual image data in sessionStorage if possible
              try {
                const storageKey = `flashcard-image-${imageHash}`;
                // Try sessionStorage first (typically has larger quota)
                sessionStorage.setItem(storageKey, base64Data);
                console.log(`[FlashcardNodeView] Large image stored in sessionStorage with key ${storageKey}`);
                
                // Return a reference to the sessionStorage key instead of the full data
                return `storage-ref:${storageKey}`;
              } catch (storageError) {
                console.error("[FlashcardNodeView] Error storing image in sessionStorage:", storageError);
                // Fall back to using the direct data, but with reduced quality
                return `data:${mimeType};base64,${base64Data.substring(0, 500000)}`;
              }
            }
            
            // For smaller images, use the data URL directly
            imageUrl = `data:${mimeType};base64,${base64Data}`;
            console.log(`[FlashcardNodeView] Created image URL with mime type ${mimeType}, data length: ${part.inlineData.data.length}`);
            break;
          }
        }
      }
      
      return imageUrl;
    } catch (error) {
      console.error(`[FlashcardNodeView] Error with model ${modelId}:`, error);
      return null;
    }
  };

  const handleGenerateImage = async (event) => {
    event.stopPropagation(); // Prevent card flip
    if (!editor.isEditable) return;

    console.log(`[FlashcardNodeView] Starting image generation for term: "${node.attrs.term}"`);
    setIsGeneratingImage(true);
    setGeneratedImageUrl(''); // Clear previous image/error
    setImageError('');

    try {
      const apiKey = config.GEMINI_API_KEY;
      
      if (!apiKey || apiKey === 'your_api_key_here') {
        console.error("[FlashcardNodeView] Missing API key in config");
        throw new Error("Gemini API key not configured. Please update the API key in src/config.js");
      }
      
      console.log("[FlashcardNodeView] Making API request to Gemini image generation API");
      
      // First attempt with preview model
      let imageUrl = await generateImageWithModel('gemini-2.0-flash-preview-image-generation', apiKey, node.attrs.term);
      
      // If that fails, try with the standard model
      if (!imageUrl) {
        console.log("[FlashcardNodeView] Preview model failed, trying with standard model");
        imageUrl = await generateImageWithModel('gemini-2.0-flash-image-generation', apiKey, node.attrs.term);
      }

      if (imageUrl) {
        try {
          console.log(`[FlashcardNodeView] Setting image URL: ${imageUrl.substring(0, 30)}...`);
          // Set local state
          setGeneratedImageUrl(imageUrl);
          
          // Update the node attributes in the editor
          console.log("[FlashcardNodeView] Updating node attributes with image URL");
          updateAttributes({
            imageUrl: imageUrl,
            hasImage: true,
          });
        } catch (storageError) {
          console.error("[FlashcardNodeView] Error saving image to state or node:", storageError);
          // If we hit quota issues, try to handle it gracefully
          if (storageError.name === 'QuotaExceededError' || 
              storageError.message.includes('quota') || 
              storageError.message.includes('storage')) {
            
            // Try to use sessionStorage as a last resort
            try {
              const storageKey = `flashcard-emergency-${Date.now()}`;
              if (imageUrl.startsWith('data:')) {
                // Extract the base64 portion
                const base64Data = imageUrl.split(',')[1];
                sessionStorage.setItem(storageKey, base64Data);
                const newUrl = `storage-ref:${storageKey}`;
                
                setGeneratedImageUrl(newUrl);
                updateAttributes({
                  imageUrl: newUrl,
                  hasImage: true,
                });
                console.log("[FlashcardNodeView] Used emergency storage mechanism");
                return;
              }
            } catch (emergencyError) {
              console.error("[FlashcardNodeView] Emergency storage also failed:", emergencyError);
            }
            
            throw new Error("Browser storage is full. Try closing some tabs or clearing site data.");
          } else {
            throw storageError;
          }
        }
      } else {
        console.error("[FlashcardNodeView] No image data found in any API response");
        throw new Error('No image data received from Gemini API after multiple attempts.');
      }
    } catch (err) {
      console.error('[FlashcardNodeView] Error generating image:', err);
      setImageError(err.message || 'An unknown error occurred.');
      // Update attributes to reflect that image generation failed but was attempted
      updateAttributes({
        imageUrl: '',
        hasImage: true, // Mark as attempted, so button might hide or change
      });
    } finally {
      console.log("[FlashcardNodeView] Image generation process completed");
      setIsGeneratingImage(false);
    }
  };

  // More robust definition of showGenerateButton
  const showGenerateButton = useMemo(() => {
    // Always show the button, but disable it during generation
    return editor.isEditable && (!node.attrs.imageUrl || imageError);
  }, [editor.isEditable, node.attrs.imageUrl, imageError]);
  
  // Handle image loading errors
  const handleImageError = (e) => {
    console.error("[FlashcardNodeView] Image failed to load:", e);
    setImageError("Failed to load generated image. Try again.");
    
    // Only clear the URL if we're not already in an error state to avoid loops
    if (!imageError) {
      setGeneratedImageUrl('');
      // Also update node attributes to reflect the error
      updateAttributes({
        imageUrl: '',
        hasImage: true, // Still keep hasImage true to indicate an attempt was made
      });
    }
  };
  
  // Handle successful image loading
  const handleImageLoad = () => {
    console.log("[FlashcardNodeView] Image loaded successfully:", {
      size: generatedImageUrl.length,
      startsWith: generatedImageUrl.substring(0, 20)
    });
    
    // Clear any previous errors
    if (imageError) {
      setImageError('');
    }
  };

  // Debug the current state
  console.log("[FlashcardNodeView Render]", {
    term,
    hasImage,
    imageUrl: imageUrl || "(none)",
    generatedImageUrl: generatedImageUrl || "(none)",
    displayImageUrl: displayImageUrl ? `${displayImageUrl.substring(0, 30)}...` : "(none)",
    isGeneratingImage,
    isFlipped,
    imageError: imageError || "(none)",
    showGenerateButton
  });

  return (
    <NodeViewWrapper className="flashcard-node-wrapper" data-drag-handle>
      <div
        className={`Flashcard ${theme} ${isFlipped ? 'flipped' : ''} ${generatedImageUrl ? 'has-image-content' : ''}`}
        onClick={handleFlip}
        role="button"
        tabIndex={0}
        aria-pressed={isFlipped}
        aria-label={`Flashcard: ${term}. ${isFlipped ? 'Showing definition.' : 'Press to flip.'}`}
      >
        <div className="FlashcardInner">
          <div className="FlashcardFront">
            <div className="Term">{term}</div>
          </div>
          <div className={`FlashcardBack ${generatedImageUrl ? 'image-layout-active' : ''}`}>
            <div className="Definition">{definition}</div>
            <div className="FlashcardImageContainer">
              {isGeneratingImage && (
                <div className="ImageSpinnerContainer">
                  <RefreshCw size={30} className="ImageSpinner spinning" />
                  <p>Generating...</p>
                </div>
              )}
              {generatedImageUrl && !isGeneratingImage && displayImageUrl && (
                <img 
                  src={displayImageUrl} 
                  alt={`Generated for ${term}`} 
                  className="GeneratedImage" 
                  onError={handleImageError}
                  onLoad={handleImageLoad}
                  style={{maxWidth: "100%", maxHeight: "120px"}}
                />
              )}
              {(imageError || (generatedImageUrl && !displayImageUrl)) && !isGeneratingImage && (
                <div className="ImageError">
                  <AlertTriangle size={30} />
                  <p>{imageError || "Unable to load image data from storage."}</p>
                </div>
              )}
            </div>
            {showGenerateButton && (
              <button
                className={`GenerateImageButton ${isGeneratingImage ? 'generating' : ''}`}
                onClick={handleGenerateImage}
                disabled={isGeneratingImage}
                aria-label={`Generate image for ${term}`}
              >
                {isGeneratingImage ? (
                  <>
                    <RefreshCw size={18} className="spinning" />
                    <span>Generating...</span>
                  </>
                ) : (
                  <>
                    <ImageIcon size={18} />
                    <span>Generate Image</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </NodeViewWrapper>
  );
};

// Optional: If you want to ensure NodeViewContent is used for editable parts,
// you can wrap Term and Definition divs with it, but for simple text display it's not strictly necessary.
// <NodeViewContent className="Term" as="div" />
// <NodeViewContent className="Definition" as="div" />
// However, ensure your node schema defines these as non-editable or handle content updates appropriately
// if they were meant to be editable directly within the NodeView.
// For flashcards, typically term and definition are attributes set when the node is created. 