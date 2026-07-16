import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronDown, ChevronRight, File, Folder, RefreshCw } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { FileTreeNode } from '@shared/types'
import { EmptyState } from '@/components/EmptyState'
import { ErrorState } from '@/components/ErrorState'
import { LoadingState } from '@/components/LoadingState'
import { getApi } from '@/lib/api'
import { cn } from '@/lib/utils'
import { useUiStore } from '@/stores/ui-store'
import { useWorkspaceStore } from '@/stores/workspace-store'

function TreeNode({
  node,
  depth,
  selected,
  onSelect
}: {
  node: FileTreeNode
  depth: number
  selected: string | null
  onSelect: (path: string) => void
}) {
  const [open, setOpen] = useState(depth < 1)

  if (node.isDirectory) {
    return (
      <div>
        <button
          type="button"
          className="flex w-full items-center gap-1 rounded-md px-1 py-0.5 text-left text-[12px] hover:bg-accent"
          style={{ paddingLeft: 6 + depth * 12 }}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? (
            <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
          )}
          <Folder className="h-3.5 w-3.5 shrink-0 text-sky-500/80" />
          <span className="truncate">{node.name}</span>
        </button>
        {open &&
          node.children?.map((child) => (
            <TreeNode
              key={child.relativePath}
              node={child}
              depth={depth + 1}
              selected={selected}
              onSelect={onSelect}
            />
          ))}
      </div>
    )
  }

  return (
    <button
      type="button"
      className={cn(
        'flex w-full items-center gap-1 rounded-md px-1 py-0.5 text-left text-[12px] hover:bg-accent',
        selected === node.relativePath && 'bg-accent'
      )}
      style={{ paddingLeft: 6 + depth * 12 + 14 }}
      onClick={() => onSelect(node.relativePath)}
      title={node.relativePath}
    >
      <File className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <span className="truncate">{node.name}</span>
    </button>
  )
}

export function FileExplorer() {
  const projectId = useWorkspaceStore((s) => s.currentProjectId)
  const openFilePath = useUiStore((s) => s.openFilePath)
  const setOpenFilePath = useUiStore((s) => s.setOpenFilePath)
  const queryClient = useQueryClient()

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['file-tree', projectId],
    queryFn: () => getApi().files.listTree(projectId!),
    enabled: Boolean(projectId)
  })

  useEffect(() => {
    if (!projectId) return
    const unsub = getApi().events.onFileChange((event) => {
      if (event.projectId === projectId) {
        void queryClient.invalidateQueries({ queryKey: ['file-tree', projectId] })
        if (event.relativePath === openFilePath && event.type === 'change') {
          void queryClient.invalidateQueries({
            queryKey: ['file-content', projectId, openFilePath]
          })
        }
      }
    })
    return unsub
  }, [projectId, openFilePath, queryClient])

  if (!projectId) {
    return <EmptyState title="无项目" description="打开项目后浏览文件。" />
  }

  if (isLoading) return <LoadingState label="加载文件…" />
  if (error) {
    return <ErrorState message={(error as Error).message} onRetry={() => void refetch()} />
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-8 shrink-0 items-center justify-between border-b border-border px-2">
        <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          资源管理器
        </span>
        <button
          type="button"
          className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
          onClick={() => void refetch()}
          title="刷新"
        >
          <RefreshCw className="h-3 w-3" />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto py-1">
        {(data ?? []).length === 0 ? (
          <p className="px-2 py-2 text-[11px] text-muted-foreground">空目录</p>
        ) : (
          data!.map((node) => (
            <TreeNode
              key={node.relativePath}
              node={node}
              depth={0}
              selected={openFilePath}
              onSelect={(path) => setOpenFilePath(path)}
            />
          ))
        )}
      </div>
    </div>
  )
}
