/**
 * Airlock Electron Main Process
 *
 * Entry point for the Electron application. Sets up:
 * - Main window with KasmVNC-ready security settings
 * - IPC handlers bridging to ContainerManager
 * - Crash trap installation on app startup
 * - Protocol/URL handling
 */

import { app, BrowserWindow, ipcMain, shell } from 'electron';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

// Import from @airlock/core (workspace dependency)
import { docker } from '@airlock/core';
import {
  IPC_CHANNELS,
  type CreateFileContainerRequest,
  type CreateUrlContainerRequest,
  type ContainerSession,
  type SessionStartedEvent,
  type SessionEndedEvent,
  type SessionErrorEvent,
} from '../shared/ipc.js';

// ESM-compatible __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Application version
const VERSION = '0.1.0';

// Keep global reference to prevent GC
let mainWindow: BrowserWindow | null = null;

/**
 * Create the main application window.
 *
 * Security settings:
 * - nodeIntegration: false (contextBridge only)
 * - contextIsolation: true (preload runs in isolated context)
 * - webSecurity: true (CORS/CSP enforced)
 * - allowRunningInsecureContent: false
 */
function createMainWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    titleBarStyle: 'hiddenInset', // macOS hidden title bar
    backgroundColor: '#08090B', // Match Airlock obsidian base
    webPreferences: {
      // Security: disable node integration, use contextBridge
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false, // Preload needs filesystem access for dockerode

      // Preload script path
      preload: path.join(__dirname, '../../preload/preload/index.js'),

      // Security hardening
      webSecurity: true,
      allowRunningInsecureContent: false,
      experimentalFeatures: false,
    },
  });

  // Load renderer
  if (process.env.VITE_DEV_SERVER_URL) {
    // Development: load from Vite dev server
    window.loadURL(process.env.VITE_DEV_SERVER_URL);
    window.webContents.openDevTools();
  } else {
    // Production: load built HTML
    window.loadFile(path.join(__dirname, '../../renderer/index.html'));
  }

  // Security: prevent navigation to external sites
  window.webContents.on('will-navigate', (event, navigationUrl) => {
    const parsedUrl = new URL(navigationUrl);
    if (parsedUrl.origin !== 'http://localhost:5173') {
      event.preventDefault();
      console.warn(`[main] Blocked navigation to ${navigationUrl}`);
    }
  });

  // Security: prevent new window creation
  window.webContents.setWindowOpenHandler(({ url }) => {
    // Allow only file:// URLs (for dropped files) and about:blank
    if (url.startsWith('file://') || url === 'about:blank') {
      return { action: 'allow' };
    }
    // Block everything else and open in system browser
    shell.openExternal(url);
    return { action: 'deny' };
  });

  return window;
}

/**
 * Convert ContainerSession from core format to IPC format.
 */
function toIpcSession(session: {
  id: string;
  name: string;
  createdAt: Date;
  config: { image: string; cmd?: string[] };
  vncUrl?: string;
  vncPageUrl?: string;
}): ContainerSession {
  return {
    id: session.id,
    name: session.name,
    createdAt: session.createdAt.toISOString(),
    config: session.config,
    vncUrl: session.vncUrl,
    vncPageUrl: session.vncPageUrl,
  };
}

/**
 * Notify renderer of session events.
 */
function emitSessionStarted(session: ContainerSession, vncUrl?: string): void {
  if (!mainWindow) return;
  const event: SessionStartedEvent = { session, vncUrl };
  mainWindow.webContents.send(IPC_CHANNELS.SESSION_STARTED, event);
}

function emitSessionEnded(sessionId: string, reason: 'destroyed' | 'crashed' | 'error'): void {
  if (!mainWindow) return;
  const event: SessionEndedEvent = { sessionId, reason };
  mainWindow.webContents.send(IPC_CHANNELS.SESSION_ENDED, event);
}

function emitSessionError(sessionId: string, error: string): void {
  if (!mainWindow) return;
  const event: SessionErrorEvent = { sessionId, error };
  mainWindow.webContents.send(IPC_CHANNELS.SESSION_ERROR, event);
}

/**
 * Register IPC handlers bridging to ContainerManager.
 */
