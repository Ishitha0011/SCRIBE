import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Plus, X, Save, FileText, Clock, Hash, Type, AlertCircle, FileCog, Bold, Italic, Underline, Code, List, ListOrdered, CheckSquare, Link as LinkIcon, Image as ImageIcon, AlignLeft, AlignCenter, AlignRight, Table as TableIcon, Heading1, Heading2, Heading3, Highlighter } from 'lucide-react';
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
        placeholder: 'Type something or use "/" for commands...',
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
        resizable: true,
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
    ],
    content: '',
    onUpdate: ({ editor }) => {
      if (!editor) return;
      
      const htmlContent = editor.getHTML();
      setLocalContent(htmlContent);
      setCharCount(editor?.storage.characterCount?.characters() || 0);
      setWordCount(editor?.storage.characterCount?.words() || 0);

      if (activeFileId && htmlContent !== fileContents[activeFileId]) {
        setUnsavedChanges((prev) => ({ ...prev, [activeFileId]: true }));
      } else if (activeFileId) {
        setUnsavedChanges((prev) => {
          const updated = { ...prev };
          delete updated[activeFileId];
          return updated;
        });
      }
    },
    editorProps: {
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

        if (imagePasted) {
          return true;
        }

        return false;
      },
    },
  });

  const handleImageUpload = useCallback(async (file) => {
    if (!editor || !activeFileId) return;

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

      if (!response.ok) {
        throw new Error(`Failed to upload image: ${response.statusText}`);
      }

      const data = await response.json();
      const imageUrl = `http://localhost:8000${data.path}`;

      editor.chain().focus().setImage({ src: imageUrl, alt: fileName }).run();

    } catch (error) {
      console.error('Error uploading image:', error);
      alert(`Failed to upload image: ${error.message}`);
    }
  }, [editor, activeFileId, openFiles]);

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
    if (!editor) return;
    
    editor.chain()
      .focus()
      .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
      .run();
  }, [editor]);

  const checkCanvasFile = useCallback((file) => {
    if (!file) return;
    
    const isCanvasType = file.type === 'canvas';
    const hasCanvasExtension = file.name && file.name.toLowerCase().endsWith('.canvas');
    
    if (isCanvasType || hasCanvasExtension) {
      setCanvasMode(true);
      if (editor) editor.setEditable(false);
      try {
        const canvasContent = fileContents[file.id] || '{}';
        const parsedData = JSON.parse(canvasContent);
        
        if (!parsedData.nodes || !parsedData.edges) {
          const initialData = { nodes: [], edges: [], format: "canvas", version: "1.0" };
          updateFileContent(file.id, JSON.stringify(initialData));
          setCanvasData(initialData);
        } else {
          setCanvasData(parsedData);
        }
        
        if (!isCanvasType) {
          updateFileType(file.id, 'canvas');
        }
      } catch (error) {
        console.error('Error parsing canvas data:', error);
        const initialData = { nodes: [], edges: [], format: "canvas", version: "1.0" };
        updateFileContent(file.id, JSON.stringify(initialData));
        setCanvasData(initialData);
      }
    } else {
      setCanvasMode(false);
      if (editor) editor.setEditable(true);
    }
  }, [editor, fileContents, updateFileContent, updateFileType]);

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
    if (editor) {
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
              if (editor) editor.setEditable(false);
            } catch (error) {
              console.error('Error parsing canvas data:', error);
              const initialData = { nodes: [], edges: [], format: "canvas", version: "1.0" };
              updateFileContent(file.id, JSON.stringify(initialData));
              setCanvasData(initialData);
            }
          } else {
            checkCanvasFile(file);
            
            if (!canvasMode && contentToLoad !== editor.getHTML()) {
              try {
                editor.commands.setContent(contentToLoad || '', false);
                setLocalContent(contentToLoad || '');
              } catch (error) {
                console.error('Error setting editor content:', error);
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
        try {
        editor.commands.setContent('', false);
        setLocalContent('');
        } catch (error) {
          console.error('Error clearing editor content:', error);
        }
        setCanvasMode(false);
        setUnsavedChanges({});
      }
      
      try {
      setCharCount(editor.storage.characterCount?.characters() || 0);
      setWordCount(editor.storage.characterCount?.words() || 0);
      } catch (error) {
        console.error('Error updating character count:', error);
        setCharCount(0);
        setWordCount(0);
      }
    }
  }, [activeFileId, fileContents, editor, openFiles, checkCanvasFile, updateFileType, canvasMode, updateFileContent]);

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
        } else if (editor) {
          const contentToSave = (id === activeFileId) ? editor.getHTML() : fileContents[id];
          await saveFile(id, contentToSave);
        }
      }
    }
    
    // If we're closing the active file and it's the last one
    if (id === activeFileId && openFiles.length === 1) {
      // Clear the editor first to prevent DOM errors
      if (editor) {
        try {
          editor.commands.clearContent(false);
        } catch (error) {
          console.error('Error clearing editor content:', error);
        }
      }
    }
    
    closeFile(id);
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

  // Add a cleanup effect to destroy editor on unmount
  useEffect(() => {
    return () => {
      // Clean up the editor properly when component unmounts
      if (editor) {
        editor.destroy();
      }
    };
  }, [editor]);

  // Add a handler for empty workspace
  useEffect(() => {
    if (openFiles.length === 0 && editor) {
      try {
        // Clear content when no files are open
        editor.commands.setContent('', false);
        setLocalContent('');
        setCharCount(0);
        setWordCount(0);
      } catch (error) {
        console.error('Error clearing editor on empty workspace:', error);
      }
    }
  }, [openFiles, editor]);

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
              {editor && (
                <BubbleMenu editor={editor} tippyOptions={{ duration: 100 }} className={`EditorBubbleMenu ${theme === 'dark' ? 'dark' : ''}`}>
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
                      title="Code"
                    >
                      <Code size={16} />
                    </button>
                    <button
                      onClick={() => editor.chain().focus().toggleHighlight().run()}
                      className={editor.isActive('highlight') ? 'is-active' : ''}
                      title="Highlight"
                    >
                      <Highlighter size={16} />
                    </button>
                    <button
                      onClick={addLink}
                      className={editor.isActive('link') ? 'is-active' : ''}
                      title="Add Link"
                    >
                      <LinkIcon size={16} />
                    </button>
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
              )}
              
              {editor && (
                <FloatingMenu editor={editor} tippyOptions={{ duration: 100 }} className={`EditorFloatingMenu ${theme === 'dark' ? 'dark' : ''}`}>
                  <div className="MenuButtons">
                    <button
                      onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
                      className={editor.isActive('heading', { level: 1 }) ? 'is-active' : ''}
                      title="Heading 1"
                    >
                      <Heading1 size={16} />
                    </button>
                    <button
                      onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                      className={editor.isActive('heading', { level: 2 }) ? 'is-active' : ''}
                      title="Heading 2"
                    >
                      <Heading2 size={16} />
                    </button>
                    <button
                      onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
                      className={editor.isActive('heading', { level: 3 }) ? 'is-active' : ''}
                      title="Heading 3"
                    >
                      <Heading3 size={16} />
                    </button>
                    <button
                      onClick={() => editor.chain().focus().toggleBulletList().run()}
                      className={editor.isActive('bulletList') ? 'is-active' : ''}
                      title="Bullet List"
                    >
                      <List size={16} />
                    </button>
                    <button
                      onClick={() => editor.chain().focus().toggleOrderedList().run()}
                      className={editor.isActive('orderedList') ? 'is-active' : ''}
                      title="Ordered List"
                    >
                      <ListOrdered size={16} />
                    </button>
                    <button
                      onClick={() => editor.chain().focus().toggleTaskList().run()}
                      className={editor.isActive('taskList') ? 'is-active' : ''}
                      title="Task List"
                    >
                      <CheckSquare size={16} />
                    </button>
                    <button
                      onClick={createTable}
                      title="Insert Table"
                    >
                      <TableIcon size={16} />
                    </button>
                    <button
                      onClick={() => editor.chain().focus().toggleCodeBlock().run()}
                      className={editor.isActive('codeBlock') ? 'is-active' : ''}
                      title="Code Block"
                    >
                      <Code size={16} />
                    </button>
                    <button
                      onClick={() => {
                        const input = document.createElement('input');
                        input.type = 'file';
                        input.accept = 'image/*';
                        input.onchange = e => {
                          if (e.target.files?.length) {
                            handleImageUpload(e.target.files[0]);
                          }
                        };
                        input.click();
                      }}
                      title="Insert Image"
                    >
                      <ImageIcon size={16} />
                    </button>
                  </div>
                </FloatingMenu>
              )}
              
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
