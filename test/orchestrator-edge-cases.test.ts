import { 
  createEpisode, 
  getEpisodeStatus, 
  listEpisodes, 
  progressToNextStage,
  pg,
  redis
} from '../src/orchestrator';
import { v4 as uuidv4 } from 'uuid';

// Mock dependencies
jest.mock('../src/config', () => ({
  config: {
    redisUrl: 'redis://localhost:6379',
    databaseUrl: 'postgresql://localhost:5432/test',
    s3Endpoint: 'http://localhost:9000',
    s3Bucket: 'test-bucket',
  }
}));

jest.mock('bullmq', () => ({
  Queue: jest.fn().mockImplementation(() => ({
    add: jest.fn().mockResolvedValue({ id: 'test-job-id' }),
  })),
  Worker: jest.fn(),
}));

jest.mock('ioredis', () => jest.fn().mockImplementation(() => ({
  ping: jest.fn().mockResolvedValue('PONG'),
  quit: jest.fn().mockResolvedValue(undefined),
})));

jest.mock('pg', () => ({
  Pool: jest.fn().mockImplementation(() => ({
    query: jest.fn(),
    end: jest.fn().mockResolvedValue(undefined),
  })),
}));

describe('Orchestrator - Edge Cases', () => {
  let mockPgQuery: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockPgQuery = jest.fn();
    (pg.query as jest.Mock) = mockPgQuery;
  });

  describe('createEpisode - Edge Cases', () => {
    it('should handle very long premise', async () => {
      const longPremise = 'A story '.repeat(1000);
      mockPgQuery.mockResolvedValueOnce({ rows: [] });

      const result = await createEpisode({ premise: longPremise });

      expect(result.premise).toBe(longPremise);
      expect(result.status).toBe('pending');
    });

    it('should handle empty premise gracefully', async () => {
      mockPgQuery.mockResolvedValueOnce({ rows: [] });

      const result = await createEpisode({ premise: '' });

      expect(result.premise).toBe('');
      expect(result.id).toBeDefined();
    });

    it('should handle special characters in title', async () => {
      const specialTitle = 'Episode: "Test" \'Special\' <script>alert(1)</script>';
      mockPgQuery.mockResolvedValueOnce({ rows: [] });

      const result = await createEpisode({ 
        title: specialTitle,
        premise: 'Test premise'
      });

      expect(result.title).toBe(specialTitle);
    });

    it('should handle unicode characters in premise', async () => {
      const unicodePremise = '🎬 测试 日本語 émojis 👍';
      mockPgQuery.mockResolvedValueOnce({ rows: [] });

      const result = await createEpisode({ premise: unicodePremise });

      expect(result.premise).toBe(unicodePremise);
    });

    it('should handle targetDuration of 0', async () => {
      mockPgQuery.mockResolvedValueOnce({ rows: [] });

      const result = await createEpisode({ 
        premise: 'Test',
        targetDuration: 0 
      });

      expect(result.targetDuration).toBe(0);
    });

    it('should handle very large targetDuration', async () => {
      mockPgQuery.mockResolvedValueOnce({ rows: [] });

      const result = await createEpisode({ 
        premise: 'Test',
        targetDuration: 999999 
      });

      expect(result.targetDuration).toBe(999999);
    });

    it('should handle negative targetDuration', async () => {
      mockPgQuery.mockResolvedValueOnce({ rows: [] });

      const result = await createEpisode({ 
        premise: 'Test',
        targetDuration: -10 
      });

      expect(result.targetDuration).toBe(-10);
    });

    it('should handle database query failure during creation', async () => {
      mockPgQuery.mockRejectedValueOnce(new Error('Database connection lost'));

      await expect(createEpisode({ premise: 'Test' }))
        .rejects.toThrow('Database connection lost');
    });

    it('should handle null/undefined optional fields', async () => {
      mockPgQuery.mockResolvedValueOnce({ rows: [] });

      const result = await createEpisode({ 
        premise: 'Test',
        title: undefined as any,
        targetDuration: undefined as any
      });

      expect(result.id).toBeDefined();
      expect(result.targetDuration).toBe(30); // default
    });
  });

  describe('getEpisodeStatus - Edge Cases', () => {
    it('should handle episode with no jobs', async () => {
      const episodeId = uuidv4();
      mockPgQuery
        .mockResolvedValueOnce({ 
          rows: [{ id: episodeId, title: 'Test', status: 'pending' }] 
        })
        .mockResolvedValueOnce({ rows: [] }) // no jobs
        .mockResolvedValueOnce({ rows: [] }); // no assets

      const result = await getEpisodeStatus(episodeId);

      expect(result?.jobs).toEqual([]);
      expect(result?.assets).toEqual([]);
    });

    it('should handle episode with 100+ jobs', async () => {
      const episodeId = uuidv4();
      const manyJobs = Array.from({ length: 150 }, (_, i) => ({
        id: uuidv4(),
        stage: 'script',
        status: 'completed',
        sequence: i
      }));

      mockPgQuery
        .mockResolvedValueOnce({ 
          rows: [{ id: episodeId, title: 'Test', status: 'processing' }] 
        })
        .mockResolvedValueOnce({ rows: manyJobs })
        .mockResolvedValueOnce({ rows: [] });

      const result = await getEpisodeStatus(episodeId);

      expect(result?.jobs).toHaveLength(150);
    });

    it('should handle episode with null fields', async () => {
      const episodeId = uuidv4();
      mockPgQuery
        .mockResolvedValueOnce({ 
          rows: [{ 
            id: episodeId, 
            title: null, 
            status: null,
            completed_at: null 
          }] 
        })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      const result = await getEpisodeStatus(episodeId);

      expect(result?.episode).toBeDefined();
      expect(result?.episode.title).toBeNull();
    });

    it('should handle database error during status retrieval', async () => {
      mockPgQuery.mockRejectedValueOnce(new Error('Query timeout'));

      await expect(getEpisodeStatus(uuidv4()))
        .rejects.toThrow('Query timeout');
    });

    it('should handle invalid episode ID format', async () => {
      const invalidId = 'not-a-valid-uuid';
      mockPgQuery.mockResolvedValueOnce({ rows: [] });

      const result = await getEpisodeStatus(invalidId);

      expect(result).toBeNull();
    });
  });

  describe('listEpisodes - Edge Cases', () => {
    it('should handle empty database', async () => {
      mockPgQuery.mockResolvedValueOnce({ rows: [] });

      const result = await listEpisodes();

      expect(result).toEqual([]);
    });

    it('should handle pagination edge case - offset beyond total', async () => {
      mockPgQuery.mockResolvedValueOnce({ rows: [] });

      const result = await listEpisodes(10, 1000);

      expect(result).toEqual([]);
      expect(mockPgQuery).toHaveBeenCalledWith(
        expect.any(String),
        [10, 1000]
      );
    });

    it('should handle limit of 0', async () => {
      mockPgQuery.mockResolvedValueOnce({ rows: [] });

      await listEpisodes(0, 0);

      expect(mockPgQuery).toHaveBeenCalledWith(
        expect.any(String),
        [0, 0]
      );
    });

    it('should handle very large limit', async () => {
      const manyEpisodes = Array.from({ length: 100 }, (_, i) => ({
        id: uuidv4(),
        title: `Episode ${i}`,
        status: 'completed'
      }));
      mockPgQuery.mockResolvedValueOnce({ rows: manyEpisodes });

      const result = await listEpisodes(10000, 0);

      expect(result).toHaveLength(100);
    });

    it('should handle database connection error', async () => {
      mockPgQuery.mockRejectedValueOnce(new Error('Connection refused'));

      await expect(listEpisodes())
        .rejects.toThrow('Connection refused');
    });
  });

  describe('progressToNextStage - Edge Cases', () => {
    it('should handle unknown stage gracefully', async () => {
      const episodeId = uuidv4();
      const unknownStage = 'unknown-stage';
      
      await progressToNextStage(episodeId, unknownStage, {});

      // Should mark as completed since unknown stage isn't in flow
      expect(mockPgQuery).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE episodes SET status = 'completed'"),
        [episodeId]
      );
    });

    it('should handle null/undefined output data', async () => {
      const episodeId = uuidv4();
      
      await progressToNextStage(episodeId, 'script', null);

      const { Queue } = require('bullmq');
      const mockQueueInstance = Queue.mock.results[1].value;
      expect(mockQueueInstance.add).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          episodeId,
          inputData: null,
        }),
        expect.any(Object)
      );
    });

    it('should handle deeply nested output data', async () => {
      const episodeId = uuidv4();
      const deepData = {
        level1: {
          level2: {
            level3: {
              data: Array(1000).fill('x').join('')
            }
          }
        }
      };

      await progressToNextStage(episodeId, 'script', deepData);

      const { Queue } = require('bullmq');
      const mockQueueInstance = Queue.mock.results[1].value;
      expect(mockQueueInstance.add).toHaveBeenCalled();
    });

    it('should handle circular reference in output data', async () => {
      const episodeId = uuidv4();
      const data: any = { a: 1 };
      data.self = data; // circular reference

      // This might fail in real implementation, testing behavior
      await expect(progressToNextStage(episodeId, 'script', data))
        .rejects.toThrow(); // Expected to throw on circular JSON
    });

    it('should handle queue addition failure', async () => {
      const episodeId = uuidv4();
      const { Queue } = require('bullmq');
      const mockQueueInstance = Queue.mock.results[1].value;
      mockQueueInstance.add.mockRejectedValueOnce(new Error('Queue full'));

      await expect(progressToNextStage(episodeId, 'script', {}))
        .rejects.toThrow('Queue full');
    });

    it('should handle compose stage with final output data', async () => {
      const episodeId = uuidv4();
      const finalOutput = {
        finalVideoUri: 's3://bucket/video.mp4',
        duration: 120,
        resolution: '1080p',
        metadata: {
          created: new Date().toISOString(),
          version: '1.0.0'
        }
      };

      await progressToNextStage(episodeId, 'compose', finalOutput);

      expect(mockPgQuery).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE episodes SET status = 'completed'"),
        [episodeId]
      );
    });

    it('should handle stage progression with database error', async () => {
      mockPgQuery.mockRejectedValueOnce(new Error('Deadlock detected'));

      await expect(progressToNextStage(uuidv4(), 'compose', {}))
        .rejects.toThrow('Deadlock detected');
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle multiple simultaneous episode creations', async () => {
      mockPgQuery.mockResolvedValue({ rows: [] });

      const promises = Array.from({ length: 10 }, (_, i) => 
        createEpisode({ premise: `Concurrent episode ${i}` })
      );

      const results = await Promise.all(promises);

      expect(results).toHaveLength(10);
      // Check all IDs are unique
      const ids = results.map(r => r.id);
      expect(new Set(ids).size).toBe(10);
    });

    it('should handle rapid status queries for same episode', async () => {
      const episodeId = uuidv4();
      mockPgQuery
        .mockResolvedValue({ 
          rows: [{ id: episodeId, title: 'Test', status: 'processing' }] 
        });

      const promises = Array.from({ length: 50 }, () => 
        getEpisodeStatus(episodeId)
      );

      const results = await Promise.all(promises);

      expect(results.every(r => r?.episode.id === episodeId)).toBe(true);
    });
  });
});
