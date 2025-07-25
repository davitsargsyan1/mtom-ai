import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { StaffService } from '../services/staffService.js';
import { QueueService } from '../services/queueService.js';
import { SessionService } from '../services/sessionService.js';
import { StaffLoginRequest, StaffUser } from '../types/index.js';

const router = Router();

// Request validation schemas
const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

const statusUpdateSchema = z.object({
  status: z.enum(['online', 'offline', 'busy', 'away']),
});

const assignChatSchema = z.object({
  sessionId: z.string().uuid('Invalid session ID'),
  staffId: z.string().uuid('Invalid staff ID').optional(),
});

const transferChatSchema = z.object({
  sessionId: z.string().uuid('Invalid session ID'),
  toStaffId: z.string().uuid('Invalid staff ID'),
});

// Initialize services
const staffService = new StaffService();
const queueService = new QueueService(staffService);
const sessionService = new SessionService();

// Middleware to authenticate staff
const authenticateStaff = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const staff = await staffService.getStaffByToken(token);
    if (!staff) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    req.staff = staff;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Authentication failed' });
  }
};

// Middleware to check admin role
const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (req.staff?.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

/**
 * POST /api/staff/login
 * Staff authentication
 */
router.post('/login', async (req: Request, res: Response) => {
  try {
    const loginData = loginSchema.parse(req.body);
    const result = await staffService.login(loginData);

    res.json(result);
  } catch (error) {
    console.error('Staff login error:', error);

    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: 'Invalid login data',
        details: error.errors,
      });
    } else {
      res.status(401).json({
        error: error instanceof Error ? error.message : 'Login failed',
      });
    }
  }
});

/**
 * POST /api/staff/logout
 * Staff logout
 */
router.post('/logout', authenticateStaff, async (req: Request, res: Response) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (token) {
      await staffService.logout(token);
    }

    res.json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    console.error('Staff logout error:', error);
    res.status(500).json({ error: 'Logout failed' });
  }
});

/**
 * GET /api/staff/profile
 * Get current staff profile
 */
router.get('/profile', authenticateStaff, async (req: Request, res: Response) => {
  try {
    res.json({ staff: req.staff });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Failed to get profile' });
  }
});

/**
 * PUT /api/staff/status
 * Update staff status
 */
router.put('/status', authenticateStaff, async (req: Request, res: Response) => {
  try {
    const { status } = statusUpdateSchema.parse(req.body);
    const updatedStaff = await staffService.updateStatus(req.staff!.id, status);

    res.json({ success: true, staff: updatedStaff });
  } catch (error) {
    console.error('Status update error:', error);

    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: 'Invalid status data',
        details: error.errors,
      });
    } else {
      res.status(500).json({ error: 'Failed to update status' });
    }
  }
});

/**
 * GET /api/staff/dashboard
 * Get staff dashboard data
 */
router.get('/dashboard', authenticateStaff, async (req: Request, res: Response) => {
  try {
    const dashboardData = await staffService.getDashboardData(req.staff!.id);
    const queueStats = await queueService.getQueueStats();
    const assignments = await queueService.getStaffAssignments(req.staff!.id);

    res.json({
      ...dashboardData,
      queue: queueStats,
      assignments,
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({ error: 'Failed to get dashboard data' });
  }
});

/**
 * GET /api/staff/queue
 * Get current chat queue
 */
router.get('/queue', authenticateStaff, async (req: Request, res: Response) => {
  try {
    const queue = await queueService.getQueue();
    const stats = await queueService.getQueueStats();

    res.json({
      queue,
      stats,
    });
  } catch (error) {
    console.error('Queue error:', error);
    res.status(500).json({ error: 'Failed to get queue data' });
  }
});

/**
 * POST /api/staff/assign-chat
 * Assign a chat to staff member
 */
router.post('/assign-chat', authenticateStaff, async (req: Request, res: Response) => {
  try {
    const { sessionId, staffId } = assignChatSchema.parse(req.body);

    let result;
    if (staffId) {
      // Manual assignment to specific staff
      result = await queueService.assignChatToStaff(sessionId, staffId);
    } else {
      // Auto assignment to next available staff
      result = await queueService.assignNextChat();
    }

    if (result.success) {
      // Update session status
      await sessionService.updateSessionStatus(sessionId, 'with_staff');

      res.json({
        success: true,
        assignment: result.assignment,
        message: 'Chat assigned successfully',
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error,
      });
    }
  } catch (error) {
    console.error('Assign chat error:', error);

    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: 'Invalid assignment data',
        details: error.errors,
      });
    } else {
      res.status(500).json({ error: 'Failed to assign chat' });
    }
  }
});

