/**
 * Mock utilities for external dependencies
 * 
 * These mocks help isolate tests from external services:
 * - S3/MinIO storage
 * - LLM APIs (OpenAI)
 * - Redis
 * - PostgreSQL
 */

import { v4 as uuidv4 } from 'uuid';

// ============================================================================
// S3/MinIO Storage Mocks
// ============================================================================

export interface MockS3Object {
  key: string;
  body: Buffer | string;
  contentType: string;
  metadata: Record<string, string>;
  createdAt: Date;
}

export class MockS3Client {
  private storage: Map<string, MockS3Object> = new Map();
  private endpoint: string;
  private bucket: string;

  constructor(config: { endpoint: string; bucket: string }) {
    this.endpoint = config.endpoint;
    this.bucket = config.bucket;
  }

  async putObject(params: {
    Bucket: string;
    Key: string;
    Body: Buffer | string;
    ContentType?: string;
    Metadata?: Record<string, string>;
  }): Promise<{ ETag: string }> {
    const key = `${this.bucket}/${params.Key}`;
    this.storage.set(key, {
      key: params.Key,
      body: params.Body,
      contentType: params.ContentType || 'application/octet-stream',
      metadata: params.Metadata || {},
      createdAt: new Date(),
    });
    return { ETag: `"${uuidv4()}"` };
  }

  async getObject(params: { Bucket: string; Key: string }): Promise<{
    Body: Buffer;
    ContentType: string;
    Metadata: Record<string, string>;
  }> {
    const key = `${this.bucket}/${params.Key}`;
    const obj = this.storage.get(key);
    
    if (!obj) {
      const error = new Error('NoSuchKey: The specified key does not exist.');
      (error as any).code = 'NoSuchKey';
      throw error;
    }

    return {
      Body: Buffer.isBuffer(obj.body) ? obj.body : Buffer.from(obj.body),
      ContentType: obj.contentType,
      Metadata: obj.metadata,
    };
  }

  async deleteObject(params: { Bucket: string; Key: string }): Promise<void> {
    const key = `${this.bucket}/${params.Key}`;
    this.storage.delete(key);
  }

  async listObjects(params: { Bucket: string; Prefix?: string }): Promise<{
    Contents: Array<{ Key: string; Size: number; LastModified: Date }>;
  }> {
    const prefix = params.Prefix || '';
    const contents: Array<{ Key: string; Size: number; LastModified: Date }> = [];

    for (const [key, obj] of this.storage.entries()) {
      if (key.startsWith(`${this.bucket}/${prefix}`)) {
        contents.push({
          Key: obj.key,
          Size: Buffer.isBuffer(obj.body) ? obj.body.length : obj.body.length,
          LastModified: obj.createdAt,
        });
      }
    }

    return { Contents: contents };
  }

  async headObject(params: { Bucket: string; Key: string }): Promise<{
    ContentType: string;
    ContentLength: number;
    Metadata: Record<string, string>;
  }> {
    const key = `${this.bucket}/${params.Key}`;
    const obj = this.storage.get(key);

    if (!obj) {
      const error = new Error('NotFound');
      (error as any).code = 'NotFound';
      throw error;
    }

    return {
      ContentType: obj.contentType,
      ContentLength: Buffer.isBuffer(obj.body) ? obj.body.length : obj.body.length,
      Metadata: obj.metadata,
    };
  }

  clear(): void {
    this.storage.clear();
  }

  getStorageSize(): number {
    return this.storage.size;
  }

  getAllKeys(): string[] {
    return Array.from(this.storage.keys()).map(k => k.replace(`${this.bucket}/`, ''));
  }
}

// ============================================================================
// LLM API Mocks (OpenAI)
// ============================================================================

export interface MockLLMResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export class MockLLMClient {
  private responseDelay: number;
  private errorRate: number;
  private customResponses: Map<string, MockLLMResponse> = new Map();

  constructor(options: { responseDelay?: number; errorRate?: number } = {}) {
    this.responseDelay = options.responseDelay || 100;
    this.errorRate = options.errorRate || 0;
  }

  setCustomResponse(promptPattern: string | RegExp, response: MockLLMResponse): void {
    this.customResponses.set(promptPattern.toString(), response);
  }

