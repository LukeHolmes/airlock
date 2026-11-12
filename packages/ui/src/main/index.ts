/**
 * Airlock Electron Main Process
 *
 * Entry point for the Electron application. Sets up:
 * - Main window with KasmVNC-ready security settings
 * - IPC handlers bridging to the session contract layer
 * - Crash trap installation on app startup
 * - Protocol/URL handling
 */

import { app, BrowserWindow, dialog, ipcMain, Menu, session, shell } from 'electron';
import { existsSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  docker,
  executeAirlockSession,
  destroyAirlockSession,
  analyzeSession,
  getSessionTriage,
  prepareSessionExport,
  validateDrop,
  configureSandboxImage,
  ensureSandboxImageReady,
  log,
  SandboxSetupError,
} from '@airlock/core';
import { DOCKER_DOWNLOAD_URL } from './dockerCheck.js';
import { resolveSetupGuidePath } from './docsPath.js';
import { getReadiness, refreshReadiness } from './readiness.js';
import { getSandboxBuildContextPath } from './sandboxContext.js';
import {
  IPC_CHANNELS,
  type AirlockInput,
  type AirlockSession,
  type AirlockReadiness,
  type DropValidationResult,
  type EnsureSandboxImageOutcome,
  type SandboxSetupProgress,
  type SessionAnalysisResult,
  type SessionTriageSnapshot,
  type SessionExportResult,
  type SessionStartedEvent,
  type SessionEndedEvent,
  type SessionErrorEvent,
} from '../shared/ipc.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const VERSION = '0.4.1';

function parseSessionPort(session: AirlockSession): number | undefined {
  if (!session.vncUrl) {
    return undefined;
  }

  try {
    const port = Number(new URL(session.vncUrl).port);
    return Number.isFinite(port) ? port : undefined;
  } catch {
    return undefined;
  }
}

function logSessionEvent(
  eventName: 'session:start' | 'session:ready' | 'session:error' | 'session:destroy',
  session: AirlockSession,
  extra?: Record<string, unknown>,
): void {
  log('INFO', eventName, {
    eventName,
    sessionId: session.sessionId,
    containerId: session.containerId,
    port: parseSessionPort(session),
    status: session.status,
    ...extra,
  });
}

function pickOpenablePath(argv: string[]): string | undefined {
  const ignoredSuffixes = ['electron', 'airlock', 'Airlock'];

  return [...argv].reverse().find((arg) => {
    if (!arg || arg.startsWith('-') || arg === '.') {
      return false;
    }
    if (arg.includes('node_modules/electron') || arg.includes('/.pnpm/')) {
      return false;
    }
    if (ignoredSuffixes.some((suffix) => arg.endsWith(suffix))) {
      return false;
    }
    if (arg.startsWith('http://') || arg.startsWith('https://')) {
      return false;
    }
    return existsSync(arg);
  });
}

async function deliverOpenFileToRenderer(filePath: string): Promise<void> {
  if (!mainWindow) {
    return;
  }

  const send = () => {
    mainWindow?.webContents.send('airlock:open-file', filePath);
  };

  const deliver = async () => {
    try {
      await getReadiness();
    } catch {
      // Renderer will queue the open until sandbox setup finishes.
    }
    send();
  };

  if (mainWindow.webContents.isLoading()) {
    mainWindow.webContents.once('did-finish-load', () => {
      void deliver();
    });
  } else {
    await deliver();
  }
}

function getAppIconPath(): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'icons', 'icon.png');
  }

  return path.join(__dirname, '../../../build/icons/icon.png');
}

configureSandboxImage({ appVersion: VERSION, ghcrOwner: 'lukeholmes' });

let mainWindow: BrowserWindow | null = null;

async function ensureReadinessNotice(): Promise<void> {
  // First-run setup and Docker status are handled in the renderer progress screen.
  await refreshReadiness();
}

function buildUnavailableSession(input: AirlockInput, sessionId: string): AirlockSession {
  const now = Date.now();
  return {
    sessionId,
    containerId: '',
    status: 'error',
    metadata: {
      startTime: now,
      endTime: now,
      exitReason: 'error',
      inputType: input.type,
      networkMode: input.type === 'url' ? 'enabled' : (input.networkMode ?? 'isolated'),
    },
  };
}

