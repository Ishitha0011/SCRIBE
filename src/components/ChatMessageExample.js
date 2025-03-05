import React from 'react';
import { Trash2 } from 'lucide-react';
import ChatMessageExpand from './ChatMessageExpand';

const ChatMessageExample = ({ 
  message, 
  allMessages,
  onSendMessage,
  onDeleteMessage 
}) => {
  return (
    <div className={`ChatMessage ${message.sender === 'user' ? 'UserMessage' : 'AIMessage'}`}>
      <div className="MessageHeader">
        <div className="MessageSender">
          {message.sender === 'user' ? 'You' : 'AI Assistant'}
        </div>
        <div className="MessageActions">
          {message.sender === 'user' && (
            <>
              <ChatMessageExpand 
                message={message}
                allMessages={allMessages}
                onSendMessage={onSendMessage}
                onDeleteMessage={onDeleteMessage}
              />
              <button 
                className="MessageActionButton" 
                onClick={() => onDeleteMessage(message.id)}
                title="Delete message"
              >
                <Trash2 size={16} />
              </button>
            </>
          )}
        </div>
      </div>
      <div className="MessageContent">
        {message.content}
      </div>
    </div>
  );
};

export default ChatMessageExample; 