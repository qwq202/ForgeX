import { BrowserWindow } from 'electron'
import * as pty from 'node-pty'
import { existsSync } from 'fs'
import { IpcChannels } from '@shared/contracts/ipc'
import type { TerminalInfo } from '@shared/types'
import { createId } from '@shared/utils/id'
import { logger } from '../logger'
import { settingsRepo } from '../database/repositories/settings'

interface PtySession {
  id: string
  projectId: string
  cwd: string
  shell: string
  cols: number
  rows: number
  pty: pty.IPty
}

const sessions = new Map<string, PtySession>()

function getDefaultShell(): string {
  const settings = settingsRepo.getAll()
  if (settings.defaultShell && existsSync(settings.defaultShell)) {
    return settings.defaultShell
  }

  if (process.platform === 'win32') {
    // Prefer PowerShell
    const candidates = [
      process.env.POWERSHELL_DISTRIBUTION_CHANNEL
        ? undefined
        : 'C:\\Program Files\\PowerShell\\7\\pwsh.exe',
      'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',
      process.env.COMSPEC || 'cmd.exe'
    ].filter(Boolean) as string[]
    for (const c of candidates) {
      if (existsSync(c)) return c
    }
    return process.env.COMSPEC || 'powershell.exe'
  }

  return process.env.SHELL || (process.platform === 'darwin' ? '/bin/zsh' : '/bin/bash')
}

function shellArgs(shell: string): string[] {
  if (process.platform === 'win32') {
    if (shell.toLowerCase().includes('powershell') || shell.toLowerCase().includes('pwsh')) {
      return ['-NoLogo']
    }
    return []
  }
  // login shell so PATH / profile load
  if (shell.includes('zsh') || shell.includes('bash')) {
    return ['-l']
  }
  return []
}

function emitData(terminalId: string, data: string): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send(IpcChannels['event:terminal:data'], { terminalId, data })
    }
  }
}

function emitExit(terminalId: string, exitCode: number, signal?: number): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send(IpcChannels['event:terminal:exit'], {
        terminalId,
        exitCode,
        signal
      })
    }
  }
}

export const terminalService = {
  create(projectId: string, cwd: string, cols = 80, rows = 24): TerminalInfo {
    const id = createId('term')
    const shell = getDefaultShell()
    const args = shellArgs(shell)

    logger.info('terminal', `Creating PTY ${id} shell=${shell} cwd=${cwd}`)

    const term = pty.spawn(shell, args, {
      name: 'xterm-256color',
      cols,
      rows,
      cwd,
      env: {
        ...process.env,
        TERM: 'xterm-256color',
        COLORTERM: 'truecolor',
        // Avoid leaking sensitive electron vars if any
        FORGEX: '1'
      } as Record<string, string>,
      useConpty: process.platform === 'win32'
    })

    const session: PtySession = {
      id,
      projectId,
      cwd,
      shell,
      cols,
      rows,
      pty: term
    }
    sessions.set(id, session)

    term.onData((data) => emitData(id, data))
    term.onExit(({ exitCode, signal }) => {
      logger.info('terminal', `PTY ${id} exited code=${exitCode} signal=${signal}`)
      sessions.delete(id)
      emitExit(id, exitCode, signal)
    })

    return {
      id,
      projectId,
      cwd,
      shell,
      cols,
      rows,
      pid: term.pid
    }
  },

  write(terminalId: string, data: string): void {
    const session = sessions.get(terminalId)
    if (!session) throw new Error(`Terminal not found: ${terminalId}`)
    session.pty.write(data)
  },

  resize(terminalId: string, cols: number, rows: number): void {
    const session = sessions.get(terminalId)
    if (!session) throw new Error(`Terminal not found: ${terminalId}`)
    session.cols = cols
    session.rows = rows
    session.pty.resize(cols, rows)
  },

  dispose(terminalId: string): void {
    const session = sessions.get(terminalId)
    if (!session) return
    try {
      session.pty.kill()
    } catch (err) {
      logger.warn('terminal', `Failed to kill PTY ${terminalId}: ${String(err)}`)
    }
    sessions.delete(terminalId)
  },

  list(): TerminalInfo[] {
    return [...sessions.values()].map((s) => ({
      id: s.id,
      projectId: s.projectId,
      cwd: s.cwd,
      shell: s.shell,
      cols: s.cols,
      rows: s.rows,
      pid: s.pty.pid
    }))
  },

  disposeAll(): void {
    for (const id of [...sessions.keys()]) {
      this.dispose(id)
    }
  },

  getDefaultShell
}
