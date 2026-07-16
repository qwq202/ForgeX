import { execFile } from 'child_process'
import { existsSync } from 'fs'
import { join } from 'path'
import { promisify } from 'util'
import { MAX_DIFF_SIZE_BYTES } from '@shared/constants'
import type { GitDiff, GitFileStatus, GitStatus } from '@shared/types'
import { resolveProjectPath } from '../filesystem/path-guard'
import { logger } from '../logger'

const execFileAsync = promisify(execFile)

async function runGit(
  cwd: string,
  args: string[],
  options?: { maxBuffer?: number }
): Promise<{ stdout: string; stderr: string; code: number }> {
  try {
    const { stdout, stderr } = await execFileAsync('git', args, {
      cwd,
      maxBuffer: options?.maxBuffer ?? 5 * 1024 * 1024,
      encoding: 'utf-8',
      windowsHide: true
    })
    return { stdout: stdout ?? '', stderr: stderr ?? '', code: 0 }
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string; code?: number; message?: string }
    return {
      stdout: e.stdout ?? '',
      stderr: e.stderr ?? e.message ?? String(err),
      code: typeof e.code === 'number' ? e.code : 1
    }
  }
}

export function isGitRepo(projectPath: string): boolean {
  return existsSync(join(projectPath, '.git'))
}

function parseStatusCode(xy: string): GitFileStatus['status'] {
  const x = xy[0] ?? ' '
  const y = xy[1] ?? ' '
  if (x === 'U' || y === 'U' || xy === 'AA' || xy === 'DD') return 'conflicted'
  if (x === 'A' || y === 'A' || x === '?' || y === '?') return 'added'
  if (x === 'D' || y === 'D') return 'deleted'
  if (x === 'R' || y === 'R') return 'renamed'
  if (x === '?' && y === '?') return 'untracked'
  return 'modified'
}

