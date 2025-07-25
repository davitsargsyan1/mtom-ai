import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import {
  Widget,
  WidgetSettings,
  WidgetAnalytics,
  WidgetSession,
  CreateWidgetRequest,
  UpdateWidgetRequest,
  WidgetEmbedResponse,
  Visitor,
  VisitorEvent,
} from '../types/index.js';

// TODO: Replace with proper database storage
class InMemoryWidgetStore {
  private widgets: Map<string, Widget> = new Map();
  private widgetSessions: Map<string, WidgetSession> = new Map();
  private visitors: Map<string, Visitor> = new Map();
  private visitorEvents: Map<string, VisitorEvent[]> = new Map();

  constructor() {
    this.createDefaultWidget();
  }

  private async createDefaultWidget() {
    // Use a fixed ID for the default widget so demo always works
    const defaultWidgetId = 'default-widget-demo-id';
    const defaultWidget: Widget = {
      id: defaultWidgetId,
      name: 'Default Chat Widget',
      domain: '*', // Allow all domains for demo
      isActive: true,
      settings: this.getDefaultSettings(),
      analytics: {
        totalSessions: 0,
        totalMessages: 0,
        averageSessionDuration: 0,
        satisfactionRating: 0,
        conversionRate: 0,
        lastUpdated: new Date(),
      },
      createdAt: new Date(),
      updatedAt: new Date(),
      apiKey: 'demo-api-key-mtom-ai-widget', // Fixed API key for demo
    };

    this.widgets.set(defaultWidget.id, defaultWidget);
    console.log(`📱 Default widget created: ${defaultWidget.id}`);
    console.log(`🔑 Demo API Key: ${defaultWidget.apiKey}`);
  }

  private getDefaultSettings(): WidgetSettings {
    return {
      // Appearance
      theme: 'light',
      primaryColor: '#3B82F6',
      secondaryColor: '#F3F4F6',
      textColor: '#1F2937',
      backgroundColor: '#FFFFFF',
      borderRadius: 12,

      // Position and size
      position: 'bottom-right',
      marginX: 20,
      marginY: 20,
      width: 380,
      height: 600,

      // Behavior
      autoOpen: false,
      autoOpenDelay: 3000,
      showWelcomeMessage: true,
      welcomeMessage: 'Hi! How can we help you today?',
      offlineMessage:
        "We're currently offline. Please leave a message and we'll get back to you soon!",
      placeholderText: 'Type your message...',

      // Branding
      companyName: 'MTOM AI',
      showBranding: true,

      // Features
      allowFileUpload: true,
      showTypingIndicator: true,
      enableEmojis: true,
      enableSoundNotifications: true,

      // Availability
      workingHours: {
        enabled: false,
        timezone: 'UTC',
        schedule: {
          monday: { enabled: true, start: '09:00', end: '17:00' },
          tuesday: { enabled: true, start: '09:00', end: '17:00' },
          wednesday: { enabled: true, start: '09:00', end: '17:00' },
          thursday: { enabled: true, start: '09:00', end: '17:00' },
          friday: { enabled: true, start: '09:00', end: '17:00' },
          saturday: { enabled: false, start: '09:00', end: '17:00' },
          sunday: { enabled: false, start: '09:00', end: '17:00' },
        },
      },
    };
  }

  async createWidget(data: CreateWidgetRequest): Promise<Widget> {
    const widget: Widget = {
      id: uuidv4(),
      name: data.name,
      domain: data.domain,
      isActive: true,
      settings: { ...this.getDefaultSettings(), ...data.settings },
      analytics: {
        totalSessions: 0,
        totalMessages: 0,
        averageSessionDuration: 0,
        satisfactionRating: 0,
        conversionRate: 0,
        lastUpdated: new Date(),
      },
      createdAt: new Date(),
      updatedAt: new Date(),
      apiKey: crypto.randomBytes(32).toString('hex'),
    };

    this.widgets.set(widget.id, widget);
    return widget;
  }

  async getWidget(id: string): Promise<Widget | null> {
    return this.widgets.get(id) || null;
  }

