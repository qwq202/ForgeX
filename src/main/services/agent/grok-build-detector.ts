import { execFile } from 'child_process'
import { existsSync } from 'fs'
import { join } from 'path'
import { promisify } from 'util'
import { homedir } from 'os'
import type { GrokBuildInfo } from '@shared/types'
import { settingsRepo } from '../database/repositories/settings'
import { logger } from '../logger'

const execFileAsync = promisify(execFile)

const CANDIDATE_NAMES =
  process.platform === 'win32'
    ? ['grok.exe', 'grok-build.exe', 'grok']
    : ['grok', 'grok-build']

function pathDirs(): string[] {
  const pathEnv = process.env.PATH || process.env.Path || ''
  const sep = process.platform === 'win32' ? ';' : ':'
  return pathEnv.split(sep).filter(Boolean)
}

function candidatePaths(configured?: string): string[] {
  const list: string[] = []
  if (configured?.trim()) list.push(configured.trim())

  for (const dir of pathDirs()) {
    for (const name of CANDIDATE_NAMES) {
      list.push(join(dir, name))
    }
  }

  // Common install locations
  const home = homedir()
  if (process.platform === 'darwin' || process.platform === 'linux') {
    list.push(
      join(home, '.local', 'bin', 'grok'),
      join(home, '.local', 'bin', 'grok-build'),
      join(home, 'bin', 'grok'),
      '/usr/local/bin/grok',
      '/usr/local/bin/grok-build',
      '/opt/homebrew/bin/grok',
      '/opt/homebrew/bin/grok-build'
    )
  } else {
    list.push(
      join(home, 'AppData', 'Local', 'grok', 'grok.exe'),
      join(home, 'AppData', 'Local', 'Programs', 'grok', 'grok.exe')
    )
  }

  return [...new Set(list)]
}

async function tryVersion(executable: string): Promise<string | null> {
  for (const args of [['--version'], ['-V'], ['version']]) {
    try {
      const { stdout, stderr } = await execFileAsync(executable, args, {
        timeout: 5000,
        windowsHide: true,
        encoding: 'utf-8'
      })
      const text = (stdout || stderr || '').trim()
      if (text) {
        // First line often contains version
        return text.split('\n')[0]?.trim() ?? text
      }
    } catch {
      // try next
    }
  }
  return null
}

/**
 * Detect Grok Build CLI on the system.
 * Uses configured path first, then PATH and common install locations.
 */
export async function detectGrokBuild(): Promise<GrokBuildInfo> {
  const settings = settingsRepo.getAll()
  const candidates = candidatePaths(settings.grokBuildPath)

  for (const candidate of candidates) {
    if (!existsSync(candidate)) continue
    try {
      const version = await tryVersion(candidate)
      logger.info('agent', `Found Grok Build at ${candidate} version=${version ?? 'unknown'}`)
      return {
        installed: true,
        path: candidate,
        version
      }
    } catch (err) {
      logger.debug('agent', `Candidate failed ${candidate}: ${String(err)}`)
    }
  }

  // Last resort: `which` / `where`
  try {
    const cmd = process.platform === 'win32' ? 'where' : 'which'
    for (const name of CANDIDATE_NAMES) {
      try {
        const { stdout } = await execFileAsync(cmd, [name], {
          timeout: 3000,
          windowsHide: true,
          encoding: 'utf-8'
        })
        const found = stdout.trim().split(/\r?\n/)[0]
        if (found && existsSync(found)) {
          const version = await tryVersion(found)
          return { installed: true, path: found, version }
        }
      } catch {
        // continue
      }
    }
  } catch {
    // ignore
  }

  return {
    installed: false,
    path: null,
    version: null,
    error: 'Grok Build CLI not found. Install it and set the path in Settings.'
  }
}
