import chokidar, { type FSWatcher } from 'chokidar'
import { BrowserWindow } from 'electron'
import { basename } from 'path'
import { IGNORED_DIRS } from '@shared/constants'
import { IpcChannels } from '@shared/contracts/ipc'
import type { FileChangeEvent } from '@shared/types'
import { toRelativePath } from './path-guard'
import { logger } from '../logger'

interface WatchSession {
  projectId: string
  projectRoot: string
  watcher: FSWatcher
}

const sessions = new Map<string, WatchSession>()

function emit(event: FileChangeEvent): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send(IpcChannels['event:file:change'], event)
    }
  }
}

function ignored(path: string): boolean {
  const parts = path.split(/[/\\]/)
  return parts.some((p) => IGNORED_DIRS.has(p) || p === 'node_modules')
}

export const fileWatcher = {
  watch(projectId: string, projectRoot: string): void {
    this.unwatch(projectId)

    const watcher = chokidar.watch(projectRoot, {
      ignored: (p) => ignored(p) || basename(p).startsWith('.'),
      ignoreInitial: true,
      persistent: true,
      awaitWriteFinish: { stabilityThreshold: 200, pollInterval: 50 },
      depth: 12
    })

    const handle = (type: FileChangeEvent['type'], absPath: string): void => {
      try {
        const relativePath = toRelativePath(projectRoot, absPath)
        emit({ type, path: absPath, relativePath, projectId })
      } catch {
        // outside root — ignore
      }
    }

    watcher
      .on('add', (p) => handle('add', p))
      .on('change', (p) => handle('change', p))
      .on('unlink', (p) => handle('unlink', p))
      .on('addDir', (p) => handle('addDir', p))
      .on('unlinkDir', (p) => handle('unlinkDir', p))
      .on('error', (err) => logger.warn('watcher', String(err)))

    sessions.set(projectId, { projectId, projectRoot, watcher })
    logger.info('watcher', `Watching project ${projectId} at ${projectRoot}`)
  },

  unwatch(projectId: string): void {
    const session = sessions.get(projectId)
    if (!session) return
    void session.watcher.close()
    sessions.delete(projectId)
    logger.info('watcher', `Stopped watching project ${projectId}`)
  },

  unwatchAll(): void {
    for (const id of [...sessions.keys()]) {
      this.unwatch(id)
    }
  }
}
