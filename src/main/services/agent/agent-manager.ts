import { BrowserWindow } from 'electron'
import { IpcChannels } from '@shared/contracts/ipc'
import type { AgentEvent, AgentProcessState, ApprovalRequest } from '@shared/types'
import { createId } from '@shared/utils/id'
import { StdioAgentTransport } from './stdio-transport'
import type { AgentTransport } from './types'
import { detectGrokBuild } from './grok-build-detector'
import { sessionsRepo } from '../database/repositories/sessions'
import { messagesRepo } from '../database/repositories/messages'
import { logger } from '../logger'

interface ManagedSession {
  sessionId: string
  projectId: string
  cwd: string
  transport: AgentTransport
  unsubscribe: () => void
  assistantMessageId: string | null
}

const managed = new Map<string, ManagedSession>()
const pendingApprovals = new Map<string, ApprovalRequest>()

function broadcastAgentEvent(event: AgentEvent): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send(IpcChannels['event:agent'], event)
    }
  }
}

function broadcastApproval(req: ApprovalRequest): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send(IpcChannels['event:approval'], req)
    }
  }
}

function handleEvent(sessionId: string, event: AgentEvent): void {
  broadcastAgentEvent(event)

  const session = managed.get(sessionId)
  if (!session) return

  // Persist streaming assistant content when complete
  if (event.type === 'message_delta') {
    const content = String(event.data.accumulated ?? event.data.content ?? '')
    if (session.assistantMessageId) {
      messagesRepo.update(session.assistantMessageId, {
        content,
        status: 'streaming'
      })
    } else {
      const msg = messagesRepo.create({
        sessionId,
        role: 'assistant',
        content,
        status: 'streaming'
      })
      session.assistantMessageId = msg.id
    }
  }

  if (event.type === 'message_complete') {
    const content = String(event.data.content ?? event.data.accumulated ?? '')
    if (session.assistantMessageId) {
      messagesRepo.update(session.assistantMessageId, {
        content: content || messagesRepo.get(session.assistantMessageId)?.content || '',
        status: 'completed'
      })
    } else if (content) {
      messagesRepo.create({
        sessionId,
        role: 'assistant',
        content,
        status: 'completed'
      })
    }
    session.assistantMessageId = null
    sessionsRepo.updateStatus(sessionId, 'running')
  }

  if (event.type === 'tool_call_start') {
    const name = String(event.data.name ?? 'tool')
    const args = JSON.stringify(event.data.arguments ?? event.data.args ?? {})
    const messageId =
      session.assistantMessageId ??
      messagesRepo.create({
        sessionId,
        role: 'assistant',
        content: '',
        status: 'streaming'
      }).id
    session.assistantMessageId = messageId
    const tool = messagesRepo.createToolCall({
      messageId,
      sessionId,
      name,
      arguments: args,
      status: 'running'
    })
    // stash tool id in event for UI
    event.data.toolCallId = tool.id
  }

  if (event.type === 'tool_call_end') {
    const toolCallId = String(event.data.toolCallId ?? '')
    if (toolCallId) {
      messagesRepo.updateToolCall(toolCallId, {
        result: String(event.data.result ?? ''),
        status: event.data.error ? 'error' : 'completed'
      })
    }
  }

  if (event.type === 'approval_required') {
    const req: ApprovalRequest = {
      id: createId('appr'),
      sessionId,
      toolCallId: String(event.data.toolCallId ?? ''),
      command: String(event.data.command ?? event.data.arguments ?? ''),
      description: String(event.data.description ?? 'Agent requests permission to run a command'),
      risk: (event.data.risk as ApprovalRequest['risk']) ?? 'medium'
    }
    pendingApprovals.set(req.id, req)
    sessionsRepo.updateStatus(sessionId, 'waiting_approval')
    broadcastApproval(req)
  }

  if (event.type === 'status') {
    const status = event.data.status as string
    if (status) {
      sessionsRepo.updateStatus(sessionId, status as never)
    }
  }

  if (event.type === 'error') {
    sessionsRepo.updateStatus(sessionId, 'error')
  }

  if (event.type === 'exit') {
    sessionsRepo.updateStatus(sessionId, 'stopped')
  }
}

