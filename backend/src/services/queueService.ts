import { v4 as uuidv4 } from 'uuid';
import { ChatQueue, ChatSession, StaffUser, StaffAssignment } from '../types/index.js';
import { StaffService } from './staffService.js';

// TODO: Replace with Redis or proper queue system
class InMemoryQueueStore {
  private queue: Map<string, ChatQueue> = new Map();
  private assignments: Map<string, StaffAssignment> = new Map();

  async addToQueue(
    sessionId: string,
    priority: 'low' | 'medium' | 'high',
    customerInfo?: any,
    lastMessage?: string,
  ): Promise<ChatQueue> {
    const queueItem: ChatQueue = {
      id: uuidv4(),
      sessionId,
      priority,
      waitTime: 0,
      customerInfo,
      lastMessage,
      createdAt: new Date(),
    };

    this.queue.set(queueItem.id, queueItem);
    return queueItem;
  }

  async removeFromQueue(sessionId: string): Promise<boolean> {
    for (const [queueId, item] of this.queue.entries()) {
      if (item.sessionId === sessionId) {
        this.queue.delete(queueId);
        return true;
      }
    }
    return false;
  }

  async getQueue(): Promise<ChatQueue[]> {
    const items = Array.from(this.queue.values());

    // Update wait times
    const now = new Date();
    return items
      .map(item => ({
        ...item,
        waitTime: Math.floor((now.getTime() - item.createdAt.getTime()) / 1000), // seconds
      }))
      .sort((a, b) => {
        // Sort by priority first, then by wait time
        const priorityOrder = { high: 3, medium: 2, low: 1 };
        if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
          return priorityOrder[b.priority] - priorityOrder[a.priority];
        }
        return a.createdAt.getTime() - b.createdAt.getTime();
      });
  }

  async getQueueLength(): Promise<number> {
    return this.queue.size;
  }

  async getAverageWaitTime(): Promise<number> {
    const items = Array.from(this.queue.values());
    if (items.length === 0) return 0;

    const now = new Date();
    const totalWaitTime = items.reduce((sum, item) => {
      return sum + (now.getTime() - item.createdAt.getTime());
    }, 0);

    return Math.floor(totalWaitTime / items.length / 1000); // seconds
  }

  async assignSession(sessionId: string, staffId: string): Promise<StaffAssignment> {
    const assignment: StaffAssignment = {
      sessionId,
      staffId,
      assignedAt: new Date(),
      status: 'assigned',
    };

    this.assignments.set(sessionId, assignment);
    return assignment;
  }

  async getAssignment(sessionId: string): Promise<StaffAssignment | null> {
    return this.assignments.get(sessionId) || null;
  }

  async updateAssignmentStatus(
    sessionId: string,
    status: StaffAssignment['status'],
  ): Promise<boolean> {
    const assignment = this.assignments.get(sessionId);
    if (!assignment) return false;

    assignment.status = status;
    this.assignments.set(sessionId, assignment);
    return true;
  }

  async getStaffAssignments(staffId: string): Promise<StaffAssignment[]> {
    return Array.from(this.assignments.values()).filter(
      assignment => assignment.staffId === staffId,
    );
  }

  async updateAssignment(sessionId: string, updates: Partial<StaffAssignment>): Promise<boolean> {
    const assignment = this.assignments.get(sessionId);
    if (!assignment) return false;

    Object.assign(assignment, updates);
    this.assignments.set(sessionId, assignment);
    return true;
  }
}

export class QueueService {
  private store: InMemoryQueueStore;
  private staffService: StaffService;

  constructor(staffService: StaffService) {
    this.store = new InMemoryQueueStore();
    this.staffService = staffService;
  }

  /**
   * Add a chat session to the queue
   */
  async addToQueue(
    sessionId: string,
    priority: 'low' | 'medium' | 'high' = 'medium',
    customerInfo?: any,
    lastMessage?: string,
  ): Promise<ChatQueue> {
    return this.store.addToQueue(sessionId, priority, customerInfo, lastMessage);
  }

  /**
   * Remove a session from the queue
   */
  async removeFromQueue(sessionId: string): Promise<boolean> {
    return this.store.removeFromQueue(sessionId);
  }

  /**
   * Get the current queue with wait times
   */
  async getQueue(): Promise<ChatQueue[]> {
    return this.store.getQueue();
  }

  /**
   * Get queue statistics
   */
  async getQueueStats(): Promise<{
    length: number;
    averageWaitTime: number;
    priorityBreakdown: { high: number; medium: number; low: number };
  }> {
    const queue = await this.store.getQueue();
    const length = await this.store.getQueueLength();
    const averageWaitTime = await this.store.getAverageWaitTime();

    const priorityBreakdown = queue.reduce(
      (acc, item) => {
        acc[item.priority]++;
        return acc;
      },
      { high: 0, medium: 0, low: 0 },
    );

    return {
      length,
      averageWaitTime,
      priorityBreakdown,
    };
  }

