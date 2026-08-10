'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Loader2, Send, Sparkles, Settings } from 'lucide-react'
import { useToast } from '@zhiyu/ui'
import { sendAIChat } from '@/lib/api'
import type { AIChatMessage } from '@/lib/api'
import { useT } from '@/lib/i18n/locale-provider'

export default function AIChatPage() {
  const [messages, setMessages] = useState<AIChatMessage[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [notConfigured, setNotConfigured] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)
  const { toast } = useToast()
  const t = useT()

  const handleSend = async () => {
    const content = input.trim()
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
      // 后端 412 固定返回 ai_not_configured（见 handler.AIHandler.Chat）
      if (err instanceof Error && err.message === 'ai_not_configured') {
        setNotConfigured(true)
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

  if (notConfigured) {
    return (
      <div className="max-w-2xl mx-auto mt-16">
        <div className="rounded-lg border border-gray-100 bg-white shadow-sm px-8 py-10 text-center">
          <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mx-auto">
            <Settings className="w-6 h-6 text-primary" />
          </div>
          <h2 className="text-lg font-semibold mt-4">{t('尚未配置 AI 服务')}</h2>
          <p className="text-sm text-muted-foreground mt-2">
            {t('请先在 系统管理 > 租户信息 中配置 AI 服务')}
          </p>
          <Button asChild className="mt-6">
            <Link href="/portal/apps/system/tenant">{t('前往配置')}</Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto flex flex-col h-[calc(100vh-8rem)]">
      <div className="rounded-lg border border-gray-100 bg-white shadow-sm flex flex-col flex-1 min-h-0">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h1 className="text-base font-semibold">{t('AI 助手')}</h1>
            <p className="text-xs text-muted-foreground">
              {t('基于租户自有 AI 服务，会话不保存，刷新即清空')}
            </p>
          </div>
        </div>
        <div ref={listRef} className="flex-1 min-h-0 overflow-y-auto px-6 py-4 space-y-4">
          {messages.length === 0 && (
            <p className="text-sm text-muted-foreground text-center mt-16">
              {t('输入内容开始对话')}
            </p>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[80%] rounded-lg px-4 py-2 text-sm whitespace-pre-wrap break-words ${
                  m.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'
                }`}
              >
                {m.content}
              </div>
            </div>
          ))}
          {sending && (
            <div className="flex justify-start">
              <div className="bg-muted rounded-lg px-4 py-2">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            </div>
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
          <Button onClick={handleSend} disabled={sending || !input.trim()}>
            {sending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
