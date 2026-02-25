# API Documentation

Content Pipeline REST API for AI-powered short drama video production.

Base URL: `http://localhost:3000` (or your configured `PORT`)

---

## Endpoints Overview

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| POST | `/episodes` | Create a new episode |
| GET | `/episodes` | List all episodes |
| GET | `/episodes/:id` | Get episode status |
| GET | `/episodes/:id/assets` | Get episode assets |
| DELETE | `/episodes/:id` | Delete an episode |

---

## Health Check

### GET /health

Check if the API service is running.

**Response:**
```json
{
  "status": "ok",
  "service": "content-pipeline"
}
```

**Status Codes:**
- `200` - Service is healthy

---

## Episodes

### POST /episodes

Create a new episode and start the video production pipeline.

**Request Body:**
```json
{
  "title": "Coffee Shop Romance",
  "premise": "Two strangers meet at a coffee shop and fall in love",
  "targetDuration": 60
}
```

**Parameters:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `premise` | string | Yes | Story premise/prompt for the episode |
| `title` | string | No | Episode title (auto-generated if not provided) |
| `targetDuration` | number | No | Target duration in seconds (default: 30) |

**Response (201 Created):**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "title": "Coffee Shop Romance",
  "premise": "Two strangers meet at a coffee shop and fall in love",
  "status": "pending",
  "targetDuration": 60
}
```

**Error Responses:**

`400 Bad Request` - Missing required field:
```json
{
  "error": "premise is required"
}
```

`500 Internal Server Error` - Server error:
```json
{
  "error": "Failed to create episode"
}
```

---

### GET /episodes

List all episodes with pagination.

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `limit` | number | 10 | Maximum number of episodes to return |
| `offset` | number | 0 | Number of episodes to skip |

**Response (200 OK):**
```json
{
  "episodes": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "title": "Coffee Shop Romance",
      "premise": "Two strangers meet at a coffee shop...",
      "status": "completed",
      "target_duration": 60,
      "created_at": "2024-01-15T10:00:00Z",
      "completed_at": "2024-01-15T10:05:30Z"
    }
  ],
  "count": 1
}
```

---

### GET /episodes/:id

Get detailed status of an episode including all jobs and assets.

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Episode UUID |

**Response (200 OK):**
```json
{
  "episode": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "title": "Coffee Shop Romance",
    "premise": "Two strangers meet at a coffee shop...",
    "status": "completed",
    "target_duration": 60,
    "created_at": "2024-01-15T10:00:00Z",
    "updated_at": "2024-01-15T10:05:30Z",
    "completed_at": "2024-01-15T10:05:30Z"
  },
  "jobs": [
    {
      "id": "job-uuid-1",
      "stage": "script",
      "status": "completed",
      "created_at": "2024-01-15T10:00:05Z",
      "completed_at": "2024-01-15T10:00:30Z"
    },
    {
      "id": "job-uuid-2",
      "stage": "storyboard",
      "status": "completed",
      "created_at": "2024-01-15T10:00:35Z",
      "completed_at": "2024-01-15T10:01:45Z"
    },
    {
      "id": "job-uuid-3",
      "stage": "render",
      "status": "completed",
      "created_at": "2024-01-15T10:01:50Z",
      "completed_at": "2024-01-15T10:04:30Z"
    },
    {
      "id": "job-uuid-4",
      "stage": "compose",
      "status": "completed",
      "created_at": "2024-01-15T10:04:35Z",
      "completed_at": "2024-01-15T10:05:30Z"
    }
  ],
  "assets": [
    {
      "id": "asset-uuid-1",
      "type": "script",
      "uri": "episodes/550e8400-e29b-41d4-a716-446655440000/script.json",
      "metadata": { ... },
      "created_at": "2024-01-15T10:00:30Z"
    },
    {
      "id": "asset-uuid-2",
      "type": "image",
      "uri": "episodes/550e8400-e29b-41d4-a716-446655440000/shots/shot-1.png",
      "metadata": { ... },
      "created_at": "2024-01-15T10:01:45Z"
    },
    {
      "id": "asset-uuid-final",
      "type": "video",
      "uri": "episodes/550e8400-e29b-41d4-a716-446655440000/final/video.mp4",
      "metadata": {
        "duration": 60,
        "segments": 12,
        "format": "mp4",
        "resolution": "1080p"
      },
      "created_at": "2024-01-15T10:05:30Z"
    }
  ]
}
```

**Error Responses:**

`404 Not Found`:
```json
{
  "error": "Episode not found"
}
```

---

### GET /episodes/:id/assets

Get all assets for an episode, grouped by type.

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Episode UUID |

**Response (200 OK):**
```json
{
  "episodeId": "550e8400-e29b-41d4-a716-446655440000",
  "totalAssets": 15,
  "assetsByType": {
    "script": [
      {
        "id": "asset-1",
        "type": "script",
        "uri": "episodes/.../script.json",
        "metadata": { ... }
      }
    ],
    "image": [
      {
        "id": "asset-2",
        "type": "image",
        "uri": "episodes/.../shots/shot-1.png",
        "metadata": { ... }
      }
    ],
    "video": [
      {
        "id": "asset-final",
        "type": "video",
        "uri": "episodes/.../final/video.mp4",
        "metadata": { ... }
      }
    ]
  },
  "assets": [ /* flat array of all assets */ ]
}
```

---

### DELETE /episodes/:id

Delete an episode and all associated data (jobs, assets). Note: This does not delete files from storage (S3/MinIO).

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Episode UUID |

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Episode deleted successfully",
  "episodeId": "550e8400-e29b-41d4-a716-446655440000",
  "deletedAssets": 15
}
```

**Error Responses:**

`404 Not Found`:
```json
{
  "error": "Episode not found"
}
```

---

## Error Codes

| Status Code | Description |
|-------------|-------------|
| `200` | Success |
| `201` | Created successfully |
| `400` | Bad Request - Invalid input |
| `404` | Not Found - Resource doesn't exist |
| `500` | Internal Server Error |

---

## Episode Status Values

| Status | Description |
|--------|-------------|
| `pending` | Episode created, waiting for script generation |
| `script` | Script generation in progress |
| `storyboard` | Storyboard generation in progress |
| `render` | Video rendering in progress |
| `compose` | Video composition in progress |
| `completed` | Episode production complete |
| `failed` | Production failed at some stage |

---

## Job Stage Values

| Stage | Description |
|-------|-------------|
| `script` | Script generation |
| `storyboard` | Storyboard/visual planning |
| `render` | Video clip generation |
| `compose` | Final video composition |

---

## Asset Types

| Type | Description |
|------|-------------|
| `script` | JSON script document |
| `image` | Storyboard images |
| `video` | Video clips and final output |
| `audio` | Audio files (if applicable) |

---

## Example Usage

### Create an Episode

```bash
curl -X POST http://localhost:3000/episodes \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Space Adventure",
    "premise": "An astronaut discovers a mysterious alien artifact on Mars",
    "targetDuration": 45
  }'
```

### Check Episode Status

```bash
curl http://localhost:3000/episodes/550e8400-e29b-41d4-a716-446655440000
```

### List Recent Episodes

```bash
curl "http://localhost:3000/episodes?limit=5&offset=0"
```

### Download Final Video

```bash
# Get presigned URL from your storage (S3/MinIO)
# The final video URI is in the assets response
curl -O "https://your-storage.com/episodes/.../final/video.mp4"
```
