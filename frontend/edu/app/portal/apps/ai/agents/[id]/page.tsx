'use client'

// 智能体对话页（spec §5.2/§5.5 / WBS F7）：
// 左侧会话列表（桌面端）+ SSE 流式对话（meta 记 conversationId、sources 溯源、delta 打字机）。
import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Bot,
  Loader2,
  MessageSquare,
  Plus,
  Send,
  Square,
  Trash2,
} from 'lucide-react'
import {
  aiCenterAgentApi,
  streamAICenter,
  type AIAgent,
  type AIConversation,
  type AIMessageSource,
} from '@/lib/api'
import { useToast, ConfirmDialog, EmptyState, LoadingView } from '@zhiyu/ui'
import { useT } from '@/lib/i18n/locale-provider'
import { useAiNotConfigured, isAbortError } from '@/lib/ai/use-ai-assist'
import { AiNotConfiguredDialog } from '@/components/shared/ai-not-configured-dialog'
import { AICenterFavoriteButton } from '../../_components/favorite-button'
import { AISourceList } from '../../_components/source-list'
import { cn } from '@/lib/utils'

interface ChatMsg {
  id: string
  role: 'user' | 'assistant'
  content: string
  sources: AIMessageSource[]
  streaming?: boolean
  failed?: boolean
}

