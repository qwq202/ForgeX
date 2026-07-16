import { useQuery } from '@tanstack/react-query'
import { useEffect } from 'react'
import { AppSidebar } from '@/components/AppSidebar'
import { StatusBar } from '@/components/StatusBar'
import { TooltipProvider } from '@/components/ui/tooltip'
import { ApprovalDialog } from '@/features/agent/ApprovalDialog'
import { ChatPanel } from '@/features/chat/ChatPanel'
import { RightPanel } from '@/features/files/RightPanel'
import { BottomPanel } from '@/features/terminal/BottomPanel'
import { SettingsPage } from '@/features/settings/SettingsPage'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { getApi } from '@/lib/api'
import { useSettingsStore } from '@/stores/settings-store'
import { useUiStore } from '@/stores/ui-store'
import { useWorkspaceStore } from '@/stores/workspace-store'

export default function App() {
  const setSettings = useSettingsStore((s) => s.setSettings)
  const setLoaded = useSettingsStore((s) => s.setLoaded)
  const settings = useSettingsStore((s) => s.settings)
  const setCurrentProjectId = useWorkspaceStore((s) => s.setCurrentProjectId)
  const setCurrentSessionId = useWorkspaceStore((s) => s.setCurrentSessionId)
  const pushLog = useWorkspaceStore((s) => s.pushLog)
  const currentProjectId = useWorkspaceStore((s) => s.currentProjectId)
  const settingsOpen = useUiStore((s) => s.settingsOpen)

  useKeyboardShortcuts()

  const { data: bootSettings } = useQuery({
    queryKey: ['settings'],
    queryFn: () => getApi().settings.get()
  })

  const { data: projects } = useQuery({
    queryKey: ['projects'],
    queryFn: () => getApi().projects.list()
  })

  useEffect(() => {
    if (bootSettings) {
      setSettings(bootSettings)
      setLoaded(true)
    }
  }, [bootSettings, setSettings, setLoaded])

  useEffect(() => {
    if (!settings.autoRestoreProject || !projects?.length || currentProjectId) return
    const last = projects[0]
    if (last) {
      setCurrentProjectId(last.id)
      void getApi().files.watch(last.id)
      void getApi().projects.touch(last.id)
    }
  }, [settings.autoRestoreProject, projects, currentProjectId, setCurrentProjectId])

  useEffect(() => {
    if (!settings.autoRestoreSession || !currentProjectId) return
    let cancelled = false
    void getApi()
      .sessions.list(currentProjectId)
      .then((sessions) => {
        if (cancelled || !sessions[0]) return
        setCurrentSessionId(sessions[0].id)
      })
    return () => {
      cancelled = true
    }
  }, [settings.autoRestoreSession, currentProjectId, setCurrentSessionId])

  useEffect(() => {
    const unsub = getApi().events.onLog((entry) => {
      if (!settings.showVerboseLogs && entry.level === 'debug') return
      pushLog(entry)
    })
    return unsub
  }, [pushLog, settings.showVerboseLogs])

  useEffect(() => {
    if (settings.theme !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => useSettingsStore.getState().applyTheme('system')
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [settings.theme])

  // Escape closes settings page
  useEffect(() => {
    if (!settingsOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        useUiStore.getState().setSettingsOpen(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [settingsOpen])

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex h-full flex-col overflow-hidden bg-background text-foreground">
        {settingsOpen ? (
          <SettingsPage />
        ) : (
          <>
            <div className="flex min-h-0 flex-1 overflow-hidden">
              <AppSidebar />
              <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
                <div className="min-h-0 flex-1 overflow-hidden">
                  <ChatPanel />
                </div>
                <BottomPanel />
              </main>
              <RightPanel />
            </div>
            <StatusBar />
          </>
        )}
        <ApprovalDialog />
      </div>
    </TooltipProvider>
  )
}