export const gitService = {
  isRepo: isGitRepo,

  async status(projectPath: string): Promise<GitStatus> {
    if (!isGitRepo(projectPath)) {
      return {
        isRepo: false,
        branch: null,
        ahead: 0,
        behind: 0,
        files: [],
        dirty: false
      }
    }

    const branchResult = await runGit(projectPath, ['rev-parse', '--abbrev-ref', 'HEAD'])
    const branch = branchResult.code === 0 ? branchResult.stdout.trim() : null

    let ahead = 0
    let behind = 0
    const ab = await runGit(projectPath, ['rev-list', '--left-right', '--count', 'HEAD...@{upstream}'])
    if (ab.code === 0) {
      const parts = ab.stdout.trim().split(/\s+/)
      ahead = Number(parts[0] ?? 0) || 0
      behind = Number(parts[1] ?? 0) || 0
    }

    const porcelain = await runGit(projectPath, ['status', '--porcelain=v1', '-uall'])
    const files: GitFileStatus[] = []

    if (porcelain.code === 0 && porcelain.stdout.trim()) {
      for (const line of porcelain.stdout.split('\n')) {
        if (!line.trim()) continue
        const xy = line.slice(0, 2)
        let pathPart = line.slice(3)
        // renamed: "R  old -> new"
        if (pathPart.includes(' -> ')) {
          pathPart = pathPart.split(' -> ').pop() ?? pathPart
        }
        const path = pathPart.replace(/^"|"$/g, '')
        const status = xy === '??' ? 'untracked' : parseStatusCode(xy)
        const staged = xy[0] !== ' ' && xy[0] !== '?'
        files.push({ path, status, staged })
      }
    }

    // numstat for insertions/deletions
    const numstat = await runGit(projectPath, ['diff', '--numstat', 'HEAD'])
    const unstaged = await runGit(projectPath, ['diff', '--numstat'])
    const stagedNum = await runGit(projectPath, ['diff', '--numstat', '--cached'])
    const stats = new Map<string, { insertions: number; deletions: number }>()

    for (const block of [numstat.stdout, unstaged.stdout, stagedNum.stdout]) {
      for (const line of block.split('\n')) {
        if (!line.trim()) continue
        const [ins, del, ...rest] = line.split('\t')
        const filePath = rest.join('\t')
        if (!filePath || filePath.includes(' => ')) continue
        const prev = stats.get(filePath) ?? { insertions: 0, deletions: 0 }
        stats.set(filePath, {
          insertions: prev.insertions + (ins === '-' ? 0 : Number(ins) || 0),
          deletions: prev.deletions + (del === '-' ? 0 : Number(del) || 0)
        })
      }
    }

    for (const f of files) {
      const s = stats.get(f.path)
      if (s) {
        f.insertions = s.insertions
        f.deletions = s.deletions
      }
    }

    return {
      isRepo: true,
      branch,
      ahead,
      behind,
      files,
      dirty: files.length > 0
    }
  },

  async diff(projectPath: string, relativePath: string): Promise<GitDiff> {
    // Validate path stays in project
    resolveProjectPath(projectPath, relativePath)

    if (!isGitRepo(projectPath)) {
      return {
        path: relativePath,
        original: '',
        modified: '',
        isBinary: false,
        insertions: 0,
        deletions: 0,
        isNew: true,
        isDeleted: false
      }
    }

    const statusResult = await this.status(projectPath)
    const fileStatus = statusResult.files.find((f) => f.path === relativePath)
    const isNew = fileStatus?.status === 'added' || fileStatus?.status === 'untracked'
    const isDeleted = fileStatus?.status === 'deleted'

    // HEAD version
    let original = ''
    if (!isNew) {
      const show = await runGit(projectPath, ['show', `HEAD:${relativePath}`], {
        maxBuffer: MAX_DIFF_SIZE_BYTES * 2
      })
      if (show.code === 0) {
        original = show.stdout
        if (original.includes('\0')) {
          return {
            path: relativePath,
            original: '',
            modified: '',
            isBinary: true,
            insertions: 0,
            deletions: 0,
            isNew: false,
            isDeleted
          }
        }
      }
    }

    // Working tree version
    let modified = ''
    if (!isDeleted) {
      try {
        const abs = resolveProjectPath(projectPath, relativePath)
        if (existsSync(abs)) {
          const { readFileSync, statSync } = await import('fs')
          const stat = statSync(abs)
          if (stat.size > MAX_DIFF_SIZE_BYTES) {
            modified = readFileSync(abs, 'utf-8').slice(0, MAX_DIFF_SIZE_BYTES)
            modified += '\n\n/* … truncated … */\n'
          } else {
            const buf = readFileSync(abs)
            if (buf.includes(0)) {
              return {
                path: relativePath,
                original: '',
                modified: '',
                isBinary: true,
                insertions: fileStatus?.insertions ?? 0,
                deletions: fileStatus?.deletions ?? 0,
                isNew: Boolean(isNew),
                isDeleted: false
              }
            }
            modified = buf.toString('utf-8')
          }
        }
      } catch (err) {
        logger.warn('git', `Failed to read working tree file: ${String(err)}`)
      }
    }

    if (original.length > MAX_DIFF_SIZE_BYTES) {
      original = original.slice(0, MAX_DIFF_SIZE_BYTES) + '\n\n/* … truncated … */\n'
    }

    return {
      path: relativePath,
      original,
      modified,
      isBinary: false,
      insertions: fileStatus?.insertions ?? 0,
      deletions: fileStatus?.deletions ?? 0,
      isNew: Boolean(isNew),
      isDeleted: Boolean(isDeleted)
    }
  },

  /**
   * Discard local changes for a file. Destructive — caller must confirm in UI.
   */
  async discard(projectPath: string, relativePath: string): Promise<void> {
    resolveProjectPath(projectPath, relativePath)
    if (!isGitRepo(projectPath)) {
      throw new Error('Not a git repository')
    }

    const status = await this.status(projectPath)
    const file = status.files.find((f) => f.path === relativePath)
    if (!file) return

    if (file.status === 'untracked' || file.status === 'added') {
      // For untracked: just leave it — full delete is more destructive; use checkout for tracked
      if (file.status === 'untracked') {
        const { unlinkSync, existsSync: ex } = await import('fs')
        const abs = resolveProjectPath(projectPath, relativePath)
        if (ex(abs)) unlinkSync(abs)
        return
      }
    }

    const result = await runGit(projectPath, ['checkout', 'HEAD', '--', relativePath])
    if (result.code !== 0) {
      // try restore for newer git
      const restore = await runGit(projectPath, ['restore', '--source=HEAD', '--worktree', '--', relativePath])
      if (restore.code !== 0) {
        throw new Error(restore.stderr || result.stderr || 'Failed to discard changes')
      }
    }
  }
}
