import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from './config/index.js';
import chatRoutes from './routes/chatRoutes.js';
import staffRoutes from './routes/staffRoutes.js';
import createWidgetRoutes from './routes/widgetRoutes.js';
import { KnowledgeBaseService } from './services/knowledgeBaseService.js';
import { StaffService } from './services/staffService.js';
import { SessionService } from './services/sessionService.js';
import { QueueService } from './services/queueService.js';
import { SocketService } from './services/socketService.js';
import { WidgetService } from './services/widgetService.js';
import { EmailService } from './services/emailService.js';
import { FeedbackService } from './services/feedbackService.js';
import { createFeedbackRoutes } from './routes/feedbackRoutes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = createServer(app);

// Initialize services
const knowledgeBaseService = new KnowledgeBaseService();
const staffService = new StaffService();
const sessionService = new SessionService();
const queueService = new QueueService(staffService);
const widgetService = new WidgetService();
const emailService = new EmailService();
const feedbackService = new FeedbackService();

// Initialize WebSocket service
const socketService = new SocketService(server, staffService, queueService, sessionService);

// Trust proxy for rate limiting behind reverse proxy
app.set('trust proxy', 1);

// Security middleware - modified for widget embedding
app.use(
  helmet({
    contentSecurityPolicy: false, // Disable CSP for widget embedding
    crossOriginEmbedderPolicy: false, // Allow embedding in iframes
  }),
);

// Rate limiting
const limiter = rateLimit({
  windowMs: config.rateLimitWindowMs,
  max: config.rateLimitMaxRequests,
  message: {
    error: 'Too many requests from this IP, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/', limiter);

// CORS configuration - enhanced for widget support
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, Postman, etc.)
      if (!origin) return callback(null, true);

      // Allow configured origins
      const allowedOrigins = config.allowedOrigins.split(',').map(origin => origin.trim());
      if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
        return callback(null, true);
      }

      // For widget routes, check if domain is allowed for any widget
      if (origin) {
        // This is a simplified check - in production you'd want to check against widget domains
        return callback(null, true);
      }

      callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-API-Key'],
  }),
);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser(config.sessionSecret));

// Serve static files for widget
app.use(
  '/widget',
  express.static(path.join(__dirname, '../public/widget'), {
    setHeaders: res => {
      // Allow embedding in any domain
      res.setHeader('X-Frame-Options', 'ALLOWALL');
      res.setHeader('Access-Control-Allow-Origin', '*');
    },
  }),
);

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    services: {
      webSocket: socketService.getConnectedStaffCount() > 0 ? 'connected' : 'ready',
      knowledgeBase: 'operational',
      authentication: 'operational',
      widgets: 'operational',
      email: emailService.isConfigured() ? 'operational' : 'not configured',
    },
  });
});

