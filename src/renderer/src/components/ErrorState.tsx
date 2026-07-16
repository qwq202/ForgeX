import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface ErrorStateProps {
  title?: string
  message: string
  onRetry?: () => void
  className?: string
}

export function ErrorState({
  title = 'Something went wrong',
  message,
  onRetry,
  className
}: ErrorStateProps) {
  return (
    <div
      className={cn(
        'flex h-full min-h-[120px] flex-col items-center justify-center gap-2 px-4 text-center',
        className
      )}
    >
      <AlertTriangle className="h-5 w-5 text-destructive" />
      <p className="text-sm font-medium">{title}</p>
      <p className="max-w-md text-xs text-muted-foreground">{message}</p>
      {onRetry && (
        <Button size="sm" variant="outline" onClick={onRetry} className="mt-1">
          Retry
        </Button>
      )}
    </div>
  )
}
