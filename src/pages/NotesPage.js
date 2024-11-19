import React, { useState } from 'react';
import { Reorder } from 'framer-motion';
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { X, Plus } from "lucide-react";

const NotesPage = () => {
  const [notes, setNotes] = useState([
    "Brainstorm project ideas",
    "Research AI trends",
    "Plan weekly schedule"
  ]);
  const [newNote, setNewNote] = useState("");

  const addNote = () => {
    if (newNote.trim()) {
      setNotes(prev => [...prev, newNote.trim()]);
      setNewNote("");
    }
  };

  const removeNote = (index) => {
    setNotes(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-4">
      <Reorder.Group 
        axis="y" 
        values={notes} 
        onReorder={setNotes}
        className="space-y-2"
      >
        {notes.map((note, index) => (
          <Reorder.Item key={note} value={note}>
            <div className="flex items-center bg-secondary p-2 rounded">
              <span className="flex-grow">{note}</span>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => removeNote(index)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </Reorder.Item>
        ))}
      </Reorder.Group>

      <div className="input-area flex space-x-2">
        <Input
          type="text"
          placeholder="Add a new note..."
          value={newNote}
          onChange={(e) => setNewNote(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addNote()}
          className="flex-grow"
        />
        <Button onClick={addNote}>
          <Plus className="mr-2 h-4 w-4" /> Add
        </Button>
      </div>
    </div>
  );
};

export default NotesPage;
