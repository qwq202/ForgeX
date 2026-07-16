import {
  Bug,
  Code2,
  Compass,
  GitPullRequest,
  type LucideIcon
} from 'lucide-react'
import { cn } from '@/lib/utils'

export interface WelcomeAction {
  id: string
  title: string
  icon: LucideIcon
  iconClass: string
  prompt: string
}

const ACTIONS: WelcomeAction[] = [
  {
    id: 'explore',
    title: '探索并理解代码',
    icon: Compass,
    iconClass: 'text-sky-500',
    prompt: '请探索并理解这个项目的整体结构、主要模块和技术栈，用简洁的中文总结。'
  },
  {
    id: 'build',
    title: '构建新功能、应用或工具',
    icon: Code2,
    iconClass: 'text-blue-500',
    prompt: '我想在这个项目中构建新功能。请先了解现有代码，然后帮我规划并实现。'
  },
  {
    id: 'review',
    title: '审查代码并提出修改建议',
    icon: GitPullRequest,
    iconClass: 'text-emerald-500',
    prompt: '请审查当前项目的代码质量、潜在问题，并提出具体可落地的修改建议。'
  },
  {
    id: 'fix',
    title: '修复问题和失败',
    icon: Bug,
    iconClass: 'text-orange-500',
    prompt: '请帮助排查并修复项目中的问题、错误或失败用例。'
  }
]

interface ChatWelcomeProps {
  projectName?: string | null
  onAction: (prompt: string) => void
  className?: string
}

export function ChatWelcome({ projectName, onAction, className }: ChatWelcomeProps) {
  const name = projectName?.trim() || '这个项目'

  return (
    <div
      className={cn(
        'flex h-full flex-col items-center justify-center px-6 pb-28 pt-10',
        className
      )}
    >
      <div className="mb-8 flex h-12 w-12 items-center justify-center rounded-2xl bg-muted/60 text-muted-foreground">
        <span className="text-2xl leading-none opacity-50">✦</span>
      </div>

      <h1 className="mb-8 max-w-xl text-center text-[22px] font-medium tracking-tight text-foreground sm:text-[26px]">
        我们应该在{' '}
        <span className="underline decoration-border decoration-2 underline-offset-4">
          {name}
        </span>{' '}
        中构建什么？
      </h1>

      <div className="grid w-full max-w-2xl grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {ACTIONS.map((action) => {
          const Icon = action.icon
          return (
            <button
              key={action.id}
              type="button"
              onClick={() => onAction(action.prompt)}
              className="flex min-h-[108px] flex-col items-start gap-3 rounded-2xl border border-border/80 bg-card px-4 py-4 text-left shadow-sm transition-all hover:border-border hover:shadow-md active:scale-[0.99]"
            >
              <Icon className={cn('h-5 w-5', action.iconClass)} strokeWidth={1.75} />
              <span className="text-[13px] font-medium leading-snug text-foreground">
                {action.title}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export { ACTIONS as WELCOME_ACTIONS }
