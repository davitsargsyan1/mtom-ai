import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';
import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import { StaffService } from './staffService.js';
import { QueueService } from './queueService.js';
import { SessionService } from './sessionService.js';
import { AIService } from './aiService.js';
import { KnowledgeBaseService } from './knowledgeBaseService.js';
import { SocketEvents, ChatMessage } from '../types/index.js';

export class SocketService {
  private io: SocketIOServer;
  private staffService: StaffService;
  private queueService: QueueService;
  private sessionService: SessionService;
  private aiService: AIService;
  private knowledgeBaseService: KnowledgeBaseService;
  private staffSockets: Map<string, string> = new Map(); // staffId -> socketId
  private customerSockets: Map<string, string> = new Map(); // sessionId -> socketId

  constructor(
    server: HTTPServer,
    staffService: StaffService,
    queueService: QueueService,
    sessionService: SessionService,
  ) {
    this.staffService = staffService;
    this.queueService = queueService;
    this.sessionService = sessionService;
    this.aiService = new AIService();
    this.knowledgeBaseService = new KnowledgeBaseService();

    // Initialize knowledge base service
    this.knowledgeBaseService.initialize().catch(error => {
      console.warn('⚠️ Socket service: KnowledgeBase initialization failed:', error);
    });

    this.io = new SocketIOServer(server, {
      cors: {
        origin: config.allowedOrigins.split(',').map(origin => origin.trim()),
        methods: ['GET', 'POST'],
        credentials: true,
      },
    });

    this.setupSocketHandlers();
  }

