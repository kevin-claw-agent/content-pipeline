import 'dotenv/config';
import { Worker, Job } from 'bullmq';
import { pg, redis, progressToNextStage } from '../orchestrator';
import { callLLM } from '../utils/llm';

// VisualAgent Worker - Storyboard Generation
interface Scene {
  sceneNumber: number;
  description: string;
  dialogue?: string;
  duration: number;
}

interface Script {
  scenes: Scene[];
  totalDuration: number;
  visualStyle: string;
}

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

export const visualWorker = new Worker('storyboard-generation', async (job: Job) => {
  const { episodeId, inputData } = job.data;
  const script: Script = inputData;
  
  console.log(`[VisualAgent] Starting storyboard generation for ${episodeId}`);

  // Create job record
  const jobRes = await pg.query(
    `INSERT INTO jobs (episode_id, stage, status, input_data) 
     VALUES ($1, $2, $3, $4) RETURNING id`,
    [episodeId, 'storyboard', 'running', JSON.stringify(script)]
  );
  const jobId = jobRes.rows[0].id;

  try {
    // Generate storyboard/shots using LLM
    const prompt = `
Create a detailed storyboard for the following script.

Visual Style: ${script.visualStyle}

Scenes:
${script.scenes.map((s: Scene) => `
Scene ${s.sceneNumber}:
Description: ${s.description}
Dialogue: ${s.dialogue || 'None'}
Duration: ${s.duration}s
`).join('\n')}

Break down each scene into individual shots. For each shot, provide:
- shotNumber: sequential number
- sceneNumber: which scene this shot belongs to
- description: detailed visual description
- cameraAngle: camera angle and movement (e.g., "Wide shot, slow zoom in")
- lighting: lighting setup (e.g., "Warm golden hour")
- duration: duration in seconds
- promptForImage: detailed prompt for AI image generation

Format as JSON with structure:
{
  "shots": [...],
  "totalShots": number,
  "visualStyle": "description"
}
`;

    const storyboardResult = await callLLM(prompt, 'storyboard-generation');
    const storyboard: Storyboard = JSON.parse(storyboardResult);

    // Update job status
    await pg.query(
      `UPDATE jobs SET status = 'completed', output_data = $1, completed_at = NOW() 
       WHERE id = $2`,
      [JSON.stringify(storyboard), jobId]
    );

    // Store storyboard as asset
    await pg.query(
      `INSERT INTO assets (episode_id, job_id, type, uri, metadata) 
       VALUES ($1, $2, $3, $4, $5)`,
      [episodeId, jobId, 'storyboard', `episodes/${episodeId}/storyboard.json`, JSON.stringify(storyboard)]
    );

    // Store individual shot assets
    for (const shot of storyboard.shots) {
      await pg.query(
        `INSERT INTO assets (episode_id, job_id, type, uri, metadata) 
         VALUES ($1, $2, $3, $4, $5)`,
        [episodeId, jobId, 'image', `episodes/${episodeId}/shots/shot-${shot.shotNumber}.png`, JSON.stringify(shot)]
      );
    }

    console.log(`[VisualAgent] Storyboard generated for ${episodeId}: ${storyboard.totalShots} shots`);

    // Progress to next stage (render)
    await progressToNextStage(episodeId, 'storyboard', storyboard);

    return { success: true, storyboard };
  } catch (error) {
    console.error(`[VisualAgent] Failed:`, error);
    await pg.query(
      `UPDATE jobs SET status = 'failed', error_message = $1 WHERE id = $2`,
      [error instanceof Error ? error.message : 'Unknown error', jobId]
    );
    throw error;
  }
}, { connection: redis, concurrency: 2 });

visualWorker.on('completed', (job) => {
  console.log(`[VisualAgent] Job ${job.id} completed`);
});

visualWorker.on('failed', (job, err) => {
  console.error(`[VisualAgent] Job ${job?.id} failed:`, err);
});

console.log('[VisualAgent] Worker started');
