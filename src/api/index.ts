import 'dotenv/config';
import express from 'express';
import { createEpisode, getEpisodeStatus, listEpisodes, pg } from '../orchestrator';

const app = express();
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'content-pipeline' });
});

// Create new episode
app.post('/episodes', async (req, res) => {
  try {
    const { title, premise, targetDuration } = req.body;
    
    if (!premise) {
      return res.status(400).json({ error: 'premise is required' });
    }

    const episode = await createEpisode({ title, premise, targetDuration });
    res.status(201).json(episode);
  } catch (error) {
    console.error('Error creating episode:', error);
    res.status(500).json({ error: 'Failed to create episode' });
  }
});

// Get episode status
app.get('/episodes/:id', async (req, res) => {
  try {
    const status = await getEpisodeStatus(req.params.id);
    if (!status) {
      return res.status(404).json({ error: 'Episode not found' });
    }
    res.json(status);
  } catch (error) {
    console.error('Error getting episode:', error);
    res.status(500).json({ error: 'Failed to get episode' });
  }
});

// Get all assets for an episode
app.get('/episodes/:id/assets', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if episode exists
    const episodeRes = await pg.query('SELECT * FROM episodes WHERE id = $1', [id]);
    if (episodeRes.rows.length === 0) {
      return res.status(404).json({ error: 'Episode not found' });
    }

    // Get all assets
    const assetsRes = await pg.query(
      `SELECT a.*, j.stage as job_stage, j.status as job_status 
       FROM assets a 
       LEFT JOIN jobs j ON a.job_id = j.id 
       WHERE a.episode_id = $1 
       ORDER BY a.created_at`,
      [id]
    );

    // Group by type
    const assetsByType: Record<string, any[]> = {};
    for (const asset of assetsRes.rows) {
      if (!assetsByType[asset.type]) {
        assetsByType[asset.type] = [];
      }
      assetsByType[asset.type].push(asset);
    }

    res.json({
      episodeId: id,
      totalAssets: assetsRes.rows.length,
      assetsByType,
      assets: assetsRes.rows
    });
  } catch (error) {
    console.error('Error getting assets:', error);
    res.status(500).json({ error: 'Failed to get assets' });
  }
});

// Delete an episode and all its data
app.delete('/episodes/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if episode exists
    const episodeRes = await pg.query('SELECT * FROM episodes WHERE id = $1', [id]);
    if (episodeRes.rows.length === 0) {
      return res.status(404).json({ error: 'Episode not found' });
    }

    // Get all assets for deletion from storage (optional cleanup)
    const assetsRes = await pg.query('SELECT uri FROM assets WHERE episode_id = $1', [id]);
    const uris = assetsRes.rows.map(row => row.uri);
    
    // Delete episode (cascades to jobs and assets due to foreign keys)
    await pg.query('DELETE FROM episodes WHERE id = $1', [id]);

    // TODO: Optionally delete files from S3/MinIO
    // await deleteEpisodeFiles(uris);

    res.json({ 
      success: true, 
      message: 'Episode deleted successfully',
      episodeId: id,
      deletedAssets: uris.length
    });
  } catch (error) {
    console.error('Error deleting episode:', error);
    res.status(500).json({ error: 'Failed to delete episode' });
  }
});

// List episodes
app.get('/episodes', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const offset = parseInt(req.query.offset as string) || 0;
    const episodes = await listEpisodes(limit, offset);
    res.json({ episodes, count: episodes.length });
  } catch (error) {
    console.error('Error listing episodes:', error);
    res.status(500).json({ error: 'Failed to list episodes' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`[API] Content Pipeline API running on port ${PORT}`);
});

export default app;
