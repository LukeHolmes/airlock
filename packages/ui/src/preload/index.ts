/**
 * Airlock Preload Script
 *
 * Exposes the canonical session contract to the renderer via contextBridge.
 */

import { contextBridge, ipcRenderer, webUtils } from 'electron';
import {
  IPC_CHANNELS,
  type AirlockIpcApi,
  type AirlockInput,
  type AirlockSession,
  type AirlockReadiness,
  type DropValidationResult,
  type EnsureSandboxImageResult,
  type SessionAnalysisResult,
  type SessionStartedEvent,
  type SessionEndedEvent,
  type SessionErrorEvent,
} from '../shared/ipc.js';

async function createSession(input: AirlockInput): Promise<AirlockSession> {
  return ipcRenderer.invoke(IPC_CHANNELS.SESSION_CREATE, input);
}

async function destroySession(session: AirlockSession): Promise<AirlockSession> {
  return ipcRenderer.invoke(IPC_CHANNELS.SESSION_DESTROY, session);
}

async function analyzeSession(sessionId: string): Promise<SessionAnalysisResult> {
  return ipcRenderer.invoke(IPC_CHANNELS.SESSION_ANALYZE, sessionId);
}

function onSessionStarted(callback: (event: SessionStartedEvent) => void): () => void {
  const handler = (_event: Electron.IpcRendererEvent, data: SessionStartedEvent) => {
    callback(data);
  };
  ipcRenderer.on(IPC_CHANNELS.SESSION_STARTED, handler);
  return () => {
    ipcRenderer.removeListener(IPC_CHANNELS.SESSION_STARTED, handler);
  };
}

function onSessionEnded(callback: (event: SessionEndedEvent) => void): () => void {
  const handler = (_event: Electron.IpcRendererEvent, data: SessionEndedEvent) => {
    callback(data);
  };
  ipcRenderer.on(IPC_CHANNELS.SESSION_ENDED, handler);
  return () => {
    ipcRenderer.removeListener(IPC_CHANNELS.SESSION_ENDED, handler);
  };
}

function onSessionError(callback: (event: SessionErrorEvent) => void): () => void {
  const handler = (_event: Electron.IpcRendererEvent, data: SessionErrorEvent) => {
    callback(data);
  };
  ipcRenderer.on(IPC_CHANNELS.SESSION_ERROR, handler);
  return () => {
    ipcRenderer.removeListener(IPC_CHANNELS.SESSION_ERROR, handler);
  };
}

async function installCrashTrap(): Promise<void> {
  return ipcRenderer.invoke(IPC_CHANNELS.INSTALL_CRASH_TRAP);
}

async function getVersion(): Promise<string> {
  return ipcRenderer.invoke(IPC_CHANNELS.GET_VERSION);
}

async function getReadiness(): Promise<AirlockReadiness> {
  return ipcRenderer.invoke(IPC_CHANNELS.GET_READINESS);
}

async function validateDrop(filePath: string): Promise<DropValidationResult> {
  return ipcRenderer.invoke(IPC_CHANNELS.VALIDATE_DROP, filePath);
}

async function ensureSandboxImage(): Promise<EnsureSandboxImageResult> {
  return ipcRenderer.invoke(IPC_CHANNELS.ENSURE_SANDBOX_IMAGE);
}

function onOpenFile(callback: (filePath: string) => void): () => void {
  const handler = (_event: Electron.IpcRendererEvent, filePath: string) => {
    callback(filePath);
  };
  ipcRenderer.on('airlock:open-file', handler);
  return () => {
    ipcRenderer.removeListener('airlock:open-file', handler);
  };
}

const airlockApi: AirlockIpcApi = {
  createSession,
  destroySession,
  analyzeSession,
  onSessionStarted,
  onSessionEnded,
  onSessionError,
  installCrashTrap,
  getVersion,
  getReadiness,
  validateDrop,
  ensureSandboxImage,
  getPathForFile: (file: File) => webUtils.getPathForFile(file),
  onOpenFile,
};

contextBridge.exposeInMainWorld('airlock', airlockApi);

console.log('[preload] Airlock session IPC API exposed');
