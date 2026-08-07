import type { ReactNode } from 'react'
import { CHANGELOG_MARKDOWN } from '@/lib/changelog-content'

// 极简 markdown 子集渲染：标题 / 列表 / 引用 / 分隔线 / 表格 / **加粗** / 段落
function InlineText({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return parts.map((part, i) =>
    part.startsWith('**') && part.endsWith('**') && part.length > 4 ? (
      <strong key={i} className="font-semibold">
        {part.slice(2, -2)}
      </strong>
    ) : (
      <span key={i}>{part}</span>
    ),
  )
}

function isTableSeparator(line: string) {
  const cells = line.split('|').map((c) => c.trim())
  return cells.length > 1 && cells.every((c) => /^-{1,}$/.test(c))
}

function renderLines(lines: string[]): ReactNode[] {
  const nodes: ReactNode[] = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    if (!line.trim()) {
      i++
      continue
    }
    if (line.startsWith('#')) {
      const level = line.match(/^#+/)?.[0].length ?? 1
      const text = line.replace(/^#+\s*/, '')
      if (level === 1) {
        nodes.push(
          <h1 key={i} className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
            <InlineText text={text} />
          </h1>,
        )
      } else {
        nodes.push(
          <h2
            key={i}
            className="mt-10 flex items-center gap-2 border-b border-slate-200 pb-2 text-lg font-semibold text-slate-900"
          >
            <span className="inline-block h-4 w-1 rounded-full bg-[var(--brand)]" />
            <InlineText text={text} />
          </h2>,
        )
      }
      i++
      continue
    }
    if (line.startsWith('- ')) {
      const items: string[] = []
      while (i < lines.length && lines[i].startsWith('- ')) {
        items.push(lines[i].slice(2))
        i++
      }
      nodes.push(
        <ul key={i} className="mt-3 space-y-1.5 pl-1">
          {items.map((item, j) => (
            <li key={j} className="flex gap-2 leading-relaxed text-slate-700">
              <span className="mt-[0.55em] h-1 w-1 shrink-0 rounded-full bg-slate-400" />
              <span>
                <InlineText text={item} />
              </span>
            </li>
          ))}
        </ul>,
      )
      continue
    }
    if (line.startsWith('> ')) {
      const quotes: string[] = []
      while (i < lines.length && lines[i].startsWith('> ')) {
        quotes.push(lines[i].slice(2))
        i++
      }
      nodes.push(
        <div key={i} className="mt-4 rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          {quotes.map((q, j) => (
            <p key={j} className={j > 0 ? 'mt-1' : ''}>
              <InlineText text={q} />
            </p>
          ))}
        </div>,
      )
      continue
    }
    if (line.startsWith('|')) {
      const rows: string[][] = []
      let header: string[] | null = null
      while (i < lines.length && lines[i].startsWith('|')) {
        const cells = lines[i]
          .split('|')
          .slice(1, -1)
          .map((c) => c.trim())
        if (isTableSeparator(lines[i])) {
          i++
          continue
        }
        if (!header) header = cells
        else rows.push(cells)
        i++
      }
      if (header) {
        nodes.push(
          <table key={i} className="mt-4 w-full border-collapse text-sm">
            <thead>
              <tr>
                {header.map((cell, j) => (
                  <th key={j} className="border-b border-slate-200 px-3 py-2 text-left font-semibold text-slate-800">
                    <InlineText text={cell} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, j) => (
                <tr key={j} className="border-b border-slate-100">
                  {row.map((cell, k) => (
                    <td key={k} className="px-3 py-2 align-top text-slate-600">
                      <InlineText text={cell} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>,
        )
      }
      continue
    }
    if (/^-{3,}$/.test(line)) {
      nodes.push(<hr key={i} className="mt-8 border-slate-200" />)
      i++
      continue
    }
    nodes.push(
      <p key={i} className="mt-3 leading-relaxed text-slate-700">
        <InlineText text={line} />
      </p>,
    )
    i++
  }
  return nodes
}

export default function ChangelogPage() {
  const lines = CHANGELOG_MARKDOWN.split('\n')
  return (
    <main className="min-h-screen bg-[var(--background)] pb-16">
      <div className="mx-auto max-w-3xl px-6 pt-10">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-400">Changelog</p>
          <p className="text-xs text-slate-400">静态页面 · 无需登录 · 手动维护</p>
        </div>
        {renderLines(lines)}
      </div>
    </main>
  )
}
