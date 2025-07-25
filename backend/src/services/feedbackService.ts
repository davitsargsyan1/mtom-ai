import { v4 as uuidv4 } from 'uuid';
import {
  MessageRating,
  SessionFeedback,
  LearningMetrics,
  RateMessageRequest,
  SubmitFeedbackRequest,
} from '../types/index.js';

interface FeedbackStore {
  messageRatings: Map<string, MessageRating>;
  sessionFeedbacks: Map<string, SessionFeedback>;
}

class InMemoryFeedbackStore implements FeedbackStore {
  public messageRatings = new Map<string, MessageRating>();
  public sessionFeedbacks = new Map<string, SessionFeedback>();

  // Message Rating Methods
  async addMessageRating(rating: MessageRating): Promise<void> {
    this.messageRatings.set(rating.id, rating);
  }

  async getMessageRating(messageId: string): Promise<MessageRating | null> {
    for (const rating of this.messageRatings.values()) {
      if (rating.messageId === messageId) {
        return rating;
      }
    }
    return null;
  }

  async getSessionMessageRatings(sessionId: string): Promise<MessageRating[]> {
    return Array.from(this.messageRatings.values()).filter(
      rating => rating.sessionId === sessionId,
    );
  }

  async getAllMessageRatings(): Promise<MessageRating[]> {
    return Array.from(this.messageRatings.values());
  }

  // Session Feedback Methods
  async addSessionFeedback(feedback: SessionFeedback): Promise<void> {
    this.sessionFeedbacks.set(feedback.id, feedback);
  }

  async getSessionFeedback(sessionId: string): Promise<SessionFeedback | null> {
    for (const feedback of this.sessionFeedbacks.values()) {
      if (feedback.sessionId === sessionId) {
        return feedback;
      }
    }
    return null;
  }

  async getAllSessionFeedbacks(): Promise<SessionFeedback[]> {
    return Array.from(this.sessionFeedbacks.values());
  }

  // Analytics Methods
  async getFeedbackStats(): Promise<{
    totalMessageRatings: number;
    totalSessionFeedbacks: number;
    positiveRatings: number;
    negativeRatings: number;
  }> {
    const messageRatings = Array.from(this.messageRatings.values());
    const positiveRatings = messageRatings.filter(r => r.rating === 'positive').length;
    const negativeRatings = messageRatings.filter(r => r.rating === 'negative').length;

    return {
      totalMessageRatings: messageRatings.length,
      totalSessionFeedbacks: this.sessionFeedbacks.size,
      positiveRatings,
      negativeRatings,
    };
  }
}

export class FeedbackService {
  private store: InMemoryFeedbackStore;

  constructor() {
    this.store = new InMemoryFeedbackStore();
    console.log('📊 Feedback service initialized');
  }

  /**
   * Rate a specific message
   */
  async rateMessage(request: RateMessageRequest): Promise<MessageRating> {
    // Check if message is already rated
    const existingRating = await this.store.getMessageRating(request.messageId);
    if (existingRating) {
      throw new Error('Message already rated');
    }

    const rating: MessageRating = {
      id: uuidv4(),
      messageId: request.messageId,
      sessionId: request.sessionId,
      rating: request.rating,
      feedback: request.feedback,
      category: request.category,
      timestamp: new Date(),
    };

    await this.store.addMessageRating(rating);
    console.log(`👍 Message rated: ${request.rating} for message ${request.messageId}`);

    return rating;
  }

  /**
   * Submit session feedback
   */
  async submitSessionFeedback(request: SubmitFeedbackRequest): Promise<SessionFeedback> {
    // Check if session already has feedback
    const existingFeedback = await this.store.getSessionFeedback(request.sessionId);
    if (existingFeedback) {
      throw new Error('Session feedback already submitted');
    }

    const feedback: SessionFeedback = {
      id: uuidv4(),
      sessionId: request.sessionId,
      overallRating: request.overallRating,
      feedback: request.feedback,
      categories: request.categories,
      improvements: request.improvements,
      timestamp: new Date(),
    };

    await this.store.addSessionFeedback(feedback);
    console.log(
      `⭐ Session feedback submitted: ${request.overallRating}/5 for session ${request.sessionId}`,
    );

    return feedback;
  }

  /**
   * Get message rating for a specific message
   */
  async getMessageRating(messageId: string): Promise<MessageRating | null> {
    return await this.store.getMessageRating(messageId);
  }

