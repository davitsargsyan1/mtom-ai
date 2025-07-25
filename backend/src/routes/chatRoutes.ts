import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { AIService } from '../services/aiService.js';
import { SessionService } from '../services/sessionService.js';
import { KnowledgeBaseService } from '../services/knowledgeBaseService.js';
import { EmailService } from '../services/emailService.js';
import { SendMessageRequest, SendMessageResponse } from '../types/index.js';

const router = Router();

// Request validation schemas
const sendMessageSchema = z.object({
  sessionId: z.string().optional(),
  message: z.string().min(1, 'Message cannot be empty'),
  customerInfo: z
    .object({
      email: z.string().email().optional(),
      name: z.string().optional(),
      userId: z.string().optional(),
      company: z.string().optional(),
      context: z.record(z.any()).optional(),
    })
    .optional(),
});

const sessionIdSchema = z.object({
  sessionId: z.string().uuid(),
});

// Initialize services
const aiService = new AIService();
const sessionService = new SessionService();
const knowledgeBaseService = new KnowledgeBaseService();
const emailService = new EmailService();

/**
 * POST /api/chat/send
 * Send a message and get AI response
 */
router.post('/send', async (req: Request, res: Response) => {
  try {
    const { sessionId, message, customerInfo } = sendMessageSchema.parse(req.body);

    // Get or create session
    const session = await sessionService.getOrCreateSession(sessionId, customerInfo);

    // Add user message to session
    await sessionService.addMessage(session.id, message, 'user');

    // Get relevant knowledge base context
    const conversationHistory = await sessionService.getConversationHistory(session.id, 5);
    const knowledgeContext = await knowledgeBaseService.getRelevantContext(
      message,
      conversationHistory,
    );

    // Generate AI response
    const aiResponse = await aiService.generateResponse(
      session.messages,
      customerInfo,
      knowledgeContext,
    );

    // Add AI response to session
    const responseMessage = await sessionService.addMessage(
      session.id,
      aiResponse.content,
      'assistant',
      {
        confidence: aiResponse.confidence,
        tokensUsed: aiResponse.metadata?.tokensUsed,
        responseTime: aiResponse.metadata?.responseTime,
      },
    );

    const response: SendMessageResponse = {
      sessionId: session.id,
      response: aiResponse.content,
      messageId: responseMessage.id,
      timestamp: responseMessage.timestamp,
      metadata: {
        confidence: aiResponse.confidence,
        sources: knowledgeContext.length > 0 ? ['knowledge_base'] : undefined,
      },
    };

    res.json(response);
  } catch (error) {
    console.error('Error in /send:', error);

    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: 'Invalid request data',
        details: error.errors,
      });
    } else {
      res.status(500).json({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
});

/**
 * GET /api/chat/session/:sessionId
 * Get session details and message history
 */
router.get('/session/:sessionId', async (req: Request, res: Response) => {
  try {
    const { sessionId } = sessionIdSchema.parse(req.params);

    const session = await sessionService.getSession(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    res.json(session);
  } catch (error) {
    console.error('Error in /session/:sessionId:', error);

    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: 'Invalid session ID',
        details: error.errors,
      });
    } else {
      res.status(500).json({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
});

/**
 * PUT /api/chat/session/:sessionId/status
 * Update session status
 */
router.put('/session/:sessionId/status', async (req: Request, res: Response) => {
  try {
    const { sessionId } = sessionIdSchema.parse(req.params);
    const { status } = z
      .object({
        status: z.enum(['active', 'resolved', 'escalated']),
      })
      .parse(req.body);

    await sessionService.updateSessionStatus(sessionId, status);

    res.json({ success: true, message: 'Status updated successfully' });
  } catch (error) {
    console.error('Error in /session/:sessionId/status:', error);

    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: 'Invalid request data',
        details: error.errors,
      });
    } else {
      res.status(500).json({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
});

/**
 * GET /api/chat/session/:sessionId/transcript
 * Export session transcript
 */
router.get('/session/:sessionId/transcript', async (req: Request, res: Response) => {
  try {
    const { sessionId } = sessionIdSchema.parse(req.params);

    const transcript = await sessionService.exportSessionTranscript(sessionId);

    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Content-Disposition', `attachment; filename="chat-transcript-${sessionId}.txt"`);
    res.send(transcript);
  } catch (error) {
    console.error('Error in /session/:sessionId/transcript:', error);

    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: 'Invalid session ID',
        details: error.errors,
      });
    } else {
      res.status(500).json({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
});

/**
 * POST /api/chat/session/:sessionId/email
 * Send session transcript via email
 */
router.post('/session/:sessionId/email', async (req: Request, res: Response) => {
  try {
    const { sessionId } = sessionIdSchema.parse(req.params);
    const { recipientEmail, recipientName } = z
      .object({
        recipientEmail: z.string().email(),
        recipientName: z.string().optional(),
      })
      .parse(req.body);

    // Get session and generate transcript
    const session = await sessionService.getSession(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const transcript = emailService.generateTranscript(session);

    // Calculate session duration
    const duration =
      session.messages.length > 0
        ? Math.floor((new Date().getTime() - new Date(session.createdAt).getTime()) / 1000 / 60) +
          ' minutes'
        : 'Less than 1 minute';

    // Send email
    const success = await emailService.sendTranscript({
      customerEmail: recipientEmail,
      customerName: recipientName || session.customerInfo?.name,
      sessionId: session.id,
      transcript,
      duration,
    });

    if (success) {
      res.json({ success: true, message: 'Transcript sent successfully' });
    } else {
      res.status(500).json({ error: 'Failed to send email transcript' });
    }
  } catch (error) {
    console.error('Error in /session/:sessionId/email:', error);

    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: 'Invalid request data',
        details: error.errors,
      });
    } else {
      res.status(500).json({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
});

/**
 * GET /api/chat/stats
 * Get chat statistics
 */
router.get('/stats', async (_req: Request, res: Response) => {
  try {
    const stats = await sessionService.getSessionStats();
    res.json(stats);
  } catch (error) {
    console.error('Error in /stats:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
