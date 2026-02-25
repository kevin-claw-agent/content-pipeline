/**
 * Integration Test: Full Pipeline End-to-End
 * 
 * This test verifies the complete workflow from episode creation
 * through final video composition.
 */

import { v4 as uuidv4 } from 'uuid';

// Mock all external dependencies
jest.mock('../../src/utils/llm', () => ({
  callLLM: jest.fn(),
}));

jest.mock('../../src/storage', () => ({
  uploadBuffer: jest.fn().mockResolvedValue('mock-uri'),
  uploadJSON: jest.fn().mockResolvedValue('mock-uri'),
  uploadText: jest.fn().mockResolvedValue('mock-uri'),
  downloadBuffer: jest.fn().mockResolvedValue(Buffer.from('mock')),
  downloadJSON: jest.fn().mockResolvedValue({}),
  deleteFile: jest.fn().mockResolvedValue(undefined),
  getPresignedDownloadUrl: jest.fn().mockResolvedValue('https://mock-url.com'),
  getPresignedUploadUrl: jest.fn().mockResolvedValue('https://mock-url.com'),
  listFiles: jest.fn().mockResolvedValue([]),
  deleteFiles: jest.fn().mockResolvedValue(undefined),
}));

import { callLLM } from '../../src/utils/llm';

// Mock database
const mockDbQueries: Record<string, any[]> = {
  episodes: [],
  jobs: [],
  assets: [],
};

jest.mock('../../src/orchestrator', () => {
  const { v4: uuidv4 } = require('uuid');
  
  return {
    pg: {
      query: jest.fn().mockImplementation((sql: string, params: any[]) => {
        // Simple query router for testing
        if (sql.includes('INSERT INTO episodes')) {
          const episode = {
            id: params[0],
            title: params[1],
            premise: params[2],
            status: params[3],
            target_duration: params[4],
            created_at: new Date(),
            updated_at: new Date(),
          };
          mockDbQueries.episodes.push(episode);
          return { rows: [episode] };
        }
        
        if (sql.includes('INSERT INTO jobs')) {
          const job = {
            id: uuidv4(),
            episode_id: params[0],
            stage: params[1],
            status: params[2],
            input_data: params[3],
            created_at: new Date(),
          };
          mockDbQueries.jobs.push(job);
          return { rows: [{ id: job.id }] };
        }
        
        if (sql.includes('INSERT INTO assets')) {
          const asset = {
            id: uuidv4(),
            episode_id: params[0],
            job_id: params[1],
            type: params[2],
            uri: params[3],
            metadata: params[4],
            created_at: new Date(),
          };
          mockDbQueries.assets.push(asset);
          return { rows: [asset] };
        }
        
        if (sql.includes('SELECT * FROM episodes WHERE id')) {
          const episode = mockDbQueries.episodes.find((e: any) => e.id === params[0]);
          return { rows: episode ? [episode] : [] };
        }
        
        if (sql.includes('UPDATE episodes SET')) {
          const episode = mockDbQueries.episodes.find((e: any) => e.id === params[params.length - 1]);
          if (episode && sql.includes('status =')) {
            const statusMatch = sql.match(/status = '([^']+)'/);
            if (statusMatch) {
              episode.status = statusMatch[1];
            }
          }
          return { rows: [episode] };
        }
        
        if (sql.includes('SELECT * FROM jobs WHERE episode_id')) {
          const jobs = mockDbQueries.jobs.filter((j: any) => j.episode_id === params[0]);
          return { rows: jobs };
        }
        
        if (sql.includes('SELECT * FROM assets WHERE episode_id')) {
          const assets = mockDbQueries.assets.filter((a: any) => a.episode_id === params[0]);
          return { rows: assets };
        }
        
        return { rows: [] };
      }),
    },
    redis: {
      ping: jest.fn().mockResolvedValue('PONG'),
    },
    progressToNextStage: jest.fn().mockResolvedValue(undefined),
    scriptQueue: { add: jest.fn().mockResolvedValue({ id: 'mock-job' }) },
    visualQueue: { add: jest.fn().mockResolvedValue({ id: 'mock-job' }) },
    renderQueue: { add: jest.fn().mockResolvedValue({ id: 'mock-job' }) },
    composeQueue: { add: jest.fn().mockResolvedValue({ id: 'mock-job' }) },
    createEpisode: jest.requireActual('../../src/orchestrator').createEpisode,
    getEpisodeStatus: jest.requireActual('../../src/orchestrator').getEpisodeStatus,
  };
});

