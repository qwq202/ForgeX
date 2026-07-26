# ForgeX

**ForgeX** 是 [Grok Build CLI](https://x.ai) 的桌面图形界面，定位类似 Codex Desktop、Claude Code Desktop、OpenCode Desktop 的 AI 编程工作台。

它不只是聊天外壳。你可以在本地打开项目、以托管子进程运行 Grok Build、查看 Agent 工具调用、预览文件、审阅 Git 变更，并使用内置终端——全部集中在一个 Electron 应用中。

## 截图

> _占位 — 使用 `pnpm dev` 启动应用后截取界面图放在此处。_
>
> 建议截图：
>
> 1. 主界面三栏布局：对话 + 文件树 + 终端
> 2. Git 变更 / Monaco Diff 编辑器
> 3. 设置对话框（Grok Build 路径检测）
> 4. 对话流中的工具调用卡片

## 技术栈

| 层级 | 技术 |
| --- | --- |
| 壳层 | Electron、electron-vite、electron-builder |
| 界面 | React 19、TypeScript、Tailwind CSS、shadcn/ui |
| 状态 | Zustand（UI）、TanStack Query（异步） |
| 编辑器 | Monaco Editor |
| 终端 | xterm.js + node-pty |
| 数据 | SQLite（better-sqlite3） |
| 文件 | chokidar 文件监听 |
| Markdown | react-markdown + Shiki |
| 校验 | Zod（IPC 载荷） |

**支持平台：** macOS · Windows · Linux

## 环境要求

- **Node.js** ≥ 20
- **pnpm** ≥ 9
- **Git**（状态 / 差异相关功能）
- **Grok Build CLI**（仅浏览 UI 时可选；运行 Agent 时必需）
- 编译原生模块 `node-pty`、`better-sqlite3` 所需工具：
  - macOS：Xcode Command Line Tools
  - Windows：Visual Studio Build Tools
  - Linux：`build-essential` / Python

## 安装

```bash
pnpm install
```

原生模块会在 postinstall 阶段通过 `electron-builder install-app-deps` 为 Electron 重建。

## 开发

```bash
pnpm dev
```

会启动 Vite 渲染进程，并以热重载方式打开 Electron。

其他常用命令：

```bash
pnpm typecheck   # TypeScript（main + renderer）
pnpm lint        # ESLint
pnpm format      # Prettier
pnpm build       # 生产编译（electron-vite）
pnpm preview     # 预览生产构建
```

## 构建与打包

```bash
# 编译 main / preload / renderer
pnpm build

# 为当前平台打包
pnpm dist

# 指定平台
pnpm dist:mac
pnpm dist:win
pnpm dist:linux
```

产物输出到 `dist/`。

## 配置 Grok Build CLI

1. 在本机安装 Grok Build CLI，并确保其在 `PATH` 中，**或**
2. 在 ForgeX 的 **设置** 中将 **可执行文件路径** 设为二进制完整路径（例如 `/usr/local/bin/grok` 或 `C:\…\grok.exe`）。

ForgeX 会：

- 按「配置路径 → `PATH` → 常见安装位置」探测 CLI
- 执行 `--version` / `version`，在状态栏显示版本
- 在**当前项目目录**下拉起 CLI，并捕获 stdin/stdout

### Agent 传输层抽象

Grok Build 协议细节（如完整 ACP）可能演进。ForgeX 使用稳定接口：

```ts
interface AgentTransport {
  connect(options: AgentConnectionOptions): Promise<void>
  sendMessage(message: string): Promise<void>
  cancel(): Promise<void>
  disconnect(): Promise<void>
  onEvent(listener: (event: AgentEvent) => void): () => void
}
```

MVP 提供 **stdio 传输**（`StdioAgentTransport`）：

- 将 CLI 作为子进程启动
- 通过 stdin 以 JSON Lines 发送用户消息
- 优先解析 stdout 中的 JSON 事件；否则将纯文本作为消息增量流式展示

后续可替换为正式 ACP 客户端，无需重写 UI。

## 项目结构

```text
src/
  main/                 # Electron 主进程
    index.ts
    ipc/                # 分域 IPC 处理器（Zod 校验）
    services/
      agent/            # 进程管理 + stdio 传输
      database/         # better-sqlite3 + 迁移 + 仓库
      filesystem/       # 安全文件系统 + chokidar
      git/              # Git 状态 / 差异 / 丢弃
      terminal/         # node-pty 会话
      settings/
    windows/
  preload/              # contextBridge API（不暴露原始 ipcRenderer）
  renderer/src/
    components/         # 布局 + shadcn 基础组件
    features/           # agent、chat、projects、sessions、files、git、terminal、settings
    hooks/
    lib/
    stores/             # Zustand UI / 工作区 / 设置
  shared/               # 类型、Zod schema、IPC 通道常量
```

## 安全模型

| 控制项 | 实现 |
| --- | --- |
| 进程隔离 | `contextIsolation: true`，`nodeIntegration: false` |
| 沙箱 | BrowserWindow 上 `sandbox: false`（preload 与 node-pty / better-sqlite3 等原生模块生命周期需要）。渲染进程仍**无 Node API** |
| 文件访问 | 全部在主进程完成；路径限制在项目根内（防目录穿越与符号链接逃逸） |
| Shell | 渲染进程不能随意执行 shell；仅托管 PTY 与 Agent 进程 |
| 审批 | Agent 命令审批通道；破坏性 Git 丢弃使用确认对话框 |
| 密钥 | 日志脱敏 token/密码/API key 模式；前端源码不存放密钥 |
| 导航 | 拦截未知导航；外链在系统浏览器打开 |
| CSP | Content-Security-Policy 响应头 + meta CSP |

## 已知限制（MVP）

- 第一阶段 Monaco 为**只读**（可编辑结构预留）
- 「接受变更」仅为 UI 确认，不会自动 stage
- 「拒绝变更」通过 `git checkout` / `git restore` / 删除未跟踪文件丢弃——**必须确认**
- Grok Build ACP 此处未完整约定；stdio 传输为尽力桥接
- 暂无多窗口或远程工作区
- Problems 面板为占位（后续可由 Agent/工具错误填充）
- 大型 monorepo 可能拖慢递归文件树（已限制深度并忽略部分目录）

## 路线图

- [ ] 协议文档稳定后接入正式 ACP 客户端
- [ ] 可写 Monaco + 带冲突检测的保存流程
- [ ] 多终端标签页
- [ ] 每个 shell 工具调用的内联权限 UI
- [ ] Git 暂存 / 提交 UI
- [ ] 会话导出 / 导入
- [ ] 插件钩子（早期不过度设计）

## 许可证

MIT
