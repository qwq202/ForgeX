import { Files, GitCompare, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useUiStore } from '@/stores/ui-store'
import { FileExplorer } from './FileExplorer'
import { FileViewer } from './FileViewer'
import { DiffViewer } from '@/features/git/DiffViewer'

export function RightPanel() {
  const collapsed = useUiStore((s) => s.rightPanelCollapsed)
  const width = useUiStore((s) => s.rightPanelWidth)
  const tab = useUiStore((s) => s.rightPanelTab)
  const setTab = useUiStore((s) => s.setRightPanelTab)
  const setCollapsed = useUiStore((s) => s.setRightPanelCollapsed)
  const openFilePath = useUiStore((s) => s.openFilePath)

  if (collapsed) return null

  return (
    <aside
      className="flex shrink-0 flex-col border-l border-panel-border bg-panel"
      style={{ width }}
    >
      <div className="flex h-10 shrink-0 items-center justify-between gap-1 border-b border-border px-2">
        <div className="flex items-center gap-0.5">
          {(
            [
              { id: 'files' as const, label: '文件', icon: Files },
              { id: 'changes' as const, label: '变更', icon: GitCompare },
              { id: 'diff' as const, label: 'Diff', icon: GitCompare }
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              className={cn(
                'inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[12px] font-medium',
                tab === t.id
                  ? 'bg-accent text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              )}
              onClick={() => setTab(t.id)}
            >
              <t.icon className="h-3.5 w-3.5" />
              {t.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          title="关闭面板"
          onClick={() => setCollapsed(true)}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden">
        {tab === 'files' && (
          <div className="flex h-full min-h-0 flex-col">
            <div className={cn('min-h-0', openFilePath ? 'h-1/2 border-b border-border' : 'h-full')}>
              <FileExplorer />
            </div>
            {openFilePath && (
              <div className="min-h-0 h-1/2">
                <FileViewer />
              </div>
            )}
          </div>
        )}
        {(tab === 'changes' || tab === 'diff') && <DiffViewer />}
      </div>
    </aside>
  )
}
