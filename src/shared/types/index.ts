/** Shared domain types used by Main, Preload, and Renderer */

export type ThemeMode = 'light' | 'dark' | 'system'

export type AgentStatus =
  | 'idle'
  | 'starting'
  | 'running'
  | 'streaming'
  | 'tool_calling'
  | 'waiting_approval'
  | 'stopping'
  | 'error'
  | 'stopped'

export type MessageRole = 'user' | 'assistant' | 'system' | 'tool'
export type MessageStatus = 'pending' | 'streaming' | 'completed' | 'error' | 'cancelled'

export type ToolCallStatus =
  | 'pending'
  | 'running'
  | 'awaiting_approval'
  | 'approved'
  | 'rejected'
  | 'completed'
  | 'error'

export type BottomPanelTab = 'terminal' | 'logs' | 'problems'
export type RightPanelTab = 'files' | 'diff' | 'changes'

export interface Project {
  id: string
  name: string
  path: string
  isGitRepo: boolean
  lastOpenedAt: string
  createdAt: string
  updatedAt: string
}

export interface Session {
  id: string
  projectId: string
  title: string
  status: AgentStatus
  createdAt: string
  updatedAt: string
}

export interface Message {
  id: string
  sessionId: string
  role: MessageRole
  content: string
  status: MessageStatus
  metadata?: Record<string, unknown> | null
  createdAt: string
  updatedAt: string
}

export interface ToolCall {
  id: string
  messageId: string
  sessionId: string
  name: string
  arguments: string
  result?: string | null
  status: ToolCallStatus
  createdAt: string
  updatedAt: string
}

export interface AppSettings {
  grokBuildPath: string
  defaultShell: string
  defaultProjectDir: string
  theme: ThemeMode
  fontSize: number
  terminalFontSize: number
  autoRestoreProject: boolean
  autoRestoreSession: boolean
  showVerboseLogs: boolean
  editorWordWrap: boolean
  editorFontSize: number
}

export interface AppInfo {
  version: string
  name: string
  platform: string
  arch: string
  electronVersion: string
  nodeVersion: string
  chromeVersion: string
  userDataPath: string
  databasePath: string
  isPackaged: boolean
}

export interface GrokBuildInfo {
  installed: boolean
  path: string | null
  version: string | null
  error?: string
}

export interface FileTreeNode {
  name: string
  path: string
  relativePath: string
  isDirectory: boolean
  children?: FileTreeNode[]
}

export interface FileContent {
  path: string
  relativePath: string
  content: string
  language: string
  size: number
  truncated: boolean
  encoding: string
  isBinary: boolean
}

export interface GitFileStatus {
  path: string
  status: 'modified' | 'added' | 'deleted' | 'renamed' | 'untracked' | 'conflicted'
  staged: boolean
  insertions?: number
  deletions?: number
}

export interface GitStatus {
  isRepo: boolean
  branch: string | null
  ahead: number
  behind: number
  files: GitFileStatus[]
  dirty: boolean
}

export interface GitDiff {
  path: string
  original: string
  modified: string
  isBinary: boolean
  insertions: number
  deletions: number
  isNew: boolean
  isDeleted: boolean
}

export interface TerminalInfo {
  id: string
  projectId: string
  cwd: string
  shell: string
  cols: number
  rows: number
  pid: number
}

export interface LogEntry {
  id: string
  level: 'debug' | 'info' | 'warn' | 'error'
  source: string
  message: string
  timestamp: string
}

export interface ProblemEntry {
  id: string
  severity: 'error' | 'warning' | 'info'
  message: string
  file?: string
  line?: number
  column?: number
  source?: string
}

export interface AgentProcessState {
  sessionId: string | null
  projectId: string | null
  status: AgentStatus
  pid: number | null
  startedAt: string | null
  lastError: string | null
  version: string | null
  executablePath: string | null
}

export type AgentEventType =
  | 'status'
  | 'stdout'
  | 'stderr'
  | 'message_delta'
  | 'message_complete'
  | 'tool_call_start'
  | 'tool_call_update'
  | 'tool_call_end'
  | 'approval_required'
  | 'error'
  | 'exit'

export interface AgentEvent {
  type: AgentEventType
  sessionId: string
  timestamp: string
  data: Record<string, unknown>
}

export interface ApprovalRequest {
  id: string
  sessionId: string
  toolCallId: string
  command: string
  description: string
  risk: 'low' | 'medium' | 'high'
}

export interface IpcErrorPayload {
  code: string
  message: string
  details?: unknown
}

export interface FileChangeEvent {
  type: 'add' | 'change' | 'unlink' | 'addDir' | 'unlinkDir'
  path: string
  relativePath: string
  projectId: string
}
