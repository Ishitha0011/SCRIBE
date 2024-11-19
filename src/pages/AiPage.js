import React, { useState } from 'react';
import { Input } from "../components/ui/input"; // Adjusted path
import { Button } from "../components/ui/button"; // Adjusted path
import { Sparkles } from "lucide-react";

const AIPage = () => {
  const [aiInput, setAiInput] = useState("");
  const [chatHistory, setChatHistory] = useState([]);

  const handleAiInputChange = (e) => {
    setAiInput(e.target.value);
  };

  const handleSendMessage = () => {
    if (aiInput.trim()) {
      setChatHistory(prev => [
        ...prev, 
        { type: 'user', message: aiInput },
        { type: 'ai', message: `AI response to: ${aiInput}` } // Placeholder AI response
      ]);
      setAiInput("");
    }
  };

  return (
    <div className="space-y-4">
      <div className="chat-history space-y-2 max-h-[400px] overflow-y-auto">
        {chatHistory.map((chat, index) => (
          <div 
            key={index} 
            className={`p-2 rounded ${
              chat.type === 'user' 
                ? 'bg-blue-100 text-right dark:bg-blue-900' 
                : 'bg-green-100 dark:bg-green-900'
            }`}
          >
            {chat.message}
          </div>
        ))}
      </div>
      
      <div className="input-area flex space-x-2">
        <Input
          type="text"
          placeholder="Ask AI..."
          value={aiInput}
          onChange={handleAiInputChange}
          onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
          className="flex-grow"
        />
        <Button onClick={handleSendMessage}>
          <Sparkles className="mr-2 h-4 w-4" /> Send
        </Button>
      </div>
    </div>
  );
};

export default AIPage;
