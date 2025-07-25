import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const configSchema = z.object({
  port: z.coerce.number().default(8000),
  nodeEnv: z.enum(['development', 'production', 'test']).default('development'),

  // AI Configuration
  openRouterApiKey: z.string().min(1, 'OpenRouter API key is required'),
  openRouterModel: z.string().default('openai/gpt-3.5-turbo'),
  customSystemPrompt: z.string().optional(),

  // Vector Database
  pineconeApiKey: z.string().min(1, 'Pinecone API key is required'),
  pineconeEnvironment: z.string().min(1, 'Pinecone environment is required'),
  pineconeIndexName: z.string().default('chatbot-knowledge-base'),

  // Security
  sessionSecret: z.string().min(32, 'Session secret must be at least 32 characters'),

  // CORS
  allowedOrigins: z.string().default('http://localhost:3000,http://localhost:8000'),

  // Rate Limiting
  rateLimitWindowMs: z.coerce.number().default(15 * 60 * 1000), // 15 minutes
  rateLimitMaxRequests: z.coerce.number().default(100),

  // Email Configuration (optional)
  smtpHost: z.string().optional(),
  smtpPort: z.coerce.number().default(587),
  smtpSecure: z.boolean().default(false),
  smtpUser: z.string().optional(),
  smtpPassword: z.string().optional(),
  fromEmail: z.string().optional(),
  fromName: z.string().default('MTOM AI Support'),
});

const rawConfig = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: process.env.PORT || '8000',
  openRouterApiKey: process.env.OPENROUTER_API_KEY,
  pineconeApiKey: process.env.PINECONE_API_KEY,
  pineconeEnvironment: process.env.PINECONE_ENVIRONMENT,
  sessionSecret: process.env.SESSION_SECRET,
  allowedOrigins: process.env.ALLOWED_ORIGINS,
  rateLimitWindowMs: process.env.RATE_LIMIT_WINDOW_MS,
  rateLimitMaxRequests: process.env.RATE_LIMIT_MAX_REQUESTS,
  customSystemPrompt: process.env.CUSTOM_SYSTEM_PROMPT,

  // Email configuration
  smtpHost: process.env.SMTP_HOST,
  smtpPort: process.env.SMTP_PORT,
  smtpSecure: process.env.SMTP_SECURE === 'true',
  smtpUser: process.env.SMTP_USER,
  smtpPassword: process.env.SMTP_PASSWORD,
  fromEmail: process.env.FROM_EMAIL,
  fromName: process.env.FROM_NAME,
};

export const config = configSchema.parse(rawConfig);
