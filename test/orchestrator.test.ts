import { createEpisode, getEpisodeStatus, listEpisodes, progressToNextStage, pg, redis } from '../src/orchestrator';
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

describe('Orchestrator', () => {
  let mockPgQuery: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockPgQuery = jest.fn();
    (pg.query as jest.Mock) = mockPgQuery;
  });

  describe('createEpisode', () => {
    it('should create an episode with default values', async () => {
      const mockEpisodeId = uuidv4();
      mockPgQuery
        .mockResolvedValueOnce({ rows: [] }) // INSERT episode
        .mockResolvedValueOnce({ rows: [{ id: mockEpisodeId }] }); // INSERT job

      const request = {
        premise: 'A romantic comedy about two strangers meeting in a coffee shop',
      };

      const result = await createEpisode(request);

      expect(result).toMatchObject({
        title: expect.stringMatching(/^Episode-/),
        premise: request.premise,
        status: 'pending',
        targetDuration: 30,
      });
      expect(result.id).toBeDefined();
      expect(mockPgQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO episodes'),
        expect.arrayContaining([expect.any(String), expect.any(String), request.premise, 'pending', 30])
      );
    });

    it('should create an episode with custom values', async () => {
      const request = {
        title: 'My Custom Episode',
        premise: 'A sci-fi thriller about time travel',
        targetDuration: 60,
      };

      mockPgQuery.mockResolvedValueOnce({ rows: [] });

      const result = await createEpisode(request);

      expect(result).toMatchObject({
        title: request.title,
        premise: request.premise,
        status: 'pending',
        targetDuration: request.targetDuration,
      });
    });

    it('should queue script generation job', async () => {
      const request = {
        premise: 'A mystery story',
      };

      mockPgQuery.mockResolvedValueOnce({ rows: [] });

      await createEpisode(request);

      // Verify that scriptQueue.add was called (via the mock)
      const { Queue } = require('bullmq');
      const mockQueueInstance = Queue.mock.results[0].value;
      expect(mockQueueInstance.add).toHaveBeenCalledWith(
        'generate-script',
        expect.objectContaining({
          episodeId: expect.any(String),
          premise: request.premise,
          targetDuration: expect.any(Number),
        }),
        expect.objectContaining({
          jobId: expect.stringContaining('script-'),
          attempts: 3,
          backoff: { type: 'exponential', delay: 5000 },
        })
      );
    });
  });

  describe('getEpisodeStatus', () => {
    it('should return episode status with jobs and assets', async () => {
      const episodeId = uuidv4();
      const mockEpisode = {
        id: episodeId,
        title: 'Test Episode',
        status: 'completed',
      };
      const mockJobs = [
        { id: uuidv4(), stage: 'script', status: 'completed' },
        { id: uuidv4(), stage: 'storyboard', status: 'completed' },
      ];
      const mockAssets = [
        { id: uuidv4(), type: 'script', uri: 'episodes/test/script.json' },
      ];

      mockPgQuery
        .mockResolvedValueOnce({ rows: [mockEpisode] })
        .mockResolvedValueOnce({ rows: mockJobs })
        .mockResolvedValueOnce({ rows: mockAssets });

      const result = await getEpisodeStatus(episodeId);

      expect(result).toEqual({
        episode: mockEpisode,
        jobs: mockJobs,
        assets: mockAssets,
      });
    });

    it('should return null for non-existent episode', async () => {
      mockPgQuery.mockResolvedValueOnce({ rows: [] });

      const result = await getEpisodeStatus('non-existent-id');

      expect(result).toBeNull();
    });
  });

  describe('listEpisodes', () => {
    it('should return paginated episodes', async () => {
      const mockEpisodes = [
        { id: uuidv4(), title: 'Episode 1', status: 'completed' },
        { id: uuidv4(), title: 'Episode 2', status: 'pending' },
      ];

      mockPgQuery.mockResolvedValueOnce({ rows: mockEpisodes });

      const result = await listEpisodes(10, 0);

      expect(result).toEqual(mockEpisodes);
      expect(mockPgQuery).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY created_at DESC LIMIT $1 OFFSET $2'),
        [10, 0]
      );
    });

    it('should use default pagination values', async () => {
      mockPgQuery.mockResolvedValueOnce({ rows: [] });

      await listEpisodes();

      expect(mockPgQuery).toHaveBeenCalledWith(
        expect.any(String),
        [10, 0]
      );
    });
  });

  describe('progressToNextStage', () => {
    it('should progress from script to storyboard', async () => {
      const episodeId = uuidv4();
      const outputData = { scenes: [], totalDuration: 30 };

      await progressToNextStage(episodeId, 'script', outputData);

      const { Queue } = require('bullmq');
      const mockQueueInstance = Queue.mock.results[1].value; // visualQueue
      expect(mockQueueInstance.add).toHaveBeenCalledWith(
        'storyboard-generation',
        expect.objectContaining({
          episodeId,
          inputData: outputData,
          stage: 'storyboard',
        }),
        expect.any(Object)
      );
    });

    it('should progress from storyboard to render', async () => {
      const episodeId = uuidv4();
      const outputData = { shots: [], totalShots: 5 };

      await progressToNextStage(episodeId, 'storyboard', outputData);

      const { Queue } = require('bullmq');
      const mockQueueInstance = Queue.mock.results[2].value; // renderQueue
      expect(mockQueueInstance.add).toHaveBeenCalledWith(
        'render-generation',
        expect.objectContaining({
          episodeId,
          inputData: outputData,
          stage: 'render',
        }),
        expect.any(Object)
      );
    });

    it('should progress from render to compose', async () => {
      const episodeId = uuidv4();
      const outputData = { renders: [], totalRenders: 5 };

      await progressToNextStage(episodeId, 'render', outputData);

      const { Queue } = require('bullmq');
      const mockQueueInstance = Queue.mock.results[3].value; // composeQueue
      expect(mockQueueInstance.add).toHaveBeenCalledWith(
        'compose-generation',
        expect.objectContaining({
          episodeId,
          inputData: outputData,
          stage: 'compose',
        }),
        expect.any(Object)
      );
    });

    it('should mark episode as completed after compose stage', async () => {
      const episodeId = uuidv4();
      const outputData = { finalVideoUri: 'episodes/test/video.mp4' };

      await progressToNextStage(episodeId, 'compose', outputData);

      expect(mockPgQuery).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE episodes SET status = 'completed'"),
        [episodeId]
      );
    });
  });
});
