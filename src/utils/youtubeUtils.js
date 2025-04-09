/**
 * Utility functions for handling YouTube videos
 */

/**
 * Extract YouTube video ID from different URL formats
 * @param {string} url - YouTube URL
 * @returns {string|null} - YouTube video ID or null if invalid
 */
export const getYouTubeVideoId = (url) => {
  if (!url) return null;
  
  // Regular expressions for different YouTube URL formats
  const patterns = [
    // Standard URL: https://www.youtube.com/watch?v=VIDEO_ID
    /(?:youtube\.com\/watch\?v=|youtube\.com\/watch\?.+&v=)([^&]+)/,
    // URL with timestamp: https://www.youtube.com/watch?v=VIDEO_ID&t=123
    /(?:youtube\.com\/watch\?t=.+&v=)([^&]+)/,
    // Embed URL: https://www.youtube.com/embed/VIDEO_ID
    /(?:youtube\.com\/embed\/)([^/?]+)/,
    // Shortened URL: https://youtu.be/VIDEO_ID
    /(?:youtu\.be\/)([^/?]+)/
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }

  return null;
};

/**
 * Fetch YouTube video title using oEmbed API
 * @param {string} url - YouTube URL
 * @returns {Promise<string>} - YouTube video title
 */
export const extractYouTubeTitle = async (url) => {
  try {
    const videoId = getYouTubeVideoId(url);
    if (!videoId) return 'YouTube Video';

    const oEmbedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
    const response = await fetch(oEmbedUrl);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch video title. Status: ${response.status}`);
    }
    
    const data = await response.json();
    return data.title || 'YouTube Video';
  } catch (error) {
    console.error('Error fetching YouTube title:', error);
    return 'YouTube Video';
  }
};

/**
 * Generate YouTube embed URL
 * @param {string} videoId - YouTube video ID
 * @returns {string} - Embed URL
 */
export const getYouTubeEmbedUrl = (videoId) => {
  if (!videoId) return '';
  return `https://www.youtube.com/embed/${videoId}`;
};

/**
 * Generate YouTube thumbnail URL
 * @param {string} videoId - YouTube video ID
 * @param {string} quality - Thumbnail quality (default, hqdefault, mqdefault, sddefault, maxresdefault)
 * @returns {string} - Thumbnail URL
 */
export const getYouTubeThumbnailUrl = (videoId, quality = 'hqdefault') => {
  if (!videoId) return '';
  return `https://img.youtube.com/vi/${videoId}/${quality}.jpg`;
}; 