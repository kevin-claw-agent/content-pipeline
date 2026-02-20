import 'dotenv/config';
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Client as MinioClient } from 'minio';
import { config } from '../config';

// Determine which storage backend to use
const isMinIO = config.s3Endpoint.includes('minio') || config.s3Endpoint.includes('localhost') || config.s3Endpoint.includes('127.0.0.1');

// AWS S3 Client (also compatible with MinIO)
const s3Client = new S3Client({
  endpoint: config.s3Endpoint || undefined,
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || process.env.S3_ACCESS_KEY || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || process.env.S3_SECRET_KEY || ''
  },
  forcePathStyle: isMinIO // Required for MinIO
});

// MinIO Client (for operations not well supported in S3 SDK)
let minioClient: MinioClient | null = null;
if (isMinIO) {
  try {
    const url = new URL(config.s3Endpoint);
    minioClient = new MinioClient({
      endPoint: url.hostname,
      port: parseInt(url.port) || 9000,
      useSSL: url.protocol === 'https:',
      accessKey: process.env.S3_ACCESS_KEY || '',
      secretKey: process.env.S3_SECRET_KEY || ''
    });
  } catch (error) {
    console.warn('[Storage] Failed to initialize MinIO client:', error);
  }
}

/**
 * Upload a buffer to S3/MinIO
 * @param key - The object key/path
 * @param buffer - The data to upload
 * @param contentType - MIME type
 */
export async function uploadBuffer(
  key: string, 
  buffer: Buffer, 
  contentType: string = 'application/octet-stream'
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: config.s3Bucket,
    Key: key,
    Body: buffer,
    ContentType: contentType
  });

  await s3Client.send(command);
  console.log(`[Storage] Uploaded: ${key}`);
  return key;
}

/**
 * Upload a JSON object to S3/MinIO
 * @param key - The object key/path
 * @param data - The JSON data
 */
export async function uploadJSON(key: string, data: any): Promise<string> {
  const buffer = Buffer.from(JSON.stringify(data, null, 2));
  return uploadBuffer(key, buffer, 'application/json');
}

/**
 * Upload a text file to S3/MinIO
 * @param key - The object key/path
 * @param text - The text content
 */
export async function uploadText(key: string, text: string): Promise<string> {
  const buffer = Buffer.from(text, 'utf-8');
  return uploadBuffer(key, buffer, 'text/plain');
}

/**
 * Get a file from S3/MinIO as a buffer
 * @param key - The object key/path
 */
export async function downloadBuffer(key: string): Promise<Buffer> {
  const command = new GetObjectCommand({
    Bucket: config.s3Bucket,
    Key: key
  });

  const response = await s3Client.send(command);
  const chunks: Buffer[] = [];
  
  if (response.Body) {
    for await (const chunk of response.Body as any) {
      chunks.push(Buffer.from(chunk));
    }
  }
  
  return Buffer.concat(chunks);
}

/**
 * Get a JSON object from S3/MinIO
 * @param key - The object key/path
 */
export async function downloadJSON(key: string): Promise<any> {
  const buffer = await downloadBuffer(key);
  return JSON.parse(buffer.toString('utf-8'));
}

/**
 * Delete a file from S3/MinIO
 * @param key - The object key/path
 */
export async function deleteFile(key: string): Promise<void> {
  const command = new DeleteObjectCommand({
    Bucket: config.s3Bucket,
    Key: key
  });

  await s3Client.send(command);
  console.log(`[Storage] Deleted: ${key}`);
}

/**
 * Generate a pre-signed URL for downloading a file
 * @param key - The object key/path
 * @param expiresIn - URL expiration time in seconds (default: 3600)
 */
export async function getPresignedDownloadUrl(key: string, expiresIn: number = 3600): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: config.s3Bucket,
    Key: key
  });

  return getSignedUrl(s3Client, command, { expiresIn });
}

/**
 * Generate a pre-signed URL for uploading a file
 * @param key - The object key/path
 * @param contentType - MIME type
 * @param expiresIn - URL expiration time in seconds (default: 3600)
 */
export async function getPresignedUploadUrl(
  key: string, 
  contentType: string = 'application/octet-stream',
  expiresIn: number = 3600
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: config.s3Bucket,
    Key: key,
    ContentType: contentType
  });

  return getSignedUrl(s3Client, command, { expiresIn });
}

/**
 * List files with a given prefix
 * @param prefix - The key prefix to filter by
 */
export async function listFiles(prefix: string): Promise<string[]> {
  if (minioClient) {
    const stream = minioClient.listObjectsV2(config.s3Bucket, prefix, true);
    const objects: string[] = [];
    
    return new Promise((resolve, reject) => {
      stream.on('data', (obj) => {
        objects.push(obj.name);
      });
      stream.on('error', reject);
      stream.on('end', () => resolve(objects));
    });
  }
  
  // For S3, we'd need to implement ListObjectsV2 - simplified here
  console.warn('[Storage] listFiles not fully implemented for S3 without MinIO');
  return [];
}

/**
 * Delete multiple files from S3/MinIO
 * @param keys - Array of object keys/paths
 */
export async function deleteFiles(keys: string[]): Promise<void> {
  await Promise.all(keys.map(key => deleteFile(key)));
}

console.log(`[Storage] Initialized with ${isMinIO ? 'MinIO' : 'S3'} backend`);
export { isMinIO, s3Client, minioClient };
