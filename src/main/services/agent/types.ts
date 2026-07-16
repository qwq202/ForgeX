import type { AgentEvent, AgentStatus } from '@shared/types'

export interface AgentConnectionOptions {
  sessionId: string
  projectId: string
  cwd: string
  executablePath: string
  args?: string[]
  env?: Record<string, string>
  autoRestart?: boolean
}

/**
 * Pluggable transport for Grok Build / future ACP.
 * Renderer never talks to processes directly — only via this abstraction through IPC.
 */
export interface AgentTransport {
  connect(options: AgentConnectionOptions): Promise<void>
  sendMessage(message: string): Promise<void>
  cancel(): Promise<void>
  disconnect(): Promise<void>
  forceKill(): Promise<void>
  onEvent(listener: (event: AgentEvent) => void): () => void
  getStatus(): AgentStatus
  getPid(): number | null
}
