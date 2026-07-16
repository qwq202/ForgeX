import { create } from 'zustand'
import type { AgentStatus, ApprovalRequest, LogEntry, ProblemEntry } from '@shared/types'

interface WorkspaceState {
  currentProjectId: string | null
  currentSessionId: string | null
  agentStatus: AgentStatus
  streamingContent: string
  pendingApproval: ApprovalRequest | null
  logs: LogEntry[]
  problems: ProblemEntry[]

  setCurrentProjectId: (id: string | null) => void
  setCurrentSessionId: (id: string | null) => void
  setAgentStatus: (s: AgentStatus) => void
  setStreamingContent: (c: string) => void
  appendStreamingContent: (delta: string) => void
  setPendingApproval: (a: ApprovalRequest | null) => void
  pushLog: (entry: LogEntry) => void
  clearLogs: () => void
  setProblems: (p: ProblemEntry[]) => void
  addProblem: (p: ProblemEntry) => void
  resetSessionUi: () => void
}

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  currentProjectId: null,
  currentSessionId: null,
  agentStatus: 'idle',
  streamingContent: '',
  pendingApproval: null,
  logs: [],
  problems: [],

  setCurrentProjectId: (id) =>
    set({
      currentProjectId: id,
      currentSessionId: null,
      agentStatus: 'idle',
      streamingContent: '',
      pendingApproval: null
    }),
  setCurrentSessionId: (id) =>
    set({
      currentSessionId: id,
      agentStatus: 'idle',
      streamingContent: '',
      pendingApproval: null
    }),
  setAgentStatus: (s) => set({ agentStatus: s }),
  setStreamingContent: (c) => set({ streamingContent: c }),
  appendStreamingContent: (delta) =>
    set((state) => ({
      streamingContent: state.streamingContent
        ? state.streamingContent + '\n' + delta
        : delta
    })),
  setPendingApproval: (a) => set({ pendingApproval: a }),
  pushLog: (entry) =>
    set((state) => ({
      logs: [...state.logs.slice(-499), entry]
    })),
  clearLogs: () => set({ logs: [] }),
  setProblems: (p) => set({ problems: p }),
  addProblem: (p) => set((state) => ({ problems: [...state.problems, p] })),
  resetSessionUi: () =>
    set({
      agentStatus: 'idle',
      streamingContent: '',
      pendingApproval: null
    })
}))
