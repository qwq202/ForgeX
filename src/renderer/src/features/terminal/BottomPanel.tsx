import { ChevronDown, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useUiStore } from '@/stores/ui-store'
import { useWorkspaceStore } from '@/stores/workspace-store'
import { TerminalPanel } from './TerminalPanel'

export function BottomPanel() {
  const collapsed = useUiStore((s) => s.bottomPanelCollapsed)
  const height = useUiStore((s) => s.bottomPanelHeight)
  const tab = useUiStore((s) => s.bottomPanelTab)
  const setTab = useUiStore((s) => s.setBottomPanelTab)
  const setCollapsed = useUiStore((s) => s.setBottomPanelCollapsed)
  const setHeight = useUiStore((s) => s.setBottomPanelHeight)
  const logs = useWorkspaceStore((s) => s.logs)
  const problems = useWorkspaceStore((s) => s.problems)
  const dragRef = useRefDragging(setHeight)

  if (collapsed) return null

  const tabs = [
    { id: 'terminal' as const, label: '终端' },
    { id: 'logs' as const, label: `日志${logs.length ? ` (${logs.length})` : ''}` },
    {
      id: 'problems' as const,
      label: `问题${problems.length ? ` (${problems.length})` : ''}`
    }
  ]

  return (
    <div
      className="flex shrink-0 flex-col border-t border-border bg-panel"
      style={{ height }}
    >
      <div
        className="h-1 cursor-row-resize bg-transparent hover:bg-primary/20"
        onMouseDown={dragRef}
      />
      <div className="flex h-9 shrink-0 items-center justify-between border-b border-border px-2">
        <div className="flex items-center gap-0.5">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              className={cn(
                'rounded-lg px-2.5 py-1 text-[12px] font-medium',
                tab === t.id
                  ? 'bg-accent text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              )}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted"
            onClick={() => setCollapsed(true)}
            title="收起"
          >
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted"
            onClick={() => setCollapsed(true)}
            title="关闭"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">
        {tab === 'terminal' && <TerminalPanel />}
        {tab === 'logs' && (
          <div className="h-full overflow-y-auto p-2 font-mono text-[11px]">
            {logs.length === 0 ? (
              <p className="text-muted-foreground">暂无日志</p>
            ) : (
              logs.map((l) => (
                <div key={l.id} className="flex gap-2 border-b border-border/40 py-0.5">
                  <span className="shrink-0 text-muted-foreground">
                    {new Date(l.timestamp).toLocaleTimeString()}
                  </span>
                  <span
                    className={cn(
                      'w-10 shrink-0 uppercase',
                      l.level === 'error' && 'text-red-500',
                      l.level === 'warn' && 'text-amber-500',
                      l.level === 'info' && 'text-sky-500'
                    )}
                  >
                    {l.level}
                  </span>
                  <span className="shrink-0 text-muted-foreground">[{l.source}]</span>
                  <span className="min-w-0 break-all">{l.message}</span>
                </div>
              ))
            )}
          </div>
        )}
        {tab === 'problems' && (
          <div className="h-full overflow-y-auto p-2 text-xs">
            {problems.length === 0 ? (
              <p className="text-[11px] text-muted-foreground">未检测到问题</p>
            ) : (
              problems.map((p) => (
                <div key={p.id} className="border-b border-border/40 py-1">
                  <span
                    className={cn(
                      'mr-2 text-[11px] uppercase',
                      p.severity === 'error' && 'text-red-500',
                      p.severity === 'warning' && 'text-amber-500'
                    )}
                  >
                    {p.severity}
                  </span>
                  {p.file && (
                    <span className="mr-2 font-mono text-[11px] text-muted-foreground">
                      {p.file}
                      {p.line != null ? `:${p.line}` : ''}
                    </span>
                  )}
                  {p.message}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function useRefDragging(setHeight: (h: number) => void) {
  return (e: React.MouseEvent) => {
    e.preventDefault()
    const startY = e.clientY
    const startHeight = useUiStore.getState().bottomPanelHeight

    const onMove = (ev: MouseEvent) => {
      const delta = startY - ev.clientY
      setHeight(startHeight + delta)
    }
    const onUp = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }
}

