import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { WidgetService } from '../services/widgetService.js';
import { SessionService } from '../services/sessionService.js';
import { config } from '../config/index.js';

// Extend Request interface
declare global {
  namespace Express {
    interface Request {
      widget?: import('../types/index.js').Widget;
    }
  }
}

// Create router factory function that accepts shared services
export default function createWidgetRoutes(sessionService: SessionService): Router {
  const router = Router();

  // Initialize services
  const widgetService = new WidgetService();

  // Request validation schemas
  const createWidgetSchema = z.object({
    name: z.string().min(1, 'Widget name is required'),
    domain: z.string().min(1, 'Domain is required'),
    settings: z
      .object({
        theme: z.enum(['light', 'dark', 'auto']).optional(),
        primaryColor: z.string().optional(),
        companyName: z.string().optional(),
        welcomeMessage: z.string().optional(),
        position: z.enum(['bottom-right', 'bottom-left', 'top-right', 'top-left']).optional(),
      })
      .optional(),
  });

  const updateWidgetSchema = z.object({
    name: z.string().min(1).optional(),
    domain: z.string().min(1).optional(),
    isActive: z.boolean().optional(),
    settings: z
      .object({
        theme: z.enum(['light', 'dark', 'auto']).optional(),
        primaryColor: z.string().optional(),
        secondaryColor: z.string().optional(),
        textColor: z.string().optional(),
        backgroundColor: z.string().optional(),
        borderRadius: z.number().min(0).max(50).optional(),
        position: z.enum(['bottom-right', 'bottom-left', 'top-right', 'top-left']).optional(),
        marginX: z.number().min(0).optional(),
        marginY: z.number().min(0).optional(),
        width: z.number().min(200).max(600).optional(),
        height: z.number().min(300).max(800).optional(),
        autoOpen: z.boolean().optional(),
        autoOpenDelay: z.number().min(0).optional(),
        showWelcomeMessage: z.boolean().optional(),
        welcomeMessage: z.string().optional(),
        offlineMessage: z.string().optional(),
        placeholderText: z.string().optional(),
        companyName: z.string().optional(),
        companyLogo: z.string().optional(),
        showBranding: z.boolean().optional(),
        allowFileUpload: z.boolean().optional(),
        showTypingIndicator: z.boolean().optional(),
        enableEmojis: z.boolean().optional(),
        enableSoundNotifications: z.boolean().optional(),
      })
      .optional(),
  });

  const trackEventSchema = z.object({
    type: z.enum([
      'page_view',
      'widget_open',
      'widget_close',
      'message_sent',
      'satisfaction_rating',
    ]),
    data: z.record(z.any()).optional().default({}),
    pageUrl: z.string().url(),
    sessionId: z.string().optional(),
  });

  // Middleware to validate widget API key
  const validateApiKey = async (req: Request, res: Response, next: Function) => {
    try {
      const apiKey = req.headers['x-api-key'] as string;
      if (!apiKey) {
        return res.status(401).json({ error: 'API key required' });
      }

      const widget = await widgetService.getWidgetByApiKey(apiKey);
      if (!widget) {
        return res.status(401).json({ error: 'Invalid API key' });
      }

      if (!widget.isActive) {
        return res.status(403).json({ error: 'Widget is disabled' });
      }

      req.widget = widget;
      next();
    } catch (error) {
      res.status(401).json({ error: 'Authentication failed' });
    }
  };

  // Middleware to validate domain
  const validateDomain = async (req: Request, res: Response, next: Function) => {
    try {
      const origin = req.headers.origin || req.headers.referer;
      console.log('🔍 Widget domain validation:', {
        origin: req.headers.origin,
        referer: req.headers.referer,
        finalOrigin: origin,
        userAgent: req.headers['user-agent'],
        host: req.headers.host,
      });

      // If no origin/referer, check if it's a same-origin request
      if (!origin) {
        const host = req.headers.host;
        if (host) {
          // For same-origin requests, use the host header as the domain
          const protocol =
            req.secure || req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
          const constructedOrigin = `${protocol}://${host}`;
          console.log('🏠 Same-origin request detected, using host:', constructedOrigin);

          const domain = host.split(':')[0]; // Remove port if present
          const isValid = await widgetService.validateDomain(req.widget!.id, domain);
          console.log('✅ Same-origin domain validation result:', {
            domain,
            widgetId: req.widget!.id,
            isValid,
          });

          if (!isValid) {
            return res.status(403).json({ error: 'Domain not allowed' });
          }

          return next();
        }

        console.log('❌ No origin header found and no host header');
        return res.status(403).json({ error: 'Origin required' });
      }

      let domain;
      try {
        domain = new URL(origin).hostname;
        console.log('🌐 Extracted domain:', domain);
      } catch (urlError) {
        console.log('❌ Invalid origin URL:', origin, urlError);
        return res.status(403).json({ error: 'Invalid origin format' });
      }

      const isValid = await widgetService.validateDomain(req.widget!.id, domain);
      console.log('✅ Domain validation result:', { domain, widgetId: req.widget!.id, isValid });

      if (!isValid) {
        return res.status(403).json({ error: 'Domain not allowed' });
      }

      next();
    } catch (error) {
      console.error('❌ Domain validation error:', error);
      res.status(403).json({ error: 'Invalid domain' });
    }
  };

  /**
   * POST /api/widget
   * Create a new widget
   */
  router.post('/', async (req: Request, res: Response) => {
    try {
      const widgetData = createWidgetSchema.parse(req.body);
      const widget = await widgetService.createWidget(widgetData);

      res.status(201).json({
        success: true,
        widget: {
          ...widget,
          apiKey: undefined, // Don't expose API key in response
        },
        message: 'Widget created successfully',
      });
    } catch (error) {
      console.error('Create widget error:', error);

      if (error instanceof z.ZodError) {
        res.status(400).json({
          error: 'Invalid widget data',
          details: error.errors,
        });
      } else {
        res.status(500).json({ error: 'Failed to create widget' });
      }
    }
  });

  /**
   * GET /api/widget
   * Get all widgets
   */
  router.get('/', async (req: Request, res: Response) => {
    try {
      const widgets = await widgetService.getAllWidgets();

      // Remove API keys from response
      const safeWidgets = widgets.map(widget => ({
        ...widget,
        apiKey: undefined,
      }));

      res.json({ widgets: safeWidgets });
    } catch (error) {
      console.error('Get widgets error:', error);
      res.status(500).json({ error: 'Failed to get widgets' });
    }
  });

  /**
   * GET /api/widget/:id
   * Get widget by ID
   */
  router.get('/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const widget = await widgetService.getWidget(id);

      if (!widget) {
        return res.status(404).json({ error: 'Widget not found' });
      }

      res.json({
        widget: {
          ...widget,
          apiKey: undefined, // Don't expose API key
        },
      });
    } catch (error) {
      console.error('Get widget error:', error);
      res.status(500).json({ error: 'Failed to get widget' });
    }
  });

  /**
   * PUT /api/widget/:id
   * Update widget configuration
   */
  router.put('/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const updates = updateWidgetSchema.parse(req.body);

      const widget = await widgetService.updateWidget(id, updates);

      if (!widget) {
        return res.status(404).json({ error: 'Widget not found' });
      }

      res.json({
        success: true,
        widget: {
          ...widget,
          apiKey: undefined,
        },
        message: 'Widget updated successfully',
      });
    } catch (error) {
      console.error('Update widget error:', error);

      if (error instanceof z.ZodError) {
        res.status(400).json({
          error: 'Invalid update data',
          details: error.errors,
        });
      } else {
        res.status(500).json({ error: 'Failed to update widget' });
      }
    }
  });

  /**
   * DELETE /api/widget/:id
   * Delete widget
   */
  router.delete('/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const success = await widgetService.deleteWidget(id);

      if (!success) {
        return res.status(404).json({ error: 'Widget not found' });
      }

      res.json({
        success: true,
        message: 'Widget deleted successfully',
      });
    } catch (error) {
      console.error('Delete widget error:', error);
      res.status(500).json({ error: 'Failed to delete widget' });
    }
  });

  /**
   * GET /api/widget/:id/embed
   * Get widget embed code
   */
  router.get('/:id/embed', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const baseUrl = `${req.protocol}://${req.get('host')}`;

      const embedData = await widgetService.generateEmbedCode(id, baseUrl);

      res.json(embedData);
    } catch (error) {
      console.error('Generate embed code error:', error);

      if (error instanceof Error && error.message === 'Widget not found') {
        res.status(404).json({ error: 'Widget not found' });
      } else {
        res.status(500).json({ error: 'Failed to generate embed code' });
      }
    }
  });

  /**
   * OPTIONS /api/widget/:id/config
   * Handle CORS preflight for widget config
   */
  router.options('/:id/config', validateApiKey, (req: Request, res: Response) => {
    res.status(200).end();
  });

  /**
   * GET /api/widget/:id/config
   * Get widget configuration (for embedded widget)
   */
  router.get('/:id/config', validateApiKey, validateDomain, async (req: Request, res: Response) => {
    try {
      const widget = req.widget!;
      const isWithinHours = await widgetService.isWithinWorkingHours(widget.id);

      res.json({
        id: widget.id,
        settings: widget.settings,
        isActive: widget.isActive,
        isWithinWorkingHours: isWithinHours,
      });
    } catch (error) {
      console.error('Get widget config error:', error);
      res.status(500).json({ error: 'Failed to get widget configuration' });
    }
  });

  /**
   * OPTIONS /api/widget/:id/session
   * Handle CORS preflight for widget session
   */
  router.options('/:id/session', validateApiKey, (req: Request, res: Response) => {
    res.status(200).end();
  });

  /**
   * POST /api/widget/:id/session
   * Start a new widget session
   */
  router.post(
    '/:id/session',
    validateApiKey,
    validateDomain,
    async (req: Request, res: Response) => {
      try {
        const widget = req.widget!;
        const { pageUrl, referrer, userAgent } = req.body;

        console.log('🎯 Creating new widget session for widget:', widget.id);
        // Create chat session
        const chatSession = await sessionService.createSession();
        console.log('✅ Chat session created:', chatSession.id);

        // Track widget session
        const widgetSession = await widgetService.trackSession({
          widgetId: widget.id,
          sessionId: chatSession.id,
          pageUrl,
          referrer,
          userAgent,
          ipAddress: req.ip,
        });
        console.log('✅ Widget session tracked:', widgetSession.id);

        res.json({
          sessionId: chatSession.id,
          widgetSessionId: widgetSession.id,
          isWithinWorkingHours: await widgetService.isWithinWorkingHours(widget.id),
        });
      } catch (error) {
        console.error('Start widget session error:', error);
        res.status(500).json({ error: 'Failed to start session' });
      }
    },
  );

  /**
   * POST /api/widget/:id/track
   * Track widget events
   */
  router.post('/:id/track', validateApiKey, validateDomain, async (req: Request, res: Response) => {
    try {
      const widget = req.widget!;
      const eventData = trackEventSchema.parse(req.body);

      // Generate visitor fingerprint
      const fingerprint = generateFingerprint(req);

      // Track or update visitor
      const visitor = await widgetService.trackVisitor(fingerprint, {
        deviceType: getDeviceType(req.headers['user-agent'] || ''),
        browser: getBrowserInfo(req.headers['user-agent'] || ''),
        os: getOSInfo(req.headers['user-agent'] || ''),
        referralSource: req.headers.referer,
      });

      // Track event
      await widgetService.trackEvent({
        visitorId: visitor.id,
        widgetId: widget.id,
        ...eventData,
      });

      res.json({
        success: true,
        visitorId: visitor.id,
      });
    } catch (error) {
      console.error('Track event error:', error);

      if (error instanceof z.ZodError) {
        res.status(400).json({
          error: 'Invalid event data',
          details: error.errors,
        });
      } else {
        res.status(500).json({ error: 'Failed to track event' });
      }
    }
  });

  /**
   * GET /api/widget/:id/analytics
   * Get widget analytics
   */
  router.get('/:id/analytics', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const days = parseInt(req.query.days as string) || 30;

      const analytics = await widgetService.getWidgetAnalytics(id, days);

      res.json(analytics);
    } catch (error) {
      console.error('Get analytics error:', error);

      if (error instanceof Error && error.message === 'Widget not found') {
        res.status(404).json({ error: 'Widget not found' });
      } else {
        res.status(500).json({ error: 'Failed to get analytics' });
      }
    }
  });

  // Utility functions
  function generateFingerprint(req: Request): string {
    const components = [
      req.headers['user-agent'] || '',
      req.headers['accept-language'] || '',
      req.headers['accept-encoding'] || '',
      req.ip || '',
    ];

    return Buffer.from(components.join('|')).toString('base64');
  }

  function getDeviceType(userAgent: string): 'desktop' | 'mobile' | 'tablet' {
    const ua = userAgent.toLowerCase();
    if (ua.includes('mobile')) return 'mobile';
    if (ua.includes('tablet') || ua.includes('ipad')) return 'tablet';
    return 'desktop';
  }

  function getBrowserInfo(userAgent: string): string {
    const ua = userAgent.toLowerCase();
    if (ua.includes('chrome')) return 'Chrome';
    if (ua.includes('firefox')) return 'Firefox';
    if (ua.includes('safari')) return 'Safari';
    if (ua.includes('edge')) return 'Edge';
    return 'Unknown';
  }

  function getOSInfo(userAgent: string): string {
    const ua = userAgent.toLowerCase();
    if (ua.includes('windows')) return 'Windows';
    if (ua.includes('mac')) return 'macOS';
    if (ua.includes('linux')) return 'Linux';
    if (ua.includes('android')) return 'Android';
    if (ua.includes('ios')) return 'iOS';
    return 'Unknown';
  }

  return router;
}
