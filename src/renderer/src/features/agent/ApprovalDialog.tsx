import { useMutation } from '@tanstack/react-query'
import { AlertTriangle, ShieldAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { getApi } from '@/lib/api'
import { useWorkspaceStore } from '@/stores/workspace-store'
import { cn } from '@/lib/utils'

const riskLabel = {
  low: '低风险',
  medium: '中风险',
  high: '高风险'
} as const

const riskClass = {
  low: 'text-emerald-600 bg-emerald-500/10',
  medium: 'text-amber-600 bg-amber-500/10',
  high: 'text-red-600 bg-red-500/10'
} as const

export function ApprovalDialog() {
  const pending = useWorkspaceStore((s) => s.pendingApproval)
  const setPending = useWorkspaceStore((s) => s.setPendingApproval)

  const respond = useMutation({
    mutationFn: async (approved: boolean) => {
      if (!pending) return
      await getApi().agent.respondApproval(pending.id, approved)
    },
    onSuccess: () => setPending(null),
    onError: () => setPending(null)
  })

  return (
    <Dialog open={Boolean(pending)} onOpenChange={(o) => !o && setPending(null)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-amber-500" />
            需要你的审批
          </DialogTitle>
          <DialogDescription>
            Agent 请求执行可能影响系统的操作，请确认是否允许。
          </DialogDescription>
        </DialogHeader>

        {pending && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  'rounded-full px-2 py-0.5 text-[11px] font-medium',
                  riskClass[pending.risk]
                )}
              >
                {riskLabel[pending.risk]}
              </span>
              <span className="text-[12px] text-muted-foreground">{pending.description}</span>
            </div>
            <div className="rounded-xl border border-border bg-muted/40 p-3">
              <div className="mb-1 flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                <AlertTriangle className="h-3 w-3" />
                命令 / 参数
              </div>
              <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-all font-mono text-[12px] leading-relaxed">
                {pending.command || '（无命令详情）'}
              </pre>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            variant="outline"
            disabled={respond.isPending}
            onClick={() => respond.mutate(false)}
          >
            拒绝
          </Button>
          <Button disabled={respond.isPending} onClick={() => respond.mutate(true)}>
            允许执行
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
