import { ChevronDown, ChevronRight, Loader2, Wrench } from 'lucide-react'
import { useState } from 'react'
import type { ToolCall } from '@shared/types'
import { cn } from '@/lib/utils'

interface ToolCallCardProps {
  toolCall: ToolCall
}

const statusStyles: Record<string, string> = {
  pending: 'text-muted-foreground',
  running: 'text-sky-500',
  awaiting_approval: 'text-amber-500',
  approved: 'text-emerald-500',
  rejected: 'text-red-500',
  completed: 'text-emerald-500',
  error: 'text-red-500'
}

const statusLabel: Record<string, string> = {
  pending: '等待中',
  running: '运行中',
  awaiting_approval: '待审批',
  approved: '已批准',
  rejected: '已拒绝',
  completed: '已完成',
  error: '错误'
}

export function ToolCallCard({ toolCall }: ToolCallCardProps) {
  const [open, setOpen] = useState(toolCall.status === 'running' || toolCall.status === 'error')

  return (
    <div className="my-2 overflow-hidden rounded-xl border border-border bg-card/60">
      <button
        type="button"
        className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-xs hover:bg-muted/40"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? (
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
        )}
        <Wrench className="h-3.5 w-3.5 text-violet-400" />
        <span className="font-medium font-mono">{toolCall.name}</span>
        <span className={cn('ml-auto text-[11px]', statusStyles[toolCall.status])}>
          {toolCall.status === 'running' && (
            <Loader2 className="mr-1 inline h-3 w-3 animate-spin" />
          )}
          {statusLabel[toolCall.status] ?? toolCall.status}
        </span>
      </button>
      {open && (
        <div className="space-y-2 border-t border-border px-2.5 py-2">
          <div>
            <div className="mb-1 text-[11px] font-medium uppercase text-muted-foreground">
              参数
            </div>
            <pre className="max-h-40 overflow-auto rounded-lg bg-muted/40 p-2 font-mono text-[11px] leading-relaxed">
              {pretty(toolCall.arguments)}
            </pre>
          </div>
          {toolCall.result != null && toolCall.result !== '' && (
            <div>
              <div className="mb-1 text-[11px] font-medium uppercase text-muted-foreground">
                结果
              </div>
              <pre className="max-h-48 overflow-auto rounded-lg bg-muted/40 p-2 font-mono text-[11px] leading-relaxed">
                {toolCall.result}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function pretty(raw: string): string {
  try {
    return JSON.stringify(JSON.parse(raw), null, 2)
  } catch {
    return raw
  }
}
