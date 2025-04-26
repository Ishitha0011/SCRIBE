import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Plus, X, Save, FileText, Clock, Hash, Type, AlertCircle, FileCog } from 'lucide-react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import CharacterCount from '@tiptap/extension-character-count';
import { useTheme } from '../ThemeContext';
import { useFileContext } from '../FileContext';
import Switch from './ui/Switch';
import NotesCanvas from './NotesCanvas';
import '../css/Editor.css';

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
        }
      }),
      Image.configure({
        inline: false,
        allowBase64: false,
        HTMLAttributes: {
          class: 'markdown-image',
        },
      }),
      CharacterCount,
    ],
    content: '',
    onUpdate: ({ editor }) => {
      const htmlContent = editor.getHTML();
      setLocalContent(htmlContent);
      setCharCount(editor.storage.characterCount?.characters() || 0);
      setWordCount(editor.storage.characterCount?.words() || 0);

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
              editor.commands.setContent(contentToLoad, false);
              setLocalContent(contentToLoad);
            }
          }
          
          setUnsavedChanges((prev) => {
            const updated = { ...prev };
            delete updated[activeFileId];
            return updated;
          });
        }
      } else {
        editor.commands.setContent('', false);
        setLocalContent('');
        setCanvasMode(false);
        setUnsavedChanges({});
      }
      
      setCharCount(editor.storage.characterCount?.characters() || 0);
      setWordCount(editor.storage.characterCount?.words() || 0);
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
            <EditorContent editor={editor} className="TiptapEditor" />
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
