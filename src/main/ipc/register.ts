import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron'
import { basename, dirname } from 'path'
import { IpcChannels } from '@shared/contracts/ipc'
import * as schemas from '@shared/schemas'
import type { AppInfo, AppSettings, Project } from '@shared/types'
import { AppError, wrapHandler } from '../services/errors'
import { getDatabasePath } from '../services/database/db'
import { projectsRepo } from '../services/database/repositories/projects'
import { sessionsRepo } from '../services/database/repositories/sessions'
import { messagesRepo } from '../services/database/repositories/messages'
import { settingsRepo } from '../services/database/repositories/settings'
import { fileService } from '../services/filesystem/file-service'
import { fileWatcher } from '../services/filesystem/watcher'
import { gitService } from '../services/git/git-service'
import { terminalService } from '../services/terminal/terminal-service'
import { agentManager } from '../services/agent/agent-manager'
import { detectGrokBuild } from '../services/agent/grok-build-detector'
import { logger } from '../services/logger'

function requireProject(projectId: string): Project {
  const project = projectsRepo.get(projectId)
  if (!project) throw new AppError('PROJECT_NOT_FOUND', `Project not found: ${projectId}`)
  return project
}

function parse<T>(schema: { parse: (data: unknown) => T }, data: unknown): T {
  try {
    return schema.parse(data ?? {})
  } catch (err) {
    throw new AppError('VALIDATION_ERROR', 'Invalid IPC payload', err)
  }
}

