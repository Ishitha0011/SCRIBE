import { Node, mergeAttributes } from '@tiptap/core';
import { Plugin, PluginKey } from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';

// Custom extension that extends CodeBlockLowlight
const customCodeBlock = CodeBlockLowlight.extend({
  addOptions() {
    return {
      ...this.parent?.(),
      HTMLAttributes: {
        class: 'tiptap-code-block',
      },
      languageClassPrefix: 'language-',
    };
  },

  addAttributes() {
    return {
      ...this.parent?.(),
      language: {
        default: null,
        parseHTML: element => element.getAttribute('data-language') || 'text',
        renderHTML: attributes => {
          return {
            'data-language': attributes.language || 'text',
            class: `language-${attributes.language || 'text'}`,
          };
        },
      }
    };
  },

  addNodeView() {
    return ({ node, editor, getPos }) => {
      const language = node.attrs.language || 'text';
      
      // Create DOM elements
      const dom = document.createElement('div');
      dom.classList.add('tiptap-code-block');
      dom.setAttribute('data-language', language);
      
      // Language header
      const languageHeader = document.createElement('div');
      languageHeader.classList.add('code-block-language');
      
      const languageName = document.createElement('span');
      languageName.classList.add('code-block-language-name');
      languageName.textContent = language.charAt(0).toUpperCase() + language.slice(1);
      
      const actions = document.createElement('div');
      actions.classList.add('code-block-actions');
      
      // Copy button
      const copyButton = document.createElement('button');
      copyButton.classList.add('code-block-action');
      copyButton.setAttribute('title', 'Copy');
      copyButton.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
        </svg>
      `;
      
      // Create pre and code elements
      const pre = document.createElement('pre');
      const code = document.createElement('code');
      code.setAttribute('data-language', language);
      code.classList.add(`language-${language}`);
      
      // Copy success indicator
      const copySuccess = document.createElement('div');
      copySuccess.classList.add('copy-success-indicator');
      copySuccess.textContent = 'Copied!';
      
      // Event handlers
      copyButton.addEventListener('click', (e) => {
        e.preventDefault();
        
        // Get the code content
        const codeContent = code.textContent;
        
        // Copy to clipboard
        navigator.clipboard.writeText(codeContent).then(() => {
          // Show success indicator
          copySuccess.classList.add('visible');
          copyButton.classList.add('copy-success');
          
          // Hide after 2 seconds
          setTimeout(() => {
            copySuccess.classList.remove('visible');
            copyButton.classList.remove('copy-success');
          }, 2000);
        }).catch(err => {
          console.error('Failed to copy code:', err);
        });
      });
      
      // Assemble the DOM structure
      actions.appendChild(copyButton);
      languageHeader.appendChild(languageName);
      languageHeader.appendChild(actions);
      
      pre.appendChild(code);
      
      dom.appendChild(languageHeader);
      dom.appendChild(copySuccess);
      dom.appendChild(pre);
      
      return {
        dom,
        contentDOM: code,
        
        update: (updatedNode) => {
          if (updatedNode.type !== node.type) {
            return false;
          }
          
          // Update language if changed
          const updatedLanguage = updatedNode.attrs.language || 'text';
          if (updatedLanguage !== language) {
            languageName.textContent = updatedLanguage.charAt(0).toUpperCase() + updatedLanguage.slice(1);
            code.setAttribute('data-language', updatedLanguage);
            code.className = `language-${updatedLanguage}`;
            dom.setAttribute('data-language', updatedLanguage);
          }
          
          return true;
        }
      };
    };
  },
});

export default customCodeBlock; 