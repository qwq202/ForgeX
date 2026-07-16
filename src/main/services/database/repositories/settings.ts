import { getDb } from '../db'
import type { AppSettings } from '@shared/types'
import { DEFAULT_SETTINGS } from '@shared/constants'

export const settingsRepo = {
  getAll(): AppSettings {
    const rows = getDb().prepare('SELECT key, value FROM settings').all() as Array<{
      key: string
      value: string
    }>
    const map = new Map(rows.map((r) => [r.key, r.value]))
    const result = { ...DEFAULT_SETTINGS } as AppSettings

    const mutable = result as unknown as Record<string, unknown>
    for (const key of Object.keys(DEFAULT_SETTINGS) as Array<keyof AppSettings>) {
      const raw = map.get(key)
      if (raw === undefined) continue
      const defaultValue = DEFAULT_SETTINGS[key]
      if (typeof defaultValue === 'boolean') {
        mutable[key] = raw === 'true'
      } else if (typeof defaultValue === 'number') {
        mutable[key] = Number(raw)
      } else {
        mutable[key] = raw
      }
    }
    return result
  },

  update(partial: Partial<AppSettings>): AppSettings {
    const now = new Date().toISOString()
    const stmt = getDb().prepare(
      `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
    )

    const tx = getDb().transaction((entries: Array<[string, string]>) => {
      for (const [key, value] of entries) {
        stmt.run(key, value, now)
      }
    })

    const entries: Array<[string, string]> = Object.entries(partial)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => [k, String(v)])

    tx(entries)
    return this.getAll()
  },

  get(key: keyof AppSettings): AppSettings[keyof AppSettings] {
    return this.getAll()[key]
  }
}
