'use client'

// 智能体编辑器右栏实时试聊面板（v2.2 B7 上线，v2.6 升级为 sticky 右栏，对齐 zhiyu-ai builder 右预览面板）：
// 用表单当前提示词（未保存也可预览）调 POST /ai/agents/{id}/preview（owner 专属、不落库、不计对话数）。
import { useRef, useState } from 'react'
import { Loader2, MessageSquare, RotateCcw, Send, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { aiCenterV22Api } from '@/lib/api'
import { useToast } from '@zhiyu/ui'
import { useT } from '@/lib/i18n/locale-provider'
import { useAiNotConfigured } from '@/lib/ai/use-ai-assist'
import { AiNotConfiguredDialog } from '@/components/shared/ai-not-configured-dialog'

interface PreviewMsg {
  role: 'user' | 'assistant'
  content: string
}

export function AgentPreviewPanel({
  agentId,
  systemPrompt,
  avatar,
  name,
}: {
  agentId: string
  systemPrompt: string
  avatar?: string
  name?: string
}) {
  const t = useT()
  const { toast } = useToast()
  const ai = useAiNotConfigured()
  const [messages, setMessages] = useState<PreviewMsg[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)

  const handleSend = async () => {
    const content = input.trim()
    if (!content || sending) return
    setMessages((prev) => [...prev, { role: 'user', content }])
    setInput('')
    setSending(true)
    try {
      const res = await aiCenterV22Api.previewAgent(agentId, systemPrompt, content)
      setMessages((prev) => [...prev, { role: 'assistant', content: res.reply }])
      setTimeout(() => listRef.current?.scrollTo({ top: listRef.current.scrollHeight }), 0)
    } catch (err) {
      if (!ai.markNotConfigured(err)) {
        toast({
          title: t('预览失败'),
          description: err instanceof Error ? err.message : undefined,
          variant: 'destructive',
        })
      }
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-[#e7e5e4] shadow-[0_2px_6px_rgba(0,0,0,0.04)] overflow-hidden flex flex-col h-[calc(100vh-8.5rem)] sticky top-[7.5rem]">
      {/* 面板头 */}
      <div className="px-5 py-4 border-b border-dashed border-[#e7e5e4] flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center text-xl shadow-sm">
          {avatar || '🤖'}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold truncate">{name?.trim() || t('未命名智能体')}</div>
          <div className="text-xs text-muted-foreground flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-primary" />
            {t('实时试聊 · 用当前提示词，不产生记录')}
          </div>
        </div>
        {messages.length > 0 && (
          <button
            onClick={() => setMessages([])}
            className="text-muted-foreground hover:text-primary transition-colors"
            title={t('清空对话')}
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* 消息区 */}
      <div ref={listRef} className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-3 bg-[#fafbfc]">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-3">
              <MessageSquare className="w-6 h-6 text-primary" />
            </div>
            <p className="text-sm text-muted-foreground">{t('输入一句话试试当前配置的效果')}</p>
            <p className="text-xs text-muted-foreground/70 mt-1">{t('左侧提示词改动即时生效，无需先保存')}</p>
          </div>
        ) : (
          messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm whitespace-pre-wrap break-words leading-relaxed ${
                  m.role === 'user'
                    ? 'bg-primary text-primary-foreground rounded-tr-sm'
                    : 'bg-white border border-[#e7e5e4] rounded-tl-sm shadow-sm'
                }`}
              >
                {m.content}
              </div>
            </div>
          ))
        )}
        {sending && (
          <div className="flex justify-start">
            <div className="bg-white border border-[#e7e5e4] rounded-2xl rounded-tl-sm px-3.5 py-2 shadow-sm">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          </div>
        )}
      </div>

      {/* 输入区 */}
      <div className="px-4 py-3 border-t border-[#e7e5e4] flex gap-2 bg-white">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.nativeEvent.isComposing) handleSend()
          }}
          placeholder={t('输入测试消息，Enter 发送')}
          disabled={sending}
          className="h-10 text-sm bg-[#f5f7fa]"
        />
        <Button size="sm" onClick={handleSend} disabled={sending || !input.trim()} className="h-10 px-4">
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
      <AiNotConfiguredDialog open={ai.notConfiguredOpen} onOpenChange={ai.setNotConfiguredOpen} />
    </div>
  )
}
