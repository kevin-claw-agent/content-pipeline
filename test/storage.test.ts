// Mock AWS SDK and MinIO before imports
const mockSend = jest.fn();
const mockGetSignedUrl = jest.fn();

jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({
    send: mockSend,
  })),
  PutObjectCommand: jest.fn().mockImplementation((params) => ({ ...params, constructor: { name: 'PutObjectCommand' } })),
  GetObjectCommand: jest.fn().mockImplementation((params) => ({ ...params, constructor: { name: 'GetObjectCommand' } })),
  DeleteObjectCommand: jest.fn().mockImplementation((params) => ({ ...params, constructor: { name: 'DeleteObjectCommand' } })),
}));

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: (...args: any[]) => mockGetSignedUrl(...args),
}));

jest.mock('minio', () => ({
  Client: jest.fn().mockImplementation(() => ({
    listObjectsV2: jest.fn().mockReturnValue({
      on: jest.fn().mockImplementation((event, callback) => {
        if (event === 'data') {
          callback({ name: 'test-file-1.txt' });
          callback({ name: 'test-file-2.txt' });
        }
        if (event === 'end') {
          callback();
        }
      }),
    }),
  })),
}));

jest.mock('../../src/config', () => ({
  config: {
    s3Endpoint: 'http://localhost:9000',
    s3Bucket: 'test-bucket',
  }
}));

import {
  uploadBuffer,
  uploadJSON,
  uploadText,
  downloadBuffer,
  downloadJSON,
  deleteFile,
  deleteFiles,
  getPresignedDownloadUrl,
  getPresignedUploadUrl,
  listFiles,
} from '../../src/storage';