  /**
   * Automatically assign the next chat in queue to an available staff member
   */
  async assignNextChat(): Promise<{
    success: boolean;
    assignment?: StaffAssignment;
    error?: string;
  }> {
    const queue = await this.store.getQueue();
    if (queue.length === 0) {
      return { success: false, error: 'No chats in queue' };
    }

    const availableStaff = await this.staffService.getAvailableStaff();
    if (availableStaff.length === 0) {
      return { success: false, error: 'No available staff' };
    }

    // Get the next priority chat
    const nextChat = queue[0];

    // Find the best staff member (least loaded)
    const bestStaff = availableStaff.reduce((best, current) =>
      current.currentChatCount < best.currentChatCount ? current : best,
    );

    // Assign the chat
    const success = await this.staffService.assignChat(bestStaff.id);
    if (!success) {
      return { success: false, error: 'Failed to assign chat to staff' };
    }

    // Create assignment record
    const assignment = await this.store.assignSession(nextChat.sessionId, bestStaff.id);

    // Remove from queue
    await this.store.removeFromQueue(nextChat.sessionId);

    return { success: true, assignment };
  }

  /**
   * Manually assign a specific chat to a specific staff member
   */
  async assignChatToStaff(
    sessionId: string,
    staffId: string,
  ): Promise<{ success: boolean; assignment?: StaffAssignment; error?: string }> {
    // Check if staff member is available
    const staff = await this.staffService.getAllStaff();
    const targetStaff = staff.find(s => s.id === staffId);

    if (!targetStaff) {
      return { success: false, error: 'Staff member not found' };
    }

    if (targetStaff.currentChatCount >= targetStaff.maxConcurrentChats) {
      return { success: false, error: 'Staff member at maximum capacity' };
    }

    // Assign the chat
    const success = await this.staffService.assignChat(staffId);
    if (!success) {
      return { success: false, error: 'Failed to assign chat to staff' };
    }

    // Create assignment record
    const assignment = await this.store.assignSession(sessionId, staffId);

    // Remove from queue if it was there
    await this.store.removeFromQueue(sessionId);

    return { success: true, assignment };
  }

  /**
   * Complete a chat assignment
   */
  async completeAssignment(sessionId: string): Promise<boolean> {
    const assignment = await this.store.getAssignment(sessionId);
    if (!assignment) return false;

    // Update assignment status
    await this.store.updateAssignmentStatus(sessionId, 'completed');

    // Remove chat from staff member's count
    await this.staffService.unassignChat(assignment.staffId);

    return true;
  }

  /**
   * Transfer a chat from one staff member to another
   */
  async transferChat(
    sessionId: string,
    fromStaffId: string,
    toStaffId: string,
  ): Promise<{ success: boolean; error?: string }> {
    const assignment = await this.store.getAssignment(sessionId);
    if (!assignment || assignment.staffId !== fromStaffId) {
      return { success: false, error: 'Assignment not found or staff mismatch' };
    }

    // Check if target staff is available
    const targetStaff = await this.staffService.getAllStaff();
    const staff = targetStaff.find(s => s.id === toStaffId);

    if (!staff) {
      return { success: false, error: 'Target staff member not found' };
    }

    if (staff.currentChatCount >= staff.maxConcurrentChats) {
      return { success: false, error: 'Target staff member at maximum capacity' };
    }

    // Remove from original staff
    await this.staffService.unassignChat(fromStaffId);

    // Assign to new staff
    const success = await this.staffService.assignChat(toStaffId);
    if (!success) {
      // Rollback
      await this.staffService.assignChat(fromStaffId);
      return { success: false, error: 'Failed to assign to new staff member' };
    }

    // Update assignment
    assignment.staffId = toStaffId;
    assignment.assignedAt = new Date();
    this.store.updateAssignment(sessionId, { staffId: toStaffId, assignedAt: new Date() });

    return { success: true };
  }

  /**
   * Get all assignments for a staff member
   */
  async getStaffAssignments(staffId: string): Promise<StaffAssignment[]> {
    return this.store.getStaffAssignments(staffId);
  }

  /**
   * Get assignment for a specific session
   */
  async getSessionAssignment(sessionId: string): Promise<StaffAssignment | null> {
    return this.store.getAssignment(sessionId);
  }

  /**
   * Check if automatic assignment should be triggered
   */
  async checkAndAssign(): Promise<void> {
    const queueStats = await this.getQueueStats();
    if (queueStats.length > 0) {
      const availableStaff = await this.staffService.getAvailableStaff();
      if (availableStaff.length > 0) {
        await this.assignNextChat();
      }
    }
  }
}
