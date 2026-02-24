import { Queue, Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config';

// Load environment variables
try {
  require('dotenv').config();
} catch { /* ignore if dotenv not installed */ }

// Redis connection
const redis = new Redis(config.redisUrl);

// PostgreSQL connection
const pg = new Pool({ connectionString: config.databaseUrl });

// Job queues for each stage
const scriptQueue = new Queue('script-generation', { connection: redis });
const visualQueue = new Queue('storyboard-generation', { connection: redis });
const renderQueue = new Queue('render-generation', { connection: redis });
const composeQueue = new Queue('video-composition', { connection: redis });

interface EpisodeRequest {
  title?: string;
  premise: string;
  targetDuration?: number;
}

interface Episode {
  id: string;
  title: string;
  premise: string;
  status: string;
  targetDuration: number;
}

// Create new episode and start pipeline
export async function createEpisode(request: EpisodeRequest): Promise<Episode> {
  const id = uuidv4();
  const title = request.title || `Episode-${Date.now()}`;
  const targetDuration = request.targetDuration || 30;

  // Create episode record
  await pg.query(
    `INSERT INTO episodes (id, title, premise, status, target_duration) 
     VALUES ($1, $2, $3, $4, $5)`,
    [id, title, request.premise, 'pending', targetDuration]
  );

  // Start pipeline: Stage 1 - Script Generation
  await scriptQueue.add('generate-script', {
    episodeId: id,
    premise: request.premise,
    targetDuration
  }, {
    jobId: `script-${id}`,
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 }
  });

  console.log(`[Orchestrator] Episode ${id} created, script job queued`);

  return {
    id,
    title,
    premise: request.premise,
    status: 'pending',
    targetDuration
  };
}

// Get episode status
export async function getEpisodeStatus(episodeId: string) {
  const episodeRes = await pg.query(
    'SELECT * FROM episodes WHERE id = $1',
    [episodeId]
  );
  
  if (episodeRes.rows.length === 0) {
    return null;
  }

  const jobsRes = await pg.query(
    'SELECT * FROM jobs WHERE episode_id = $1 ORDER BY created_at',
    [episodeId]
  );

  const assetsRes = await pg.query(
    'SELECT * FROM assets WHERE episode_id = $1',
    [episodeId]
  );

  return {
    episode: episodeRes.rows[0],
    jobs: jobsRes.rows,
    assets: assetsRes.rows
  };
}

// Progress to next stage
export async function progressToNextStage(
  episodeId: string, 
  currentStage: string, 
  outputData: any
) {
  const stageFlow: Record<string, { next: string; queue: Queue }> = {
    'script': { next: 'storyboard', queue: visualQueue },
    'storyboard': { next: 'render', queue: renderQueue },
    'render': { next: 'compose', queue: composeQueue }
  };

  const current = stageFlow[currentStage];
  if (!current) {
    // Final stage completed
    await pg.query(
      "UPDATE episodes SET status = 'completed', completed_at = NOW() WHERE id = $1",
      [episodeId]
    );
    console.log(`[Orchestrator] Episode ${episodeId} completed!`);
    return;
  }

  // Create job for next stage
  const jobId = `${current.next}-${episodeId}`;
  await current.queue.add(`${current.next}-generation`, {
    episodeId,
    inputData: outputData,
    stage: current.next
  }, {
    jobId,
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 }
  });

  console.log(`[Orchestrator] Episode ${episodeId} progressed to ${current.next}`);
}

// List episodes
export async function listEpisodes(limit = 10, offset = 0) {
  const res = await pg.query(
    'SELECT * FROM episodes ORDER BY created_at DESC LIMIT $1 OFFSET $2',
    [limit, offset]
  );
  return res.rows;
}

export { pg, redis, scriptQueue, visualQueue, renderQueue, composeQueue };
