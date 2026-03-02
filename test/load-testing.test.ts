import { 
  createEpisode, 
  getEpisodeStatus,
  progressToNextStage,
  pg,
  redis,
  scriptQueue,
  visualQueue,
  renderQueue,
  composeQueue
} from '../src/orchestrator';
import { v4 as uuidv4 } from 'uuid';

// Mock dependencies with configurable behavior
const mockQueueAdd = jest.fn();

jest.mock('../src/config', () => ({
  config: {
    redisUrl: 'redis://localhost:6379',
    databaseUrl: 'postgresql://localhost:5432/test',
    s3Endpoint: 'http://localhost:9000',
    s3Bucket: 'test-bucket',
  }
}));

jest.mock('bullmq', () => ({
  Queue: jest.fn().mockImplementation((name) => ({
    name,
    add: mockQueueAdd,
  })),
  Worker: jest.fn(),
}));

jest.mock('ioredis', () => jest.fn().mockImplementation(() => ({
  ping: jest.fn().mockResolvedValue('PONG'),
  quit: jest.fn().mockResolvedValue(undefined),
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
})));

jest.mock('pg', () => ({
  Pool: jest.fn().mockImplementation(() => ({
    query: jest.fn(),
    end: jest.fn().mockResolvedValue(undefined),
  })),
}));

/**
 * Load Testing Scenarios
 * 
 * These tests simulate various load patterns to verify system behavior
 * under different stress conditions.
 */
