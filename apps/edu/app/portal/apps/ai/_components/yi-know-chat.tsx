'use client'

// YIKnow 全局智能助手（/portal/apps/ai/chat）：公司主推产品入口（spec §2.1 YIKnow）。
// 布局对齐 docs/demo《YIKnow AI 对话》原型：左侧功能轨 + 智能对话主区。
// v2.2 A1：会话持久化——SSE 流式对话（streamYiknowChat）+ 左侧会话历史（新建/继续/删除）。
// 左侧功能项（我的方案/岗位库/场景库/知识库/设置）为预留入口，本期仅占位（点击提示敬请期待）。
// v2.7：聊天体验抽为共享组件 YIKnowChat（variant page/modal）——所有前台入口统一弹窗打开，
// /chat 路由保留直达（page 变体）。本页全宽自渲染（layout FULL_WIDTH_PAGES），不叠加平台侧边栏。
import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
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
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
  const listRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const { toast } = useToast()
  const t = useT()
  // 412 ai_not_configured 统一走共享 hook + 引导弹窗（与 AI 辅助编写三件套一致）
  const ai = useAiNotConfigured()

  const scrollToBottom = useCallback(() => {
    setTimeout(() => listRef.current?.scrollTo({ top: listRef.current.scrollHeight }), 0)
  }, [])

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
    setActiveConvId(null)
    setMessages([])
    setInput('')
  }

  const openConversation = async (id: string) => {
    if (id === activeConvId || loadingConv) return
    abortRef.current?.abort()
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
      scrollToBottom()
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

  const handleSend = async (preset?: string) => {
    const content = (preset ?? input).trim()
    if (!content || sending) return
    setMessages((prev) => [...prev, { role: 'user', content }, { role: 'assistant', content: '' }])
    setInput('')
    setSending(true)
    scrollToBottom()
    abortRef.current = new AbortController()
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
            setMessages((prev) => prev.slice(0, -1))
            toast({ title: t('发送失败'), description: message, variant: 'destructive' })
          },
        },
        abortRef.current.signal,
      )
    } catch (err) {
      setMessages((prev) => prev.slice(0, -1))
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
    }
  }

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
              href="/portal/apps/ai/landing"
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
        <nav className="p-3 space-y-1">
          <button
            onClick={() => setView('chat')}
            className={cn(
              'w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm transition-colors',
              view === 'chat'
                ? 'bg-primary text-white font-medium'
                : 'text-muted-foreground hover:bg-muted',
            )}
          >
            <MessageSquare className="w-4 h-4" />
            {t('智能对话')}
          </button>
          <button
            onClick={() => setView('kbs')}
            className={cn(
              'w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm transition-colors',
              view === 'kbs'
                ? 'bg-primary text-white font-medium'
                : 'text-muted-foreground hover:bg-muted',
            )}
          >
            <BookOpen className="w-4 h-4" />
            {t('我的知识库')}
          </button>
          <button
            onClick={() => setView('agents')}
            className={cn(
              'w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm transition-colors',
              view === 'agents'
                ? 'bg-primary text-white font-medium'
                : 'text-muted-foreground hover:bg-muted',
            )}
          >
            <Bot className="w-4 h-4" />
            {t('我的智能体')}
          </button>
          {PLACEHOLDER_ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() =>
                toast({ title: t('功能建设中，敬请期待'), description: t(item.label) })
              }
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

        {/* 会话历史（v2.2 A1） */}
        <div className="flex-1 min-h-0 flex flex-col border-t border-border">
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
          <div className="flex-1 min-h-0 overflow-y-auto px-2 pb-2 space-y-0.5">
            {conversations.length === 0 && (
              <p className="text-[11px] text-muted-foreground px-2 py-3">{t('暂无历史会话')}</p>
            )}
            {conversations.map((c) => (
              <div
                key={c.id}
                className={cn(
                  'group flex items-center gap-1 rounded-lg px-2.5 py-2 text-xs cursor-pointer transition-colors',
                  c.id === activeConvId ? 'bg-primary/10 text-primary' : 'text-foreground hover:bg-muted',
                )}
                onClick={() => openConversation(c.id)}
              >
                <span className="flex-1 min-w-0 truncate">{c.title || t('未命名会话')}</span>
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
        <div className="p-3 border-t border-border text-[11px] text-muted-foreground">
          {t('基于租户自有 AI 服务，会话自动保存')}
        </div>
      </aside>

      {/* 移动端顶部条（弹窗变体由 Dialog 自带关闭按钮，不渲染返回） */}
      <div className="md:hidden flex items-center gap-2 border-b border-border bg-background px-4 py-2">
        {variant === 'page' && (
          <Link href="/portal/apps/ai/landing" className="text-muted-foreground">
            <ArrowLeft className="w-4 h-4" />
          </Link>
        )}
        <span className="text-sm font-bold">YIKnow</span>
        <span className="text-[11px] text-muted-foreground">{t('你问，我懂')}</span>
      </div>

      {/* 主区：智能对话 / 我的知识库 / 我的智能体 */}
      <main className="flex-1 min-w-0 flex flex-col">
        {view !== 'chat' ? (
          <YIKnowMyAssets kind={view} onNavigate={onNavigate} />
        ) : (
          <>
        <div className="flex-1 flex flex-col min-h-0 max-w-4xl w-full mx-auto px-4 sm:px-8 py-5">
          <div ref={listRef} className="flex-1 min-h-0 overflow-y-auto space-y-4 py-2">
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
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[75%] rounded-lg px-4 py-2 text-sm leading-relaxed break-words ${
                      m.role === 'user'
                        ? 'bg-primary text-primary-foreground whitespace-pre-wrap'
                        : 'bg-background border border-border'
                    }`}
                  >
                    {/* assistant 消息渲染 Markdown（GFM：表格/删除线/任务列表），流式增量直接渲染 */}
                    {m.role === 'assistant' ? (
                      <div className="ai-md">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
                        {sending && i === messages.length - 1 && m.content === '' && (
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        )}
                      </div>
                    ) : (
                      m.content
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="pt-3 flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.nativeEvent.isComposing) handleSend()
              }}
              placeholder={t('输入消息，Enter 发送')}
              disabled={sending}
              className="bg-background"
            />
            <Button onClick={() => handleSend()} disabled={sending || !input.trim()}>
              {sending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
          </>
        )}
      </main>
      <AiNotConfiguredDialog open={ai.notConfiguredOpen} onOpenChange={ai.setNotConfiguredOpen} />
    </div>
  )
}
