import { useQuery } from '@tanstack/react-query'
import {
  ArrowUp,
  Folder,
  GitBranch,
  HardDrive,
  Loader2,
  Plus,
  Square
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { getApi } from '@/lib/api'
import { cn } from '@/lib/utils'
import { useWorkspaceStore } from '@/stores/workspace-store'

interface PromptInputProps {
  disabled?: boolean
  isRunning?: boolean
  projectName?: string | null
  initialValue?: string
  onSend: (content: string) => void | Promise<void>
  onStop?: () => void | Promise<void>
  placeholder?: string
  floating?: boolean
}

export function PromptInput({
  disabled,
  isRunning,
  projectName,
  initialValue = '',
  onSend,
  onStop,
  placeholder = '随心输入',
  floating = true
}: PromptInputProps) {
  const [value, setValue] = useState(initialValue)
  const [sending, setSending] = useState(false)
  const projectId = useWorkspaceStore((s) => s.currentProjectId)

  useEffect(() => {
    if (initialValue) setValue(initialValue)
  }, [initialValue])

  const { data: git } = useQuery({
    queryKey: ['git-status', projectId],
    queryFn: () => getApi().git.status(projectId!),
    enabled: Boolean(projectId),
    staleTime: 15_000
  })

  const submit = useCallback(async () => {
    const content = value.trim()
    if (!content || disabled || sending) return
    setSending(true)
    try {
      await onSend(content)
      setValue('')
    } finally {
      setSending(false)
    }
  }, [value, disabled, sending, onSend])

  const composer = (
    <div className="w-full max-w-2xl">
      {/* Context chips */}
      {(projectName || git?.branch) && (
        <div className="mb-2 flex flex-wrap items-center justify-center gap-1.5">
          {projectName && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border/80 bg-card px-2.5 py-1 text-[11px] text-muted-foreground shadow-sm">
              <Folder className="h-3 w-3" />
              {projectName}
            </span>
          )}
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border/80 bg-card px-2.5 py-1 text-[11px] text-muted-foreground shadow-sm">
            <HardDrive className="h-3 w-3" />
            本地
          </span>
          {git?.isRepo && git.branch && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border/80 bg-card px-2.5 py-1 text-[11px] text-muted-foreground shadow-sm">
              <GitBranch className="h-3 w-3" />
              {git.branch}
            </span>
          )}
        </div>
      )}

      <div
        className={cn(
          'rounded-[22px] bg-card composer-shadow transition-shadow focus-within:ring-1 focus-within:ring-ring/30',
          floating && 'bg-card/95 backdrop-blur-sm'
        )}
      >
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          disabled={disabled || sending}
          rows={1}
          className={cn(
            'max-h-[180px] min-h-[52px] w-full resize-none bg-transparent px-4 pt-3.5 pb-2 text-[14px] leading-relaxed',
            'placeholder:text-muted-foreground/70 focus:outline-none disabled:opacity-50'
          )}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              void submit()
            }
          }}
          onInput={(e) => {
            const el = e.currentTarget
            el.style.height = 'auto'
            el.style.height = `${Math.min(el.scrollHeight, 180)}px`
          }}
        />

        <div className="flex items-center justify-between gap-2 px-2.5 pb-2.5">
          <div className="flex items-center gap-1">
            <button
              type="button"
              className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
              title="附件（即将推出）"
              disabled
            >
              <Plus className="h-4 w-4" />
            </button>
            <span className="hidden text-[11px] text-muted-foreground sm:inline">
              Enter 发送 · Shift+Enter 换行
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {isRunning && onStop ? (
              <button
                type="button"
                onClick={() => void onStop()}
                className="flex h-8 items-center gap-1.5 rounded-full bg-destructive px-3 text-[12px] font-medium text-destructive-foreground hover:bg-destructive/90"
              >
                <Square className="h-3 w-3 fill-current" />
                停止
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void submit()}
                disabled={disabled || sending || !value.trim()}
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-full transition-colors',
                  value.trim() && !disabled && !sending
                    ? 'bg-primary text-primary-foreground hover:opacity-90'
                    : 'bg-muted text-muted-foreground'
                )}
                title="发送"
              >
                {sending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ArrowUp className="h-4 w-4" strokeWidth={2.25} />
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )

  if (floating) {
    return (
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex justify-center px-4 pb-5 pt-16 bg-gradient-to-t from-background via-background/95 to-transparent">
        <div className="pointer-events-auto w-full flex justify-center">{composer}</div>
      </div>
    )
  }

  return <div className="flex justify-center border-t border-border bg-background p-4">{composer}</div>
}
