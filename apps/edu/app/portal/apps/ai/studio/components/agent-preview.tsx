'use client'

// 智能体编辑器内实时试聊面板（v2.2 B7）：用表单当前提示词（未保存也可预览）调
// POST /ai/agents/{id}/preview（owner 专属、不落库、不计对话数）。
import { useRef, useState } from 'react'
import { Loader2, MessageSquare, Send } from 'lucide-react'
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
}: {
  agentId: string
  systemPrompt: string
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
    <div className="space-y-2 rounded-md border border-dashed border-primary/30 bg-primary/[0.02] p-4">
      <div className="flex items-center gap-2 text-sm font-medium">
        <MessageSquare className="h-4 w-4 text-primary" />
        {t('实时试聊')}
        <span className="text-xs text-muted-foreground font-normal">
          {t('使用上方当前提示词，无需先保存；不产生对话记录')}
        </span>
      </div>
      <div ref={listRef} className="max-h-56 overflow-y-auto space-y-2 pr-1">
        {messages.length === 0 && (
          <p className="text-xs text-muted-foreground py-3 text-center">
            {t('输入一句话试试当前配置的效果')}
          </p>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] rounded-lg px-3 py-1.5 text-sm whitespace-pre-wrap break-words ${
                m.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'
              }`}
            >
              {m.content}
            </div>
          </div>
        ))}
        {sending && (
          <div className="flex justify-start">
            <div className="bg-muted rounded-lg px-3 py-1.5">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
            </div>
          </div>
        )}
      </div>
      <div className="flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.nativeEvent.isComposing) handleSend()
          }}
          placeholder={t('输入测试消息，Enter 发送')}
          disabled={sending}
          className="bg-background h-9 text-sm"
        />
        <Button size="sm" onClick={handleSend} disabled={sending || !input.trim()}>
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
      <AiNotConfiguredDialog open={ai.notConfiguredOpen} onOpenChange={ai.setNotConfiguredOpen} />
    </div>
  )
}
