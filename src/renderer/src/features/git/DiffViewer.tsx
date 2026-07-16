import { DiffEditor } from '@monaco-editor/react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, RefreshCw, X } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { EmptyState } from '@/components/EmptyState'
import { ErrorState } from '@/components/ErrorState'
import { LoadingState } from '@/components/LoadingState'
import { getApi } from '@/lib/api'
import { cn } from '@/lib/utils'
import { useUiStore } from '@/stores/ui-store'
import { useWorkspaceStore } from '@/stores/workspace-store'
import type { GitFileStatus } from '@shared/types'

const statusLabel: Record<GitFileStatus['status'], string> = {
  modified: 'M',
  added: 'A',
  deleted: 'D',
  renamed: 'R',
  untracked: 'U',
  conflicted: 'C'
}

const statusColor: Record<GitFileStatus['status'], string> = {
  modified: 'text-amber-500',
  added: 'text-emerald-500',
  deleted: 'text-red-500',
  renamed: 'text-sky-500',
  untracked: 'text-emerald-500',
  conflicted: 'text-red-500'
}

export function DiffViewer() {
  const projectId = useWorkspaceStore((s) => s.currentProjectId)
  const diffFilePath = useUiStore((s) => s.diffFilePath)
  const setDiffFilePath = useUiStore((s) => s.setDiffFilePath)
  const queryClient = useQueryClient()
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const isDark = document.documentElement.classList.contains('dark')

  const {
    data: status,
    isLoading: statusLoading,
    error: statusError,
    refetch
  } = useQuery({
    queryKey: ['git-status', projectId],
    queryFn: () => getApi().git.status(projectId!),
    enabled: Boolean(projectId),
    refetchInterval: 8_000
  })

  const {
    data: diff,
    isLoading: diffLoading,
    error: diffError
  } = useQuery({
    queryKey: ['git-diff', projectId, diffFilePath],
    queryFn: () => getApi().git.diff(projectId!, diffFilePath!),
    enabled: Boolean(projectId && diffFilePath)
  })

  const discardMutation = useMutation({
    mutationFn: () => getApi().git.discard(projectId!, diffFilePath!),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['git-status', projectId] })
      void queryClient.invalidateQueries({ queryKey: ['git-diff', projectId, diffFilePath] })
      setConfirmDiscard(false)
    }
  })

  const acceptMutation = useMutation({
    mutationFn: async () => true
  })

  if (!projectId) {
    return <EmptyState title="无项目" description="打开项目以查看 Git 状态。" />
  }

  if (statusLoading) return <LoadingState label="加载 Git 状态…" />
  if (statusError) {
    return (
      <ErrorState message={(statusError as Error).message} onRetry={() => void refetch()} />
    )
  }

  if (!status?.isRepo) {
    return (
      <EmptyState
        title="不是 Git 仓库"
        description="在此项目中初始化 Git 后可查看变更与 Diff。"
      />
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-8 shrink-0 items-center justify-between border-b border-border px-2">
        <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          变更 {status.branch ? `· ${status.branch}` : ''}
        </span>
        <button
          type="button"
          className="rounded-md p-1 text-muted-foreground hover:bg-accent"
          onClick={() => void refetch()}
        >
          <RefreshCw className="h-3 w-3" />
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        <div className="max-h-[40%] overflow-y-auto border-b border-border">
          {status.files.length === 0 ? (
            <p className="px-2 py-3 text-[11px] text-muted-foreground">工作区干净</p>
          ) : (
            status.files.map((f) => (
              <button
                key={f.path}
                type="button"
                className={cn(
                  'flex w-full items-center gap-2 px-2 py-1 text-left text-[12px] hover:bg-accent',
                  diffFilePath === f.path && 'bg-accent'
                )}
                onClick={() => setDiffFilePath(f.path)}
              >
                <span className={cn('w-3 font-mono text-[11px] font-bold', statusColor[f.status])}>
                  {statusLabel[f.status]}
                </span>
                <span className="min-w-0 flex-1 truncate font-mono">{f.path}</span>
                {(f.insertions || f.deletions) && (
                  <span className="shrink-0 text-[11px]">
                    {f.insertions ? (
                      <span className="text-emerald-500">+{f.insertions}</span>
                    ) : null}{' '}
                    {f.deletions ? <span className="text-red-500">-{f.deletions}</span> : null}
                  </span>
                )}
              </button>
            ))
          )}
        </div>

        <div className="min-h-0 flex-1">
          {!diffFilePath ? (
            <EmptyState
              title="选择文件"
              description="选择已修改文件以查看 Diff。"
              className="min-h-[120px]"
            />
          ) : diffLoading ? (
            <LoadingState label="加载 Diff…" />
          ) : diffError ? (
            <ErrorState message={(diffError as Error).message} />
          ) : diff?.isBinary ? (
            <EmptyState title="二进制 Diff" description="二进制文件无法以文本 Diff 显示。" />
          ) : (
            <div className="flex h-full min-h-0 flex-col">
              <div className="flex h-8 shrink-0 items-center justify-between gap-2 border-b border-border px-2">
                <span className="truncate font-mono text-[11px] text-muted-foreground">
                  {diffFilePath}
                  {diff && (
                    <>
                      {' '}
                      <span className="text-emerald-500">+{diff.insertions}</span>{' '}
                      <span className="text-red-500">-{diff.deletions}</span>
                    </>
                  )}
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    title="接受 / 保留修改（第一阶段仅 UI）"
                    onClick={() => acceptMutation.mutate()}
                  >
                    <Check className="h-3 w-3" />
                    接受
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    title="拒绝 / 丢弃修改"
                    onClick={() => setConfirmDiscard(true)}
                  >
                    <X className="h-3 w-3" />
                    拒绝
                  </Button>
                </div>
              </div>
              <div className="min-h-0 flex-1">
                <DiffEditor
                  height="100%"
                  original={diff?.original ?? ''}
                  modified={diff?.modified ?? ''}
                  theme={isDark ? 'vs-dark' : 'light'}
                  options={{
                    readOnly: true,
                    renderSideBySide: true,
                    minimap: { enabled: false },
                    fontSize: 12,
                    automaticLayout: true,
                    scrollBeyondLastLine: false
                  }}
                  loading={<LoadingState label="加载 Diff 编辑器…" />}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirmDiscard}
        onOpenChange={setConfirmDiscard}
        title="丢弃修改？"
        description={`将永久丢弃「${diffFilePath}」的本地修改。未跟踪文件会被删除，此操作不可撤销。`}
        confirmLabel="丢弃"
        destructive
        onConfirm={() => discardMutation.mutate()}
      />
    </div>
  )
}
