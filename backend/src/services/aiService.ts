import OpenAI from 'openai';
import { config } from '../config/index.js';
import { ChatMessage, AIResponse, CustomerInfo } from '../types/index.js';

export class AIService {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey: config.openRouterApiKey,
    });
  }

  /**
   * Generate AI response for customer support chat
   */
  async generateResponse(
    messages: ChatMessage[],
    customerInfo?: CustomerInfo,
    knowledgeContext?: string[],
  ): Promise<AIResponse> {
    const startTime = Date.now();

    try {
      const systemPrompt = this.buildSystemPrompt(customerInfo, knowledgeContext);
      const conversationHistory = this.formatMessagesForAI(messages);

      const completion = await this.openai.chat.completions.create({
        model: config.openRouterModel,
        messages: [{ role: 'system', content: systemPrompt }, ...conversationHistory],
        temperature: 0.7,
        max_tokens: 500,
        stream: false,
      });

      const responseTime = Date.now() - startTime;
      const content = completion.choices[0]?.message?.content || '';
      const tokensUsed = completion.usage?.total_tokens || 0;

      return {
        content,
        confidence: this.calculateConfidence(completion),
        metadata: {
          model: config.openRouterModel,
          tokensUsed,
          responseTime,
        },
      };
    } catch (error) {
      console.error('AI service error:', error);
      throw new Error('Failed to generate AI response');
    }
  }

  /**
   * Build system prompt with context and guidelines
   */
  private buildSystemPrompt(customerInfo?: CustomerInfo, knowledgeContext?: string[]): string {
    // Use custom system prompt from environment if provided
    let prompt =
      config.customSystemPrompt ||
      `You are a helpful customer support assistant for MTOM AI. You should:

CORE GUIDELINES:
- Be professional, friendly, and empathetic
- Provide accurate and helpful information
- Ask clarifying questions when needed
- Escalate complex issues when appropriate
- Keep responses concise but complete
- Always maintain a helpful and solution-oriented attitude

COMPANY INFORMATION:
- Company: MTOM AI
- Product: Smart Customer Support Chatbot Platform
- Services: AI-powered customer support solutions, chatbot development, knowledge base management

COMMON TOPICS TO HELP WITH:
- Account setup and management
- Password reset procedures
- Billing and subscription questions
- Technical support for the chatbot platform
- Feature explanations and tutorials
- Integration assistance

ESCALATION TRIGGERS:
- Complex technical issues requiring engineering team
- Billing disputes or refund requests
- Security-related concerns
- Legal or compliance questions
- Custom development requests

RESPONSE STYLE:
- Start with a friendly greeting for new conversations
- Use clear, non-technical language unless technical details are requested
- Provide step-by-step instructions when applicable
- Offer alternative solutions when possible
- End with asking if there's anything else you can help with`;

    prompt += '\n\n';

    if (customerInfo) {
      prompt += `CUSTOMER CONTEXT:
- Name: ${customerInfo.name || 'Not provided'}
- Email: ${customerInfo.email || 'Not provided'}
- Company: ${customerInfo.company || 'Not provided'}
- Account ID: ${customerInfo.userId || 'Not provided'}

Personalize your responses using this information when appropriate.

`;
    }

    if (knowledgeContext && knowledgeContext.length > 0) {
      prompt += `RELEVANT DOCUMENTATION:
${knowledgeContext.join('\n\n')}

Please use this documentation to provide accurate answers. If the information isn't in the documentation, clearly state that and offer to help find the right resource or escalate to a specialist.

`;
    }

    prompt += `Remember: Always be helpful, accurate, and professional. If you're unsure about something, it's better to say you don't know and offer to connect them with someone who can help.`;

    return prompt;
  }

  /**
   * Format chat messages for OpenAI API
   */
  private formatMessagesForAI(messages: ChatMessage[]) {
    return messages
      .filter(msg => msg.role !== 'system')
      .slice(-10) // Keep last 10 messages for context
      .map(msg => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      }));
  }

  /**
   * Calculate confidence score based on AI response
   */
  private calculateConfidence(completion: any): number {
    // TODO: Implement more sophisticated confidence calculation
    // For now, return a basic score based on response length and finish reason
    const finishReason = completion.choices[0]?.finish_reason;
    const contentLength = completion.choices[0]?.message?.content?.length || 0;

    if (finishReason === 'stop' && contentLength > 50) {
      return 0.8;
    } else if (finishReason === 'stop') {
      return 0.6;
    } else {
      return 0.4;
    }
  }

  /**
   * Generate embeddings for text (used for knowledge base)
   */
  async generateEmbedding(text: string): Promise<number[]> {
    try {
      const response = await this.openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: text,
      });

      return response.data[0].embedding;
    } catch (error) {
      console.error('Embedding generation error:', error);
      throw new Error('Failed to generate embedding');
    }
  }
}
