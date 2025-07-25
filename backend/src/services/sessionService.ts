import { v4 as uuidv4 } from 'uuid';
import { ChatSession, ChatMessage, CustomerInfo } from '../types/index.js';

// TODO: Replace with proper database storage (Redis, MongoDB, etc.)
// This is an in-memory store for demo purposes
class InMemorySessionStore {
  private sessions: Map<string, ChatSession> = new Map();
  private userSessions: Map<string, string[]> = new Map();

  async createSession(customerInfo?: CustomerInfo): Promise<ChatSession> {
    const session: ChatSession = {
      id: uuidv4(),
      userId: customerInfo?.userId,
      customerInfo,
      messages: [],
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.sessions.set(session.id, session);

    if (customerInfo?.userId) {
      const userSessionIds = this.userSessions.get(customerInfo.userId) || [];
      userSessionIds.push(session.id);
      this.userSessions.set(customerInfo.userId, userSessionIds);
    }

    return session;
  }

  async getSession(sessionId: string): Promise<ChatSession | null> {
    return this.sessions.get(sessionId) || null;
  }

  async updateSession(session: ChatSession): Promise<void> {
    session.updatedAt = new Date();
    this.sessions.set(session.id, session);
  }

  async getUserSessions(userId: string): Promise<ChatSession[]> {
    const sessionIds = this.userSessions.get(userId) || [];
    return sessionIds
      .map(id => this.sessions.get(id))
      .filter((session): session is ChatSession => session !== undefined);
  }

  async addMessage(sessionId: string, message: ChatMessage): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.messages.push(message);
      session.updatedAt = new Date();
      this.sessions.set(sessionId, session);
    }
  }

  async deleteSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session && session.userId) {
      const userSessionIds = this.userSessions.get(session.userId) || [];
      const filteredIds = userSessionIds.filter(id => id !== sessionId);
      this.userSessions.set(session.userId, filteredIds);
    }
    this.sessions.delete(sessionId);
  }

  async getAllSessions(): Promise<ChatSession[]> {
    return Array.from(this.sessions.values());
  }

  async getSessionsByStatus(status: ChatSession['status']): Promise<ChatSession[]> {
    return Array.from(this.sessions.values()).filter(session => session.status === status);
  }
}

export class SessionService {
  private store: InMemorySessionStore;

  constructor() {
    this.store = new InMemorySessionStore();
  }

  /**
   * Create a new chat session
   */
  async createSession(customerInfo?: CustomerInfo): Promise<ChatSession> {
    return this.store.createSession(customerInfo);
  }

  /**
   * Get an existing session by ID
   */
  async getSession(sessionId: string): Promise<ChatSession | null> {
    return this.store.getSession(sessionId);
  }

  /**
   * Add a message to a session
   */
  async addMessage(
    sessionId: string,
    content: string,
    role: 'user' | 'assistant' | 'system',
    metadata?: ChatMessage['metadata'],
  ): Promise<ChatMessage> {
    const message: ChatMessage = {
      id: uuidv4(),
      sessionId,
      content,
      role,
      timestamp: new Date(),
      metadata,
    };

    await this.store.addMessage(sessionId, message);
    return message;
  }

  /**
   * Get or create a session
   */
  async getOrCreateSession(sessionId?: string, customerInfo?: CustomerInfo): Promise<ChatSession> {
    if (sessionId) {
      const existingSession = await this.getSession(sessionId);
      if (existingSession) {
        return existingSession;
      }
    }

    return this.createSession(customerInfo);
  }

  /**
   * Update session status
   */
  async updateSessionStatus(sessionId: string, status: ChatSession['status']): Promise<void> {
    const session = await this.getSession(sessionId);
    if (session) {
      session.status = status;
      await this.store.updateSession(session);
    }
  }

  /**
   * Get conversation history for context
   */
  async getConversationHistory(sessionId: string, limit: number = 10): Promise<string[]> {
    const session = await this.getSession(sessionId);
    if (!session) return [];

    return session.messages.slice(-limit).map(msg => `${msg.role}: ${msg.content}`);
  }

  /**
   * Get sessions for a user
   */
  async getUserSessions(userId: string): Promise<ChatSession[]> {
    return this.store.getUserSessions(userId);
  }

  /**
   * Delete a session
   */
  async deleteSession(sessionId: string): Promise<void> {
    await this.store.deleteSession(sessionId);
  }

  /**
   * Export session transcript in a formatted way
   */
  async exportSessionTranscript(sessionId: string): Promise<string> {
    const session = await this.store.getSession(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    const messages = session.messages || [];
    let transcript = `Chat Session: ${sessionId}\n`;
    transcript += `Started: ${new Date(session.createdAt).toLocaleString()}\n`;
    if (session.customerInfo?.name) {
      transcript += `Customer: ${session.customerInfo.name}\n`;
    }
    if (session.customerInfo?.email) {
      transcript += `Email: ${session.customerInfo.email}\n`;
    }
    transcript += `Status: ${session.status}\n`;
    transcript += `\n--- Conversation ---\n\n`;

    messages.forEach(message => {
      const timestamp = new Date(message.timestamp).toLocaleString();
      const sender =
        message.role === 'user'
          ? 'Customer'
          : message.role === 'assistant'
          ? 'AI Assistant'
          : 'System';

      transcript += `[${timestamp}] ${sender}:\n${message.content}\n\n`;
    });

    return transcript;
  }

  /**
   * Get session statistics for analytics
   */
  async getSessionStats(): Promise<{
    total: number;
    active: number;
    resolved: number;
    escalated: number;
  }> {
    const allSessions = await this.store.getAllSessions();

    return {
      total: allSessions.length,
      active: allSessions.filter(s => s.status === 'active').length,
      resolved: allSessions.filter(s => s.status === 'resolved').length,
      escalated: allSessions.filter(s => s.status === 'escalated').length,
    };
  }
}
