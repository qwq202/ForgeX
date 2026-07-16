import { useEffect, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { codeToHtml } from 'shiki'
import { cn } from '@/lib/utils'

interface MarkdownViewProps {
  content: string
  className?: string
}

function useIsDark(): boolean {
  const [dark, setDark] = useState(() =>
    typeof document !== 'undefined' ? document.documentElement.classList.contains('dark') : true
  )
  useEffect(() => {
    const el = document.documentElement
    const update = () => setDark(el.classList.contains('dark'))
    update()
    const obs = new MutationObserver(update)
    obs.observe(el, { attributes: true, attributeFilter: ['class'] })
    return () => obs.disconnect()
  }, [])
  return dark
}

function CodeBlock({ language, code, dark }: { language: string; code: string; dark: boolean }) {
  const [html, setHtml] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void codeToHtml(code, {
      lang: language || 'text',
      theme: dark ? 'github-dark' : 'github-light'
    })
      .then((result) => {
        if (!cancelled) setHtml(result)
      })
      .catch(() => {
        if (!cancelled) setHtml(null)
      })
    return () => {
      cancelled = true
    }
  }, [code, language, dark])

  if (html) {
    return (
      <div
        className="my-2 overflow-x-auto rounded-xl border border-border text-[12.5px] [&_pre]:m-0 [&_pre]:bg-transparent! [&_pre]:p-3.5"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    )
  }

  return (
    <pre className="my-2 overflow-x-auto rounded-xl border border-border bg-muted/40 p-3.5 text-[12.5px]">
      <code>{code}</code>
    </pre>
  )
}

export function MarkdownView({ content, className }: MarkdownViewProps) {
  const dark = useIsDark()

  return (
    <div
      className={cn(
        'prose prose-sm dark:prose-invert max-w-none prose-p:my-1.5 prose-headings:my-2 prose-pre:bg-transparent prose-pre:p-0 prose-code:before:content-none prose-code:after:content-none',
        className
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children }) => (
            <a
              href={href}
              className="text-sky-600 underline-offset-2 hover:underline dark:text-sky-400"
              onClick={(e) => {
                e.preventDefault()
                if (href) void window.forgex?.app.openExternal(href)
              }}
            >
              {children}
            </a>
          ),
          code: ({ className: cls, children, ...props }) => {
            const match = /language-(\w+)/.exec(cls || '')
            const code = String(children).replace(/\n$/, '')
            const isBlock = Boolean(match) || code.includes('\n')
            if (isBlock) {
              return <CodeBlock language={match?.[1] || 'text'} code={code} dark={dark} />
            }
            return (
              <code
                className="rounded-md bg-muted px-1 py-0.5 font-mono text-[12.5px]"
                {...props}
              >
                {children}
              </code>
            )
          },
          pre: ({ children }) => <>{children}</>
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
