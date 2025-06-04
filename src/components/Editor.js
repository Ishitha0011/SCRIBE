/* eslint-disable */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Plus, X, Save, FileText, Clock, Hash, Type, AlertCircle, FileCog, Bold, Italic, Underline, Code, List, ListOrdered, CheckSquare, Link as LinkIcon, Image as ImageIcon, AlignLeft, AlignCenter, AlignRight, Table as TableIcon, Heading1, Heading2, Heading3, Highlighter, Trash2, ArrowUpToLine, ArrowDownToLine, ArrowLeftToLine, ArrowRightToLine, Pilcrow, Palette, CaseUpper, CaseLower, Strikethrough, Subscript, Superscript, Sigma, CornerUpLeft, ChevronDown, CaseSensitive, Brain, HelpCircle, Send, Edit, Check, PlayCircle, Terminal, RefreshCw, Zap, Layers, Cat } from 'lucide-react';
import { useEditor, EditorContent, BubbleMenu, FloatingMenu } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import CharacterCount from '@tiptap/extension-character-count';
import UnderlineExtension from '@tiptap/extension-underline';
import LinkExtension from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import TextAlign from '@tiptap/extension-text-align';
import Highlight from '@tiptap/extension-highlight';
import TableExtension from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { createLowlight } from 'lowlight';
import { common, createStarryNight } from '@wooorm/starry-night';
import { useTheme } from '../ThemeContext';
import { useFileContext } from '../FileContext';
import Switch from './ui/Switch';
import NotesCanvas from './NotesCanvas';
import ImageAnalysisPanel from './ImageAnalysisPanel';
import FlashcardGeneratorUI from './FlashcardGeneratorUI';
import YouTubeHelperUI from './YouTubeHelperUI';
import TinyCatsExplainView from './TinyCatsExplainView';
import { getYouTubeVideoId, extractYouTubeTitle, analyzeYoutubeVideo, extractCodeFromYoutube } from '../utils/youtubeUtils';
import { config } from '../config';
import '../css/Editor.css';
import customCodeBlock from '../utils/codeBlockExtension';

// New Extensions
import TextStyle from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import FontFamily from '@tiptap/extension-font-family';
import Strike from '@tiptap/extension-strike';
import SubscriptExtension from '@tiptap/extension-subscript';
import SuperscriptExtension from '@tiptap/extension-superscript';
import MathExtension from '@aarkue/tiptap-math-extension'; // Community Math Extension
import 'katex/dist/katex.min.css'; // Import KaTeX CSS
import { FlashcardNode, FlashcardSetNode } from '../utils/flashcardNodeExtension';

// Create a lowlight instance with common languages
const lowlight = createLowlight();

// Register common languages for syntax highlighting
async function loadLanguages() {
  try {
    const starryNight = await createStarryNight(common);
    const grammars = starryNight.grammars;
    
    // Add grammars to lowlight
    for (const grammar of grammars) {
      const languageName = grammar.scopeName.split('.').pop();
      if (languageName) {
        lowlight.register(languageName, {
          grammar,
          names: [languageName],
        });
      }
    }
    console.log('Loaded syntax highlighting for common languages');
  } catch (error) {
    console.error('Failed to load syntax highlighting:', error);
  }
}

// Initialize language support
loadLanguages();

