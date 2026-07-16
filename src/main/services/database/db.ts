import Database from 'better-sqlite3'
import { app } from 'electron'
import { existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import { migrations } from './migrations'

let db: Database.Database | null = null
let databasePath = ''

export function getDatabasePath(): string {
  if (databasePath) return databasePath
  const userData = app.getPath('userData')
  const dir = join(userData, 'data')
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
  const env = app.isPackaged ? 'prod' : 'dev'
  databasePath = join(dir, `forgex-${env}.db`)
  return databasePath
}

export function getDb(): Database.Database {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.')
  }
  return db
}

export function initDatabase(): Database.Database {
  if (db) return db

  const path = getDatabasePath()
  db = new Database(path)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  db.pragma('busy_timeout = 5000')

  runMigrations(db)
  return db
}

function runMigrations(database: Database.Database): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    );
  `)

  const applied = new Set(
    database
      .prepare('SELECT version FROM schema_migrations')
      .all()
      .map((row) => (row as { version: number }).version)
  )

  const apply = database.transaction(() => {
    for (const migration of migrations) {
      if (applied.has(migration.version)) continue
      database.exec(migration.sql)
      database
        .prepare('INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)')
        .run(migration.version, migration.name, new Date().toISOString())
    }
  })

  apply()
}

export function closeDatabase(): void {
  if (db) {
    db.close()
    db = null
  }
}

export function withTransaction<T>(fn: () => T): T {
  const database = getDb()
  return database.transaction(fn)()
}
