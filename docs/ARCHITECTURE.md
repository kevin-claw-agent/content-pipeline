# Architecture Documentation

## System Overview

The Content Pipeline is a distributed, multi-agent system for AI-powered short drama video production. It uses a pipeline architecture where each stage of production is handled by specialized workers communicating through message queues.

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              API Layer (Express)                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │ POST        │  │ GET         │  │ GET         │  │ DELETE              │ │
│  │ /episodes   │  │ /episodes   │  │ /episodes/:id│  │ /episodes/:id       │ │
│  └──────┬──────┘  └─────────────┘  └─────────────┘  └─────────────────────┘ │
│         │                                                                   │
│         ▼                                                                   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    Orchestrator (BullMQ Queues)                      │   │
│  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌─────────────┐ │   │
│  │  │ script-queue │ │ visual-queue │ │ render-queue │ │ compose-queue│   │
│  │  └──────┬───────┘ └──────┬───────┘ └──────┬───────┘ └──────┬──────┘ │   │
│  └─────────┼────────────────┼────────────────┼────────────────┼────────┘   │
└────────────┼────────────────┼────────────────┼────────────────┼────────────┘
             │                │                │                │
             ▼                ▼                ▼                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Worker Pool                                       │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐  ┌────────────┐ │
│  │ ScriptAgent    │  │ VisualAgent    │  │ RenderAgent    │  │ Composer   │ │
│  │                │  │                │  │                │  │            │ │
│  │ • LLM Prompt   │  │ • Shot Breakdown│  │ • Video Gen    │  │ • Stitch   │ │
│  │ • Script Gen   │  │ • Prompt Eng   │  │ • Image-to-Vid │  │ • Export   │ │
│  └───────┬────────┘  └───────┬────────┘  └───────┬────────┘  └─────┬──────┘ │
│          │                   │                   │                  │       │
│          └───────────────────┴───────────────────┴──────────────────┘       │
│                                     │                                       │
│                              PostgreSQL (State)                             │
│                              Redis (Queues)                                 │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Storage Layer (S3/MinIO)                            │
│                                                                             │
│  episodes/                                                                  │
│  ├── {episode-id}/                                                          │
│  │   ├── script.json                                                        │
│  │   ├── storyboard.json                                                    │
│  │   ├── shots/                                                             │
│  │   │   ├── shot-1.png                                                     │
│  │   │   └── shot-2.png                                                     │
│  │   ├── renders/                                                           │
│  │   │   ├── shot-1.mp4                                                     │
│  │   │   └── shot-2.mp4                                                     │
│  │   └── final/                                                             │
│  │       └── video.mp4                                                       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Data Flow

### 1. Episode Creation Flow

```
User Request
    │
    ▼
┌─────────────┐    ┌────────────────┐    ┌────────────────┐
│   API       │───▶│  Orchestrator  │───▶│   PostgreSQL   │
│  /episodes  │    │  createEpisode │    │ episodes table │
└─────────────┘    └───────┬────────┘    └────────────────┘
                           │
                           ▼
                    ┌──────────────┐
                    │ Redis/BullMQ │
                    │ script-queue │
                    └──────────────┘
```

### 2. Pipeline Processing Flow

```
Script Generation (ScriptAgent)
    │
    ├── Input: premise, targetDuration
    ├── LLM Call: Generate script with scenes
    ├── Output: script.json
    └── Trigger: progressToNextStage('script', script)
                │
                ▼
Storyboard Generation (VisualAgent)
    │
    ├── Input: script (scenes, visualStyle)
    ├── LLM Call: Break down into shots
    ├── Output: storyboard.json + shot images
    └── Trigger: progressToNextStage('storyboard', storyboard)
                │
                ▼
Video Rendering (RenderAgent)
    │
    ├── Input: storyboard (shots)
    ├── API Calls: Image-to-video generation
    ├── Output: shot video clips (.mp4)
    └── Trigger: progressToNextStage('render', renders)
                │
                ▼
Video Composition (Composer)
    │
    ├── Input: rendered video clips
    ├── Process: Stitch clips, add transitions
    ├── Output: final video.mp4
    └── Update: episodes.status = 'completed'
```

---

## Component Details

### API Layer (`src/api/index.ts`)

Express.js REST API handling HTTP requests.

**Responsibilities:**
- Episode CRUD operations
- Request validation
- Error handling
- Response formatting

### Orchestrator (`src/orchestrator/index.ts`)

Central coordination layer managing pipeline state and queue operations.

**Responsibilities:**
- Episode lifecycle management
- Job queue management (BullMQ)
- Database operations
- Stage progression logic

**Key Functions:**
- `createEpisode()` - Initialize new episode
- `getEpisodeStatus()` - Retrieve episode state
- `progressToNextStage()` - Advance pipeline stage
- `listEpisodes()` - Query episodes

### Workers

#### ScriptAgent (`src/workers/scriptAgent.ts`)

Generates script from premise using LLM.