  private setupSocketHandlers(): void {
    this.io.on('connection', socket => {
      console.log(`Socket connected: ${socket.id}`);

      // Staff authentication
      socket.on('staff_authenticate', async (data: { token: string }) => {
        try {
          const staff = await this.staffService.getStaffByToken(data.token);
          if (staff) {
            this.staffSockets.set(staff.id, socket.id);
            socket.join('staff'); // Join staff room
            socket.data.staffId = staff.id;
            socket.data.role = 'staff';

            socket.emit('staff_authenticated', { staff });

            // Notify other staff members
            socket.to('staff').emit('staff_online', {
              staffId: staff.id,
              name: staff.name,
            });

            console.log(`Staff authenticated: ${staff.name} (${staff.id})`);
          } else {
            socket.emit('authentication_failed', { error: 'Invalid token' });
          }
        } catch (error) {
          socket.emit('authentication_failed', { error: 'Authentication error' });
        }
      });

      // Customer connection
      socket.on('customer_join', async (data: { sessionId: string }) => {
        try {
          this.customerSockets.set(data.sessionId, socket.id);
          socket.join(`session_${data.sessionId}`);
          socket.data.sessionId = data.sessionId;
          socket.data.role = 'customer';

          console.log(`Customer joined session: ${data.sessionId}`);
        } catch (error) {
          socket.emit('join_failed', { error: 'Failed to join session' });
        }
      });

      // Staff status updates
      socket.on(
        'staff_status_update',
        async (data: { status: 'online' | 'offline' | 'busy' | 'away' }) => {
          if (socket.data.role === 'staff' && socket.data.staffId) {
            await this.staffService.updateStatus(socket.data.staffId, data.status);

            // Notify all staff members
            this.io.to('staff').emit('staff_status_changed', {
              staffId: socket.data.staffId,
              status: data.status,
            });
          }
        },
      );

      // Message sending
      socket.on(
        'send_message',
        async (data: { sessionId: string; message: string; role: 'staff' | 'customer' }) => {
          try {
            const messageRole = data.role === 'staff' ? 'assistant' : 'user';
            const message = await this.sessionService.addMessage(
              data.sessionId,
              data.message,
              messageRole,
            );

            // Send to everyone in the session
            this.io.to(`session_${data.sessionId}`).emit('new_message', {
              sessionId: data.sessionId,
              message,
            });

            // If it's a customer message, generate AI response
            if (data.role === 'customer') {
              console.log('🤖 Generating AI response for customer message...');

              try {
                // Get session for customer info and message history
                console.log('📋 Getting session:', data.sessionId);
                const session = await this.sessionService.getSession(data.sessionId);
                if (session) {
                  console.log('✅ Session found, getting conversation history...');
                  // Get relevant knowledge base context
                  const conversationHistory = await this.sessionService.getConversationHistory(
                    data.sessionId,
                    5,
                  );
                  console.log('✅ Conversation history retrieved, getting knowledge context...');

                  const knowledgeContext = await this.knowledgeBaseService.getRelevantContext(
                    data.message,
                    conversationHistory,
                  );
                  console.log('✅ Knowledge context retrieved, generating AI response...');

                  // Generate AI response
                  const aiResponse = await this.aiService.generateResponse(
                    session.messages,
                    session.customerInfo,
                    knowledgeContext,
                  );
                  console.log(
                    '✅ AI response generated:',
                    aiResponse.content.substring(0, 100) + '...',
                  );

                  // Add AI response to session
                  const responseMessage = await this.sessionService.addMessage(
                    data.sessionId,
                    aiResponse.content,
                    'assistant',
                    {
                      confidence: aiResponse.confidence,
                      tokensUsed: aiResponse.metadata?.tokensUsed,
                      responseTime: aiResponse.metadata?.responseTime,
                    },
                  );
                  console.log('✅ AI response added to session');

                  // Send AI response to session
                  this.io.to(`session_${data.sessionId}`).emit('new_message', {
                    sessionId: data.sessionId,
                    message: responseMessage,
                  });

                  console.log('✅ AI response sent successfully');
                } else {
                  console.log('❌ Session not found:', data.sessionId);
                }
              } catch (aiError) {
                console.error('❌ Failed to generate AI response:', aiError);
                console.error(
                  '❌ Error stack:',
                  aiError instanceof Error ? aiError.stack : 'No stack trace',
                );

                // Send error message to customer
                const errorMessage = await this.sessionService.addMessage(
                  data.sessionId,
                  'Sorry, I encountered an error processing your message. Please try again.',
                  'assistant',
                );

                this.io.to(`session_${data.sessionId}`).emit('new_message', {
                  sessionId: data.sessionId,
                  message: errorMessage,
                });
              }
            }

            // If it's a staff message, also notify staff room
            if (data.role === 'staff') {
              socket.to('staff').emit('staff_message_sent', {
                sessionId: data.sessionId,
                staffId: socket.data.staffId,
                message: data.message,
              });
            }
          } catch (error) {
            console.error('❌ Send message error:', error);
            socket.emit('message_failed', { error: 'Failed to send message' });
          }
        },
      );

      // Typing indicators
      socket.on('typing_start', (data: { sessionId: string }) => {
        socket.to(`session_${data.sessionId}`).emit('user_typing', {
          sessionId: data.sessionId,
          userId: socket.data.staffId || 'customer',
          isTyping: true,
        });
      });

      socket.on('typing_stop', (data: { sessionId: string }) => {
        socket.to(`session_${data.sessionId}`).emit('user_typing', {
          sessionId: data.sessionId,
          userId: socket.data.staffId || 'customer',
          isTyping: false,
        });
      });

      // Chat assignment
      socket.on('assign_chat', async (data: { sessionId: string; staffId?: string }) => {
        if (socket.data.role !== 'staff') return;

        try {
          let result;
          if (data.staffId) {
            // Manual assignment
            result = await this.queueService.assignChatToStaff(data.sessionId, data.staffId);
          } else {
            // Auto assignment
            result = await this.queueService.assignNextChat();
          }

          if (result.success && result.assignment) {
            // Update session status
            await this.sessionService.updateSessionStatus(data.sessionId, 'with_staff');

            // Notify staff member
            const staffSocketId = this.staffSockets.get(result.assignment.staffId);
            if (staffSocketId) {
              this.io.to(staffSocketId).emit('chat_assigned', {
                sessionId: data.sessionId,
                assignment: result.assignment,
              });
            }

            // Notify customer
            this.io.to(`session_${data.sessionId}`).emit('staff_joined', {
              staffId: result.assignment.staffId,
              message: 'A support agent has joined the chat',
            });

            // Notify all staff about queue update
            this.broadcastQueueUpdate();
          } else {
            socket.emit('assignment_failed', { error: result.error });
          }
        } catch (error) {
          socket.emit('assignment_failed', { error: 'Assignment failed' });
        }
      });

      // Chat transfer
      socket.on('transfer_chat', async (data: { sessionId: string; toStaffId: string }) => {
        if (socket.data.role !== 'staff') return;

        try {
          const result = await this.queueService.transferChat(
            data.sessionId,
            socket.data.staffId,
            data.toStaffId,
          );

          if (result.success) {
            // Notify both staff members
            const fromStaffSocket = this.staffSockets.get(socket.data.staffId);
            const toStaffSocket = this.staffSockets.get(data.toStaffId);

            if (fromStaffSocket) {
              this.io.to(fromStaffSocket).emit('chat_transferred_out', {
                sessionId: data.sessionId,
                toStaffId: data.toStaffId,
              });
            }

            if (toStaffSocket) {
              this.io.to(toStaffSocket).emit('chat_transferred_in', {
                sessionId: data.sessionId,
                fromStaffId: socket.data.staffId,
              });
            }

            // Notify customer
            this.io.to(`session_${data.sessionId}`).emit('staff_changed', {
              message: 'Your chat has been transferred to another agent',
            });
          } else {
            socket.emit('transfer_failed', { error: result.error });
          }
        } catch (error) {
          socket.emit('transfer_failed', { error: 'Transfer failed' });
        }
      });

      // Complete chat
      socket.on('complete_chat', async (data: { sessionId: string }) => {
        if (socket.data.role !== 'staff') return;

        try {
          await this.queueService.completeAssignment(data.sessionId);
          await this.sessionService.updateSessionStatus(data.sessionId, 'resolved');

          // Notify customer
          this.io.to(`session_${data.sessionId}`).emit('chat_completed', {
            message: 'This chat has been marked as resolved',
          });

          // Notify staff
          socket.emit('chat_completed_confirmed', { sessionId: data.sessionId });

          // Update queue
          this.broadcastQueueUpdate();
        } catch (error) {
          socket.emit('completion_failed', { error: 'Failed to complete chat' });
        }
      });

      // Request staff help (escalation)
      socket.on(
        'request_staff',
        async (data: { sessionId: string; priority?: 'low' | 'medium' | 'high' }) => {
          try {
            // Add to queue
            await this.queueService.addToQueue(data.sessionId, data.priority || 'medium');

            // Update session status
            await this.sessionService.updateSessionStatus(data.sessionId, 'waiting_for_staff');

            // Notify customer
            socket.emit('added_to_queue', {
              message:
                'You have been added to the support queue. An agent will be with you shortly.',
            });

            // Notify staff about new request
            this.broadcastQueueUpdate();

            // Try automatic assignment
            await this.queueService.checkAndAssign();
          } catch (error) {
            socket.emit('queue_failed', { error: 'Failed to add to queue' });
          }
        },
      );

      // Disconnect handling
      socket.on('disconnect', () => {
        console.log(`Socket disconnected: ${socket.id}`);

        // Remove from tracking maps
        if (socket.data.role === 'staff' && socket.data.staffId) {
          this.staffSockets.delete(socket.data.staffId);

          // Update staff status to offline
          this.staffService.updateStatus(socket.data.staffId, 'offline');

          // Notify other staff
          socket.to('staff').emit('staff_offline', {
            staffId: socket.data.staffId,
          });
        }

        if (socket.data.role === 'customer' && socket.data.sessionId) {
          this.customerSockets.delete(socket.data.sessionId);
        }
      });
    });
  }

  /**
   * Broadcast queue updates to all staff members
   */
  private async broadcastQueueUpdate(): Promise<void> {
    try {
      const queueStats = await this.queueService.getQueueStats();
      this.io.to('staff').emit('queue_updated', queueStats);
    } catch (error) {
      console.error('Failed to broadcast queue update:', error);
    }
  }

  /**
   * Send a message to a specific session
   */
  public async sendToSession(sessionId: string, event: string, data: any): Promise<void> {
    this.io.to(`session_${sessionId}`).emit(event, data);
  }

  /**
   * Send a message to a specific staff member
   */
  public async sendToStaff(staffId: string, event: string, data: any): Promise<void> {
    const socketId = this.staffSockets.get(staffId);
    if (socketId) {
      this.io.to(socketId).emit(event, data);
    }
  }

  /**
   * Send a message to all staff members
   */
  public async broadcastToStaff(event: string, data: any): Promise<void> {
    this.io.to('staff').emit(event, data);
  }

  /**
   * Get connected staff count
   */
  public getConnectedStaffCount(): number {
    return this.staffSockets.size;
  }

  /**
   * Get connected customer sessions
   */
  public getConnectedCustomerSessions(): string[] {
    return Array.from(this.customerSockets.keys());
  }
}
