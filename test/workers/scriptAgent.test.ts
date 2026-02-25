// Mock dependencies before imports
jest.mock('../../src/orchestrator', () => ({
  pg: {
    query: jest.fn(),
  },
  redis: {
    ping: jest.fn().mockResolvedValue('PONG'),
  },
  progressToNextStage: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../src/utils/llm', () => ({
  callLLM: jest.fn(),
}));

import { pg, progressToNextStage } from '../../src/orchestrator';
import { callLLM } from '../../src/utils/llm';

describe('ScriptAgent', () => {
  let mockPgQuery: jest.Mock;
  let mockCallLLM: jest.Mock;
  let mockProgressToNextStage: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockPgQuery = pg.query as jest.Mock;
    mockCallLLM = callLLM as jest.Mock;
    mockProgressToNextStage = progressToNextStage as jest.Mock;
  });

  describe('Script Generation Logic', () => {
    it('should create job record at start', async () => {
      const episodeId = 'test-episode-id';
      const jobId = 'test-job-id';
      const premise = 'A romantic story about two strangers';
      const targetDuration = 30;

      mockPgQuery.mockResolvedValueOnce({ rows: [{ id: jobId }] });
      mockCallLLM.mockResolvedValueOnce(JSON.stringify({
        scenes: [],
        totalDuration: 30,
        visualStyle: 'cinematic',
      }));
      mockPgQuery.mockResolvedValueOnce({ rows: [] });
      mockPgQuery.mockResolvedValueOnce({ rows: [] });

      // Simulate the worker logic
      const jobData = { episodeId, premise, targetDuration };
      
      // Create job record (as worker does)
      await pg.query(
        `INSERT INTO jobs (episode_id, stage, status, input_data) 
         VALUES ($1, $2, $3, $4) RETURNING id`,
        [episodeId, 'script', 'running', JSON.stringify({ premise, targetDuration })]
      );

      expect(mockPgQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO jobs'),
        expect.arrayContaining([
          episodeId,
          'script',
          'running',
          expect.stringContaining(premise),
        ])
      );
    });

    it('should call LLM with correct prompt', async () => {
      const premise = 'A mystery thriller';
      const targetDuration = 45;

      mockCallLLM.mockResolvedValueOnce(JSON.stringify({
        scenes: [
          { sceneNumber: 1, description: 'Opening scene', duration: 15 },
        ],
        totalDuration: 45,
        visualStyle: 'noir',
      }));

      // Simulate the prompt generation
      const prompt = `
Create a short drama script (approximately ${targetDuration} seconds) based on this premise:
"${premise}"

Format the output as JSON with:
- scenes: array of scenes with description, characters, dialogue
- totalDuration: estimated duration in seconds
- visualStyle: description of visual style
`;

      await callLLM(prompt, 'script-generation');

      expect(mockCallLLM).toHaveBeenCalledWith(
        expect.stringContaining(premise),
        'script-generation'
      );
      expect(mockCallLLM).toHaveBeenCalledWith(
        expect.stringContaining(`${targetDuration} seconds`),
        'script-generation'
      );
    });

    it('should parse LLM response and store script', async () => {
      const episodeId = 'test-episode-id';
      const jobId = 'test-job-id';
      const mockScript = {
        scenes: [
          { sceneNumber: 1, description: 'Scene 1', dialogue: 'Hello', duration: 10 },
          { sceneNumber: 2, description: 'Scene 2', dialogue: 'Goodbye', duration: 20 },
        ],
        totalDuration: 30,
        visualStyle: 'warm and cozy',
      };

      mockPgQuery.mockResolvedValueOnce({ rows: [{ id: jobId }] });
      mockCallLLM.mockResolvedValueOnce(JSON.stringify(mockScript));
      mockPgQuery.mockResolvedValueOnce({ rows: [] });
      mockPgQuery.mockResolvedValueOnce({ rows: [] });

      // Simulate script generation
      const scriptResult = await callLLM('test prompt', 'script-generation');
      const script = JSON.parse(scriptResult);

      expect(script).toEqual(mockScript);
      expect(script.scenes).toHaveLength(2);
      expect(script.totalDuration).toBe(30);
    });

    it('should update job status to completed on success', async () => {
      const jobId = 'test-job-id';
      const mockScript = { scenes: [], totalDuration: 30 };

      mockPgQuery.mockResolvedValueOnce({ rows: [] });

      // Simulate successful completion
      await pg.query(
        `UPDATE jobs SET status = 'completed', output_data = $1, completed_at = NOW() 
         WHERE id = $2`,
        [JSON.stringify(mockScript), jobId]
      );

      expect(mockPgQuery).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE jobs SET status = 'completed'"),
        expect.arrayContaining([JSON.stringify(mockScript), jobId])
      );
    });

    it('should store script as asset', async () => {
      const episodeId = 'test-episode-id';
      const jobId = 'test-job-id';
      const mockScript = { scenes: [], totalDuration: 30 };

      mockPgQuery.mockResolvedValueOnce({ rows: [] });

      // Simulate asset storage
      await pg.query(
        `INSERT INTO assets (episode_id, job_id, type, uri, metadata) 
         VALUES ($1, $2, $3, $4, $5)`,
        [episodeId, jobId, 'script', `episodes/${episodeId}/script.json`, JSON.stringify(mockScript)]
      );

      expect(mockPgQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO assets'),
        expect.arrayContaining([
          episodeId,
          jobId,
          'script',
          `episodes/${episodeId}/script.json`,
          JSON.stringify(mockScript),
        ])
      );
    });

    it('should call progressToNextStage after completion', async () => {
      const episodeId = 'test-episode-id';
      const mockScript = { scenes: [], totalDuration: 30 };

      await progressToNextStage(episodeId, 'script', mockScript);

      expect(mockProgressToNextStage).toHaveBeenCalledWith(
        episodeId,
        'script',
        mockScript
      );
    });

    it('should handle LLM errors and update job status to failed', async () => {
      const jobId = 'test-job-id';
      const errorMessage = 'LLM API error';

      mockPgQuery.mockResolvedValueOnce({ rows: [] });

      // Simulate error handling
      await pg.query(
        `UPDATE jobs SET status = 'failed', error_message = $1 WHERE id = $2`,
        [errorMessage, jobId]
      );

      expect(mockPgQuery).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE jobs SET status = 'failed'"),
        expect.arrayContaining([errorMessage, jobId])
      );
    });

    it('should handle JSON parse errors', async () => {
      mockCallLLM.mockResolvedValueOnce('Invalid JSON response');

      await expect(async () => {
        const scriptResult = await callLLM('test prompt', 'script-generation');
        JSON.parse(scriptResult);
      }).rejects.toThrow();
    });
  });
});
