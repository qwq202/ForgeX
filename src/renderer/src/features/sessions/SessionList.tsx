import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { MessageSquarePlus, Pencil, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { getApi } from '@/lib/api'
import { cn, formatRelativeTime } from '@/lib/utils'
import { useWorkspaceStore } from '@/stores/workspace-store'

export function SessionList() {
  const queryClient = useQueryClient()
  const projectId = useWorkspaceStore((s) => s.currentProjectId)
  const sessionId = useWorkspaceStore((s) => s.currentSessionId)
  const setCurrentSessionId = useWorkspaceStore((s) => s.setCurrentSessionId)
  const resetSessionUi = useWorkspaceStore((s) => s.resetSessionUi)

  const [renameId, setRenameId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const { data: sessions = [] } = useQuery({
    queryKey: ['sessions', projectId],
    queryFn: () => getApi().sessions.list(projectId!),
    enabled: Boolean(projectId)
  })

  const createMutation = useMutation({
    mutationFn: () => getApi().sessions.create(projectId!),
    onSuccess: (session) => {
      void queryClient.invalidateQueries({ queryKey: ['sessions', projectId] })
      setCurrentSessionId(session.id)
      resetSessionUi()
    }
  })

  const renameMutation = useMutation({
    mutationFn: ({ id, title }: { id: string; title: string }) =>
      getApi().sessions.rename(id, title),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['sessions', projectId] })
      setRenameId(null)
    }
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => getApi().sessions.delete(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['sessions', projectId] })
      if (deleteId === sessionId) setCurrentSessionId(null)
      setDeleteId(null)
    }
  })

  if (!projectId) {
    return (
      <p className="px-1 text-2xs text-muted-foreground">Select a project to view sessions.</p>
    )
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between px-1">
        <span className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">
          Sessions
        </span>
        <Button
          size="icon-sm"
          variant="ghost"
          title="New session"
          onClick={() => createMutation.mutate()}
          disabled={createMutation.isPending}
        >
          <MessageSquarePlus className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="flex flex-col gap-0.5">
        {sessions.length === 0 && (
          <p className="px-2 py-1 text-2xs text-muted-foreground">No sessions yet.</p>
        )}
        {sessions.map((s) => {
          const active = s.id === sessionId
          if (renameId === s.id) {
            return (
              <form
                key={s.id}
                className="px-1"
                onSubmit={(e) => {
                  e.preventDefault()
                  if (renameValue.trim()) {
                    renameMutation.mutate({ id: s.id, title: renameValue.trim() })
                  }
                }}
              >
                <Input
                  autoFocus
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onBlur={() => setRenameId(null)}
                  className="h-7 text-xs"
                />
              </form>
            )
          }
          return (
            <div
              key={s.id}
              className={cn(
                'group flex items-center gap-1 rounded-md px-2 py-1.5 text-xs',
                active ? 'bg-sidebar-accent' : 'hover:bg-sidebar-accent/60'
              )}
            >
              <button
                type="button"
                className="min-w-0 flex-1 text-left"
                onClick={() => {
                  setCurrentSessionId(s.id)
                  resetSessionUi()
                }}
              >
                <div className="truncate font-medium">{s.title}</div>
                <div className="text-2xs text-muted-foreground">
                  {formatRelativeTime(s.updatedAt)} · {s.status}
                </div>
              </button>
              <button
                type="button"
                className="opacity-0 group-hover:opacity-100 rounded p-1 hover:bg-background/50"
                onClick={() => {
                  setRenameId(s.id)
                  setRenameValue(s.title)
                }}
              >
                <Pencil className="h-3 w-3 text-muted-foreground" />
              </button>
              <button
                type="button"
                className="opacity-0 group-hover:opacity-100 rounded p-1 hover:bg-background/50"
                onClick={() => setDeleteId(s.id)}
              >
                <Trash2 className="h-3 w-3 text-muted-foreground" />
              </button>
            </div>
          )
        })}
      </div>

      <ConfirmDialog
        open={Boolean(deleteId)}
        onOpenChange={(o) => !o && setDeleteId(null)}
        title="Delete session?"
        description="This permanently deletes the session and all of its messages from the local database."
        confirmLabel="Delete"
        destructive
        onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
      />
    </div>
  )
}
