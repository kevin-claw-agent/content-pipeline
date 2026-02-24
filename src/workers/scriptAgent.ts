import 'dotenv/config';
import { Worker, Job } from 'bullmq';
import { pg, redis, progressToNextStage } from '../orchestrator';
import { callLLM } from '../utils/llm';

// Script Generation Worker
export const scriptWorker = new Worker('script-generation', async (job: Job) => {
  const { episodeId, premise, targetDuration } = job.data;
  
  console.log(`[ScriptAgent] Starting script generation for ${episodeId}`);

  // Create job record
  const jobRes = await pg.query(
    `INSERT INTO jobs (episode_id, stage, status, input_data) 
     VALUES ($1, $2, $3, $4) RETURNING id`,
    [episodeId, 'script', 'running', JSON.stringify({ premise, targetDuration })]
  );
  const jobId = jobRes.rows[0].id;

  try {
    // Generate script using LLM
    const prompt = `
Create a short drama script (approximately ${targetDuration} seconds) based on this premise:
"${premise}"

Format the output as JSON with:
- scenes: array of scenes with description, characters, dialogue
- totalDuration: estimated duration in seconds
- visualStyle: description of visual style
`;

    const scriptResult = await callLLM(prompt, 'script-generation');
    const script = JSON.parse(scriptResult);

    // Update job status
    await pg.query(
      `UPDATE jobs SET status = 'completed', output_data = $1, completed_at = NOW() 
       WHERE id = $2`,
      [JSON.stringify(script), jobId]
    );

    // Store script as asset
    await pg.query(
      `INSERT INTO assets (episode_id, job_id, type, uri, metadata) 
       VALUES ($1, $2, $3, $4, $5)`,
      [episodeId, jobId, 'script', `episodes/${episodeId}/script.json`, JSON.stringify(script)]
    );

    console.log(`[ScriptAgent] Script generated for ${episodeId}`);

    // Progress to next stage
    await progressToNextStage(episodeId, 'script', script);

    return { success: true, script };
  } catch (error) {
    console.error(`[ScriptAgent] Failed:`, error);
    await pg.query(
      `UPDATE jobs SET status = 'failed', error_message = $1 WHERE id = $2`,
      [error instanceof Error ? error.message : 'Unknown error', jobId]
    );
    throw error;
  }
}, { connection: redis, concurrency: 2 });

scriptWorker.on('completed', (job) => {
  console.log(`[ScriptAgent] Job ${job.id} completed`);
});

scriptWorker.on('failed', (job, err) => {
  console.error(`[ScriptAgent] Job ${job?.id} failed:`, err);
});

console.log('[ScriptAgent] Worker started');