const Editor = () => {
  const [localContent, setLocalContent] = useState('');
  const [charCount, setCharCount] = useState(0);
  const [wordCount, setWordCount] = useState(0);
  const [lastSaved, setLastSaved] = useState(null);
  const [unsavedChanges, setUnsavedChanges] = useState({});
  
  const [canvasData, setCanvasData] = useState({});
  const [canvasMode, setCanvasMode] = useState(false);
  
  const [fontFamily, setFontFamily] = useState('');
  const [fontSize, setFontSize] = useState('');
  
  const [analysisPanel, setAnalysisPanel] = useState({
    isVisible: false,
    content: '',
    position: { top: 0, left: 0 },
    isLoading: false,
  });
  
  const [imageQueryUI, setImageQueryUI] = useState({
    isVisible: false,
    position: { top: 0, left: 0 },
    query: '',
    isProcessing: false
  });
  
  // New state for Notion-style AI helper
  const [showAiChat, setShowAiChat] = useState(false);
  const [aiChatPosition, setAiChatPosition] = useState({ top: 0, left: 0 });
  const [aiChatQuery, setAiChatQuery] = useState('');
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  
  // Keeping the aiChatUI for backward compatibility (to be removed later)
  const [aiChatUI, setAiChatUI] = useState({
    isVisible: false,
    position: { top: 0, left: 0 },
    query: '',
    isProcessing: false,
    response: '',
    shouldInsert: false,
    isNotionStyle: true
  });
  
  // New state for text improvement UI
  const [textImproveUI, setTextImproveUI] = useState({
    isVisible: false,
    position: { top: 0, left: 0 },
    selectedText: '',
    prompt: '',
    mode: 'improve', // 'improve' or 'custom'
    isProcessing: false
  });
  
  const [autoSaveInterval, setAutoSaveInterval] = useState(60000); // 1 minute in milliseconds
  const [lastAutoSave, setLastAutoSave] = useState(null);

  const [youtubeHelperInfo, setYoutubeHelperInfo] = useState({
    mode: 'analyzer', // 'analyzer' or 'coder'
    link: '',
    customPrompt: '',
    position: { top: 0, left: 0 },
    isVisible: false,
    isProcessing: false,
    response: null,
  });
  
  // New state for Flashcard Generator
  const [flashcardGeneratorInfo, setFlashcardGeneratorInfo] = useState({
    topic: '',
    position: { top: 0, left: 0 },
    isVisible: false,
    isProcessing: false, // This can be removed if isLoading in the popup is sufficient
    flashcards: [], // This can be removed if data is passed directly to editor
    error: null,
  });
  
  // State for TinyCatsExplainView
  const [tinyCatsExplainViewVisible, setTinyCatsExplainViewVisible] = useState(false);
  
  const { theme } = useTheme();
  const {
    openFiles,
    activeFileId,
    fileContents,
    openFile,
    closeFile,
    saveFile,
    updateFileContent,
    updateFileType,
    autoSaveChanges
  } = useFileContext();

  const tabsLeftRef = useRef(null);
  const editorContainerRef = useRef(null);
  const editorInstanceRef = useRef(null);

  // Memoized handleImageUpload using editorInstanceRef
  const handleImageUpload = useCallback(async (file) => {
    const currentEditor = editorInstanceRef.current;
    if (!currentEditor || !activeFileId) return;

    const activeFile = openFiles.find(f => f.id === activeFileId);
    const timestamp = new Date().getTime();
    const fileName = file.name || `image_${timestamp}.png`;

    try {
      const formData = new FormData();
      formData.append('file', file, fileName);
      const response = await fetch('http://localhost:8000/api/files/upload', {
        method: 'POST',
        body: formData,
      });
      if (!response.ok) throw new Error(`Failed to upload image: ${response.statusText}`);
      const data = await response.json();
      const imageUrl = `http://localhost:8000${data.path}`;
      currentEditor.chain().focus().setImage({ src: imageUrl, alt: fileName }).run();
    } catch (error) {
      console.error('Error uploading image:', error);
      alert(`Failed to upload image: ${error.message}`);
    }
  }, [activeFileId, openFiles]);

  // Memoized onUpdate callback
  const onUpdate = useCallback(({ editor: tiptapEditor }) => {
    if (!tiptapEditor) return;
    const htmlContent = tiptapEditor.getHTML();
      setLocalContent(htmlContent);
    setCharCount(tiptapEditor.storage.characterCount.characters());
    setWordCount(tiptapEditor.storage.characterCount.words());

      if (activeFileId && htmlContent !== fileContents[activeFileId]) {
        setUnsavedChanges((prev) => ({ ...prev, [activeFileId]: true }));
      } else if (activeFileId) {
        setUnsavedChanges((prev) => {
          const updated = { ...prev };
          delete updated[activeFileId];
          return updated;
        });
      }
    setFontFamily(tiptapEditor.getAttributes('textStyle').fontFamily || '');
    setFontSize(tiptapEditor.getAttributes('textStyle').fontSize || '');

    // Reposition panel if visible and image is active
    if (analysisPanel.isVisible && tiptapEditor.isActive('image')) {
      repositionAnalysisPanel(tiptapEditor);
    }
  }, [activeFileId, fileContents, analysisPanel.isVisible, setLocalContent, setCharCount, setWordCount, setUnsavedChanges, setFontFamily, setFontSize]);

  // Memoized editorProps - without handleKeyDown
  const editorProps = useMemo(() => ({
      attributes: {
        class: 'rich-text-editor',
        spellcheck: 'true',
      },
      handlePaste: (view, event, slice) => {
        const items = Array.from(event.clipboardData?.items || []);
        let imagePasted = false;
        items.forEach(item => {
          if (item.type.startsWith('image/')) {
            imagePasted = true;
            event.preventDefault();
            const file = item.getAsFile();
            if (file) {
              handleImageUpload(file);
            }
            return false;
          }
        });
      if (imagePasted) return true;
      return false;
    }
  }), [handleImageUpload]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
        paragraph: {
          HTMLAttributes: {
            class: 'editor-paragraph'
          }
        },
        hardBreak: {
          keepMarks: true
        },
        codeBlock: false, // We'll use our custom code block extension instead
        strike: false, // Use Strike extension separately
        bold: { HTMLAttributes: { class: 'font-bold' } }, // Optional: add classes for Tailwind/utility CSS
        italic: { HTMLAttributes: { class: 'italic' } },
      }),
      Image.configure({
        inline: false,
        allowBase64: false,
        HTMLAttributes: {
          class: 'markdown-image',
        },
      }).extend({
        addAttributes() {
          return {
            ...this.parent?.(),
            src: { default: null },
            alt: { default: null },
            title: { default: null },
            width: { default: null },
            height: { default: null },
            'data-align': {
              default: 'center',
              parseHTML: element => element.getAttribute('data-align') || 'center',
              renderHTML: attributes => ({
                'data-align': attributes['data-align'],
              }),
            },
            'data-ai-content': { // Attribute to store AI analysis
              default: null,
              parseHTML: element => element.getAttribute('data-ai-content'),
              renderHTML: attributes => {
                if (attributes['data-ai-content']) {
                  return { 'data-ai-content': attributes['data-ai-content'] };
                }
                return {};
              },
            },
          };
        },
      }),
      UnderlineExtension,
      LinkExtension.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'tiptap-link',
          rel: 'noopener noreferrer',
        },
      }),
      Placeholder.configure({
        placeholder: 'Write, press Space for AI, \'/\' for commands...',
        emptyEditorClass: 'is-editor-empty',
      }),
      TextAlign.configure({
        types: ['heading', 'paragraph'],
        alignments: ['left', 'center', 'right'],
        defaultAlignment: 'left',
      }),
      Highlight.configure({
        multicolor: true,
      }),
      TableExtension.configure({
        resizable: false,
        HTMLAttributes: {
          class: 'tiptap-table',
        },
      }),
      TableRow,
      TableHeader,
      TableCell,
      TaskList.configure({
        HTMLAttributes: {
          class: 'tiptap-task-list',
        },
      }),
      TaskItem.configure({
        nested: true,
        HTMLAttributes: {
          class: 'tiptap-task-item',
        },
      }),
      customCodeBlock.configure({
        lowlight,
        HTMLAttributes: {
          class: 'tiptap-code-block',
        },
      }),
      CharacterCount,
      
      // Added Extensions
      TextStyle,
      Color.configure({ types: ['textStyle'] }),
      FontFamily.configure({ types: ['textStyle'] }),
      Strike,
      SubscriptExtension,
      SuperscriptExtension,
      MathExtension.configure({}),
      
      // Flashcard Extensions
      FlashcardNode,
      FlashcardSetNode,
    ],
    content: '',
    onUpdate,    // Pass memoized onUpdate
    editorProps, // Pass memoized editorProps
  });

  // Effect to keep editorInstanceRef updated with the editor from useEditor
  useEffect(() => {
    if (editor) {
      editorInstanceRef.current = editor;
    }
  }, [editor]);

  // Move handleShowAiChat definition before checkForAiTrigger
  // New function to handle showing AI chat UI
  const handleShowAiChat = useCallback(() => {
    if (showAiChat || isAiProcessing) return;
    
    // Get cursor position for the AI helper
    const editorView = editor?.view;
    if (!editorView) return;
    
    const { from } = editorView.state.selection;
    const start = editorView.coordsAtPos(from);
    
    // Get editor container to calculate positioning
    const editorContainer = document.querySelector('.ProseMirror');
    if (!editorContainer) return;
    
    const containerRect = editorContainer.getBoundingClientRect();
    
    // Get viewport information
    const viewportHeight = window.innerHeight;
    const editorScrollTop = editorContainerRef.current?.scrollTop || 0;
    
    // Calculate the available space below the cursor
    const spaceBelow = viewportHeight - (start.top + editorScrollTop - window.scrollY);
    
    // Calculate initial top position (30px below cursor)
    let topPosition = start.top - containerRect.top + 30;
    
    // If we're close to the bottom of the viewport, position it above the cursor instead
    if (spaceBelow < 400) { // 400px is an approximate space needed for the component
      topPosition = Math.max(20, start.top - containerRect.top - 350); // Position above cursor with some space
      
      // If we're too far down in the document, scroll the editor up to make room
      if (editorContainerRef.current && topPosition > viewportHeight - 400) {
        const targetScrollTop = editorScrollTop + (topPosition - (viewportHeight - 500));
        // Smooth scroll to the better position
        editorContainerRef.current.scrollTo({
          top: targetScrollTop,
          behavior: 'smooth'
        });
        
        // Adjust the position after scrolling
        topPosition = Math.min(topPosition, viewportHeight - 420);
      }
    }
    
    // Ensure topPosition is never negative
    topPosition = Math.max(20, topPosition);
    
    // Set position relative to editor container
    const position = {
      top: topPosition,
      left: 0, // Start from left edge as we're spanning full width
    };
    
    setAiChatPosition(position);
    setAiChatQuery('');
    setShowAiChat(true);
  }, [editor, showAiChat, isAiProcessing]);

  // Function to check if space was pressed at the beginning of a line or empty document
  const checkForAiTrigger = useCallback((view, event) => {
    if (!event || event.key !== ' ') return false;
    
    const { state } = view;
    const { selection } = state;
    const { $from } = selection;
    
    // Check if we're at the beginning of a paragraph or document
    const isAtStartOfDoc = $from.pos === 1;
    const isAtStartOfParagraph = $from.nodeBefore === null && $from.parent.type.name === 'paragraph';
    
    // Also check if the paragraph is empty or only has a space
    const paragraphIsEmpty = isAtStartOfParagraph && $from.parent.textContent.trim() === '';
    
    const shouldTrigger = isAtStartOfDoc || (isAtStartOfParagraph && paragraphIsEmpty);
    
    if (shouldTrigger) {
      // Prevent the default space insertion
            event.preventDefault();
      
      // Remove the slash if it's there (though for space trigger it shouldn't be)
      const slashPos = $from.pos - 1;
      const charAtOriginalPos = state.doc.textBetween(slashPos, slashPos + 1, '\0');
      
      if (charAtOriginalPos === '/') {
        view.dispatch(state.tr.delete(slashPos, slashPos + 1));
      }
      
      // Show the AI helper
      handleShowAiChat();
    }
    
    return shouldTrigger;
  }, [handleShowAiChat]);

  // Legacy function to handle AI chat query submission
  const handleSubmitAiQuery = useCallback(async () => {
    if (!editor || !aiChatUI.query.trim()) return;
    
    setAiChatUI(prev => ({ ...prev, isProcessing: true }));
    
    try {
      const response = await fetch('http://localhost:8000/api/ai-chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          user_prompt: aiChatUI.query,
          system_prompt: "You are a helpful writing assistant." 
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.response && aiChatUI.shouldInsert) {
        // Insert the AI's response at the current cursor position
        editor.chain().focus().insertContent(result.response).run();
        
        // Hide the AI chat UI
        setAiChatUI(prev => ({ ...prev, isVisible: false, isProcessing: false }));
      } else {
        setAiChatUI(prev => ({
          ...prev,
          response: result.response || 'No response from AI',
          isProcessing: false
        }));
      }
    } catch (error) {
      console.error('Error in AI chat:', error);
      setAiChatUI(prev => ({
        ...prev,
        isProcessing: false,
        response: `Error: ${error.message}`
      }));
    }
  }, [editor, aiChatUI.query, aiChatUI.shouldInsert]);

  // Function to trigger "Ask AI" dialog from a slash command
  const handleAskAi = useCallback(() => {
    if (!editor) return;
    
    // First, delete the slash that triggered the command
    const { state, view } = editor;
    const { selection } = state;
    const { $from } = selection;
    const slashPos = $from.pos - 1;
    const charAtOriginalSlashPos = state.doc.textBetween(slashPos, slashPos + 1, '\0');
    
    if (charAtOriginalSlashPos === '/') {
      editor.chain().deleteRange({ from: slashPos, to: slashPos + 1 }).run();
    }
    
    // Then, show the AI chat UI
    handleShowAiChat();
  }, [editor, handleShowAiChat]);

  // Function to show text improvement UI
  const handleShowTextImproveUI = useCallback(() => {
    if (!editor) return;
    
    const { state, view } = editor;
    const { selection } = state;
    const { empty, from, to } = selection;
    
    // Only proceed if there's text selected
    if (empty) return;
    
    // Get the selected text
    const selectedText = state.doc.textBetween(from, to, ' ');
    if (!selectedText.trim()) return;
    
    // Store selection info for repositioning during scroll events
    const selectionInfo = { from, to };
    
    // Get position for the UI
    if (editorContainerRef.current) {
      const endCoords = view.coordsAtPos(to);
      const editorRect = editorContainerRef.current.getBoundingClientRect();
      const containerHeight = editorContainerRef.current.clientHeight;
      const scrollTop = editorContainerRef.current.scrollTop;
      const scrollLeft = editorContainerRef.current.scrollLeft;
      const viewportHeight = window.innerHeight;
      
      // Calculate position with awareness of viewport boundaries
      const uiHeight = 210; // Approximate height of the UI with some padding
      const uiWidth = 320; // Width of the UI
      
      // Calculate available space below selection
      const spaceBelow = viewportHeight - (endCoords.bottom - editorRect.top + scrollTop);
      
      // Calculate initial position
      let topPosition = endCoords.bottom - editorRect.top + scrollTop;
      
      // If the UI would extend beyond the bottom of the viewport, position it above the selection
      if (spaceBelow < uiHeight) {
        topPosition = endCoords.top - editorRect.top + scrollTop - uiHeight;
        
        // If positioning above would push it off-screen at the top, scroll up
        if (topPosition < 0) {
          const targetScrollTop = scrollTop + topPosition - 20; // Add some padding
          editorContainerRef.current.scrollTo({
            top: Math.max(0, targetScrollTop),
            behavior: 'smooth'
          });
          
          // Adjust position to account for scrolling
          topPosition = Math.max(20, topPosition);
        }
      }
      
      // Calculate left position to ensure it's fully visible
      let leftPosition = endCoords.left - editorRect.left + scrollLeft;
      const maxLeftPosition = editorRect.width - uiWidth - 20;
      
      // Center the UI on shorter text selections
      if (endCoords.left - view.coordsAtPos(from).left < uiWidth / 2) {
        const selectionCenter = (view.coordsAtPos(from).left + endCoords.left) / 2;
        leftPosition = selectionCenter - editorRect.left + scrollLeft - (uiWidth / 2);
      }
      
      // If the UI would extend beyond the right edge, align it to the right
      if (leftPosition > maxLeftPosition) {
        leftPosition = maxLeftPosition;
      }
      
      // Make sure the UI is never positioned off-screen on the left
      leftPosition = Math.max(20, leftPosition);
      
      setTextImproveUI({
        isVisible: true,
        position: {
          top: topPosition,
          left: leftPosition,
        },
        selectedText,
        prompt: '', // Default empty prompt
        mode: 'improve', // Default to improve mode
        isProcessing: false,
        selectionInfo // Store selection info for repositioning
      });
    }
  }, [editor]);
  
  // Function to handle submission of text improvement
  const handleSubmitTextImprove = useCallback(async () => {
    if (!editor || !textImproveUI.selectedText.trim()) return;
    
    setTextImproveUI(prev => ({ ...prev, isProcessing: true }));
    
    // Determine the right prompt based on the mode
    const finalPrompt = textImproveUI.mode === 'improve' 
      ? `Improve this text: ${textImproveUI.selectedText}`
      : `${textImproveUI.prompt}\nText: ${textImproveUI.selectedText}`;
    
    try {
      const response = await fetch('http://localhost:8000/api/ai-chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          user_prompt: finalPrompt,
          system_prompt: "You are a helpful writing assistant. Provide improved or transformed text based on the user's request. Return ONLY the improved text without explanations or additional comments."
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.response) {
        // Replace the selected text with the improved version
        const { state } = editor;
        const { selection } = state;
        const { from, to } = selection;
        
        editor.chain()
              .focus()
              .deleteRange({ from, to })
              .insertContent(result.response)
              .run();
      }

      setTextImproveUI(prev => ({
        ...prev,
        isVisible: false,
        isProcessing: false
      }));

    } catch (error) {
      console.error('Error processing text improvement:', error);
      setTextImproveUI(prev => ({ 
        ...prev, 
        isProcessing: false
      }));
      
      // Show an error message
      if (editor) {
        const { view } = editor;
        window.alert(`Error improving text: ${error.message}`);
      }
    }
  }, [editor, textImproveUI]);

  // Now, redefine the editorProps with handleKeyDown
  const editorPropsWithKeyHandler = useMemo(() => ({
    ...editorProps,
    handleKeyDown: (view, event) => {
      // Check for space key to trigger AI chat at beginning of line/document
      if (event.key === ' ') {
        // checkForAiTrigger now does all the work internally, including showing AI chat UI
        return checkForAiTrigger(view, event);
      }
      return false;
    }
  }), [editorProps, checkForAiTrigger]);
  
  // Update the editor with the new props
  useEffect(() => {
    if (editor) {
      editor.setOptions({
        editorProps: editorPropsWithKeyHandler
      });
    }
  }, [editor, editorPropsWithKeyHandler]);

  // Helper function to execute a command and then remove the triggering slash
  const executeCommandAndRemoveSlash = useCallback((commandFn) => {
    if (!editor) return;

    const { state, view } = editor;
    const { selection } = state;
    const { $from } = selection;

    // Position of the slash. Assumes cursor is right after the slash.
    const slashPos = $from.pos - 1;

    // Execute the primary command (e.g., toggle heading, insert table)
    commandFn();

    // After the command, get the latest state and try to delete the slash
    // We need to ensure the editor is still focused and the document hasn't changed too drastically
    // such that the original slashPos is no longer valid or the character isn't a slash.
    editor.view.focus(); // Re-focus just in case the command changed it
    const latestState = editor.state;
    const charAtOriginalSlashPos = latestState.doc.textBetween(slashPos, slashPos + 1, '\0');

    if (charAtOriginalSlashPos === '/') {
      editor.chain().deleteRange({ from: slashPos, to: slashPos + 1 }).run();
    }
  }, [editor]);

  const addYoutubeVideo = useCallback(() => {
    if (!editor) return;
    
    const url = prompt('Enter YouTube URL:');
    if (!url) return;
    
    // Extract video ID from URL
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    
    if (match && match[2].length === 11) {
      const videoId = match[2];
      const embedHTML = `<iframe width="560" height="315" src="https://www.youtube.com/embed/${videoId}" frameborder="0" allowfullscreen></iframe>`;
      editor.chain().focus().setContent(embedHTML, { parseOptions: { preserveWhitespace: false } }).run();
    } else {
      alert('Invalid YouTube URL');
    }
  }, [editor]);

  const createTable = useCallback(() => {
    // This function will be wrapped by executeCommandAndRemoveSlash
    if (!editor) return;
    editor.chain().focus().insertTable({ rows: 2, cols: 2, withHeaderRow: true }).run();
  }, [editor]);

  const checkCanvasFile = useCallback((file) => {
    if (!file) return;
    
    // If editor is not available or destroyed, default to not canvas mode and exit.
    if (!editor || editor.isDestroyed) {
      setCanvasMode(false);
      return;
    }
    
    const isCanvasType = file.type === 'canvas';
    const hasCanvasExtension = file.name && file.name.toLowerCase().endsWith('.canvas');
    
    if (isCanvasType || hasCanvasExtension) {
      setCanvasMode(true);
      editor.setEditable(false); // Safe due to the guard above
      try {
        const canvasContent = fileContents[file.id] || '{}';
        const parsedData = JSON.parse(canvasContent);
        if (!parsedData.nodes || !parsedData.edges) {
          const initialData = { nodes: [], edges: [], format: "canvas", version: "1.0" };
          updateFileContent(file.id, JSON.stringify(initialData));
          setCanvasData(initialData); // Ensure canvasData state is updated
        } else {
          setCanvasData(parsedData); // Ensure canvasData state is updated
        }
        if (!isCanvasType) {
          updateFileType(file.id, 'canvas');
        }
      } catch (error) {
        console.error('Error parsing canvas data in checkCanvasFile:', error);
        const initialData = { nodes: [], edges: [], format: "canvas", version: "1.0" };
        updateFileContent(file.id, JSON.stringify(initialData));
        setCanvasData(initialData); // Ensure canvasData state is updated on error
      }
    } else {
      setCanvasMode(false);
      editor.setEditable(true); // Safe due to the guard above
    }
  }, [editor, fileContents, updateFileContent, updateFileType, setCanvasMode, setCanvasData]);

  // Auto-save timer
  useEffect(() => {
    const autoSaveTimer = setInterval(async () => {
      if (Object.keys(unsavedChanges).length > 0) {
        try {
          // If editor is actively being used, capture the latest content for the active file
          if (editor && !editor.isDestroyed && activeFileId && unsavedChanges[activeFileId]) {
            // First update file content with latest editor content
            if (canvasMode) {
              const canvasContent = JSON.stringify(canvasData);
              updateFileContent(activeFileId, canvasContent);
            } else {
              const htmlContent = editor.getHTML();
              updateFileContent(activeFileId, htmlContent);
            }
          }
          
          // Then trigger auto-save
          await autoSaveChanges();
          setLastAutoSave(new Date());
        } catch (error) {
          console.error('Error during auto-save:', error);
        }
      }
    }, autoSaveInterval);

    return () => clearInterval(autoSaveTimer);
  }, [unsavedChanges, autoSaveChanges, autoSaveInterval, openFiles, editor, activeFileId, canvasMode, canvasData, updateFileContent]);

  // Manual save function with updated logic
  const handleSaveFile = useCallback(async () => {
    if (activeFileId && editor) {
      let success = false;
      if (canvasMode) {
        const canvasContent = JSON.stringify(canvasData);
        const activeFile = openFiles.find(f => f.id === activeFileId);
        if (activeFile && activeFile.isNew && !activeFile.name.toLowerCase().endsWith('.canvas')) {
          const newName = `${activeFile.name}.canvas`;
          const updatedFile = {
            ...activeFile,
            name: newName
          };
          const updatedOpenFiles = openFiles.map(f => 
            f.id === activeFileId ? updatedFile : f
          );
          openFiles.splice(0, openFiles.length, ...updatedOpenFiles);
        }
        
        success = await saveFile(activeFileId, canvasContent);
      } else {
        const htmlContent = editor.getHTML();
        success = await saveFile(activeFileId, htmlContent);
      }

      if (success) {
        setUnsavedChanges((prev) => {
           const updated = { ...prev };
           delete updated[activeFileId];
           return updated;
         });
        setLastSaved(new Date());
      } else {
         alert('Failed to save file.');
      }
    }
  }, [activeFileId, editor, canvasMode, canvasData, saveFile, openFiles, fileContents]);

  useEffect(() => {
    if (!editor) {
      // Editor instance from useEditor might not be available on initial renders.
      return;
    }

    // If the editor instance has been destroyed (e.g., by closing the last tab),
    // reset relevant states and do not attempt further editor operations.
    if (editor.isDestroyed) {
      setLocalContent('');
      setCharCount(0);
      setWordCount(0);
      setUnsavedChanges(prev => {
        const newState = {...prev};
        if(activeFileId) delete newState[activeFileId]; // Clear unsaved for current if any
        return newState;
      });
      if (canvasMode) setCanvasMode(false); // Ensure canvas mode is also reset
      return;
    }

    // Editor is valid and not destroyed, proceed with normal logic.
      if (activeFileId && fileContents[activeFileId] !== undefined) {
        const contentToLoad = fileContents[activeFileId];
        const file = openFiles.find(f => f.id === activeFileId);
        
        if (file) {
          const isCanvasFile = file.type === 'canvas' || 
                            (file.name && file.name.toLowerCase().endsWith('.canvas'));
          
          if (isCanvasFile) {
            console.log("Opening canvas file:", file.name);
            setCanvasMode(true);
            if (file.type !== 'canvas') {
              updateFileType(file.id, 'canvas');
            }
            try {
              const parsedData = typeof contentToLoad === 'string' && contentToLoad.trim()
                ? JSON.parse(contentToLoad)
                : { nodes: [], edges: [], format: "canvas", version: "1.0" };
              setCanvasData(parsedData);
            editor.setEditable(false); 
            } catch (error) {
              console.error('Error parsing canvas data:', error);
              const initialData = { nodes: [], edges: [], format: "canvas", version: "1.0" };
              updateFileContent(file.id, JSON.stringify(initialData));
              setCanvasData(initialData);
            }
          } else {
          // Ensure we are not in canvasMode if it's not a canvas file before calling checkCanvasFile
          if (canvasMode) setCanvasMode(false); 
          editor.setEditable(true); // Set editable before checkCanvasFile if not canvas
          checkCanvasFile(file); // checkCanvasFile might alter canvasMode or editable status further

          // Re-check canvasMode as checkCanvasFile might have changed it
          // This effect will re-run if canvasMode changes and is in deps.
          // The primary purpose here is to set content if not in canvas mode.
          if (!isCanvasFile && !canvasMode) { // Double check it's not canvas & not in canvas mode
              if (contentToLoad !== editor.getHTML()) { 
                  try {
                      editor.commands.setContent(contentToLoad || '', false); 
                      setLocalContent(contentToLoad || '');
                  } catch (error) {
                      console.error('Error setting editor content:', error);
                  }
              }
          }
        }
          setUnsavedChanges((prev) => {
            const updated = { ...prev };
            delete updated[activeFileId];
            return updated;
          });
        }
      } else {
      // No active file (activeFileId is null or content is undefined).
      try {
        if (!editor.isDestroyed) { // Guard again, though top-level guard should catch it
        editor.commands.setContent('', false);
        }
        setLocalContent('');
      } catch (error) {
        console.error('Error clearing editor content (no active file):', error);
      }
      if (canvasMode) setCanvasMode(false);
        setUnsavedChanges({});
      }
      
    try {
      if (!editor.isDestroyed) {
      setCharCount(editor.storage.characterCount?.characters() || 0);
      setWordCount(editor.storage.characterCount?.words() || 0);
      } else {
        setCharCount(0);
        setWordCount(0);
      }
    } catch (error) {
      console.error('Error updating character/word count:', error);
      setCharCount(0);
      setWordCount(0);
    }
  }, [activeFileId, fileContents, editor, openFiles, checkCanvasFile, updateFileType, canvasMode, updateFileContent, setCanvasData, setLocalContent, setCharCount, setWordCount, setUnsavedChanges]);

  useEffect(() => {
    if (editor) {
      editor.setEditable(!canvasMode);
    }
  }, [canvasMode, editor]);
  
  useEffect(() => {
    if (activeFileId && tabsLeftRef.current) {
      const activeTab = tabsLeftRef.current.querySelector('.Tab.active');
      if (activeTab) {
        const tabsContainer = tabsLeftRef.current;
        const tabRect = activeTab.getBoundingClientRect();
        const containerRect = tabsContainer.getBoundingClientRect();
        
        if (tabRect.left < containerRect.left || tabRect.right > containerRect.right) {
          const scrollLeft = activeTab.offsetLeft - (tabsContainer.clientWidth / 2) + (activeTab.clientWidth / 2);
          tabsContainer.scrollTo({ left: scrollLeft, behavior: 'smooth' });
        }
      }
    }
  }, [activeFileId]);

  useEffect(() => {
    const tabsContainer = tabsLeftRef.current;
    if (!tabsContainer) return;

    const checkScroll = () => {
      if (tabsContainer.scrollLeft > 0) {
        tabsContainer.classList.add('can-scroll-left');
      } else {
        tabsContainer.classList.remove('can-scroll-left');
      }

      if (tabsContainer.scrollLeft + tabsContainer.clientWidth < tabsContainer.scrollWidth) {
        tabsContainer.classList.add('can-scroll-right');
      } else {
        tabsContainer.classList.remove('can-scroll-right');
      }
    };

    checkScroll();

    tabsContainer.addEventListener('scroll', checkScroll);

    const resizeObserver = new ResizeObserver(checkScroll);
    resizeObserver.observe(tabsContainer);

    return () => {
      tabsContainer.removeEventListener('scroll', checkScroll);
      resizeObserver.disconnect();
    };
  }, [openFiles]);
  
  useEffect(() => {
    const handleKeyDown = async (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (activeFileId) {
          await handleSaveFile();
        }
      }
      
      if ((e.ctrlKey || e.metaKey) && e.key === 'w') {
        e.preventDefault();
        if (activeFileId) {
          handleTabClose(activeFileId);
        }
      }
      
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        handleNewFile();
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [activeFileId, editor, canvasMode, handleSaveFile]);

  const handleNewFile = () => {
    const newTab = {
      id: `new-${Date.now()}`,
      name: 'Untitled',
      type: 'file',
      isNew: true,
    };
    openFile(newTab);
  };

  const handleNewCanvas = () => {
    const canvasName = prompt('Enter a name for your new canvas:');
    
    if (!canvasName || canvasName.trim() === '') {
      return;
    }
    
    const formattedName = canvasName.toLowerCase().endsWith('.canvas') 
      ? canvasName 
      : `${canvasName}.canvas`;
    
    const newCanvasId = `canvas-${Date.now()}`;
    console.log('Creating new canvas with ID:', newCanvasId);
    
    setCanvasMode(true);
    const initialCanvasData = { 
      nodes: [], 
      edges: [], 
      format: "canvas", 
      version: "1.0",
      created: new Date().toISOString()
    };
    setCanvasData(initialCanvasData);
    
    const newCanvas = {
      id: newCanvasId,
      name: formattedName,
      type: 'canvas',
      isNew: true,
    };
    
    updateFileContent(newCanvasId, JSON.stringify(initialCanvasData));
    
    openFile(newCanvas);
  };

  const handleTabClick = (id) => {
    if (id !== activeFileId) {
      if (activeFileId) {
        if (canvasMode) {
          const canvasContent = JSON.stringify(canvasData);
          updateFileContent(activeFileId, canvasContent);
          if (canvasData.isDirty) {
            setUnsavedChanges({ ...unsavedChanges, [activeFileId]: true });
          }
        } else if (editor && unsavedChanges[activeFileId]) {
          updateFileContent(activeFileId, editor.getHTML());
        }
      }
      
      openFile(openFiles.find(file => file.id === id));
    }
  };

  const handleTabClose = async (id) => {
    if (unsavedChanges[id]) {
      if (window.confirm('You have unsaved changes. Do you want to save before closing?')) {
        const file = openFiles.find(f => f.id === id);
        if (file.type === 'canvas') {
          const canvasContent = JSON.stringify(canvasData);
          await saveFile(id, canvasContent);
        } else if (editor && !editor.isDestroyed) { // Guard editor access
          const contentToSave = (id === activeFileId) ? editor.getHTML() : fileContents[id];
          await saveFile(id, contentToSave);
        } else if (editor && editor.isDestroyed && fileContents[id]) {
          // If editor is destroyed but we have cached content, save that.
          await saveFile(id, fileContents[id]);
        }
      }
    }

    const isLastTab = openFiles.length === 1 && activeFileId === id;

    if (isLastTab) {
      if (editor && !editor.isDestroyed) {
        try {
          editor.destroy();
        } catch (error) {
          console.error('Error destroying Tiptap editor instance on last tab close:', error);
        }
      }
    }
    
    closeFile(id); // This triggers state update and potential DOM unmounting
  };

  const handleCanvasSave = (canvasFlow) => {
    if (activeFileId) {
      setCanvasData(canvasFlow);
      const canvasContent = JSON.stringify(canvasFlow);
      updateFileContent(activeFileId, canvasContent);
      
      const updatedUnsavedChanges = { ...unsavedChanges };
      delete updatedUnsavedChanges[activeFileId];
      setUnsavedChanges(updatedUnsavedChanges);
      
      setLastSaved(new Date());
    }
  };

  const getFileExtension = () => {
    if (!activeFileId) return '';
    const activeFile = openFiles.find(file => file.id === activeFileId);
    if (!activeFile) return '';
    if (activeFile.type === 'canvas') return 'CANVAS';
    const parts = activeFile.name.split('.');
    return parts.length > 1 ? parts.pop().toUpperCase() : '';
  };

  const getLastSavedTime = () => {
    if (!lastSaved && !lastAutoSave) return 'Never';
    
    const lastSaveTime = lastSaved ? lastSaved : lastAutoSave;
    const now = new Date();
    const diff = Math.floor((now - lastSaveTime) / 1000);
    
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} hours ago`;
    return lastSaveTime.toLocaleTimeString();
  };

  const addLink = useCallback(() => {
    if (!editor) return;
    
    const url = prompt('Enter URL:');
    if (!url) return;
    
    // Check if there's text selected
    if (editor.view.state.selection.empty) {
      // If no selection, insert the URL as a link
      editor.chain().focus().insertContent(`<a href="${url}" target="_blank">${url}</a>`).run();
    } else {
      // If there's a selection, turn the selected text into a link
      editor.chain().focus().setLink({ href: url, target: '_blank' }).run();
    }
  }, [editor]);

  const addMathBlock = useCallback(() => {
    if (!editor) return;
    // Note: The community extension @aarkue/tiptap-math-extension primarily focuses on *inline* math with $...$.
    // Creating a dedicated math *block* might require a custom node or different configuration.
    // For now, let's insert an empty paragraph and instruct the user to type $...$.
    editor.chain().focus().insertContent('<p>Type math here using $...$</p>').run();
  }, [editor]);

  // Add a cleanup effect to destroy editor on unmount
  useEffect(() => {
    const currentEditorInstance = editor; // Capture the editor instance from this render
    return () => {
      // Clean up the editor properly when component unmounts or editor instance changes
      if (currentEditorInstance && !currentEditorInstance.isDestroyed) {
        currentEditorInstance.destroy();
      }
    };
  }, [editor]); // Dependency on editor instance from useEditor

  // Add a handler for empty workspace
  useEffect(() => {
    if (openFiles.length === 0) {
      if (editor && !editor.isDestroyed) {
        // If editor exists and is not destroyed, ensure it's clean and states are reset.
        // Content clearing would ideally happen in handleTabClose or the main activeFileId effect.
        // Here, primarily focus on resetting React state.
      } 
      // Always reset these states if no files are open, regardless of editor status.
      setLocalContent('');
      setCharCount(0);
      setWordCount(0);
      if (canvasMode) setCanvasMode(false);
      setUnsavedChanges({}); // Clear all unsaved changes
    }
  }, [openFiles, editor, canvasMode, setLocalContent, setCharCount, setWordCount, setCanvasMode, setUnsavedChanges]);

  // --- Bubble Menu Additions ---
  // Predefined font families and sizes (customize as needed)
  const fontFamilies = [
    { name: 'Inter', value: 'Inter, sans-serif' },
    { name: 'Mono', value: 'JetBrains Mono, monospace' },
    { name: 'Serif', value: 'Georgia, serif' },
  ];
  const fontSizes = ['12px', '14px', '16px', '18px', '24px', '30px'];
  const textColors = ['#000000', '#e03131', '#2f9e44', '#1971c2', '#f08c00', '#862e9c', '#adb5bd', '#ffffff']; // Example palette
  const highlightColors = ['#fff59d', '#a7ffeb', '#ffccbc', '#cfd8dc', 'transparent']; // Example palette

  const getSelectedImageNode = (currentEditor) => {
    if (!currentEditor || !currentEditor.isActive('image')) return null;
    const { state } = currentEditor;
    const { selection } = state;
    const { from } = selection;
    // nodeDOM can be null if the node view isn't directly rendered or if selection is tricky
    let domNode = currentEditor.view.nodeDOM(from);

    // If nodeDOM is a wrapper, try to find the img tag within it
    if (domNode && !(domNode instanceof HTMLImageElement) && domNode.querySelector) {
      const imgElement = domNode.querySelector('img');
      if (imgElement) domNode = imgElement;
    }
    
    // Fallback: check if the node itself is an image (less common for complex node views)
    if (!domNode || !(domNode instanceof HTMLElement)) {
        const nodeAtCursor = state.doc.nodeAt(from);
        if (nodeAtCursor && nodeAtCursor.type.name === 'image') {
            // This path might not give a direct DOM node easily for class manipulation
            // For now, we rely on nodeDOM. If it fails, shimmer might not show.
        }
    }
    return domNode instanceof HTMLElement ? domNode : null;
  };

  const repositionAnalysisPanel = useCallback((currentEditor) => {
    if (!analysisPanel.isVisible || !currentEditor || !currentEditor.isActive('image')) return;

    const imageDomNode = getSelectedImageNode(currentEditor);

    if (imageDomNode && editorContainerRef.current) {
      const imageRect = imageDomNode.getBoundingClientRect();
      const editorRect = editorContainerRef.current.getBoundingClientRect();
      const scrollTop = editorContainerRef.current.scrollTop;
      const scrollLeft = editorContainerRef.current.scrollLeft;

      setAnalysisPanel(prev => ({
        ...prev,
        position: {
          top: imageRect.top - editorRect.top + scrollTop,
          left: imageRect.right - editorRect.left + 10 + scrollLeft,
        },
      }));
    }
  }, [analysisPanel.isVisible]);

  // Effect for editor scroll events to reposition panel
  useEffect(() => {
    const editorViewDom = editorContainerRef.current?.querySelector('.TiptapEditor .ProseMirror');
    if (!editorViewDom) return;

    const handleScroll = () => {
      if (analysisPanel.isVisible && editor && editor.isActive('image')) {
        repositionAnalysisPanel(editor);
      }
    };
    
    const scrollableContentArea = editorContainerRef.current?.querySelector('.TiptapEditor');
    if (scrollableContentArea) {
        scrollableContentArea.addEventListener('scroll', handleScroll);
        return () => scrollableContentArea.removeEventListener('scroll', handleScroll);
    }
  }, [editor, analysisPanel.isVisible, repositionAnalysisPanel]);

  // Effect for selection updates to manage analysis panel content and visibility
  useEffect(() => {
    if (!editor) return;

    const handleSelectionOrTransaction = () => {
      if (editor.isActive('image')) {
        if (!analysisPanel.isLoading) { // Only act if not currently loading new analysis
          const imageData = editor.getAttributes('image');
          const savedContent = imageData?.['data-ai-content'];

          if (savedContent) {
            // If panel is not visible or content is different, update and show
            if (!analysisPanel.isVisible || analysisPanel.content !== savedContent) {
              setAnalysisPanel({
                isVisible: true,
                content: savedContent,
                isLoading: false,
                position: { top: 0, left: 0 }, // Will be repositioned by the call below
              });
              repositionAnalysisPanel(editor);
            }
          } else {
            // No saved content for this image, hide panel if it was visible from another image
            if (analysisPanel.isVisible) {
              setAnalysisPanel(prev => ({ ...prev, isVisible: false, content: '' }));
            }
          }
        }
      } else {
        // Selection is not an image, hide the panel
        if (analysisPanel.isVisible) {
          setAnalysisPanel(prev => ({ ...prev, isVisible: false, isLoading: false, content: '' }));
        }
      }
    };

    editor.on('selectionUpdate', handleSelectionOrTransaction);
    editor.on('transaction', handleSelectionOrTransaction); // Catch other state changes that might affect selection

    return () => {
      editor.off('selectionUpdate', handleSelectionOrTransaction);
      editor.off('transaction', handleSelectionOrTransaction);
    };
  }, [editor, analysisPanel.isLoading, analysisPanel.isVisible, analysisPanel.content, repositionAnalysisPanel]);

  const handleAnalyzeImage = async () => {
    if (!editor || !editor.isActive('image')) return;
    
    setAnalysisPanel(prev => ({ ...prev, isVisible: true, isLoading: true, content: 'Processing...' }));
    repositionAnalysisPanel(editor); // Initial position

    const imageDomNode = getSelectedImageNode(editor);
    if (imageDomNode) {
      imageDomNode.classList.add('image-processing-shimmer');
    }

    const imageData = editor.getAttributes('image');
    const originalImageUrl = imageData.src;

    if (!originalImageUrl) {
      setAnalysisPanel(prev => ({ ...prev, isVisible: true, isLoading: false, content: 'Error: Could not get image URL.'}));
      return;
    }

    let processedImageUrl = originalImageUrl;
    try {
      const urlObject = new URL(originalImageUrl);
      if (urlObject.protocol === 'http:' || urlObject.protocol === 'https:') {
        processedImageUrl = urlObject.pathname;
      }
    } catch (e) {
      console.warn('Could not parse image URL to extract pathname, sending original:', originalImageUrl, e);
    }

    try {
      const response = await fetch('http://localhost:8000/api/image/process', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ image_url: processedImageUrl }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.response) {
        editor.chain().focus().updateAttributes('image', { 'data-ai-content': result.response }).run();
      }
      setAnalysisPanel(prev => ({
        ...prev,
        isVisible: true,
        isLoading: false,
        content: result.response,
      }));
      // Reposition after content is set as panel size might change
      repositionAnalysisPanel(editor); 

    } catch (error) {
      console.error('Error analyzing image:', error);
      setAnalysisPanel(prev => ({ ...prev, isVisible: true, isLoading: false, content: `Failed to analyze image: ${error.message}`}));
    } finally {
      if (imageDomNode) {
        imageDomNode.classList.remove('image-processing-shimmer');
      }
    }
  };

  const handleAskAboutImage = useCallback(async () => {
    if (!editor || !editor.isActive('image')) return;

    // Get image position for placing the query UI
    const imageDomNode = getSelectedImageNode(editor);
    if (imageDomNode && editorContainerRef.current) {
      const imageRect = imageDomNode.getBoundingClientRect();
      const editorRect = editorContainerRef.current.getBoundingClientRect();
      const scrollTop = editorContainerRef.current.scrollTop;
      const scrollLeft = editorContainerRef.current.scrollLeft;

      setImageQueryUI({
        isVisible: true,
        position: {
          top: imageRect.bottom - editorRect.top + scrollTop + 10, // Position below image
          left: imageRect.left - editorRect.left + scrollLeft,
        },
        query: '',
        isProcessing: false
      });
    }
  }, [editor]);

  // Function to handle submission of the image query
  const handleSubmitImageQuery = useCallback(async () => {
    if (!editor || !editor.isActive('image') || !imageQueryUI.query.trim()) return;
    
    setImageQueryUI(prev => ({ ...prev, isProcessing: true }));
    
    // Get the selected image's information
    const imageDomNode = getSelectedImageNode(editor);
    if (imageDomNode) {
      imageDomNode.classList.add('image-processing-shimmer');
    }

    const imageData = editor.getAttributes('image');
    const originalImageUrl = imageData.src;

    if (!originalImageUrl) {
      setAnalysisPanel(prev => ({ 
        ...prev, 
        isVisible: true, 
        isLoading: false, 
        content: 'Error: Could not get image URL.'
      }));
      setImageQueryUI(prev => ({ ...prev, isVisible: false, isProcessing: false }));
      return;
    }

    let processedImageUrl = originalImageUrl;
    try {
      const urlObject = new URL(originalImageUrl);
      if (urlObject.protocol === 'http:' || urlObject.protocol === 'https:') {
        processedImageUrl = urlObject.pathname;
      }
    } catch (e) {
      console.warn('Could not parse image URL to extract pathname, sending original:', originalImageUrl, e);
    }

    try {
      const response = await fetch('http://localhost:8000/api/image/process', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ image_url: processedImageUrl, prompt_text: imageQueryUI.query }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (result.response) {
        // Save question and answer
        const newAiContent = `Q: ${imageQueryUI.query}\nA: ${result.response}`;
        editor.chain().focus().updateAttributes('image', { 'data-ai-content': newAiContent }).run();
      }

      setAnalysisPanel(prev => ({
        ...prev,
        isVisible: true,
        isLoading: false,
        content: result.response,
      }));
      
      // Reposition analysis panel
      repositionAnalysisPanel(editor);
      
      // Hide the query UI after successful processing
      setImageQueryUI(prev => ({ ...prev, isVisible: false, isProcessing: false }));

    } catch (error) {
      console.error('Error asking about image:', error);
      setAnalysisPanel(prev => ({ 
        ...prev, 
        isVisible: true, 
        isLoading: false, 
        content: `Failed to get answer: ${error.message}`
      }));
      setImageQueryUI(prev => ({ ...prev, isProcessing: false }));
    } finally {
      if (imageDomNode) {
        imageDomNode.classList.remove('image-processing-shimmer');
      }
    }
  }, [editor, imageQueryUI.query, repositionAnalysisPanel]);

  // Update handleAiSubmit to process and insert the content
  const handleAiSubmit = useCallback((content) => {
    setIsAiProcessing(true);
    
    try {
      if (content && editor) {
        // Insert the content at current cursor position
        editor.commands.insertContent(content);
        
        // Hide the AI chat UI after insertion
        setShowAiChat(false);
        setIsAiProcessing(false);
      }
    } catch (err) {
      console.error('Error inserting AI content:', err);
      setIsAiProcessing(false);
    }
  }, [editor]);

  // Function to cancel AI chat
  const handleCancelAiChat = () => {
    setShowAiChat(false);
    setAiChatQuery('');
    setIsAiProcessing(false);
    
    // Clear legacy state too for backward compatibility
    setAiChatUI(prev => ({ ...prev, isVisible: false, query: '', isProcessing: false }));
    
    // Focus the editor again
    editor?.chain().focus().run();
  };

  // Helper to escape HTML for code blocks if inserting as HTML string
  const escapeHtml = (unsafe) => {
    if (typeof unsafe !== 'string') return '';
    return unsafe
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // YouTube Helper functions
  const handleOpenYoutubeHelper = useCallback((mode) => {
    if (!editor) return;
    const editorView = editor.view;
    const editorContainer = editorContainerRef.current;

    if (!editorContainer) return;
    const containerRect = editorContainer.getBoundingClientRect();
    
    const helperWidth = 420; 
    const helperHeight = mode === 'analyzer' ? 250 : 200;

    setYoutubeHelperInfo(prev => ({
      ...prev,
      mode,
      link: '', // Reset link and prompt when opening
      customPrompt: '',
      position: {
        top: Math.max(20, (containerRect.height - helperHeight) / 2 + editorContainer.scrollTop),
        left: Math.max(20, (containerRect.width - helperWidth) / 2 + editorContainer.scrollLeft),
      },
      isVisible: true,
      isProcessing: false,
      response: null,
    }));
  }, [editor]); // Removed info.mode dependency as it caused issues, mode is passed directly

  const handleYoutubeHelperCancel = useCallback(() => {
    setYoutubeHelperInfo(prev => ({ ...prev, isVisible: false, link: '', customPrompt: '' }));
    editor?.chain().focus().run();
  }, [editor]);

  // Function to analyze YouTube video using Gemini API
  const analyzeYoutubeVideo = useCallback(async (url, customPrompt = '') => {
    const videoId = getYouTubeVideoId(url);
    if (!videoId) {
      throw new Error("Invalid YouTube URL");
    }
    
    // Try to get the video title for better context
    let title = '';
    try {
      title = await extractYouTubeTitle(url);
    } catch (error) {
      console.warn("Could not extract YouTube title:", error);
    }
    
    // Get API key from config
    const apiKey = config.GEMINI_API_KEY;
    
    if (!apiKey || apiKey === 'your_api_key_here') {
      throw new Error("Gemini API key not configured. Please update the API key in src/config.js");
    }
    
    // Build system instruction for video content analysis
    const defaultSystemInstruction = `Analyze this YouTube video and provide a comprehensive summary. Include:

1. Main topics and key points discussed
2. Important visual elements (diagrams, charts, graphs)
3. Key timestamps for important moments
4. Overall summary of the content

Format the output in a clear, structured way that can be used for answering questions about the video.`;

    const systemInstruction = customPrompt || defaultSystemInstruction;
    
    // Prepare request body
    const requestBody = {
      contents: [
        {
          role: "user",
          parts: [
            {
              fileData: {
                fileUri: `https://youtu.be/${videoId}`,
                mimeType: "video/*",
              }
            },
            {
              text: "Analyze this video and provide a comprehensive summary of its content.",
            }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.7,
        topP: 0.95,
        topK: 40,
        maxOutputTokens: 8192,
        responseMimeType: "text/plain"
      },
      systemInstruction: {
        parts: [{ text: systemInstruction }]
      }
    };
    
    // Make the API call
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Gemini API error: ${errorData.error?.message || response.statusText}`);
    }
    
    const data = await response.json();
    
    // Extract the analysis text
    if (data.candidates && data.candidates[0] && data.candidates[0].content) {
      const analysisText = data.candidates[0].content.parts[0].text;
      return {
        analysis_text: analysisText,
        video_id: videoId,
        title: title
      };
    } else {
      throw new Error("Unexpected response format from Gemini API");
    }
  }, []);

  // Function to extract code from YouTube video using Gemini API
  const extractCodeFromYoutube = useCallback(async (url) => {
    const videoId = getYouTubeVideoId(url);
    if (!videoId) {
      throw new Error("Invalid YouTube URL");
    }
    
    // Get API key from config
    const apiKey = config.GEMINI_API_KEY;
    
    if (!apiKey || apiKey === 'your_api_key_here') {
      throw new Error("Gemini API key not configured. Please update the API key in src/config.js");
    }
    
    // Build system instruction for code extraction
    const systemInstruction = `Analyze this YouTube coding tutorial and extract all code snippets shown or explained in the video. 

