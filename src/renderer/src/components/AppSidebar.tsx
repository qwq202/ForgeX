import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Files,
  GitCompare,
  MessageSquarePlus,
  PanelBottom,
  Search,
  Settings
} from 'lucide-react'
import { ProjectSessionTree } from '@/features/projects/ProjectSessionTree'
import { getApi } from '@/lib/api'
import { cn } from '@/lib/utils'
import { useUiStore } from '@/stores/ui-store'
import { useWorkspaceStore } from '@/stores/workspace-store'

function NavItem({
  icon: Icon,
  label,
  onClick,
  active
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  onClick: () => void
  active?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'titlebar-no-drag flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-[13px] transition-colors',
        active
          ? 'bg-sidebar-accent text-foreground'
          : 'text-sidebar-foreground hover:bg-sidebar-accent/80'
      )}
    >
      <Icon className="h-4 w-4 shrink-0 opacity-70" />
      <span>{label}</span>
    </button>
  )
}

/**
 * Codex-style sidebar header:
 * 1) top drag strip for macOS traffic lights
 * 2) brand row: app name left, search right (no pl-72 squeeze)
 */
function SidebarHeader({
  title,
  onSearch
}: {
  title: string
  onSearch?: () => void
}) {
  const isMac = window.forgex
    ? // platform from navigator is fine for layout; traffic lights only on darwin
      navigator.platform.toUpperCase().includes('MAC')
    : navigator.platform.toUpperCase().includes('MAC')

  return (
    <div className="shrink-0">
      {/* Row 1: traffic-light clearance + window region (Codex top chrome) */}
      <div
        className={cn(
          'titlebar-drag w-full',
          isMac ? 'h-[38px]' : 'h-2'
        )}
      />
      {/* Row 2: brand + search — aligned like Codex */}
      <div className="titlebar-no-drag flex h-10 items-center justify-between px-4">
        <span className="text-[15px] font-semibold tracking-tight text-foreground">{title}</span>
        <button
          type="button"
          className="rounded-lg p-1.5 text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
          title="搜索"
          onClick={onSearch}
        >
          <Search className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

export function AppSidebar() {
  const width = useUiStore((s) => s.sidebarWidth)
  const collapsed = useUiStore((s) => s.sidebarCollapsed)
  const setSettingsOpen = useUiStore((s) => s.setSettingsOpen)
  const openFilesPanel = useUiStore((s) => s.openFilesPanel)
  const openChangesPanel = useUiStore((s) => s.openChangesPanel)
  const openTerminalPanel = useUiStore((s) => s.openTerminalPanel)
  const rightPanelCollapsed = useUiStore((s) => s.rightPanelCollapsed)
  const rightPanelTab = useUiStore((s) => s.rightPanelTab)
  const bottomPanelCollapsed = useUiStore((s) => s.bottomPanelCollapsed)

  const projectId = useWorkspaceStore((s) => s.currentProjectId)
  const setCurrentSessionId = useWorkspaceStore((s) => s.setCurrentSessionId)
  const resetSessionUi = useWorkspaceStore((s) => s.resetSessionUi)
  const queryClient = useQueryClient()

  const createSession = useMutation({
    mutationFn: () => getApi().sessions.create(projectId!),
    onSuccess: (session) => {
      void queryClient.invalidateQueries({ queryKey: ['sessions', projectId] })
      void queryClient.invalidateQueries({ queryKey: ['all-sessions'] })
      setCurrentSessionId(session.id)
      resetSessionUi()
    }
  })

  if (collapsed) {
    return (
      <aside className="flex w-12 shrink-0 flex-col items-center border-r border-sidebar-border bg-sidebar">
        <div className="titlebar-drag h-[38px] w-full" />
        <div className="flex flex-col items-center gap-1 py-1">
          <button
            type="button"
            className="rounded-lg p-2 hover:bg-sidebar-accent"
            onClick={() => projectId && createSession.mutate()}
            title="新建会话"
          >
            <MessageSquarePlus className="h-4 w-4" />
          </button>
          <button
            type="button"
            className="rounded-lg p-2 hover:bg-sidebar-accent"
            onClick={openFilesPanel}
            title="文件"
          >
            <Files className="h-4 w-4" />
          </button>
          <button
            type="button"
            className="mt-auto rounded-lg p-2 hover:bg-sidebar-accent"
            onClick={() => setSettingsOpen(true)}
            title="设置"
          >
            <Settings className="h-4 w-4" />
          </button>
        </div>
      </aside>
    )
  }

  return (
    <aside
      className="flex shrink-0 flex-col border-r border-sidebar-border bg-sidebar"
      style={{ width }}
    >
      <SidebarHeader title="ForgeX" />

      {/* Primary nav */}
      <div className="space-y-0.5 px-2 pb-3 pt-1">
        <NavItem
          icon={MessageSquarePlus}
          label="新建会话"
          onClick={() => projectId && createSession.mutate()}
        />
        <NavItem
          icon={Files}
          label="文件"
          active={!rightPanelCollapsed && rightPanelTab === 'files'}
          onClick={openFilesPanel}
        />
        <NavItem
          icon={GitCompare}
          label="变更"
          active={!rightPanelCollapsed && (rightPanelTab === 'changes' || rightPanelTab === 'diff')}
          onClick={openChangesPanel}
        />
        <NavItem
          icon={PanelBottom}
          label="终端"
          active={!bottomPanelCollapsed}
          onClick={openTerminalPanel}
        />
        <NavItem icon={Settings} label="设置" onClick={() => setSettingsOpen(true)} />
      </div>

      <div className="mx-3 border-t border-sidebar-border" />

      <div className="mt-3 flex min-h-0 flex-1 flex-col">
        <ProjectSessionTree />
      </div>
    </aside>
  )
}
