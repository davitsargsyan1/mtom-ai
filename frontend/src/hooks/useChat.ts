import { useState, useCallback, useRef, useEffect } from 'react';
import { useMutation, useQuery } from 'react-query';
import { chatApi } from '../services/api';
import { ChatMessage, SendMessageRequest, CustomerInfo } from '../types';

interface UseChatOptions {
  sessionId?: string;
  customerInfo?: CustomerInfo;
  autoScroll?: boolean;
}

interface UseChatReturn {
  messages: ChatMessage[];
  isLoading: boolean;
  error: string | null;
  sessionId: string | null;
  sendMessage: (message: string) => Promise<void>;
  clearMessages: () => void;
  setCustomerInfo: (info: CustomerInfo) => void;
  messagesEndRef: React.RefObject<HTMLDivElement>;
}

export const useChat = (options: UseChatOptions = {}): UseChatReturn => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(options.sessionId || null);
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | undefined>(options.customerInfo);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  const scrollToBottom = useCallback(() => {
    if (options.autoScroll !== false) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [options.autoScroll]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Load existing session if sessionId is provided
  const { isLoading: isLoadingSession } = useQuery(
    ['session', sessionId],
    () => (sessionId ? chatApi.getSession(sessionId) : null),
    {
      enabled: !!sessionId,
      onSuccess: session => {
        if (session) {
          setMessages(session.messages);
          setCustomerInfo(session.customerInfo);
        }
      },
      onError: err => {
        console.error('Failed to load session:', err);
        setError('Failed to load chat session');
      },
    },
  );

  // Send message mutation
  const sendMessageMutation = useMutation(chatApi.sendMessage, {
    onSuccess: response => {
      setSessionId(response.sessionId);

      // Add assistant message to local state
      const assistantMessage: ChatMessage = {
        id: response.messageId,
        sessionId: response.sessionId,
        content: response.response,
        role: 'assistant',
        timestamp: response.timestamp,
        metadata: {
          confidence: response.metadata?.confidence,
        },
      };

      setMessages(prev => [...prev, assistantMessage]);
      setError(null);
    },
    onError: (err: any) => {
      console.error('Failed to send message:', err);
      setError(err.response?.data?.message || 'Failed to send message');
    },
  });

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim()) return;

      // Add user message to local state immediately
      const userMessage: ChatMessage = {
        id: `temp-${Date.now()}`,
        sessionId: sessionId || '',
        content: content.trim(),
        role: 'user',
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, userMessage]);

      // Send message to API
      const request: SendMessageRequest = {
        sessionId: sessionId || undefined,
        message: content.trim(),
        customerInfo,
      };

      await sendMessageMutation.mutateAsync(request);
    },
    [sessionId, customerInfo, sendMessageMutation],
  );

  const clearMessages = useCallback(() => {
    setMessages([]);
    setSessionId(null);
    setError(null);
  }, []);

  const updateCustomerInfo = useCallback((info: CustomerInfo) => {
    setCustomerInfo(info);
  }, []);

  return {
    messages,
    isLoading: isLoadingSession || sendMessageMutation.isLoading,
    error,
    sessionId,
    sendMessage,
    clearMessages,
    setCustomerInfo: updateCustomerInfo,
    messagesEndRef,
  };
};
