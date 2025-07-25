import axios from 'axios';
import { SendMessageRequest, SendMessageResponse, ChatSession, SessionStats } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

// Request interceptor for logging
api.interceptors.request.use(config => {
  console.log(`[API] ${config.method?.toUpperCase()} ${config.url}`);
  return config;
});

// Response interceptor for error handling
api.interceptors.response.use(
  response => response,
  error => {
    console.error('[API Error]:', error.response?.data || error.message);
    return Promise.reject(error);
  },
);

export const chatApi = {
  /**
   * Send a message and get AI response
   */
  sendMessage: async (request: SendMessageRequest): Promise<SendMessageResponse> => {
    const response = await api.post<SendMessageResponse>('/chat/send', request);
    return {
      ...response.data,
      timestamp: new Date(response.data.timestamp),
    };
  },

  /**
   * Get session details and message history
   */
  getSession: async (sessionId: string): Promise<ChatSession> => {
    const response = await api.get<ChatSession>(`/chat/session/${sessionId}`);
    return {
      ...response.data,
      createdAt: new Date(response.data.createdAt),
      updatedAt: new Date(response.data.updatedAt),
      messages: response.data.messages.map(msg => ({
        ...msg,
        timestamp: new Date(msg.timestamp),
      })),
    };
  },

  /**
   * Update session status
   */
  updateSessionStatus: async (
    sessionId: string,
    status: 'active' | 'resolved' | 'escalated',
  ): Promise<void> => {
    await api.put(`/chat/session/${sessionId}/status`, { status });
  },

  /**
   * Export session transcript
   */
  exportTranscript: async (sessionId: string): Promise<Blob> => {
    const response = await api.get(`/chat/session/${sessionId}/transcript`, {
      responseType: 'blob',
    });
    return response.data;
  },

  /**
   * Get chat statistics
   */
  getStats: async (): Promise<SessionStats> => {
    const response = await api.get<SessionStats>('/chat/stats');
    return response.data;
  },
};

// Health check function
export const healthCheck = async (): Promise<boolean> => {
  try {
    await axios.get(`${API_BASE_URL}/health`);
    return true;
  } catch {
    return false;
  }
};

export default api;
