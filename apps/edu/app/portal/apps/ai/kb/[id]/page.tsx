'use client'

// 知识库详情 + 库内问答（spec §5.1 / WBS F6）：
// 详情与文档目录只读展示；「问一问」走 SSE 流式（meta 可忽略，delta 追加，sources 溯源）。
import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowLeft, BookOpen, FileText, HelpCircle, Loader2, Send, User } from 'lucide-react'
import {
  aiCenterKbApi,
  streamAICenter,
  type AIKBDocument,
  type AIKnowledgeBase,
  type AIMessageSource,
} from '@/lib/api'
import { useToast, EmptyState, LoadingView } from '@zhiyu/ui'
import { useT } from '@/lib/i18n/locale-provider'
import { useAiNotConfigured, isAbortError } from '@/lib/ai/use-ai-assist'
import { AiNotConfiguredDialog } from '@/components/shared/ai-not-configured-dialog'
import { AICenterFavoriteButton } from '../../_components/favorite-button'
import { AISourceList } from '../../_components/source-list'

interface QAItem {
  id: string
  question: string
  answer: string
  sources: AIMessageSource[]
  streaming: boolean
  failed?: boolean
}

function docStatusBadge(status: AIKBDocument['status'], t: (k: string) => string) {
  if (status === 'ready') return <Badge variant="secondary">{t('就绪')}</Badge>
  if (status === 'parsing') return <Badge variant="outline">{t('解析中')}</Badge>
  return <Badge variant="destructive">{t('解析失败')}</Badge>
}

export default function AIKbDetailPage() {
  const t = useT()
  const router = useRouter()
  const { toast } = useToast()
  const params = useParams()
  const kbId = String(params.id)
  const ai = useAiNotConfigured()

  const [kb, setKb] = useState<AIKnowledgeBase | null>(null)
  const [docs, setDocs] = useState<AIKBDocument[]>([])
  const [loading, setLoading] = useState(true)

  const [qaList, setQaList] = useState<QAItem[]>([])
  const [input, setInput] = useState('')
  const [asking, setAsking] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let alive = true
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 路由参数 kbId 变化时重新进入加载态
    setLoading(true)
    Promise.all([aiCenterKbApi.get(kbId), aiCenterKbApi.listDocuments(kbId)])
      .then(([kbRes, docRes]) => {
        if (!alive) return
        setKb(kbRes)
        setDocs(docRes.items)
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
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [kbId, toast, t])

  // 卸载时中断进行中的流
  useEffect(() => () => abortRef.current?.abort(), [])

  const scrollToBottom = () =>
    setTimeout(() => listRef.current?.scrollTo({ top: listRef.current.scrollHeight }), 0)

  const patchQA = (id: string, patch: Partial<QAItem>) =>
    setQaList((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)))

  const handleAsk = async () => {
    const message = input.trim()
    if (!message || asking) return
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    const qaId = `qa-${crypto.randomUUID()}`
    setQaList((prev) => [...prev, { id: qaId, question: message, answer: '', sources: [], streaming: true }])
    setInput('')
    setAsking(true)
    scrollToBottom()

    try {
      await streamAICenter(
        `/ai/kb/${kbId}/ask`,
        { message },
        {
          onDelta: (text) => {
            setQaList((prev) =>
              prev.map((item) => (item.id === qaId ? { ...item, answer: item.answer + text } : item)),
            )
            scrollToBottom()
          },
          onSources: (sources) => patchQA(qaId, { sources }),
          onDone: () => patchQA(qaId, { streaming: false }),
          onError: (code, errMsg) => {
            patchQA(qaId, { streaming: false, failed: true })
            toast({ title: t('发送失败'), description: errMsg || code, variant: 'destructive' })
          },
        },
        controller.signal,
      )
    } catch (err) {
      patchQA(qaId, { streaming: false, failed: true })
      if (isAbortError(err)) {
        // 用户中断/组件卸载：保留已输出内容
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
      setAsking(false)
    }
  }

  if (loading) return <LoadingView text={t('加载中')} />
  if (!kb) {
    return (
      <EmptyState
        icon={<BookOpen className="h-10 w-10" />}
        title={t('知识库不存在或无权访问')}
        action={
          <Button variant="outline" onClick={() => router.push('/portal/apps/ai/square')}>
            {t('返回广场')}
          </Button>
        }
      />
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <Button variant="ghost" size="sm" onClick={() => router.push('/portal/apps/ai/square')}>
        <ArrowLeft className="h-4 w-4 mr-1" />
        {t('返回广场')}
      </Button>

      <Card>
        <CardContent className="p-5 space-y-3">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <BookOpen className="h-6 w-6 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-lg font-semibold">{kb.name}</h1>
              <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">
                {kb.description || t('无描述')}
              </p>
            </div>
            <AICenterFavoriteButton targetType="ai_kb" targetId={kb.id} className="shrink-0" />
          </div>
          {(kb.tags || []).length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {kb.tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="text-xs">
                  {tag}
                </Badge>
              ))}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <FileText className="h-3.5 w-3.5" />
              {t('{count} 个文档', { count: kb.docCount })}
            </span>
            <span className="inline-flex items-center gap-1">
              <HelpCircle className="h-3.5 w-3.5" />
              {t('{count} 次提问', { count: kb.askCount })}
            </span>
            <span className="inline-flex items-center gap-1">
              <User className="h-3.5 w-3.5" />
              {kb.ownerName || t('未知')}
            </span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t('文档列表')}</CardTitle>
        </CardHeader>
        <CardContent>
          {docs.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">{t('暂无文档')}</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {docs.map((doc) => (
                <li key={doc.id} className="py-2.5 flex items-center gap-3">
                  <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-sm truncate flex-1">{doc.name}</span>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {t('{count} 个分块', { count: doc.chunkCount })}
                  </span>
                  {docStatusBadge(doc.status, t)}
                  {doc.status === 'failed' && doc.error && (
                    <span className="text-xs text-destructive truncate max-w-40" title={doc.error}>
                      {doc.error}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t('问一问')}</CardTitle>
          <p className="text-xs text-muted-foreground">
            {t('基于库内文档回答，回答附来源片段')}
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div ref={listRef} className="max-h-96 overflow-y-auto space-y-4 pr-1">
            {qaList.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">
                {t('输入问题开始问答')}
              </p>
            )}
            {qaList.map((item) => (
              <div key={item.id} className="space-y-2">
                <div className="flex justify-end">
                  <div className="max-w-[80%] rounded-lg px-4 py-2 text-sm bg-primary text-primary-foreground whitespace-pre-wrap break-words">
                    {item.question}
                  </div>
                </div>
                <div className="flex justify-start">
                  <div className="max-w-[85%] rounded-lg px-4 py-2 text-sm bg-muted whitespace-pre-wrap break-words">
                    {item.answer || (item.streaming ? t('思考中') : '')}
                    {item.streaming && item.answer && (
                      <Loader2 className="inline h-3 w-3 animate-spin ml-1 text-muted-foreground" />
                    )}
                    {item.failed && (
                      <p className="text-xs text-destructive mt-1">{t('回答中断，请重试')}</p>
                    )}
                    <AISourceList sources={item.sources} />
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.nativeEvent.isComposing) handleAsk()
              }}
              placeholder={t('输入问题，Enter 发送')}
              disabled={asking}
            />
            <Button onClick={handleAsk} disabled={asking || !input.trim()}>
              {asking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </CardContent>
      </Card>

      <AiNotConfiguredDialog open={ai.notConfiguredOpen} onOpenChange={ai.setNotConfiguredOpen} />
    </div>
  )
}