import {
  createEpisode,
  getEpisodeStatus,
  progressToNextStage,
  pg,
  scriptQueue,
  visualQueue,
  renderQueue,
  composeQueue,
} from '../../src/orchestrator';

describe('Pipeline Integration Test', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Clear mock database
    mockDbQueries.episodes = [];
    mockDbQueries.jobs = [];
    mockDbQueries.assets = [];
  });

  describe('Full Pipeline Flow', () => {
    it('should complete full pipeline from premise to final video', async () => {
      // Step 1: Create Episode
      const premise = 'A romantic comedy about two strangers who meet at a coffee shop and discover they are both waiting for the same blind date.';
      const episode = await createEpisode({
        title: 'Coffee Shop Mix-Up',
        premise,
        targetDuration: 60,
      });

      expect(episode).toMatchObject({
        title: 'Coffee Shop Mix-Up',
        premise,
        status: 'pending',
        targetDuration: 60,
      });
      expect(episode.id).toBeDefined();

      // Verify script job was queued
      expect(scriptQueue.add).toHaveBeenCalledWith(
        'generate-script',
        expect.objectContaining({
          episodeId: episode.id,
          premise,
          targetDuration: 60,
        }),
        expect.any(Object)
      );

      // Step 2: Simulate Script Generation
      const mockScript = {
        scenes: [
          {
            sceneNumber: 1,
            description: 'Interior - Coffee Shop - Day',
            dialogue: 'ALEX: I\'m supposed to meet someone here...',
            duration: 15,
          },
          {
            sceneNumber: 2,
            description: 'ALEX notices JORDAN at a nearby table',
            dialogue: 'JORDAN: Are you waiting for someone too?',
            duration: 20,
          },
          {
            sceneNumber: 3,
            description: 'They laugh as they realize the coincidence',
            dialogue: 'ALEX & JORDAN: Same blind date?!',
            duration: 25,
          },
        ],
        totalDuration: 60,
        visualStyle: 'Warm, cozy coffee shop aesthetic with soft lighting',
      };

      (callLLM as jest.Mock).mockResolvedValueOnce(JSON.stringify(mockScript));

      // Simulate script worker processing
      await pg.query(
        `INSERT INTO jobs (episode_id, stage, status, input_data) VALUES ($1, $2, $3, $4) RETURNING id`,
        [episode.id, 'script', 'completed', JSON.stringify({ premise, targetDuration: 60 })]
      );

      await pg.query(
        `INSERT INTO assets (episode_id, job_id, type, uri, metadata) VALUES ($1, $2, $3, $4, $5)`,
        [episode.id, 'job-script', 'script', `episodes/${episode.id}/script.json`, JSON.stringify(mockScript)]
      );

      await progressToNextStage(episode.id, 'script', mockScript);

      // Verify storyboard job was queued
      expect(visualQueue.add).toHaveBeenCalledWith(
        'storyboard-generation',
        expect.objectContaining({
          episodeId: episode.id,
          inputData: mockScript,
          stage: 'storyboard',
        }),
        expect.any(Object)
      );

      // Step 3: Simulate Storyboard Generation
      const mockStoryboard = {
        shots: [
          { shotNumber: 1, sceneNumber: 1, description: 'Wide shot of coffee shop', cameraAngle: 'Wide', lighting: 'Soft natural', duration: 5, promptForImage: 'Wide shot cozy coffee shop interior' },
          { shotNumber: 2, sceneNumber: 1, description: 'ALEX looking around', cameraAngle: 'Medium shot', lighting: 'Warm', duration: 5, promptForImage: 'Person looking around coffee shop' },
          { shotNumber: 3, sceneNumber: 1, description: 'Close up of coffee cup', cameraAngle: 'Close up', lighting: 'Warm', duration: 5, promptForImage: 'Steaming coffee cup close up' },
        ],
        totalShots: 3,
        visualStyle: mockScript.visualStyle,
      };

      (callLLM as jest.Mock).mockResolvedValueOnce(JSON.stringify(mockStoryboard));

      await pg.query(
        `INSERT INTO jobs (episode_id, stage, status, input_data) VALUES ($1, $2, $3, $4) RETURNING id`,
        [episode.id, 'storyboard', 'completed', JSON.stringify(mockScript)]
      );

      for (const shot of mockStoryboard.shots) {
        await pg.query(
          `INSERT INTO assets (episode_id, job_id, type, uri, metadata) VALUES ($1, $2, $3, $4, $5)`,
          [episode.id, 'job-storyboard', 'image', `episodes/${episode.id}/shots/shot-${shot.shotNumber}.png`, JSON.stringify(shot)]
        );
      }

      await progressToNextStage(episode.id, 'storyboard', mockStoryboard);

      // Verify render job was queued
      expect(renderQueue.add).toHaveBeenCalledWith(
        'render-generation',
        expect.objectContaining({
          episodeId: episode.id,
          inputData: mockStoryboard,
          stage: 'render',
        }),
        expect.any(Object)
      );

      // Step 4: Simulate Video Rendering
      const mockRenderOutput = {
        storyboard: mockStoryboard,
        renders: [
          { shotNumber: 1, videoUri: `episodes/${episode.id}/renders/shot-1.mp4`, duration: 5, status: 'success' },
          { shotNumber: 2, videoUri: `episodes/${episode.id}/renders/shot-2.mp4`, duration: 5, status: 'success' },
          { shotNumber: 3, videoUri: `episodes/${episode.id}/renders/shot-3.mp4`, duration: 5, status: 'success' },
        ],
        totalRenders: 3,
        successfulRenders: 3,
      };

      await pg.query(
        `INSERT INTO jobs (episode_id, stage, status, input_data) VALUES ($1, $2, $3, $4) RETURNING id`,
        [episode.id, 'render', 'completed', JSON.stringify(mockStoryboard)]
      );

      for (const render of mockRenderOutput.renders) {
        await pg.query(
          `INSERT INTO assets (episode_id, job_id, type, uri, metadata) VALUES ($1, $2, $3, $4, $5)`,
          [episode.id, 'job-render', 'video', render.videoUri, JSON.stringify(render)]
        );
      }

      await progressToNextStage(episode.id, 'render', mockRenderOutput);

      // Verify compose job was queued
      expect(composeQueue.add).toHaveBeenCalledWith(
        'compose-generation',
        expect.objectContaining({
          episodeId: episode.id,
          inputData: mockRenderOutput,
          stage: 'compose',
        }),
        expect.any(Object)
      );

      // Step 5: Simulate Video Composition
      await pg.query(
        `INSERT INTO jobs (episode_id, stage, status, input_data) VALUES ($1, $2, $3, $4) RETURNING id`,
        [episode.id, 'compose', 'completed', JSON.stringify(mockRenderOutput)]
      );

      await pg.query(
        `INSERT INTO assets (episode_id, job_id, type, uri, metadata) VALUES ($1, $2, $3, $4, $5)`,
        [episode.id, 'job-compose', 'video', `episodes/${episode.id}/final/video.mp4`, JSON.stringify({ duration: 15, segments: 3, format: 'mp4' })]
      );

      await pg.query(
        `UPDATE episodes SET status = 'completed', completed_at = NOW() WHERE id = $1`,
        [episode.id]
      );

      // Step 6: Verify Final Status
      const finalStatus = await getEpisodeStatus(episode.id);

      expect(finalStatus).toBeDefined();
      expect(finalStatus?.episode.status).toBe('completed');
      expect(finalStatus?.jobs).toHaveLength(4); // script, storyboard, render, compose
      expect(finalStatus?.assets.length).toBeGreaterThanOrEqual(1);

      // Verify asset types
      const assetTypes = finalStatus?.assets.map((a: any) => a.type);
      expect(assetTypes).toContain('script');
      expect(assetTypes).toContain('image');
      expect(assetTypes).toContain('video');
    });

    it('should handle pipeline failures gracefully', async () => {
      const episode = await createEpisode({
        title: 'Failing Episode',
        premise: 'This will fail',
      });

      // Simulate script failure
      await pg.query(
        `INSERT INTO jobs (episode_id, stage, status, error_message) VALUES ($1, $2, $3, $4) RETURNING id`,
        [episode.id, 'script', 'failed', 'LLM API error: Rate limit exceeded']
      );

      const status = await getEpisodeStatus(episode.id);
      
      expect(status?.jobs.some((j: any) => j.status === 'failed')).toBe(true);
    });
  });
});