describe('Storage Module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('uploadBuffer', () => {
    it('should upload a buffer to S3/MinIO', async () => {
      const key = 'test/file.txt';
      const buffer = Buffer.from('Hello, World!');
      const contentType = 'text/plain';

      mockSend.mockResolvedValueOnce({});

      const result = await uploadBuffer(key, buffer, contentType);

      expect(result).toBe(key);
      expect(mockSend).toHaveBeenCalledTimes(1);
      const { PutObjectCommand } = require('@aws-sdk/client-s3');
      expect(PutObjectCommand).toHaveBeenCalledWith({
        Bucket: 'test-bucket',
        Key: key,
        Body: buffer,
        ContentType: contentType,
      });
    });

    it('should use default content type if not provided', async () => {
      const key = 'test/file.bin';
      const buffer = Buffer.from([0x00, 0x01, 0x02]);

      mockSend.mockResolvedValueOnce({});

      await uploadBuffer(key, buffer);

      const { PutObjectCommand } = require('@aws-sdk/client-s3');
      expect(PutObjectCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          ContentType: 'application/octet-stream',
        })
      );
    });

    it('should throw error on upload failure', async () => {
      const key = 'test/file.txt';
      const buffer = Buffer.from('test');

      mockSend.mockRejectedValueOnce(new Error('Upload failed'));

      await expect(uploadBuffer(key, buffer)).rejects.toThrow('Upload failed');
    });
  });

  describe('uploadJSON', () => {
    it('should upload a JSON object', async () => {
      const key = 'test/data.json';
      const data = { name: 'Test', value: 123 };

      mockSend.mockResolvedValueOnce({});

      const result = await uploadJSON(key, data);

      expect(result).toBe(key);
      const { PutObjectCommand } = require('@aws-sdk/client-s3');
      expect(PutObjectCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          Bucket: 'test-bucket',
          Key: key,
          ContentType: 'application/json',
        })
      );
    });
  });

  describe('uploadText', () => {
    it('should upload a text string', async () => {
      const key = 'test/document.txt';
      const text = 'Hello, this is a test document.';

      mockSend.mockResolvedValueOnce({});

      const result = await uploadText(key, text);

      expect(result).toBe(key);
      const { PutObjectCommand } = require('@aws-sdk/client-s3');
      expect(PutObjectCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          Bucket: 'test-bucket',
          Key: key,
          ContentType: 'text/plain',
        })
      );
    });
  });

  describe('downloadBuffer', () => {
    it('should download a file as buffer', async () => {
      const key = 'test/file.txt';
      const fileContent = Buffer.from('File content');

      mockSend.mockResolvedValueOnce({
        Body: {
          [Symbol.asyncIterator]: async function* () {
            yield fileContent;
          },
        },
      });

      const result = await downloadBuffer(key);

      expect(result).toEqual(fileContent);
      const { GetObjectCommand } = require('@aws-sdk/client-s3');
      expect(GetObjectCommand).toHaveBeenCalledWith({
        Bucket: 'test-bucket',
        Key: key,
      });
    });

    it('should concatenate multiple chunks', async () => {
      const key = 'test/large-file.bin';
      const chunk1 = Buffer.from('Hello ');
      const chunk2 = Buffer.from('World');

      mockSend.mockResolvedValueOnce({
        Body: {
          [Symbol.asyncIterator]: async function* () {
            yield chunk1;
            yield chunk2;
          },
        },
      });

      const result = await downloadBuffer(key);

      expect(result.toString()).toBe('Hello World');
    });
  });

  describe('downloadJSON', () => {
    it('should download and parse JSON file', async () => {
      const key = 'test/data.json';
      const data = { test: true, items: [1, 2, 3] };

      mockSend.mockResolvedValueOnce({
        Body: {
          [Symbol.asyncIterator]: async function* () {
            yield Buffer.from(JSON.stringify(data));
          },
        },
      });

      const result = await downloadJSON(key);

      expect(result).toEqual(data);
    });

    it('should throw error for invalid JSON', async () => {
      const key = 'test/invalid.json';

      mockSend.mockResolvedValueOnce({
        Body: {
          [Symbol.asyncIterator]: async function* () {
            yield Buffer.from('not valid json');
          },
        },
      });

      await expect(downloadJSON(key)).rejects.toThrow();
    });
  });

  describe('deleteFile', () => {
    it('should delete a file', async () => {
      const key = 'test/file-to-delete.txt';

      mockSend.mockResolvedValueOnce({});

      await deleteFile(key);

      const { DeleteObjectCommand } = require('@aws-sdk/client-s3');
      expect(DeleteObjectCommand).toHaveBeenCalledWith({
        Bucket: 'test-bucket',
        Key: key,
      });
      expect(mockSend).toHaveBeenCalledTimes(1);
    });
  });

  describe('deleteFiles', () => {
    it('should delete multiple files', async () => {
      const keys = ['file1.txt', 'file2.txt', 'file3.txt'];

      mockSend.mockResolvedValue({});

      await deleteFiles(keys);

      expect(mockSend).toHaveBeenCalledTimes(3);
    });
  });

  describe('getPresignedDownloadUrl', () => {
    it('should generate a presigned download URL', async () => {
      const key = 'test/file.txt';
      const expectedUrl = 'https://presigned-url.example.com/download';

      mockGetSignedUrl.mockResolvedValueOnce(expectedUrl);

      const result = await getPresignedDownloadUrl(key);

      expect(result).toBe(expectedUrl);
      expect(mockGetSignedUrl).toHaveBeenCalledWith(
        expect.any(Object),
        expect.any(Object),
        { expiresIn: 3600 }
      );
    });

    it('should use custom expiration time', async () => {
      const key = 'test/file.txt';
      const expiresIn = 7200;

      mockGetSignedUrl.mockResolvedValueOnce('https://example.com');

      await getPresignedDownloadUrl(key, expiresIn);

      expect(mockGetSignedUrl).toHaveBeenCalledWith(
        expect.any(Object),
        expect.any(Object),
        { expiresIn }
      );
    });
  });

  describe('getPresignedUploadUrl', () => {
    it('should generate a presigned upload URL', async () => {
      const key = 'test/upload.txt';
      const contentType = 'text/plain';
      const expectedUrl = 'https://presigned-url.example.com/upload';

      mockGetSignedUrl.mockResolvedValueOnce(expectedUrl);

      const result = await getPresignedUploadUrl(key, contentType);

      expect(result).toBe(expectedUrl);
      const { PutObjectCommand } = require('@aws-sdk/client-s3');
      expect(PutObjectCommand).toHaveBeenCalledWith({
        Bucket: 'test-bucket',
        Key: key,
        ContentType: contentType,
      });
    });
  });

  describe('listFiles', () => {
    it('should list files with prefix using MinIO', async () => {
      const prefix = 'episodes/test/';

      const result = await listFiles(prefix);

      expect(result).toEqual(['test-file-1.txt', 'test-file-2.txt']);
    });
  });
});
