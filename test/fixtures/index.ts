/**
 * Test Fixtures - Mock Data for Testing
 */

export const mockScript = {
  title: "Coffee Shop Encounter",
  premise: "Two strangers meet at a coffee shop and discover they have more in common than expected.",
  scenes: [
    {
      sceneNumber: 1,
      description: "Interior - Coffee Shop - Day. Warm sunlight streams through large windows.",
      characters: ["ALEX", "JORDAN"],
      dialogue: [
        { speaker: "ALEX", text: "Is this seat taken?" },
        { speaker: "JORDAN", text: "Actually, I'm saving it for someone..." },
      ],
      duration: 15,
      visualNotes: "Wide shot, soft lighting",
    },
    {
      sceneNumber: 2,
      description: "Close up on the book Alex is holding.",
      characters: ["JORDAN"],
      dialogue: [
        { speaker: "JORDAN", text: "Wait, is that 'The Midnight Library'?" },
        { speaker: "ALEX", text: "Yeah! Have you read it?" },
      ],
      duration: 10,
      visualNotes: "Close up, warm tones",
    },
    {
      sceneNumber: 3,
      description: "Both characters laugh, realizing they share the same favorite book.",
      characters: ["ALEX", "JORDAN"],
      dialogue: [
        { speaker: "JORDAN", text: "It's my favorite! I was just recommending it to my friend." },
        { speaker: "ALEX", text: "No way! We should grab coffee sometime and discuss it." },
      ],
      duration: 15,
      visualNotes: "Two-shot, shallow depth of field",
    },
  ],
  totalDuration: 40,
  visualStyle: "Warm, cozy coffee shop aesthetic with soft natural lighting. Color palette: warm browns, soft creams, golden highlights.",
};

export const mockStoryboard = {
  shots: [
    {
      shotNumber: 1,
      sceneNumber: 1,
      description: "Wide establishing shot of cozy coffee shop interior",
      cameraAngle: "Wide shot, eye level",
      lighting: "Soft natural light from windows, warm interior lights",
      duration: 3,
      promptForImage: "Wide shot of cozy modern coffee shop interior, warm lighting, soft sunlight through large windows, wooden tables, plants, people sitting, cinematic photography, 4k, detailed",
    },
    {
      shotNumber: 2,
      sceneNumber: 1,
      description: "ALEX approaches JORDAN's table, holding a coffee cup",
      cameraAngle: "Medium shot, slight low angle",
      lighting: "Warm key light, soft fill",
      duration: 4,
      promptForImage: "Young person holding coffee cup approaching table in coffee shop, warm lighting, casual outfit, friendly expression, cinematic shot, shallow depth of field",
    },
    {
      shotNumber: 3,
      sceneNumber: 1,
      description: "JORDAN looking up, surprised expression",
      cameraAngle: "Close up",
      lighting: "Soft natural light on face",
      duration: 3,
      promptForImage: "Close up of surprised young person's face, warm coffee shop lighting, natural expression, soft focus background, cinematic portrait",
    },
    {
      shotNumber: 4,
      sceneNumber: 2,
      description: "Close up of 'The Midnight Library' book",
      cameraAngle: "Extreme close up, slight angle",
      lighting: "Warm side lighting highlighting book cover",
      duration: 3,
      promptForImage: "Close up of book 'The Midnight Library' being held, warm coffee shop lighting, shallow depth of field, cinematic detail shot",
    },
    {
      shotNumber: 5,
      sceneNumber: 2,
      description: "JORDAN's excited reaction",
      cameraAngle: "Medium close up",
      lighting: "Warm, expressive",
      duration: 4,
      promptForImage: "Young person's excited face, warm lighting, genuine smile, coffee shop background bokeh, cinematic portrait",
    },
    {
      shotNumber: 6,
      sceneNumber: 3,
      description: "Two-shot of both characters laughing together",
      cameraAngle: "Two-shot, over-the-shoulder",
      lighting: "Warm, friendly atmosphere",
      duration: 5,
      promptForImage: "Two young people laughing together at coffee shop table, warm lighting, friendly atmosphere, shallow depth of field, cinematic two-shot",
    },
    {
      shotNumber: 7,
      sceneNumber: 3,
      description: "Hands exchanging phone numbers",
      cameraAngle: "Close up of hands",
      lighting: "Warm, intimate",
      duration: 3,
      promptForImage: "Close up of two hands exchanging phones at coffee shop table, warm lighting, shallow depth of field, cinematic detail",
    },
  ],
  totalShots: 7,
  visualStyle: mockScript.visualStyle,
  totalDuration: 25,
};

