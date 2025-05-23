import React, { useCallback, useEffect, useState } from 'react';
import { NodeViewWrapper } from '@tiptap/react';
import { FiCopy } from 'react-icons/fi';
import hljs from 'highlight.js';
import 'highlight.js/styles/atom-one-dark.css';
import { normalizeLanguageName } from '../extensions/CodeBlockExtension';

const CodeBlockComponent = ({ node, updateAttributes, editor }) => {
  const [copied, setCopied] = useState(false);
  const [highlighted, setHighlighted] = useState('');
  
  const language = node.attrs.language || 'text';
  const normalizedLanguage = normalizeLanguageName(language);
  
  // Get the code content
  const getContent = useCallback(() => {
    return node.content.content.map(n => {
      return n.text || '';
    }).join('');
  }, [node.content]);
  
  // Apply syntax highlighting
  useEffect(() => {
    const code = getContent();
    
    try {
      if (normalizedLanguage === 'text') {
        setHighlighted(code);
      } else {
        const highlighted = hljs.highlight(code, { 
          language: normalizedLanguage,
          ignoreIllegals: true 
        }).value;
        
        setHighlighted(highlighted);
      }
    } catch (error) {
      console.error('Highlighting error:', error);
      setHighlighted(code);
    }
  }, [normalizedLanguage, getContent]);
  
  // Handle copy button click
  const handleCopy = useCallback(() => {
    const content = getContent();
    navigator.clipboard.writeText(content)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(err => {
        console.error('Failed to copy:', err);
      });
  }, [getContent]);
  
  return (
    <NodeViewWrapper className="tiptap-code-block" data-language={normalizedLanguage}>
      <div className="code-block-language">
        <div className="code-block-language-name">{normalizedLanguage}</div>
        <div className="code-block-actions">
          <button 
            className={`code-block-action ${copied ? 'copy-success' : ''}`} 
            onClick={handleCopy} 
            title="Copy code"
          >
            <FiCopy size={16} />
          </button>
        </div>
      </div>
      
      <pre>
        {highlighted ? (
          <code 
            className={`language-${normalizedLanguage}`}
            dangerouslySetInnerHTML={{ __html: highlighted }}
          />
        ) : (
          <code className={`language-${normalizedLanguage}`}>{getContent()}</code>
        )}
      </pre>
      
      {copied && (
        <div className={`copy-success-indicator ${copied ? 'visible' : ''}`}>
          Copied!
        </div>
      )}
    </NodeViewWrapper>
  );
};

export default CodeBlockComponent; 