import { spawn, type ChildProcessWithoutNullStreams } from 'child_process'
import { createInterface } from 'readline'
import type { AgentEvent, AgentStatus } from '@shared/types'
import { createId } from '@shared/utils/id'
import type { AgentConnectionOptions, AgentTransport } from './types'
import { logger } from '../logger'

type Listener = (event: AgentEvent) => void

/**
 * Stdio-based transport for Grok Build CLI.
 *
 * Protocol (MVP best-effort):
 * - Spawn CLI with project cwd
 * - Send user messages as stdin lines (JSON or plain text)
 * - Parse stdout lines as events when JSON, otherwise as message deltas
 *
 * This can be replaced with a formal ACP client when protocol docs are available.
 */
export class StdioAgentTransport implements AgentTransport {
  private process: ChildProcessWithoutNullStreams | null = null
  private status: AgentStatus = 'idle'
  private listeners = new Set<Listener>()
  private options: AgentConnectionOptions | null = null
  private restartCount = 0
  private intentionalStop = false
  private stdoutBuffer = ''

  async connect(options: AgentConnectionOptions): Promise<void> {
    if (this.process) {
      await this.disconnect()
    }

    this.options = options
    this.intentionalStop = false
    this.setStatus('starting')

    const args = options.args ?? []
    logger.info(
      'agent',
      `Starting Grok Build: ${options.executablePath} ${args.join(' ')} cwd=${options.cwd}`
    )

    const child = spawn(options.executablePath, args, {
      cwd: options.cwd,
      env: {
        ...process.env,
        ...options.env,
        // Force line-buffered-ish behavior where possible
        PYTHONUNBUFFERED: '1',
        FORCE_COLOR: '0'
      },
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true
    })

    this.process = child
    this.setStatus('running')
    this.emit({
      type: 'status',
      sessionId: options.sessionId,
      timestamp: new Date().toISOString(),
      data: { status: 'running', pid: child.pid ?? null }
    })

    const rlOut = createInterface({ input: child.stdout })
    const rlErr = createInterface({ input: child.stderr })

    rlOut.on('line', (line) => this.handleStdoutLine(line))
    rlErr.on('line', (line) => {
      logger.debug('agent', `stderr: ${line}`)
      this.emit({
        type: 'stderr',
        sessionId: options.sessionId,
        timestamp: new Date().toISOString(),
        data: { line }
      })
    })

    child.on('error', (err) => {
      logger.error('agent', `Process error: ${err.message}`)
      this.setStatus('error')
      this.emit({
        type: 'error',
        sessionId: options.sessionId,
        timestamp: new Date().toISOString(),
        data: { message: err.message }
      })
    })

    child.on('close', (code, signal) => {
      logger.info('agent', `Process exited code=${code} signal=${signal}`)
      this.process = null
      this.emit({
        type: 'exit',
        sessionId: options.sessionId,
        timestamp: new Date().toISOString(),
        data: { code, signal }
      })

      if (!this.intentionalStop && options.autoRestart && this.restartCount < 3) {
        this.restartCount++
        logger.info('agent', `Auto-restart attempt ${this.restartCount}`)
        void this.connect(options)
        return
      }

      this.setStatus(this.intentionalStop ? 'stopped' : 'error')
    })
  }

  private handleStdoutLine(line: string): void {
    if (!this.options) return
    const sessionId = this.options.sessionId
    const timestamp = new Date().toISOString()

    this.emit({
      type: 'stdout',
      sessionId,
      timestamp,
      data: { line }
    })

    // Try JSON event protocol first
    const trimmed = line.trim()
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        const parsed = JSON.parse(trimmed) as Record<string, unknown>
        const type = String(parsed.type ?? 'message_delta') as AgentEvent['type']
        this.emit({
          type,
          sessionId,
          timestamp,
          data: parsed
        })

        if (type === 'message_delta' || type === 'message_complete') {
          this.setStatus(type === 'message_complete' ? 'running' : 'streaming')
        } else if (type === 'tool_call_start' || type === 'tool_call_update') {
          this.setStatus('tool_calling')
        } else if (type === 'approval_required') {
          this.setStatus('waiting_approval')
        }
        return
      } catch {
        // fall through to plain text
      }
    }

    // Plain text → stream as assistant message delta
    this.setStatus('streaming')
    this.stdoutBuffer += (this.stdoutBuffer ? '\n' : '') + line
    this.emit({
      type: 'message_delta',
      sessionId,
      timestamp,
      data: {
        content: line,
        accumulated: this.stdoutBuffer
      }
    })
  }

  async sendMessage(message: string): Promise<void> {
    if (!this.process?.stdin.writable) {
      throw new Error('Agent process is not connected')
    }
    this.stdoutBuffer = ''
    this.setStatus('streaming')

    // Prefer JSON line protocol; CLI may also accept plain text
    const payload = JSON.stringify({
      type: 'user_message',
      id: createId('um'),
      content: message,
      timestamp: new Date().toISOString()
    })

    this.process.stdin.write(payload + '\n')
    // Also write plain text for CLIs that don't speak JSON yet
    // Some CLIs only accept interactive text — dual-write may confuse them.
    // Prefer JSON only; if needed, settings can switch mode later.
    logger.debug('agent', `Sent message (${message.length} chars)`)
  }

  async cancel(): Promise<void> {
    if (!this.process) return
    // Send interrupt signal / cancel frame
    try {
      if (this.process.stdin.writable) {
        this.process.stdin.write(
          JSON.stringify({ type: 'cancel', timestamp: new Date().toISOString() }) + '\n'
        )
      }
    } catch {
      // ignore
    }
    if (process.platform === 'win32') {
      // no SIGINT equivalent easily — leave process running until stop
    } else if (this.process.pid) {
      try {
        process.kill(this.process.pid, 'SIGINT')
      } catch {
        // ignore
      }
    }
    this.setStatus('running')
  }

  async disconnect(): Promise<void> {
    this.intentionalStop = true
    this.setStatus('stopping')
    const child = this.process
    if (!child) {
      this.setStatus('stopped')
      return
    }

    await new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        try {
          child.kill('SIGKILL')
        } catch {
          // ignore
        }
        resolve()
      }, 3000)

      child.once('close', () => {
        clearTimeout(timeout)
        resolve()
      })

      try {
        if (child.stdin.writable) {
          child.stdin.write(JSON.stringify({ type: 'shutdown' }) + '\n')
          child.stdin.end()
        }
        child.kill(process.platform === 'win32' ? undefined : 'SIGTERM')
      } catch {
        try {
          child.kill('SIGKILL')
        } catch {
          // ignore
        }
        clearTimeout(timeout)
        resolve()
      }
    })

    this.process = null
    this.setStatus('stopped')
  }

  async forceKill(): Promise<void> {
    this.intentionalStop = true
    if (this.process) {
      try {
        this.process.kill('SIGKILL')
      } catch {
        // ignore
      }
      this.process = null
    }
    this.setStatus('stopped')
  }

  onEvent(listener: Listener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  getStatus(): AgentStatus {
    return this.status
  }

  getPid(): number | null {
    return this.process?.pid ?? null
  }

  private setStatus(status: AgentStatus): void {
    this.status = status
    if (this.options) {
      this.emit({
        type: 'status',
        sessionId: this.options.sessionId,
        timestamp: new Date().toISOString(),
        data: { status, pid: this.getPid() }
      })
    }
  }

  private emit(event: AgentEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event)
      } catch (err) {
        logger.error('agent', `Listener error: ${String(err)}`)
      }
    }
  }
}
