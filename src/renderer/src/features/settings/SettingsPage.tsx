import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  Box,
  GitBranch,
  Info,
  Keyboard,
  Palette,
  Search,
  Settings2,
  Terminal,
  Workflow
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import type { AppSettings, ThemeMode } from '@shared/types'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { getApi } from '@/lib/api'
import { cn } from '@/lib/utils'
import { useSettingsStore } from '@/stores/settings-store'
import { useUiStore } from '@/stores/ui-store'

type SettingsSection =
  | 'general'
  | 'appearance'
  | 'agent'
  | 'editor'
  | 'terminal'
  | 'shortcuts'
  | 'about'

interface NavItem {
  id: SettingsSection
  label: string
  icon: React.ComponentType<{ className?: string }>
  group: string
}

const NAV: NavItem[] = [
  { id: 'general', label: '常规', icon: Settings2, group: '个人' },
  { id: 'appearance', label: '外观', icon: Palette, group: '个人' },
  { id: 'agent', label: 'Grok Build', icon: Workflow, group: '编码' },
  { id: 'editor', label: '编辑器', icon: Box, group: '编码' },
  { id: 'terminal', label: '终端', icon: Terminal, group: '编码' },
  { id: 'shortcuts', label: '键盘快捷键', icon: Keyboard, group: '编码' },
  { id: 'about', label: '关于', icon: Info, group: '已归档' }
]

function SettingsRow({
  title,
  description,
  children,
  last
}: {
  title: string
  description?: string
  children: React.ReactNode
  last?: boolean
}) {
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-6 px-4 py-3.5',
        !last && 'border-b border-border/70'
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="text-[13.5px] font-medium text-foreground">{title}</div>
        {description && (
          <p className="mt-0.5 text-[12px] leading-relaxed text-muted-foreground">{description}</p>
        )}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

function SettingsCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border/80 bg-card shadow-sm">
      {children}
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-5 text-[28px] font-semibold tracking-tight">{children}</h2>
}

function GroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-2 mt-7 text-[13px] font-medium text-muted-foreground first:mt-0">
      {children}
    </h3>
  )
}

