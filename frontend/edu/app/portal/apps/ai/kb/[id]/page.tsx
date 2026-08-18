'use client'

// 知识库详情 + 库内问答（spec §5.1 / WBS F6）：
// 详情与文档目录只读展示；「问一问」走 SSE 流式（meta 可忽略，delta 追加，sources 溯源）。
import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowLeft, BookOpen, Eye, FileText, HelpCircle, Loader2, Send, User, Users } from 'lucide-react'
import {
  aiCenterKbApi,
  aiCenterV22Api,
  streamAICenter,
  type AIKBAsk,
  type AIKBCollaborator,
  type AIKBDocument,
  type AIKnowledgeBase,
  type AIMessageSource,
} from '@/lib/api'
import { useToast, EmptyState, LoadingView } from '@zhiyu/ui'
import { useT } from '@/lib/i18n/locale-provider'
import { useAiNotConfigured, isAbortError } from '@/lib/ai/use-ai-assist'
import { AiNotConfiguredDialog } from '@/components/shared/ai-not-configured-dialog'
import { coverGradientFor } from '@/lib/cover-gradients'
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
  const navigate = useNavigate()
  const { toast } = useToast()
  const params = useParams()
  const kbId = String(params.id)
  const ai = useAiNotConfigured()

  const [kb, setKb] = useState<AIKnowledgeBase | null>(null)
  const [docs, setDocs] = useState<AIKBDocument[]>([])
  const [collaborators, setCollaborators] = useState<AIKBCollaborator[]>([])
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
    Promise.all([
      aiCenterKbApi.get(kbId),
      aiCenterKbApi.listDocuments(kbId),
      aiCenterKbApi.listCollaborators(kbId).catch(() => ({ items: [] as AIKBCollaborator[] })),
      aiCenterV22Api.listMyKBAsks(kbId).catch(() => ({ items: [] as AIKBAsk[] })),
    ])
      .then(([kbRes, docRes, colRes, askRes]) => {
        if (!alive) return
        setKb(kbRes)
        setDocs(docRes.items)
        setCollaborators(colRes.items || [])
        // B6：历史问答并入问答列表（时间升序展示）
        setQaList(
          (askRes.items || [])
            .slice()
            .reverse()
            .map((a) => ({ id: a.id, question: a.question, answer: a.answer, sources: [], streaming: false })),
        )
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
          <Button variant="outline" onClick={() => navigate('/portal/apps/ai/landing#square')}>
            {t('返回广场')}
          </Button>
        }
      />
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-4 px-4 sm:px-8 py-6">
      <Button variant="ghost" size="sm" onClick={() => navigate('/portal/apps/ai/landing#square')}>
        <ArrowLeft className="h-4 w-4 mr-1" />
        {t('返回广场')}
      </Button>

      <Card className="overflow-hidden">
        {/* 封面横幅：coverImage 优先，无则渐变 + 图标（对齐卡片族模式） */}
        <div
          className="h-32 flex items-center justify-center relative"
          style={
            kb.coverImage
              ? { backgroundImage: `url('${kb.coverImage}')`, backgroundSize: 'cover', backgroundPosition: 'center' }
              : { background: coverGradientFor(kb.id) }
          }
        >
          {!kb.coverImage && <BookOpen className="h-10 w-10 text-white/80" />}
        </div>
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
              <Eye className="h-3.5 w-3.5" />
              {t('{count} 次浏览', { count: kb.viewCount ?? 0 })}
            </span>
            <span className="inline-flex items-center gap-1">
              <User className="h-3.5 w-3.5" />
              {kb.ownerName || t('未知')}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* 贡献者区（A2 原型对齐：创建者 + 协作者头像缩写 + 角色） */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            {t('贡献者')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <div className="flex items-center gap-2 rounded-full border border-border pl-1 pr-3 py-1">
              <span className="w-7 h-7 rounded-full bg-primary/10 text-primary text-xs font-semibold flex items-center justify-center">
                {(kb.ownerName || '?').slice(0, 1)}
              </span>
              <span className="text-sm">{kb.ownerName || t('未知')}</span>
              <Badge variant="secondary" className="text-[10px]">{t('创建者')}</Badge>
            </div>
            {collaborators.map((c) => (
              <div key={c.id} className="flex items-center gap-2 rounded-full border border-border pl-1 pr-3 py-1">
                <span className="w-7 h-7 rounded-full bg-emerald-500/10 text-emerald-600 text-xs font-semibold flex items-center justify-center">
                  {(c.userName || '?').slice(0, 1)}
                </span>
                <span className="text-sm">{c.userName || t('未知')}</span>
                <Badge variant="outline" className="text-[10px]">
                  {c.role === 'editor' ? t('编辑者') : t('查看者')}
                </Badge>
              </div>
            ))}
            {collaborators.length === 0 && (
              <span className="text-xs text-muted-foreground self-center">{t('暂无协作者')}</span>
            )}
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
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-xs text-muted-foreground">
                    <th className="text-left py-2 pr-3 font-medium">{t('名称')}</th>
                    <th className="text-left py-2 pr-3 font-medium">{t('类型')}</th>
                    <th className="text-left py-2 pr-3 font-medium">{t('贡献者')}</th>
                    <th className="text-left py-2 pr-3 font-medium">{t('上传时间')}</th>
                    <th className="text-left py-2 font-medium">{t('状态')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {docs.map((doc) => (
                    <tr key={doc.id}>
                      <td className="py-2.5 pr-3">
                        <span className="inline-flex items-center gap-2 min-w-0">
                          <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                          <span className="truncate max-w-56" title={doc.name}>{doc.name}</span>
                          {doc.status === 'failed' && doc.error && (
                            <span className="text-xs text-destructive truncate max-w-32" title={doc.error}>
                              {doc.error}
                            </span>
                          )}
                        </span>
                      </td>
                      <td className="py-2.5 pr-3 text-xs text-muted-foreground uppercase">
                        {(doc.name.split('.').pop() || '').slice(0, 6)}
                      </td>
                      <td className="py-2.5 pr-3 text-xs text-muted-foreground">
                        {doc.uploaderName || t('未知')}
                      </td>
                      <td className="py-2.5 pr-3 text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(doc.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-2.5">{docStatusBadge(doc.status, t)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t('问一问')}</CardTitle>
          <p className="text-xs text-muted-foreground">
            {t('基于库内文档回答，回答附来源片段；你的提问记录会自动保存')}
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
