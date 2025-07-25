import { Router } from 'express';
import { z } from 'zod';
import { FeedbackService } from '../services/feedbackService.js';
import { validateRequest } from '../middleware/validation.js';

const rateMessageSchema = z.object({
  messageId: z.string().uuid(),
  sessionId: z.string().uuid(),
  rating: z.enum(['positive', 'negative']),
  feedback: z.string().optional(),
  category: z.enum(['accuracy', 'helpfulness', 'response_time', 'other']).optional(),
});

const submitFeedbackSchema = z.object({
  sessionId: z.string().uuid(),
  overallRating: z.number().min(1).max(5),
  feedback: z.string().min(1),
  categories: z.object({
    responsiveness: z.number().min(1).max(5),
    helpfulness: z.number().min(1).max(5),
    accuracy: z.number().min(1).max(5),
    overall: z.number().min(1).max(5),
  }),
  improvements: z.array(z.string()).optional(),
});

export function createFeedbackRoutes(feedbackService: FeedbackService): Router {
  const router = Router();

  // Rate a specific message
  router.post('/message/rate', validateRequest(rateMessageSchema), async (req, res) => {
    try {
      const rating = await feedbackService.rateMessage(req.body);
      res.json({
        success: true,
        data: rating,
        message: 'Message rated successfully',
      });
    } catch (error) {
      console.error('Rate message error:', error);
      if (error instanceof Error && error.message === 'Message already rated') {
        return res.status(409).json({
          success: false,
          error: 'Message has already been rated',
        });
      }
      res.status(500).json({
        success: false,
        error: 'Failed to rate message',
      });
    }
  });

  // Submit session feedback
  router.post('/session/feedback', validateRequest(submitFeedbackSchema), async (req, res) => {
    try {
      const feedback = await feedbackService.submitSessionFeedback(req.body);
      res.json({
        success: true,
        data: feedback,
        message: 'Feedback submitted successfully',
      });
    } catch (error) {
      console.error('Submit feedback error:', error);
      if (error instanceof Error && error.message === 'Session feedback already submitted') {
        return res.status(409).json({
          success: false,
          error: 'Feedback has already been submitted for this session',
        });
      }
      res.status(500).json({
        success: false,
        error: 'Failed to submit feedback',
      });
    }
  });

  // Get message rating
  router.get('/message/:messageId/rating', async (req, res) => {
    try {
      const { messageId } = req.params;
      const rating = await feedbackService.getMessageRating(messageId);
      res.json({
        success: true,
        data: rating,
      });
    } catch (error) {
      console.error('Get message rating error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get message rating',
      });
    }
  });

  // Get session message ratings
  router.get('/session/:sessionId/ratings', async (req, res) => {
    try {
      const { sessionId } = req.params;
      const ratings = await feedbackService.getSessionMessageRatings(sessionId);
      res.json({
        success: true,
        data: ratings,
      });
    } catch (error) {
      console.error('Get session ratings error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get session ratings',
      });
    }
  });

  // Get session feedback
  router.get('/session/:sessionId/feedback', async (req, res) => {
    try {
      const { sessionId } = req.params;
      const feedback = await feedbackService.getSessionFeedback(sessionId);
      res.json({
        success: true,
        data: feedback,
      });
    } catch (error) {
      console.error('Get session feedback error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get session feedback',
      });
    }
  });

  // Get learning metrics and analytics
  router.get('/analytics/metrics', async (req, res) => {
    try {
      const metrics = await feedbackService.getLearningMetrics();
      res.json({
        success: true,
        data: metrics,
      });
    } catch (error) {
      console.error('Get learning metrics error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get learning metrics',
      });
    }
  });

  // Get feedback statistics
  router.get('/analytics/stats', async (req, res) => {
    try {
      const stats = await feedbackService.getFeedbackStats();
      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      console.error('Get feedback stats error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get feedback statistics',
      });
    }
  });

  return router;
}
