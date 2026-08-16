'use client'

// YIKnow 全局智能助手（/portal/apps/ai/chat）：公司主推产品入口（spec §2.1 YIKnow）。
// 布局对齐 docs/demo《YIKnow AI 对话》原型：左侧功能轨 + 智能对话主区。
// 左侧功能项（我的方案/岗位库/场景库/知识库/设置）为预留入口，本期仅占位（点击提示敬请期待）；
// 智能对话复用租户统一 AI 服务（sendAIChat），会话不保存、刷新即清空。
// 本页全宽自渲染（layout FULL_WIDTH_PAGES），不再叠加平台侧边栏。
import { useRef, useState } from 'react'
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
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { useToast } from '@zhiyu/ui'
import { sendAIChat } from '@/lib/api'
import type { AIChatMessage } from '@/lib/api'
import { useAiNotConfigured } from '@/lib/ai/use-ai-assist'
import { AiNotConfiguredDialog } from '@/components/shared/ai-not-configured-dialog'
import { useT } from '@/lib/i18n/locale-provider'

// 预留功能入口（本期仅占位）
const PLACEHOLDER_ITEMS = [
  { id: 'plans', label: '我的方案', icon: ClipboardList },
  { id: 'jobs', label: '岗位库', icon: Target },
  { id: 'scenes', label: '场景库', icon: Factory },
  { id: 'kbs', label: '知识库', icon: BookOpen },
  { id: 'settings', label: '设置', icon: Settings },
] as const

export default function YIKnowChatPage() {
  const [messages, setMessages] = useState<AIChatMessage[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)
  const { toast } = useToast()
  const t = useT()
  // 412 ai_not_configured 统一走共享 hook + 引导弹窗（与 AI 辅助编写三件套一致）
  const ai = useAiNotConfigured()

  const handleSend = async (preset?: string) => {
    const content = (preset ?? input).trim()
    if (!content || sending) return
    const next: AIChatMessage[] = [...messages, { role: 'user', content }]
    setMessages(next)
    setInput('')
    setSending(true)
    try {
      const res = await sendAIChat({ messages: next })
      setMessages([...next, { role: 'assistant', content: res.reply }])
      setTimeout(() => listRef.current?.scrollTo({ top: listRef.current.scrollHeight }), 0)
    } catch (err) {
      // 后端 412 固定返回 ai_not_configured（见 handler.AIHandler.Chat），命中即打开统一引导弹窗
      if (ai.markNotConfigured(err)) {
        // 未配置：不弹发送失败 toast
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

  return (
    <div className="flex h-[calc(100vh-3.5rem)] bg-[#f5f7fa]">
      {/* 左侧功能轨（YIKnow 原型） */}
      <aside className="hidden md:flex w-60 shrink-0 flex-col border-r border-border bg-background">
        <div className="p-4 border-b border-border">
          <Link
            href="/portal/apps/ai/landing"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors mb-3"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            {t('返回首页')}
          </Link>
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
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          <button
            className={cn(
              'w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm',
              'bg-primary text-white font-medium',
            )}
          >
            <MessageSquare className="w-4 h-4" />
            {t('智能对话')}
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
        <div className="p-3 border-t border-border text-[11px] text-muted-foreground">
          {t('基于租户自有 AI 服务，会话不保存，刷新即清空')}
        </div>
      </aside>

      {/* 移动端顶部条 */}
      <div className="md:hidden fixed top-14 left-0 right-0 z-30 flex items-center gap-2 border-b border-border bg-background px-4 py-2">
        <Link href="/portal/apps/ai/landing" className="text-muted-foreground">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <span className="text-sm font-bold">YIKnow</span>
        <span className="text-[11px] text-muted-foreground">{t('你问，我懂')}</span>
      </div>

      {/* 对话主区 */}
      <main className="flex-1 min-w-0 flex flex-col max-md:pt-10">
        <div className="flex-1 flex flex-col min-h-0 max-w-3xl w-full mx-auto px-4 sm:px-6 py-4">
          <div ref={listRef} className="flex-1 min-h-0 overflow-y-auto space-y-4 py-2">
            {messages.length === 0 && (
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
            )}
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[80%] rounded-lg px-4 py-2 text-sm whitespace-pre-wrap break-words ${
                    m.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-background border border-border'
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))}
            {sending && (
              <div className="flex justify-start">
                <div className="bg-background border border-border rounded-lg px-4 py-2">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              </div>
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
      </main>
      <AiNotConfiguredDialog open={ai.notConfiguredOpen} onOpenChange={ai.setNotConfiguredOpen} />
    </div>
  )
}
