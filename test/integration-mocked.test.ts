/**
 * Integration tests with mocked external dependencies
 * 
 * These tests verify that the system works correctly when integrated
 * with mocked versions of S3, LLM APIs, Redis, and PostgreSQL.
 */

import { 
  MockS3Client,
  MockLLMClient,
  MockRedisClient,
  MockPgPool,
  MockQueue,
  createMockEpisode,
  createMockJob,
  createMockAsset,
} from './mocks/external-services';
import { v4 as uuidv4 } from 'uuid';

describe('External Service Mocks', () => {
  describe('S3 Storage Mock', () => {
    let s3: MockS3Client;

    beforeEach(() => {
      s3 = new MockS3Client({
        endpoint: 'http://localhost:9000',
        bucket: 'test-bucket'
      });
    });

    it('should store and retrieve objects', async () => {
      const key = 'episodes/test/script.json';
      const content = JSON.stringify({ scenes: [] });

      await s3.putObject({
        Bucket: 'test-bucket',
        Key: key,
        Body: content,
        ContentType: 'application/json'
      });

      const retrieved = await s3.getObject({
        Bucket: 'test-bucket',
        Key: key
      });

      expect(retrieved.Body.toString()).toBe(content);
      expect(retrieved.ContentType).toBe('application/json');
    });

    it('should throw error for non-existent key', async () => {
      await expect(s3.getObject({
        Bucket: 'test-bucket',
        Key: 'non-existent'
      })).rejects.toThrow('NoSuchKey');
    });

    it('should list objects with prefix', async () => {
      await s3.putObject({
        Bucket: 'test-bucket',
        Key: 'episodes/1/script.json',
        Body: '{}'
      });
      await s3.putObject({
        Bucket: 'test-bucket',
        Key: 'episodes/1/video.mp4',
        Body: Buffer.alloc(1024)
      });
      await s3.putObject({
        Bucket: 'test-bucket',
        Key: 'episodes/2/script.json',
        Body: '{}'
      });

      const list = await s3.listObjects({
        Bucket: 'test-bucket',
        Prefix: 'episodes/1/'
      });

      expect(list.Contents).toHaveLength(2);
    });

    it('should delete objects', async () => {
      const key = 'to-delete.json';
      await s3.putObject({
        Bucket: 'test-bucket',
        Key: key,
        Body: '{}'
      });

      expect(await s3.headObject({
        Bucket: 'test-bucket',
        Key: key
      })).toBeDefined();

      await s3.deleteObject({
        Bucket: 'test-bucket',
        Key: key
      });

      await expect(s3.getObject({
        Bucket: 'test-bucket',
        Key: key
      })).rejects.toThrow();
    });
  });

  describe('LLM Client Mock', () => {
    let llm: MockLLMClient;

    beforeEach(() => {
      llm = new MockLLMClient({ responseDelay: 10 });
    });

    it('should generate script response', async () => {
      const response = await llm.createChatCompletion({
        model: 'gpt-4',
        messages: [
          { role: 'system', content: 'You are a script writer' },
          { role: 'user', content: 'Write a script about adventure' }
        ]
      });

      expect(response.choices[0].message.content).toContain('scenes');
      expect(response.usage.total_tokens).toBeGreaterThan(0);
    });

    it('should generate storyboard response', async () => {
      const response = await llm.createChatCompletion({
        model: 'gpt-4',
        messages: [
          { role: 'user', content: 'Create visual storyboard for scene' }
        ]
      });

      expect(response.choices[0].message.content).toContain('shots');
    });

    it('should support custom responses', async () => {
      llm.setCustomResponse(/custom/, {
        id: 'custom-id',
        object: 'chat.completion',
        created: Date.now(),
        model: 'gpt-4',
        choices: [{
          index: 0,
          message: { role: 'assistant', content: 'Custom response' },
          finish_reason: 'stop'
        }],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 }
      });

      const response = await llm.createChatCompletion({
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'custom prompt' }]
      });

      expect(response.choices[0].message.content).toBe('Custom response');
    });

    it('should simulate errors', async () => {
      llm = new MockLLMClient({ errorRate: 1.0 });

      await expect(llm.createChatCompletion({
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'test' }]
      })).rejects.toThrow('Rate limit exceeded');
    });

    it('should respect response delay', async () => {
      llm = new MockLLMClient({ responseDelay: 100 });

      const start = Date.now();
      await llm.createChatCompletion({
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'test' }]
      });
      const duration = Date.now() - start;

      expect(duration).toBeGreaterThanOrEqual(100);
    });
  });

  describe('Redis Mock', () => {
    let redis: MockRedisClient;

    beforeEach(() => {
      redis = new MockRedisClient();
    });

    it('should store and retrieve values', async () => {
      await redis.set('key', 'value');
      const value = await redis.get('key');
      expect(value).toBe('value');
    });

    it('should return null for missing keys', async () => {
      const value = await redis.get('missing');
      expect(value).toBeNull();
    });

    it('should support TTL', async () => {
      await redis.set('temp', 'value', { EX: 1 });
      expect(await redis.get('temp')).toBe('value');

      // Wait for expiration
      await new Promise(r => setTimeout(r, 1100));
      expect(await redis.get('temp')).toBeNull();
    });

    it('should support pattern matching for keys', async () => {
      await redis.set('user:1', 'alice');
      await redis.set('user:2', 'bob');
      await redis.set('session:1', 'active');

      const keys = await redis.keys('user:*');
      expect(keys).toHaveLength(2);
      expect(keys).toContain('user:1');
      expect(keys).toContain('user:2');
    });

    it('should handle disconnection', async () => {
      await redis.set('key', 'value');
      redis.simulateDisconnect();

      await expect(redis.get('key')).rejects.toThrow('Not connected');
    });

    it('should support reconnection', async () => {
      redis.simulateDisconnect();
      redis.simulateReconnect();

      await redis.set('key', 'value');
      expect(await redis.get('key')).toBe('value');
    });
  });

  describe('PostgreSQL Mock', () => {
    let pg: MockPgPool;

    beforeEach(() => {
      pg = new MockPgPool();
    });

    it('should register and execute query handlers', async () => {
      pg.registerQuery(/SELECT \* FROM episodes/, () => ({
        rows: [
          { id: '1', title: 'Episode 1' },
          { id: '2', title: 'Episode 2' }
        ],
        rowCount: 2,
        command: 'SELECT'
      }));

      const result = await pg.query('SELECT * FROM episodes');
      expect(result.rows).toHaveLength(2);
    });

    it('should handle parameterized queries', async () => {
      pg.registerQuery(/INSERT INTO episodes/, (params) => ({
        rows: [{ id: params[0], title: params[1] }],
        rowCount: 1,
        command: 'INSERT'
      }));

      const result = await pg.query(
        'INSERT INTO episodes (id, title) VALUES ($1, $2)',
        ['abc', 'Test Episode']
      );

      expect(result.rows[0].title).toBe('Test Episode');
    });

    it('should use default handler for unmatched queries', async () => {
      pg.setDefaultHandler(() => ({
        rows: [{ message: 'default' }],
        rowCount: 1,
        command: 'SELECT'
      }));

      const result = await pg.query('UNKNOWN QUERY');
      expect(result.rows[0].message).toBe('default');
    });

    it('should track connection count', async () => {
      expect(pg.getConnectionCount()).toBe(0);
      
      await pg.query('SELECT 1');
      await pg.query('SELECT 2');
      
      expect(pg.getConnectionCount()).toBe(2);
    });
  });

  describe('BullMQ Mock', () => {
    let queue: MockQueue;

    beforeEach(() => {
      queue = new MockQueue('test-queue');
    });

    it('should add jobs', async () => {
      const job = await queue.add('test-job', { data: 'value' });
      
      expect(job.name).toBe('test-job');
      expect(job.data).toEqual({ data: 'value' });
    });

    it('should retrieve jobs by id', async () => {
      const job = await queue.add('test-job', {}, { jobId: 'custom-id' });
      const retrieved = await queue.getJob('custom-id');
      
      expect(retrieved?.id).toBe('custom-id');
    });

    it('should track job count', async () => {
      await queue.add('job1', {});
      await queue.add('job2', {});
      await queue.add('job3', {});
      
      expect(queue.getJobCount()).toBe(3);
    });

    it('should remove jobs', async () => {
      await queue.add('job', {}, { jobId: 'to-remove' });
      await queue.remove('to-remove');
      
      expect(await queue.getJob('to-remove')).toBeUndefined();
    });
  });

  describe('Mock Data Helpers', () => {
    it('should create mock episodes', () => {
      const episode = createMockEpisode({
        title: 'Custom Title',
        status: 'completed'
      });

      expect(episode.id).toBeDefined();
      expect(episode.title).toBe('Custom Title');
      expect(episode.status).toBe('completed');
    });

    it('should create mock jobs', () => {
      const job = createMockJob({
        stage: 'render',
        status: 'processing'
      });

      expect(job.id).toBeDefined();
      expect(job.stage).toBe('render');
    });

    it('should create mock assets', () => {
      const asset = createMockAsset({
        type: 'video',
        uri: 'custom/uri.mp4'
      });

      expect(asset.type).toBe('video');
      expect(asset.uri).toBe('custom/uri.mp4');
    });
  });
});