export function registerIpcHandlers(): void {
  // ── App ──────────────────────────────────────────────
  ipcMain.handle(
    IpcChannels['app:getInfo'],
    wrapHandler(async (): Promise<AppInfo> => ({
      version: app.getVersion(),
      name: app.getName(),
      platform: process.platform,
      arch: process.arch,
      electronVersion: process.versions.electron,
      nodeVersion: process.versions.node,
      chromeVersion: process.versions.chrome,
      userDataPath: app.getPath('userData'),
      databasePath: getDatabasePath(),
      isPackaged: app.isPackaged
    }))
  )

  ipcMain.handle(
    IpcChannels['app:getGrokBuildInfo'],
    wrapHandler(async () => detectGrokBuild())
  )

  ipcMain.handle(
    IpcChannels['app:openExternal'],
    wrapHandler(async (_e, raw) => {
      const { url } = parse(schemas.openExternalSchema, raw)
      // Only allow http(s)
      if (!/^https?:\/\//i.test(url)) {
        throw new AppError('INVALID_URL', 'Only http(s) URLs are allowed')
      }
      await shell.openExternal(url)
    })
  )

  ipcMain.handle(
    IpcChannels['app:showItemInFolder'],
    wrapHandler(async (_e, raw) => {
      const { path } = parse(schemas.addProjectSchema, raw)
      shell.showItemInFolder(path)
    })
  )

  // ── Projects ─────────────────────────────────────────
  ipcMain.handle(
    IpcChannels['projects:list'],
    wrapHandler(async () => projectsRepo.list())
  )

  ipcMain.handle(
    IpcChannels['projects:openDirectory'],
    wrapHandler(async (_e, raw) => {
      const input = parse(schemas.openDirectorySchema, raw ?? {})
      const win = BrowserWindow.getFocusedWindow()
      const result = await dialog.showOpenDialog(win ?? undefined!, {
        title: 'Open Project',
        defaultPath: input.defaultPath || settingsRepo.getAll().defaultProjectDir || app.getPath('home'),
        properties: ['openDirectory', 'createDirectory']
      })
      if (result.canceled || !result.filePaths[0]) return null
      return result.filePaths[0]
    })
  )

  ipcMain.handle(
    IpcChannels['projects:add'],
    wrapHandler(async (_e, raw) => {
      const { path } = parse(schemas.addProjectSchema, raw)
      const name = basename(path)
      const isGitRepo = gitService.isRepo(path)
      const project = projectsRepo.upsert({ path, name, isGitRepo })
      fileWatcher.watch(project.id, project.path)
      logger.info('projects', `Opened project ${project.name} at ${project.path}`)
      return project
    })
  )

  ipcMain.handle(
    IpcChannels['projects:remove'],
    wrapHandler(async (_e, raw) => {
      const { projectId } = parse(schemas.removeProjectSchema, raw)
      fileWatcher.unwatch(projectId)
      // Dispose terminals for this project
      for (const t of terminalService.list()) {
        if (t.projectId === projectId) terminalService.dispose(t.id)
      }
      return projectsRepo.remove(projectId)
    })
  )

  ipcMain.handle(
    IpcChannels['projects:get'],
    wrapHandler(async (_e, raw) => {
      const { projectId } = parse(schemas.removeProjectSchema, raw)
      return projectsRepo.get(projectId)
    })
  )

  ipcMain.handle(
    IpcChannels['projects:touch'],
    wrapHandler(async (_e, raw) => {
      const { projectId } = parse(schemas.removeProjectSchema, raw)
      const project = projectsRepo.touch(projectId)
      if (project) fileWatcher.watch(project.id, project.path)
      return project
    })
  )

  // ── Sessions ─────────────────────────────────────────
  ipcMain.handle(
    IpcChannels['sessions:list'],
    wrapHandler(async (_e, raw) => {
      const { projectId } = parse(schemas.listSessionsSchema, raw)
      return sessionsRepo.listByProject(projectId)
    })
  )

  ipcMain.handle(
    IpcChannels['sessions:create'],
    wrapHandler(async (_e, raw) => {
      const { projectId, title } = parse(schemas.createSessionSchema, raw)
      requireProject(projectId)
      return sessionsRepo.create(projectId, title)
    })
  )

  ipcMain.handle(
    IpcChannels['sessions:rename'],
    wrapHandler(async (_e, raw) => {
      const { sessionId, title } = parse(schemas.renameSessionSchema, raw)
      const session = sessionsRepo.rename(sessionId, title)
      if (!session) throw new AppError('SESSION_NOT_FOUND', 'Session not found')
      return session
    })
  )

  ipcMain.handle(
    IpcChannels['sessions:delete'],
    wrapHandler(async (_e, raw) => {
      const { sessionId } = parse(schemas.deleteSessionSchema, raw)
      await agentManager.stop(sessionId)
      return sessionsRepo.delete(sessionId)
    })
  )

  ipcMain.handle(
    IpcChannels['sessions:get'],
    wrapHandler(async (_e, raw) => {
      const { sessionId } = parse(schemas.deleteSessionSchema, raw)
      return sessionsRepo.get(sessionId)
    })
  )

  // ── Messages ─────────────────────────────────────────
  ipcMain.handle(
    IpcChannels['messages:list'],
    wrapHandler(async (_e, raw) => {
      const { sessionId } = parse(schemas.listMessagesSchema, raw)
      return messagesRepo.listBySession(sessionId)
    })
  )

  ipcMain.handle(
    IpcChannels['messages:create'],
    wrapHandler(async (_e, raw) => {
      const input = parse(schemas.createMessageSchema, raw)
      return messagesRepo.create(input)
    })
  )

  ipcMain.handle(
    IpcChannels['messages:update'],
    wrapHandler(async (_e, raw) => {
      const input = parse(schemas.updateMessageSchema, raw)
      const msg = messagesRepo.update(input.messageId, {
        content: input.content,
        status: input.status,
        metadata: input.metadata
      })
      if (!msg) throw new AppError('MESSAGE_NOT_FOUND', 'Message not found')
      return msg
    })
  )

  ipcMain.handle(
    IpcChannels['messages:listToolCalls'],
    wrapHandler(async (_e, raw) => {
      const { sessionId } = parse(schemas.listMessagesSchema, raw)
      return messagesRepo.listToolCalls(sessionId)
    })
  )

  // ── Files ────────────────────────────────────────────
  ipcMain.handle(
    IpcChannels['files:listTree'],
    wrapHandler(async (_e, raw) => {
      const { projectId, relativePath } = parse(schemas.listFilesSchema, raw)
      const project = requireProject(projectId)
      return fileService.listTree(project.path, relativePath)
    })
  )

  ipcMain.handle(
    IpcChannels['files:read'],
    wrapHandler(async (_e, raw) => {
      const { projectId, relativePath, maxBytes } = parse(schemas.readFileSchema, raw)
      const project = requireProject(projectId)
      return fileService.readFile(project.path, relativePath, maxBytes)
    })
  )

  ipcMain.handle(
    IpcChannels['files:watch'],
    wrapHandler(async (_e, raw) => {
      const { projectId } = parse(schemas.watchFilesSchema, raw)
      const project = requireProject(projectId)
      fileWatcher.watch(projectId, project.path)
    })
  )

  ipcMain.handle(
    IpcChannels['files:unwatch'],
    wrapHandler(async (_e, raw) => {
      const { projectId } = parse(schemas.watchFilesSchema, raw)
      fileWatcher.unwatch(projectId)
    })
  )

  // ── Git ──────────────────────────────────────────────
  ipcMain.handle(
    IpcChannels['git:status'],
    wrapHandler(async (_e, raw) => {
      const { projectId } = parse(schemas.gitStatusSchema, raw)
      const project = requireProject(projectId)
      return gitService.status(project.path)
    })
  )

  ipcMain.handle(
    IpcChannels['git:diff'],
    wrapHandler(async (_e, raw) => {
      const { projectId, relativePath } = parse(schemas.gitDiffSchema, raw)
      const project = requireProject(projectId)
      return gitService.diff(project.path, relativePath)
    })
  )

  ipcMain.handle(
    IpcChannels['git:discard'],
    wrapHandler(async (_e, raw) => {
      const { projectId, relativePath } = parse(schemas.gitDiffSchema, raw)
      const project = requireProject(projectId)
      await gitService.discard(project.path, relativePath)
    })
  )

  // ── Terminal ─────────────────────────────────────────
  ipcMain.handle(
    IpcChannels['terminal:create'],
    wrapHandler(async (_e, raw) => {
      const { projectId, cols, rows } = parse(schemas.terminalCreateSchema, raw)
      const project = requireProject(projectId)
      return terminalService.create(projectId, project.path, cols, rows)
    })
  )

  ipcMain.handle(
    IpcChannels['terminal:write'],
    wrapHandler(async (_e, raw) => {
      const { terminalId, data } = parse(schemas.terminalWriteSchema, raw)
      terminalService.write(terminalId, data)
    })
  )

  ipcMain.handle(
    IpcChannels['terminal:resize'],
    wrapHandler(async (_e, raw) => {
      const { terminalId, cols, rows } = parse(schemas.terminalResizeSchema, raw)
      terminalService.resize(terminalId, cols, rows)
    })
  )

  ipcMain.handle(
    IpcChannels['terminal:dispose'],
    wrapHandler(async (_e, raw) => {
      const { terminalId } = parse(schemas.terminalDisposeSchema, raw)
      terminalService.dispose(terminalId)
    })
  )

  ipcMain.handle(
    IpcChannels['terminal:list'],
    wrapHandler(async () => terminalService.list())
  )

  // ── Agent ────────────────────────────────────────────
  ipcMain.handle(
    IpcChannels['agent:start'],
    wrapHandler(async (_e, raw) => {
      const { sessionId, projectId } = parse(schemas.agentStartSchema, raw)
      const project = requireProject(projectId)
      return agentManager.start(sessionId, projectId, project.path)
    })
  )

  ipcMain.handle(
    IpcChannels['agent:sendMessage'],
    wrapHandler(async (_e, raw) => {
      const { sessionId, content } = parse(schemas.agentSendMessageSchema, raw)
      await agentManager.sendMessage(sessionId, content)
    })
  )

  ipcMain.handle(
    IpcChannels['agent:cancel'],
    wrapHandler(async (_e, raw) => {
      const { sessionId } = parse(schemas.agentCancelSchema, raw)
      await agentManager.cancel(sessionId)
    })
  )

  ipcMain.handle(
    IpcChannels['agent:stop'],
    wrapHandler(async (_e, raw) => {
      const { sessionId } = parse(schemas.agentStopSchema, raw)
      await agentManager.stop(sessionId)
    })
  )

  ipcMain.handle(
    IpcChannels['agent:restart'],
    wrapHandler(async (_e, raw) => {
      const { sessionId, projectId } = parse(schemas.agentRestartSchema, raw)
      const project = requireProject(projectId)
      return agentManager.restart(sessionId, projectId, project.path)
    })
  )

  ipcMain.handle(
    IpcChannels['agent:getState'],
    wrapHandler(async (_e, raw) => {
      const sessionId =
        raw && typeof raw === 'object' && 'sessionId' in raw
          ? String((raw as { sessionId: string }).sessionId)
          : null
      return agentManager.getState(sessionId)
    })
  )

  ipcMain.handle(
    IpcChannels['agent:respondApproval'],
    wrapHandler(async (_e, raw) => {
      const { approvalId, approved } = parse(schemas.approvalRespondSchema, raw)
      agentManager.respondApproval(approvalId, approved)
    })
  )

  // ── Settings ─────────────────────────────────────────
  ipcMain.handle(
    IpcChannels['settings:get'],
    wrapHandler(async (): Promise<AppSettings> => settingsRepo.getAll())
  )

  ipcMain.handle(
    IpcChannels['settings:update'],
    wrapHandler(async (_e, raw) => {
      const partial = parse(schemas.updateSettingsSchema, raw)
      return settingsRepo.update(partial)
    })
  )

  // silence unused dirname if lint
  void dirname
}
