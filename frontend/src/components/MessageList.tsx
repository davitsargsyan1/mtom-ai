import React from 'react';
import { User, Bot, Clock } from 'lucide-react';
import { ChatMessage } from '../types';
import { formatDistanceToNow } from 'date-fns';

interface MessageListProps {
  messages: ChatMessage[];
  isLoading?: boolean;
}

const MessageList: React.FC<MessageListProps> = ({ messages, isLoading }) => {
  return (
    <>
      {messages.map(message => (
        <div
          key={message.id}
          className={`chat-message ${
            message.role === 'user' ? 'chat-message-user' : 'chat-message-assistant'
          }`}
        >
          {message.role === 'assistant' && (
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
                <Bot className="h-4 w-4 text-primary-600" />
              </div>
            </div>
          )}

          <div className="flex-1">
            <div
              className={`chat-bubble ${
                message.role === 'user' ? 'chat-bubble-user' : 'chat-bubble-assistant'
              }`}
            >
              <p className="whitespace-pre-wrap">{message.content}</p>

              {/* Message metadata */}
              <div
                className={`flex items-center justify-between mt-2 text-xs ${
                  message.role === 'user' ? 'text-blue-100' : 'text-gray-500'
                }`}
              >
                <div className="flex items-center space-x-1">
                  <Clock className="h-3 w-3" />
                  <span>{formatDistanceToNow(message.timestamp, { addSuffix: true })}</span>
                </div>

                {message.metadata?.confidence && (
                  <div className="flex items-center space-x-1">
                    <span>Confidence: {Math.round(message.metadata.confidence * 100)}%</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {message.role === 'user' && (
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                <User className="h-4 w-4 text-gray-600" />
              </div>
            </div>
          )}
        </div>
      ))}

      {/* Typing indicator */}
      {isLoading && (
        <div className="chat-message chat-message-assistant">
          <div className="flex-shrink-0">
            <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
              <Bot className="h-4 w-4 text-primary-600" />
            </div>
          </div>
          <div className="flex-1">
            <div className="chat-bubble chat-bubble-assistant">
              <div className="flex items-center space-x-1">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                <div
                  className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                  style={{ animationDelay: '0.1s' }}
                />
                <div
                  className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                  style={{ animationDelay: '0.2s' }}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default MessageList;
