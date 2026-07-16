import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Folder, FolderPlus, MoreHorizontal, Pencil, SquarePen, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { Input } from '@/components/ui/input'
import { getApi } from '@/lib/api'
import { cn } from '@/lib/utils'
import { useUiStore } from '@/stores/ui-store'
import { useWorkspaceStore } from '@/stores/workspace-store'
import type { Project, Session } from '@shared/types'

/**
 * Codex-style project tree:
 * 项目
 * 📁 qq-bot
 *    session title
 *    session title
 *
 * Hover: full-width pill background + … / edit actions
 */
function ProjectBranch({
  project,
  expanded,
  onToggle,
  sessions,
  currentProjectId,
  currentSessionId,
  renameSessionId,
  renameValue,
  onRenameValue,
  onStartRename,
  onCommitRename,
  onCancelRename,
  onSelectProject,
  onSelectSession,
  onRemoveProject,
  onDeleteSession,
  onNewSession
}: {
  project: Project
  expanded: boolean
  onToggle: () => void
  sessions: Session[]
  currentProjectId: string | null
  currentSessionId: string | null
  renameSessionId: string | null
  renameValue: string
  onRenameValue: (v: string) => void
  onStartRename: (s: Session) => void
  onCommitRename: () => void
  onCancelRename: () => void
  onSelectProject: () => void
  onSelectSession: (sessionId: string) => void
  onRemoveProject: () => void
  onDeleteSession: (sessionId: string) => void
  onNewSession: () => void
}) {
  const active = project.id === currentProjectId
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuOpen) return
    const onDoc = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [menuOpen])

  return (
    <div className="mb-1">
      {/* Project row — Codex hover pill */}
      <div
        className={cn(
          'group relative flex h-8 items-center gap-1 rounded-lg px-2 transition-colors',
          // Codex: gray pill only on hover, not when merely selected
          'hover:bg-sidebar-accent'
        )}
      >
        <button
          type="button"
          className="titlebar-no-drag flex min-w-0 flex-1 items-center gap-2 text-left text-[13px] text-foreground"
          onClick={() => {
            onSelectProject()
            if (!expanded) onToggle()
          }}
          onDoubleClick={onToggle}
          title={project.path}
        >
          <Folder
            className="h-[15px] w-[15px] shrink-0 stroke-[1.5] text-foreground/75"
            fill="none"
          />
          <span className="truncate font-normal tracking-tight">{project.name}</span>
        </button>

        {/* Hover actions: …  and  new session / edit */}
        <div
          className={cn(
            'titlebar-no-drag flex shrink-0 items-center gap-0.5',
            menuOpen ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
          )}
        >
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:text-foreground"
              title="更多"
              onClick={(e) => {
                e.stopPropagation()
                setMenuOpen((v) => !v)
              }}
            >
              <MoreHorizontal className="h-3.5 w-3.5" />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-full z-50 mt-1 min-w-[128px] rounded-lg border border-border bg-popover py-1 shadow-md">
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[12.5px] hover:bg-accent"
                  onClick={() => {
                    setMenuOpen(false)
                    onToggle()
                  }}
                >
                  {expanded ? '折叠会话' : '展开会话'}
                </button>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[12.5px] text-destructive hover:bg-accent"
                  onClick={() => {
                    setMenuOpen(false)
                    onRemoveProject()
                  }}
                >
                  从列表移除
                </button>
              </div>
            )}
          </div>
          <button
            type="button"
            className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:text-foreground"
            title="新建会话"
            onClick={(e) => {
              e.stopPropagation()
              onNewSession()
            }}
          >
            <SquarePen className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Sessions — plain indented text, no icons / borders */}
      {expanded && (
        <div className="mt-0.5 flex flex-col">
          {sessions.length === 0 && (
            <p className="px-2 py-1 pl-9 text-[12.5px] text-muted-foreground/70">暂无会话</p>
          )}
          {sessions.map((s) => {
            const sessionActive = s.id === currentSessionId && active
            if (renameSessionId === s.id) {
              return (
                <form
                  key={s.id}
                  className="pl-9 pr-2 py-0.5"
                  onSubmit={(e) => {
                    e.preventDefault()
                    onCommitRename()
                  }}
                >
                  <Input
                    autoFocus
                    value={renameValue}
                    onChange={(e) => onRenameValue(e.target.value)}
                    onBlur={onCommitRename}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') {
                        e.preventDefault()
                        onCancelRename()
                      }
                    }}
                    className="h-7 rounded-md text-[12.5px]"
                  />
                </form>
              )
            }
            return (
              <div key={s.id} className="group/sess flex items-center">
                <button
                  type="button"
                  className={cn(
                    'titlebar-no-drag min-w-0 flex-1 truncate rounded-md py-1.5 pl-9 pr-2 text-left text-[13px] leading-snug transition-colors',
                    sessionActive
                      ? 'font-medium text-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                  onClick={() => onSelectSession(s.id)}
                  title={s.title}
                >
                  {s.title}
                </button>
                <button
                  type="button"
                  className="titlebar-no-drag hidden shrink-0 rounded p-1 group-hover/sess:inline-flex hover:bg-sidebar-accent"
                  title="重命名"
                  onClick={() => onStartRename(s)}
                >
                  <Pencil className="h-3 w-3 text-muted-foreground" />
                </button>
                <button
                  type="button"
                  className="titlebar-no-drag mr-1 hidden shrink-0 rounded p-1 group-hover/sess:inline-flex hover:bg-sidebar-accent"
                  title="删除会话"
                  onClick={() => onDeleteSession(s.id)}
                >
                  <Trash2 className="h-3 w-3 text-muted-foreground" />
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export function ProjectSessionTree() {
  const queryClient = useQueryClient()
  const currentProjectId = useWorkspaceStore((s) => s.currentProjectId)
  const currentSessionId = useWorkspaceStore((s) => s.currentSessionId)
  const setCurrentProjectId = useWorkspaceStore((s) => s.setCurrentProjectId)
  const setCurrentSessionId = useWorkspaceStore((s) => s.setCurrentSessionId)
  const resetSessionUi = useWorkspaceStore((s) => s.resetSessionUi)
  const setOpenFilePath = useUiStore((s) => s.setOpenFilePath)

  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [removeId, setRemoveId] = useState<string | null>(null)
  const [deleteSessionId, setDeleteSessionId] = useState<string | null>(null)
  const [renameSessionId, setRenameSessionId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: () => getApi().projects.list()
  })

  const { data: sessionsByProject = {} } = useQuery({
    queryKey: ['all-sessions', projects.map((p) => p.id).join(',')],
    queryFn: async () => {
      const map: Record<string, Session[]> = {}
      await Promise.all(
        projects.map(async (p) => {
          map[p.id] = await getApi().sessions.list(p.id)
        })
      )
      return map
    },
    enabled: projects.length > 0
  })

  useEffect(() => {
    if (currentProjectId) {
      setExpanded((prev) => ({ ...prev, [currentProjectId]: true }))
    }
  }, [currentProjectId])

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
      setCurrentSessionId(null)
      setOpenFilePath(null)
      setExpanded((prev) => ({ ...prev, [project.id]: true }))
      void getApi().files.watch(project.id)
    }
  })

  const removeMutation = useMutation({
    mutationFn: (id: string) => getApi().projects.remove(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['projects'] })
      void queryClient.invalidateQueries({ queryKey: ['all-sessions'] })
      if (removeId && removeId === currentProjectId) {
        setCurrentProjectId(null)
      }
      setRemoveId(null)
    }
  })

  const renameMutation = useMutation({
    mutationFn: ({ id, title }: { id: string; title: string }) =>
      getApi().sessions.rename(id, title),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['all-sessions'] })
      void queryClient.invalidateQueries({ queryKey: ['sessions', currentProjectId] })
      setRenameSessionId(null)
    }
  })

  const deleteSessionMutation = useMutation({
    mutationFn: (id: string) => getApi().sessions.delete(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['all-sessions'] })
      void queryClient.invalidateQueries({ queryKey: ['sessions', currentProjectId] })
      if (deleteSessionId === currentSessionId) {
        setCurrentSessionId(null)
      }
      setDeleteSessionId(null)
    }
  })

  const projectIds = useMemo(() => projects.map((p) => p.id), [projects])

  const createSessionMutation = useMutation({
    mutationFn: (projectId: string) => getApi().sessions.create(projectId),
    onSuccess: (session, projectId) => {
      void queryClient.invalidateQueries({ queryKey: ['all-sessions'] })
      void queryClient.invalidateQueries({ queryKey: ['sessions', projectId] })
      setCurrentProjectId(projectId)
      setCurrentSessionId(session.id)
      resetSessionUi()
      setExpanded((prev) => ({ ...prev, [projectId]: true }))
    }
  })

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Section label — Codex "项目" */}
      <div className="mb-1.5 flex items-center justify-between px-2">
        <span className="text-[12px] font-normal text-muted-foreground">项目</span>
        <button
          type="button"
          className="titlebar-no-drag rounded-md p-1 text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
          title="打开项目"
          onClick={() => openMutation.mutate()}
          disabled={openMutation.isPending}
        >
          <FolderPlus className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-1 pb-2">
        {isLoading && (
          <p className="px-2 py-2 text-[12px] text-muted-foreground">加载中…</p>
        )}
        {!isLoading && projects.length === 0 && (
          <button
            type="button"
            onClick={() => openMutation.mutate()}
            className="titlebar-no-drag flex w-full items-center gap-2 rounded-md border border-dashed border-border px-3 py-2.5 text-left text-[12.5px] text-muted-foreground hover:bg-sidebar-accent"
          >
            <FolderPlus className="h-4 w-4" />
            打开本地文件夹
          </button>
        )}
        {projects.map((p) => (
          <ProjectBranch
            key={p.id}
            project={p}
            expanded={expanded[p.id] ?? projectIds.indexOf(p.id) === 0}
            onToggle={() =>
              setExpanded((prev) => ({ ...prev, [p.id]: !(prev[p.id] ?? false) }))
            }
            sessions={sessionsByProject[p.id] ?? []}
            currentProjectId={currentProjectId}
            currentSessionId={currentSessionId}
            renameSessionId={renameSessionId}
            renameValue={renameValue}
            onRenameValue={setRenameValue}
            onStartRename={(s) => {
              setRenameSessionId(s.id)
              setRenameValue(s.title)
            }}
            onCommitRename={() => {
              if (renameSessionId && renameValue.trim()) {
                renameMutation.mutate({ id: renameSessionId, title: renameValue.trim() })
              } else {
                setRenameSessionId(null)
              }
            }}
            onCancelRename={() => setRenameSessionId(null)}
            onSelectProject={() => {
              setCurrentProjectId(p.id)
              setCurrentSessionId(null)
              setOpenFilePath(null)
              setExpanded((prev) => ({ ...prev, [p.id]: true }))
              void getApi().projects.touch(p.id)
              void getApi().files.watch(p.id)
            }}
            onSelectSession={(sessionId) => {
              if (currentProjectId !== p.id) {
                setCurrentProjectId(p.id)
                void getApi().files.watch(p.id)
              }
              setCurrentSessionId(sessionId)
              resetSessionUi()
            }}
            onRemoveProject={() => setRemoveId(p.id)}
            onDeleteSession={(id) => setDeleteSessionId(id)}
            onNewSession={() => createSessionMutation.mutate(p.id)}
          />
        ))}
      </div>

      <ConfirmDialog
        open={Boolean(removeId)}
        onOpenChange={(o) => !o && setRemoveId(null)}
        title="移除项目？"
        description="将从最近列表移除该项目，不会删除磁盘文件。相关会话也会从本地数据库删除。"
        confirmLabel="移除"
        destructive
        onConfirm={() => removeId && removeMutation.mutate(removeId)}
      />

      <ConfirmDialog
        open={Boolean(deleteSessionId)}
        onOpenChange={(o) => !o && setDeleteSessionId(null)}
        title="删除会话？"
        description="将永久删除该会话及其全部消息，此操作不可撤销。"
        confirmLabel="删除"
        destructive
        onConfirm={() => deleteSessionId && deleteSessionMutation.mutate(deleteSessionId)}
      />
    </div>
  )
}