export const mockRenderResults = {
  renders: [
    { shotNumber: 1, videoUri: "episodes/test/renders/shot-1.mp4", duration: 3, status: "success" },
    { shotNumber: 2, videoUri: "episodes/test/renders/shot-2.mp4", duration: 4, status: "success" },
    { shotNumber: 3, videoUri: "episodes/test/renders/shot-3.mp4", duration: 3, status: "success" },
    { shotNumber: 4, videoUri: "episodes/test/renders/shot-4.mp4", duration: 3, status: "success" },
    { shotNumber: 5, videoUri: "episodes/test/renders/shot-5.mp4", duration: 4, status: "success" },
    { shotNumber: 6, videoUri: "episodes/test/renders/shot-6.mp4", duration: 5, status: "success" },
    { shotNumber: 7, videoUri: "episodes/test/renders/shot-7.mp4", duration: 3, status: "success" },
  ],
  totalRenders: 7,
  successfulRenders: 7,
};

export const mockEpisode = {
  id: "550e8400-e29b-41d4-a716-446655440000",
  title: "Coffee Shop Encounter",
  premise: "Two strangers meet at a coffee shop and discover they have more in common than expected.",
  status: "completed",
  targetDuration: 40,
  createdAt: "2024-01-15T10:00:00Z",
  completedAt: "2024-01-15T10:05:30Z",
};

export const mockJobs = [
  {
    id: "job-1",
    episodeId: mockEpisode.id,
    stage: "script",
    status: "completed",
    createdAt: "2024-01-15T10:00:05Z",
    completedAt: "2024-01-15T10:00:30Z",
  },
  {
    id: "job-2",
    episodeId: mockEpisode.id,
    stage: "storyboard",
    status: "completed",
    createdAt: "2024-01-15T10:00:35Z",
    completedAt: "2024-01-15T10:01:45Z",
  },
  {
    id: "job-3",
    episodeId: mockEpisode.id,
    stage: "render",
    status: "completed",
    createdAt: "2024-01-15T10:01:50Z",
    completedAt: "2024-01-15T10:04:30Z",
  },
  {
    id: "job-4",
    episodeId: mockEpisode.id,
    stage: "compose",
    status: "completed",
    createdAt: "2024-01-15T10:04:35Z",
    completedAt: "2024-01-15T10:05:30Z",
  },
];

export const mockAssets = [
  {
    id: "asset-1",
    episodeId: mockEpisode.id,
    jobId: "job-1",
    type: "script",
    uri: `episodes/${mockEpisode.id}/script.json`,
    metadata: mockScript,
    createdAt: "2024-01-15T10:00:30Z",
  },
  ...mockStoryboard.shots.map((shot, index) => ({
    id: `asset-image-${index + 1}`,
    episodeId: mockEpisode.id,
    jobId: "job-2",
    type: "image",
    uri: `episodes/${mockEpisode.id}/shots/shot-${shot.shotNumber}.png`,
    metadata: shot,
    createdAt: "2024-01-15T10:01:45Z",
  })),
  ...mockRenderResults.renders.map((render, index) => ({
    id: `asset-video-${index + 1}`,
    episodeId: mockEpisode.id,
    jobId: "job-3",
    type: "video",
    uri: render.videoUri,
    metadata: render,
    createdAt: "2024-01-15T10:04:30Z",
  })),
  {
    id: "asset-final",
    episodeId: mockEpisode.id,
    jobId: "job-4",
    type: "video",
    uri: `episodes/${mockEpisode.id}/final/video.mp4`,
    metadata: {
      duration: 25,
      segments: 7,
      format: "mp4",
      resolution: "1080p",
    },
    createdAt: "2024-01-15T10:05:30Z",
  },
];
