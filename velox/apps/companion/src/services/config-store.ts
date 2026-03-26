/**
 * Persistent configuration store for the companion app.
 * Uses electron-store for cross-platform config persistence.
 */
import type { WatchFolder } from '@velox/shared';

export interface CompanionConfig {
  apiBaseUrl: string;
  apiToken: string;
  s3Region: string;
  s3Bucket: string;
  s3AccessKeyId: string;
  s3SecretAccessKey: string;
  watchFolders: WatchFolder[];
  autoStart: boolean;
  minimizeToTray: boolean;
}

const DEFAULT_CONFIG: CompanionConfig = {
  apiBaseUrl: 'http://localhost:3001/api/v1',
  apiToken: 'dev-token',
  s3Region: 'ap-southeast-2',
  s3Bucket: 'velox-video-source',
  s3AccessKeyId: '',
  s3SecretAccessKey: '',
  watchFolders: [],
  autoStart: false,
  minimizeToTray: true,
};

/**
 * Simple file-based config store (works without Electron too)
 */
export class ConfigStore {
  private config: CompanionConfig;
  private store: any;

  constructor() {
    this.config = { ...DEFAULT_CONFIG };

    try {
      // Try to use electron-store if available
      const Store = require('electron-store');
      this.store = new Store({ defaults: DEFAULT_CONFIG });
      this.config = this.store.store as CompanionConfig;
    } catch {
      // Fallback to in-memory config
      this.store = null;
    }
  }

  get<K extends keyof CompanionConfig>(key: K): CompanionConfig[K] {
    return this.store ? this.store.get(key) : this.config[key];
  }

  set<K extends keyof CompanionConfig>(key: K, value: CompanionConfig[K]): void {
    if (this.store) {
      this.store.set(key, value);
    } else {
      this.config[key] = value;
    }
  }

  getAll(): CompanionConfig {
    return this.store ? this.store.store : { ...this.config };
  }

  setAll(config: Partial<CompanionConfig>): void {
    for (const [key, value] of Object.entries(config)) {
      this.set(key as keyof CompanionConfig, value as any);
    }
  }

  addWatchFolder(folder: WatchFolder): void {
    const folders = this.get('watchFolders');
    folders.push(folder);
    this.set('watchFolders', folders);
  }

  removeWatchFolder(id: string): void {
    const folders = this.get('watchFolders').filter((f) => f.id !== id);
    this.set('watchFolders', folders);
  }

  updateWatchFolder(id: string, updates: Partial<WatchFolder>): void {
    const folders = this.get('watchFolders').map((f) =>
      f.id === id ? { ...f, ...updates, updatedAt: new Date().toISOString() } : f
    );
    this.set('watchFolders', folders);
  }
}
