import { Pinecone } from '@pinecone-database/pinecone';
import { config } from '../config/index.js';
import { KnowledgeBaseEntry } from '../types/index.js';
import { AIService } from './aiService.js';

export class KnowledgeBaseService {
  private pinecone: Pinecone;
  private aiService: AIService;
  private indexName: string;

  constructor() {
    this.pinecone = new Pinecone({
      apiKey: config.pineconeApiKey,
      environment: config.pineconeEnvironment,
    });
    this.aiService = new AIService();
    this.indexName = config.pineconeIndexName;
  }

  /**
   * Initialize the knowledge base index
   */
  async initialize(): Promise<void> {
    try {
      const existingIndexes = await this.pinecone.listIndexes();
      const indexExists = existingIndexes.some(index => index.name === this.indexName);

      if (!indexExists) {
        console.log(`Creating Pinecone index: ${this.indexName}`);
        await this.pinecone.createIndex({
          name: this.indexName,
          dimension: 1536, // OpenAI embedding dimension
          metric: 'cosine',
        });

        // Wait for index to be ready
        await this.waitForIndexReady();
      }
    } catch (error) {
      console.error('Failed to initialize knowledge base:', error);
      console.warn('⚠️  Running without vector database - knowledge base features disabled');
      // Don't throw error in development mode to allow testing
      if (process.env.NODE_ENV === 'production') {
        throw new Error('Knowledge base initialization failed');
      }
    }
  }

  /**
   * Add or update an entry in the knowledge base
   */
  async upsertEntry(entry: Omit<KnowledgeBaseEntry, 'embedding'>): Promise<void> {
    try {
      const embedding = await this.aiService.generateEmbedding(entry.content);
      const index = this.pinecone.index(this.indexName);

      await index.upsert([
        {
          id: entry.id,
          values: embedding,
          metadata: {
            title: entry.title,
            content: entry.content,
            category: entry.category,
            lastUpdated: entry.lastUpdated.toISOString(),
            ...entry.metadata,
          },
        },
      ]);
    } catch (error) {
      console.error('Failed to upsert knowledge base entry:', error);
      throw new Error('Failed to update knowledge base');
    }
  }

  /**
   * Search the knowledge base for relevant entries
   */
  async search(query: string, limit: number = 5, category?: string): Promise<KnowledgeBaseEntry[]> {
    try {
      const queryEmbedding = await this.aiService.generateEmbedding(query);
      const index = this.pinecone.index(this.indexName);

      const searchRequest: any = {
        vector: queryEmbedding,
        topK: limit,
        includeMetadata: true,
      };

      if (category) {
        searchRequest.filter = { category };
      }

      const searchResults = await index.query(searchRequest);

      return (
        searchResults.matches?.map(match => ({
          id: match.id || '',
          content: (match.metadata?.content as string) || '',
          title: (match.metadata?.title as string) || '',
          category: (match.metadata?.category as string) || '',
          metadata: match.metadata || {},
          lastUpdated: new Date((match.metadata?.lastUpdated as string) || Date.now()),
          embedding: match.values,
        })) || []
      );
    } catch (error) {
      console.error('Knowledge base search error:', error);
      throw new Error('Failed to search knowledge base');
    }
  }

  /**
   * Delete an entry from the knowledge base
   */
  async deleteEntry(id: string): Promise<void> {
    try {
      const index = this.pinecone.index(this.indexName);
      await index.deleteOne(id);
    } catch (error) {
      console.error('Failed to delete knowledge base entry:', error);
      throw new Error('Failed to delete entry');
    }
  }

  /**
   * Get relevant context for a chat query
   */
  async getRelevantContext(query: string, conversationHistory: string[] = []): Promise<string[]> {
    try {
      // Combine query with recent conversation context
      const enhancedQuery = [query, ...conversationHistory.slice(-3)].join(' ');
      const entries = await this.search(enhancedQuery, 3);

      return entries.map(entry => `${entry.title}:\n${entry.content}`);
    } catch (error) {
      console.error('Failed to get relevant context:', error);
      return []; // Return empty array on error to not break chat flow
    }
  }

  /**
   * Wait for Pinecone index to be ready
   */
  private async waitForIndexReady(): Promise<void> {
    const maxAttempts = 30;
    let attempts = 0;

    while (attempts < maxAttempts) {
      try {
        const indexStats = await this.pinecone.index(this.indexName).describeIndexStats();
        if (indexStats) {
          console.log('Index is ready');
          return;
        }
      } catch (error) {
        // Index not ready yet
      }

      await new Promise(resolve => setTimeout(resolve, 2000));
      attempts++;
    }

    throw new Error('Timeout waiting for index to be ready');
  }

  /**
   * Populate knowledge base with sample data
   */
  async populateSampleData(): Promise<void> {
    const sampleEntries: Omit<KnowledgeBaseEntry, 'embedding'>[] = [
      {
        id: 'sample-1',
        title: 'Account Setup',
        content:
          'To set up your account, visit our signup page and provide your email address. You will receive a confirmation email with activation instructions.',
        category: 'account',
        metadata: { difficulty: 'easy' },
        lastUpdated: new Date(),
      },
      {
        id: 'sample-2',
        title: 'Password Reset',
        content:
          'If you forgot your password, click the "Forgot Password" link on the login page. Enter your email address and follow the instructions in the reset email.',
        category: 'account',
        metadata: { difficulty: 'easy' },
        lastUpdated: new Date(),
      },
      {
        id: 'sample-3',
        title: 'Billing Issues',
        content:
          'For billing inquiries, please contact our billing department at billing@company.com or call 1-800-BILLING. Have your account number ready.',
        category: 'billing',
        metadata: { difficulty: 'medium' },
        lastUpdated: new Date(),
      },
    ];

    try {
      for (const entry of sampleEntries) {
        await this.upsertEntry(entry);
      }
      console.log('Sample knowledge base data populated');
    } catch (error) {
      console.warn('⚠️  Failed to populate sample data - knowledge base features may be limited');
      console.error('Sample data error:', error);
    }
  }
}
