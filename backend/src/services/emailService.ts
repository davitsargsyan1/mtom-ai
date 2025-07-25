import nodemailer from 'nodemailer';
import { config } from '../config/index.js';
import { ChatSession, ChatMessage } from '../types/index.js';

export interface EmailConfig {
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser: string;
  smtpPassword: string;
  fromEmail: string;
  fromName: string;
}

export interface EmailTemplate {
  subject: string;
  html: string;
  text?: string;
}

export interface TranscriptEmailData {
  customerEmail: string;
  customerName?: string;
  sessionId: string;
  transcript: string;
  summary?: string;
  duration?: string;
  staffName?: string;
}

export class EmailService {
  private transporter: nodemailer.Transporter | null = null;
  private emailConfig: EmailConfig | null = null;

  constructor() {
    this.initializeEmailConfig();
  }

  private initializeEmailConfig(): void {
    // Check if email configuration is available
    if (config.smtpHost && config.smtpUser && config.smtpPassword) {
      this.emailConfig = {
        smtpHost: config.smtpHost,
        smtpPort: config.smtpPort,
        smtpSecure: config.smtpSecure,
        smtpUser: config.smtpUser,
        smtpPassword: config.smtpPassword,
        fromEmail: config.fromEmail || config.smtpUser,
        fromName: config.fromName,
      };

      this.createTransporter();
    } else {
      console.warn(
        '⚠️ Email service not configured. Set SMTP_HOST, SMTP_USER, and SMTP_PASSWORD to enable email features.',
      );
    }
  }

  private createTransporter(): void {
    if (!this.emailConfig) return;

    this.transporter = nodemailer.createTransport({
      host: this.emailConfig.smtpHost,
      port: this.emailConfig.smtpPort,
      secure: this.emailConfig.smtpSecure,
      auth: {
        user: this.emailConfig.smtpUser,
        pass: this.emailConfig.smtpPassword,
      },
    });

    console.log('📧 Email service initialized with SMTP:', this.emailConfig.smtpHost);
  }

  /**
   * Check if email service is configured and ready
   */
  public isConfigured(): boolean {
    return this.transporter !== null && this.emailConfig !== null;
  }

  /**
   * Test email configuration
   */
  public async testConnection(): Promise<boolean> {
    if (!this.transporter) {
      console.log('❌ Email service not configured');
      return false;
    }

    try {
      await this.transporter.verify();
      console.log('✅ Email service connection verified');
      return true;
    } catch (error) {
      console.error('❌ Email service connection failed:', error);
      return false;
    }
  }

  /**
   * Send email transcript to customer
   */
  public async sendTranscript(data: TranscriptEmailData): Promise<boolean> {
    if (!this.isConfigured()) {
      console.log('📧 Email service not configured, skipping transcript email');
      return false;
    }

    try {
      const template = this.generateTranscriptTemplate(data);

      const mailOptions = {
        from: `${this.emailConfig!.fromName} <${this.emailConfig!.fromEmail}>`,
        to: data.customerEmail,
        subject: template.subject,
        html: template.html,
        text: template.text,
      };

      const result = await this.transporter!.sendMail(mailOptions);
      console.log('✅ Transcript email sent successfully:', result.messageId);
      return true;
    } catch (error) {
      console.error('❌ Failed to send transcript email:', error);
      return false;
    }
  }

  /**
   * Send email notification to staff
   */
  public async sendStaffNotification(
    staffEmail: string,
    subject: string,
    message: string,
    sessionId?: string,
  ): Promise<boolean> {
    if (!this.isConfigured()) {
      console.log('📧 Email service not configured, skipping staff notification');
      return false;
    }

    try {
      const template = this.generateStaffNotificationTemplate(subject, message, sessionId);

      const mailOptions = {
        from: `${this.emailConfig!.fromName} <${this.emailConfig!.fromEmail}>`,
        to: staffEmail,
        subject: template.subject,
        html: template.html,
        text: template.text,
      };

      const result = await this.transporter!.sendMail(mailOptions);
      console.log('✅ Staff notification email sent successfully:', result.messageId);
      return true;
    } catch (error) {
      console.error('❌ Failed to send staff notification:', error);
      return false;
    }
  }