  async getWidgetByApiKey(apiKey: string): Promise<Widget | null> {
    for (const widget of this.widgets.values()) {
      if (widget.apiKey === apiKey) {
        return widget;
      }
    }
    return null;
  }

  async updateWidget(id: string, updates: UpdateWidgetRequest): Promise<Widget | null> {
    const widget = this.widgets.get(id);
    if (!widget) return null;

    const updatedWidget = {
      ...widget,
      ...updates,
      settings: updates.settings ? { ...widget.settings, ...updates.settings } : widget.settings,
      updatedAt: new Date(),
    };

    this.widgets.set(id, updatedWidget);
    return updatedWidget;
  }

  async updateWidgetAnalytics(id: string, analytics: WidgetAnalytics): Promise<boolean> {
    const widget = this.widgets.get(id);
    if (!widget) return false;

    widget.analytics = analytics;
    widget.updatedAt = new Date();
    this.widgets.set(id, widget);
    return true;
  }

  async getWidgetSession(sessionId: string): Promise<WidgetSession | null> {
    return this.widgetSessions.get(sessionId) || null;
  }

  async deleteWidget(id: string): Promise<boolean> {
    return this.widgets.delete(id);
  }

  async getAllWidgets(): Promise<Widget[]> {
    return Array.from(this.widgets.values());
  }

  async getWidgetsByDomain(domain: string): Promise<Widget[]> {
    return Array.from(this.widgets.values()).filter(widget => widget.domain === domain);
  }

  // Session tracking
  async createWidgetSession(session: Omit<WidgetSession, 'id'>): Promise<WidgetSession> {
    const widgetSession: WidgetSession = {
      id: uuidv4(),
      ...session,
    };

    this.widgetSessions.set(widgetSession.id, widgetSession);
    return widgetSession;
  }

  async updateWidgetSession(id: string, updates: Partial<WidgetSession>): Promise<boolean> {
    const session = this.widgetSessions.get(id);
    if (!session) return false;

    const updatedSession = { ...session, ...updates };
    this.widgetSessions.set(id, updatedSession);
    return true;
  }

  async getWidgetSessions(widgetId: string, limit = 100): Promise<WidgetSession[]> {
    return Array.from(this.widgetSessions.values())
      .filter(session => session.widgetId === widgetId)
      .sort((a, b) => b.startTime.getTime() - a.startTime.getTime())
      .slice(0, limit);
  }

  // Visitor tracking
  async createVisitor(visitor: Omit<Visitor, 'id'>): Promise<Visitor> {
    const newVisitor: Visitor = {
      id: uuidv4(),
      ...visitor,
    };

    this.visitors.set(newVisitor.id, newVisitor);
    return newVisitor;
  }

  async getVisitorByFingerprint(fingerprint: string): Promise<Visitor | null> {
    for (const visitor of this.visitors.values()) {
      if (visitor.fingerprint === fingerprint) {
        return visitor;
      }
    }
    return null;
  }

  async updateVisitor(id: string, updates: Partial<Visitor>): Promise<boolean> {
    const visitor = this.visitors.get(id);
    if (!visitor) return false;

    const updatedVisitor = { ...visitor, ...updates };
    this.visitors.set(id, updatedVisitor);
    return true;
  }

  // Event tracking
  async trackEvent(event: Omit<VisitorEvent, 'id'>): Promise<VisitorEvent> {
    const newEvent: VisitorEvent = {
      id: uuidv4(),
      ...event,
    };

    const events = this.visitorEvents.get(event.visitorId) || [];
    events.push(newEvent);
    this.visitorEvents.set(event.visitorId, events);

    return newEvent;
  }

  async getVisitorEvents(visitorId: string): Promise<VisitorEvent[]> {
    return this.visitorEvents.get(visitorId) || [];
  }
}

export class WidgetService {
  private store: InMemoryWidgetStore;

  constructor() {
    this.store = new InMemoryWidgetStore();
  }

