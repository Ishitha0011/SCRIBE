import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Plus, X, Save, FileText, Clock, Hash, Type, AlertCircle, FileCog, Bold, Italic, Underline, Code, List, ListOrdered, CheckSquare, Link as LinkIcon, Image as ImageIcon, AlignLeft, AlignCenter, AlignRight, Table as TableIcon, Heading1, Heading2, Heading3, Highlighter, Trash2, ArrowUpToLine, ArrowDownToLine, ArrowLeftToLine, ArrowRightToLine, Pilcrow, Palette, CaseUpper, CaseLower, Strikethrough, Subscript, Superscript, Sigma, CornerUpLeft, ChevronDown, CaseSensitive } from 'lucide-react';
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
import '../css/Editor.css';

// New Extensions
import TextStyle from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import FontFamily from '@tiptap/extension-font-family';
import Strike from '@tiptap/extension-strike';
import SubscriptExtension from '@tiptap/extension-subscript';
import SuperscriptExtension from '@tiptap/extension-superscript';
import MathExtension from '@aarkue/tiptap-math-extension'; // Community Math Extension
import 'katex/dist/katex.min.css'; // Import KaTeX CSS

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
  
  const { theme } = useTheme();
  const {
    openFiles,
    activeFileId,
    fileContents,
    openFile,
    closeFile,
    saveFile,
    updateFileContent,
    updateFileType
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
  }, [activeFileId, fileContents, setLocalContent, setCharCount, setWordCount, setUnsavedChanges, setFontFamily, setFontSize]);

  // Memoized editorProps
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
    },
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
        codeBlock: false, // We'll use CodeBlockLowlight instead
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
        placeholder: 'Type \'/\' for commands...',
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
      CodeBlockLowlight.configure({
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
    if (!lastSaved) return 'Never';
    
    const now = new Date();
    const diff = Math.floor((now - lastSaved) / 1000);
    
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} hours ago`;
    return lastSaved.toLocaleTimeString();
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

  if (!editor) {
    return <div>Loading Editor...</div>;
  }

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
                  // Only show if editor exists, is not in a table, has focus, AND text is selected
                  return !!editor && !editor.isActive('table') && view.hasFocus() && !selection.empty;
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
                 </div>
              </FloatingMenu>
              
              <EditorContent editor={editor} className="TiptapEditor" />
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
              {lastSaved && (
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
