/**
 * Velox Companion — Main Process
 *
 * Desktop agent for automated video ingest via watch folders.
 * Monitors local directories for new video files, uploads them to S3,
 * and creates video records in the Velox CMS via API.
 *
 * Can run as:
 * 1. Electron desktop app with system tray
 * 2. Headless CLI agent (node process)
 */
import { ConfigStore } from '../services/config-store';
import { UploadService } from '../services/upload-service';
import { WatchService, WatchEvent } from '../services/watch-service';

const configStore = new ConfigStore();
let uploadService: UploadService;
let watchService: WatchService;

// Event log for the renderer to read
const eventLog: WatchEvent[] = [];
const MAX_LOG_SIZE = 500;

function log(event: WatchEvent) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [${event.type}] ${event.message}`);

  eventLog.push(event);
  if (eventLog.length > MAX_LOG_SIZE) {
    eventLog.splice(0, eventLog.length - MAX_LOG_SIZE);
  }

  // In Electron, send to renderer via IPC
  try {
    const { BrowserWindow } = require('electron');
    const win = BrowserWindow.getAllWindows()[0];
    if (win) {
      win.webContents.send('watch-event', event);
    }
  } catch {
    // Not running in Electron
  }
}

function initServices() {
  const config = configStore.getAll();

  uploadService = new UploadService({
    region: config.s3Region,
    bucket: config.s3Bucket,
    accessKeyId: config.s3AccessKeyId || undefined,
    secretAccessKey: config.s3SecretAccessKey || undefined,
  });

  watchService = new WatchService({
    uploadService,
    apiBaseUrl: config.apiBaseUrl,
    apiToken: config.apiToken,
    onEvent: log,
  });
}

function startWatchers() {
  const folders = configStore.get('watchFolders');
  const activeFolders = folders.filter((f) => f.status === 'active');

  console.log(`[Companion] Starting ${activeFolders.length} watch folders`);

  for (const folder of activeFolders) {
    watchService.startWatching(folder);
    console.log(`[Companion] Watching: ${folder.localPath}`);
  }
}

function stopWatchers() {
  watchService.stopAll();
  console.log('[Companion] All watchers stopped');
}

// ── Electron App Setup ──────────────────────────────────────────────

async function startElectronApp() {
  const { app, BrowserWindow, Tray, Menu, ipcMain, dialog, nativeImage } = require('electron');

  await app.whenReady();

  // Create system tray
  const tray = new Tray(nativeImage.createEmpty());
  tray.setToolTip('Velox Companion');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Open Velox Companion', click: () => mainWindow?.show() },
    { type: 'separator' },
    { label: 'Start All Watchers', click: () => startWatchers() },
    { label: 'Stop All Watchers', click: () => stopWatchers() },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() },
  ]));

  // Create main window
  let mainWindow: any = new BrowserWindow({
    width: 800,
    height: 600,
    title: 'Velox Companion',
    backgroundColor: '#0A0A0F',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  mainWindow.loadFile('src/renderer/index.html');

  mainWindow.on('close', (e: Event) => {
    if (configStore.get('minimizeToTray')) {
      e.preventDefault();
      mainWindow?.hide();
    }
  });

  // IPC handlers
  ipcMain.handle('get-config', () => configStore.getAll());
  ipcMain.handle('set-config', (_: any, config: any) => configStore.setAll(config));
  ipcMain.handle('get-watch-folders', () => configStore.get('watchFolders'));
  ipcMain.handle('get-event-log', () => eventLog);
  ipcMain.handle('get-active-watchers', () => watchService.getActiveWatchers());

  ipcMain.handle('add-watch-folder', async () => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      properties: ['openDirectory'],
      title: 'Select Watch Folder',
    });
    if (result.canceled || !result.filePaths[0]) return null;

    const folder = {
      id: require('uuid').v4(),
      localPath: result.filePaths[0],
      s3Destination: 'uploads',
      defaultMetadata: {},
      status: 'active' as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    configStore.addWatchFolder(folder);
    watchService.startWatching(folder);
    return folder;
  });

  ipcMain.handle('remove-watch-folder', (_: any, id: string) => {
    watchService.stopWatching(id);
    configStore.removeWatchFolder(id);
  });

  ipcMain.handle('toggle-watch-folder', (_: any, id: string) => {
    const folders = configStore.get('watchFolders');
    const folder = folders.find((f) => f.id === id);
    if (!folder) return;

    const newStatus = folder.status === 'active' ? 'paused' : 'active';
    configStore.updateWatchFolder(id, { status: newStatus });

    if (newStatus === 'active') {
      watchService.startWatching({ ...folder, status: newStatus });
    } else {
      watchService.stopWatching(id);
    }
  });

  ipcMain.handle('start-all-watchers', () => startWatchers());
  ipcMain.handle('stop-all-watchers', () => stopWatchers());

  // Auto-start if configured
  if (configStore.get('autoStart')) {
    startWatchers();
  }

  app.on('activate', () => mainWindow?.show());
}

// ── Headless CLI Mode ───────────────────────────────────────────────

function startHeadless() {
  console.log('[Companion] Starting in headless mode');
  initServices();
  startWatchers();

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('[Companion] Shutting down...');
    stopWatchers();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    console.log('[Companion] Shutting down...');
    stopWatchers();
    process.exit(0);
  });
}

// ── Entry Point ─────────────────────────────────────────────────────

initServices();

try {
  require('electron');
  startElectronApp().catch((err) => {
    console.error('[Companion] Electron startup failed, falling back to headless:', err.message);
    startHeadless();
  });
} catch {
  startHeadless();
}