export default function AIAgentChatPage() {
  const t = useT()
  const { toast } = useToast()
  const params = useParams()
  const agentId = String(params.id)
  const ai = useAiNotConfigured()

  const [agent, setAgent] = useState<AIAgent | null>(null)
  const [agentLoading, setAgentLoading] = useState(true)

  const [conversations, setConversations] = useState<AIConversation[]>([])
  const [activeConvId, setActiveConvId] = useState<string | undefined>(undefined)
  const [historyLoading, setHistoryLoading] = useState(false)

  const [messages, setMessages] = useState<ChatMsg[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState<AIConversation | null>(null)
  const [deleting, setDeleting] = useState(false)

  const abortRef = useRef<AbortController | null>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const refreshConversations = useCallback(async () => {
    try {
      const res = await aiCenterAgentApi.listConversations(agentId)
      setConversations(res.items)
    } catch {
      // 会话列表失败不打扰主流程
    }
  }, [agentId])

  useEffect(() => {
    let alive = true
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 路由参数 agentId 变化时重新进入加载态
    setAgentLoading(true)
    aiCenterAgentApi
      .get(agentId)
      .then((res) => {
        if (alive) setAgent(res)
      })
      .catch((err) => {
        if (!alive) return
        toast({
          title: t('加载失败'),
          description: err instanceof Error ? err.message : undefined,
          variant: 'destructive',
        })
      })
      .finally(() => {
        if (alive) setAgentLoading(false)
      })
    refreshConversations()
    return () => {
      alive = false
    }
  }, [agentId, refreshConversations, toast, t])

  // 卸载时中断进行中的流
  useEffect(() => () => abortRef.current?.abort(), [])

  const scrollToBottom = () =>
    setTimeout(() => listRef.current?.scrollTo({ top: listRef.current.scrollHeight }), 0)

  const patchMsg = (id: string, patch: Partial<ChatMsg>) =>
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)))

  const openConversation = async (conv: AIConversation) => {
    if (conv.id === activeConvId) return
    abortRef.current?.abort()
    setSending(false)
    setActiveConvId(conv.id)
    setHistoryLoading(true)
    setMessages([])
    try {
      const res = await aiCenterAgentApi.getConversation(conv.id)
      setMessages(
        res.messages.map((m) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          sources: m.sources || [],
        })),
      )
      scrollToBottom()
    } catch (err) {
      toast({
        title: t('加载失败'),
        description: err instanceof Error ? err.message : undefined,
        variant: 'destructive',
      })
    } finally {
      setHistoryLoading(false)
    }
  }

  const startNewConversation = () => {
    abortRef.current?.abort()
    setSending(false)
    setActiveConvId(undefined)
    setMessages([])
  }

  const handleDeleteConversation = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await aiCenterAgentApi.removeConversation(deleteTarget.id)
      if (activeConvId === deleteTarget.id) startNewConversation()
      await refreshConversations()
      setDeleteTarget(null)
    } catch (err) {
      toast({
        title: t('操作失败'),
        description: err instanceof Error ? err.message : undefined,
        variant: 'destructive',
      })
    } finally {
      setDeleting(false)
    }
  }

  const handleSend = async () => {
    const content = input.trim()
    if (!content || sending) return
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    const userMsg: ChatMsg = {
      id: `local-u-${crypto.randomUUID()}`,
      role: 'user',
      content,
      sources: [],
    }
    const assistantId = `local-a-${crypto.randomUUID()}`
    const assistantMsg: ChatMsg = {
      id: assistantId,
      role: 'assistant',
      content: '',
      sources: [],
      streaming: true,
    }
    setMessages((prev) => [...prev, userMsg, assistantMsg])
    setInput('')
    setSending(true)
    scrollToBottom()

    // 新会话首条消息不带 conversationId；onMeta 回发后后续沿用（spec §5.5）
    const convIdAtSend = activeConvId
    try {
      await streamAICenter(
        `/ai/agents/${agentId}/chat`,
        { conversationId: convIdAtSend, message: content },
        {
          onMeta: (data) => {
            if (!convIdAtSend && data.conversationId) {
              setActiveConvId(data.conversationId)
            }
          },
          onSources: (sources) => patchMsg(assistantId, { sources }),
          onDelta: (text) => {
            setMessages((prev) =>
              prev.map((m) => (m.id === assistantId ? { ...m, content: m.content + text } : m)),
            )
            scrollToBottom()
          },
          onDone: () => {
            patchMsg(assistantId, { streaming: false })
            // 首条消息后后端生成会话标题，刷新列表
            refreshConversations()
          },
          onError: (code, errMsg) => {
            patchMsg(assistantId, { streaming: false, failed: true })
            toast({ title: t('发送失败'), description: errMsg || code, variant: 'destructive' })
          },
        },
        controller.signal,
      )
    } catch (err) {
      patchMsg(assistantId, { streaming: false, failed: true })
      if (isAbortError(err)) {
        // 用户主动停止/切换会话：保留已输出内容
      } else if (ai.markNotConfigured(err)) {
        // 412 ai_not_configured：统一引导弹窗
      } else {
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

  const handleStop = () => {
    abortRef.current?.abort()
  }

  if (agentLoading) return <LoadingView text={t('加载中')} />
  if (!agent) {
    return (
      <EmptyState
        icon={<Bot className="h-10 w-10" />}
        title={t('智能体不存在或无权访问')}
      />
    )
  }

  return (
    <div className="max-w-6xl mx-auto flex gap-4 h-[calc(100vh-3.5rem)] px-4 sm:px-8 py-4">
      {/* 会话列表（桌面端） */}
      <aside className="hidden md:flex w-60 shrink-0 flex-col rounded-lg border border-gray-100 bg-white shadow-sm">
        <div className="p-3 border-b border-gray-100">
          <Button variant="outline" size="sm" className="w-full" onClick={startNewConversation}>
            <Plus className="h-4 w-4 mr-1" />
            {t('新对话')}
          </Button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-1">
          {conversations.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-6">{t('暂无会话')}</p>
          ) : (
            conversations.map((conv) => (
              <div
                key={conv.id}
                onClick={() => openConversation(conv)}
                className={cn(
                  'group flex items-center gap-2 rounded-md px-3 py-2 text-sm cursor-pointer hover:bg-muted',
                  activeConvId === conv.id && 'bg-muted font-medium',
                )}
              >
                <MessageSquare className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="truncate flex-1">{conv.title || t('未命名会话')}</span>
                <button
                  type="button"
                  title={t('删除会话')}
                  onClick={(e) => {
                    e.stopPropagation()
                    setDeleteTarget(conv)
                  }}
                  className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))
          )}
        </div>
      </aside>

      {/* 对话主区 */}
      <div className="flex-1 min-w-0 rounded-lg border border-gray-100 bg-white shadow-sm flex flex-col min-h-0 overflow-hidden">
        {agent.coverImage && (
          <div
            className="h-20 shrink-0"
            style={{ backgroundImage: `url('${agent.coverImage}')`, backgroundSize: 'cover', backgroundPosition: 'center' }}
          />
        )}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center text-xl shrink-0">
            {agent.avatar || <Bot className="w-4 h-4 text-primary" />}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-base font-semibold truncate">{agent.name}</h1>
            {agent.description && (
              <p className="text-xs text-muted-foreground truncate">{agent.description}</p>
            )}
          </div>
          <AICenterFavoriteButton targetType="ai_agent" targetId={agent.id} className="shrink-0" />
        </div>

        <div ref={listRef} className="flex-1 min-h-0 overflow-y-auto px-6 py-4 space-y-4">
          {historyLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {messages.length === 0 &&
                (agent.greeting ? (
                  <div className="flex justify-start">
                    <div className="max-w-[80%] rounded-lg px-4 py-2 text-sm bg-muted whitespace-pre-wrap break-words">
                      {agent.greeting}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center mt-16">
                    {t('输入内容开始对话')}
                  </p>
                ))}
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}
                >
                  <div
                    className={cn(
                      'max-w-[80%] rounded-lg px-4 py-2 text-sm whitespace-pre-wrap break-words',
                      m.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted',
                    )}
                  >
                    {m.content || (m.streaming ? t('思考中') : '')}
                    {m.streaming && m.content && (
                      <Loader2 className="inline h-3 w-3 animate-spin ml-1 text-muted-foreground" />
                    )}
                    {m.failed && (
                      <p className="text-xs text-destructive mt-1">{t('回答中断，请重试')}</p>
                    )}
                    {m.role === 'assistant' && <AISourceList sources={m.sources} />}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.nativeEvent.isComposing) handleSend()
            }}
            placeholder={t('输入消息，Enter 发送')}
            disabled={sending}
          />
          {sending ? (
            <Button variant="outline" onClick={handleStop} title={t('停止生成')}>
              <Square className="h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={handleSend} disabled={!input.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
        title={t('删除会话')}
        description={t('确认删除该会话？删除后不可恢复')}
        confirmText={t('删除')}
        cancelText={t('取消')}
        variant="destructive"
        pending={deleting}
        onConfirm={handleDeleteConversation}
      />
      <AiNotConfiguredDialog open={ai.notConfiguredOpen} onOpenChange={ai.setNotConfiguredOpen} />
    </div>
  )
}
