import Editor from '@monaco-editor/react'
import { useQuery } from '@tanstack/react-query'
import { FileWarning } from 'lucide-react'
import { ErrorState } from '@/components/ErrorState'
import { LoadingState } from '@/components/LoadingState'
import { EmptyState } from '@/components/EmptyState'
import { getApi } from '@/lib/api'
import { formatBytes } from '@/lib/utils'
import { useSettingsStore } from '@/stores/settings-store'
import { useUiStore } from '@/stores/ui-store'
import { useWorkspaceStore } from '@/stores/workspace-store'

export function FileViewer() {
  const projectId = useWorkspaceStore((s) => s.currentProjectId)
  const openFilePath = useUiStore((s) => s.openFilePath)
  const settings = useSettingsStore((s) => s.settings)
  const isDark = document.documentElement.classList.contains('dark')

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['file-content', projectId, openFilePath],
    queryFn: () => getApi().files.read(projectId!, openFilePath!),
    enabled: Boolean(projectId && openFilePath)
  })

  if (!openFilePath) {
    return (
      <EmptyState
        title="未选择文件"
        description="从资源管理器中选择文件以预览。"
        className="min-h-[200px]"
      />
    )
  }

  if (isLoading) return <LoadingState label="读取文件…" />
  if (error) {
    return <ErrorState message={(error as Error).message} onRetry={() => void refetch()} />
  }

  if (data?.isBinary) {
    return (
      <EmptyState
        icon={FileWarning}
        title="二进制文件"
        description={`${openFilePath}（${formatBytes(data.size)}）无法以文本预览。`}
        className="min-h-[200px]"
      />
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-8 shrink-0 items-center justify-between border-b border-border px-2 text-[11px] text-muted-foreground">
        <span className="truncate font-mono" title={openFilePath}>
          {openFilePath}
        </span>
        <span>
          {data?.language}
          {data?.truncated ? ' · 已截断' : ''}
          {data ? ` · ${formatBytes(data.size)}` : ''}
        </span>
      </div>
      <div className="min-h-0 flex-1">
        <Editor
          height="100%"
          language={data?.language ?? 'plaintext'}
          value={data?.content ?? ''}
          theme={isDark ? 'vs-dark' : 'light'}
          options={{
            readOnly: true,
            minimap: { enabled: false },
            fontSize: settings.editorFontSize,
            fontFamily: 'JetBrains Mono, SF Mono, Menlo, Monaco, Consolas, monospace',
            wordWrap: settings.editorWordWrap ? 'on' : 'off',
            lineNumbers: 'on',
            scrollBeyondLastLine: false,
            automaticLayout: true,
            renderLineHighlight: 'line',
            padding: { top: 8 },
            find: { addExtraSpaceOnTop: false }
          }}
          loading={<LoadingState label="加载编辑器…" />}
        />
      </div>
    </div>
  )
}
