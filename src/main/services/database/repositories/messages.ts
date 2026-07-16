import { getDb } from '../db'
import type { Message, MessageRole, MessageStatus, ToolCall, ToolCallStatus } from '@shared/types'
import { createId } from '@shared/utils/id'

interface MessageRow {
  id: string
  session_id: string
  role: string
  content: string
  status: string
  metadata: string | null
  created_at: string
  updated_at: string
}

interface ToolCallRow {
  id: string
  message_id: string
  session_id: string
  name: string
  arguments: string
  result: string | null
  status: string
  created_at: string
  updated_at: string
}

function mapMessage(row: MessageRow): Message {
  return {
    id: row.id,
    sessionId: row.session_id,
    role: row.role as MessageRole,
    content: row.content,
    status: row.status as MessageStatus,
    metadata: row.metadata ? (JSON.parse(row.metadata) as Record<string, unknown>) : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

function mapToolCall(row: ToolCallRow): ToolCall {
  return {
    id: row.id,
    messageId: row.message_id,
    sessionId: row.session_id,
    name: row.name,
    arguments: row.arguments,
    result: row.result,
    status: row.status as ToolCallStatus,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

export const messagesRepo = {
  listBySession(sessionId: string): Message[] {
    const rows = getDb()
      .prepare('SELECT * FROM messages WHERE session_id = ? ORDER BY created_at ASC')
      .all(sessionId) as MessageRow[]
    return rows.map(mapMessage)
  },

  get(id: string): Message | null {
    const row = getDb().prepare('SELECT * FROM messages WHERE id = ?').get(id) as
      | MessageRow
      | undefined
    return row ? mapMessage(row) : null
  },

  create(input: {
    sessionId: string
    role: MessageRole
    content: string
    status?: MessageStatus
    metadata?: Record<string, unknown>
  }): Message {
    const id = createId('msg')
    const now = new Date().toISOString()
    getDb()
      .prepare(
        `INSERT INTO messages (id, session_id, role, content, status, metadata, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        input.sessionId,
        input.role,
        input.content,
        input.status ?? 'completed',
        input.metadata ? JSON.stringify(input.metadata) : null,
        now,
        now
      )
    getDb()
      .prepare('UPDATE sessions SET updated_at = ? WHERE id = ?')
      .run(now, input.sessionId)
    return this.get(id)!
  },

  update(
    id: string,
    patch: {
      content?: string
      status?: MessageStatus
      metadata?: Record<string, unknown>
    }
  ): Message | null {
    const existing = this.get(id)
    if (!existing) return null
    const now = new Date().toISOString()
    const content = patch.content ?? existing.content
    const status = patch.status ?? existing.status
    const metadata =
      patch.metadata !== undefined
        ? JSON.stringify(patch.metadata)
        : existing.metadata
          ? JSON.stringify(existing.metadata)
          : null
    getDb()
      .prepare(
        'UPDATE messages SET content = ?, status = ?, metadata = ?, updated_at = ? WHERE id = ?'
      )
      .run(content, status, metadata, now, id)
    return this.get(id)
  },

  listToolCalls(sessionId: string): ToolCall[] {
    const rows = getDb()
      .prepare('SELECT * FROM tool_calls WHERE session_id = ? ORDER BY created_at ASC')
      .all(sessionId) as ToolCallRow[]
    return rows.map(mapToolCall)
  },

  createToolCall(input: {
    messageId: string
    sessionId: string
    name: string
    arguments: string
    status?: ToolCallStatus
  }): ToolCall {
    const id = createId('tool')
    const now = new Date().toISOString()
    getDb()
      .prepare(
        `INSERT INTO tool_calls (id, message_id, session_id, name, arguments, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        input.messageId,
        input.sessionId,
        input.name,
        input.arguments,
        input.status ?? 'pending',
        now,
        now
      )
    return this.getToolCall(id)!
  },

  getToolCall(id: string): ToolCall | null {
    const row = getDb().prepare('SELECT * FROM tool_calls WHERE id = ?').get(id) as
      | ToolCallRow
      | undefined
    return row ? mapToolCall(row) : null
  },

  updateToolCall(
    id: string,
    patch: { result?: string; status?: ToolCallStatus; arguments?: string }
  ): ToolCall | null {
    const existing = this.getToolCall(id)
    if (!existing) return null
    const now = new Date().toISOString()
    getDb()
      .prepare(
        'UPDATE tool_calls SET result = ?, status = ?, arguments = ?, updated_at = ? WHERE id = ?'
      )
      .run(
        patch.result ?? existing.result,
        patch.status ?? existing.status,
        patch.arguments ?? existing.arguments,
        now,
        id
      )
    return this.getToolCall(id)
  }
}
