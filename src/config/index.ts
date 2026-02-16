export const config = {
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  databaseUrl: process.env.DATABASE_URL || 'postgresql://localhost:5432/content_pipeline',
  port: parseInt(process.env.PORT || '3000'),
  openaiApiKey: process.env.OPENAI_API_KEY || '',
  s3Endpoint: process.env.S3_ENDPOINT || '',
  s3Bucket: process.env.S3_BUCKET || 'content-pipeline'
};
