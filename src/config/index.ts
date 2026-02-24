export const config = {
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  databaseUrl: process.env.DATABASE_URL || 'postgresql://localhost:5432/content_pipeline',
  port: parseInt(process.env.PORT || '3000'),
  openaiApiKey: process.env.OPENAI_API_KEY || '',
  s3Endpoint: process.env.S3_ENDPOINT || 'http://localhost:9000',
  s3Bucket: process.env.S3_BUCKET || 'content-pipeline',
  s3AccessKey: process.env.S3_ACCESS_KEY || '',
  s3SecretKey: process.env.S3_SECRET_KEY || ''
};