  /**
   * Create a new widget
   */
  async createWidget(data: CreateWidgetRequest): Promise<Widget> {
    return this.store.createWidget(data);
  }

  /**
   * Get widget by ID
   */
  async getWidget(id: string): Promise<Widget | null> {
    return this.store.getWidget(id);
  }

  /**
   * Get widget by API key
   */
  async getWidgetByApiKey(apiKey: string): Promise<Widget | null> {
    return this.store.getWidgetByApiKey(apiKey);
  }

  /**
   * Update widget configuration
   */
  async updateWidget(id: string, updates: UpdateWidgetRequest): Promise<Widget | null> {
    return this.store.updateWidget(id, updates);
  }

  /**
   * Delete widget
   */
  async deleteWidget(id: string): Promise<boolean> {
    return this.store.deleteWidget(id);
  }

  /**
   * Get all widgets
   */
  async getAllWidgets(): Promise<Widget[]> {
    return this.store.getAllWidgets();
  }

  /**
   * Generate embed code for widget
   */
  async generateEmbedCode(widgetId: string, baseUrl: string): Promise<WidgetEmbedResponse> {
    const widget = await this.store.getWidget(widgetId);
    if (!widget) {
      throw new Error('Widget not found');
    }

    const embedUrl = `${baseUrl}/widget/${widgetId}`;
    const configUrl = `${baseUrl}/api/widget/${widgetId}/config`;

    const embedCode = `
<!-- MTOM AI Chat Widget -->
<script>
(function() {
  var script = document.createElement('script');
  script.src = '${baseUrl}/widget/embed.js';
  script.setAttribute('data-widget-id', '${widgetId}');
  script.setAttribute('data-api-key', '${widget.apiKey}');
  script.async = true;
  document.head.appendChild(script);
})();
</script>
<!-- End MTOM AI Chat Widget -->`.trim();

    return {
      widgetId,
      embedCode,
      embedUrl,
      configUrl,
    };
  }

  /**
   * Validate widget domain
   */
  async validateDomain(widgetId: string, domain: string): Promise<boolean> {
    const widget = await this.store.getWidget(widgetId);
    if (!widget) return false;

    // Allow exact match or wildcard
    if (widget.domain === '*' || widget.domain === domain) {
      return true;
    }

    // Allow subdomain matching
    if (widget.domain.startsWith('*.')) {
      const baseDomain = widget.domain.slice(2);
      return domain.endsWith(baseDomain);
    }

    return false;
  }

  /**
   * Track widget session
   */
  async trackSession(sessionData: {
    widgetId: string;
    sessionId: string;
    visitorId?: string;
    pageUrl: string;
    referrer?: string;
    userAgent?: string;
    ipAddress?: string;
  }): Promise<WidgetSession> {
    const session = await this.store.createWidgetSession({
      ...sessionData,
      startTime: new Date(),
      messageCount: 0,
      wasHandedOff: false,
    });

    // Update widget analytics
    const widget = await this.store.getWidget(sessionData.widgetId);
    if (widget) {
      widget.analytics.totalSessions++;
      widget.analytics.lastUpdated = new Date();
      await this.store.updateWidgetAnalytics(sessionData.widgetId, widget.analytics);
    }

    return session;
  }

  /**
   * End widget session
   */
  async endSession(sessionId: string, messageCount: number): Promise<void> {
    const session = await this.store.getWidgetSession(sessionId);
    if (!session) return;

    const endTime = new Date();
    const duration = Math.floor((endTime.getTime() - session.startTime.getTime()) / 1000);

    await this.store.updateWidgetSession(sessionId, {
      endTime,
      duration,
      messageCount,
    });

    // Update widget analytics
    const widget = await this.store.getWidget(session.widgetId);
    if (widget) {
      widget.analytics.totalMessages += messageCount;

      // Recalculate average session duration
      const sessions = await this.store.getWidgetSessions(session.widgetId);
      const completedSessions = sessions.filter(s => s.duration !== undefined);
      if (completedSessions.length > 0) {
        const totalDuration = completedSessions.reduce((sum, s) => sum + (s.duration || 0), 0);
        widget.analytics.averageSessionDuration = Math.floor(
          totalDuration / completedSessions.length,
        );
      }

      widget.analytics.lastUpdated = new Date();
      await this.store.updateWidgetAnalytics(session.widgetId, widget.analytics);
    }
  }