  /**
   * Get all message ratings for a session
   */
  async getSessionMessageRatings(sessionId: string): Promise<MessageRating[]> {
    return await this.store.getSessionMessageRatings(sessionId);
  }

  /**
   * Get session feedback
   */
  async getSessionFeedback(sessionId: string): Promise<SessionFeedback | null> {
    return await this.store.getSessionFeedback(sessionId);
  }

  /**
   * Generate learning metrics and analytics
   */
  async getLearningMetrics(): Promise<LearningMetrics> {
    const messageRatings = await this.store.getAllMessageRatings();
    const sessionFeedbacks = await this.store.getAllSessionFeedbacks();

    const positiveRatings = messageRatings.filter(r => r.rating === 'positive').length;
    const negativeRatings = messageRatings.filter(r => r.rating === 'negative').length;
    const totalRatings = messageRatings.length;

    // Calculate average session rating
    const sessionRatings = sessionFeedbacks.map(f => f.overallRating);
    const averageSessionRating =
      sessionRatings.length > 0
        ? sessionRatings.reduce((sum, rating) => sum + rating, 0) / sessionRatings.length
        : 0;

    // Analyze common issues from negative feedback
    const commonIssues = this.analyzeCommonIssues(messageRatings, sessionFeedbacks);

    // Extract improvement areas
    const improvementAreas = this.extractImprovementAreas(sessionFeedbacks);

    // Calculate response accuracy (positive ratings / total ratings)
    const responseAccuracy = totalRatings > 0 ? (positiveRatings / totalRatings) * 100 : 0;

    // Calculate user satisfaction (average session rating as percentage)
    const userSatisfaction = (averageSessionRating / 5) * 100;

    return {
      totalRatings,
      positiveRatings,
      negativeRatings,
      averageSessionRating,
      commonIssues,
      improvementAreas,
      responseAccuracy,
      userSatisfaction,
    };
  }

  /**
   * Get feedback statistics
   */
  async getFeedbackStats() {
    return await this.store.getFeedbackStats();
  }

  /**
   * Analyze common issues from feedback
   */
  private analyzeCommonIssues(
    messageRatings: MessageRating[],
    sessionFeedbacks: SessionFeedback[],
  ): { category: string; count: number }[] {
    const issueMap = new Map<string, number>();

    // Count message rating categories for negative feedback
    messageRatings
      .filter(r => r.rating === 'negative' && r.category)
      .forEach(r => {
        const category = r.category!;
        issueMap.set(category, (issueMap.get(category) || 0) + 1);
      });

    // Analyze low session ratings (3 or below)
    sessionFeedbacks
      .filter(f => f.overallRating <= 3)
      .forEach(f => {
        // Find lowest scoring category
        const categories = f.categories;
        const lowestCategory = Object.entries(categories)
          .filter(([key]) => key !== 'overall')
          .reduce((lowest, [key, value]) => (value < lowest[1] ? [key, value] : lowest));

        if (lowestCategory[1] <= 3) {
          issueMap.set(lowestCategory[0], (issueMap.get(lowestCategory[0]) || 0) + 1);
        }
      });

    return Array.from(issueMap.entries())
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5); // Top 5 issues
  }

  /**
   * Extract improvement areas from session feedback
   */
  private extractImprovementAreas(sessionFeedbacks: SessionFeedback[]): string[] {
    const improvementSet = new Set<string>();

    sessionFeedbacks.forEach(feedback => {
      if (feedback.improvements) {
        feedback.improvements.forEach(improvement => {
          improvementSet.add(improvement);
        });
      }

      // Extract keywords from negative feedback
      if (feedback.overallRating <= 3 && feedback.feedback) {
        const keywords = this.extractKeywords(feedback.feedback);
        keywords.forEach(keyword => improvementSet.add(keyword));
      }
    });

    return Array.from(improvementSet).slice(0, 10); // Top 10 improvement areas
  }

  /**
   * Simple keyword extraction from feedback text
   */
  private extractKeywords(text: string): string[] {
    const keywords = [
      'slow',
      'fast',
      'quick',
      'response',
      'answer',
      'help',
      'support',
      'accurate',
      'wrong',
      'incorrect',
      'helpful',
      'useless',
      'friendly',
      'rude',
      'polite',
      'confusing',
      'clear',
      'understand',
      'knowledge',
    ];

    const words = text.toLowerCase().split(/\s+/);
    return keywords.filter(keyword =>
      words.some(word => word.includes(keyword) || keyword.includes(word)),
    );
  }
}
