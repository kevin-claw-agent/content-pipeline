import 'dotenv/config';
import { Worker, Job } from 'bullmq';
import { pg, redis, progressToNextStage } from '../orchestrator';

// RenderAgent Worker - Video Generation
interface ShotDescription {
  shotNumber: number;
  sceneNumber: number;
  description: string;
  cameraAngle: string;
  lighting: string;
  duration: number;
  promptForImage: string;
}

interface Storyboard {
  shots: ShotDescription[];
  totalShots: number;
  visualStyle: string;
}

interface RenderResult {
  shotNumber: number;
  videoUri: string;
  duration: number;
  status: 'success' | 'failed';
}

export const renderWorker = new Worker('render-generation', async (job: Job) => {
  const { episodeId, inputData } = job.data;
  const storyboard: Storyboard = inputData;
  
  console.log(`[RenderAgent] Starting video render for ${episodeId}`);

  // Create job record
  const jobRes = await pg.query(
    `INSERT INTO jobs (episode_id, stage, status, input_data) 
     VALUES ($1, $2, $3, $4) RETURNING id`,
    [episodeId, 'render', 'running', JSON.stringify(storyboard)]
  );
  const jobId = jobRes.rows[0].id;

  const renderResults: RenderResult[] = [];

  try {
    // Render each shot
    for (const shot of storyboard.shots) {
      console.log(`[RenderAgent] Rendering shot ${shot.shotNumber}/${storyboard.totalShots}`);
      
      // Simulate video generation (or call external API like Runway, Pika, etc.)
      const renderResult = await renderShot(shot, episodeId, jobId);
      renderResults.push(renderResult);

      if (renderResult.status === 'success') {
        // Store video segment asset
        await pg.query(
          `INSERT INTO assets (episode_id, job_id, type, uri, metadata) 
           VALUES ($1, $2, $3, $4, $5)`,
          [episodeId, jobId, 'video', renderResult.videoUri, JSON.stringify({
            shotNumber: shot.shotNumber,
            sceneNumber: shot.sceneNumber,
            duration: renderResult.duration
          })]
        );
      }
    }

    const successCount = renderResults.filter(r => r.status === 'success').length;
    const outputData = {
      storyboard,
      renders: renderResults,
      totalRenders: renderResults.length,
      successfulRenders: successCount
    };

    // Update job status
    await pg.query(
      `UPDATE jobs SET status = 'completed', output_data = $1, completed_at = NOW() 
       WHERE id = $2`,
      [JSON.stringify(outputData), jobId]
    );

    console.log(`[RenderAgent] Video render completed for ${episodeId}: ${successCount}/${storyboard.totalShots} shots`);

    // Progress to next stage (composition)
    await progressToNextStage(episodeId, 'render', outputData);

    return { success: true, renderResults };
  } catch (error) {
    console.error(`[RenderAgent] Failed:`, error);
    await pg.query(
      `UPDATE jobs SET status = 'failed', error_message = $1 WHERE id = $2`,
      [error instanceof Error ? error.message : 'Unknown error', jobId]
    );
    throw error;
  }
}, { connection: redis, concurrency: 1 }); // Lower concurrency for video rendering

// Simulate or perform actual video rendering
async function renderShot(shot: ShotDescription, episodeId: string, jobId: string): Promise<RenderResult> {
  // In production, this would:
  // 1. Generate image using SD/Midjourney/DALL-E with shot.promptForImage
  // 2. Animate image using Runway/Pika/Deforum with shot.description
  // 3. Return video path

  // For MVP, simulate the rendering process
  const renderTime = Math.min(shot.duration * 100, 5000); // Simulate render time
  await new Promise(resolve => setTimeout(resolve, renderTime));

  // Simulate occasional failures (10% chance)
  if (Math.random() < 0.1) {
    return {
      shotNumber: shot.shotNumber,
      videoUri: '',
      duration: 0,
      status: 'failed'
    };
  }

  return {
    shotNumber: shot.shotNumber,
    videoUri: `episodes/${episodeId}/renders/shot-${shot.shotNumber}.mp4`,
    duration: shot.duration,
    status: 'success'
  };
}

renderWorker.on('completed', (job) => {
  console.log(`[RenderAgent] Job ${job.id} completed`);
});

renderWorker.on('failed', (job, err) => {
  console.error(`[RenderAgent] Job ${job?.id} failed:`, err);
});

console.log('[RenderAgent] Worker started');
