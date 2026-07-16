import { Bot, User } from 'lucide-react'
import type { Message, ToolCall } from '@shared/types'
import { cn } from '@/lib/utils'
import { MarkdownView } from './MarkdownView'
import { ToolCallCard } from './ToolCallCard'

interface MessageItemProps {
  message: Message
  toolCalls?: ToolCall[]
}

export function MessageItem({ message, toolCalls = [] }: MessageItemProps) {
  const isUser = message.role === 'user'
  const isAssistant = message.role === 'assistant'

  return (
    <div className={cn('flex gap-3 px-4 py-4', isUser ? '' : '')}>
      <div
        className={cn(
          'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
          isUser ? 'bg-muted' : 'bg-foreground/5 ring-1 ring-border'
        )}
      >
        {isUser ? (
          <User className="h-3.5 w-3.5 text-muted-foreground" />
        ) : (
          <Bot className="h-3.5 w-3.5 text-foreground/70" />
        )}
      </div>
      <div className="min-w-0 flex-1 pt-0.5">
        <div className="mb-1.5 flex items-center gap-2">
          <span className="text-[13px] font-medium">
            {isUser ? '你' : isAssistant ? 'Grok Build' : message.role}
          </span>
          {message.status === 'streaming' && (
            <span className="text-[11px] text-sky-500">生成中…</span>
          )}
          {message.status === 'error' && (
            <span className="text-[11px] text-red-500">错误</span>
          )}
          {message.status === 'cancelled' && (
            <span className="text-[11px] text-muted-foreground">已取消</span>
          )}
        </div>
        {message.content ? (
          isUser ? (
            <p className="whitespace-pre-wrap text-[14px] leading-relaxed text-foreground">
              {message.content}
            </p>
          ) : (
            <MarkdownView content={message.content} className="text-[14px]" />
          )
        ) : message.status === 'streaming' ? (
          <span className="inline-flex gap-1 text-muted-foreground">
            <span className="animate-pulse">●</span>
            <span className="animate-pulse delay-75">●</span>
            <span className="animate-pulse delay-150">●</span>
          </span>
        ) : null}
        {toolCalls.map((tc) => (
          <ToolCallCard key={tc.id} toolCall={tc} />
        ))}
      </div>
    </div>
  )
}
