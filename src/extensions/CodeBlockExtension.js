import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from 'prosemirror-state';
import { Node as ProseMirrorNode } from 'prosemirror-model';
import { ReactNodeViewRenderer } from '@tiptap/react';
import CodeBlockComponent from '../components/CodeBlockComponent';
import hljs from 'highlight.js';

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

// Function to detect language from code content
function detectLanguage(code) {
  if (!code) return 'text';
  
  try {
    const result = hljs.highlightAuto(code, [
      'javascript', 'typescript', 'python', 'html', 'css', 'java', 
      'c', 'cpp', 'csharp', 'go', 'rust', 'ruby', 'php', 'swift'
    ]);
    
    return result.language || 'text';
  } catch (error) {
    console.error('Language detection error:', error);
    return 'text';
  }
}

export const CodeBlockExtension = Extension.create({
  name: 'customCodeBlock',

  addOptions() {
    return {
      lowlight: null,
    };
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('customCodeBlockPlugin'),
        props: {
          handlePaste: (view, event) => {
            const { state } = view;
            const { selection } = state;
            
            // Only process paste if we have clipboard data as text
            if (!event.clipboardData || !event.clipboardData.getData) {
              return false;
            }
            
            const text = event.clipboardData.getData('text/plain');
            if (!text) {
              return false;
            }
            
            // Check if this looks like a code block (has multiple lines or special characters)
            const isLikelyCode = text.includes('\n') && 
              (text.includes('{') || text.includes('function') || 
               text.includes('def ') || text.includes('class ') ||
               text.includes('import ') || text.includes('from ') ||
               text.includes('<') && text.includes('>') || // HTML-like
               text.includes('#include') || // C-like
               text.includes('package ') || // Java-like
               text.includes('using ') // C#-like
              );
            
            // If it doesn't look like code, let the default paste handler work
            if (!isLikelyCode) {
              return false;
            }
            
            // Check if we're already in a code block
            const isInCodeBlock = findParentNodeOfType(state.doc, selection.$from, 'codeBlock');
            if (isInCodeBlock) {
              return false; // Let the default handler work for pasting within code blocks
            }
            
            // Detect language from the pasted content
            const detectedLang = detectLanguage(text);
            
            // Create a code block with the pasted content
            const tr = state.tr;
            const codeBlock = state.schema.nodes.codeBlock.create(
              { language: detectedLang },
              state.schema.text(text)
            );
            
            tr.replaceSelectionWith(codeBlock);
            view.dispatch(tr);
            
            return true; // We handled the paste
          },
          
          // Handle triple backtick code block creation
          handleKeyDown: (view, event) => {
            // Check for backtick key
            if (event.key === '`') {
              const { state } = view;
              const { selection, doc } = state;
              const { $from } = selection;
              
              // Get the text before cursor in the current paragraph
              const textBefore = getTextBeforeCursor($from);
              
              // Check if we have exactly two backticks before this one (making it the third)
              if (textBefore.endsWith('``')) {
                // Check if there's a language identifier
                const paraText = getTextInCurrentParagraph($from);
                const match = paraText.match(/```(\w+)?$/);
                
                if (match) {
                  // Extract language if specified
                  const lang = match[1] ? normalizeLanguageName(match[1]) : 'text';
                  
                  // Create a code block replacing the current paragraph
                  const tr = state.tr;
                  const codeBlock = state.schema.nodes.codeBlock.create(
                    { language: lang },
                    state.schema.text('')
                  );
                  
                  // Delete the current paragraph and insert a code block
                  const paraStart = $from.start();
                  const paraEnd = $from.end();
                  
                  tr.delete(paraStart, paraEnd)
                    .insert(paraStart, codeBlock)
                    .setSelection(
                      state.selection.constructor.near(
                        tr.doc.resolve(paraStart + 1)
                      )
                    );
                  
                  view.dispatch(tr);
                  return true;
                }
              }
            }
            
            return false;
          }
        },
      }),
    ];
  },
  
  // Override the default code block with our custom component
  extendNodeSchema(extension) {
    const originalCodeBlock = extension.config.schema;
    
    if (originalCodeBlock && extension.name === 'codeBlock') {
      return {
        ...originalCodeBlock,
        toDOM: (node) => {
          return ['div', { class: 'tiptap-code-block', 'data-language': node.attrs.language || 'text' }, 
            ['pre', {}, ['code', {}, 0]]
          ];
        },
        parseDOM: [
          {
            tag: 'pre',
            preserveWhitespace: 'full',
            getAttrs: (node) => {
              let language = '';
              
              // Try to get language from code tag class
              if (node.querySelector('code')) {
                const codeElement = node.querySelector('code');
                const className = codeElement.getAttribute('class') || '';
                const languageMatch = className.match(/language-(\w+)/);
                
                if (languageMatch) {
                  language = normalizeLanguageName(languageMatch[1]);
                }
              }
              
              // If no language found, try to detect from content
              if (!language && node.textContent) {
                language = detectLanguage(node.textContent);
              }
              
              return { language };
            },
          },
          {
            tag: 'div.tiptap-code-block',
            preserveWhitespace: 'full',
            getAttrs: (node) => {
              const language = node.getAttribute('data-language') || 'text';
              return { language };
            },
            contentElement: 'code',
          },
        ],
      };
    }
    
    return {};
  },
});

// Helper function to find parent node of a specific type
function findParentNodeOfType(doc, $pos, nodeType) {
  for (let depth = $pos.depth; depth > 0; depth--) {
    const node = $pos.node(depth);
    if (node.type.name === nodeType) {
      return {
        node,
        pos: $pos.start(depth) - 1,
        depth,
      };
    }
  }
  return null;
}

// Helper function to get text before cursor in the current node
function getTextBeforeCursor($pos) {
  const { parentOffset, parent } = $pos;
  if (parent.isText) {
    return parent.text.slice(0, parentOffset);
  }
  return '';
}

// Helper function to get all text in the current paragraph
function getTextInCurrentParagraph($pos) {
  const node = $pos.parent;
  return node.textContent || '';
}

// Register the custom node view
export const CodeBlockNodeView = (options) => {
  return ReactNodeViewRenderer(CodeBlockComponent, {
    ...options,
  });
}; 