function registerIpcHandlers(): void {
  // Container: create from file
  ipcMain.handle(
    IPC_CHANNELS.CONTAINER_CREATE,
    async (_event, request: CreateFileContainerRequest): Promise<ContainerSession> => {
      console.log(`[ipc] Creating file container for ${request.filePath}`);
      try {
        const session = await docker.createFileContainer(request.filePath, {
          name: request.name,
          debug: request.debug,
        });
        const ipcSession = toIpcSession(session);
        emitSessionStarted(ipcSession, ipcSession.vncUrl);

        return ipcSession;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`[ipc] Failed to create file container: ${message}`);
        throw error;
      }
    },
  );

  // Container: create from URL
  ipcMain.handle(
    IPC_CHANNELS.CONTAINER_CREATE_URL,
    async (_event, request: CreateUrlContainerRequest): Promise<ContainerSession> => {
      console.log(`[ipc] Creating URL container for ${request.url}`);
      try {
        const session = await docker.createUrlContainer(request.url, {
          name: request.name,
          debug: request.debug,
        });
        const ipcSession = toIpcSession(session);
        emitSessionStarted(ipcSession, ipcSession.vncUrl);
        return ipcSession;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`[ipc] Failed to create URL container: ${message}`);
        throw error;
      }
    },
  );

  // Container: destroy (graceful stop + remove)
  ipcMain.handle(
    IPC_CHANNELS.CONTAINER_DESTROY,
    async (_event, sessionId: string): Promise<void> => {
      console.log(`[ipc] Destroying container ${sessionId.slice(0, 12)}`);
      try {
        await docker.destroyContainer(sessionId);
        emitSessionEnded(sessionId, 'destroyed');
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`[ipc] Failed to destroy container: ${message}`);
        emitSessionError(sessionId, message);
        throw error;
      }
    },
  );

  // Container: kill (force)
  ipcMain.handle(IPC_CHANNELS.CONTAINER_KILL, async (_event, sessionId: string): Promise<void> => {
    console.log(`[ipc] Killing container ${sessionId.slice(0, 12)}`);
    try {
      await docker.killContainer(sessionId);
      emitSessionEnded(sessionId, 'destroyed');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[ipc] Failed to kill container: ${message}`);
      emitSessionError(sessionId, message);
      throw error;
    }
  });

  // Container: list active
  ipcMain.handle(IPC_CHANNELS.CONTAINER_LIST, async (): Promise<ContainerSession[]> => {
    const sessions = docker.getActiveSessions();
    return sessions.map(toIpcSession);
  });

  // Container: get status
  ipcMain.handle(IPC_CHANNELS.CONTAINER_STATUS, async (_event, sessionId: string) => {
    const running = await docker.isContainerRunning(sessionId);
    return { id: sessionId, running };
  });

  // System: install crash trap
  ipcMain.handle(IPC_CHANNELS.INSTALL_CRASH_TRAP, async (): Promise<void> => {
    console.log('[ipc] Installing crash trap...');
    docker.installCrashTrap();
    console.log('[ipc] Crash trap installed');
  });

  // System: get version
  ipcMain.handle(IPC_CHANNELS.GET_VERSION, async (): Promise<string> => {
    return VERSION;
  });

  console.log('[main] IPC handlers registered');
}

/**
 * App lifecycle events.
 */

app.whenReady().then(async () => {
  console.log(`[main] Airlock ${VERSION} starting...`);

  // Register IPC handlers before window creation
  registerIpcHandlers();

  // Install crash trap early
  docker.installCrashTrap();
  console.log('[main] Crash trap installed');

  // Create main window
  mainWindow = createMainWindow();

  // macOS: recreate window on dock click if none exist
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createMainWindow();
    }
  });

  console.log('[main] Ready');
});

// macOS: quit when all windows closed (unless Cmd+Q)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Before quit: ensure all containers are destroyed
app.on('before-quit', async (event) => {
  console.log('[main] before-quit: destroying all containers...');
  event.preventDefault();

  try {
    // Get active sessions and destroy them all
    const sessions = docker.getActiveSessions();
    console.log(`[main] Destroying ${sessions.length} container(s)...`);

    await Promise.all(
      sessions.map((session) =>
        docker.destroyContainer(session.id).catch((err) => {
          console.error(`[main] Failed to destroy ${session.id}:`, err);
        }),
      ),
    );
  } catch (error) {
    console.error('[main] Error during cleanup:', error);
  }

  app.exit(0);
});

// Security: block certificate errors (development only)
app.on('certificate-error', (event, _webContents, url, _error, _certificate, callback) => {
  // Allow self-signed certs for local VNC endpoints and Vite dev server
  if (process.env.VITE_DEV_SERVER_URL ?? url.startsWith('http://127.0.0.1:')) {
    event.preventDefault();
    callback(true);
  } else {
    callback(false);
  }
});

// Handle files/URLs dropped on dock icon (macOS)
app.on('open-file', (event, filePath) => {
  event.preventDefault();
  console.log(`[main] Open file request: ${filePath}`);
  if (mainWindow) {
    // Forward to renderer via IPC
    // This would trigger the container creation flow
    mainWindow.webContents.send('airlock:open-file', filePath);
  }
});

app.on('open-url', (event, url) => {
  event.preventDefault();
  console.log(`[main] Open URL request: ${url}`);
  if (mainWindow) {
    mainWindow.webContents.send('airlock:open-url', url);
  }
});

// Single instance lock
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  console.log('[main] Another instance is running, quitting...');
  app.quit();
} else {
  app.on('second-instance', (_event, argv, _workingDirectory) => {
    // Someone tried to run a second instance, focus our window instead
    console.log('[main] Second instance detected, focusing window...');
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();

      // Handle file/URL from second instance
      const fileOrUrl = argv.find((arg) => !arg.startsWith('--'));
      if (fileOrUrl) {
        if (fileOrUrl.startsWith('http://') || fileOrUrl.startsWith('https://')) {
          mainWindow.webContents.send('airlock:open-url', fileOrUrl);
        } else {
          mainWindow.webContents.send('airlock:open-file', fileOrUrl);
        }
      }
    }
  });
}
