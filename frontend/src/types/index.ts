export interface ChatMessage {
  id: string;
  sessionId: string;
  content: string;
  role: 'user' | 'assistant' | 'system';
  timestamp: Date;
  metadata?: {
    responseTime?: number;
    tokensUsed?: number;
    confidence?: number;
  };
}

export interface ChatSession {
  id: string;
  userId?: string;
  customerInfo?: CustomerInfo;
  messages: ChatMessage[];
  status: 'active' | 'resolved' | 'escalated';
  createdAt: Date;
  updatedAt: Date;
  metadata?: {
    source?: string;
    category?: string;
    priority?: 'low' | 'medium' | 'high';
  };
}

export interface CustomerInfo {
  email?: string;
  name?: string;
  userId?: string;
  company?: string;
  context?: Record<string, any>;
}

export interface SendMessageRequest {
  sessionId?: string;
  message: string;
  customerInfo?: CustomerInfo;
}

export interface SendMessageResponse {
  sessionId: string;
  response: string;
  messageId: string;
  timestamp: Date;
  metadata?: {
    confidence: number;
    sources?: string[];
  };
}

export interface SessionStats {
  total: number;
  active: number;
  resolved: number;
  escalated: number;
}