For each code block:
1. Identify the programming language
2. Extract the complete code with proper formatting
3. Note any filename or context information provided
4. Capture any crucial instructions for using the code

Format your response as follows:
- Each code block should be clearly separated
- Include the language of each code block
- Provide instructions for implementation if mentioned
- If there are multiple files, clearly indicate which code belongs to which file

Also provide a summary of the implementation steps explained in the video.`;
    
    // Prepare request body
    const requestBody = {
      contents: [
        {
          role: "user",
          parts: [
            {
              fileData: {
                fileUri: `https://youtu.be/${videoId}`,
                mimeType: "video/*",
              }
            },
            {
              text: "Extract all code snippets from this programming tutorial video, along with instructions for implementation.",
            }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.2,
        topP: 0.95,
        topK: 40,
        maxOutputTokens: 8192,
        responseMimeType: "text/plain"
      },
      systemInstruction: {
        parts: [{ text: systemInstruction }]
      }
    };
    
    // Make the API call
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Gemini API error: ${errorData.error?.message || response.statusText}`);
    }
    
    const data = await response.json();
    
    // Extract the code and instructions
    if (data.candidates && data.candidates[0] && data.candidates[0].content) {
      const rawText = data.candidates[0].content.parts[0].text;
      
      // Parse the response to extract code blocks and instructions
      const codeBlocks = [];
      let instructions = "";
      
      // Basic parsing of code blocks - this could be enhanced with more sophisticated regex
      const codeBlockRegex = /```(\w+)?\s*([\s\S]*?)```/g;
      let match;
      
      while ((match = codeBlockRegex.exec(rawText)) !== null) {
        const language = match[1] || 'text';
        const code = match[2].trim();
        
        // Look for filename hints before the code block
        const lines = rawText.substring(0, match.index).split('\n');
        let filename = '';
        
        // Check last few lines before code block for filename hints
        for (let i = lines.length - 1; i >= Math.max(0, lines.length - 5); i--) {
          const line = lines[i].trim();
          if (line.match(/file:?\s*[\w.-]+\.([\w]+)/i)) {
            filename = line.match(/file:?\s*([\w.-]+\.[\w]+)/i)[1];
            break;
          }
        }
        
        codeBlocks.push({
          language,
          code,
          filename
        });
      }
      
      // Extract instructions (text outside code blocks)
      let plainText = rawText.replace(codeBlockRegex, '');
      instructions = plainText.trim();
      
      return {
        extracted_code: codeBlocks,
        instructions,
        video_id: videoId
      };
    } else {
      throw new Error("Unexpected response format from Gemini API");
    }
  }, []);

  const handleYoutubeHelperSubmit = useCallback(async () => {
    if (!youtubeHelperInfo.link.trim()) return;
    setYoutubeHelperInfo(prev => ({ ...prev, isProcessing: true }));

    try {
      const apiKey = config.GEMINI_API_KEY;
      
      if (!apiKey || apiKey === 'your_api_key_here') {
        throw new Error("Gemini API key not configured. Please update the API key in src/config.js");
      }
      
      let result;
      
      if (youtubeHelperInfo.mode === 'analyzer') {
        // Use direct Gemini API integration
        result = await analyzeYoutubeVideo(
          youtubeHelperInfo.link, 
          apiKey,
          youtubeHelperInfo.customPrompt
        );
        
        if (result && result.analysis_text) {
          const contentToInsert = `# Analysis of: ${result.title || youtubeHelperInfo.link}\n\n${result.analysis_text}`;
          editor.chain().focus().insertContent(contentToInsert).run();
        }
      } else { // coder mode
        // Use direct Gemini API integration
        result = await extractCodeFromYoutube(
          youtubeHelperInfo.link,
          apiKey
        );
        
        if (result.extracted_code && result.extracted_code.length > 0) {
          // Start with a title
          const titleContent = `# Code from: ${result.title || youtubeHelperInfo.link}\n\n`;
          editor.chain().focus().insertContent(titleContent).run();
          
          // Process instructions and code blocks
          const instructionParts = result.instructions.split('\n\n');
          let currentInstructionIndex = 0;
          
          // Insert each code block with its context
          result.extracted_code.forEach((block, index) => {
            // Look for relevant instruction parts that should go before this code block
            let relevantInstructions = '';
            while (currentInstructionIndex < instructionParts.length) {
              const part = instructionParts[currentInstructionIndex];
              // Check if this instruction part references the next code block
              if (index < result.extracted_code.length - 1 && 
                  (part.includes(result.extracted_code[index + 1].filename) || 
                   part.toLowerCase().includes(result.extracted_code[index + 1].language))) {
                break;
              }
              
              // Add this instruction part
              if (part.trim()) {
                relevantInstructions += part + '\n\n';
              }
              currentInstructionIndex++;
            }
            
            // Insert relevant instructions if any
            if (relevantInstructions.trim()) {
              editor.chain().focus().insertContent(relevantInstructions.trim()).run();
              editor.chain().focus().insertContent('\n\n').run();
            }
            
            // Insert a paragraph with filename if available
            if (block.filename) {
              const filenameContent = `**File: ${block.filename}**\n\n`;
              editor.chain().focus().insertContent(filenameContent).run();
            }
            
            // Insert the code block with language
            editor.chain().focus()
              .insertContent({
                type: 'codeBlock',
                attrs: {
                  language: block.language || 'text'
                },
                content: [{ type: 'text', text: block.code }]
              })
              .run();
            
            // Add a line break after each code block
            editor.chain().focus().insertContent('\n\n').run();
          });
          
          // Add any remaining instructions
          if (currentInstructionIndex < instructionParts.length) {
            const remainingInstructions = instructionParts.slice(currentInstructionIndex).join('\n\n');
            if (remainingInstructions.trim()) {
              editor.chain().focus().insertContent(remainingInstructions.trim()).run();
            }
          }
        } else {
          throw new Error("No code blocks were extracted from the video");
        }
      }

      setYoutubeHelperInfo(prev => ({ 
        ...prev, 
        isVisible: false, 
        isProcessing: false,
        link: '', 
        customPrompt: '' 
      }));
      
    } catch (error) {
      console.error(`Error in YouTube ${youtubeHelperInfo.mode}:`, error);
      alert(`Failed to process YouTube link: ${error.message}`);
      setYoutubeHelperInfo(prev => ({ ...prev, isProcessing: false }));
    }
  }, [editor, youtubeHelperInfo, analyzeYoutubeVideo, extractCodeFromYoutube]);

  const handleGeneratedFlashcards = useCallback((generatedFlashcards) => {
    if (!editor || editor.isDestroyed) return;

    console.log("Generated Flashcards:", generatedFlashcards);
    
    // The Flashcards are already in the editor through the FlashcardGeneratorUI component
    // But if we need to do anything additional with them after generation, we can do it here
    
    // Each flashcard in generatedFlashcards should already have an onGenerateImage function
    // attached to it from the FlashcardGeneratorUI component
  }, [editor]);

  // Flashcard Generator functions
  const handleOpenFlashcardGenerator = useCallback(() => {
    if (!editor) return;
    const editorView = editor.view;
    const editorContainer = editorContainerRef.current;

    if (!editorContainer) return;
    const containerRect = editorContainer.getBoundingClientRect();
    
    // Position the helper in the center of the editor view
    const helperWidth = 500; // Approximate width of the helper UI
    const helperHeight = 600; // Approximate height

    setFlashcardGeneratorInfo({
      topic: '',
      position: {
        top: Math.max(20, (containerRect.height - helperHeight) / 2 + editorContainer.scrollTop),
        left: Math.max(20, (containerRect.width - helperWidth) / 2 + editorContainer.scrollLeft),
      },
      isVisible: true,
      isProcessing: false,
      flashcards: [],
      error: null,
    });
  }, [editor]);

  const handleFlashcardGeneratorCancel = useCallback(() => {
    setFlashcardGeneratorInfo(prev => ({ ...prev, isVisible: false, topic: '', flashcards: [], error: null }));
    editor?.chain().focus().run();
  }, [editor]);

  // Function to open TinyCatsExplainView
  const handleOpenTinyCatsExplainView = () => {
    setTinyCatsExplainViewVisible(true);
  };

  // Function to close TinyCatsExplainView
  const handleCloseTinyCatsExplainView = () => {
    setTinyCatsExplainViewVisible(false);
    editor?.chain().focus().run(); // Focus editor on close
  };

  if (!editor) {
    return <div>Loading Editor...</div>;
  }

  // Memoize style objects for popups
  const flashcardGeneratorStyle = useMemo(() => ({
    position: 'fixed',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    zIndex: 1250,
  }), []);

  const youtubeHelperStyle = useMemo(() => ({
    position: 'fixed',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    zIndex: 1200,
  }), []);

  // Specific updaters for YouTubeHelperUI props to help with memoization
  const handleYoutubeLinkChange = useCallback((link) => {
    setYoutubeHelperInfo(prev => ({ ...prev, link }));
  }, []);

  const handleYoutubePromptChange = useCallback((customPrompt) => {
    setYoutubeHelperInfo(prev => ({ ...prev, customPrompt }));
  }, []);

  // Image Query UI Component Definition
  const ImageQueryUI = ({ position, query, setQuery, onSubmit, onCancel, theme, isProcessing }) => {
    const inputRef = useRef(null);
    
    useEffect(() => {
      if (inputRef.current) {
        inputRef.current.focus();
      }
    }, []);
    
    return (
      <div 
        className={`ImageQueryUI ${theme === 'dark' ? 'dark' : ''} ${isProcessing ? 'processing' : ''}`}
        style={{ 
          top: `${position.top}px`,
          left: `${position.left}px`,
        }}
      >
        <div className="QueryHeader">
          <span>Ask about this image</span>
          <button className="CloseButton" onClick={onCancel}>
            <X size={14} />
          </button>
        </div>
        <div className="QueryInputContainer">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type your question..."
            disabled={isProcessing}
            onKeyDown={(e) => e.key === 'Enter' && !isProcessing && onSubmit()}
            className="QueryInput"
          />
          <button 
            className="SubmitButton" 
            onClick={onSubmit}
            disabled={isProcessing || !query.trim()}
          >
            {isProcessing ? (
              <span className="ProcessingIndicator"></span>
            ) : (
              <Send size={16} />
            )}
          </button>
        </div>
      </div>
    );
  };

  // AI Chat UI Component Definition
  const AiChatUI = ({ position, query, setQuery, onSubmit, onCancel, theme, isProcessing }) => {
    const inputRef = useRef(null);
    
    useEffect(() => {
      if (inputRef.current) {
        inputRef.current.focus();
      }
    }, []);
    
    return (
      <div 
        className={`AiChatUI ${theme === 'dark' ? 'dark' : ''} ${isProcessing ? 'processing' : ''}`}
        style={{ 
          top: `${position.top}px`,
          left: `${position.left}px`,
        }}
      >
        <div className="ChatHeader">
          <span>Ask AI to help with your writing</span>
          <button className="CloseButton" onClick={onCancel}>
            <X size={14} />
          </button>
        </div>
        <div className="ChatInputContainer">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="What would you like to write about?"
            disabled={isProcessing}
            onKeyDown={(e) => e.key === 'Enter' && !isProcessing && onSubmit()}
            className="ChatInput"
          />
          <button 
            className="SubmitButton" 
            onClick={onSubmit}
            disabled={isProcessing || !query.trim()}
          >
            {isProcessing ? (
              <span className="ProcessingIndicator"></span>
            ) : (
              <Send size={16} />
            )}
          </button>
        </div>
      </div>
    );
  };

  // Notion Style AI Helper Component
  const NotionStyleAiHelper = ({ position, query, setQuery, onSubmit, onCancel, theme, isProcessing }) => {
    const inputRef = useRef(null);
    const responseRef = useRef(null);
    const containerRef = useRef(null);
    const [previewContent, setPreviewContent] = useState("");
    const [isGenerating, setIsGenerating] = useState(false);
    const [showResponse, setShowResponse] = useState(false);
    
    useEffect(() => {
      if (inputRef.current) {
        inputRef.current.focus();
      }
      
      // Ensure the component is visible when it first renders
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const isPartiallyOffScreen = rect.bottom > window.innerHeight || rect.top < 0;
        
        if (isPartiallyOffScreen) {
          containerRef.current.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'center'
          });
        }
      }
    }, []);
    
    // Add effect to ensure response actions are visible when content updates
    useEffect(() => {
      if (responseRef.current && !isGenerating && showResponse) {
        // When content finishes generating, scroll to make sure actions are visible
        const actions = responseRef.current.querySelector('.ResponseActions');
        if (actions) {
          const rect = actions.getBoundingClientRect();
          const isOffScreen = rect.bottom > window.innerHeight || rect.top < 0;
          
          if (isOffScreen) {
            actions.scrollIntoView({ 
              behavior: 'smooth', 
              block: 'nearest'
            });
          }
        }
      }
    }, [isGenerating, showResponse, previewContent]);
    
    const handleQueryChange = (e) => {
      setQuery(e.target.value);
    };
    
    const handleGenerateContent = async () => {
      if (!query.trim()) return;
      
      setIsGenerating(true);
      setShowResponse(true);
      
      try {
        // Use API to generate content if available
        try {
          const response = await fetch('http://localhost:8000/api/ai-chat', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
              user_prompt: query,
              system_prompt: "You are a helpful, creative writing assistant that provides concise, relevant, and thoughtful responses. Focus on giving substantive information that directly addresses the user's query without unnecessary filler. Be specific and avoid generic templates."
            }),
          });
          
          if (response.ok) {
            const result = await response.json();
            setPreviewContent(result.response);
            setIsGenerating(false);
            return;
          }
        } catch (error) {
          console.error('API error:', error);
        }
        
        // Fallback to simulated better responses if API fails
        let generatedContent = "";
        
        if (query.toLowerCase().includes('summary')) {
          generatedContent = "## Key Summary Points\n\n1. This document discusses the implementation of modern text editors with AI capabilities\n2. It highlights the importance of user-centric design in AI interfaces\n3. The architecture follows a component-based approach for maintainability\n4. Performance optimization techniques are employed for real-time responsiveness";
        } else if (query.toLowerCase().includes('list') || query.toLowerCase().includes('points')) {
          generatedContent = "- Begin with a clear understanding of user requirements\n- Develop modular components that can be reused across the application\n- Implement robust error handling for edge cases\n- Ensure responsive design across different viewport sizes\n- Optimize rendering performance for complex operations\n- Establish consistent design patterns throughout the interface";
        } else {
          // Create a more thoughtful response based on the query
          const topic = query.trim();
          generatedContent = `# Understanding ${topic}\n\n${topic} represents a fundamental concept in modern development practices. Unlike traditional approaches, it emphasizes user-centric design while maintaining system integrity.\n\nThree key aspects to consider when implementing ${topic}:\n\n1. **Integration with existing systems** - Compatibility with current workflows is essential for adoption\n2. **Performance optimization** - Ensuring that implementations scale efficiently under various loads\n3. **User experience cohesion** - Creating intuitive interfaces that reduce cognitive load`;
        }
        
        // Simulate typing delay for better UX
        await new Promise(resolve => setTimeout(resolve, 1200));
        
        setPreviewContent(generatedContent);
        setIsGenerating(false);
      } catch (error) {
        console.error('Error generating content:', error);
        setIsGenerating(false);
      }
    };
    
    const handleInsertContent = () => {
      if (previewContent) {
        onSubmit(previewContent);
      }
    };
    
    const handleSubmitForm = (e) => {
      e.preventDefault();
      if (!isGenerating && !showResponse) {
        handleGenerateContent();
      } else if (!isGenerating && showResponse) {
        handleInsertContent();
      }
    };
    
    return (
      <div 
        ref={containerRef}
        className={`NotionStyleAiHelper ${theme === 'dark' ? 'dark' : ''} ${isProcessing || isGenerating ? 'processing' : ''}`}
        style={{ 
          top: `${position.top}px`,
          left: '50%', 
          transform: 'translateX(-50%)',
          maxWidth: '900px',
          width: 'calc(100% - 48px)'
        }}
      >
        <div className="AiHelperContainer">
          <div className="AiChatWrapper">
            {/* Prompt Bubble */}
            <div className="AiPromptBubble">
              <div className="AiPromptHeader">
                <div className="AiLogo">
                  <img src="/logo192.png" alt="AI" width="24" height="24" />
                </div>
                <form onSubmit={handleSubmitForm} className="AiPromptForm">
                  <input
                    ref={inputRef}
                    type="text"
                    value={query}
                    onChange={handleQueryChange}
                    placeholder="Ask AI to write anything..."
                    disabled={isProcessing || isGenerating}
                    className="AiHelperInput"
                  />
                  <button 
                    type="submit"
                    className="AiHelperSubmitButton" 
                    onClick={isGenerating ? null : (showResponse ? handleInsertContent : handleGenerateContent)}
                    disabled={isProcessing || (!query.trim() && !showResponse) || (showResponse && isGenerating)}
                  >
                    {isGenerating ? (
                      <span className="ProcessingIndicator"></span>
                    ) : showResponse ? (
                      <Check size={16} />
                    ) : (
                      <Send size={16} />
                    )}
                  </button>
                </form>
                <button className="AiHelperCloseButton" onClick={onCancel}>
                  <X size={14} />
                </button>
              </div>
            </div>
            
            {/* Response Bubble - Only shown after generating starts */}
            {showResponse && (
              <div className="AiResponseBubble" ref={responseRef}>
                <div className="AiResponseHeader">
                  <div className="AiLogo">
                    <img src="/logo192.png" alt="AI" width="20" height="20" />
                  </div>
                  <span className="ResponseTitle">AI Response</span>
                </div>
                <div className="ResponseContent">
                  {isGenerating ? (
                    <div className="LazyLoadingContainer">
                      <div className="LazyLoadingDots">
                        <span></span>
                        <span></span>
                        <span></span>
                      </div>
                      <div className="LazyLoadingText">Generating thoughtful response...</div>
                    </div>
                  ) : (
                    <div className="MarkdownContent">
                      {previewContent.split('\n').map((line, index) => (
                        <p key={index}>{line}</p>
                      ))}
                    </div>
                  )}
                </div>
                {!isGenerating && (
                  <div className="ResponseActions">
                    <button 
                      className="ResponseActionButton EditButton" 
                      onClick={() => {
                        setShowResponse(false);
                        setTimeout(() => {
                          if (inputRef.current) {
                            inputRef.current.focus();
                          }
                        }, 50);
                      }}
                    >
                      <Edit size={14} /> Edit prompt
                    </button>
                    <button 
                      className="ResponseActionButton InsertButton" 
                      onClick={handleInsertContent}
                    >
                      <Check size={14} /> Insert
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Text Improvement UI Component Definition
  const TextImproveUI = ({ 
    position, 
    mode, 
    setMode, 
    prompt, 
    setPrompt,
    onSubmit, 
    onCancel, 
    theme, 
    isProcessing 
  }) => {
    const inputRef = useRef(null);
    const containerRef = useRef(null);
    
    useEffect(() => {
      // Focus the input when in custom mode
      if (inputRef.current && mode === 'custom') {
        inputRef.current.focus();
      }
      
      // Check if component is visible in viewport
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const isPartiallyOffScreen = rect.bottom > window.innerHeight || rect.top < 0;
        
        if (isPartiallyOffScreen) {
          containerRef.current.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'nearest'
          });
        }
      }
    }, [mode]);
    
    return (
      <div 
        ref={containerRef}
        className={`TextImproveUI ${theme === 'dark' ? 'dark' : ''} ${isProcessing ? 'processing' : ''}`}
        style={{ 
          top: `${position.top}px`,
          left: `${position.left}px`,
        }}
      >
        <div className="ImproveHeader">
          <span>AI Text Enhancement</span>
          <button className="CloseButton" onClick={onCancel}>
            <X size={14} />
          </button>
        </div>
        
        <div className="ImproveOptions">
          <button 
            className={`ImproveOption ${mode === 'improve' ? 'active' : ''}`}
            onClick={() => setMode('improve')}
            disabled={isProcessing}
          >
            <Zap size={14} className="option-icon" />
            <span>Improve Writing</span>
          </button>
          <button 
            className={`ImproveOption ${mode === 'custom' ? 'active' : ''}`}
            onClick={() => setMode('custom')}
            disabled={isProcessing}
          >
            <Edit size={14} className="option-icon" />
            <span>Custom Prompt</span>
          </button>
        </div>
        
        {mode === 'custom' && (
          <div className="ImprovePromptContainer">
            <input
              ref={inputRef}
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Enter your custom instruction..."
              disabled={isProcessing}
              onKeyDown={(e) => e.key === 'Enter' && !isProcessing && onSubmit()}
              className="ImprovePromptInput"
            />
          </div>
        )}
        
        <div className="ImproveButtonContainer">
          <button 
            className="SubmitButton" 
            onClick={onSubmit}
            title="Apply changes"
            disabled={isProcessing || (mode === 'custom' && !prompt.trim())}
          >
            {isProcessing ? (
              <span className="ProcessingIndicator"></span>
            ) : (
              <Check size={18} />
            )}
          </button>
        </div>
      </div>
    );
  };

  // GetStartedWithButtons component
  const GetStartedWithButtons = () => {
    if (!editor || !activeFileId || canvasMode || !editor.isEmpty) {
      return null;
    }

    return (
      <div className="GetStartedWithContainer">
        <p className="GetStartedWithTitle">Get started with</p>
        <div className="GetStartedWithButtonsInternal">
          <button onClick={() => handleShowAiChat()} title="Ask AI">
            <Brain size={18} /> Ask AI
          </button>
          <button onClick={() => handleOpenYoutubeHelper('analyzer')} title="YouTube Analyser">
            <PlayCircle size={18} /> YT Analyser
          </button>
          <button onClick={() => handleOpenYoutubeHelper('coder')} title="Coder using YouTube">
            <Terminal size={18} /> Coder from YT
          </button>
          <button onClick={handleOpenFlashcardGenerator} title="Generate Flashcards">
            <Layers size={18} /> Flashcards
          </button>
          <button onClick={handleOpenTinyCatsExplainView} title="Explain with Tiny Cats">
            <Cat size={18} /> Tiny Cats Explain
          </button>
        </div>
      </div>
    );
  };
  
  // YouTube Helper UI Component (Removed from here)
  // const YouTubeHelperUIComponent = () => { ... };

  return (
    <div className={`Editor ${theme === 'dark' ? 'dark' : ''}`}>
      <div className="Tabs">
        <div className="TabsLeft" ref={tabsLeftRef}>
          {openFiles.map((file) => (
            <div
              key={file.id}
              className={`Tab ${file.id === activeFileId ? 'active' : ''} ${unsavedChanges[file.id] ? 'unsaved' : ''} ${file.type === 'canvas' ? 'canvas-tab' : ''}`}
              onClick={() => handleTabClick(file.id)}
            >
              <span title={file.name}>{file.name}</span>
              {unsavedChanges[file.id] && <span className="UnsavedIndicator">•</span>}
              <button
                className="CloseTab"
                onClick={(e) => {
                  e.stopPropagation();
                  handleTabClose(file.id);
                }}
                title="Close tab"
              >
                <X size={16} />
              </button>
            </div>
          ))}
          <button
            className="AddTab"
            onClick={handleNewFile}
            style={{ color: theme === 'dark' ? '#fff' : '#555' }}
          >
            <Plus size={18} />
          </button>
        </div>
        <div className="TabsRight">
          {canvasMode ? (
            <button className="NewCanvasButton" onClick={handleNewCanvas} title="New Canvas">
              <Plus size={14} />
              <span>Canvas</span>
            </button>
          ) : (
            <>
              <button className="SaveButton" onClick={handleSaveFile} disabled={!activeFileId || !unsavedChanges[activeFileId]} title="Save (Ctrl+S)">
                <Save size={18} />
              </button>
            </>
          )}
          <Switch />
        </div>
      </div>

      <div className="TextEditorCanvas">
        {activeFileId ? (
          canvasMode ? (
            <NotesCanvas 
              canvasData={canvasData} 
              onSave={handleCanvasSave}
              canvasId={activeFileId}
            />
          ) : (
            <div ref={editorContainerRef} className="EditorContainer">
              {/* General BubbleMenu - controlled by shouldShow */}
              <BubbleMenu 
                editor={editor} 
                tippyOptions={{ duration: 100 }}
                className={`EditorBubbleMenu GeneralBubbleMenu ${theme === 'dark' ? 'dark' : ''}`}
                pluginKey="generalBubbleMenu"
                shouldShow={({ editor, view, state, oldState, from, to }) => {
                  const { selection } = state;
                  // Only show if editor exists, has focus, text is selected,
                  // AND the selection is NOT an image node, flashcardNode, or flashcardSetNode.
                  return !!editor && 
                         view.hasFocus() && 
                         !selection.empty && 
                         !editor.isActive('image') && 
                         !editor.isActive('flashcardNode') && 
                         !editor.isActive('flashcardSetNode');
                }}
              >
                <div className="MenuButtons">
                  <button
                    onClick={() => editor.chain().focus().toggleBold().run()}
                    className={editor.isActive('bold') ? 'is-active' : ''}
                    title="Bold"
                  >
                    <Bold size={16} />
                  </button>
                  <button
                    onClick={() => editor.chain().focus().toggleItalic().run()}
                    className={editor.isActive('italic') ? 'is-active' : ''}
                    title="Italic"
                  >
                    <Italic size={16} />
                  </button>
                  <button
                    onClick={() => editor.chain().focus().toggleUnderline().run()}
                    className={editor.isActive('underline') ? 'is-active' : ''}
                    title="Underline"
                  >
                    <Underline size={16} />
                  </button>
                  <button
                    onClick={() => editor.chain().focus().toggleCode().run()}
                    className={editor.isActive('code') ? 'is-active' : ''}
                    title="Inline Code"
                  >
                    <Code size={16} />
                  </button>
                  <button
                    onClick={() => editor.chain().focus().toggleStrike().run()}
                    className={editor.isActive('strike') ? 'is-active' : ''}
                    title="Strikethrough"
                  >
                    <Strikethrough size={16} />
                  </button>
                  <button
                    onClick={() => editor.chain().focus().toggleSubscript().run()}
                    className={editor.isActive('subscript') ? 'is-active' : ''}
                    title="Subscript"
                  >
                    <Subscript size={16} />
                  </button>
                  <button
                    onClick={() => editor.chain().focus().toggleSuperscript().run()}
                    className={editor.isActive('superscript') ? 'is-active' : ''}
                    title="Superscript"
                  >
                    <Superscript size={16} />
                  </button>
                  <button
                    onClick={addLink}
                    className={editor.isActive('link') ? 'is-active' : ''}
                    title="Add Link"
                  >
                    <LinkIcon size={16} />
                  </button>
                  <div className="MenuDivider"></div>
                  <div className="MenuDropdown">
                    <button className="DropdownToggle">
                      <CaseSensitive size={16} />
                      <span>{fontFamily || 'Default'}</span>
                      <ChevronDown size={14} />
                    </button>
                    <div className="DropdownContent">
                      <button onClick={() => editor.chain().focus().unsetFontFamily().run()}>Default</button>
                      {fontFamilies.map(font => (
                        <button key={font.value} onClick={() => editor.chain().focus().setFontFamily(font.value).run()} style={{ fontFamily: font.value }}>{font.name}</button>
                      ))}
                    </div>
                  </div>
                  <div className="MenuDivider"></div>
                  <div className="MenuDropdown">
                    <button className="DropdownToggle">
                      <CaseUpper size={16} />
                      <span>{fontSize || 'Size'}</span>
                      <ChevronDown size={14} />
                    </button>
                    <div className="DropdownContent">
                      <button onClick={() => editor.chain().focus().unsetFontSize().run()}>Default</button>
                      {fontSizes.map(size => (
                        <button key={size} onClick={() => editor.chain().focus().setFontSize(size).run()} style={{ fontSize: size }}>{size}</button>
                      ))}
                    </div>
                  </div>
                  <div className="MenuDivider"></div>
                  <div className="MenuDropdown">
                    <button className="DropdownToggle">
                      <Palette size={16} />
                      <span style={{ color: editor.getAttributes('textStyle').color || 'inherit' }}>A</span>
                      <ChevronDown size={14} />
                    </button>
                    <div className="DropdownContent ColorPalette">
                      <button onClick={() => editor.chain().focus().unsetColor().run()}>Default</button>
                      {textColors.map(color => (
                        <button key={color} onClick={() => editor.chain().focus().setColor(color).run()} title={color}>
                          <div className="ColorSwatch" style={{ backgroundColor: color }}></div>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="MenuDivider"></div>
                  <div className="MenuDropdown">
                    <button className="DropdownToggle">
                      <Highlighter size={16} />
                      <span style={{ backgroundColor: editor.getAttributes('highlight').color || 'transparent', padding: '0 2px' }}>A</span>
                      <ChevronDown size={14} />
                    </button>
                    <div className="DropdownContent ColorPalette">
                      <button onClick={() => editor.chain().focus().unsetHighlight().run()}>None</button>
                      {highlightColors.map(color => (
                        <button key={color} onClick={() => editor.chain().focus().toggleHighlight({ color: color === 'transparent' ? undefined : color }).run()} title={color}>
                          <div className="ColorSwatch" style={{ backgroundColor: color, border: color === 'transparent' ? '1px dashed #ccc' : 'none' }}></div>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="MenuDivider"></div>
                  <button
                    onClick={() => editor.chain().focus().setTextAlign('left').run()}
                    className={editor.isActive({ textAlign: 'left' }) ? 'is-active' : ''}
                    title="Align Left"
                  >
                    <AlignLeft size={16} />
                  </button>
                  <button
                    onClick={() => editor.chain().focus().setTextAlign('center').run()}
                    className={editor.isActive({ textAlign: 'center' }) ? 'is-active' : ''}
                    title="Align Center"
                  >
                    <AlignCenter size={16} />
                  </button>
                  <button
                    onClick={() => editor.chain().focus().setTextAlign('right').run()}
                    className={editor.isActive({ textAlign: 'right' }) ? 'is-active' : ''}
                    title="Align Right"
                  >
                    <AlignRight size={16} />
                  </button>
                  <div className="MenuDivider"></div>
                  <button
                    onClick={handleShowAiChat}
                    title="Ask AI"
                  >
                    <Brain size={16} />
                  </button>
                  <button
                    onClick={handleShowTextImproveUI}
                    title="Enhance selected text with AI"
                    className="ai-enhance-button"
                  >
                    <Zap size={16} />
                  </button>
                </div>
              </BubbleMenu>

              {/* Table BubbleMenu - controlled by shouldShow */}
              <BubbleMenu
                editor={editor}
                tippyOptions={{ duration: 100, placement: 'bottom-start' }}
                className={`EditorBubbleMenu TableBubbleMenu ${theme === 'dark' ? 'dark' : ''}`}
                pluginKey="tableBubbleMenu"
                shouldShow={({ editor }) => {
                  // Only show if editor exists and is in a table
                  return !!editor && editor.isActive('table');
                }}
              >
                 <div className="MenuButtons">
                  <button onClick={() => editor.chain().focus().addColumnBefore().run()} title="Add Column Before">
                    <ArrowLeftToLine size={16} />
                  </button>
                  <button onClick={() => editor.chain().focus().addColumnAfter().run()} title="Add Column After">
                    <ArrowRightToLine size={16} />
                  </button>
                  <button onClick={() => editor.chain().focus().deleteColumn().run()} title="Delete Column">
                    <Trash2 size={16} /> <span style={{marginLeft: '4px', fontSize: '0.8em'}}>Col</span>
                  </button>
                  <div className="MenuDivider"></div>
                  <button onClick={() => editor.chain().focus().addRowBefore().run()} title="Add Row Before">
                    <ArrowUpToLine size={16} />
                  </button>
                  <button onClick={() => editor.chain().focus().addRowAfter().run()} title="Add Row After">
                    <ArrowDownToLine size={16} />
                  </button>
                  <button onClick={() => editor.chain().focus().deleteRow().run()} title="Delete Row">
                     <Trash2 size={16} /> <span style={{marginLeft: '4px', fontSize: '0.8em'}}>Row</span>
                  </button>
                  <div className="MenuDivider"></div>
                  <button onClick={() => editor.chain().focus().toggleHeaderRow().run()} title="Toggle Header Row">
                    <Pilcrow size={16} /> H-Row
                  </button>
                   <button onClick={() => editor.chain().focus().toggleHeaderColumn().run()} title="Toggle Header Column">
                    <Pilcrow size={16} style={{transform: 'rotate(90deg)'}}/> H-Col
                  </button>
                  <div className="MenuDivider"></div>
                  <button onClick={() => editor.chain().focus().deleteTable().run()} title="Delete Table">
                    <Trash2 size={16} /> Table
                  </button>
                 </div>
              </BubbleMenu>
              
              {/* Floating Menu - controlled by shouldShow */}
              <FloatingMenu 
                editor={editor} 
                tippyOptions={{ duration: 100, placement: 'bottom' }} 
                className={`EditorFloatingMenu ${theme === 'dark' ? 'dark' : ''}`}
                pluginKey="floatingMenu"
                shouldShow={({ editor, view, state }) => {
                   // Only show if editor exists, conditions met, and char before is '/'
                   if (!editor || !view.hasFocus() || !state.selection.empty || editor.isActive('table')) {
                     return false;
                   }
                   const { $from } = state.selection;
                   const charBefore = state.doc.textBetween($from.pos - 1, $from.pos, '\0');
                   return charBefore === '/';
                }}
              >
                 <div className="MenuButtons">
                  <button
                    onClick={() => executeCommandAndRemoveSlash(() => editor.chain().focus().toggleHeading({ level: 1 }).run())}
                    className={editor.isActive('heading', { level: 1 }) ? 'is-active' : ''}
                    title="Heading 1"
                  >
                    <Heading1 size={16} />
                  </button>
                  <button
                    onClick={() => executeCommandAndRemoveSlash(() => editor.chain().focus().toggleHeading({ level: 2 }).run())}
                    className={editor.isActive('heading', { level: 2 }) ? 'is-active' : ''}
                    title="Heading 2"
                  >
                    <Heading2 size={16} />
                  </button>
                  <button
                    onClick={() => executeCommandAndRemoveSlash(() => editor.chain().focus().toggleHeading({ level: 3 }).run())}
                    className={editor.isActive('heading', { level: 3 }) ? 'is-active' : ''}
                    title="Heading 3"
                  >
                    <Heading3 size={16} />
                  </button>
                  <button
                    onClick={() => executeCommandAndRemoveSlash(() => editor.chain().focus().toggleBulletList().run())}
                    className={editor.isActive('bulletList') ? 'is-active' : ''}
                    title="Bullet List"
                  >
                    <List size={16} />
                  </button>
                  <button
                    onClick={() => executeCommandAndRemoveSlash(() => editor.chain().focus().toggleOrderedList().run())}
                    className={editor.isActive('orderedList') ? 'is-active' : ''}
                    title="Ordered List"
                  >
                    <ListOrdered size={16} />
                  </button>
                  <button
                    onClick={() => executeCommandAndRemoveSlash(() => editor.chain().focus().toggleTaskList().run())}
                    className={editor.isActive('taskList') ? 'is-active' : ''}
                    title="Task List"
                  >
                    <CheckSquare size={16} />
                  </button>
                  <button
                    onClick={() => executeCommandAndRemoveSlash(createTable)}
                    title="Insert Table"
                  >
                    <TableIcon size={16} />
                  </button>
                  <button
                    onClick={() => executeCommandAndRemoveSlash(() => editor.chain().focus().toggleCodeBlock().run())}
                    className={editor.isActive('codeBlock') ? 'is-active' : ''}
                    title="Code Block"
                  >
                    <Code size={16} />
                  </button>
                  <button
                    onClick={() => executeCommandAndRemoveSlash(addMathBlock)}
                    title="Math Block (Inline)"
                  >
                    <Sigma size={16} />
                  </button>
                  <button
                    onClick={() => executeCommandAndRemoveSlash(() => {
                      const input = document.createElement('input');
                      input.type = 'file';
                      input.accept = 'image/*';
                      input.onchange = e => {
                        if (e.target.files?.length) {
                          handleImageUpload(e.target.files[0]);
                        }
                      };
                      input.click();
                    })}
                    title="Insert Image"
                  >
                    <ImageIcon size={16} />
                  </button>
                  <button
                    onClick={() => executeCommandAndRemoveSlash(handleAskAi)}
                    title="Ask AI"
                  >
                    <Brain size={16} /> Ask AI
                  </button>
                 </div>
              </FloatingMenu>

              {/* NEW: Image Bubble Menu */}
              <BubbleMenu
                editor={editor}
                tippyOptions={{ duration: 100, placement: 'top' }}
                pluginKey="imageBubbleMenu"
                className={`EditorBubbleMenu ImageBubbleMenu ${theme === 'dark' ? 'dark' : ''}`}
                shouldShow={({ editor, view, state, oldState, from, to }) => {
                  const isActive = !!editor && editor.isActive('image');
                  if (!isActive && analysisPanel.isVisible) { 
                    setAnalysisPanel(prev => ({ ...prev, isVisible: false, isLoading: false }));
                  }
                  return isActive;
                }}
              >
                <div className="MenuButtons">
                  <button 
                    onClick={() => editor.chain().focus().updateAttributes('image', { 'data-align': 'left' }).run()}
                    className={editor.isActive('image', { 'data-align': 'left' }) ? 'is-active' : ''}
                    title="Align Left"
                  >
                    <AlignLeft size={18} />
                  </button>
                  <button 
                    onClick={() => editor.chain().focus().updateAttributes('image', { 'data-align': 'center' }).run()}
                    className={editor.isActive('image', { 'data-align': 'center' }) ? 'is-active' : ''}
                    title="Align Center"
                  >
                    <AlignCenter size={18} />
                  </button>
                  <button 
                    onClick={() => editor.chain().focus().updateAttributes('image', { 'data-align': 'right' }).run()}
                    className={editor.isActive('image', { 'data-align': 'right' }) ? 'is-active' : ''}
                    title="Align Right"
                  >
                    <AlignRight size={18} />
                  </button>
                  <div className="MenuDivider"></div>
                  <button
                    onClick={handleAnalyzeImage}
                    title="Analyze Image with AI"
                  >
                    <Brain size={18} /> Analyze
                  </button>
                  <button
                    onClick={handleAskAboutImage}
                    title="Ask AI about Image"
                  >
                    <HelpCircle size={18} /> Ask
                  </button>
                </div>
              </BubbleMenu>
              
              {analysisPanel.isVisible && editor.isActive('image') && (
                <ImageAnalysisPanel 
                  content={analysisPanel.content}
                  isLoading={analysisPanel.isLoading}
                  style={{ 
                    top: `${analysisPanel.position.top}px`,
                    left: `${analysisPanel.position.left}px`,
                  }}
                  onClose={() => setAnalysisPanel(prev => ({ ...prev, isVisible: false }))}
                  theme={theme}
                />
              )}

              {imageQueryUI.isVisible && editor.isActive('image') && (
                <ImageQueryUI 
                  position={imageQueryUI.position}
                  query={imageQueryUI.query}
                  setQuery={(query) => setImageQueryUI(prev => ({ ...prev, query }))}
                  onSubmit={handleSubmitImageQuery}
                  onCancel={() => setImageQueryUI(prev => ({ ...prev, isVisible: false }))}
                  theme={theme}
                  isProcessing={imageQueryUI.isProcessing}
                />
              )}

              {showAiChat && (
                <NotionStyleAiHelper 
                  position={aiChatPosition}
                  query={aiChatQuery}
                  setQuery={setAiChatQuery}
                  onSubmit={handleAiSubmit}
                  onCancel={handleCancelAiChat}
                  theme={theme}
                  isProcessing={isAiProcessing}
                />
              )}

              {aiChatUI.isVisible && !showAiChat && (
                <AiChatUI
                  position={aiChatUI.position}
                  query={aiChatUI.query}
                  setQuery={(query) => setAiChatUI({ ...aiChatUI, query })}
                  onSubmit={handleAiSubmit}
                  onCancel={handleCancelAiChat}
                  theme={theme}
                  isProcessing={aiChatUI.isProcessing}
                />
              )}

              {textImproveUI.isVisible && (
                <TextImproveUI 
                  position={textImproveUI.position}
                  mode={textImproveUI.mode}
                  setMode={(mode) => setTextImproveUI(prev => ({ ...prev, mode }))}
                  prompt={textImproveUI.prompt}
                  setPrompt={(prompt) => setTextImproveUI(prev => ({ ...prev, prompt }))}
                  onSubmit={handleSubmitTextImprove}
                  onCancel={() => setTextImproveUI(prev => ({ ...prev, isVisible: false }))}
                  theme={theme}
                  isProcessing={textImproveUI.isProcessing}
                />
              )}

            <EditorContent editor={editor} className="TiptapEditor" />
            <GetStartedWithButtons />
            {youtubeHelperInfo.isVisible && 
              <YouTubeHelperUI 
                info={youtubeHelperInfo}
                onCancel={handleYoutubeHelperCancel}
                onSubmit={handleYoutubeHelperSubmit}
                theme={theme}
                onLinkChange={handleYoutubeLinkChange}
                onPromptChange={handleYoutubePromptChange}
                style={youtubeHelperStyle} // Pass memoized style
              />
            }
            {flashcardGeneratorInfo.isVisible && 
              <FlashcardGeneratorUI 
                info={flashcardGeneratorInfo} 
                onCancel={handleFlashcardGeneratorCancel} 
                theme={theme} 
                onFlashcardsGenerated={handleGeneratedFlashcards}
                style={flashcardGeneratorStyle}
                editor={editor}
              />
            }
            {/* Render TinyCatsExplainView conditionally */}
            {tinyCatsExplainViewVisible && (
              <TinyCatsExplainView
                isVisible={tinyCatsExplainViewVisible}
                onClose={handleCloseTinyCatsExplainView}
                theme={theme}
              />
            )}
            </div>
          )
        ) : (
          <div className="EmptyState">
            <p>No file selected. Open a file from the sidebar or create a new file or canvas.</p>
            <div className="EmptyStateButtons">
              <button onClick={handleNewFile} className="NewFileButton">Create New File</button>
              <button onClick={handleNewCanvas} className="NewCanvasButton">Create New Canvas</button>
            </div>
          </div>
        )}
      </div>

      <div className="Footer">
        {activeFileId ? (
          <>
            <div className="FooterLeft">
              <div className="FooterItem">
                <FileCog size={14} />
                <span>{getFileExtension() || 'FILE'}</span>
              </div>
            </div>
            <div className="FooterRight">
              {!canvasMode && (
                <>
                  <div className="FooterItem optional">
                    <Type size={14} />
                    <span>{wordCount} Words</span>
                  </div>
                  <div className="FooterItem">
                    <FileText size={14} />
                    <span>{charCount} Chars</span>
                  </div>
                </>
              )}
              {(lastSaved || lastAutoSave) && (
                <div className="FooterItem optional">
                  <Clock size={14} />
                  <span>Saved: {getLastSavedTime()}</span>
                </div>
              )}
              {unsavedChanges[activeFileId] && (
                <div className="FooterItem">
                  <AlertCircle size={14} className="UnsavedIndicator" />
                  <span className="UnsavedIndicator">Unsaved</span>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="FooterItem">Ready</div>
        )}
      </div>
    </div>
  );
};

export default Editor;