function buildDockerUnavailableSession(input: AirlockInput): AirlockSession {
  return buildUnavailableSession(input, 'docker-unavailable');
}

function buildSandboxUnavailableSession(input: AirlockInput): AirlockSession {
  return buildUnavailableSession(input, 'sandbox-unavailable');
}

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
    icon: getAppIconPath(),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      preload: path.join(__dirname, '../../preload/preload/index.js'),
      webSecurity: true,
      allowRunningInsecureContent: false,
      experimentalFeatures: false,
    },
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    window.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    window.loadFile(path.join(__dirname, '../../renderer/index.html'));
  }

  if (process.env.NODE_ENV === 'development') {
    window.webContents.openDevTools();
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
    if (url === 'about:blank') {
      return { action: 'allow' };
    }
    try {
      const parsed = new URL(url);
      const isLoopback =
        parsed.hostname === '127.0.0.1' ||
        parsed.hostname === 'localhost' ||
        parsed.hostname === '::1';
      if (parsed.protocol === 'http:' && isLoopback) {
        return { action: 'deny' };
      }
    } catch {
      // fall through
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

function createApplicationMenu(): void {
  const isMac = process.platform === 'darwin';

  const template: Electron.MenuItemConstructorOptions[] = [
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: 'about' as const },
              { type: 'separator' as const },
              { role: 'services' as const },
              { type: 'separator' as const },
              { role: 'hide' as const },
              { role: 'hideOthers' as const },
              { role: 'unhide' as const },
              { type: 'separator' as const },
              { role: 'quit' as const },
            ],
          },
        ]
      : []),
    {
      label: 'File',
      submenu: [isMac ? { role: 'close' } : { role: 'quit' }],
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Setup guide',
          click: () => {
            void openSetupGuide();
          },
        },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

async function openSetupGuide(): Promise<void> {
  const guidePath = resolveSetupGuidePath();
  if (!guidePath) {
    await dialog.showMessageBox({
      type: 'warning',
      title: 'Setup guide not found',
      message: 'The getting started guide could not be located.',
      detail: 'Visit the Airlock releases page on GitHub for installation help.',
      buttons: ['OK'],
    });
    return;
  }

  const error = await shell.openPath(guidePath);
  if (error) {
    await dialog.showMessageBox({
      type: 'warning',
      title: 'Could not open guide',
      message: error,
      buttons: ['OK'],
    });
  }
}