export const agentManager = {
  async start(sessionId: string, projectId: string, cwd: string): Promise<AgentProcessState> {
    // Stop existing for this session
    if (managed.has(sessionId)) {
      await this.stop(sessionId)
    }

    const info = await detectGrokBuild()
    if (!info.installed || !info.path) {
      throw new Error(info.error ?? 'Grok Build CLI not found')
    }

    const transport = new StdioAgentTransport()
    const unsubscribe = transport.onEvent((event) => handleEvent(sessionId, event))

    managed.set(sessionId, {
      sessionId,
      projectId,
      cwd,
      transport,
      unsubscribe,
      assistantMessageId: null
    })

    sessionsRepo.updateStatus(sessionId, 'starting')

    await transport.connect({
      sessionId,
      projectId,
      cwd,
      executablePath: info.path,
      // Default: run interactive / prompt mode. Adjust when ACP is documented.
      args: [],
      autoRestart: false
    })

    return this.getState(sessionId)
  },

  async sendMessage(sessionId: string, content: string): Promise<void> {
    const session = managed.get(sessionId)
    if (!session) {
      throw new Error('Agent is not running for this session. Start it first.')
    }

    // Persist user message
    messagesRepo.create({
      sessionId,
      role: 'user',
      content,
      status: 'completed'
    })
    sessionsRepo.touch(sessionId)
    session.assistantMessageId = null

    await session.transport.sendMessage(content)
  },

  async cancel(sessionId: string): Promise<void> {
    const session = managed.get(sessionId)
    if (!session) return
    await session.transport.cancel()
    if (session.assistantMessageId) {
      messagesRepo.update(session.assistantMessageId, { status: 'cancelled' })
      session.assistantMessageId = null
    }
  },

  async stop(sessionId: string): Promise<void> {
    const session = managed.get(sessionId)
    if (!session) return
    session.unsubscribe()
    await session.transport.disconnect()
    managed.delete(sessionId)
    sessionsRepo.updateStatus(sessionId, 'stopped')
  },

  async forceKill(sessionId: string): Promise<void> {
    const session = managed.get(sessionId)
    if (!session) return
    session.unsubscribe()
    await session.transport.forceKill()
    managed.delete(sessionId)
    sessionsRepo.updateStatus(sessionId, 'stopped')
  },

  async restart(sessionId: string, projectId: string, cwd: string): Promise<AgentProcessState> {
    await this.stop(sessionId)
    return this.start(sessionId, projectId, cwd)
  },

  getState(sessionId: string | null): AgentProcessState {
    if (!sessionId || !managed.has(sessionId)) {
      return {
        sessionId,
        projectId: null,
        status: 'idle',
        pid: null,
        startedAt: null,
        lastError: null,
        version: null,
        executablePath: null
      }
    }
    const s = managed.get(sessionId)!
    return {
      sessionId: s.sessionId,
      projectId: s.projectId,
      status: s.transport.getStatus(),
      pid: s.transport.getPid(),
      startedAt: null,
      lastError: null,
      version: null,
      executablePath: null
    }
  },

  respondApproval(approvalId: string, approved: boolean): void {
    const req = pendingApprovals.get(approvalId)
    if (!req) throw new Error('Approval request not found')
    pendingApprovals.delete(approvalId)

    const session = managed.get(req.sessionId)
    if (!session) return

    // Send approval response via stdin JSON
    void session.transport
      .sendMessage(
        JSON.stringify({
          type: 'approval_response',
          approvalId,
          toolCallId: req.toolCallId,
          approved
        })
      )
      .catch((err) => logger.error('agent', String(err)))

    if (req.toolCallId) {
      messagesRepo.updateToolCall(req.toolCallId, {
        status: approved ? 'approved' : 'rejected'
      })
    }
    sessionsRepo.updateStatus(req.sessionId, approved ? 'running' : 'running')
  },

  async stopAll(): Promise<void> {
    const ids = [...managed.keys()]
    await Promise.all(ids.map((id) => this.stop(id)))
  }
}