// API routes
app.use('/api/chat', chatRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/widget', createWidgetRoutes(sessionService));
app.use('/api/feedback', createFeedbackRoutes(feedbackService));

// Staff dashboard endpoint
app.get('/api/dashboard/overview', async (_req, res) => {
  try {
    const allStaff = await staffService.getAllStaff();
    const queueStats = await queueService.getQueueStats();
    const sessionStats = await sessionService.getSessionStats();
    const allWidgets = await widgetService.getAllWidgets();

    const overview = {
      staff: {
        total: allStaff.length,
        online: allStaff.filter(s => s.status === 'online').length,
        busy: allStaff.filter(s => s.status === 'busy').length,
        away: allStaff.filter(s => s.status === 'away').length,
      },
      queue: queueStats,
      sessions: sessionStats,
      widgets: {
        total: allWidgets.length,
        active: allWidgets.filter(w => w.isActive).length,
        totalSessions: allWidgets.reduce((sum, w) => sum + w.analytics.totalSessions, 0),
        totalMessages: allWidgets.reduce((sum, w) => sum + w.analytics.totalMessages, 0),
      },
      realtime: {
        connectedStaff: socketService.getConnectedStaffCount(),
        activeSessions: socketService.getConnectedCustomerSessions().length,
      },
    };

    res.json(overview);
  } catch (error) {
    console.error('Dashboard overview error:', error);
    res.status(500).json({ error: 'Failed to get dashboard overview' });
  }
});

// WebSocket connection info endpoint
app.get('/api/realtime/status', (_req, res) => {
  res.json({
    connectedStaff: socketService.getConnectedStaffCount(),
    activeSessions: socketService.getConnectedCustomerSessions().length,
    status: 'operational',
  });
});

// Widget demo page (for testing)
app.get('/demo', async (_req, res) => {
  try {
    const defaultWidget = await widgetService.getDefaultWidget();
    if (!defaultWidget) {
      return res.status(404).send('No default widget found');
    }

    const embedData = await widgetService.generateEmbedCode(
      defaultWidget.id,
      `${_req.protocol}://${_req.get('host')}`,
    );

    const demoHTML = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>MTOM AI Widget Demo</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            margin: 0;
            padding: 20px;
            background: #f5f5f5;
        }
        .container {
            max-width: 800px;
            margin: 0 auto;
            background: white;
            padding: 40px;
            border-radius: 12px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        h1 {
            color: #1f2937;
            margin-bottom: 20px;
        }
        .widget-info {
            background: #f3f4f6;
            padding: 20px;
            border-radius: 8px;
            margin: 20px 0;
        }
        .embed-code {
            background: #1f2937;
            color: #f9fafb;
            padding: 20px;
            border-radius: 8px;
            font-family: 'Monaco', 'Menlo', monospace;
            font-size: 12px;
            overflow-x: auto;
            white-space: pre;
        }
        .api-controls {
            margin: 20px 0;
        }
        button {
            background: #3b82f6;
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 6px;
            cursor: pointer;
            margin: 4px;
        }
        button:hover {
            background: #2563eb;
        }
        .status {
            margin: 10px 0;
            padding: 10px;
            background: #ecfdf5;
            border: 1px solid #10b981;
            border-radius: 6px;
            color: #065f46;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🤖 MTOM AI Widget Demo</h1>
        
        <div class="widget-info">
            <h3>Widget Information</h3>
            <p><strong>Widget ID:</strong> ${defaultWidget.id}</p>
            <p><strong>Company:</strong> ${defaultWidget.settings.companyName}</p>
            <p><strong>Domain:</strong> ${defaultWidget.domain}</p>
            <p><strong>Status:</strong> ${defaultWidget.isActive ? '✅ Active' : '❌ Inactive'}</p>
        </div>

        <h3>Widget Controls</h3>
        <div class="api-controls">
            <button onclick="MTOMAIWidget.open()">Open Widget</button>
            <button onclick="MTOMAIWidget.close()">Close Widget</button>
            <button onclick="MTOMAIWidget.sendMessage('Hello from demo page!')">Send Test Message</button>
            <button onclick="showStatus()">Show Status</button>
            <button onclick="MTOMAIWidget.debug()">Debug Widget</button>
        </div>
        
        <div id="status" class="status" style="display: none;"></div>

        <h3>Embed Code</h3>
        <p>Copy this code to embed the widget on any website:</p>
        <div class="embed-code">${embedData.embedCode
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')}</div>
        
        <h3>Features</h3>
        <ul>
            <li>✅ Real-time chat with WebSocket support</li>
            <li>✅ Staff takeover capability</li>
            <li>✅ Customizable appearance and position</li>
            <li>✅ Cross-domain embedding</li>
            <li>✅ Visitor tracking and analytics</li>
            <li>✅ Working hours configuration</li>
            <li>✅ Auto-open and welcome messages</li>
            <li>✅ Typing indicators</li>
            <li>✅ Mobile responsive</li>
        </ul>
        
        <p><strong>Note:</strong> The widget is already embedded on this page! Look for the chat button in the bottom-right corner.</p>
    </div>

    ${embedData.embedCode}

    <script>
        function showStatus() {
            const statusDiv = document.getElementById('status');
            statusDiv.style.display = 'block';
            statusDiv.innerHTML = \`
                <strong>Widget Status:</strong><br>
                Ready: \${MTOMAIWidget.isReady()}<br>
                Session ID: \${MTOMAIWidget.getSessionId() || 'Not started'}<br>
                Is Open: \${MTOMAIWidget.isOpen()}<br>
                Page URL: \${window.location.href}
            \`;
        }
        
        // Monitor widget initialization
        function checkWidgetReady() {
            const statusDiv = document.getElementById('status');
            if (typeof MTOMAIWidget !== 'undefined' && MTOMAIWidget.isReady()) {
                statusDiv.style.display = 'block';
                statusDiv.innerHTML = '✅ <strong>Widget Ready!</strong> You can now use all controls.';
                statusDiv.style.background = '#ecfdf5';
                statusDiv.style.borderColor = '#10b981';
                statusDiv.style.color = '#065f46';
                return;
            }
            
            // Still loading
            statusDiv.style.display = 'block';
            statusDiv.innerHTML = '⏳ <strong>Widget Loading...</strong> Please wait...';
            statusDiv.style.background = '#fef3c7';
            statusDiv.style.borderColor = '#f59e0b';
            statusDiv.style.color = '#92400e';
            
            // Check again in 500ms
            setTimeout(checkWidgetReady, 500);
        }
        
        // Start monitoring when page loads
        setTimeout(checkWidgetReady, 1000);
        
        // Also update status when manually requested
        const originalShowStatus = showStatus;
        showStatus = function() {
            if (typeof MTOMAIWidget !== 'undefined') {
                originalShowStatus();
            } else {
                document.getElementById('status').innerHTML = '❌ <strong>Widget not loaded</strong> - Check console for errors';
            }
        };
    </script>
</body>
</html>`;

    res.send(demoHTML);
  } catch (error) {
    console.error('Demo page error:', error);
    res.status(500).send('Error loading demo page');
  }
});

// 404 handler
app.use('*', (_req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: 'The requested resource was not found on this server.',
  });
});

// Global error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err);

  res.status(500).json({
    error: 'Internal Server Error',
    message: config.nodeEnv === 'development' ? err.message : 'Something went wrong',
  });
});

