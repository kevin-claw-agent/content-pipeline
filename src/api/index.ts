import express from 'express';
import { createEpisode, getEpisodeStatus, listEpisodes } from './orchestrator';

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
