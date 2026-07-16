import type {
  AgentEvent,
  AgentProcessState,
  AppInfo,
  AppSettings,
  ApprovalRequest,
  FileChangeEvent,
  FileContent,
  FileTreeNode,
  GitDiff,
  GitStatus,
  GrokBuildInfo,
  LogEntry,
  Message,
  Project,
  Session,
  TerminalInfo,
  ToolCall
} from '../shared/types'

export interface ForgeXAPI {
  app: {
    getInfo(): Promise<AppInfo>
    getGrokBuildInfo(): Promise<GrokBuildInfo>
    openExternal(url: string): Promise<void>
    showItemInFolder(path: string): Promise<void>
  }
  projects: {
    list(): Promise<Project[]>
    openDirectory(options?: { defaultPath?: string }): Promise<string | null>
    add(path: string): Promise<Project>
    remove(projectId: string): Promise<boolean>
    get(projectId: string): Promise<Project | null>
    touch(projectId: string): Promise<Project | null>
  }
  sessions: {
    list(projectId: string): Promise<Session[]>
    create(projectId: string, title?: string): Promise<Session>
    rename(sessionId: string, title: string): Promise<Session>
    delete(sessionId: string): Promise<boolean>
    get(sessionId: string): Promise<Session | null>
  }
  messages: {
    list(sessionId: string): Promise<Message[]>
    create(input: {
      sessionId: string
      role: Message['role']
      content: string
      status?: Message['status']
      metadata?: Record<string, unknown>
    }): Promise<Message>
    update(
      messageId: string,
      patch: {
        content?: string
        status?: Message['status']
        metadata?: Record<string, unknown>
      }
    ): Promise<Message>
    listToolCalls(sessionId: string): Promise<ToolCall[]>
  }
  files: {
    listTree(projectId: string, relativePath?: string): Promise<FileTreeNode[]>
    read(projectId: string, relativePath: string, maxBytes?: number): Promise<FileContent>
    watch(projectId: string): Promise<void>
    unwatch(projectId: string): Promise<void>
  }
  git: {
    status(projectId: string): Promise<GitStatus>
    diff(projectId: string, relativePath: string): Promise<GitDiff>
    discard(projectId: string, relativePath: string): Promise<void>
  }
  terminal: {
    create(projectId: string, cols?: number, rows?: number): Promise<TerminalInfo>
    write(terminalId: string, data: string): Promise<void>
    resize(terminalId: string, cols: number, rows: number): Promise<void>
    dispose(terminalId: string): Promise<void>
    list(): Promise<TerminalInfo[]>
  }
  agent: {
    start(sessionId: string, projectId: string): Promise<AgentProcessState>
    sendMessage(sessionId: string, content: string): Promise<void>
    cancel(sessionId: string): Promise<void>
    stop(sessionId: string): Promise<void>
    restart(sessionId: string, projectId: string): Promise<AgentProcessState>
    getState(sessionId: string | null): Promise<AgentProcessState>
    respondApproval(approvalId: string, approved: boolean): Promise<void>
  }
  settings: {
    get(): Promise<AppSettings>
    update(partial: Partial<AppSettings>): Promise<AppSettings>
  }
  events: {
    onAgent(listener: (event: AgentEvent) => void): () => void
    onTerminalData(listener: (payload: { terminalId: string; data: string }) => void): () => void
    onTerminalExit(
      listener: (payload: { terminalId: string; exitCode: number; signal?: number }) => void
    ): () => void
    onFileChange(listener: (event: FileChangeEvent) => void): () => void
    onLog(listener: (entry: LogEntry) => void): () => void
    onApproval(listener: (req: ApprovalRequest) => void): () => void
  }
}

declare global {
  interface Window {
    forgex: ForgeXAPI
  }
}

export {}
