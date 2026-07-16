import { getDb } from '../db'
import type { AgentStatus, Session } from '@shared/types'
import { createId } from '@shared/utils/id'

interface SessionRow {
  id: string
  project_id: string
  title: string
  status: string
  created_at: string
  updated_at: string
}

function mapRow(row: SessionRow): Session {
  return {
    id: row.id,
    projectId: row.project_id,
    title: row.title,
    status: row.status as AgentStatus,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

export const sessionsRepo = {
  listByProject(projectId: string): Session[] {
    const rows = getDb()
      .prepare('SELECT * FROM sessions WHERE project_id = ? ORDER BY updated_at DESC')
      .all(projectId) as SessionRow[]
    return rows.map(mapRow)
  },

  get(id: string): Session | null {
    const row = getDb().prepare('SELECT * FROM sessions WHERE id = ?').get(id) as
      | SessionRow
      | undefined
    return row ? mapRow(row) : null
  },

  create(projectId: string, title?: string): Session {
    const id = createId('sess')
    const now = new Date().toISOString()
    const sessionTitle = title?.trim() || `Session ${new Date().toLocaleString()}`
    getDb()
      .prepare(
        `INSERT INTO sessions (id, project_id, title, status, created_at, updated_at)
         VALUES (?, ?, ?, 'idle', ?, ?)`
      )
      .run(id, projectId, sessionTitle, now, now)
    return this.get(id)!
  },

  rename(id: string, title: string): Session | null {
    const now = new Date().toISOString()
    getDb()
      .prepare('UPDATE sessions SET title = ?, updated_at = ? WHERE id = ?')
      .run(title, now, id)
    return this.get(id)
  },

  updateStatus(id: string, status: AgentStatus): Session | null {
    const now = new Date().toISOString()
    getDb()
      .prepare('UPDATE sessions SET status = ?, updated_at = ? WHERE id = ?')
      .run(status, now, id)
    return this.get(id)
  },

  touch(id: string): void {
    const now = new Date().toISOString()
    getDb().prepare('UPDATE sessions SET updated_at = ? WHERE id = ?').run(now, id)
  },

  delete(id: string): boolean {
    const result = getDb().prepare('DELETE FROM sessions WHERE id = ?').run(id)
    return result.changes > 0
  }
}
