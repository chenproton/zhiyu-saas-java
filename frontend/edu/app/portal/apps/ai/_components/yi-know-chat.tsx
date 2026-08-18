'use client'

// YIKnow 全局智能助手（spec §2.1 YIKnow）：公司主推产品入口。
// 布局：左侧功能轨（智能对话/我的知识库/我的智能体 + 历史会话）+ 主区。
// v2.8：独立对话页 /portal/apps/ai/chat 已下线，AI 对话统一走弹窗
// （YIKnowChatDialog variant="modal"；page 变体保留仅供未来页面化复用）。
// v2.7.3 体验打磨（对齐对话类产品最佳实践）：
//   智能跟随滚动（上翻时不拽回）/ 停止生成 / 气泡 hover 复制 + 末条重新生成 /
//   Textarea 自适应输入（Enter 发送、Shift+Enter 换行）/ 会话重命名（双击）+ 历史按日期分组 /
//   流式失败气泡内「重试」/ 代码块一键复制 / 移动端左轨抽屉。
// v2.7：聊天体验抽为共享组件（variant page/modal），前台入口统一弹窗。
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router'
import {
  ArrowLeft,
  Bot,
  ClipboardList,
  Factory,
  BookOpen,
  Target,
  Settings,
  MessageSquare,
  Loader2,
  Send,
  Plus,
  Trash2,
  Square,
  Copy,
  Check,
  RotateCcw,
  Menu,
  Pencil,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import { useToast } from '@zhiyu/ui'
import { aiCenterAgentApi, aiCenterV22Api, streamYiknowChat } from '@/lib/api'
import type { AIConversation } from '@/lib/api'
import { useAiNotConfigured } from '@/lib/ai/use-ai-assist'
import { AiNotConfiguredDialog } from '@/components/shared/ai-not-configured-dialog'
import { YIKnowMyAssets } from './yi-know-my-assets'
import { useT } from '@/lib/i18n/locale-provider'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

// 预留功能入口（本期仅占位）
const PLACEHOLDER_ITEMS = [
  { id: 'plans', label: '我的方案', icon: ClipboardList },
  { id: 'jobs', label: '岗位库', icon: Target },
  { id: 'scenes', label: '场景库', icon: Factory },
  { id: 'settings', label: '设置', icon: Settings },
] as const

interface ChatMsg {
  role: 'user' | 'assistant'
  content: string
  /** 流式失败标记：气泡内显示重试 */
  failed?: boolean
}

/** 代码块：ReactMarkdown pre 覆盖——右上角一键复制 */
function CodeBlock({ children, ...props }: React.HTMLAttributes<HTMLPreElement>) {
  const [copied, setCopied] = useState(false)
  const t = useT()
  const ref = useRef<HTMLPreElement>(null)
  const copy = async () => {
    const text = ref.current?.innerText ?? ''
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* 剪贴板不可用时静默 */
    }
  }
  return (
    <div className="relative group/code">
      <pre ref={ref} {...props}>
        {children}
      </pre>
      <button
        onClick={copy}
        className="absolute top-2 right-2 rounded-md bg-white/10 hover:bg-white/20 text-white/80 px-2 py-1 text-[11px] opacity-0 group-hover/code:opacity-100 transition-opacity"
      >
        {copied ? t('已复制') : t('复制')}
      </button>
    </div>
  )
}

/** 会话按日期分组：今天 / 昨天 / 7 天内 / 更早 */
function groupConversations(
  items: AIConversation[],
  labels: { today: string; yesterday: string; week: string; earlier: string },
) {
  const now = new Date()
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const groups: { label: string; items: AIConversation[] }[] = [
    { label: labels.today, items: [] },
    { label: labels.yesterday, items: [] },
    { label: labels.week, items: [] },
    { label: labels.earlier, items: [] },
  ]
  for (const c of items) {
    const ts = new Date(c.updatedAt || c.createdAt).getTime()
    const days = Math.floor((startOfDay - ts) / 86400000) + (ts >= startOfDay ? 0 : 1)
    if (ts >= startOfDay) groups[0].items.push(c)
    else if (days <= 1) groups[1].items.push(c)
    else if (days <= 7) groups[2].items.push(c)
    else groups[3].items.push(c)
  }
  return groups.filter((g) => g.items.length > 0)
}

