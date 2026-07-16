import { realpathSync, existsSync } from 'fs'
import { isAbsolute, normalize, relative, resolve, sep } from 'path'
import { isRelativePathSafe, normalizeRelativePath } from '@shared/utils/path-safety'

export class PathGuardError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PathGuardError'
  }
}

/**
 * Resolve a relative path against a project root and ensure it stays inside the root.
 * Prevents directory traversal attacks.
 */
export function resolveProjectPath(projectRoot: string, relativePath: string): string {
  if (!isRelativePathSafe(relativePath) && relativePath !== '' && relativePath !== '.') {
    throw new PathGuardError(`Unsafe relative path: ${relativePath}`)
  }

  const rel = normalizeRelativePath(relativePath || '.')
  const root = resolve(projectRoot)
  const target = resolve(root, rel)

  const relToRoot = relative(root, target)
  if (relToRoot.startsWith('..') || isAbsolute(relToRoot)) {
    throw new PathGuardError(`Path escapes project root: ${relativePath}`)
  }

  // If path exists, resolve realpath to catch symlink escapes
  if (existsSync(target)) {
    try {
      const realTarget = realpathSync(target)
      const realRoot = realpathSync(root)
      const realRel = relative(realRoot, realTarget)
      if (realRel.startsWith('..') || isAbsolute(realRel)) {
        throw new PathGuardError(`Symlink path escapes project root: ${relativePath}`)
      }
      return realTarget
    } catch (err) {
      if (err instanceof PathGuardError) throw err
      // realpath may fail on broken links; fall through
    }
  }

  return target
}

export function toRelativePath(projectRoot: string, absolutePath: string): string {
  const root = resolve(projectRoot)
  const abs = resolve(absolutePath)
  const rel = relative(root, abs)
  if (rel.startsWith('..') || isAbsolute(rel)) {
    throw new PathGuardError('Absolute path is outside project root')
  }
  return rel.split(sep).join('/')
}

export function assertInsideProject(projectRoot: string, absolutePath: string): void {
  const root = normalize(resolve(projectRoot)) + sep
  const target = normalize(resolve(absolutePath))
  if (target !== normalize(resolve(projectRoot)) && !target.startsWith(root)) {
    throw new PathGuardError('Path is outside project root')
  }
}
