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
  type EnsureSandboxImageOutcome,
  type SandboxSetupProgress,
  type SessionAnalysisResult,
  type SessionExportResult,
  type ReceiptVerifyResult,
  type ReceiptExportPublicKeyResult,
  type ReceiptKeyStatus,
  type SessionTriageSnapshot,
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

async function exportSession(sessionId: string): Promise<SessionExportResult> {
  return ipcRenderer.invoke(IPC_CHANNELS.SESSION_EXPORT, sessionId);
}

async function verifyReceipt(): Promise<ReceiptVerifyResult> {
  return ipcRenderer.invoke(IPC_CHANNELS.RECEIPT_VERIFY);
}

async function exportReceiptPublicKey(): Promise<ReceiptExportPublicKeyResult> {
  return ipcRenderer.invoke(IPC_CHANNELS.RECEIPT_EXPORT_PUBLIC_KEY);
}

async function getReceiptKeyStatus(): Promise<ReceiptKeyStatus> {
  return ipcRenderer.invoke(IPC_CHANNELS.RECEIPT_KEY_STATUS);
}

async function getSessionTriage(sessionId: string): Promise<SessionTriageSnapshot> {
  return ipcRenderer.invoke(IPC_CHANNELS.SESSION_GET_TRIAGE, sessionId);
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

async function ensureSandboxImage(): Promise<EnsureSandboxImageOutcome> {
  return ipcRenderer.invoke(IPC_CHANNELS.ENSURE_SANDBOX_IMAGE);
}

function onSandboxSetupProgress(callback: (progress: SandboxSetupProgress) => void): () => void {
  const handler = (_event: Electron.IpcRendererEvent, progress: SandboxSetupProgress) => {
    callback(progress);
  };
  ipcRenderer.on(IPC_CHANNELS.SANDBOX_SETUP_PROGRESS, handler);
  return () => {
    ipcRenderer.removeListener(IPC_CHANNELS.SANDBOX_SETUP_PROGRESS, handler);
  };
}

async function openSetupGuide(): Promise<void> {
  return ipcRenderer.invoke(IPC_CHANNELS.OPEN_SETUP_GUIDE);
}

async function openDockerDownload(): Promise<void> {
  return ipcRenderer.invoke(IPC_CHANNELS.OPEN_DOCKER_DOWNLOAD);
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
  exportSession,
  verifyReceipt,
  exportReceiptPublicKey,
  getReceiptKeyStatus,
  getSessionTriage,
  onSessionStarted,
  onSessionEnded,
  onSessionError,
  installCrashTrap,
  getVersion,
  getReadiness,
  validateDrop,
  ensureSandboxImage,
  onSandboxSetupProgress,
  openSetupGuide,
  openDockerDownload,
  getPathForFile: (file: File) => webUtils.getPathForFile(file),
  onOpenFile,
};

contextBridge.exposeInMainWorld('airlock', airlockApi);

console.log('[preload] Airlock session IPC API exposed');
