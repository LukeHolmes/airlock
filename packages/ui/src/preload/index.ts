/**
 * Airlock Preload Script
 *
 * Exposes type-safe IPC API to the renderer process via contextBridge.
 * All container operations are proxied to the main process.
 */

import { contextBridge, ipcRenderer } from "electron";
import {
  IPC_CHANNELS,
  type AirlockIpcApi,
  type CreateFileContainerRequest,
  type CreateUrlContainerRequest,
  type ContainerSession,
  type ContainerStatus,
  type SessionStartedEvent,
  type SessionEndedEvent,
  type SessionErrorEvent,
} from "../shared/ipc.js";

// Container lifecycle handlers

async function createFileContainer(
  request: CreateFileContainerRequest,
): Promise<ContainerSession> {
  return ipcRenderer.invoke(IPC_CHANNELS.CONTAINER_CREATE, request);
}

async function createUrlContainer(
  request: CreateUrlContainerRequest,
): Promise<ContainerSession> {
  return ipcRenderer.invoke(IPC_CHANNELS.CONTAINER_CREATE_URL, request);
}

async function destroyContainer(sessionId: string): Promise<void> {
  return ipcRenderer.invoke(IPC_CHANNELS.CONTAINER_DESTROY, sessionId);
}

async function killContainer(sessionId: string): Promise<void> {
  return ipcRenderer.invoke(IPC_CHANNELS.CONTAINER_KILL, sessionId);
}

async function listContainers(): Promise<ContainerSession[]> {
  return ipcRenderer.invoke(IPC_CHANNELS.CONTAINER_LIST);
}

async function getContainerStatus(sessionId: string): Promise<ContainerStatus> {
  return ipcRenderer.invoke(IPC_CHANNELS.CONTAINER_STATUS, sessionId);
}

// Session event subscribers

function onSessionStarted(
  callback: (event: SessionStartedEvent) => void,
): () => void {
  const handler = (_event: Electron.IpcRendererEvent, data: SessionStartedEvent) => {
    callback(data);
  };
  ipcRenderer.on(IPC_CHANNELS.SESSION_STARTED, handler);
  return () => {
    ipcRenderer.removeListener(IPC_CHANNELS.SESSION_STARTED, handler);
  };
}

function onSessionEnded(
  callback: (event: SessionEndedEvent) => void,
): () => void {
  const handler = (_event: Electron.IpcRendererEvent, data: SessionEndedEvent) => {
    callback(data);
  };
  ipcRenderer.on(IPC_CHANNELS.SESSION_ENDED, handler);
  return () => {
    ipcRenderer.removeListener(IPC_CHANNELS.SESSION_ENDED, handler);
  };
}

function onSessionError(
  callback: (event: SessionErrorEvent) => void,
): () => void {
  const handler = (_event: Electron.IpcRendererEvent, data: SessionErrorEvent) => {
    callback(data);
  };
  ipcRenderer.on(IPC_CHANNELS.SESSION_ERROR, handler);
  return () => {
    ipcRenderer.removeListener(IPC_CHANNELS.SESSION_ERROR, handler);
  };
}

// System handlers

async function installCrashTrap(): Promise<void> {
  return ipcRenderer.invoke(IPC_CHANNELS.INSTALL_CRASH_TRAP);
}

async function getVersion(): Promise<string> {
  return ipcRenderer.invoke(IPC_CHANNELS.GET_VERSION);
}

// Expose API to renderer

const airlockApi: AirlockIpcApi = {
  createFileContainer,
  createUrlContainer,
  destroyContainer,
  killContainer,
  listContainers,
  getContainerStatus,
  onSessionStarted,
  onSessionEnded,
  onSessionError,
  installCrashTrap,
  getVersion,
};

contextBridge.exposeInMainWorld("airlock", airlockApi);

console.log("[preload] Airlock IPC API exposed");
