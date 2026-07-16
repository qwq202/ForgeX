import type { ForgeXAPI } from '../../../preload/types'

export function getApi(): ForgeXAPI {
  if (typeof window === 'undefined' || !window.forgex) {
    throw new Error('ForgeX API is not available. Are you running inside Electron?')
  }
  return window.forgex
}

/** Safe accessor that returns null outside Electron (for Vite HMR preview) */
export function tryGetApi(): ForgeXAPI | null {
  if (typeof window === 'undefined' || !window.forgex) return null
  return window.forgex
}
