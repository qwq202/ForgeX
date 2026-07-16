import { z } from 'zod'

export const projectIdSchema = z.string().min(1)
export const sessionIdSchema = z.string().min(1)
export const messageIdSchema = z.string().min(1)
export const terminalIdSchema = z.string().min(1)

export const openDirectorySchema = z.object({
  defaultPath: z.string().optional()
})

export const addProjectSchema = z.object({
  path: z.string().min(1)
})

export const removeProjectSchema = z.object({
  projectId: projectIdSchema
})

export const createSessionSchema = z.object({
  projectId: projectIdSchema,
  title: z.string().optional()
})

export const renameSessionSchema = z.object({
  sessionId: sessionIdSchema,
  title: z.string().min(1).max(200)
})

export const deleteSessionSchema = z.object({
  sessionId: sessionIdSchema
})

export const listSessionsSchema = z.object({
  projectId: projectIdSchema
})

export const listMessagesSchema = z.object({
  sessionId: sessionIdSchema
})

export const createMessageSchema = z.object({
  sessionId: sessionIdSchema,
  role: z.enum(['user', 'assistant', 'system', 'tool']),
  content: z.string(),
  status: z.enum(['pending', 'streaming', 'completed', 'error', 'cancelled']).optional(),
  metadata: z.record(z.unknown()).optional()
})

export const updateMessageSchema = z.object({
  messageId: messageIdSchema,
  content: z.string().optional(),
  status: z.enum(['pending', 'streaming', 'completed', 'error', 'cancelled']).optional(),
  metadata: z.record(z.unknown()).optional()
})

export const readFileSchema = z.object({
  projectId: projectIdSchema,
  relativePath: z.string().min(1),
  maxBytes: z.number().int().positive().optional()
})

export const listFilesSchema = z.object({
  projectId: projectIdSchema,
  relativePath: z.string().optional()
})

export const watchFilesSchema = z.object({
  projectId: projectIdSchema
})

export const gitStatusSchema = z.object({
  projectId: projectIdSchema
})

export const gitDiffSchema = z.object({
  projectId: projectIdSchema,
  relativePath: z.string().min(1)
})

export const terminalCreateSchema = z.object({
  projectId: projectIdSchema,
  cols: z.number().int().positive().optional(),
  rows: z.number().int().positive().optional()
})

export const terminalWriteSchema = z.object({
  terminalId: terminalIdSchema,
  data: z.string()
})

export const terminalResizeSchema = z.object({
  terminalId: terminalIdSchema,
  cols: z.number().int().positive(),
  rows: z.number().int().positive()
})

export const terminalDisposeSchema = z.object({
  terminalId: terminalIdSchema
})

export const agentStartSchema = z.object({
  sessionId: sessionIdSchema,
  projectId: projectIdSchema
})

export const agentSendMessageSchema = z.object({
  sessionId: sessionIdSchema,
  content: z.string().min(1)
})

export const agentCancelSchema = z.object({
  sessionId: sessionIdSchema
})

export const agentStopSchema = z.object({
  sessionId: sessionIdSchema
})

export const agentRestartSchema = z.object({
  sessionId: sessionIdSchema,
  projectId: projectIdSchema
})

export const approvalRespondSchema = z.object({
  approvalId: z.string().min(1),
  approved: z.boolean()
})

export const updateSettingsSchema = z
  .object({
    grokBuildPath: z.string().optional(),
    defaultShell: z.string().optional(),
    defaultProjectDir: z.string().optional(),
    theme: z.enum(['light', 'dark', 'system']).optional(),
    fontSize: z.number().int().min(10).max(24).optional(),
    terminalFontSize: z.number().int().min(10).max(24).optional(),
    autoRestoreProject: z.boolean().optional(),
    autoRestoreSession: z.boolean().optional(),
    showVerboseLogs: z.boolean().optional(),
    editorWordWrap: z.boolean().optional(),
    editorFontSize: z.number().int().min(10).max(24).optional()
  })
  .strict()

export const openExternalSchema = z.object({
  url: z.string().url()
})
