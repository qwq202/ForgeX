import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FolderOpen, Play, Power } from 'lucide-react'
import { useEffect, useMemo, useRef } from 'react'
import { EmptyState } from '@/components/EmptyState'
import { LoadingState } from '@/components/LoadingState'
import { getApi } from '@/lib/api'
import { useWorkspaceStore } from '@/stores/workspace-store'
import { ChatWelcome } from './ChatWelcome'
import { MessageItem } from './MessageItem'
import { PromptInput } from './PromptInput'
import type { Message } from '@shared/types'

export function ChatPanel() {
  const queryClient = useQueryClient()
  const projectId = useWorkspaceStore((s) => s.currentProjectId)
  const sessionId = useWorkspaceStore((s) => s.currentSessionId)
  const agentStatus = useWorkspaceStore((s) => s.agentStatus)
  const streamingContent = useWorkspaceStore((s) => s.streamingContent)
  const setCurrentSessionId = useWorkspaceStore((s) => s.setCurrentSessionId)
  const setAgentStatus = useWorkspaceStore((s) => s.setAgentStatus)
  const setStreamingContent = useWorkspaceStore((s) => s.setStreamingContent)
  const appendStreamingContent = useWorkspaceStore((s) => s.appendStreamingContent)
  const setPendingApproval = useWorkspaceStore((s) => s.setPendingApproval)
  const resetSessionUi = useWorkspaceStore((s) => s.resetSessionUi)
  const scrollRef = useRef<HTMLDivElement>(null)

  const { data: projects } = useQuery({
    queryKey: ['projects'],
    queryFn: () => getApi().projects.list()
  })
  const project = projects?.find((p) => p.id === projectId)

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ['messages', sessionId],
    queryFn: () => getApi().messages.list(sessionId!),
    enabled: Boolean(sessionId)
  })

  const { data: toolCalls = [] } = useQuery({
    queryKey: ['tool-calls', sessionId],
    queryFn: () => getApi().messages.listToolCalls(sessionId!),
    enabled: Boolean(sessionId)
  })

  const toolsByMessage = useMemo(() => {
    const map = new Map<string, typeof toolCalls>()
    for (const tc of toolCalls) {
      const list = map.get(tc.messageId) ?? []
      list.push(tc)
      map.set(tc.messageId, list)
    }
    return map
  }, [toolCalls])

  useEffect(() => {
    if (!sessionId) return
    const unsub = getApi().events.onAgent((event) => {
      if (event.sessionId !== sessionId) return
      if (event.type === 'status' && typeof event.data.status === 'string') {
        setAgentStatus(event.data.status as never)
      }
      if (event.type === 'message_delta') {
        const acc = event.data.accumulated
        if (typeof acc === 'string') setStreamingContent(acc)
        else if (typeof event.data.content === 'string')
          appendStreamingContent(String(event.data.content))
      }
      if (event.type === 'message_complete') {
        setStreamingContent('')
        void queryClient.invalidateQueries({ queryKey: ['messages', sessionId] })
        void queryClient.invalidateQueries({ queryKey: ['tool-calls', sessionId] })
      }
      if (
        event.type === 'tool_call_start' ||
        event.type === 'tool_call_end' ||
        event.type === 'tool_call_update'
      ) {
        void queryClient.invalidateQueries({ queryKey: ['tool-calls', sessionId] })
        void queryClient.invalidateQueries({ queryKey: ['messages', sessionId] })
      }
      if (event.type === 'exit' || event.type === 'error') {
        void queryClient.invalidateQueries({ queryKey: ['messages', sessionId] })
        void queryClient.invalidateQueries({ queryKey: ['sessions', projectId] })
        void queryClient.invalidateQueries({ queryKey: ['all-sessions'] })
      }
    })
    const unsubAppr = getApi().events.onApproval((req) => {
      if (req.sessionId === sessionId) setPendingApproval(req)
    })
    return () => {
      unsub()
      unsubAppr()
    }
  }, [
    sessionId,
    projectId,
    queryClient,
    setAgentStatus,
    setStreamingContent,
    appendStreamingContent,
    setPendingApproval
  ])

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, streamingContent])

  const ensureSession = async (): Promise<string> => {
    if (sessionId) return sessionId
    if (!projectId) throw new Error('No project selected')
    const session = await getApi().sessions.create(projectId, `会话 ${new Date().toLocaleString()}`)
    void queryClient.invalidateQueries({ queryKey: ['sessions', projectId] })
    void queryClient.invalidateQueries({ queryKey: ['all-sessions'] })
    setCurrentSessionId(session.id)
    resetSessionUi()
    return session.id
  }

  const sendMutation = useMutation({
    mutationFn: async (content: string) => {
      const sid = await ensureSession()

      // Optimistic user bubble — cancel in-flight list so empty fetch won't wipe it
      await queryClient.cancelQueries({ queryKey: ['messages', sid] })
      const optimistic: Message = {
        id: `opt_${Date.now()}`,
        sessionId: sid,
        role: 'user',
        content,
        status: 'completed',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
      queryClient.setQueryData<Message[]>(['messages', sid], (old) => [
        ...(old ?? []),
        optimistic
      ])

      if (agentStatus === 'idle' || agentStatus === 'stopped' || agentStatus === 'error') {
        try {
          await getApi().agent.start(sid, projectId!)
          setAgentStatus('running')
        } catch {
          await getApi().messages.create({
            sessionId: sid,
            role: 'user',
            content,
            status: 'completed'
          })
          await getApi().messages.create({
            sessionId: sid,
            role: 'assistant',
            content:
              '**Grok Build CLI 不可用。**\n\n请在设置中配置可执行文件路径，然后重新发送。\n\n你的消息已保存到会话。',
            status: 'error'
          })
          await queryClient.invalidateQueries({ queryKey: ['messages', sid] })
          return
        }
      }
      await getApi().agent.sendMessage(sid, content)
      await queryClient.invalidateQueries({ queryKey: ['messages', sid] })
      void queryClient.invalidateQueries({ queryKey: ['sessions', projectId] })
      void queryClient.invalidateQueries({ queryKey: ['all-sessions'] })
    }
  })

  const startMutation = useMutation({
    mutationFn: async () => {
      const sid = await ensureSession()
      return getApi().agent.start(sid, projectId!)
    },
    onSuccess: (state) => setAgentStatus(state.status),
    onError: () => setAgentStatus('error')
  })

  const stopMutation = useMutation({
    mutationFn: async () => {
      if (!sessionId) return
      await getApi().agent.stop(sessionId)
    },
    onSuccess: () => setAgentStatus('stopped')
  })

  const isRunning = [
    'starting',
    'running',
    'streaming',
    'tool_calling',
    'waiting_approval'
  ].includes(agentStatus)

  const handleSend = async (content: string) => {
    await sendMutation.mutateAsync(content)
  }

  if (!projectId) {
    return (
      <div className="relative flex h-full min-h-0 flex-col bg-background">
        <div className="flex flex-1 flex-col items-center justify-center px-6 pb-24">
          <EmptyState
            icon={FolderOpen}
            title="打开一个项目开始"
            description="从左侧打开本地文件夹，即可在 ForgeX 中与 Grok Build 协作。"
            className="min-h-0"
            action={
              <button
                type="button"
                className="rounded-full bg-primary px-4 py-2 text-[13px] font-medium text-primary-foreground hover:opacity-90"
                onClick={() =>
                  void getApi()
                    .projects.openDirectory()
                    .then(async (path) => {
                      if (!path) return
                      const p = await getApi().projects.add(path)
                      useWorkspaceStore.getState().setCurrentProjectId(p.id)
                      void queryClient.invalidateQueries({ queryKey: ['projects'] })
                      void getApi().files.watch(p.id)
                    })
                }
              >
                打开项目
              </button>
            }
          />
        </div>
      </div>
    )
  }

  const streamingMessage: Message | null = streamingContent
    ? {
        id: 'streaming',
        sessionId: sessionId ?? 'pending',
        role: 'assistant',
        content: streamingContent,
        status: 'streaming',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    : null

  const showWelcome =
    (!sessionId || (!isLoading && messages.length === 0)) &&
    !streamingMessage &&
    !sendMutation.isPending

  return (
    <div className="relative flex h-full min-h-0 flex-col bg-background">
      <div className="absolute right-3 top-3 z-10 flex items-center gap-1">
        {sessionId && (
          <>
            <span className="mr-1 rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
              {statusLabel(agentStatus)}
            </span>
            {!isRunning ? (
              <button
                type="button"
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                title="启动 Agent"
                onClick={() => startMutation.mutate()}
              >
                <Play className="h-3.5 w-3.5" />
              </button>
            ) : (
              <button
                type="button"
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                title="停止 Agent"
                onClick={() => stopMutation.mutate()}
              >
                <Power className="h-3.5 w-3.5" />
              </button>
            )}
          </>
        )}
      </div>

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
        {sessionId && isLoading ? (
          <LoadingState label="加载消息…" className="pt-24" />
        ) : showWelcome ? (
          <ChatWelcome
            projectName={project?.name}
            onAction={(prompt) => void handleSend(prompt)}
          />
        ) : (
          <div className="mx-auto max-w-3xl px-2 pb-36 pt-4">
            {messages.map((m) => (
              <MessageItem key={m.id} message={m} toolCalls={toolsByMessage.get(m.id)} />
            ))}
            {streamingMessage && <MessageItem message={streamingMessage} />}
          </div>
        )}
      </div>

      <PromptInput
        floating
        projectName={project?.name}
        disabled={sendMutation.isPending}
        isRunning={agentStatus === 'streaming' || agentStatus === 'tool_calling'}
        onSend={handleSend}
        onStop={async () => {
          if (!sessionId) return
          await getApi().agent.cancel(sessionId)
          setStreamingContent('')
          setAgentStatus('running')
          void queryClient.invalidateQueries({ queryKey: ['messages', sessionId] })
        }}
      />
    </div>
  )
}

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    idle: '空闲',
    starting: '启动中',
    running: '运行中',
    streaming: '生成中',
    tool_calling: '工具调用',
    waiting_approval: '等待审批',
    stopping: '停止中',
    error: '错误',
    stopped: '已停止'
  }
  return map[status] ?? status
}
