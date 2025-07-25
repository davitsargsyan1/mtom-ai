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
  status: 'active' | 'resolved' | 'escalated' | 'waiting_for_staff' | 'with_staff';
  createdAt: Date;
  updatedAt: Date;
  assignedStaff?: string; // Staff user ID
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

// Feedback & Learning System
export interface MessageRating {
  id: string;
  messageId: string;
  sessionId: string;
  rating: 'positive' | 'negative';
  feedback?: string;
  category?: 'accuracy' | 'helpfulness' | 'response_time' | 'other';
  timestamp: Date;
  userId?: string;
}

export interface SessionFeedback {
  id: string;
  sessionId: string;
  overallRating: number; // 1-5 stars
  feedback: string;
  categories: {
    responsiveness: number;
    helpfulness: number;
    accuracy: number;
    overall: number;
  };
  improvements?: string[];
  timestamp: Date;
  userId?: string;
}

export interface LearningMetrics {
  totalRatings: number;
  positiveRatings: number;
  negativeRatings: number;
  averageSessionRating: number;
  commonIssues: { category: string; count: number }[];
  improvementAreas: string[];
  responseAccuracy: number;
  userSatisfaction: number;
}

export interface RateMessageRequest {
  messageId: string;
  sessionId: string;
  rating: 'positive' | 'negative';
  feedback?: string;
  category?: 'accuracy' | 'helpfulness' | 'response_time' | 'other';
}

export interface SubmitFeedbackRequest {
  sessionId: string;
  overallRating: number;
  feedback: string;
  categories: {
    responsiveness: number;
    helpfulness: number;
    accuracy: number;
    overall: number;
  };
  improvements?: string[];
}

export interface KnowledgeBaseEntry {
  id: string;
  content: string;
  title: string;
  category: string;
  metadata: Record<string, any>;
  embedding?: number[];
  lastUpdated: Date;
}

export interface AIResponse {
  content: string;
  confidence: number;
  sources?: KnowledgeBaseEntry[];
  metadata?: {
    model: string;
    tokensUsed: number;
    responseTime: number;
  };
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

// Staff Management Types
export interface StaffUser {
  id: string;
  email: string;
  name: string;
  role: 'agent' | 'supervisor' | 'admin';
  status: 'online' | 'offline' | 'busy' | 'away';
  createdAt: Date;
  lastActive: Date;
  maxConcurrentChats: number;
  currentChatCount: number;
}

export interface StaffLoginRequest {
  email: string;
  password: string;
}

export interface StaffLoginResponse {
  token: string;
  user: Omit<StaffUser, 'password'>;
}

export interface ChatQueue {
  id: string;
  sessionId: string;
  priority: 'low' | 'medium' | 'high';
  waitTime: number;
  customerInfo?: CustomerInfo;
  lastMessage?: string;
  createdAt: Date;
}

export interface StaffAssignment {
  sessionId: string;
  staffId: string;
  assignedAt: Date;
  status: 'assigned' | 'active' | 'completed';
}

// WebSocket Events
export interface SocketEvents {
  // Staff events
  staff_login: (data: { staffId: string; name: string }) => void;
  staff_logout: (data: { staffId: string }) => void;
  staff_status_change: (data: { staffId: string; status: StaffUser['status'] }) => void;

  // Chat events
  new_message: (data: { sessionId: string; message: ChatMessage }) => void;
  session_assigned: (data: { sessionId: string; staffId: string }) => void;
  session_transferred: (data: { sessionId: string; fromStaff: string; toStaff: string }) => void;
  typing_indicator: (data: { sessionId: string; isTyping: boolean; userId: string }) => void;

  // Queue events
  queue_updated: (data: { queueLength: number; averageWaitTime: number }) => void;
}

// Widget System Types
export interface Widget {
  id: string;
  name: string;
  domain: string;
  isActive: boolean;
  settings: WidgetSettings;
  analytics: WidgetAnalytics;
  createdAt: Date;
  updatedAt: Date;
  apiKey: string; // For authentication
}

export interface WidgetSettings {
  // Appearance
  theme: 'light' | 'dark' | 'auto';
  primaryColor: string;
  secondaryColor: string;
  textColor: string;
  backgroundColor: string;
  borderRadius: number;

  // Position and size
  position: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  marginX: number;
  marginY: number;
  width: number;
  height: number;

  // Behavior
  autoOpen: boolean;
  autoOpenDelay: number; // milliseconds
  showWelcomeMessage: boolean;
  welcomeMessage: string;
  offlineMessage: string;
  placeholderText: string;

  // Branding
  companyName: string;
  companyLogo?: string;
  showBranding: boolean;

  // Features
  allowFileUpload: boolean;
  showTypingIndicator: boolean;
  enableEmojis: boolean;
  enableSoundNotifications: boolean;

  // Availability
  workingHours: {
    enabled: boolean;
    timezone: string;
    schedule: {
      [key: string]: {
        // day of week (monday, tuesday, etc.)
        enabled: boolean;
        start: string; // HH:mm format
        end: string; // HH:mm format
      };
    };
  };
}

export interface WidgetAnalytics {
  totalSessions: number;
  totalMessages: number;
  averageSessionDuration: number; // seconds
  satisfactionRating: number; // 1-5 scale
  conversionRate: number; // percentage
  lastUpdated: Date;
}

export interface WidgetSession {
  id: string;
  widgetId: string;
  sessionId: string; // Links to ChatSession
  visitorId?: string;
  pageUrl: string;
  referrer?: string;
  userAgent?: string;
  ipAddress?: string;
  country?: string;
  startTime: Date;
  endTime?: Date;
  duration?: number; // seconds
  messageCount: number;
  wasHandedOff: boolean;
  satisfactionRating?: number;
}

export interface CreateWidgetRequest {
  name: string;
  domain: string;
  settings?: Partial<WidgetSettings>;
}

export interface UpdateWidgetRequest {
  name?: string;
  domain?: string;
  isActive?: boolean;
  settings?: Partial<WidgetSettings>;
}

export interface WidgetEmbedResponse {
  widgetId: string;
  embedCode: string;
  embedUrl: string;
  configUrl: string;
}

// Visitor Tracking Types
export interface Visitor {
  id: string;
  fingerprint: string;
  firstSeen: Date;
  lastSeen: Date;
  sessionCount: number;
  totalMessages: number;
  averageSessionDuration: number;
  preferredLanguage?: string;
  timezone?: string;
  country?: string;
  city?: string;
  deviceType: 'desktop' | 'mobile' | 'tablet';
  browser: string;
  os: string;
  referralSources: string[];
  tags: string[];
}

export interface VisitorEvent {
  id: string;
  visitorId: string;
  widgetId: string;
  type: 'page_view' | 'widget_open' | 'widget_close' | 'message_sent' | 'satisfaction_rating';
  data: Record<string, any>;
  timestamp: Date;
  pageUrl: string;
  sessionId?: string;
}
