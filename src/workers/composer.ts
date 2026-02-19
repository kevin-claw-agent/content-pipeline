import 'dotenv/config';
import { Worker, Job } from 'bullmq';
import { pg, redis } from '../orchestrator';

// Composer Worker - Video Composition
interface RenderResult {
  shotNumber: number;
  videoUri: string;
  duration: number;
  status: 'success' | 'failed';
}

interface RenderOutput {
  storyboard: any;
  renders: RenderResult[];
  totalRenders: number;
  successfulRenders: number;
}

export const composerWorker = new Worker('video-composition', async (job: Job) => {
  const { episodeId, inputData } = job.data;
  const renderOutput: RenderOutput = inputData;
  
  console.log(`[Composer] Starting video composition for ${episodeId}`);

  // Create job record
  const jobRes = await pg.query(
    `INSERT INTO jobs (episode_id, stage, status, input_data) 
     VALUES ($1, $2, $3, $4) RETURNING id`,
    [episodeId, 'compose', 'running', JSON.stringify(renderOutput)]
  );
  const jobId = jobRes.rows[0].id;

  try {
    // Get successful renders
    const successfulRenders = renderOutput.renders.filter(r => r.status === 'success');
    
    if (successfulRenders.length === 0) {
      throw new Error('No successful renders to compose');
    }

    // Sort by shot number
    successfulRenders.sort((a, b) => a.shotNumber - b.shotNumber);

    console.log(`[Composer] Composing ${successfulRenders.length} video segments`);

    // Simulate video composition
    const compositionResult = await composeVideo(episodeId, successfulRenders, jobId);

    // Update episode status to completed
    await pg.query(
      `UPDATE episodes SET status = 'completed', completed_at = NOW(), updated_at = NOW() WHERE id = $1`,
      [episodeId]
    );

    // Update job status
    await pg.query(
      `UPDATE jobs SET status = 'completed', output_data = $1, completed_at = NOW() 
       WHERE id = $2`,
      [JSON.stringify(compositionResult), jobId]
    );

    // Store final video as asset
    await pg.query(
      `INSERT INTO assets (episode_id, job_id, type, uri, metadata) 
       VALUES ($1, $2, $3, $4, $5)`,
      [episodeId, jobId, 'video', compositionResult.finalVideoUri, JSON.stringify({
        duration: compositionResult.totalDuration,
        segments: successfulRenders.length,
        format: 'mp4',
        resolution: '1080p'
      })]
    );

    console.log(`[Composer] Video composition completed for ${episodeId}`);
    console.log(`[Composer] Final video: ${compositionResult.finalVideoUri}`);
    console.log(`[Composer] Total duration: ${compositionResult.totalDuration}s`);

    return { success: true, compositionResult };
  } catch (error) {
    console.error(`[Composer] Failed:`, error);
    
    // Update episode status to failed
    await pg.query(
      `UPDATE episodes SET status = 'failed', updated_at = NOW() WHERE id = $1`,
      [episodeId]
    );

    await pg.query(
      `UPDATE jobs SET status = 'failed', error_message = $1 WHERE id = $2`,
      [error instanceof Error ? error.message : 'Unknown error', jobId]
    );
    throw error;
  }
}, { connection: redis, concurrency: 1 });

// Simulate or perform actual video composition
async function composeVideo(
  episodeId: string, 
  renders: RenderResult[], 
  jobId: string
): Promise<{ finalVideoUri: string; totalDuration: number; segments: number }> {
  
  // In production, this would:
  // 1. Use FFmpeg to concatenate video segments
  // 2. Add transitions, audio, effects
  // 3. Export final video to S3/MinIO

  // For MVP, simulate the composition process
  const totalDuration = renders.reduce((sum, r) => sum + r.duration, 0);
  const simulateTime = Math.min(renders.length * 1000, 10000);
  
  await new Promise(resolve => setTimeout(resolve, simulateTime));

  return {
    finalVideoUri: `episodes/${episodeId}/final/video.mp4`,
    totalDuration,
    segments: renders.length
  };
}

composerWorker.on('completed', (job) => {
  console.log(`[Composer] Job ${job.id} completed`);
});

composerWorker.on('failed', (job, err) => {
  console.error(`[Composer] Job ${job?.id} failed:`, err);
});

console.log('[Composer] Worker started');
