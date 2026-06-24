/**
 * Airlock Electron Main Process
 *
 * Entry point for the Electron application. Sets up:
 * - Main window with KasmVNC-ready security settings
 * - IPC handlers bridging to the session contract layer
 * - Crash trap installation on app startup
 * - Protocol/URL handling
 */

import { app, BrowserWindow, ipcMain, session, shell } from 'electron';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { docker, executeAirlockSession, destroyAirlockSession, analyzeSession } from '@airlock/core';
import {
  IPC_CHANNELS,
  type AirlockInput,
  type AirlockSession,
  type SessionAnalysisResult,
  type SessionStartedEvent,
  type SessionEndedEvent,
  type SessionErrorEvent,
} from '../shared/ipc.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const VERSION = '0.1.1';

let mainWindow: BrowserWindow | null = null;

function configureSessionForLocalVnc(): void {
  const defaultSession = session.defaultSession;

  defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const { url } = details;
    if (!url.startsWith('http://127.0.0.1:') && !url.startsWith('http://localhost:')) {
      callback({ responseHeaders: details.responseHeaders });
      return;
    }

    const responseHeaders = { ...details.responseHeaders };
    for (const key of Object.keys(responseHeaders)) {
      const lower = key.toLowerCase();
      if (lower === 'content-security-policy' || lower === 'x-frame-options') {
        delete responseHeaders[key];
      }
    }

    callback({ responseHeaders });
  });
}

function createMainWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#08090B',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      preload: path.join(__dirname, '../../preload/preload/index.js'),
      webSecurity: true,
      allowRunningInsecureContent: false,
      experimentalFeatures: false,
    },
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    window.loadURL(process.env.VITE_DEV_SERVER_URL);
    window.webContents.openDevTools();
  } else {
    window.loadFile(path.join(__dirname, '../../renderer/index.html'));
  }

  window.webContents.on('will-navigate', (event, navigationUrl) => {
    const parsedUrl = new URL(navigationUrl);
    const isDevServer = parsedUrl.origin === 'http://localhost:5173';
    const isFileShell = parsedUrl.protocol === 'file:';
    if (!isDevServer && !isFileShell) {
      event.preventDefault();
      console.warn(`[main] Blocked navigation to ${navigationUrl}`);
    }
  });

  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('file://') || url === 'about:blank') {
      return { action: 'allow' };
    }
    shell.openExternal(url);
    return { action: 'deny' };
  });

  return window;
}

function emitSessionStarted(session: AirlockSession): void {
  if (!mainWindow) return;
  const event: SessionStartedEvent = { session };
  mainWindow.webContents.send(IPC_CHANNELS.SESSION_STARTED, event);
}

function emitSessionEnded(session: AirlockSession): void {
  if (!mainWindow) return;
  const event: SessionEndedEvent = { session };
  mainWindow.webContents.send(IPC_CHANNELS.SESSION_ENDED, event);
}

function emitSessionError(session: AirlockSession, error: string): void {
  if (!mainWindow) return;
  const event: SessionErrorEvent = { session, error };
  mainWindow.webContents.send(IPC_CHANNELS.SESSION_ERROR, event);
}

function registerIpcHandlers(): void {
  ipcMain.handle(
    IPC_CHANNELS.SESSION_CREATE,
    async (_event, input: AirlockInput): Promise<AirlockSession> => {
      console.log(`[ipc] executeAirlockSession type=${input.type}`);
      const result = await executeAirlockSession(input);

      if (result.status === 'running') {
        emitSessionStarted(result);
      } else if (result.status === 'error') {
        emitSessionError(result, 'Session failed to start');
      }

      return result;
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.SESSION_DESTROY,
    async (_event, activeSession: AirlockSession): Promise<AirlockSession> => {
      console.log(`[ipc] destroyAirlockSession ${activeSession.sessionId.slice(0, 12)}`);
      const result = await destroyAirlockSession(activeSession);

      if (result.status === 'destroyed') {
        emitSessionEnded(result);
      } else if (result.status === 'error') {
        emitSessionError(result, 'Session failed to destroy');
      }

      return result;
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.SESSION_ANALYZE,
    async (_event, sessionId: string): Promise<SessionAnalysisResult> => {
      console.log(`[ipc] analyzeSession ${sessionId.slice(0, 12)}`);
      return analyzeSession(sessionId);
    },
  );

  ipcMain.handle(IPC_CHANNELS.INSTALL_CRASH_TRAP, async (): Promise<void> => {
    docker.installCrashTrap();
  });

  ipcMain.handle(IPC_CHANNELS.GET_VERSION, async (): Promise<string> => {
    return VERSION;
  });

  console.log('[main] IPC handlers registered');
}

app.whenReady().then(async () => {
  console.log(`[main] Airlock ${VERSION} starting...`);

  configureSessionForLocalVnc();
  registerIpcHandlers();
  docker.installCrashTrap();

  mainWindow = createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createMainWindow();
    }
  });

  console.log('[main] Ready');
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', async (event) => {
  console.log('[main] before-quit: destroying all containers...');
  event.preventDefault();

  try {
    const sessions = docker.getActiveSessions();
    await Promise.all(
      sessions.map((s) =>
        docker.destroyContainer(s.id).catch((err) => {
          console.error(`[main] Failed to destroy ${s.id}:`, err);
        }),
      ),
    );
  } catch (error) {
    console.error('[main] Error during cleanup:', error);
  }

  app.exit(0);
});

app.on('certificate-error', (event, _webContents, url, _error, _certificate, callback) => {
  if (process.env.VITE_DEV_SERVER_URL ?? url.startsWith('http://127.0.0.1:')) {
    event.preventDefault();
    callback(true);
  } else {
    callback(false);
  }
});

app.on('open-file', (event, filePath) => {
  event.preventDefault();
  if (mainWindow) {
    mainWindow.webContents.send('airlock:open-file', filePath);
  }
});

app.on('open-url', (event, _url) => {
  event.preventDefault();
});

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (_event, argv) => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();

      const fileOrUrl = argv.find((arg) => !arg.startsWith('--'));
      if (fileOrUrl && !fileOrUrl.startsWith('http://') && !fileOrUrl.startsWith('https://')) {
        mainWindow.webContents.send('airlock:open-file', fileOrUrl);
      }
    }
  });
}
