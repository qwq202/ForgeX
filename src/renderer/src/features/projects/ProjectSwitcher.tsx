import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FolderOpen, FolderPlus, GitBranch, MoreHorizontal, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { getApi } from '@/lib/api'
import { cn, formatRelativeTime } from '@/lib/utils'
import { useWorkspaceStore } from '@/stores/workspace-store'
import { useUiStore } from '@/stores/ui-store'

export function ProjectSwitcher() {
  const queryClient = useQueryClient()
  const currentProjectId = useWorkspaceStore((s) => s.currentProjectId)
  const setCurrentProjectId = useWorkspaceStore((s) => s.setCurrentProjectId)
  const setOpenFilePath = useUiStore((s) => s.setOpenFilePath)
  const [removeId, setRemoveId] = useState<string | null>(null)

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: () => getApi().projects.list()
  })

  const openMutation = useMutation({
    mutationFn: async () => {
      const path = await getApi().projects.openDirectory()
      if (!path) return null
      return getApi().projects.add(path)
    },
    onSuccess: (project) => {
      if (!project) return
      void queryClient.invalidateQueries({ queryKey: ['projects'] })
      setCurrentProjectId(project.id)
      setOpenFilePath(null)
      void getApi().files.watch(project.id)
    }
  })

  const removeMutation = useMutation({
    mutationFn: (id: string) => getApi().projects.remove(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['projects'] })
      if (removeId && removeId === currentProjectId) {
        setCurrentProjectId(null)
      }
      setRemoveId(null)
    }
  })

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between px-1">
        <span className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">
          Projects
        </span>
        <Button
          size="icon-sm"
          variant="ghost"
          title="Open project"
          onClick={() => openMutation.mutate()}
          disabled={openMutation.isPending}
        >
          <FolderPlus className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="flex flex-col gap-0.5">
        {isLoading && (
          <p className="px-2 py-1 text-2xs text-muted-foreground">Loading projects…</p>
        )}
        {!isLoading && projects.length === 0 && (
          <button
            type="button"
            onClick={() => openMutation.mutate()}
            className="flex items-center gap-2 rounded-md border border-dashed border-border px-2 py-2 text-left text-xs text-muted-foreground hover:bg-sidebar-accent"
          >
            <FolderOpen className="h-3.5 w-3.5" />
            Open a local folder
          </button>
        )}
        {projects.map((p) => {
          const active = p.id === currentProjectId
          return (
            <div
              key={p.id}
              className={cn(
                'group flex items-center gap-1 rounded-md px-1.5 py-1.5 text-left text-xs transition-colors',
                active ? 'bg-sidebar-accent text-foreground' : 'hover:bg-sidebar-accent/60 text-sidebar-foreground'
              )}
            >
              <button
                type="button"
                className="min-w-0 flex-1 text-left"
                onClick={() => {
                  setCurrentProjectId(p.id)
                  setOpenFilePath(null)
                  void getApi().projects.touch(p.id)
                  void getApi().files.watch(p.id)
                }}
              >
                <div className="flex items-center gap-1.5">
                  <FolderOpen className="h-3.5 w-3.5 shrink-0 opacity-70" />
                  <span className="truncate font-medium">{p.name}</span>
                  {p.isGitRepo && <GitBranch className="h-3 w-3 shrink-0 opacity-50" />}
                </div>
                <div className="mt-0.5 truncate pl-5 text-2xs text-muted-foreground" title={p.path}>
                  {p.path}
                </div>
                <div className="pl-5 text-2xs text-muted-foreground/70">
                  {formatRelativeTime(p.lastOpenedAt)}
                </div>
              </button>
              <button
                type="button"
                className="opacity-0 group-hover:opacity-100 rounded p-1 hover:bg-background/50"
                title="Remove from list"
                onClick={() => setRemoveId(p.id)}
              >
                <Trash2 className="h-3 w-3 text-muted-foreground" />
              </button>
              <MoreHorizontal className="h-3 w-3 opacity-0" />
            </div>
          )
        })}
      </div>

      <ConfirmDialog
        open={Boolean(removeId)}
        onOpenChange={(o) => !o && setRemoveId(null)}
        title="Remove project?"
        description="This removes the project from the recent list. Files on disk are not deleted. Sessions for this project will also be removed from the local database."
        confirmLabel="Remove"
        destructive
        onConfirm={() => removeId && removeMutation.mutate(removeId)}
      />
    </div>
  )
}
