import React, { useState } from 'react';
import { Send } from 'lucide-react';
import '../css/AskAI.css';

const AskAI = () => {
  const [userInput, setUserInput] = useState('');
  const [messages, setMessages] = useState([]);

  const handleSubmit = async () => {
    if (!userInput.trim()) return;

    // Add user message to chat
    setMessages((prevMessages) => [
      ...prevMessages,
      { text: userInput, sender: 'user' },
    ]);

    try {
      const response = await fetch('http://localhost:8000/ask-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: userInput }),
      });
      const data = await response.json();

      // Add AI response to chat
      setMessages((prevMessages) => [
        ...prevMessages,
        { text: userInput, sender: 'user' },
        { text: data.response, sender: 'ai' },
      ]);
      setUserInput('');
    } catch (error) {
      console.error('Error fetching AI response:', error);
    }
  };

  return (
    <div className="ChatContainer">
      {/* Chat display */}
      <div className="ChatDisplayContainer">
        {messages.map((message, index) => (
          <div key={index} className={`Message ${message.sender}`}>
            <p>{message.text}</p>
          </div>
        ))}
      </div>

      {/* Chat input */}
      <div className="ChatInputContainer">
        <textarea
          placeholder="Ask Scribe..."
          className="AskAIInput"
          value={userInput}
          onChange={(e) => setUserInput(e.target.value)}
        />
        <button onClick={handleSubmit} className="SubmitButton">
          <Send />
        </button>
      </div>
    </div>
  );
};

export default AskAI;