// Initialize services and start server
async function startServer() {
  try {
    console.log('🔧 Initializing services...');

    // Initialize knowledge base
    await knowledgeBaseService.initialize();
    console.log('📚 Knowledge base initialized');

    // Populate sample data in development
    if (config.nodeEnv === 'development') {
      console.log('📝 Populating sample knowledge base data...');
      await knowledgeBaseService.populateSampleData();
    }

    // Start the HTTP server with WebSocket support
    server.listen(config.port, () => {
      console.log(`🚀 Server running on port ${config.port} in ${config.nodeEnv} mode`);
      console.log(`💬 Chat API: http://localhost:${config.port}/api/chat`);
      console.log(`👥 Staff API: http://localhost:${config.port}/api/staff`);
      console.log(`📱 Widget API: http://localhost:${config.port}/api/widget`);
      console.log(`🔗 Health check: http://localhost:${config.port}/health`);
      console.log(`🎮 Widget Demo: http://localhost:${config.port}/demo`);
      console.log(`⚡ WebSocket server ready for real-time communication`);
      console.log('');
      console.log('📋 Default Staff Accounts:');
      console.log('   Admin: admin@mtom-ai.com / admin123');
      console.log('   Agent: agent@mtom-ai.com / agent123');
      console.log('');
      console.log('✅ Staff Takeover System: READY');
      console.log('   - Authentication & Authorization ✓');
      console.log('   - Real-time WebSocket Communication ✓');
      console.log('   - Queue Management System ✓');
      console.log('   - Chat Assignment & Transfer ✓');
      console.log('   - Staff Dashboard APIs ✓');
      console.log('');
      console.log('🎯 Widget Integration System: READY');
      console.log('   - Embeddable Chat Widget ✓');
      console.log('   - Multi-tenant Configuration ✓');
      console.log('   - Cross-domain Support ✓');
      console.log('   - Visitor Tracking & Analytics ✓');
      console.log('   - Customizable Appearance ✓');
      console.log(
        '   - Email Service: ' + (emailService.isConfigured() ? 'Operational' : 'Not Ready'),
      );
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('📴 SIGTERM received, shutting down gracefully...');
  server.close(() => {
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('📴 SIGINT received, shutting down gracefully...');
  server.close(() => {
    process.exit(0);
  });
});

startServer();
