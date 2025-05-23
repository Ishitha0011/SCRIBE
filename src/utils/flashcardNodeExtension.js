import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { FlashcardNodeView } from '../components/FlashcardNodeView';

export const FlashcardNode = Node.create({
  name: 'flashcardNode',
  
  group: 'block',
  
  content: '',
  
  draggable: true,
  
  isolating: true,
  
  addAttributes() {
    return {
      term: {
        default: '',
      },
      definition: {
        default: '',
      },
      hasImage: {
        default: false,
      },
      imageUrl: {
        default: '',
      },
    };
  },
  
  parseHTML() {
    return [
      {
        tag: 'div[data-type="flashcard"]',
      },
    ];
  },
  
  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes({ 'data-type': 'flashcard' }, HTMLAttributes)];
  },
  
  addNodeView() {
    return ReactNodeViewRenderer(FlashcardNodeView);
  },
});

export const FlashcardSetNode = Node.create({
  name: 'flashcardSet',
  
  group: 'block',
  
  content: 'flashcardNode*',
  
  draggable: true,
  
  isolating: true,
  
  addAttributes() {
    return {
      topic: {
        default: '',
      },
    };
  },
  
  parseHTML() {
    return [
      {
        tag: 'div[data-type="flashcard-set"]',
      },
    ];
  },
  
  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes({ 'data-type': 'flashcard-set', class: 'flashcard-set' }, HTMLAttributes), 0];
  },
});

export default { FlashcardNode, FlashcardSetNode }; 