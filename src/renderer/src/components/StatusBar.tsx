import { useQuery } from '@tanstack/react-query'
import { Circle, GitBranch } from 'lucide-react'
import { getApi } from '@/lib/api'
import { useWorkspaceStore } from '@/stores/workspace-store'
import { cn } from '@/lib/utils'

const statusColor: Record<string, string> = {
  idle: 'text-muted-foreground',
  starting: 'text-amber-500',
  running: 'text-emerald-500',
  streaming: 'text-sky-500',
  tool_calling: 'text-violet-500',
  waiting_approval: 'text-amber-500',
  stopping: 'text-amber-500',
  error: 'text-red-500',
  stopped: 'text-muted-foreground'
}

/** Compact status strip — Codex-like minimal chrome */
export function StatusBar() {
  const projectId = useWorkspaceStore((s) => s.currentProjectId)
  const agentStatus = useWorkspaceStore((s) => s.agentStatus)

  const { data: projects } = useQuery({
    queryKey: ['projects'],
    queryFn: () => getApi().projects.list()
  })

  const { data: git } = useQuery({
    queryKey: ['git-status', projectId],
    queryFn: () => getApi().git.status(projectId!),
    enabled: Boolean(projectId),
    refetchInterval: 15_000
  })

  const { data: grok } = useQuery({
    queryKey: ['grok-info'],
    queryFn: () => getApi().app.getGrokBuildInfo(),
    staleTime: 60_000
  })

  const project = projects?.find((p) => p.id === projectId)

  return (
    <div className="flex h-6 shrink-0 items-center justify-between border-t border-border/60 bg-sidebar px-3 text-[11px] text-muted-foreground">
      <div className="flex min-w-0 items-center gap-3">
        <span className={cn('inline-flex items-center gap-1', statusColor[agentStatus] ?? '')}>
          <Circle className="h-1.5 w-1.5 fill-current" />
          {agentStatus}
        </span>
        {project && <span className="max-w-[200px] truncate">{project.name}</span>}
        {git?.isRepo && git.branch && (
          <span className="inline-flex items-center gap-1">
            <GitBranch className="h-3 w-3" />
            {git.branch}
          </span>
        )}
      </div>
      <div className="flex items-center gap-3">
        <span>
          Grok Build{' '}
          {grok?.installed ? (
            <span className="text-emerald-600 dark:text-emerald-400">
              {grok.version ?? '就绪'}
            </span>
          ) : (
            <span className="text-amber-600 dark:text-amber-400">未找到</span>
          )}
        </span>
      </div>
    </div>
  )
}
