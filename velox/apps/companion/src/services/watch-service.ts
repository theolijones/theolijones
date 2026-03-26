/**
 * Watch Folder Service
 *
 * Uses chokidar to monitor local directories for new video files.
 * When a new file is detected:
 * 1. Waits for the file to finish writing (stable size check)
 * 2. Uploads to S3 via multipart upload
 * 3. Calls the Velox API to create a video record
 * 4. Moves the file to a "processed" subfolder (optional)
 */
import * as chokidar from 'chokidar';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuid } from 'uuid';
import { UploadService } from './upload-service';
import type { WatchFolder } from '@velox/shared';

const VIDEO_EXTENSIONS = new Set(['.mp4', '.mov', '.mxf', '.mts', '.avi', '.mkv', '.webm']);
const STABILITY_CHECK_INTERVAL = 2000; // ms
const STABILITY_CHECK_COUNT = 3; // file must be same size 3 times in a row

export interface WatchEvent {
  type: 'file_detected' | 'upload_started' | 'upload_progress' | 'upload_complete' | 'upload_failed' | 'api_created' | 'error';
  watchFolderId: string;
  filePath: string;
  fileName: string;
  message: string;
  progress?: number;
  videoId?: string;
}

type WatchEventCallback = (event: WatchEvent) => void;

interface ActiveWatcher {
  watcher: chokidar.FSWatcher;
  folder: WatchFolder;
}

export class WatchService {
  private watchers = new Map<string, ActiveWatcher>();
  private uploadService: UploadService;
  private apiBaseUrl: string;
  private apiToken: string;
  private onEvent: WatchEventCallback;

  constructor(config: {
    uploadService: UploadService;
    apiBaseUrl: string;
    apiToken: string;
    onEvent: WatchEventCallback;
  }) {
    this.uploadService = config.uploadService;
    this.apiBaseUrl = config.apiBaseUrl;
    this.apiToken = config.apiToken;
    this.onEvent = config.onEvent;
  }

  startWatching(folder: WatchFolder): void {
    if (this.watchers.has(folder.id)) {
      this.stopWatching(folder.id);
    }

    if (!fs.existsSync(folder.localPath)) {
      this.onEvent({
        type: 'error',
        watchFolderId: folder.id,
        filePath: folder.localPath,
        fileName: '',
        message: `Watch folder does not exist: ${folder.localPath}`,
      });
      return;
    }

    const watcher = chokidar.watch(folder.localPath, {
      ignoreInitial: true,
      depth: 1,
      awaitWriteFinish: {
        stabilityThreshold: STABILITY_CHECK_INTERVAL * STABILITY_CHECK_COUNT,
        pollInterval: STABILITY_CHECK_INTERVAL,
      },
    });

    watcher.on('add', (filePath) => this.handleNewFile(folder, filePath));
    watcher.on('error', (err) => {
      this.onEvent({
        type: 'error',
        watchFolderId: folder.id,
        filePath: folder.localPath,
        fileName: '',
        message: `Watcher error: ${err.message}`,
      });
    });

    this.watchers.set(folder.id, { watcher, folder });
  }

  stopWatching(folderId: string): void {
    const active = this.watchers.get(folderId);
    if (active) {
      active.watcher.close();
      this.watchers.delete(folderId);
    }
  }

  stopAll(): void {
    for (const [id] of this.watchers) {
      this.stopWatching(id);
    }
  }

  getActiveWatchers(): string[] {
    return Array.from(this.watchers.keys());
  }

  private async handleNewFile(folder: WatchFolder, filePath: string): Promise<void> {
    const ext = path.extname(filePath).toLowerCase();
    if (!VIDEO_EXTENSIONS.has(ext)) return;

    const fileName = path.basename(filePath);
    this.onEvent({
      type: 'file_detected',
      watchFolderId: folder.id,
      filePath,
      fileName,
      message: `New video detected: ${fileName}`,
    });

    // Generate S3 key
    const videoId = uuid();
    const s3Key = `${folder.s3Destination}/${videoId}/${fileName}`;

    // Upload to S3
    this.onEvent({
      type: 'upload_started',
      watchFolderId: folder.id,
      filePath,
      fileName,
      message: `Uploading ${fileName}...`,
    });

    try {
      await this.uploadService.uploadFile(filePath, s3Key, (progress) => {
        this.onEvent({
          type: 'upload_progress',
          watchFolderId: folder.id,
          filePath,
          fileName,
          message: `Uploading ${fileName}: ${progress.percent}%`,
          progress: progress.percent,
        });
      });

      this.onEvent({
        type: 'upload_complete',
        watchFolderId: folder.id,
        filePath,
        fileName,
        message: `Upload complete: ${fileName}`,
      });

      // Create video record via API
      try {
        const title = folder.defaultMetadata.titlePrefix
          ? `${folder.defaultMetadata.titlePrefix} ${path.parse(fileName).name}`
          : path.parse(fileName).name;

        const response = await fetch(`${this.apiBaseUrl}/videos`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiToken}`,
          },
          body: JSON.stringify({
            title,
            fileName,
            fileSize: fs.statSync(filePath).size,
            folderId: folder.cmsFolderId,
            tags: folder.defaultMetadata.tags || [],
            sourceUrl: `s3://${s3Key}`,
          }),
        });

        if (response.ok) {
          const result = await response.json();
          this.onEvent({
            type: 'api_created',
            watchFolderId: folder.id,
            filePath,
            fileName,
            message: `Video record created: ${title}`,
            videoId: result.data?.id,
          });
        }
      } catch (apiErr) {
        this.onEvent({
          type: 'error',
          watchFolderId: folder.id,
          filePath,
          fileName,
          message: `API error: ${(apiErr as Error).message}`,
        });
      }

      // Move to processed subfolder
      try {
        const processedDir = path.join(folder.localPath, '.processed');
        if (!fs.existsSync(processedDir)) {
          fs.mkdirSync(processedDir, { recursive: true });
        }
        fs.renameSync(filePath, path.join(processedDir, fileName));
      } catch {
        // Non-fatal — file stays in place
      }
    } catch (err) {
      this.onEvent({
        type: 'upload_failed',
        watchFolderId: folder.id,
        filePath,
        fileName,
        message: `Upload failed: ${(err as Error).message}`,
      });
    }
  }
}
