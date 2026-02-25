import request from 'supertest';
import express from 'express';

// Mock the orchestrator module
const mockPgQuery = jest.fn();
const mockCreateEpisode = jest.fn();
const mockGetEpisodeStatus = jest.fn();
const mockListEpisodes = jest.fn();

jest.mock('../src/orchestrator', () => ({
  createEpisode: (...args: any[]) => mockCreateEpisode(...args),
  getEpisodeStatus: (...args: any[]) => mockGetEpisodeStatus(...args),
  listEpisodes: (...args: any[]) => mockListEpisodes(...args),
  pg: {
    query: (...args: any[]) => mockPgQuery(...args),
  },
  redis: {
    ping: jest.fn().mockResolvedValue('PONG'),
  },
  progressToNextStage: jest.fn(),
  scriptQueue: {},
  visualQueue: {},
  renderQueue: {},
  composeQueue: {},
}));

// Import after mocking
import api from '../src/api';

describe('API Endpoints', () => {
  let app: express.Application;

  beforeEach(() => {
    jest.clearAllMocks();
    app = api;
  });

  describe('GET /health', () => {
    it('should return health status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body).toEqual({
        status: 'ok',
        service: 'content-pipeline',
      });
    });
  });

  describe('POST /episodes', () => {
    it('should create a new episode', async () => {
      const episodeData = {
        title: 'Test Episode',
        premise: 'A test premise',
        targetDuration: 45,
      };

      const createdEpisode = {
        id: 'test-uuid',
        ...episodeData,
        status: 'pending',
      };

      mockCreateEpisode.mockResolvedValueOnce(createdEpisode);

      const response = await request(app)
        .post('/episodes')
        .send(episodeData)
        .expect(201);

      expect(response.body).toEqual(createdEpisode);
      expect(mockCreateEpisode).toHaveBeenCalledWith(episodeData);
    });

    it('should create episode with minimal data', async () => {
      const episodeData = {
        premise: 'Just a premise',
      };

      mockCreateEpisode.mockResolvedValueOnce({
        id: 'test-uuid',
        title: 'Episode-123456',
        premise: episodeData.premise,
        status: 'pending',
        targetDuration: 30,
      });

      const response = await request(app)
        .post('/episodes')
        .send(episodeData)
        .expect(201);

      expect(response.body.premise).toBe(episodeData.premise);
    });

    it('should return 400 if premise is missing', async () => {
      const response = await request(app)
        .post('/episodes')
        .send({ title: 'No Premise' })
        .expect(400);

      expect(response.body.error).toBe('premise is required');
    });

    it('should return 500 on creation error', async () => {
      mockCreateEpisode.mockRejectedValueOnce(new Error('Database error'));

      const response = await request(app)
        .post('/episodes')
        .send({ premise: 'Test' })
        .expect(500);

      expect(response.body.error).toBe('Failed to create episode');
    });
  });

  describe('GET /episodes/:id', () => {
    it('should return episode status', async () => {
      const episodeId = 'test-episode-id';
      const mockStatus = {
        episode: { id: episodeId, title: 'Test', status: 'completed' },
        jobs: [],
        assets: [],
      };

      mockGetEpisodeStatus.mockResolvedValueOnce(mockStatus);

      const response = await request(app)
        .get(`/episodes/${episodeId}`)
        .expect(200);

      expect(response.body).toEqual(mockStatus);
      expect(mockGetEpisodeStatus).toHaveBeenCalledWith(episodeId);
    });

    it('should return 404 for non-existent episode', async () => {
      mockGetEpisodeStatus.mockResolvedValueOnce(null);

      const response = await request(app)
        .get('/episodes/non-existent')
        .expect(404);

      expect(response.body.error).toBe('Episode not found');
    });

    it('should return 500 on error', async () => {
      mockGetEpisodeStatus.mockRejectedValueOnce(new Error('Database error'));

      const response = await request(app)
        .get('/episodes/test-id')
        .expect(500);

      expect(response.body.error).toBe('Failed to get episode');
    });
  });

  describe('GET /episodes/:id/assets', () => {
    it('should return assets grouped by type', async () => {
      const episodeId = 'test-episode-id';
      
      mockPgQuery
        .mockResolvedValueOnce({ rows: [{ id: episodeId }] }) // Episode exists
        .mockResolvedValueOnce({
          rows: [
            { id: '1', type: 'script', uri: 'script.json', job_stage: 'script' },
            { id: '2', type: 'image', uri: 'shot1.png', job_stage: 'storyboard' },
            { id: '3', type: 'image', uri: 'shot2.png', job_stage: 'storyboard' },
            { id: '4', type: 'video', uri: 'final.mp4', job_stage: 'compose' },
          ],
        });

      const response = await request(app)
        .get(`/episodes/${episodeId}/assets`)
        .expect(200);

      expect(response.body.episodeId).toBe(episodeId);
      expect(response.body.totalAssets).toBe(4);
      expect(response.body.assetsByType.script).toHaveLength(1);
      expect(response.body.assetsByType.image).toHaveLength(2);
      expect(response.body.assetsByType.video).toHaveLength(1);
    });

    it('should return 404 if episode not found', async () => {
      mockPgQuery.mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .get('/episodes/non-existent/assets')
        .expect(404);

      expect(response.body.error).toBe('Episode not found');
    });
  });

  describe('DELETE /episodes/:id', () => {
    it('should delete an episode', async () => {
      const episodeId = 'test-episode-id';

      mockPgQuery
        .mockResolvedValueOnce({ rows: [{ id: episodeId }] }) // Episode exists
        .mockResolvedValueOnce({ rows: [{ uri: 'file1.txt' }, { uri: 'file2.txt' }] }) // Assets
        .mockResolvedValueOnce({ rows: [] }); // DELETE

      const response = await request(app)
        .delete(`/episodes/${episodeId}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.episodeId).toBe(episodeId);
      expect(response.body.deletedAssets).toBe(2);
    });

    it('should return 404 for non-existent episode', async () => {
      mockPgQuery.mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .delete('/episodes/non-existent')
        .expect(404);

      expect(response.body.error).toBe('Episode not found');
    });
  });

  describe('GET /episodes', () => {
    it('should list episodes with pagination', async () => {
      const mockEpisodes = [
        { id: '1', title: 'Episode 1', status: 'completed' },
        { id: '2', title: 'Episode 2', status: 'pending' },
      ];

      mockListEpisodes.mockResolvedValueOnce(mockEpisodes);

      const response = await request(app)
        .get('/episodes?limit=10&offset=0')
        .expect(200);

      expect(response.body.episodes).toEqual(mockEpisodes);
      expect(response.body.count).toBe(2);
      expect(mockListEpisodes).toHaveBeenCalledWith(10, 0);
    });

    it('should use default pagination values', async () => {
      mockListEpisodes.mockResolvedValueOnce([]);

      await request(app).get('/episodes').expect(200);

      expect(mockListEpisodes).toHaveBeenCalledWith(10, 0);
    });

    it('should parse pagination parameters correctly', async () => {
      mockListEpisodes.mockResolvedValueOnce([]);

      await request(app).get('/episodes?limit=25&offset=50').expect(200);

      expect(mockListEpisodes).toHaveBeenCalledWith(25, 50);
    });
  });
});
