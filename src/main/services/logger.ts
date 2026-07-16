import { BrowserWindow } from 'electron'
import { createId } from '@shared/utils/id'
import type { LogEntry } from '@shared/types'
import { IpcChannels } from '@shared/contracts/ipc'

const SENSITIVE_PATTERNS = [
  /api[_-]?key[=:\s]+["']?[^\s"']+/gi,
  /token[=:\s]+["']?[^\s"']+/gi,
  /password[=:\s]+["']?[^\s"']+/gi,
  /secret[=:\s]+["']?[^\s"']+/gi,
  /bearer\s+[a-zA-Z0-9._-]+/gi
]

function redact(message: string): string {
  let result = message
  for (const pattern of SENSITIVE_PATTERNS) {
    result = result.replace(pattern, '[REDACTED]')
  }
  return result
}

const buffer: LogEntry[] = []
const MAX_BUFFER = 500

function broadcast(entry: LogEntry): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send(IpcChannels['event:log'], entry)
    }
  }
}

function log(level: LogEntry['level'], source: string, message: string): void {
  const entry: LogEntry = {
    id: createId('log'),
    level,
    source,
    message: redact(message),
    timestamp: new Date().toISOString()
  }
  buffer.push(entry)
  if (buffer.length > MAX_BUFFER) buffer.shift()

  const prefix = `[${entry.level.toUpperCase()}] [${source}]`
  if (level === 'error') console.error(prefix, entry.message)
  else if (level === 'warn') console.warn(prefix, entry.message)
  else console.log(prefix, entry.message)

  broadcast(entry)
}

export const logger = {
  debug: (source: string, message: string) => log('debug', source, message),
  info: (source: string, message: string) => log('info', source, message),
  warn: (source: string, message: string) => log('warn', source, message),
  error: (source: string, message: string) => log('error', source, message),
  getRecent: () => [...buffer]
}