  /**
   * Generate HTML transcript from chat session
   */
  public generateTranscript(session: ChatSession): string {
    const messages = session.messages || [];

    let transcript = '';
    messages.forEach(message => {
      const timestamp = new Date(message.timestamp).toLocaleString();
      const sender =
        message.role === 'user'
          ? 'Customer'
          : message.role === 'assistant'
          ? 'AI Assistant'
          : 'System';

      transcript += `[${timestamp}] ${sender}: ${message.content}\n`;
    });

    return transcript || 'No messages in this conversation.';
  }

  /**
   * Generate email template for transcript
   */
  private generateTranscriptTemplate(data: TranscriptEmailData): EmailTemplate {
    const subject = `Chat Transcript - Session ${data.sessionId.substring(0, 8)}`;

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Chat Transcript</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #3B82F6; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
        .content { background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; }
        .transcript { background: white; padding: 15px; border-radius: 6px; font-family: monospace; white-space: pre-line; }
        .footer { background: #f3f4f6; padding: 15px; border-radius: 0 0 8px 8px; text-align: center; font-size: 14px; color: #6b7280; }
        .meta { margin-bottom: 15px; padding: 10px; background: #eff6ff; border-radius: 6px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📋 Chat Transcript</h1>
            <p>Thank you for contacting our support team!</p>
        </div>
        
        <div class="content">
            ${data.customerName ? `<p><strong>Customer:</strong> ${data.customerName}</p>` : ''}
            <div class="meta">
                <p><strong>Session ID:</strong> ${data.sessionId}</p>
                ${data.duration ? `<p><strong>Duration:</strong> ${data.duration}</p>` : ''}
                ${data.staffName ? `<p><strong>Handled by:</strong> ${data.staffName}</p>` : ''}
                <p><strong>Date:</strong> ${new Date().toLocaleString()}</p>
            </div>
            
            ${
              data.summary
                ? `
            <div class="meta">
                <h3>Summary</h3>
                <p>${data.summary}</p>
            </div>
            `
                : ''
            }
            
            <h3>Conversation Transcript</h3>
            <div class="transcript">${data.transcript}</div>
        </div>
        
        <div class="footer">
            <p>This is an automated message from MTOM AI Support System.</p>
            <p>If you need further assistance, please contact us again.</p>
        </div>
    </div>
</body>
</html>`;

    const text = `
Chat Transcript - Session ${data.sessionId}

${data.customerName ? `Customer: ${data.customerName}` : ''}
Session ID: ${data.sessionId}
${data.duration ? `Duration: ${data.duration}` : ''}
${data.staffName ? `Handled by: ${data.staffName}` : ''}
Date: ${new Date().toLocaleString()}

${data.summary ? `Summary: ${data.summary}` : ''}

Conversation Transcript:
${data.transcript}

---
This is an automated message from MTOM AI Support System.
If you need further assistance, please contact us again.
`;

    return { subject, html, text };
  }

  /**
   * Generate email template for staff notifications
   */
  private generateStaffNotificationTemplate(
    subject: string,
    message: string,
    sessionId?: string,
  ): EmailTemplate {
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Staff Notification</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #059669; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
        .content { background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; border-radius: 0 0 8px 8px; }
        .message { background: white; padding: 15px; border-radius: 6px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🔔 Staff Notification</h1>
        </div>
        
        <div class="content">
            ${sessionId ? `<p><strong>Session ID:</strong> ${sessionId}</p>` : ''}
            <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
            
            <div class="message">
                ${message}
            </div>
        </div>
    </div>
</body>
</html>`;

    const text = `
Staff Notification: ${subject}

${sessionId ? `Session ID: ${sessionId}` : ''}
Time: ${new Date().toLocaleString()}

${message}
`;

    return { subject, html, text };
  }
}
