import AIChatNode from '../components/nodes/AIChatNode';
import AIOutputNode from '../components/nodes/AIOutputNode';
import YouTubeNode from '../components/nodes/YouTubeNode';
import WebScraperNode from '../components/nodes/WebScraperNode';

// Register all available nodes
export const nodeTypes = {
  aiChat: AIChatNode,
  aiOutput: AIOutputNode,
  youtube: YouTubeNode,
  webScraper: WebScraperNode
};

// Node configuration for the library
export const nodeConfig = {
  aiChat: {
    type: 'aiChat',
    label: 'AI Chat',
    category: 'AI',
    description: 'Process text with AI'
  },
  aiOutput: {
    type: 'aiOutput',
    label: 'AI Output',
    category: 'AI',
    description: 'Display AI responses'
  },
  youtube: {
    type: 'youtube',
    label: 'YouTube',
    category: 'Media',
    description: 'Analyze YouTube videos'
  },
  webScraper: {
    type: 'webScraper',
    label: 'Web Scraper',
    category: 'Media',
    description: 'Extract content from websites'
  }
}; 