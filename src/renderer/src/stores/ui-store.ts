import { create } from 'zustand'
import type { BottomPanelTab, RightPanelTab } from '@shared/types'

interface UiState {
  sidebarCollapsed: boolean
  sidebarWidth: number
  rightPanelCollapsed: boolean
  rightPanelWidth: number
  rightPanelTab: RightPanelTab
  bottomPanelCollapsed: boolean
  bottomPanelHeight: number
  bottomPanelTab: BottomPanelTab
  settingsOpen: boolean
  openFilePath: string | null
  diffFilePath: string | null

  setSidebarCollapsed: (v: boolean) => void
  setSidebarWidth: (w: number) => void
  setRightPanelCollapsed: (v: boolean) => void
  setRightPanelWidth: (w: number) => void
  setRightPanelTab: (t: RightPanelTab) => void
  setBottomPanelCollapsed: (v: boolean) => void
  setBottomPanelHeight: (h: number) => void
  setBottomPanelTab: (t: BottomPanelTab) => void
  setSettingsOpen: (v: boolean) => void
  setOpenFilePath: (p: string | null) => void
  setDiffFilePath: (p: string | null) => void
  toggleBottomPanel: () => void
  toggleRightPanel: () => void
  toggleSidebar: () => void
  openFilesPanel: () => void
  openChangesPanel: () => void
  openTerminalPanel: () => void
}

export const useUiStore = create<UiState>((set, get) => ({
  sidebarCollapsed: false,
  sidebarWidth: 248,
  // Codex-style: drawers closed by default
  rightPanelCollapsed: true,
  rightPanelWidth: 380,
  rightPanelTab: 'files',
  bottomPanelCollapsed: true,
  bottomPanelHeight: 240,
  bottomPanelTab: 'terminal',
  settingsOpen: false,
  openFilePath: null,
  diffFilePath: null,

  setSidebarCollapsed: (v) => set({ sidebarCollapsed: v }),
  setSidebarWidth: (w) => set({ sidebarWidth: Math.max(200, Math.min(360, w)) }),
  setRightPanelCollapsed: (v) => set({ rightPanelCollapsed: v }),
  setRightPanelWidth: (w) => set({ rightPanelWidth: Math.max(280, Math.min(560, w)) }),
  setRightPanelTab: (t) => set({ rightPanelTab: t }),
  setBottomPanelCollapsed: (v) => set({ bottomPanelCollapsed: v }),
  setBottomPanelHeight: (h) => set({ bottomPanelHeight: Math.max(120, Math.min(480, h)) }),
  setBottomPanelTab: (t) => set({ bottomPanelTab: t, bottomPanelCollapsed: false }),
  setSettingsOpen: (v) => set({ settingsOpen: v }),
  setOpenFilePath: (p) => set({ openFilePath: p }),
  setDiffFilePath: (p) => set({ diffFilePath: p, rightPanelTab: p ? 'diff' : get().rightPanelTab }),
  toggleBottomPanel: () => set({ bottomPanelCollapsed: !get().bottomPanelCollapsed }),
  toggleRightPanel: () => set({ rightPanelCollapsed: !get().rightPanelCollapsed }),
  toggleSidebar: () => set({ sidebarCollapsed: !get().sidebarCollapsed }),
  openFilesPanel: () =>
    set({ rightPanelCollapsed: false, rightPanelTab: 'files' }),
  openChangesPanel: () =>
    set({ rightPanelCollapsed: false, rightPanelTab: 'changes' }),
  openTerminalPanel: () =>
    set({ bottomPanelCollapsed: false, bottomPanelTab: 'terminal' })
}))
