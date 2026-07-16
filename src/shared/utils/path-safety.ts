/**
 * Path safety helpers shared conceptually with main process.
 * Actual FS checks still happen in main.
 */

const DANGEROUS_SEGMENTS = new Set(['..', '.'])

export function isRelativePathSafe(relativePath: string): boolean {
  if (!relativePath || relativePath.startsWith('/') || /^[a-zA-Z]:/.test(relativePath)) {
    return false
  }
  const normalized = relativePath.replace(/\\/g, '/')
  if (normalized.includes('\0')) return false
  const parts = normalized.split('/').filter(Boolean)
  for (const part of parts) {
    if (DANGEROUS_SEGMENTS.has(part)) return false
  }
  return true
}

export function normalizeRelativePath(relativePath: string): string {
  return relativePath.replace(/\\/g, '/').replace(/^\.?\//, '')
}