export function YIKnowChat({
  variant = 'page',
  onNavigate,
}: {
  variant?: 'page' | 'modal'
  /** 跳详情/对话页时回调（浮动面板用于自动收起） */
  onNavigate?: () => void
}) {
  const [messages, setMessages] = useState<ChatMsg[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [conversations, setConversations] = useState<AIConversation[]>([])
  // v2.7：左侧功能轨视图切换（chat=智能对话；kbs/agents=我的资产列表）
  const [view, setView] = useState<'chat' | 'kbs' | 'agents'>('chat')
  const [activeConvId, setActiveConvId] = useState<string | null>(null)
  const [loadingConv, setLoadingConv] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  // 智能跟随滚动：仅当用户停留在底部附近时，新内容才自动下滚
  const followRef = useRef(true)
  const { toast } = useToast()
  const t = useT()
  // 412 ai_not_configured 统一走共享 hook + 引导弹窗（与 AI 辅助编写三件套一致）
  const ai = useAiNotConfigured()

  const scrollToBottom = useCallback((force = false) => {
    if (!force && !followRef.current) return
    setTimeout(() => listRef.current?.scrollTo({ top: listRef.current.scrollHeight }), 0)
  }, [])

  const handleListScroll = () => {
    const el = listRef.current
    if (!el) return
    followRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80
  }

  const loadConversations = useCallback(() => {
    aiCenterV22Api
      .listYiknowConversations()
      .then((res) => setConversations(res.items || []))
      .catch(() => {})
  }, [])

  useEffect(() => {
    loadConversations()
    return () => abortRef.current?.abort()
  }, [loadConversations])

  const startNewChat = () => {
    abortRef.current?.abort()
    setSending(false)
    setActiveConvId(null)
    setMessages([])
    setInput('')
    followRef.current = true
  }

  const openConversation = async (id: string) => {
    if (id === activeConvId || loadingConv) return
    abortRef.current?.abort()
    setSending(false)
    setLoadingConv(true)
    try {
      const res = await aiCenterAgentApi.getConversation(id)
      setActiveConvId(id)
      setMessages(
        (res.messages || []).map((m: { role: string; content: string }) => ({
          role: m.role === 'user' ? ('user' as const) : ('assistant' as const),
          content: m.content,
        })),
      )
      followRef.current = true
      scrollToBottom(true)
    } catch {
      toast({ title: t('加载会话失败'), variant: 'destructive' })
    } finally {
      setLoadingConv(false)
    }
  }

  const deleteConversation = async (id: string) => {
    try {
      await aiCenterAgentApi.removeConversation(id)
      if (id === activeConvId) startNewChat()
      setConversations((prev) => prev.filter((c) => c.id !== id))
    } catch {
      toast({ title: t('删除失败'), variant: 'destructive' })
    }
  }

  const submitRename = async (id: string) => {
    const title = renameValue.trim()
    setRenamingId(null)
    if (!title) return
    try {
      await aiCenterAgentApi.renameConversation(id, title)
      setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, title } : c)))
    } catch (err) {
      toast({
        title: t('重命名失败'),
        description: err instanceof Error ? err.message : undefined,
        variant: 'destructive',
      })
    }
  }

  /** 流式发送核心：content 为用户消息；opts.regenerate=true 时不追加用户气泡（重生成） */
  const runStream = async (content: string, opts?: { regenerate?: boolean }) => {
    if (!content || sending) return
    setSending(true)
    if (!opts?.regenerate) {
      setMessages((prev) => [...prev, { role: 'user', content }, { role: 'assistant', content: '' }])
    } else {
      // 重生成：替换最后一条 assistant 气泡
      setMessages((prev) => {
        const next = [...prev]
        for (let i = next.length - 1; i >= 0; i--) {
          if (next[i].role === 'assistant') {
            next[i] = { role: 'assistant', content: '' }
            break
          }
        }
        return next
      })
    }
    followRef.current = true
    scrollToBottom(true)
    abortRef.current = new AbortController()
    const signal = abortRef.current.signal
    try {
      await streamYiknowChat(
        activeConvId,
        content,
        {
          onMeta: (data) => {
            const cid = (data as { conversationId?: string }).conversationId
            if (cid) setActiveConvId(cid)
          },
          onDelta: (text) => {
            setMessages((prev) => {
              const next = [...prev]
              const last = next[next.length - 1]
              if (last?.role === 'assistant') next[next.length - 1] = { ...last, content: last.content + text }
              return next
            })
            scrollToBottom()
          },
          onDone: () => loadConversations(),
          onError: (_code, message) => {
            setMessages((prev) => {
              const next = [...prev]
              const last = next[next.length - 1]
              if (last?.role === 'assistant') {
                next[next.length - 1] = { ...last, failed: true }
              }
              return next
            })
            toast({ title: t('发送失败'), description: message, variant: 'destructive' })
          },
        },
        signal,
      )
    } catch (err) {
      // 用户主动停止：保留已生成内容，不报错
      if (signal.aborted) return
      setMessages((prev) => {
        const next = [...prev]
        const last = next[next.length - 1]
        if (last?.role === 'assistant') next[next.length - 1] = { ...last, failed: true }
        return next
      })
      // 后端 412 固定返回 ai_not_configured，命中即打开统一引导弹窗
      if (!ai.markNotConfigured(err)) {
        toast({
          title: t('发送失败'),
          description: err instanceof Error ? err.message : undefined,
          variant: 'destructive',
        })
      }
    } finally {
      setSending(false)
      inputRef.current?.focus()
    }
  }

  const handleSend = (preset?: string) => {
    const content = (preset ?? input).trim()
    if (!content || sending) return
    setInput('')
    // 重置输入框高度
    if (inputRef.current) inputRef.current.style.height = 'auto'
    runStream(content)
  }

  const handleStop = () => {
    abortRef.current?.abort()
    setSending(false)
  }

  /** 重新生成：取最后一条 user 消息重发（不追加新用户气泡） */
  const handleRegenerate = () => {
    if (sending) return
    const lastUser = [...messages].reverse().find((m) => m.role === 'user')
    if (!lastUser) return
    runStream(lastUser.content, { regenerate: true })
  }

  /** 重试失败消息：同重生成语义 */
  const handleRetry = handleRegenerate

  const copyMessage = async (idx: number, content: string) => {
    try {
      await navigator.clipboard.writeText(content)
      setCopiedIdx(idx)
      setTimeout(() => setCopiedIdx((cur) => (cur === idx ? null : cur)), 1500)
    } catch {
      toast({ title: t('复制失败'), variant: 'destructive' })
    }
  }

  const autoResizeInput = () => {
    const el = inputRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`
  }

  const convGroups = useMemo(
    () =>
      groupConversations(conversations, {
        today: t('今天'),
        yesterday: t('昨天'),
        week: t('7 天内'),
        earlier: t('更早'),
      }),
    [conversations, t],
  )

  const lastAssistantIdx = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'assistant') return i
    }
    return -1
  }, [messages])

  /** 历史会话列表（桌面左轨 + 移动端抽屉共用） */
  const renderConversationList = () => (
    <>
      <div className="flex items-center justify-between px-3 pt-3 pb-2">
        <span className="text-xs font-medium text-muted-foreground">{t('历史会话')}</span>
        <button
          onClick={startNewChat}
          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
        >
          <Plus className="w-3.5 h-3.5" />
          {t('新对话')}
        </button>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto px-2 pb-2 space-y-2">
        {conversations.length === 0 && (
          <p className="text-[11px] text-muted-foreground px-2 py-3">{t('暂无历史会话')}</p>
        )}
        {convGroups.map((g) => (
          <div key={g.label}>
            <p className="px-2.5 pb-1 text-[10px] font-medium text-muted-foreground/70">{g.label}</p>
            <div className="space-y-0.5">
              {g.items.map((c) => (
                <div
                  key={c.id}
                  className={cn(
                    'group flex items-center gap-1 rounded-lg px-2.5 py-2 text-xs cursor-pointer transition-colors',
                    c.id === activeConvId ? 'bg-primary/10 text-primary' : 'text-foreground hover:bg-muted',
                  )}
                  onClick={() => {
                    openConversation(c.id)
                    setMobileNavOpen(false)
                  }}
                  onDoubleClick={() => {
                    setRenamingId(c.id)
                    setRenameValue(c.title || '')
                  }}
                  title={t('双击重命名')}
                >
                  {renamingId === c.id ? (
                    <input
                      autoFocus
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onBlur={() => submitRename(c.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') submitRename(c.id)
                        if (e.key === 'Escape') setRenamingId(null)
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="flex-1 min-w-0 bg-background border border-primary/40 rounded px-1.5 py-0.5 text-xs outline-none"
                    />
                  ) : (
                    <span className="flex-1 min-w-0 truncate">{c.title || t('未命名会话')}</span>
                  )}
                  <button
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-primary"
                    onClick={(e) => {
                      e.stopPropagation()
                      setRenamingId(c.id)
                      setRenameValue(c.title || '')
                    }}
                    aria-label={t('重命名会话')}
                  >
                    <Pencil className="w-3 h-3" />
                  </button>
                  <button
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation()
                      deleteConversation(c.id)
                    }}
                    aria-label={t('删除会话')}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  )

  /** 功能轨导航项（桌面/移动端共用） */
  const renderNavItems = (onNavigateClose?: () => void) => (
    <nav className="p-3 space-y-1">
      {(
        [
          { id: 'chat' as const, label: '智能对话', icon: MessageSquare },
          { id: 'kbs' as const, label: '我的知识库', icon: BookOpen },
          { id: 'agents' as const, label: '我的智能体', icon: Bot },
        ]
      ).map((item) => (
        <button
          key={item.id}
          onClick={() => {
            setView(item.id)
            onNavigateClose?.()
          }}
          className={cn(
            'w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm transition-colors',
            view === item.id
              ? 'bg-primary text-white font-medium'
              : 'text-muted-foreground hover:bg-muted',
          )}
        >
          <item.icon className="w-4 h-4" />
          {t(item.label)}
        </button>
      ))}
      {PLACEHOLDER_ITEMS.map((item) => (
        <button
          key={item.id}
          onClick={() => toast({ title: t('功能建设中，敬请期待'), description: t(item.label) })}
          className={cn(
            'w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm transition-colors',
            'text-muted-foreground hover:bg-muted',
          )}
        >
          <item.icon className="w-4 h-4" />
          {t(item.label)}
          <span className="ml-auto text-[10px] rounded-full bg-muted px-1.5 py-0.5 text-muted-foreground">
            {t('待上线')}
          </span>
        </button>
      ))}
    </nav>
  )

  return (
    <div
      className={cn(
        'flex bg-[#f5f7fa] min-h-0',
        variant === 'page' ? 'h-[calc(100vh-3.5rem)]' : 'h-full',
      )}
    >
      {/* 左侧功能轨（YIKnow 原型） */}
      <aside className="hidden md:flex w-60 shrink-0 flex-col border-r border-border bg-background">
        <div className="p-4 border-b border-border">
          {variant === 'page' && (
            <Link
              to="/portal/apps/ai/landing"
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors mb-3"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              {t('返回首页')}
            </Link>
          )}
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-md">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="text-sm font-bold">YIKnow</div>
              <div className="text-[11px] text-muted-foreground">
                You Ask · I Know · {t('你问，我懂')}
              </div>
            </div>
          </div>
        </div>
        {renderNavItems()}

        {/* 会话历史（v2.2 A1） */}
        <div className="flex-1 min-h-0 flex flex-col border-t border-border">
          {renderConversationList()}
        </div>
        <div className="p-3 border-t border-border text-[11px] text-muted-foreground">
          {t('基于租户自有 AI 服务，会话自动保存')}
        </div>
      </aside>

      {/* 移动端顶部条 + 抽屉（v2.7.3：左轨不再隐藏，抽屉式展开） */}
      <div className="md:hidden flex items-center gap-2 border-b border-border bg-background px-4 py-2 shrink-0">
        <button onClick={() => setMobileNavOpen(true)} className="text-muted-foreground" aria-label={t('打开导航')}>
          <Menu className="w-4 h-4" />
        </button>
        {variant === 'page' && (
          <Link to="/portal/apps/ai/landing" className="text-muted-foreground">
            <ArrowLeft className="w-4 h-4" />
          </Link>
        )}
        <span className="text-sm font-bold">YIKnow</span>
        <span className="text-[11px] text-muted-foreground">{t('你问，我懂')}</span>
      </div>
      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent side="left" className="w-72 p-0">
          <SheetTitle className="sr-only">{t('YIKnow 导航')}</SheetTitle>
          <div className="flex h-full flex-col overflow-hidden">
            <div className="p-4 border-b border-border flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-md">
                <Bot className="w-5 h-5 text-white" />
              </div>
              <div className="text-sm font-bold">YIKnow</div>
            </div>
            {renderNavItems(() => setMobileNavOpen(false))}
            <div className="flex-1 min-h-0 flex flex-col border-t border-border">
              {renderConversationList()}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* 主区：智能对话 / 我的知识库 / 我的智能体 */}
      <main className="flex-1 min-w-0 flex flex-col">
        {view !== 'chat' ? (
          <YIKnowMyAssets kind={view} onNavigate={onNavigate} />
        ) : (
          <>
            <div className="flex-1 flex flex-col min-h-0 max-w-4xl w-full mx-auto px-4 sm:px-8 py-5">
              <div
                ref={listRef}
                onScroll={handleListScroll}
                className="flex-1 min-h-0 overflow-y-auto space-y-4 py-2"
              >
                {loadingConv ? (
                  <div className="flex items-center justify-center h-full">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-lg mb-4">
                      <Bot className="w-8 h-8 text-white" />
                    </div>
                    <h1 className="text-lg font-semibold">YIKnow {t('智能对话')}</h1>
                    <p className="text-sm text-muted-foreground mt-2 max-w-md">
                      {t('你好，我是 YIKnow 智能助手。输入内容开始对话，我会尽力帮助你。')}
                    </p>
                    <div className="flex flex-wrap justify-center gap-2 mt-5 max-w-lg">
                      {['帮我写一份实训报告大纲', '如何准备一场技术面试？', '推荐一些专业课的学习方法'].map((q) => (
                        <button
                          key={q}
                          onClick={() => handleSend(q)}
                          disabled={sending}
                          className="rounded-full border border-border bg-background px-3.5 py-1.5 text-xs text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors"
                        >
                          {t(q)}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  messages.map((m, i) => (
                    <div key={i} className={cn('group/msg flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
                      <div className={cn('max-w-[75%] flex flex-col', m.role === 'user' ? 'items-end' : 'items-start')}>
                        <div
                          className={`rounded-lg px-4 py-2 text-sm leading-relaxed break-words ${
                            m.role === 'user'
                              ? 'bg-primary text-primary-foreground whitespace-pre-wrap'
                              : 'bg-background border border-border'
                          }`}
                        >
                          {/* assistant 消息渲染 Markdown（GFM：表格/删除线/任务列表），流式增量直接渲染 */}
                          {m.role === 'assistant' ? (
                            <div className="ai-md">
                              <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ pre: CodeBlock }}>
                                {m.content}
                              </ReactMarkdown>
                              {sending && i === messages.length - 1 && m.content === '' && !m.failed && (
                                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                              )}
                            </div>
                          ) : (
                            m.content
                          )}
                        </div>
                        {/* 失败态：气泡内重试（替代静默吞掉） */}
                        {m.failed && (
                          <button
                            onClick={handleRetry}
                            className="mt-1 inline-flex items-center gap-1 text-xs text-destructive hover:underline"
                          >
                            <RotateCcw className="w-3 h-3" />
                            {t('生成失败 · 点击重试')}
                          </button>
                        )}
                        {/* 气泡操作：hover 复制；末条 assistant 支持重新生成 */}
                        {!m.failed && !sending && (
                          <div
                            className={cn(
                              'mt-1 flex items-center gap-2 opacity-0 group-hover/msg:opacity-100 transition-opacity',
                            )}
                          >
                            <button
                              onClick={() => copyMessage(i, m.content)}
                              className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-primary transition-colors"
                            >
                              {copiedIdx === i ? (
                                <Check className="w-3 h-3 text-emerald-500" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                              {copiedIdx === i ? t('已复制') : t('复制')}
                            </button>
                            {m.role === 'assistant' && i === lastAssistantIdx && (
                              <button
                                onClick={handleRegenerate}
                                className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-primary transition-colors"
                              >
                                <RotateCcw className="w-3 h-3" />
                                {t('重新生成')}
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
              {/* 输入区：Textarea 自适应（Enter 发送 / Shift+Enter 换行）；发送中变停止键 */}
              <div className="pt-3 flex gap-2 items-end">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => {
                    setInput(e.target.value)
                    autoResizeInput()
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                      e.preventDefault()
                      handleSend()
                    }
                  }}
                  placeholder={t('输入消息，Enter 发送，Shift+Enter 换行')}
                  disabled={sending}
                  rows={1}
                  className="flex-1 resize-none rounded-md border border-input bg-background px-3 py-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60 max-h-40"
                />
                {sending ? (
                  <Button
                    onClick={handleStop}
                    variant="outline"
                    className="shrink-0 text-destructive border-destructive/40 hover:bg-destructive/10"
                  >
                    <Square className="h-4 w-4 mr-1" />
                    {t('停止')}
                  </Button>
                ) : (
                  <Button onClick={() => handleSend()} disabled={!input.trim()} className="shrink-0">
                    <Send className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </>
        )}
      </main>
      <AiNotConfiguredDialog open={ai.notConfiguredOpen} onOpenChange={ai.setNotConfiguredOpen} />
    </div>
  )
}
