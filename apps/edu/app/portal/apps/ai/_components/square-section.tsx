'use client'

// AI 广场区块（spec §5.3 / WBS F2+F10）：智能体 / 知识库 / 第三方服务三 Tab，
// 由落地页（landing）嵌入；/square 旧路由重定向至 landing#square。
// 卡片网格 + 搜索 + hot/new 排序 + 收藏 toggle + 加载更多分页。
import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Bot,
  BookOpen,
  ExternalLink,
  Flame,
  Clock,
  Loader2,
  MessageSquare,
  HelpCircle,
  LayoutGrid,
} from 'lucide-react'
import { aiCenterSquareApi, type AIAgent, type AIKnowledgeBase, type AIIntegration } from '@/lib/api'
import { useToast, SearchInput, EmptyState } from '@zhiyu/ui'
import { useT } from '@/lib/i18n/locale-provider'
import { AICenterFavoriteButton } from './favorite-button'

const PAGE_SIZE = 12

type SquareTab = 'agents' | 'kbs' | 'integrations'
type SortMode = 'hot' | 'new'

export function SquareSection() {
  const t = useT()
  const router = useRouter()
  const { toast } = useToast()

  const [tab, setTab] = useState<SquareTab>('agents')
  const [qInput, setQInput] = useState('')
  // appliedQ：Enter/搜索按钮确认后才触发请求，避免逐字符打接口
  const [appliedQ, setAppliedQ] = useState('')
  const [sort, setSort] = useState<SortMode>('hot')

  const [agents, setAgents] = useState<AIAgent[]>([])
  const [agentTotal, setAgentTotal] = useState(0)
  const [agentPage, setAgentPage] = useState(1)
  const [agentsLoading, setAgentsLoading] = useState(false)

  const [kbs, setKbs] = useState<AIKnowledgeBase[]>([])
  const [kbTotal, setKbTotal] = useState(0)
  const [kbPage, setKbPage] = useState(1)
  const [kbTag, setKbTag] = useState('')
  const [kbsLoading, setKbsLoading] = useState(false)

  const [integrations, setIntegrations] = useState<AIIntegration[]>([])
  const [integrationsLoading, setIntegrationsLoading] = useState(false)
  const [integrationsLoaded, setIntegrationsLoaded] = useState(false)

  const loadAgents = useCallback(
    async (page: number, append: boolean) => {
      setAgentsLoading(true)
      try {
        const res = await aiCenterSquareApi.agents({ q: appliedQ || undefined, sort, page, pageSize: PAGE_SIZE })
        setAgents((prev) => (append ? [...prev, ...res.items] : res.items))
        setAgentTotal(res.total)
        setAgentPage(page)
      } catch (err) {
        toast({
          title: t('加载失败'),
          description: err instanceof Error ? err.message : undefined,
          variant: 'destructive',
        })
      } finally {
        setAgentsLoading(false)
      }
    },
    [appliedQ, sort, toast, t],
  )

  const loadKbs = useCallback(
    async (page: number, append: boolean) => {
      setKbsLoading(true)
      try {
        const res = await aiCenterSquareApi.kbs({
          q: appliedQ || undefined,
          tag: kbTag || undefined,
          sort,
          page,
          pageSize: PAGE_SIZE,
        })
        setKbs((prev) => (append ? [...prev, ...res.items] : res.items))
        setKbTotal(res.total)
        setKbPage(page)
      } catch (err) {
        toast({
          title: t('加载失败'),
          description: err instanceof Error ? err.message : undefined,
          variant: 'destructive',
        })
      } finally {
        setKbsLoading(false)
      }
    },
    [appliedQ, kbTag, sort, toast, t],
  )

  // 搜索词/排序/标签变化时重置到第一页
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 筛选条件变化时回到第一页并重新加载
    if (tab === 'agents') loadAgents(1, false)
  }, [tab, loadAgents])
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 筛选条件变化时回到第一页并重新加载
    if (tab === 'kbs') loadKbs(1, false)
  }, [tab, loadKbs])

  // 挂接卡片无搜索/分页，进 Tab 时拉一次（含两类，前端分组）
  useEffect(() => {
    if (tab !== 'integrations' || integrationsLoaded) return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 进入 Tab 即进入加载态
    setIntegrationsLoading(true)
    aiCenterSquareApi
      .integrations()
      .then((res) => {
        setIntegrations(res.items)
        setIntegrationsLoaded(true)
      })
      .catch((err) => {
        toast({
          title: t('加载失败'),
          description: err instanceof Error ? err.message : undefined,
          variant: 'destructive',
        })
      })
      .finally(() => setIntegrationsLoading(false))
  }, [tab, integrationsLoaded, toast, t])

  // 标签筛选 chips：取当前结果集的标签并集 + 已选标签（保证可取消）
  const tagOptions = Array.from(new Set([...(kbTag ? [kbTag] : []), ...kbs.flatMap((k) => k.tags || [])]))

  const thirdAgents = integrations.filter((i) => i.kind === 'agent')
  const thirdApps = integrations.filter((i) => i.kind === 'app')

  const renderSortSwitch = (
    <div className="flex items-center gap-1">
      <Button
        size="sm"
        variant={sort === 'hot' ? 'default' : 'outline'}
        onClick={() => setSort('hot')}
      >
        <Flame className="h-3.5 w-3.5 mr-1" />
        {t('最热')}
      </Button>
      <Button
        size="sm"
        variant={sort === 'new' ? 'default' : 'outline'}
        onClick={() => setSort('new')}
      >
        <Clock className="h-3.5 w-3.5 mr-1" />
        {t('最新')}
      </Button>
    </div>
  )

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold">{t('AI 广场')}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t('发现租户内已发布的智能体、知识库与第三方服务')}
          </p>
        </div>
        {tab !== 'integrations' && (
          <SearchInput
            value={qInput}
            onChange={setQInput}
            onSearch={() => setAppliedQ(qInput.trim())}
            placeholder={tab === 'agents' ? t('搜索智能体') : t('搜索知识库')}
            wrapperClassName="w-full sm:w-72"
          />
        )}
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as SquareTab)}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <TabsList>
            <TabsTrigger value="agents">
              <Bot className="h-4 w-4 mr-1" />
              {t('智能体')}
            </TabsTrigger>
            <TabsTrigger value="kbs">
              <BookOpen className="h-4 w-4 mr-1" />
              {t('知识库')}
            </TabsTrigger>
            <TabsTrigger value="integrations">
              <LayoutGrid className="h-4 w-4 mr-1" />
              {t('第三方服务')}
            </TabsTrigger>
          </TabsList>
          {tab !== 'integrations' && renderSortSwitch}
        </div>

        <TabsContent value="agents" className="mt-4">
          {agents.length === 0 && !agentsLoading ? (
            <EmptyState
              icon={<Bot className="h-10 w-10" />}
              title={t('暂无内容')}
              description={t('还没有已发布的智能体')}
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {agents.map((a) => (
                <Card
                  key={a.id}
                  className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => router.push(`/portal/apps/ai/agents/${a.id}`)}
                >
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="w-11 h-11 rounded-lg bg-primary/10 flex items-center justify-center text-2xl shrink-0">
                        {a.avatar || a.name.charAt(0)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate">{a.name}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {a.ownerName || t('未知')}
                        </p>
                      </div>
                      <AICenterFavoriteButton targetType="ai_agent" targetId={a.id} />
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2 min-h-[2.5rem]">
                      {a.description || t('无描述')}
                    </p>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <MessageSquare className="h-3.5 w-3.5" />
                      {t('{count} 次对话', { count: a.chatCount })}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
          {agentsLoading && (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}
          {agents.length < agentTotal && !agentsLoading && (
            <div className="flex justify-center pt-4">
              <Button variant="outline" onClick={() => loadAgents(agentPage + 1, true)}>
                {t('加载更多')}
              </Button>
            </div>
          )}
        </TabsContent>

        <TabsContent value="kbs" className="mt-4 space-y-3">
          {tagOptions.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              {tagOptions.map((tag) => (
                <Badge
                  key={tag}
                  variant={kbTag === tag ? 'default' : 'outline'}
                  className="cursor-pointer"
                  onClick={() => setKbTag(kbTag === tag ? '' : tag)}
                >
                  {tag}
                </Badge>
              ))}
            </div>
          )}
          {kbs.length === 0 && !kbsLoading ? (
            <EmptyState
              icon={<BookOpen className="h-10 w-10" />}
              title={t('暂无内容')}
              description={t('还没有已发布的知识库')}
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {kbs.map((kb) => (
                <Card
                  key={kb.id}
                  className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => router.push(`/portal/apps/ai/kb/${kb.id}`)}
                >
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="w-11 h-11 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <BookOpen className="h-5 w-5 text-primary" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate">{kb.name}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {kb.ownerName || t('未知')}
                        </p>
                      </div>
                      <AICenterFavoriteButton targetType="ai_kb" targetId={kb.id} />
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2 min-h-[2.5rem]">
                      {kb.description || t('无描述')}
                    </p>
                    {(kb.tags || []).length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {kb.tags.slice(0, 3).map((tag) => (
                          <Badge key={tag} variant="secondary" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    )}
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>{t('{count} 个文档', { count: kb.docCount })}</span>
                      <span className="inline-flex items-center gap-1">
                        <HelpCircle className="h-3.5 w-3.5" />
                        {t('{count} 次提问', { count: kb.askCount })}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
          {kbsLoading && (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}
          {kbs.length < kbTotal && !kbsLoading && (
            <div className="flex justify-center pt-4">
              <Button variant="outline" onClick={() => loadKbs(kbPage + 1, true)}>
                {t('加载更多')}
              </Button>
            </div>
          )}
        </TabsContent>

        <TabsContent value="integrations" className="mt-4 space-y-6">
          {integrationsLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : integrations.length === 0 ? (
            <EmptyState
              icon={<LayoutGrid className="h-10 w-10" />}
              title={t('暂无内容')}
              description={t('管理员尚未配置第三方服务')}
            />
          ) : (
            (
              [
                { title: t('第三方智能体'), items: thirdAgents },
                { title: t('应用'), items: thirdApps },
              ] as const
            ).map(
              (group) =>
                group.items.length > 0 && (
                  <section key={group.title} className="space-y-3">
                    <h2 className="text-sm font-medium text-muted-foreground">{group.title}</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {group.items.map((it) => (
                        <Card
                          key={it.id}
                          className="cursor-pointer hover:shadow-md transition-shadow"
                          onClick={() => window.open(it.url, '_blank', 'noopener')}
                        >
                          <CardContent className="p-4 space-y-2">
                            <div className="flex items-start gap-3">
                              <div className="w-11 h-11 rounded-lg bg-primary/10 flex items-center justify-center text-2xl shrink-0">
                                {it.icon || <ExternalLink className="h-5 w-5 text-primary" />}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="font-medium truncate">{it.name}</p>
                                {it.category && (
                                  <Badge variant="secondary" className="mt-1 text-xs">
                                    {it.category}
                                  </Badge>
                                )}
                              </div>
                              <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0" />
                            </div>
                            <p className="text-sm text-muted-foreground line-clamp-2">
                              {it.description || t('无描述')}
                            </p>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </section>
                ),
            )
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
