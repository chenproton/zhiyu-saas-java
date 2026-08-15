'use client'

// AI 智能服务中心前台落地页（/portal/ai/landing）
// 复用 LandingShell 统一骨架（hero/统计/列表/页脚），数据来自 AI 广场公开列表（published）。
// 与其他平台落地页等地位：注册进菜单权限树（menu-permissions.ts ai-landing），回填见迁移 167。
import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Bot,
  BookOpen,
  Blocks,
  MessagesSquare,
  FileText,
  HelpCircle,
  ExternalLink,
  ArrowRight,
  Plus,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { LandingShell, LandingEmpty } from '@/components/shared/landing-shell'
import { aiCenterSquareApi } from '@/lib/api'
import type { AIAgent, AIKnowledgeBase, AIIntegration } from '@/lib/api'
import { useT } from '@/lib/i18n/locale-provider'
import { reportError } from '@/lib/error-handling'

interface LandingData {
  agents: AIAgent[]
  agentTotal: number
  kbs: AIKnowledgeBase[]
  kbTotal: number
  integrations: AIIntegration[]
}

export default function AILandingPage() {
  const t = useT()
  const [data, setData] = useState<LandingData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    Promise.all([
      aiCenterSquareApi.agents({ sort: 'hot', pageSize: 6 }),
      aiCenterSquareApi.kbs({ sort: 'hot', pageSize: 6 }),
      aiCenterSquareApi.integrations(),
    ])
      .then(([agents, kbs, integrations]) => {
        if (cancelled) return
        setData({
          agents: agents.items,
          agentTotal: agents.total,
          kbs: kbs.items,
          kbTotal: kbs.total,
          integrations: integrations.items,
        })
      })
      .catch((err) => {
        if (cancelled) return
        reportError(err, 'ai-landing')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const hasContent =
    !!data && (data.agents.length > 0 || data.kbs.length > 0 || data.integrations.length > 0)

  return (
    <LandingShell
      hero={{
        badge: t('AI 智能服务中心'),
        title: (
          <>
            {t('让每个师生都拥有')}
            <span className="text-yellow-300">{t('专属 AI 助手')}</span>
          </>
        ),
        description: t(
          '师生可创建自己的知识库与智能体，经审核后发布到广场共享；也可直接使用他人发布的智能体对话、向知识库提问。',
        ),
        ctaLabel: t('逛逛 AI 广场'),
      }}
      stats={[
        { icon: Bot, value: data?.agentTotal ?? '-', label: t('已发布智能体') },
        { icon: BookOpen, value: data?.kbTotal ?? '-', label: t('已发布知识库') },
        { icon: Blocks, value: data?.integrations.length ?? '-', label: t('第三方服务') },
      ]}
    >
      {loading ? (
        <div className="py-16 text-center text-sm text-muted-foreground">{t('加载中…')}</div>
      ) : !hasContent ? (
        <LandingEmpty
          title={t('广场上还没有内容')}
          hint={t('去「我的工坊」创建第一个知识库或智能体，审核通过后就会出现在这里')}
        />
      ) : (
        <div className="space-y-10">
          {/* 热门智能体 */}
          {data!.agents.length > 0 && (
            <section>
              <SectionTitle
                icon={Bot}
                title={t('热门智能体')}
                moreHref="/portal/apps/ai/square"
                moreLabel={t('查看全部')}
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {data!.agents.map((a) => (
                  <Link key={a.id} href={`/portal/apps/ai/agents/${a.id}`}>
                    <Card className="h-full hover:shadow-md hover:border-primary/40 transition-all">
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center text-xl shrink-0">
                            {a.avatar || a.name.charAt(0)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="font-medium truncate">{a.name}</div>
                            <div className="text-xs text-muted-foreground line-clamp-2 mt-1 min-h-[2rem]">
                              {a.description || a.greeting}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground">
                          <span className="truncate">{a.ownerName}</span>
                          <span className="inline-flex items-center gap-1 shrink-0">
                            <MessagesSquare className="w-3.5 h-3.5" />
                            {t('{n} 次对话').replace('{n}', String(a.chatCount))}
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* 精选知识库 */}
          {data!.kbs.length > 0 && (
            <section>
              <SectionTitle
                icon={BookOpen}
                title={t('精选知识库')}
                moreHref="/portal/apps/ai/square"
                moreLabel={t('查看全部')}
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {data!.kbs.map((kb) => (
                  <Link key={kb.id} href={`/portal/apps/ai/kb/${kb.id}`}>
                    <Card className="h-full hover:shadow-md hover:border-primary/40 transition-all">
                      <CardContent className="p-4">
                        <div className="font-medium truncate">{kb.name}</div>
                        <div className="text-xs text-muted-foreground line-clamp-2 mt-1 min-h-[2rem]">
                          {kb.description}
                        </div>
                        {kb.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {kb.tags.slice(0, 3).map((tag) => (
                              <Badge key={tag} variant="secondary" className="text-xs">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        )}
                        <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground">
                          <span className="truncate">{kb.ownerName}</span>
                          <span className="inline-flex items-center gap-3 shrink-0">
                            <span className="inline-flex items-center gap-1">
                              <FileText className="w-3.5 h-3.5" />
                              {t('{n} 篇文档').replace('{n}', String(kb.docCount))}
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <HelpCircle className="w-3.5 h-3.5" />
                              {t('{n} 次提问').replace('{n}', String(kb.askCount))}
                            </span>
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* 第三方服务 */}
          {data!.integrations.length > 0 && (
            <section>
              <SectionTitle icon={Blocks} title={t('第三方服务')} />
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {data!.integrations.map((it) => (
                  <button
                    key={it.id}
                    onClick={() => window.open(it.url, '_blank', 'noopener')}
                    className="flex items-center gap-3 rounded-lg border border-border bg-background p-3 text-left hover:shadow-md hover:border-primary/40 transition-all"
                  >
                    <span className="text-2xl shrink-0">{it.icon || '🔗'}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium truncate">{it.name}</span>
                      {it.description && (
                        <span className="block text-xs text-muted-foreground truncate">
                          {it.description}
                        </span>
                      )}
                    </span>
                    <ExternalLink className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* 创建引导 */}
          <Card className="border-dashed border-primary/40 bg-primary/5">
            <CardContent className="p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <div className="font-medium">{t('创建你自己的 AI 应用')}</div>
                <div className="text-sm text-muted-foreground mt-1">
                  {t('上传资料建知识库、配置提示词建智能体，提交审核后即可发布到广场与全校共享')}
                </div>
              </div>
              <Link href="/portal/apps/ai/studio">
                <Button className="gap-1.5 shrink-0">
                  <Plus className="w-4 h-4" />
                  {t('去我的工坊创建')}
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      )}
    </LandingShell>
  )
}

function SectionTitle({
  icon: Icon,
  title,
  moreHref,
  moreLabel,
}: {
  icon: typeof Bot
  title: string
  moreHref?: string
  moreLabel?: string
}) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        <Icon className="w-5 h-5 text-primary" />
        {title}
      </h2>
      {moreHref && (
        <Link
          href={moreHref}
          className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
        >
          {moreLabel}
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      )}
    </div>
  )
}
