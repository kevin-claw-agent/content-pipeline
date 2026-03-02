import { 
  createEpisode, 
  getEpisodeStatus, 
  listEpisodes,
  progressToNextStage,
  pg
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

describe('Performance Tests', () => {
  let mockPgQuery: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockPgQuery = jest.fn();
    (pg.query as jest.Mock) = mockPgQuery;
  });

  describe('Episode Creation Performance', () => {
    it('should create 100 episodes within 5 seconds', async () => {
      mockPgQuery.mockResolvedValue({ rows: [] });

      const startTime = Date.now();
      
      const promises = Array.from({ length: 100 }, (_, i) =
        createEpisode({ 
          premise: `Performance test episode ${i}`,
          targetDuration: 30 + i
        })
      );

      await Promise.all(promises);

      const duration = Date.now() - startTime;
      
      expect(duration).toBeLessThan(5000);
      console.log(`Created 100 episodes in ${duration}ms`);
    });

    it('should create episodes with consistent latency', async () => {
      mockPgQuery.mockResolvedValue({ rows: [] });

      const latencies: number[] = [];
      
      for (let i = 0; i < 20; i++) {
        const start = Date.now();
        await createEpisode({ premise: `Latency test ${i}` });
        latencies.push(Date.now() - start);
      }

      const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
      const maxLatency = Math.max(...latencies);
      
      expect(avgLatency).toBeLessThan(100); // Average under 100ms
      expect(maxLatency).toBeLessThan(500); // Max under 500ms
      
      console.log(`Avg latency: ${avgLatency.toFixed(2)}ms, Max latency: ${maxLatency}ms`);
    });
  });

  describe('Status Query Performance', () => {
    it('should query episode status within 50ms', async () => {
      const episodeId = uuidv4();
      mockPgQuery
        .mockResolvedValue({ 
          rows: [{ id: episodeId, title: 'Test', status: 'completed' }] 
        })
        .mockResolvedValue({ 
          rows: [
            { id: uuidv4(), stage: 'script', status: 'completed' },
            { id: uuidv4(), stage: 'storyboard', status: 'completed' },
            { id: uuidv4(), stage: 'render', status: 'completed' },
            { id: uuidv4(), stage: 'compose', status: 'completed' }
          ] 
        })
        .mockResolvedValue({ 
          rows: [
            { id: uuidv4(), type: 'script', uri: 'test.json' },
            { id: uuidv4(), type: 'video', uri: 'test.mp4' }
          ] 
        });

      const start = Date.now();
      await getEpisodeStatus(episodeId);
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(50);
      console.log(`Status query took ${duration}ms`);
    });

    it('should handle 1000 concurrent status queries efficiently', async () => {
      const episodeId = uuidv4();
      mockPgQuery
        .mockResolvedValue({ 
          rows: [{ id: episodeId, title: 'Test', status: 'processing' }] 
        });

      const start = Date.now();
      
      const promises = Array.from({ length: 1000 }, () =
        getEpisodeStatus(episodeId)
      );

      await Promise.all(promises);
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(5000);
      console.log(`1000 concurrent queries took ${duration}ms`);
    });
  });

  describe('List Episodes Performance', () => {
    it('should list 1000 episodes within 500ms', async () => {
      const episodes = Array.from({ length: 1000 }, (_, i) => ({
        id: uuidv4(),
        title: `Episode ${i}`,
        status: 'completed',
        created_at: new Date(Date.now() - i * 1000).toISOString()
      }));

      mockPgQuery.mockResolvedValue({ rows: episodes });

      const start = Date.now();
      const result = await listEpisodes(1000, 0);
      const duration = Date.now() - start;

      expect(result).toHaveLength(1000);
      expect(duration).toBeLessThan(500);
      console.log(`Listed 1000 episodes in ${duration}ms`);
    });

    it('should handle pagination efficiently', async () => {
      const episodes = Array.from({ length: 100 }, (_, i) => ({
        id: uuidv4(),
        title: `Episode ${i}`,
        status: 'completed'
      }));

      mockPgQuery.mockResolvedValue({ rows: episodes });

      const start = Date.now();
      
      // Simulate scrolling through pages
      for (let offset = 0; offset < 500; offset += 100) {
        await listEpisodes(100, offset);
      }

      const duration = Date.now() - start;
      
      expect(duration).toBeLessThan(1000);
      console.log(`5 pagination queries took ${duration}ms`);
    });
  });

  describe('Stage Progression Performance', () => {
    it('should progress through all stages within 200ms', async () => {
      const episodeId = uuidv4();
      mockPgQuery.mockResolvedValue({ rows: [] });

      const start = Date.now();

      await progressToNextStage(episodeId, 'script', { scenes: [] });
      await progressToNextStage(episodeId, 'storyboard', { shots: [] });
      await progressToNextStage(episodeId, 'render', { renders: [] });
      await progressToNextStage(episodeId, 'compose', { video: 'test.mp4' });

      const duration = Date.now() - start;

      expect(duration).toBeLessThan(200);
      console.log(`Full pipeline progression took ${duration}ms`);
    });
  });

  describe('Memory Efficiency', () => {
    it('should handle large episode data without excessive memory', async () => {
      const initialMemory = process.memoryUsage().heapUsed;
      
      const episodeId = uuidv4();
      const largeData = {
        scenes: Array.from({ length: 100 }, (_, i) => ({
          id: i,
          description: 'A'.repeat(10000), // 10KB per scene
          dialogue: 'B'.repeat(5000)
        }))
      };

      mockPgQuery
        .mockResolvedValueOnce({ 
          rows: [{ id: episodeId, title: 'Large Episode', status: 'processing' }] 
        })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ 
          rows: Array.from({ length: 50 }, () => ({
            id: uuidv4(),
            type: 'script',
            uri: 'test.json',
            data: 'X'.repeat(10000)
          }))
        });

      await getEpisodeStatus(episodeId);

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = (finalMemory - initialMemory) / 1024 / 1024; // MB

      expect(memoryIncrease).toBeLessThan(100); // Less than 100MB increase
      console.log(`Memory increase: ${memoryIncrease.toFixed(2)}MB`);
    });
  });

  describe('Throughput Benchmarks', () => {
    it('should achieve 50+ episode creations per second', async () => {
      mockPgQuery.mockResolvedValue({ rows: [] });

      const batchSize = 50;
      const iterations = 10;
      
      const start = Date.now();
      
      for (let i = 0; i < iterations; i++) {
        const batch = Array.from({ length: batchSize }, (_, j) =
          createEpisode({ premise: `Batch ${i} - Episode ${j}` })
        );
        await Promise.all(batch);
      }

      const duration = Date.now() - start;
      const throughput = (batchSize * iterations) / (duration / 1000);

      expect(throughput).toBeGreaterThan(50);
      console.log(`Throughput: ${throughput.toFixed(2)} episodes/second`);
    });

    it('should maintain performance under sustained load', async () => {
      mockPgQuery.mockResolvedValue({ rows: [] });

      const measurements: number[] = [];
      
      // Run for 5 iterations
      for (let iteration = 0; iteration < 5; iteration++) {
        const start = Date.now();
        
        const batch = Array.from({ length: 20 }, (_, i) =
          createEpisode({ premise: `Sustained load ${iteration}-${i}` })
        );
        
        await Promise.all(batch);
        measurements.push(Date.now() - start);
      }

      const avgTime = measurements.reduce((a, b) => a + b, 0) / measurements.length;
      const variance = Math.max(...measurements) - Math.min(...measurements);
      
      // Variance should be less than 50% of average (consistent performance)
      expect(variance / avgTime).toBeLessThan(0.5);
      
      console.log(`Avg time: ${avgTime}ms, Variance: ${variance}ms`);
    });
  });
});