export function SettingsPage() {
  const setOpen = useUiStore((s) => s.setSettingsOpen)
  const sidebarWidth = useUiStore((s) => s.sidebarWidth)
  const setSettings = useSettingsStore((s) => s.setSettings)
  const queryClient = useQueryClient()
  const [section, setSection] = useState<SettingsSection>('general')
  const [search, setSearch] = useState('')
  const [form, setForm] = useState<AppSettings | null>(null)

  const { data: remote } = useQuery({
    queryKey: ['settings'],
    queryFn: () => getApi().settings.get()
  })

  const { data: appInfo } = useQuery({
    queryKey: ['app-info'],
    queryFn: () => getApi().app.getInfo()
  })

  const { data: grokInfo } = useQuery({
    queryKey: ['grok-info'],
    queryFn: () => getApi().app.getGrokBuildInfo()
  })

  useEffect(() => {
    if (remote) setForm(remote)
  }, [remote])

  const saveMutation = useMutation({
    mutationFn: (partial: Partial<AppSettings>) => getApi().settings.update(partial),
    onSuccess: (next) => {
      setSettings(next)
      setForm(next)
      void queryClient.invalidateQueries({ queryKey: ['settings'] })
      void queryClient.invalidateQueries({ queryKey: ['grok-info'] })
    }
  })

  /** Instant apply like Codex/ChatGPT settings */
  const patch = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setForm((prev) => {
      if (!prev) return prev
      return { ...prev, [key]: value }
    })
    if (key === 'theme') {
      useSettingsStore.getState().applyTheme(value as ThemeMode)
    }
    if (key === 'fontSize') {
      document.body.style.fontSize = `${value as number}px`
    }
    void saveMutation.mutateAsync({ [key]: value } as Partial<AppSettings>)
  }

  const filteredNav = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return NAV
    return NAV.filter((n) => n.label.toLowerCase().includes(q) || n.group.includes(q))
  }, [search])

  const groups = useMemo(() => {
    const map = new Map<string, NavItem[]>()
    for (const item of filteredNav) {
      const list = map.get(item.group) ?? []
      list.push(item)
      map.set(item.group, list)
    }
    return map
  }, [filteredNav])

  const titleMap: Record<SettingsSection, string> = {
    general: '常规',
    appearance: '外观',
    agent: 'Grok Build',
    editor: '编辑器',
    terminal: '终端',
    shortcuts: '键盘快捷键',
    about: '关于'
  }

  return (
    <div className="flex h-full min-h-0 bg-background">
      {/* Settings sidebar */}
      <aside
        className="flex shrink-0 flex-col border-r border-border/80 bg-sidebar"
        style={{ width: sidebarWidth }}
      >
        {/* Match main sidebar: traffic-light row, then content */}
        <div className="titlebar-drag h-[38px] w-full shrink-0" />
        <div className="titlebar-no-drag shrink-0 px-2 py-1">
          <button
            type="button"
            className="flex w-full items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-left text-[13px] text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground"
            onClick={() => setOpen(false)}
          >
            <ArrowLeft className="h-3.5 w-3.5 shrink-0" />
            返回应用
          </button>
        </div>

        <div className="px-2 pb-3">
          <div className="relative w-full">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索设置…"
              className="h-8 w-full rounded-md border-border/80 bg-background pl-8 text-[12.5px] shadow-none"
            />
          </div>
        </div>

        <nav className="min-h-0 flex-1 space-y-4 overflow-y-auto px-2 pb-4">
          {[...groups.entries()].map(([group, items]) => (
            <div key={group}>
              <div className="mb-1 px-2.5 text-[11px] font-medium text-muted-foreground">
                {group}
              </div>
              <div className="space-y-0.5">
                {items.map((item) => {
                  const Icon = item.icon
                  const active = section === item.id
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setSection(item.id)}
                      className={cn(
                        'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-[13px] transition-colors',
                        active
                          ? 'bg-sidebar-accent font-medium text-foreground'
                          : 'text-sidebar-foreground hover:bg-sidebar-accent/70'
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0 opacity-70" />
                      {item.label}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>
      </aside>

      {/* Content */}
      <div className="min-w-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[720px] px-10 py-10">
          <SectionTitle>{titleMap[section]}</SectionTitle>

          {!form ? (
            <p className="text-sm text-muted-foreground">加载设置…</p>
          ) : (
            <>
              {section === 'general' && (
                <>
                  <GroupLabel>启动与恢复</GroupLabel>
                  <SettingsCard>
                    <SettingsRow
                      title="自动恢复上次项目"
                      description="启动 ForgeX 时自动打开最近使用的项目目录。"
                    >
                      <Switch
                        checked={form.autoRestoreProject}
                        onCheckedChange={(v) => patch('autoRestoreProject', v)}
                      />
                    </SettingsRow>
                    <SettingsRow
                      title="自动恢复上次会话"
                      description="打开项目后自动进入最近一次会话；关闭则显示欢迎页。"
                    >
                      <Switch
                        checked={form.autoRestoreSession}
                        onCheckedChange={(v) => patch('autoRestoreSession', v)}
                      />
                    </SettingsRow>
                    <SettingsRow
                      title="显示详细日志"
                      description="在底部日志面板中包含 debug 级别信息。"
                      last
                    >
                      <Switch
                        checked={form.showVerboseLogs}
                        onCheckedChange={(v) => patch('showVerboseLogs', v)}
                      />
                    </SettingsRow>
                  </SettingsCard>

                  <GroupLabel>路径</GroupLabel>
                  <SettingsCard>
                    <SettingsRow
                      title="默认项目目录"
                      description="「打开项目」对话框的起始目录。"
                      last
                    >
                      <Input
                        value={form.defaultProjectDir}
                        placeholder="用户主目录"
                        className="h-8 w-[220px] rounded-md text-[12.5px]"
                        onChange={(e) => patch('defaultProjectDir', e.target.value)}
                        onBlur={(e) => patch('defaultProjectDir', e.target.value)}
                      />
                    </SettingsRow>
                  </SettingsCard>
                </>
              )}

              {section === 'appearance' && (
                <>
                  <GroupLabel>主题</GroupLabel>
                  <SettingsCard>
                    <SettingsRow title="外观主题" description="选择浅色、深色或跟随系统。" last>
                      <Select
                        value={form.theme}
                        onValueChange={(v) => patch('theme', v as ThemeMode)}
                      >
                        <SelectTrigger className="h-8 w-[140px] rounded-md">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="light">浅色</SelectItem>
                          <SelectItem value="dark">深色</SelectItem>
                          <SelectItem value="system">跟随系统</SelectItem>
                        </SelectContent>
                      </Select>
                    </SettingsRow>
                  </SettingsCard>

                  <GroupLabel>字号</GroupLabel>
                  <SettingsCard>
                    <SettingsRow title="界面字号" description="应用整体 UI 文字大小（10–24）。">
                      <Input
                        type="number"
                        min={10}
                        max={24}
                        value={form.fontSize}
                        className="h-8 w-20 rounded-md text-center text-[12.5px]"
                        onChange={(e) => patch('fontSize', Number(e.target.value) || 13)}
                      />
                    </SettingsRow>
                    <SettingsRow
                      title="编辑器字号"
                      description="Monaco 代码预览的字体大小。"
                    >
                      <Input
                        type="number"
                        min={10}
                        max={24}
                        value={form.editorFontSize}
                        className="h-8 w-20 rounded-md text-center text-[12.5px]"
                        onChange={(e) => patch('editorFontSize', Number(e.target.value) || 13)}
                      />
                    </SettingsRow>
                    <SettingsRow
                      title="终端字号"
                      description="集成终端的字体大小。"
                      last
                    >
                      <Input
                        type="number"
                        min={10}
                        max={24}
                        value={form.terminalFontSize}
                        className="h-8 w-20 rounded-md text-center text-[12.5px]"
                        onChange={(e) =>
                          patch('terminalFontSize', Number(e.target.value) || 13)
                        }
                      />
                    </SettingsRow>
                  </SettingsCard>
                </>
              )}

              {section === 'agent' && (
                <>
                  <GroupLabel>可执行文件</GroupLabel>
                  <SettingsCard>
                    <SettingsRow
                      title="Grok Build 路径"
                      description={
                        grokInfo?.installed
                          ? `已检测到：${grokInfo.path}${grokInfo.version ? `（${grokInfo.version}）` : ''}`
                          : grokInfo?.error ?? '未检测到 CLI，请手动填写完整路径。'
                      }
                      last
                    >
                      <Input
                        value={form.grokBuildPath}
                        placeholder="自动检测 / 自定义路径"
                        className="h-8 w-[260px] rounded-md font-mono text-[12px]"
                        onChange={(e) =>
                          setForm((prev) =>
                            prev ? { ...prev, grokBuildPath: e.target.value } : prev
                          )
                        }
                        onBlur={(e) => patch('grokBuildPath', e.target.value)}
                      />
                    </SettingsRow>
                  </SettingsCard>

                  <GroupLabel>说明</GroupLabel>
                  <SettingsCard>
                    <div className="px-4 py-3.5 text-[12.5px] leading-relaxed text-muted-foreground">
                      ForgeX 通过 stdio 管理 Grok Build 子进程。启动 Agent
                      时会在当前项目目录中运行 CLI，并捕获输出显示在对话区。协议细节完善后可替换为正式
                      ACP 客户端，无需改动 UI。
                    </div>
                  </SettingsCard>
                </>
              )}

              {section === 'editor' && (
                <>
                  <GroupLabel>预览</GroupLabel>
                  <SettingsCard>
                    <SettingsRow
                      title="自动换行"
                      description="文件预览时是否自动换行（第一阶段为只读预览）。"
                      last
                    >
                      <Switch
                        checked={form.editorWordWrap}
                        onCheckedChange={(v) => patch('editorWordWrap', v)}
                      />
                    </SettingsRow>
                  </SettingsCard>
                  <GroupLabel>字号</GroupLabel>
                  <SettingsCard>
                    <SettingsRow title="编辑器字号" description="Monaco 编辑器字体大小。" last>
                      <Input
                        type="number"
                        min={10}
                        max={24}
                        value={form.editorFontSize}
                        className="h-8 w-20 rounded-md text-center text-[12.5px]"
                        onChange={(e) => patch('editorFontSize', Number(e.target.value) || 13)}
                      />
                    </SettingsRow>
                  </SettingsCard>
                </>
              )}

              {section === 'terminal' && (
                <>
                  <GroupLabel>Shell</GroupLabel>
                  <SettingsCard>
                    <SettingsRow
                      title="默认 Shell"
                      description="留空则使用系统默认（macOS/Linux 用户 Shell，Windows PowerShell）。"
                    >
                      <Input
                        value={form.defaultShell}
                        placeholder="系统默认"
                        className="h-8 w-[220px] rounded-md font-mono text-[12px]"
                        onChange={(e) =>
                          setForm((prev) =>
                            prev ? { ...prev, defaultShell: e.target.value } : prev
                          )
                        }
                        onBlur={(e) => patch('defaultShell', e.target.value)}
                      />
                    </SettingsRow>
                    <SettingsRow
                      title="终端字号"
                      description="xterm.js 集成终端的字体大小。"
                      last
                    >
                      <Input
                        type="number"
                        min={10}
                        max={24}
                        value={form.terminalFontSize}
                        className="h-8 w-20 rounded-md text-center text-[12.5px]"
                        onChange={(e) =>
                          patch('terminalFontSize', Number(e.target.value) || 13)
                        }
                      />
                    </SettingsRow>
                  </SettingsCard>
                  <GroupLabel>面板</GroupLabel>
                  <SettingsCard>
                    <SettingsRow
                      title="默认终端位置"
                      description="当前版本固定在主区域底部抽屉中打开。"
                      last
                    >
                      <div className="flex overflow-hidden rounded-md border border-border text-[12px]">
                        <span className="bg-muted px-3 py-1.5 font-medium">底部</span>
                        <span className="px-3 py-1.5 text-muted-foreground">右侧</span>
                      </div>
                    </SettingsRow>
                  </SettingsCard>
                </>
              )}

              {section === 'shortcuts' && (
                <>
                  <GroupLabel>全局</GroupLabel>
                  <SettingsCard>
                    {[
                      ['新建会话', '⌘ / Ctrl + N'],
                      ['打开设置', '⌘ / Ctrl + ,'],
                      ['切换侧栏', '⌘ / Ctrl + B'],
                      ['终端面板', '⌘ / Ctrl + J'],
                      ['文件面板', '⌘ / Ctrl + ⇧ + E'],
                      ['Git 变更', '⌘ / Ctrl + ⇧ + G'],
                      ['发送消息', 'Enter'],
                      ['换行', '⇧ + Enter']
                    ].map(([title, keys], i, arr) => (
                      <SettingsRow key={title} title={title} last={i === arr.length - 1}>
                        <kbd className="rounded-md border border-border bg-muted/50 px-2 py-1 font-mono text-[11px] text-muted-foreground">
                          {keys}
                        </kbd>
                      </SettingsRow>
                    ))}
                  </SettingsCard>
                </>
              )}

              {section === 'about' && (
                <>
                  <GroupLabel>应用信息</GroupLabel>
                  <SettingsCard>
                    <SettingsRow title="应用名称">
                      <span className="text-[13px] text-muted-foreground">
                        {appInfo?.name ?? 'ForgeX'}
                      </span>
                    </SettingsRow>
                    <SettingsRow title="版本">
                      <span className="text-[13px] text-muted-foreground">
                        {appInfo?.version ?? '—'}
                      </span>
                    </SettingsRow>
                    <SettingsRow title="平台">
                      <span className="text-[13px] text-muted-foreground">
                        {appInfo ? `${appInfo.platform} · ${appInfo.arch}` : '—'}
                      </span>
                    </SettingsRow>
                    <SettingsRow title="Electron">
                      <span className="text-[13px] text-muted-foreground">
                        {appInfo?.electronVersion ?? '—'}
                      </span>
                    </SettingsRow>
                    <SettingsRow title="Chromium">
                      <span className="text-[13px] text-muted-foreground">
                        {appInfo?.chromeVersion ?? '—'}
                      </span>
                    </SettingsRow>
                    <SettingsRow title="Grok Build">
                      <span className="max-w-[280px] truncate text-right text-[12px] text-muted-foreground">
                        {grokInfo?.installed
                          ? grokInfo.version ?? grokInfo.path
                          : '未安装'}
                      </span>
                    </SettingsRow>
                    <SettingsRow title="数据库路径">
                      <span
                        className="max-w-[320px] truncate text-right font-mono text-[11px] text-muted-foreground"
                        title={appInfo?.databasePath}
                      >
                        {appInfo?.databasePath ?? '—'}
                      </span>
                    </SettingsRow>
                    <SettingsRow title="用户数据" last>
                      <span
                        className="max-w-[320px] truncate text-right font-mono text-[11px] text-muted-foreground"
                        title={appInfo?.userDataPath}
                      >
                        {appInfo?.userDataPath ?? '—'}
                      </span>
                    </SettingsRow>
                  </SettingsCard>

                  <GroupLabel>Git</GroupLabel>
                  <SettingsCard>
                    <div className="flex items-start gap-3 px-4 py-3.5 text-[12.5px] text-muted-foreground">
                      <GitBranch className="mt-0.5 h-4 w-4 shrink-0" />
                      <p>
                        ForgeX 通过系统 Git 读取状态与 Diff。接受修改在第一阶段为 UI
                        确认；拒绝修改会丢弃本地变更（需二次确认）。
                      </p>
                    </div>
                  </SettingsCard>
                </>
              )}
            </>
          )}

          {saveMutation.isError && (
            <p className="mt-4 text-[12px] text-red-500">
              保存失败：{(saveMutation.error as Error).message}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
