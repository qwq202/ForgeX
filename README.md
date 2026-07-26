# ForgeX

[中文文档](./README.zh-CN.md)

**ForgeX** is a desktop GUI for the [Grok Build CLI](https://x.ai) — an AI coding workbench similar in spirit to Codex Desktop, Claude Code Desktop, and OpenCode Desktop.

It is **not** a thin chat wrapper. ForgeX lets you open local projects, run Grok Build as a managed subprocess, inspect agent tool calls, preview files, review Git diffs, and use an integrated terminal — all in one Electron app.

## Screenshots

> _Placeholder — run the app with `pnpm dev` and capture UI screenshots here._
>
> Suggested shots:
>
> 1. Main three-column layout with chat + file tree + terminal
> 2. Git changes / Monaco Diff Editor
> 3. Settings dialog with Grok Build path detection
> 4. Tool call cards in the agent transcript

## Tech stack

| Layer | Technologies |
| --- | --- |
| Shell | Electron, electron-vite, electron-builder |
| UI | React 19, TypeScript, Tailwind CSS, shadcn/ui |
| State | Zustand (UI), TanStack Query (async) |
| Editor | Monaco Editor |
| Terminal | xterm.js + node-pty |
| Data | SQLite via better-sqlite3 |
| Files | chokidar file watcher |
| Markdown | react-markdown + Shiki |
| Validation | Zod (IPC payloads) |

**Platforms:** macOS · Windows · Linux

## Requirements

- **Node.js** ≥ 20
- **pnpm** ≥ 9
- **Git** (for status / diff features)
- **Grok Build CLI** (optional for UI-only use; required for agent runs)
- Native build tools for `node-pty` and `better-sqlite3`:
  - macOS: Xcode Command Line Tools
  - Windows: Visual Studio Build Tools
  - Linux: `build-essential` / Python

## Install

```bash
pnpm install
```

Native modules are rebuilt for Electron via `electron-builder install-app-deps` (postinstall).

## Development

```bash
pnpm dev
```

This starts Vite for the renderer and launches Electron with hot reload.

Other useful commands:

```bash
pnpm typecheck   # TypeScript (main + renderer)
pnpm lint        # ESLint
pnpm format      # Prettier
pnpm build       # Production compile (electron-vite)
pnpm preview     # Preview production build
```

## Build & package

```bash
# Compile main / preload / renderer
pnpm build

# Package for current platform
pnpm dist

# Platform-specific
pnpm dist:mac
pnpm dist:win
pnpm dist:linux
```

Artifacts land in `dist/`.

## Grok Build CLI configuration

1. Install the Grok Build CLI on your machine and ensure it is on `PATH`, **or**
2. Open **Settings** in ForgeX and set **Executable path** to the full path of the binary (e.g. `/usr/local/bin/grok` or `C:\…\grok.exe`).

ForgeX will:

- Probe configured path → `PATH` → common install locations
- Run `--version` / `version` to display CLI version in the status bar
- Spawn the CLI in the **current project directory** with stdin/stdout capture

### Agent transport abstraction

Grok Build protocol details (e.g. full ACP) may evolve. ForgeX uses a stable interface:

```ts
interface AgentTransport {
  connect(options: AgentConnectionOptions): Promise<void>
  sendMessage(message: string): Promise<void>
  cancel(): Promise<void>
  disconnect(): Promise<void>
  onEvent(listener: (event: AgentEvent) => void): () => void
}
```

MVP ships a **stdio transport** (`StdioAgentTransport`) that:

- Spawns the CLI as a child process
- Sends user messages as JSON lines on stdin
- Parses JSON events from stdout when available, otherwise streams plain text as message deltas

Swap in a formal ACP client later without rewriting the UI.

## Project structure

```text
src/
  main/                 # Electron main process
    index.ts
    ipc/                # Domain IPC handlers (Zod-validated)
    services/
      agent/            # Process manager + stdio transport
      database/         # better-sqlite3 + migrations + repos
      filesystem/       # Safe FS + chokidar
      git/              # Git status / diff / discard
      terminal/         # node-pty sessions
      settings/
    windows/
  preload/              # contextBridge API (no raw ipcRenderer leak)
  renderer/src/
    components/         # Layout + shadcn primitives
    features/           # agent, chat, projects, sessions, files, git, terminal, settings
    hooks/
    lib/
    stores/             # Zustand UI / workspace / settings
  shared/               # Types, Zod schemas, IPC channel constants
```

## Security model

| Control | Implementation |
| --- | --- |
| Process isolation | `contextIsolation: true`, `nodeIntegration: false` |
| Sandbox | `sandbox: false` on BrowserWindow (required for preload + native module lifecycle with node-pty / better-sqlite3). Renderer still has **no Node APIs**. |
| File access | All FS ops in main; paths confined to project root (traversal + symlink checks) |
| Shell | Renderer cannot run arbitrary shell commands; only managed PTY + agent process |
| Approvals | Agent command approval channel + ConfirmDialog for destructive Git discard |
| Secrets | Logs redact token/password/API key patterns; no secrets in frontend source |
| Navigation | Unknown navigation blocked; external links open in system browser |
| CSP | Content-Security-Policy headers + meta CSP |

## Known limitations (MVP)

- Monaco is **read-only** in phase 1 (editing structure is reserved)
- “Accept changes” is a UI acknowledgment only (does not auto-stage)
- “Reject changes” discards via `git checkout` / `git restore` / delete untracked — **confirm dialog required**
- Grok Build ACP is not fully specified here; stdio transport is a best-effort bridge
- No multi-window or remote workspace support yet
- Problems panel is a stub (agent/tool errors can be extended to feed it)
- Large monorepos may slow the recursive file tree (depth-limited + ignored dirs)

## Roadmap

- [ ] Formal ACP client when protocol docs are stable
- [ ] Writable Monaco + save pipeline with conflict detection
- [ ] Multi-terminal tabs
- [ ] Inline permission UI for every shell tool call
- [ ] Commit / stage UI for Git
- [ ] Session export / import
- [ ] Plugin hooks (without over-engineering early)

## License

MIT
