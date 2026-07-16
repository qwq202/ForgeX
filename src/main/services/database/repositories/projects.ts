import { getDb } from '../db'
import type { Project } from '@shared/types'
import { createId } from '@shared/utils/id'

interface ProjectRow {
  id: string
  name: string
  path: string
  is_git_repo: number
  last_opened_at: string
  created_at: string
  updated_at: string
}

function mapRow(row: ProjectRow): Project {
  return {
    id: row.id,
    name: row.name,
    path: row.path,
    isGitRepo: Boolean(row.is_git_repo),
    lastOpenedAt: row.last_opened_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

export const projectsRepo = {
  list(): Project[] {
    const rows = getDb()
      .prepare('SELECT * FROM projects ORDER BY last_opened_at DESC')
      .all() as ProjectRow[]
    return rows.map(mapRow)
  },

  get(id: string): Project | null {
    const row = getDb().prepare('SELECT * FROM projects WHERE id = ?').get(id) as
      | ProjectRow
      | undefined
    return row ? mapRow(row) : null
  },

  getByPath(path: string): Project | null {
    const row = getDb().prepare('SELECT * FROM projects WHERE path = ?').get(path) as
      | ProjectRow
      | undefined
    return row ? mapRow(row) : null
  },

  upsert(input: {
    path: string
    name: string
    isGitRepo: boolean
  }): Project {
    const existing = this.getByPath(input.path)
    const now = new Date().toISOString()

    if (existing) {
      getDb()
        .prepare(
          `UPDATE projects
           SET name = ?, is_git_repo = ?, last_opened_at = ?, updated_at = ?
           WHERE id = ?`
        )
        .run(input.name, input.isGitRepo ? 1 : 0, now, now, existing.id)
      return this.get(existing.id)!
    }

    const id = createId('proj')
    getDb()
      .prepare(
        `INSERT INTO projects (id, name, path, is_git_repo, last_opened_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(id, input.name, input.path, input.isGitRepo ? 1 : 0, now, now, now)
    return this.get(id)!
  },

  touch(id: string): Project | null {
    const now = new Date().toISOString()
    getDb()
      .prepare('UPDATE projects SET last_opened_at = ?, updated_at = ? WHERE id = ?')
      .run(now, now, id)
    return this.get(id)
  },

  remove(id: string): boolean {
    const result = getDb().prepare('DELETE FROM projects WHERE id = ?').run(id)
    return result.changes > 0
  }
}
