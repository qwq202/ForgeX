import {
  existsSync,
  readdirSync,
  readFileSync,
  statSync,
  type Dirent
} from 'fs'
import { basename, extname, join } from 'path'
import {
  BINARY_EXTENSIONS,
  IGNORED_DIRS,
  IGNORED_FILES,
  LANGUAGE_MAP,
  MAX_FILE_PREVIEW_CHARS,
  MAX_FILE_SIZE_BYTES
} from '@shared/constants'
import type { FileContent, FileTreeNode } from '@shared/types'
import { PathGuardError, resolveProjectPath, toRelativePath } from './path-guard'
import { logger } from '../logger'

function isBinaryByExt(filePath: string): boolean {
  const ext = extname(filePath).slice(1).toLowerCase()
  return BINARY_EXTENSIONS.has(ext)
}

function looksBinary(buffer: Buffer): boolean {
  const sample = buffer.subarray(0, Math.min(buffer.length, 8000))
  if (sample.includes(0)) return true
  let nonPrintable = 0
  for (const byte of sample) {
    if (byte < 7 || (byte > 14 && byte < 32 && byte !== 27)) {
      nonPrintable++
    }
  }
  return nonPrintable / sample.length > 0.3
}

function detectLanguage(filePath: string): string {
  const base = basename(filePath).toLowerCase()
  if (base === 'dockerfile') return 'dockerfile'
  if (base === 'makefile') return 'makefile'
  if (base.startsWith('.env')) return 'ini'
  const ext = extname(filePath).slice(1).toLowerCase()
  return LANGUAGE_MAP[ext] ?? 'plaintext'
}

function shouldIgnore(name: string, isDirectory: boolean): boolean {
  if (IGNORED_FILES.has(name)) return true
  if (isDirectory && IGNORED_DIRS.has(name)) return true
  return false
}

function buildTree(projectRoot: string, dirAbs: string, depth = 0, maxDepth = 12): FileTreeNode[] {
  if (depth > maxDepth) return []

  let entries: Dirent[]
  try {
    entries = readdirSync(dirAbs, { withFileTypes: true })
  } catch (err) {
    logger.warn('filesystem', `Cannot read directory: ${dirAbs} — ${String(err)}`)
    return []
  }

  const nodes: FileTreeNode[] = []

  const sorted = entries
    .filter((e) => !shouldIgnore(e.name, e.isDirectory()))
    .sort((a, b) => {
      if (a.isDirectory() && !b.isDirectory()) return -1
      if (!a.isDirectory() && b.isDirectory()) return 1
      return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
    })

  for (const entry of sorted) {
    const abs = join(dirAbs, entry.name)
    let relativePath: string
    try {
      relativePath = toRelativePath(projectRoot, abs)
    } catch {
      continue
    }

    if (entry.isDirectory()) {
      nodes.push({
        name: entry.name,
        path: abs,
        relativePath,
        isDirectory: true,
        children: buildTree(projectRoot, abs, depth + 1, maxDepth)
      })
    } else if (entry.isFile()) {
      nodes.push({
        name: entry.name,
        path: abs,
        relativePath,
        isDirectory: false
      })
    }
  }

  return nodes
}

export const fileService = {
  listTree(projectRoot: string, relativePath = ''): FileTreeNode[] {
    const abs = resolveProjectPath(projectRoot, relativePath || '.')
    if (!existsSync(abs)) {
      throw new PathGuardError(`Path does not exist: ${relativePath || '/'}`)
    }
    const stat = statSync(abs)
    if (!stat.isDirectory()) {
      throw new PathGuardError('Not a directory')
    }
    return buildTree(projectRoot, abs)
  },

  readFile(
    projectRoot: string,
    relativePath: string,
    maxBytes = MAX_FILE_SIZE_BYTES
  ): FileContent {
    const abs = resolveProjectPath(projectRoot, relativePath)
    if (!existsSync(abs)) {
      throw new PathGuardError(`File not found: ${relativePath}`)
    }
    const stat = statSync(abs)
    if (!stat.isFile()) {
      throw new PathGuardError(`Not a file: ${relativePath}`)
    }

    if (isBinaryByExt(abs)) {
      return {
        path: abs,
        relativePath,
        content: '',
        language: 'plaintext',
        size: stat.size,
        truncated: false,
        encoding: 'binary',
        isBinary: true
      }
    }

    const buffer = readFileSync(abs)
    if (looksBinary(buffer)) {
      return {
        path: abs,
        relativePath,
        content: '',
        language: 'plaintext',
        size: stat.size,
        truncated: false,
        encoding: 'binary',
        isBinary: true
      }
    }

    const limit = Math.min(maxBytes, MAX_FILE_SIZE_BYTES)
    let truncated = false
    let content = buffer.toString('utf-8')
    if (buffer.length > limit || content.length > MAX_FILE_PREVIEW_CHARS) {
      truncated = true
      content = content.slice(0, Math.min(limit, MAX_FILE_PREVIEW_CHARS))
      content += '\n\n/* … file truncated for preview … */\n'
    }

    return {
      path: abs,
      relativePath,
      content,
      language: detectLanguage(abs),
      size: stat.size,
      truncated,
      encoding: 'utf-8',
      isBinary: false
    }
  }
}
