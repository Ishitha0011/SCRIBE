import React, { useState } from 'react';
import { Input } from "../components/ui/input"; // Adjusted path
import { Button } from "../components/ui/button"; // Adjusted path
import { X } from "lucide-react";

const LabsPage = () => {
  const [todoList, setTodoList] = useState({
    prompts: [],
    negativePrompts: []
  });

  const addTodoItem = (type, item) => {
    if (item.trim()) {
      setTodoList(prev => ({
        ...prev,
        [type]: [...prev[type], item.trim()]
      }));
    }
  };

  const removeTodoItem = (type, index) => {
    setTodoList(prev => ({
      ...prev,
      [type]: prev[type].filter((_, i) => i !== index)
    }));
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold mb-2">Prompts</h3>
        {todoList.prompts.map((item, index) => (
          <div key={index} className="flex items-center mb-2 bg-secondary p-2 rounded">
            <span className="flex-grow">{item}</span>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => removeTodoItem('prompts', index)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ))}
        <Input
          type="text"
          placeholder="Add prompt"
          onKeyPress={(e) => {
            if (e.key === 'Enter') {
              addTodoItem('prompts', e.target.value);
              e.target.value = '';
            }
          }}
        />
      </div>
      
      <div>
        <h3 className="font-semibold mb-2">Negative Prompts</h3>
        {todoList.negativePrompts.map((item, index) => (
          <div key={index} className="flex items-center mb-2 bg-secondary p-2 rounded">
            <span className="flex-grow">{item}</span>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => removeTodoItem('negativePrompts', index)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ))}
        <Input
          type="text"
          placeholder="Add negative prompt"
          onKeyPress={(e) => {
            if (e.key === 'Enter') {
              addTodoItem('negativePrompts', e.target.value);
              e.target.value = '';
            }
          }}
        />
      </div>
    </div>
  );
};

export default LabsPage;