function registerIpcHandlers(): void {
  ipcMain.handle(
    IPC_CHANNELS.SESSION_CREATE,
    async (_event, input: AirlockInput): Promise<AirlockSession> => {
      console.log(`[ipc] executeAirlockSession type=${input.type}`);

      const readiness = await refreshReadiness();

      if (!readiness.docker.available) {
        const error = buildDockerUnavailableSession(input);
        logSessionEvent('session:error', error, { reason: 'docker_unavailable' });
        emitSessionError(error, 'Airlock requires Docker Desktop to run sandboxes.');
        return error;
      }

      if (!readiness.sandboxImage.available) {
        const error = buildSandboxUnavailableSession(input);
        logSessionEvent('session:error', error, { reason: 'sandbox_image_missing' });
        emitSessionError(
          error,
          'Sandbox is not set up. Open the setup window and click Set up sandbox.',
        );
        return error;
      }

      log('INFO', 'session:start', {
        eventName: 'session:start',
        inputType: input.type,
      });

      const result = await executeAirlockSession(input);

      if (result.status === 'running') {
        logSessionEvent('session:ready', result);
        emitSessionStarted(result);
      } else if (result.status === 'error') {
        logSessionEvent('session:error', result, { reason: 'session_start_failed' });
        emitSessionError(result, 'Session failed to start');
      }

      return result;
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.SESSION_DESTROY,
    async (_event, activeSession: AirlockSession): Promise<AirlockSession> => {
      console.log(`[ipc] destroyAirlockSession ${activeSession.sessionId.slice(0, 12)}`);
      logSessionEvent('session:destroy', activeSession);
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

  ipcMain.handle(
    IPC_CHANNELS.SESSION_GET_TRIAGE,
    async (_event, sessionId: string): Promise<SessionTriageSnapshot> => {
      return getSessionTriage(sessionId);
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.SESSION_EXPORT,
    async (event, sessionId: string): Promise<SessionExportResult> => {
      console.log(`[ipc] exportSession ${sessionId.slice(0, 12)}`);
      try {
        const prepared = await prepareSessionExport(sessionId, VERSION);
        const parent = BrowserWindow.fromWebContents(event.sender);
        const saveOptions = {
          title: 'Export session',
          defaultPath: prepared.suggestedFileName,
          filters: [{ name: 'JSON', extensions: ['json'] as string[] }],
        };
        const { canceled, filePath } = parent
          ? await dialog.showSaveDialog(parent, saveOptions)
          : await dialog.showSaveDialog(saveOptions);

        if (canceled || !filePath) {
          return { ok: false, canceled: true };
        }

        await writeFile(filePath, prepared.json, 'utf8');
        return { ok: true, filePath };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`[ipc] exportSession failed: ${message}`);
        return { ok: false, canceled: false, error: message };
      }
    },
  );

  ipcMain.handle(IPC_CHANNELS.INSTALL_CRASH_TRAP, async (): Promise<void> => {
    docker.installCrashTrap();
  });

  ipcMain.handle(IPC_CHANNELS.GET_VERSION, async (): Promise<string> => {
    return VERSION;
  });

  ipcMain.handle(IPC_CHANNELS.GET_READINESS, async (): Promise<AirlockReadiness> => {
    return refreshReadiness();
  });

  ipcMain.handle(
    IPC_CHANNELS.VALIDATE_DROP,
    async (_event, filePath: string): Promise<DropValidationResult> => {
      return validateDrop(filePath);
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.ENSURE_SANDBOX_IMAGE,
    async (event): Promise<EnsureSandboxImageOutcome> => {
      const buildContextPath = getSandboxBuildContextPath() ?? undefined;
      const sendProgress = (progress: SandboxSetupProgress) => {
        event.sender.send(IPC_CHANNELS.SANDBOX_SETUP_PROGRESS, progress);
      };

      try {
        const result = await ensureSandboxImageReady({
          buildContextPath,
          onProgress: sendProgress,
        });
        await refreshReadiness();
        return { ok: true, result };
      } catch (error) {
        if (error instanceof SandboxSetupError) {
          return { ok: false, code: error.code, message: error.message };
        }

        const message = error instanceof Error ? error.message : String(error);
        return { ok: false, code: 'unknown', message };
      }
    },
  );

  ipcMain.handle(IPC_CHANNELS.OPEN_SETUP_GUIDE, async (): Promise<void> => {
    await openSetupGuide();
  });

  ipcMain.handle(IPC_CHANNELS.OPEN_DOCKER_DOWNLOAD, async (): Promise<void> => {
    await shell.openExternal(DOCKER_DOWNLOAD_URL);
  });

  console.log('[main] IPC handlers registered');
}

app.whenReady().then(async () => {
  console.log(`[main] Airlock ${VERSION} starting...`);

  configureSessionForLocalVnc();
  createApplicationMenu();
  registerIpcHandlers();
  docker.installCrashTrap();

  const readiness = await refreshReadiness();
  if (readiness.docker.available) {
    const reclaimed = await docker.recoverStaleManagedContainers();
    if (reclaimed > 0) {
      console.log(`[main] Reclaimed ${reclaimed} stale Airlock container(s) from prior run`);
    }
  }

  mainWindow = createMainWindow();
  void ensureReadinessNotice();

  const cliFile = pickOpenablePath(process.argv);
  if (cliFile) {
    void deliverOpenFileToRenderer(cliFile);
  }

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
  console.log('[main] before-quit: destroying managed containers...');
  event.preventDefault();

  try {
    await docker.shutdownManagedContainers();
  } catch (error) {
    console.error('[main] Error during cleanup:', error);
    violentGarbageCollectFallback();
  }

  app.exit(0);
});

function violentGarbageCollectFallback(): void {
  try {
    docker.violentGarbageCollect();
  } catch {
    // best-effort sync cleanup when dockerode shutdown fails
  }
}

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

      const fileOrUrl = pickOpenablePath(argv);
      if (fileOrUrl) {
        void deliverOpenFileToRenderer(fileOrUrl);
      }
    }
  });
}