/**
 * POST /api/staff/transfer-chat
 * Transfer a chat to another staff member
 */
router.post('/transfer-chat', authenticateStaff, async (req: Request, res: Response) => {
  try {
    const { sessionId, toStaffId } = transferChatSchema.parse(req.body);

    const result = await queueService.transferChat(sessionId, req.staff!.id, toStaffId);

    if (result.success) {
      res.json({
        success: true,
        message: 'Chat transferred successfully',
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error,
      });
    }
  } catch (error) {
    console.error('Transfer chat error:', error);

    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: 'Invalid transfer data',
        details: error.errors,
      });
    } else {
      res.status(500).json({ error: 'Failed to transfer chat' });
    }
  }
});

/**
 * POST /api/staff/complete-chat/:sessionId
 * Mark a chat as completed
 */
router.post('/complete-chat/:sessionId', authenticateStaff, async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;

    const success = await queueService.completeAssignment(sessionId);

    if (success) {
      await sessionService.updateSessionStatus(sessionId, 'resolved');

      res.json({
        success: true,
        message: 'Chat completed successfully',
      });
    } else {
      res.status(404).json({
        success: false,
        error: 'Assignment not found',
      });
    }
  } catch (error) {
    console.error('Complete chat error:', error);
    res.status(500).json({ error: 'Failed to complete chat' });
  }
});

/**
 * GET /api/staff/assignments
 * Get current staff assignments
 */
router.get('/assignments', authenticateStaff, async (req: Request, res: Response) => {
  try {
    const assignments = await queueService.getStaffAssignments(req.staff!.id);

    // Get session details for each assignment
    const assignmentsWithSessions = await Promise.all(
      assignments.map(async assignment => {
        try {
          const session = await sessionService.getSession(assignment.sessionId);
          return {
            ...assignment,
            session,
          };
        } catch {
          return assignment;
        }
      }),
    );

    res.json({ assignments: assignmentsWithSessions });
  } catch (error) {
    console.error('Get assignments error:', error);
    res.status(500).json({ error: 'Failed to get assignments' });
  }
});

/**
 * GET /api/staff/all (Admin only)
 * Get all staff members
 */
router.get('/all', authenticateStaff, requireAdmin, async (req: Request, res: Response) => {
  try {
    const allStaff = await staffService.getAllStaff();
    res.json({ staff: allStaff });
  } catch (error) {
    console.error('Get all staff error:', error);
    res.status(500).json({ error: 'Failed to get staff list' });
  }
});

/**
 * GET /api/staff/online
 * Get online staff members
 */
router.get('/online', authenticateStaff, async (req: Request, res: Response) => {
  try {
    const onlineStaff = await staffService.getOnlineStaff();
    res.json({ staff: onlineStaff });
  } catch (error) {
    console.error('Get online staff error:', error);
    res.status(500).json({ error: 'Failed to get online staff' });
  }
});

/**
 * GET /api/staff/stats (Admin only)
 * Get staff performance statistics
 */
router.get('/stats', authenticateStaff, requireAdmin, async (req: Request, res: Response) => {
  try {
    const allStaff = await staffService.getAllStaff();
    const queueStats = await queueService.getQueueStats();

    const stats = {
      totalStaff: allStaff.length,
      onlineStaff: allStaff.filter(s => s.status === 'online').length,
      busyStaff: allStaff.filter(s => s.status === 'busy').length,
      awayStaff: allStaff.filter(s => s.status === 'away').length,
      totalAssignedChats: allStaff.reduce((sum, s) => sum + s.currentChatCount, 0),
      totalCapacity: allStaff.reduce((sum, s) => sum + s.maxConcurrentChats, 0),
      queueStats,
    };

    res.json(stats);
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ error: 'Failed to get statistics' });
  }
});

// Extend Request interface to include staff property
declare global {
  namespace Express {
    interface Request {
      staff?: StaffUser;
    }
  }
}

export default router;
