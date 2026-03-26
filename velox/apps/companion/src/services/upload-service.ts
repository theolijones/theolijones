/**
 * S3 Multipart Upload Service
 *
 * Handles large file uploads to S3 with:
 * - Automatic multipart chunking (5MB parts)
 * - Progress tracking with per-part callbacks
 * - Retry logic for failed parts
 * - Concurrent part uploads (up to 4 parallel)
 */
import { S3Client, CreateMultipartUploadCommand, UploadPartCommand, CompleteMultipartUploadCommand, AbortMultipartUploadCommand } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import * as fs from 'fs';
import * as path from 'path';

const PART_SIZE = 5 * 1024 * 1024; // 5MB
const QUEUE_CONCURRENCY = 4;

interface UploadProgress {
  filePath: string;
  fileName: string;
  totalBytes: number;
  uploadedBytes: number;
  percent: number;
  status: 'pending' | 'uploading' | 'complete' | 'failed';
  error?: string;
}

type ProgressCallback = (progress: UploadProgress) => void;

export class UploadService {
  private s3: S3Client;
  private bucket: string;

  constructor(config: { region: string; bucket: string; accessKeyId?: string; secretAccessKey?: string }) {
    this.bucket = config.bucket;
    this.s3 = new S3Client({
      region: config.region,
      ...(config.accessKeyId && config.secretAccessKey ? {
        credentials: {
          accessKeyId: config.accessKeyId,
          secretAccessKey: config.secretAccessKey,
        },
      } : {}),
    });
  }

  async uploadFile(
    filePath: string,
    s3Key: string,
    onProgress?: ProgressCallback
  ): Promise<{ key: string; etag?: string }> {
    const stats = fs.statSync(filePath);
    const fileName = path.basename(filePath);

    const progress: UploadProgress = {
      filePath,
      fileName,
      totalBytes: stats.size,
      uploadedBytes: 0,
      percent: 0,
      status: 'uploading',
    };

    onProgress?.(progress);

    try {
      const fileStream = fs.createReadStream(filePath);

      const upload = new Upload({
        client: this.s3,
        params: {
          Bucket: this.bucket,
          Key: s3Key,
          Body: fileStream,
          ContentType: getContentType(filePath),
        },
        queueSize: QUEUE_CONCURRENCY,
        partSize: PART_SIZE,
        leavePartsOnError: false,
      });

      upload.on('httpUploadProgress', (p) => {
        progress.uploadedBytes = p.loaded || 0;
        progress.percent = stats.size > 0 ? Math.round((progress.uploadedBytes / stats.size) * 100) : 0;
        onProgress?.(progress);
      });

      const result = await upload.done();

      progress.status = 'complete';
      progress.percent = 100;
      progress.uploadedBytes = stats.size;
      onProgress?.(progress);

      return { key: s3Key, etag: result.ETag };
    } catch (err) {
      progress.status = 'failed';
      progress.error = (err as Error).message;
      onProgress?.(progress);
      throw err;
    }
  }

  /**
   * Upload multiple files with a shared progress tracker
   */
  async uploadFiles(
    files: Array<{ localPath: string; s3Key: string }>,
    onFileProgress?: ProgressCallback,
    onOverallProgress?: (completed: number, total: number) => void
  ): Promise<Array<{ key: string; etag?: string; error?: string }>> {
    const results: Array<{ key: string; etag?: string; error?: string }> = [];
    let completed = 0;

    for (const file of files) {
      try {
        const result = await this.uploadFile(file.localPath, file.s3Key, onFileProgress);
        results.push(result);
      } catch (err) {
        results.push({ key: file.s3Key, error: (err as Error).message });
      }
      completed++;
      onOverallProgress?.(completed, files.length);
    }

    return results;
  }
}

function getContentType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const types: Record<string, string> = {
    '.mp4': 'video/mp4',
    '.mov': 'video/quicktime',
    '.mxf': 'application/mxf',
    '.mts': 'video/mp2t',
    '.avi': 'video/x-msvideo',
    '.mkv': 'video/x-matroska',
    '.webm': 'video/webm',
    '.ts': 'video/mp2t',
    '.m4v': 'video/x-m4v',
  };
  return types[ext] || 'application/octet-stream';
}