describe('Load Testing Scenarios', () => {
  let mockPgQuery: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockQueueAdd.mockResolvedValue({ id: 'test-job-id' });
    mockPgQuery = jest.fn();
    (pg.query as jest.Mock) = mockPgQuery;
  });

  describe('Scenario 1: Sudden Traffic Spike', () => {
    it('should handle 500 concurrent episode creations (flash sale simulation)', async () => {
      mockPgQuery.mockResolvedValue({ rows: [] });

      const startTime = Date.now();
      const spikeSize = 500;
      
      const requests = Array.from({ length: spikeSize }, (_, i) =
        createEpisode({ 
          premise: `Spike request ${i}`,
          targetDuration: 30
        }).catch(err => ({ error: err.message }))
      );

      const results = await Promise.all(requests);
      const duration = Date.now() - startTime;
      
      const successes = results.filter(r => !('error' in r)).length;
      const errors = results.filter(r => 'error' in r).length;

      console.log(`Flash spike: ${successes} success, ${errors} errors in ${duration}ms`);
      
      // Should handle at least 90% successfully
      expect(successes / spikeSize).toBeGreaterThan(0.9);
      expect(duration).toBeLessThan(10000); // Under 10 seconds
    });
  });

  describe('Scenario 2: Sustained High Load', () => {
    it('should maintain stability under 50 RPS for 30 seconds', async () => {
      mockPgQuery.mockResolvedValue({ rows: [] });

      const rps = 50;
      const duration = 30000; // 30 seconds
      const interval = 1000 / rps;
      
      const results: { success: boolean; latency: number }[] = [];
      const startTime = Date.now();
      let requestCount = 0;

      // Run load test
      while (Date.now() - startTime < duration) {
        const reqStart = Date.now();
        try {
          await createEpisode({ premise: `Sustained ${requestCount}` });
          results.push({ success: true, latency: Date.now() - reqStart });
        } catch (err) {
          results.push({ success: false, latency: Date.now() - reqStart });
        }
        requestCount++;
        
        // Maintain RPS rate
        const elapsed = Date.now() - reqStart;
        if (elapsed < interval) {
          await new Promise(r => setTimeout(r, interval - elapsed));
        }
      }

      const successRate = results.filter(r => r.success).length / results.length;
      const avgLatency = results.reduce((a, r) => a + r.latency, 0) / results.length;
      const maxLatency = Math.max(...results.map(r => r.latency));

      console.log(`Sustained load: ${results.length} requests, ${(successRate * 100).toFixed(1)}% success`);
      console.log(`Avg latency: ${avgLatency.toFixed(2)}ms, Max: ${maxLatency}ms`);

      expect(successRate).toBeGreaterThan(0.95);
      expect(avgLatency).toBeLessThan(200);
    }, 60000);
  });

  describe('Scenario 3: Gradual Ramp-up', () => {
    it('should scale smoothly from 10 to 100 RPS', async () => {
      mockPgQuery.mockResolvedValue({ rows: [] });

      const stages = [
        { rps: 10, duration: 5000 },
        { rps: 25, duration: 5000 },
        { rps: 50, duration: 5000 },
        { rps: 75, duration: 5000 },
        { rps: 100, duration: 5000 }
      ];

      const allResults: { rps: number; successRate: number; avgLatency: number }[] = [];

      for (const stage of stages) {
        const results: { success: boolean; latency: number }[] = [];
        const interval = 1000 / stage.rps;
        const stageStart = Date.now();

        while (Date.now() - stageStart < stage.duration) {
          const reqStart = Date.now();
          try {
            await createEpisode({ premise: `Ramp ${stage.rps} RPS` });
            results.push({ success: true, latency: Date.now() - reqStart });
          } catch (err) {
            results.push({ success: false, latency: Date.now() - reqStart });
          }
          
          const elapsed = Date.now() - reqStart;
          if (elapsed < interval) {
            await new Promise(r => setTimeout(r, interval - elapsed));
          }
        }

        const successRate = results.filter(r => r.success).length / results.length;
        const avgLatency = results.reduce((a, r) => a + r.latency, 0) / results.length;
        
        allResults.push({ rps: stage.rps, successRate, avgLatency });
        console.log(`${stage.rps} RPS: ${(successRate * 100).toFixed(1)}% success, ${avgLatency.toFixed(2)}ms avg`);
      }

      // Verify degradation is graceful
      for (let i = 1; i < allResults.length; i++) {
        const latencyIncrease = allResults[i].avgLatency / allResults[i - 1].avgLatency;
        expect(latencyIncrease).toBeLessThan(3); // Max 3x latency increase per stage
        expect(allResults[i].successRate).toBeGreaterThan(0.90);
      }
    }, 45000);
  });

  describe('Scenario 4: Burst Traffic with Recovery', () => {
    it('should recover quickly after traffic burst', async () => {
      mockPgQuery.mockResolvedValue({ rows: [] });

      // Burst phase
      const burstSize = 200;
      const burstStart = Date.now();
      
      const burstRequests = Array.from({ length: burstSize }, () =
        createEpisode({ premise: 'Burst' }).catch(() => null)
      );
      
      await Promise.all(burstRequests);
      const burstDuration = Date.now() - burstStart;

      // Recovery phase - measure baseline
      await new Promise(r => setTimeout(r, 1000));
      
      const recoveryLatencies: number[] = [];
      for (let i = 0; i < 10; i++) {
        const start = Date.now();
        await createEpisode({ premise: 'Recovery test' });
        recoveryLatencies.push(Date.now() - start);
      }

      const avgRecoveryLatency = recoveryLatencies.reduce((a, b) => a + b, 0) / recoveryLatencies.length;
      
      console.log(`Burst handled ${burstSize} in ${burstDuration}ms`);
      console.log(`Recovery avg latency: ${avgRecoveryLatency.toFixed(2)}ms`);

      expect(avgRecoveryLatency).toBeLessThan(100); // Quick recovery to baseline
    });
  });

  describe('Scenario 5: Mixed Workload', () => {
    it('should handle mixed operations under load', async () => {
      const episodeId = uuidv4();
      
      mockPgQuery
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValue({ 
          rows: [{ id: episodeId, title: 'Test', status: 'processing' }] 
        });

      const operations = [
        () => createEpisode({ premise: 'Create operation' }),
        () => getEpisodeStatus(episodeId),
        () => progressToNextStage(episodeId, 'script', {}),
        () => createEpisode({ premise: 'Another create' }),
        () => getEpisodeStatus(episodeId),
      ];

      const results: { type: string; success: boolean; latency: number }[] = [];
      const startTime = Date.now();
      const duration = 10000; // 10 seconds

      while (Date.now() - startTime < duration) {
        const operation = operations[Math.floor(Math.random() * operations.length)];
        const type = operation.toString().includes('createEpisode') ? 'create' :
                     operation.toString().includes('getEpisodeStatus') ? 'status' : 'progress';
        
        const opStart = Date.now();
        try {
          await operation();
          results.push({ type, success: true, latency: Date.now() - opStart });
        } catch (err) {
          results.push({ type, success: false, latency: Date.now() - opStart });
        }

        // Small delay to prevent overwhelming
        await new Promise(r => setTimeout(r, 50));
      }

      const byType = results.reduce((acc, r) => {
        if (!acc[r.type]) acc[r.type] = [];
        acc[r.type].push(r);
        return acc;
      }, {} as Record<string, typeof results>);

      console.log('Mixed workload results:');
      for (const [type, ops] of Object.entries(byType)) {
        const successRate = ops.filter(o => o.success).length / ops.length;
        const avgLatency = ops.reduce((a, o) => a + o.latency, 0) / ops.length;
        console.log(`  ${type}: ${ops.length} ops, ${(successRate * 100).toFixed(1)}% success, ${avgLatency.toFixed(2)}ms avg`);
      }

      expect(results.filter(r => r.success).length / results.length).toBeGreaterThan(0.95);
    }, 15000);
  });

  describe('Scenario 6: Resource Exhaustion', () => {
    it('should gracefully handle database connection limits', async () => {
      let connectionCount = 0;
      const maxConnections = 100;

      mockPgQuery.mockImplementation(async () => {
        connectionCount++;
        if (connectionCount > maxConnections) {
          throw new Error('FATAL: sorry, too many clients already');
        }
        await new Promise(r => setTimeout(r, 10)); // Simulate query time
        connectionCount--;
        return { rows: [] };
      });

      const requests = Array.from({ length: 200 }, (_, i) =
        createEpisode({ premise: `Connection test ${i}` })
          .then(() => ({ success: true }))
          .catch(err => ({ success: false, error: err.message }))
      );

      const results = await Promise.all(requests);
      const failures = results.filter(r => !r.success);

      console.log(`Connection limit test: ${failures.length} failures out of ${results.length}`);

      // Should have some failures but system should not crash
      expect(failures.length).toBeGreaterThan(0);
      expect(failures.length).toBeLessThan(results.length * 0.5);
    });
  });

  describe('Scenario 7: Queue Backpressure', () => {
    it('should handle queue backlog gracefully', async () => {
      // Simulate slow queue processing
      mockQueueAdd.mockImplementation(async () => {
        await new Promise(r => setTimeout(r, 100)); // Slow queue
        return { id: 'slow-job-id' };
      });

      mockPgQuery.mockResolvedValue({ rows: [] });

      const startTime = Date.now();
      const requests = Array.from({ length: 50 }, (_, i) =
        createEpisode({ premise: `Backpressure test ${i}` })
      );

      const results = await Promise.all(requests);
      const duration = Date.now() - startTime;

      console.log(`Queue backpressure: 50 episodes in ${duration}ms`);

      // Should complete despite queue slowness
      expect(results).toHaveLength(50);
      expect(duration).toBeLessThan(15000);
    });
  });

  describe('Scenario 8: Error Storm', () => {
    it('should recover from intermittent failures', async () => {
      let requestCount = 0;
      const errorRate = 0.3; // 30% error rate

      mockPgQuery.mockImplementation(() => {
        requestCount++;
        if (Math.random() < errorRate) {
          return Promise.reject(new Error('Random failure'));
        }
        return Promise.resolve({ rows: [] });
      });

      const results: boolean[] = [];
      
      // Phase 1: High error rate
      for (let i = 0; i < 30; i++) {
        try {
          await createEpisode({ premise: 'Error storm' });
          results.push(true);
        } catch {
          results.push(false);
        }
      }

      // Phase 2: Recovery
      mockPgQuery.mockResolvedValue({ rows: [] });
      
      const recoveryResults: boolean[] = [];
      for (let i = 0; i < 20; i++) {
        try {
          await createEpisode({ premise: 'Recovery' });
          recoveryResults.push(true);
        } catch {
          recoveryResults.push(false);
        }
      }

      const errorPhaseSuccess = results.filter(r => r).length / results.length;
      const recoveryPhaseSuccess = recoveryResults.filter(r => r).length / recoveryResults.length;

      console.log(`Error storm: ${(errorPhaseSuccess * 100).toFixed(1)}% success during errors`);
      console.log(`Recovery: ${(recoveryPhaseSuccess * 100).toFixed(1)}% success after recovery`);

      expect(errorPhaseSuccess).toBeLessThan(0.8); // Expect errors
      expect(recoveryPhaseSuccess).toBeGreaterThan(0.95); // Should recover fully
    });
  });
});
