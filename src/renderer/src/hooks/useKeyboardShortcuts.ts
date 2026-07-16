import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { getApi } from '@/lib/api'
import { useUiStore } from '@/stores/ui-store'
import { useWorkspaceStore } from '@/stores/workspace-store'

/** Global app shortcuts (macOS: meta, Windows/Linux: ctrl) */
export function useKeyboardShortcuts(): void {
  const queryClient = useQueryClient()
  const projectId = useWorkspaceStore((s) => s.currentProjectId)
  const setCurrentSessionId = useWorkspaceStore((s) => s.setCurrentSessionId)
  const resetSessionUi = useWorkspaceStore((s) => s.resetSessionUi)
  const setSettingsOpen = useUiStore((s) => s.setSettingsOpen)
  const openFilesPanel = useUiStore((s) => s.openFilesPanel)
  const openChangesPanel = useUiStore((s) => s.openChangesPanel)
  const openTerminalPanel = useUiStore((s) => s.openTerminalPanel)
  const toggleSidebar = useUiStore((s) => s.toggleSidebar)
  const setRightPanelCollapsed = useUiStore((s) => s.setRightPanelCollapsed)
  const setBottomPanelCollapsed = useUiStore((s) => s.setBottomPanelCollapsed)
  const rightPanelCollapsed = useUiStore((s) => s.rightPanelCollapsed)
  const bottomPanelCollapsed = useUiStore((s) => s.bottomPanelCollapsed)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey
      if (!mod) return

      const key = e.key.toLowerCase()

      // Cmd/Ctrl + N → new session
      if (key === 'n' && !e.shiftKey) {
        if (!projectId) return
        e.preventDefault()
        void getApi()
          .sessions.create(projectId)
          .then((session) => {
            setCurrentSessionId(session.id)
            resetSessionUi()
            void queryClient.invalidateQueries({ queryKey: ['sessions', projectId] })
            void queryClient.invalidateQueries({ queryKey: ['all-sessions'] })
          })
        return
      }

      // Cmd/Ctrl + , → settings
      if (key === ',') {
        e.preventDefault()
        setSettingsOpen(true)
        return
      }

      // Cmd/Ctrl + B → toggle sidebar
      if (key === 'b') {
        e.preventDefault()
        toggleSidebar()
        return
      }

      // Cmd/Ctrl + J → terminal
      if (key === 'j') {
        e.preventDefault()
        if (bottomPanelCollapsed) openTerminalPanel()
        else setBottomPanelCollapsed(true)
        return
      }

      // Cmd/Ctrl + Shift + E → files
      if (key === 'e' && e.shiftKey) {
        e.preventDefault()
        if (rightPanelCollapsed) openFilesPanel()
        else setRightPanelCollapsed(true)
        return
      }

      // Cmd/Ctrl + Shift + G → git changes
      if (key === 'g' && e.shiftKey) {
        e.preventDefault()
        if (rightPanelCollapsed) openChangesPanel()
        else setRightPanelCollapsed(true)
        return
      }
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [
    projectId,
    queryClient,
    setCurrentSessionId,
    resetSessionUi,
    setSettingsOpen,
    openFilesPanel,
    openChangesPanel,
    openTerminalPanel,
    toggleSidebar,
    setRightPanelCollapsed,
    setBottomPanelCollapsed,
    rightPanelCollapsed,
    bottomPanelCollapsed
  ])
}