  /**
   * Track visitor
   */
  async trackVisitor(
    fingerprint: string,
    data: {
      preferredLanguage?: string;
      timezone?: string;
      country?: string;
      city?: string;
      deviceType: 'desktop' | 'mobile' | 'tablet';
      browser: string;
      os: string;
      referralSource?: string;
    },
  ): Promise<Visitor> {
    let visitor = await this.store.getVisitorByFingerprint(fingerprint);

    if (!visitor) {
      visitor = await this.store.createVisitor({
        fingerprint,
        firstSeen: new Date(),
        lastSeen: new Date(),
        sessionCount: 1,
        totalMessages: 0,
        averageSessionDuration: 0,
        referralSources: data.referralSource ? [data.referralSource] : [],
        tags: [],
        ...data,
      });
    } else {
      // Update existing visitor
      const updates: Partial<Visitor> = {
        lastSeen: new Date(),
        sessionCount: visitor.sessionCount + 1,
      };

      if (data.referralSource && !visitor.referralSources.includes(data.referralSource)) {
        updates.referralSources = [...visitor.referralSources, data.referralSource];
      }

      await this.store.updateVisitor(visitor.id, updates);
      visitor = { ...visitor, ...updates };
    }

    return visitor;
  }

  /**
   * Track visitor event
   */
  async trackEvent(event: {
    visitorId: string;
    widgetId: string;
    type: 'page_view' | 'widget_open' | 'widget_close' | 'message_sent' | 'satisfaction_rating';
    data: Record<string, any>;
    pageUrl: string;
    sessionId?: string;
  }): Promise<VisitorEvent> {
    return this.store.trackEvent({
      ...event,
      timestamp: new Date(),
    });
  }

  /**
   * Get widget analytics
   */
  async getWidgetAnalytics(
    widgetId: string,
    days = 30,
  ): Promise<{
    analytics: WidgetAnalytics;
    sessions: WidgetSession[];
    recentEvents: VisitorEvent[];
  }> {
    const widget = await this.store.getWidget(widgetId);
    if (!widget) {
      throw new Error('Widget not found');
    }

    const sessions = await this.store.getWidgetSessions(widgetId, 1000);

    // Filter sessions from last N days
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    const recentSessions = sessions.filter(s => s.startTime >= cutoffDate);

    // Get recent events
    const recentEvents: VisitorEvent[] = [];
    for (const session of recentSessions.slice(0, 10)) {
      if (session.visitorId) {
        const events = await this.store.getVisitorEvents(session.visitorId);
        recentEvents.push(...events.filter(e => e.timestamp >= cutoffDate));
      }
    }

    return {
      analytics: widget.analytics,
      sessions: recentSessions,
      recentEvents: recentEvents
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
        .slice(0, 50),
    };
  }

  /**
   * Check if widget is within working hours
   */
  async isWithinWorkingHours(widgetId: string): Promise<boolean> {
    const widget = await this.store.getWidget(widgetId);
    if (!widget || !widget.settings.workingHours.enabled) {
      return true; // Always available if working hours not configured
    }

    const now = new Date();
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayOfWeek = dayNames[now.getDay()];
    const schedule = widget.settings.workingHours.schedule[dayOfWeek];

    if (!schedule || !schedule.enabled) {
      return false;
    }

    const currentTime = now.toTimeString().slice(0, 5); // HH:mm format
    return currentTime >= schedule.start && currentTime <= schedule.end;
  }

  /**
   * Get default widget (for demo purposes)
   */
  async getDefaultWidget(): Promise<Widget | null> {
    const widgets = await this.store.getAllWidgets();
    return widgets.find(w => w.name === 'Default Chat Widget') || widgets[0] || null;
  }
}