**Input:** `premise`, `targetDuration`
**Output:** Script with scenes, dialogue, visual style
**Queue:** `script-generation`

#### VisualAgent (`src/workers/visualAgent.ts`)

Breaks down script into detailed shot descriptions.

**Input:** Script (scenes, visualStyle)
**Output:** Storyboard with shot descriptions and image prompts
**Queue:** `storyboard-generation`

#### RenderAgent (`src/workers/renderAgent.ts`)

Generates video clips from storyboard shots.

**Input:** Storyboard (shots)
**Output:** Video clips for each shot
**Queue:** `render-generation`
**Note:** Currently simulates rendering; integrates with Runway/Pika in production

#### Composer (`src/workers/composer.ts`)

Stitches video clips into final output.

**Input:** Rendered video clips
**Output:** Final composed video
**Queue:** `video-composition`
**Note:** Currently simulates composition; uses FFmpeg in production

### Storage Layer (`src/storage/index.ts`)

Abstraction over S3-compatible storage (AWS S3 or MinIO).

**Features:**
- Buffer upload/download
- JSON/text file handling
- Presigned URL generation
- Multi-file operations

### Database Schema

See `schema.sql` for full definitions.

**Tables:**
- `episodes` - Episode metadata and status
- `jobs` - Individual stage jobs
- `assets` - Generated files reference
- `model_calls` - LLM call tracking (costs)

---

## Queue System

BullMQ provides:
- **Job persistence** - Jobs survive restarts
- **Retry logic** - Automatic retry with exponential backoff
- **Concurrency control** - Limit parallel processing
- **Job priorities** - Queue ordering
- **Event handling** - Success/failure callbacks

**Queue Configuration:**
```typescript
{
  attempts: 3,
  backoff: { type: 'exponential', delay: 5000 }
}
```

---

## Scaling Considerations

### Horizontal Scaling

Workers can be scaled independently:

```bash
# Scale specific workers
npm run worker:script  # Instance 1
npm run worker:script  # Instance 2 (more script workers)
```

### Resource Requirements

| Component | CPU | Memory | Notes |
|-----------|-----|--------|-------|
| API | Low | Low | Stateless, horizontally scalable |
| ScriptAgent | Medium | Low | LLM API calls, network bound |
| VisualAgent | Medium | Low | LLM API calls, network bound |
| RenderAgent | Low | Low | Currently simulated |
| Composer | Low | Low | Currently simulated |
| PostgreSQL | Low-Med | Med | Scales with episode volume |
| Redis | Low | Low | Queue storage |

**Production Rendering:**
When integrated with actual video generation APIs (Runway, Pika), RenderAgent becomes network and potentially GPU intensive.

---

## Extension Guide

### Adding a New Pipeline Stage

1. **Create Worker** (`src/workers/newStage.ts`):
```typescript
export const newWorker = new Worker('new-stage', async (job) => {
  // Process logic
  await progressToNextStage(episodeId, 'newStage', outputData);
});
```

2. **Add Queue** (`src/orchestrator/index.ts`):
```typescript
export const newQueue = new Queue('new-stage', { connection: redis });
```

3. **Update Stage Flow** (`src/orchestrator/index.ts`):
```typescript
const stageFlow: Record<string, { next: string; queue: Queue }> = {
  // ... existing stages
  'previousStage': { next: 'newStage', queue: newQueue },
  'newStage': { next: 'nextStage', queue: nextQueue },
};
```

4. **Add Tests** (`test/workers/newStage.test.ts`)

### Adding New Asset Types

Update the `assets` table type field and handle in workers:

```typescript
await pg.query(
  `INSERT INTO assets (episode_id, job_id, type, uri, metadata) 
   VALUES ($1, $2, $3, $4, $5)`,
  [episodeId, jobId, 'newType', uri, metadata]
);
```

### Custom Storage Backend

Implement the storage interface in `src/storage/`:

```typescript
export async function uploadBuffer(key: string, buffer: Buffer): Promise<string>;
export async function downloadBuffer(key: string): Promise<Buffer>;
export async function deleteFile(key: string): Promise<void>;
```

---

## Monitoring Points

| Metric | Source | Query |
|--------|--------|-------|
| Queue Depth | Redis | `LLEN bull:script-generation:wait` |
| Episode Count | PostgreSQL | `SELECT COUNT(*) FROM episodes` |
| Success Rate | PostgreSQL | `SELECT status, COUNT(*) FROM jobs GROUP BY status` |
| Avg Duration | PostgreSQL | `SELECT AVG(completed_at - created_at) FROM episodes WHERE status='completed'` |
| Storage Usage | S3/MinIO | Bucket metrics API |

---

## Security Considerations

1. **API Authentication** - Add middleware for production
2. **Storage Access** - Use presigned URLs for client access
3. **Input Validation** - Zod schemas for request validation
4. **Rate Limiting** - Protect against abuse
5. **Secret Management** - Use environment variables, never commit secrets