  async createChatCompletion(params: {
    model: string;
    messages: Array<{ role: string; content: string }>;
    temperature?: number;
    max_tokens?: number;
  }): Promise<MockLLMResponse> {
    // Simulate network delay
    await new Promise(r => setTimeout(r, this.responseDelay));

    // Simulate random errors
    if (Math.random() < this.errorRate) {
      throw new Error('OpenAI API Error: Rate limit exceeded');
    }

    const lastMessage = params.messages[params.messages.length - 1]?.content || '';

    // Check for custom responses
    for (const [pattern, response] of this.customResponses.entries()) {
      const regex = new RegExp(pattern.slice(1, -1));
      if (regex.test(lastMessage)) {
        return { ...response };
      }
    }

    // Generate default response based on content type
    const content = this.generateMockResponse(lastMessage, params.model);

    return {
      id: `chatcmpl-${uuidv4()}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: params.model,
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content,
          },
          finish_reason: 'stop',
        },
      ],
      usage: {
        prompt_tokens: this.estimateTokens(lastMessage),
        completion_tokens: this.estimateTokens(content),
        total_tokens: this.estimateTokens(lastMessage) + this.estimateTokens(content),
      },
    };
  }

  private generateMockResponse(prompt: string, model: string): string {
    // Detect content type and generate appropriate mock
    if (prompt.toLowerCase().includes('script') || prompt.toLowerCase().includes('story')) {
      return JSON.stringify({
        scenes: [
          {
            scene_number: 1,
            description: 'Opening scene with main character',
            dialogue: [
              { character: 'Alice', line: 'Hello, this is a test response.' }
            ],
            duration: 10
          },
          {
            scene_number: 2,
            description: 'Climax of the story',
            dialogue: [
              { character: 'Bob', line: 'What an unexpected turn!' }
            ],
            duration: 15
          }
        ],
        total_duration: 25
      });
    }

    if (prompt.toLowerCase().includes('visual') || prompt.toLowerCase().includes('storyboard')) {
      return JSON.stringify({
        shots: [
          {
            shot_number: 1,
            description: 'Wide shot of city skyline at sunset',
            camera_angle: 'wide',
            lighting: 'golden hour',
            duration: 5
          },
          {
            shot_number: 2,
            description: 'Close-up of character face',
            camera_angle: 'close-up',
            lighting: 'soft',
            duration: 3
          }
        ],
        total_shots: 2
      });
    }

    return 'This is a default mock response from the LLM.';
  }

  private estimateTokens(text: string): number {
    // Rough estimate: ~4 characters per token
    return Math.ceil(text.length / 4);
  }
}

// ============================================================================
// Redis Mocks
// ============================================================================

export class MockRedisClient {
  private storage: Map<string, { value: string; expiresAt?: number }> = new Map();
  private connected = true;

  async connect(): Promise<void> {
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
  }

  async ping(): Promise<string> {
    if (!this.connected) throw new Error('Connection refused');
    return 'PONG';
  }

  async get(key: string): Promise<string | null> {
    if (!this.connected) throw new Error('Not connected');
    
    const item = this.storage.get(key);
    if (!item) return null;
    
    if (item.expiresAt && item.expiresAt < Date.now()) {
      this.storage.delete(key);
      return null;
    }
    
    return item.value;
  }

  async set(key: string, value: string, options?: { EX?: number }): Promise<void> {
    if (!this.connected) throw new Error('Not connected');
    
    this.storage.set(key, {
      value,
      expiresAt: options?.EX ? Date.now() + options.EX * 1000 : undefined,
    });
  }

  async del(key: string): Promise<number> {
    if (!this.connected) throw new Error('Not connected');
    return this.storage.delete(key) ? 1 : 0;
  }

  async exists(key: string): Promise<number> {
    if (!this.connected) throw new Error('Not connected');
    return this.storage.has(key) ? 1 : 0;
  }

  async expire(key: string, seconds: number): Promise<number> {
    if (!this.connected) throw new Error('Not connected');
    
    const item = this.storage.get(key);
    if (!item) return 0;
    
    item.expiresAt = Date.now() + seconds * 1000;
    return 1;
  }

  async keys(pattern: string): Promise<string[]> {
    if (!this.connected) throw new Error('Not connected');
    
    const regex = new RegExp(pattern.replace('*', '.*'));
    return Array.from(this.storage.keys()).filter(k => regex.test(k));
  }

  async flushAll(): Promise<void> {
    this.storage.clear();
  }

  getStorageSize(): number {
    return this.storage.size;
  }

  simulateDisconnect(): void {
    this.connected = false;
  }

  simulateReconnect(): void {
    this.connected = true;
  }
}

// ============================================================================
// PostgreSQL Mocks
// ============================================================================

export interface MockQueryResult {
  rows: any[];
  rowCount: number;
  command: string;
}

export class MockPgPool {
  private queryHandlers: Array<{
    pattern: RegExp;
    handler: (params: any[]) => MockQueryResult | Promise<MockQueryResult>;
  }> = [];
  private defaultHandler?: (sql: string, params: any[]) => MockQueryResult;
  private connectionCount = 0;

  async query(sql: string, params?: any[]): Promise<MockQueryResult> {
    this.connectionCount++;

    // Check for registered handlers
    for (const { pattern, handler } of this.queryHandlers) {
      if (pattern.test(sql)) {
        const result = await handler(params || []);
        return result;
      }
    }

    // Use default handler if set
    if (this.defaultHandler) {
      return this.defaultHandler(sql, params || []);
    }

    // Default empty result
    return { rows: [], rowCount: 0, command: 'SELECT' };
  }

  async end(): Promise<void> {
    // Cleanup
  }

  on(): void {
    // Event handler stub
  }

  registerQuery(pattern: string | RegExp, handler: (params: any[]) => MockQueryResult): void {
    const regex = typeof pattern === 'string' ? new RegExp(pattern, 'i') : pattern;
    this.queryHandlers.push({ pattern: regex, handler });
  }

  setDefaultHandler(handler: (sql: string, params: any[]) => MockQueryResult): void {
    this.defaultHandler = handler;
  }

  clearHandlers(): void {
    this.queryHandlers = [];
    this.defaultHandler = undefined;
  }

  getConnectionCount(): number {
    return this.connectionCount;
  }
}

// ============================================================================
// BullMQ Mocks
// ============================================================================

export interface MockJob {
  id: string;
  name: string;
  data: any;
  opts: any;
  progress: number;
}

export class MockQueue {
  private jobs: Map<string, MockJob> = new Map();
  private eventHandlers: Map<string, Function[]> = new Map();
  private processingDelay = 0;

  constructor(public readonly name: string) {}

  async add(name: string, data: any, opts?: any): Promise<MockJob> {
    const id = opts?.jobId || `job-${uuidv4()}`;
    const job: MockJob = {
      id,
      name,
      data,
      opts: opts || {},
      progress: 0,
    };

    this.jobs.set(id, job);

    // Simulate async processing
    if (this.processingDelay > 0) {
      setTimeout(() => this.processJob(id), this.processingDelay);
    }

    return job;
  }

  async getJob(id: string): Promise<MockJob | undefined> {
    return this.jobs.get(id);
  }

  async remove(id: string): Promise<void> {
    this.jobs.delete(id);
  }

  async getJobs(types: string[], start = 0, end = 100): Promise<MockJob[]> {
    return Array.from(this.jobs.values()).slice(start, end);
  }

  on(event: string, handler: Function): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event)!.push(handler);
  }

  setProcessingDelay(ms: number): void {
    this.processingDelay = ms;
  }

  private processJob(id: string): void {
    const job = this.jobs.get(id);
    if (!job) return;

    job.progress = 100;
    const handlers = this.eventHandlers.get('completed') || [];
    handlers.forEach(h => h(job));
  }

  getJobCount(): number {
    return this.jobs.size;
  }

  clear(): void {
    this.jobs.clear();
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

export function createMockEpisode(overrides?: Partial<any>): any {
  return {
    id: uuidv4(),
    title: 'Test Episode',
    premise: 'A test premise',
    status: 'pending',
    target_duration: 30,
    created_at: new Date().toISOString(),
    completed_at: null,
    ...overrides,
  };
}

export function createMockJob(overrides?: Partial<any>): any {
  return {
    id: uuidv4(),
    episode_id: uuidv4(),
    stage: 'script',
    status: 'pending',
    input_data: {},
    output_data: null,
    error_message: null,
    attempts: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

export function createMockAsset(overrides?: Partial<any>): any {
  return {
    id: uuidv4(),
    episode_id: uuidv4(),
    type: 'script',
    uri: `episodes/test/${uuidv4()}.json`,
    metadata: {},
    created_at: new Date().toISOString(),
    ...overrides,
  };
}
