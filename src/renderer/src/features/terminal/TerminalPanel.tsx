import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { Eraser, Plus, RotateCcw } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Terminal } from 'xterm'
import 'xterm/css/xterm.css'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/EmptyState'
import { getApi } from '@/lib/api'
import { useSettingsStore } from '@/stores/settings-store'
import { useWorkspaceStore } from '@/stores/workspace-store'

export function TerminalPanel() {
  const projectId = useWorkspaceStore((s) => s.currentProjectId)
  const fontSize = useSettingsStore((s) => s.settings.terminalFontSize)
  const containerRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<Terminal | null>(null)
  const fitRef = useRef<FitAddon | null>(null)
  const terminalIdRef = useRef<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [ready, setReady] = useState(false)

  const disposeCurrent = async () => {
    if (terminalIdRef.current) {
      try {
        await getApi().terminal.dispose(terminalIdRef.current)
      } catch {
        // ignore
      }
      terminalIdRef.current = null
    }
    termRef.current?.dispose()
    termRef.current = null
    fitRef.current = null
    setReady(false)
  }

  const createTerminal = async () => {
    if (!projectId || !containerRef.current) return
    setError(null)
    await disposeCurrent()

    const isDark = document.documentElement.classList.contains('dark')
    const term = new Terminal({
      cursorBlink: true,
      fontSize,
      fontFamily: 'JetBrains Mono, SF Mono, Menlo, Monaco, Consolas, monospace',
      theme: isDark
        ? {
            background: '#121214',
            foreground: '#e4e4e7',
            cursor: '#e4e4e7',
            selectionBackground: '#3f3f46'
          }
        : {
            background: '#ffffff',
            foreground: '#18181b',
            cursor: '#18181b',
            selectionBackground: '#d4d4d8'
          },
      allowProposedApi: true,
      scrollback: 5000
    })

    const fit = new FitAddon()
    term.loadAddon(fit)
    term.loadAddon(
      new WebLinksAddon((_event, uri) => {
        void getApi().app.openExternal(uri)
      })
    )

    term.open(containerRef.current)
    fit.fit()

    termRef.current = term
    fitRef.current = fit

    try {
      const info = await getApi().terminal.create(
        projectId,
        term.cols,
        term.rows
      )
      terminalIdRef.current = info.id
      setReady(true)

      term.onData((data) => {
        if (terminalIdRef.current) {
          void getApi().terminal.write(terminalIdRef.current, data)
        }
      })

      // Copy/paste
      term.attachCustomKeyEventHandler((e) => {
        if ((e.metaKey || e.ctrlKey) && e.key === 'c' && term.hasSelection()) {
          void navigator.clipboard.writeText(term.getSelection())
          return false
        }
        if ((e.metaKey || e.ctrlKey) && e.key === 'v') {
          void navigator.clipboard.readText().then((text) => {
            if (terminalIdRef.current) void getApi().terminal.write(terminalIdRef.current, text)
          })
          return false
        }
        return true
      })
    } catch (err) {
      setError((err as Error).message)
      term.writeln(`\r\n\x1b[31mFailed to create terminal: ${(err as Error).message}\x1b[0m`)
    }
  }

  // Data + exit events
  useEffect(() => {
    const unsubData = getApi().events.onTerminalData(({ terminalId, data }) => {
      if (terminalId === terminalIdRef.current) {
        termRef.current?.write(data)
      }
    })
    const unsubExit = getApi().events.onTerminalExit(({ terminalId, exitCode }) => {
      if (terminalId === terminalIdRef.current) {
        termRef.current?.writeln(`\r\n\x1b[90m[process exited with code ${exitCode}]\x1b[0m`)
        terminalIdRef.current = null
        setReady(false)
      }
    })
    return () => {
      unsubData()
      unsubExit()
    }
  }, [])

  // Create / recreate when project changes (generation token avoids StrictMode double-spawn races)
  useEffect(() => {
    let cancelled = false
    if (!projectId) {
      void disposeCurrent()
      return
    }
    void (async () => {
      await createTerminal()
      if (cancelled) await disposeCurrent()
    })()
    return () => {
      cancelled = true
      void disposeCurrent()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId])

  // Resize observer
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      try {
        fitRef.current?.fit()
        const term = termRef.current
        if (term && terminalIdRef.current) {
          void getApi().terminal.resize(terminalIdRef.current, term.cols, term.rows)
        }
      } catch {
        // ignore
      }
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [ready])

  // Font size updates
  useEffect(() => {
    if (termRef.current) {
      termRef.current.options.fontSize = fontSize
      fitRef.current?.fit()
    }
  }, [fontSize])

  if (!projectId) {
    return (
      <EmptyState
        title="No project"
        description="Open a project to use the integrated terminal."
        className="min-h-[100px]"
      />
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-background dark:bg-[#121214]">
      <div className="flex h-7 shrink-0 items-center justify-end gap-1 border-b border-border px-2">
        <Button
          size="icon-sm"
          variant="ghost"
          title="Clear"
          onClick={() => termRef.current?.clear()}
        >
          <Eraser className="h-3 w-3" />
        </Button>
        <Button
          size="icon-sm"
          variant="ghost"
          title="New terminal"
          onClick={() => void createTerminal()}
        >
          <Plus className="h-3 w-3" />
        </Button>
        <Button
          size="icon-sm"
          variant="ghost"
          title="Recreate"
          onClick={() => void createTerminal()}
        >
          <RotateCcw className="h-3 w-3" />
        </Button>
      </div>
      {error && (
        <div className="px-2 py-1 text-2xs text-red-400">{error}</div>
      )}
      <div ref={containerRef} className="min-h-0 flex-1" />
    </div>
  )
}
