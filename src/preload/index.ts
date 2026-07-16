import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import { IpcChannels } from '../shared/contracts/ipc'
import type { ForgeXAPI } from './types'

function invoke<T>(channel: string, payload?: unknown): Promise<T> {
  return ipcRenderer.invoke(channel, payload) as Promise<T>
}

function on(
  channel: string,
  listener: (event: IpcRendererEvent, ...args: unknown[]) => void
): () => void {
  const handler = (event: IpcRendererEvent, ...args: unknown[]): void => listener(event, ...args)
  ipcRenderer.on(channel, handler)
  return () => {
    ipcRenderer.removeListener(channel, handler)
  }
}

const api: ForgeXAPI = {
  app: {
    getInfo: () => invoke(IpcChannels['app:getInfo']),
    getGrokBuildInfo: () => invoke(IpcChannels['app:getGrokBuildInfo']),
    openExternal: (url) => invoke(IpcChannels['app:openExternal'], { url }),
    showItemInFolder: (path) => invoke(IpcChannels['app:showItemInFolder'], { path })
  },
  projects: {
    list: () => invoke(IpcChannels['projects:list']),
    openDirectory: (options) => invoke(IpcChannels['projects:openDirectory'], options ?? {}),
    add: (path) => invoke(IpcChannels['projects:add'], { path }),
    remove: (projectId) => invoke(IpcChannels['projects:remove'], { projectId }),
    get: (projectId) => invoke(IpcChannels['projects:get'], { projectId }),
    touch: (projectId) => invoke(IpcChannels['projects:touch'], { projectId })
  },
  sessions: {
    list: (projectId) => invoke(IpcChannels['sessions:list'], { projectId }),
    create: (projectId, title) => invoke(IpcChannels['sessions:create'], { projectId, title }),
    rename: (sessionId, title) => invoke(IpcChannels['sessions:rename'], { sessionId, title }),
    delete: (sessionId) => invoke(IpcChannels['sessions:delete'], { sessionId }),
    get: (sessionId) => invoke(IpcChannels['sessions:get'], { sessionId })
  },
  messages: {
    list: (sessionId) => invoke(IpcChannels['messages:list'], { sessionId }),
    create: (input) => invoke(IpcChannels['messages:create'], input),
    update: (messageId, patch) =>
      invoke(IpcChannels['messages:update'], { messageId, ...patch }),
    listToolCalls: (sessionId) => invoke(IpcChannels['messages:listToolCalls'], { sessionId })
  },
  files: {
    listTree: (projectId, relativePath) =>
      invoke(IpcChannels['files:listTree'], { projectId, relativePath }),
    read: (projectId, relativePath, maxBytes) =>
      invoke(IpcChannels['files:read'], { projectId, relativePath, maxBytes }),
    watch: (projectId) => invoke(IpcChannels['files:watch'], { projectId }),
    unwatch: (projectId) => invoke(IpcChannels['files:unwatch'], { projectId })
  },
  git: {
    status: (projectId) => invoke(IpcChannels['git:status'], { projectId }),
    diff: (projectId, relativePath) =>
      invoke(IpcChannels['git:diff'], { projectId, relativePath }),
    discard: (projectId, relativePath) =>
      invoke(IpcChannels['git:discard'], { projectId, relativePath })
  },
  terminal: {
    create: (projectId, cols, rows) =>
      invoke(IpcChannels['terminal:create'], { projectId, cols, rows }),
    write: (terminalId, data) => invoke(IpcChannels['terminal:write'], { terminalId, data }),
    resize: (terminalId, cols, rows) =>
      invoke(IpcChannels['terminal:resize'], { terminalId, cols, rows }),
    dispose: (terminalId) => invoke(IpcChannels['terminal:dispose'], { terminalId }),
    list: () => invoke(IpcChannels['terminal:list'])
  },
  agent: {
    start: (sessionId, projectId) =>
      invoke(IpcChannels['agent:start'], { sessionId, projectId }),
    sendMessage: (sessionId, content) =>
      invoke(IpcChannels['agent:sendMessage'], { sessionId, content }),
    cancel: (sessionId) => invoke(IpcChannels['agent:cancel'], { sessionId }),
    stop: (sessionId) => invoke(IpcChannels['agent:stop'], { sessionId }),
    restart: (sessionId, projectId) =>
      invoke(IpcChannels['agent:restart'], { sessionId, projectId }),
    getState: (sessionId) => invoke(IpcChannels['agent:getState'], { sessionId }),
    respondApproval: (approvalId, approved) =>
      invoke(IpcChannels['agent:respondApproval'], { approvalId, approved })
  },
  settings: {
    get: () => invoke(IpcChannels['settings:get']),
    update: (partial) => invoke(IpcChannels['settings:update'], partial)
  },
  events: {
    onAgent: (listener) =>
      on(IpcChannels['event:agent'], (_e, payload) => listener(payload as never)),
    onTerminalData: (listener) =>
      on(IpcChannels['event:terminal:data'], (_e, payload) => listener(payload as never)),
    onTerminalExit: (listener) =>
      on(IpcChannels['event:terminal:exit'], (_e, payload) => listener(payload as never)),
    onFileChange: (listener) =>
      on(IpcChannels['event:file:change'], (_e, payload) => listener(payload as never)),
    onLog: (listener) =>
      on(IpcChannels['event:log'], (_e, payload) => listener(payload as never)),
    onApproval: (listener) =>
      on(IpcChannels['event:approval'], (_e, payload) => listener(payload as never))
  }
}

contextBridge.exposeInMainWorld('forgex', api)
