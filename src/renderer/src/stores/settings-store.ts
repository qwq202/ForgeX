import { create } from 'zustand'
import type { AppSettings, ThemeMode } from '@shared/types'
import { DEFAULT_SETTINGS } from '@shared/constants'

interface SettingsState {
  settings: AppSettings
  loaded: boolean
  setSettings: (s: AppSettings) => void
  patchSettings: (p: Partial<AppSettings>) => void
  setLoaded: (v: boolean) => void
  applyTheme: (theme: ThemeMode) => void
}

function resolveDark(theme: ThemeMode): boolean {
  if (theme === 'dark') return true
  if (theme === 'light') return false
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

export function applyDocumentTheme(theme: ThemeMode): void {
  const dark = resolveDark(theme)
  document.documentElement.classList.toggle('dark', dark)
  document.documentElement.style.fontSize = undefined as unknown as string
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: { ...DEFAULT_SETTINGS },
  loaded: false,
  setSettings: (s) => {
    set({ settings: s })
    applyDocumentTheme(s.theme)
    document.documentElement.style.setProperty('--app-font-size', `${s.fontSize}px`)
    document.body.style.fontSize = `${s.fontSize}px`
  },
  patchSettings: (p) => {
    const next = { ...get().settings, ...p }
    get().setSettings(next)
  },
  setLoaded: (v) => set({ loaded: v }),
  applyTheme: (theme) => applyDocumentTheme(theme)
}))
