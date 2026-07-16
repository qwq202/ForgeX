import { app, BrowserWindow } from 'electron'
import { join } from 'path'
import { initDatabase, closeDatabase } from './services/database/db'
import { registerIpcHandlers } from './ipc/register'
import { createMainWindow } from './windows/main-window'
import { terminalService } from './services/terminal/terminal-service'
import { agentManager } from './services/agent/agent-manager'
import { fileWatcher } from './services/filesystem/watcher'
import { logger } from './services/logger'

// Single instance
const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
}

let mainWindow: BrowserWindow | null = null

async function bootstrap(): Promise<void> {
  // Hardware acceleration — keep default on

  await app.whenReady()

  // App name for menus / about
  app.setName('ForgeX')

  try {
    initDatabase()
    logger.info('app', `Database ready at userData`)
  } catch (err) {
    console.error('Failed to init database', err)
    throw err
  }

  registerIpcHandlers()
  mainWindow = createMainWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createMainWindow()
    } else {
      mainWindow?.show()
    }
  })
}

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
  }
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  void cleanup()
})

async function cleanup(): Promise<void> {
  logger.info('app', 'Cleaning up child processes…')
  try {
    await agentManager.stopAll()
  } catch (err) {
    console.error(err)
  }
  try {
    terminalService.disposeAll()
  } catch (err) {
    console.error(err)
  }
  try {
    fileWatcher.unwatchAll()
  } catch (err) {
    console.error(err)
  }
  try {
    closeDatabase()
  } catch (err) {
    console.error(err)
  }
}

// Prevent renderer crashes from taking down the app silently
process.on('uncaughtException', (err) => {
  logger.error('app', `Uncaught exception: ${err.message}`)
  console.error(err)
})

void bootstrap()

// Ensure preload path resolution works in packaged app
void join