/**
 * Example integration test using all mocks together
 */
describe('Full Pipeline Integration (Mocked)', () => {
  let s3: MockS3Client;
  let llm: MockLLMClient;
  let redis: MockRedisClient;
  let pg: MockPgPool;
  let queue: MockQueue;

  beforeEach(() => {
    s3 = new MockS3Client({ endpoint: 'http://localhost:9000', bucket: 'test' });
    llm = new MockLLMClient({ responseDelay: 10 });
    redis = new MockRedisClient();
    pg = new MockPgPool();
    queue = new MockQueue('script-generation');

    // Setup database mocks
    const episodes = new Map();
    pg.registerQuery(/INSERT INTO episodes/, (params) => {
      const episode = {
        id: params[0],
        title: params[1],
        premise: params[2],
        status: params[3],
        target_duration: params[4]
      };
      episodes.set(params[0], episode);
      return { rows: [episode], rowCount: 1, command: 'INSERT' };
    });

    pg.registerQuery(/SELECT \* FROM episodes WHERE id/, (params) => {
      const episode = episodes.get(params[0]);
      return { rows: episode ? [episode] : [], rowCount: episode ? 1 : 0, command: 'SELECT' };
    });
  });

  it('should simulate full episode creation flow', async () => {
    // Step 1: Create episode in database
    const episodeId = uuidv4();
    await pg.query(
      'INSERT INTO episodes (id, title, premise, status, target_duration) VALUES ($1, $2, $3, $4, $5)',
      [episodeId, 'Test Episode', 'A test premise', 'pending', 30]
    );

    // Step 2: Queue script generation job
    await queue.add('generate-script', {
      episodeId,
      premise: 'A test premise'
    });

    // Step 3: Simulate LLM generating script
    const scriptResponse = await llm.createChatCompletion({
      model: 'gpt-4',
      messages: [{ role: 'user', content: 'Write a script' }]
    });

    // Step 4: Store generated script in S3
    await s3.putObject({
      Bucket: 'test',
      Key: `episodes/${episodeId}/script.json`,
      Body: scriptResponse.choices[0].message.content,
      ContentType: 'application/json'
    });

    // Step 5: Cache status in Redis
    await redis.set(`episode:${episodeId}:status`, 'script_generated', { EX: 3600 });

    // Step 6: Verify episode exists
    const episodeResult = await pg.query(
      'SELECT * FROM episodes WHERE id = $1',
      [episodeId]
    );

    // Verify all components worked together
    expect(episodeResult.rows).toHaveLength(1);
    expect(episodeResult.rows[0].title).toBe('Test Episode');
    expect(queue.getJobCount()).toBe(1);
    expect(s3.getStorageSize()).toBe(1);
    expect(await redis.get(`episode:${episodeId}:status`)).toBe('script_generated');
  });
});
