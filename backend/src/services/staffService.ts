import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config/index.js';
import { StaffUser, StaffLoginRequest, StaffLoginResponse } from '../types/index.js';

// TODO: Replace with proper database storage
// This is an in-memory store for demo purposes
class InMemoryStaffStore {
  private staff: Map<string, StaffUser & { password: string }> = new Map();
  private sessions: Map<string, string> = new Map(); // token -> staffId

  constructor() {
    // Create default admin user
    this.createDefaultStaff();
  }

  private async createDefaultStaff() {
    const defaultStaff = [
      {
        id: uuidv4(),
        email: 'admin@mtom-ai.com',
        password: await bcrypt.hash('admin123', 10),
        name: 'Admin User',
        role: 'admin' as const,
        status: 'offline' as const,
        createdAt: new Date(),
        lastActive: new Date(),
        maxConcurrentChats: 10,
        currentChatCount: 0,
      },
      {
        id: uuidv4(),
        email: 'agent@mtom-ai.com',
        password: await bcrypt.hash('agent123', 10),
        name: 'Support Agent',
        role: 'agent' as const,
        status: 'offline' as const,
        createdAt: new Date(),
        lastActive: new Date(),
        maxConcurrentChats: 5,
        currentChatCount: 0,
      },
    ];

    for (const staff of defaultStaff) {
      this.staff.set(staff.id, staff);
    }
  }

  async findByEmail(email: string): Promise<(StaffUser & { password: string }) | null> {
    for (const staff of this.staff.values()) {
      if (staff.email === email) {
        return staff;
      }
    }
    return null;
  }

  async findById(id: string): Promise<StaffUser | null> {
    const staff = this.staff.get(id);
    if (!staff) return null;

    const { password, ...staffWithoutPassword } = staff;
    return staffWithoutPassword;
  }

  async updateStaff(id: string, updates: Partial<StaffUser>): Promise<StaffUser | null> {
    const staff = this.staff.get(id);
    if (!staff) return null;

    const updatedStaff = { ...staff, ...updates, lastActive: new Date() };
    this.staff.set(id, updatedStaff);

    const { password, ...staffWithoutPassword } = updatedStaff;
    return staffWithoutPassword;
  }

  async getAllStaff(): Promise<StaffUser[]> {
    return Array.from(this.staff.values()).map(({ password, ...staff }) => staff);
  }

  async getOnlineStaff(): Promise<StaffUser[]> {
    return Array.from(this.staff.values())
      .filter(staff => staff.status === 'online')
      .map(({ password, ...staff }) => staff);
  }

  async createSession(token: string, staffId: string): Promise<void> {
    this.sessions.set(token, staffId);
  }

  async getStaffByToken(token: string): Promise<StaffUser | null> {
    const staffId = this.sessions.get(token);
    if (!staffId) return null;
    return this.findById(staffId);
  }

  async deleteSession(token: string): Promise<void> {
    this.sessions.delete(token);
  }
}

export class StaffService {
  private store: InMemoryStaffStore;

  constructor() {
    this.store = new InMemoryStaffStore();
  }

  /**
   * Authenticate staff user and return JWT token
   */
  async login(loginData: StaffLoginRequest): Promise<StaffLoginResponse> {
    const staff = await this.store.findByEmail(loginData.email);
    if (!staff) {
      throw new Error('Invalid email or password');
    }

    const isPasswordValid = await bcrypt.compare(loginData.password, staff.password);
    if (!isPasswordValid) {
      throw new Error('Invalid email or password');
    }

    // Generate JWT token
    const token = jwt.sign(
      { staffId: staff.id, email: staff.email, role: staff.role },
      config.sessionSecret,
      { expiresIn: '8h' },
    );

    // Create session
    await this.store.createSession(token, staff.id);

    // Update staff status to online
    await this.store.updateStaff(staff.id, { status: 'online', lastActive: new Date() });

    const { password, ...userWithoutPassword } = staff;
    return {
      token,
      user: { ...userWithoutPassword, status: 'online', lastActive: new Date() },
    };
  }

  /**
   * Logout staff user
   */
  async logout(token: string): Promise<void> {
    const staff = await this.store.getStaffByToken(token);
    if (staff) {
      await this.store.updateStaff(staff.id, { status: 'offline' });
    }
    await this.store.deleteSession(token);
  }

  /**
   * Get staff user by token
   */
  async getStaffByToken(token: string): Promise<StaffUser | null> {
    return this.store.getStaffByToken(token);
  }

  /**
   * Update staff status
   */
  async updateStatus(staffId: string, status: StaffUser['status']): Promise<StaffUser | null> {
    return this.store.updateStaff(staffId, { status });
  }

  /**
   * Get all staff members
   */
  async getAllStaff(): Promise<StaffUser[]> {
    return this.store.getAllStaff();
  }

  /**
   * Get online staff members
   */
  async getOnlineStaff(): Promise<StaffUser[]> {
    return this.store.getOnlineStaff();
  }

  /**
   * Get available staff (online and not at max capacity)
   */
  async getAvailableStaff(): Promise<StaffUser[]> {
    const onlineStaff = await this.store.getOnlineStaff();
    return onlineStaff.filter(
      staff => staff.status === 'online' && staff.currentChatCount < staff.maxConcurrentChats,
    );
  }

  /**
   * Assign chat to staff member
   */
  async assignChat(staffId: string): Promise<boolean> {
    const staff = await this.store.findById(staffId);
    if (!staff || staff.currentChatCount >= staff.maxConcurrentChats) {
      return false;
    }

    await this.store.updateStaff(staffId, {
      currentChatCount: staff.currentChatCount + 1,
    });
    return true;
  }

  /**
   * Remove chat assignment from staff member
   */
  async unassignChat(staffId: string): Promise<boolean> {
    const staff = await this.store.findById(staffId);
    if (!staff) return false;

    await this.store.updateStaff(staffId, {
      currentChatCount: Math.max(0, staff.currentChatCount - 1),
    });
    return true;
  }

  /**
   * Get staff dashboard data
   */
  async getDashboardData(staffId: string): Promise<{
    staff: StaffUser;
    assignedChats: number;
    queueLength: number;
    averageResponseTime: number;
  }> {
    const staff = await this.store.findById(staffId);
    if (!staff) {
      throw new Error('Staff not found');
    }

    // TODO: Get real data from queue and chat services
    return {
      staff,
      assignedChats: staff.currentChatCount,
      queueLength: 0, // Will be updated when queue service is implemented
      averageResponseTime: 0, // Will be calculated from actual response times
    };
  }

  /**
   * Verify JWT token
   */
  verifyToken(token: string): { staffId: string; email: string; role: string } | null {
    try {
      const decoded = jwt.verify(token, config.sessionSecret) as any;
      return {
        staffId: decoded.staffId,
        email: decoded.email,
        role: decoded.role,
      };
    } catch (error) {
      return null;
    }
  }
}
