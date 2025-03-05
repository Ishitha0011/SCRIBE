import React, { useState } from 'react';
import { Maximize2 } from 'lucide-react';
import ChatPopup from './ChatPopup';

const ChatMessageExpand = ({ 
  message, 
  allMessages, 
  onSendMessage,
  onDeleteMessage,
  chatTitle = "Conversation" // Default title
}) => {
  const [isPopupOpen, setIsPopupOpen] = useState(false);

  const handleExpandClick = () => {
    setIsPopupOpen(true);
  };

  return (
    <>
      <button 
        className="MessageActionButton" 
        onClick={handleExpandClick} 
        title="Expand conversation"
      >
        <Maximize2 size={16} />
      </button>
      
      {isPopupOpen && (
        <ChatPopup 
          isOpen={isPopupOpen}
          onClose={() => setIsPopupOpen(false)}
          chatHistory={allMessages}
          focusedMessageId={message.id}
          onSendMessage={onSendMessage}
          onDeleteMessage={onDeleteMessage}
          chatTitle={chatTitle}
        />
      )}
    </>
  );
};

export default ChatMessageExpand; 