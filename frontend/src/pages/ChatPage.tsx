import React, { useState } from 'react';
import { Send, User, Bot, AlertCircle } from 'lucide-react';
import { useChat } from '../hooks/useChat';
import { CustomerInfo } from '../types';
import CustomerInfoForm from '../components/CustomerInfoForm';
import MessageList from '../components/MessageList';

const ChatPage: React.FC = () => {
  const [inputMessage, setInputMessage] = useState('');
  const [showCustomerForm, setShowCustomerForm] = useState(false);
  const {
    messages,
    isLoading,
    error,
    sessionId,
    sendMessage,
    clearMessages,
    setCustomerInfo,
    messagesEndRef,
  } = useChat({ autoScroll: true });

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim() || isLoading) return;

    await sendMessage(inputMessage);
    setInputMessage('');
  };

  const handleCustomerInfoSubmit = (info: CustomerInfo) => {
    setCustomerInfo(info);
    setShowCustomerForm(false);
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 h-[700px] flex flex-col">
        {/* Header */}
        <div className="border-b border-gray-200 p-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Bot className="h-8 w-8 text-primary-600" />
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Customer Support</h2>
              <p className="text-sm text-gray-500">
                {sessionId ? `Session: ${sessionId.slice(0, 8)}...` : 'New conversation'}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button onClick={() => setShowCustomerForm(true)} className="btn btn-secondary btn-sm">
              <User className="h-4 w-4 mr-1" />
              Customer Info
            </button>
            <button onClick={clearMessages} className="btn btn-secondary btn-sm">
              New Chat
            </button>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border-l-4 border-red-400 p-4 m-4">
            <div className="flex">
              <AlertCircle className="h-5 w-5 text-red-400" />
              <div className="ml-3">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 ? (
            <div className="text-center py-12">
              <Bot className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Welcome to Customer Support
              </h3>
              <p className="text-gray-500">
                Hi! How can I help you today? Feel free to ask any questions.
              </p>
            </div>
          ) : (
            <MessageList messages={messages} isLoading={isLoading} />
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Form */}
        <div className="border-t border-gray-200 p-4">
          <form onSubmit={handleSendMessage} className="flex space-x-3">
            <input
              type="text"
              value={inputMessage}
              onChange={e => setInputMessage(e.target.value)}
              placeholder="Type your message..."
              className="input flex-1"
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={!inputMessage.trim() || isLoading}
              className="btn btn-primary btn-md"
            >
              {isLoading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </button>
          </form>
        </div>
      </div>

      {/* Customer Info Modal */}
      {showCustomerForm && (
        <CustomerInfoForm
          onSubmit={handleCustomerInfoSubmit}
          onClose={() => setShowCustomerForm(false)}
        />
      )}
    </div>
  );
};

export default ChatPage;
