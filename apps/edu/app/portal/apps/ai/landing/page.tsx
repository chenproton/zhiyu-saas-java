'use client'

// AI 智能服务中心前台主页（/portal/apps/ai/landing）v1.3
// 单页集成（spec §2.1）：YIKnow hero（全局助手主推 + 对话入口）→ 我的工坊（#studio）
// → AI 广场平铺（#square：智能体/知识库/第三方服务三区，取消 Tab，各配专属卡片样式，
// 「查看更多」进大厅页 hall/agents、hall/kbs）。
// 旧路由 /square、/studio 重定向至本页对应锚点；大厅页路由 /hall/* 独立存在。
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Bot, BookOpen, Blocks, ArrowRight, Sparkles } from 'lucide-react'
import { LandingShell } from '@/components/shared/landing-shell'
import { aiCenterSquareApi } from '@/lib/api'
import type { AIAgent, AIKnowledgeBase, AIIntegration } from '@/lib/api'
import { useT } from '@/lib/i18n/locale-provider'
import { reportError } from '@/lib/error-handling'
import { StudioSection } from '../_components/studio-section'
import { AgentHallCard, KbHallCard, IntegrationLinkCard } from '../_components/hall-cards'

const FLAT_SIZE = 6

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
  const squareRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    Promise.all([
      aiCenterSquareApi.agents({ sort: 'hot', pageSize: FLAT_SIZE }),
      aiCenterSquareApi.kbs({ sort: 'hot', pageSize: FLAT_SIZE }),
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
        if (!cancelled) reportError(err, 'ai-landing')
      })
    return () => {
      cancelled = true
    }
  }, [])

  // 锚点定位：/square、/studio 旧路由重定向到本页 #square/#studio，加载后平滑滚动到对应区块
  useEffect(() => {
    const hash = window.location.hash.slice(1)
    if (!hash) return
    const timer = setTimeout(() => {
      document.getElementById(hash)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 100)
    return () => clearTimeout(timer)
  }, [])

  return (
    <LandingShell
      hero={{
        badge: t('AI 智能服务平台'),
        title: (
          <>
            YIKnow <span className="text-yellow-300">{t('你问，我懂')}</span>
          </>
        ),
        description: t(
          'YIKnow 是面向全体师生的全局 AI 助手，开箱即用；你也可以创建自己的知识库与智能体，经审核后发布到广场与全校共享。',
        ),
        ctaLabel: t('立即体验 YIKnow'),
        ctaHref: '/portal/apps/ai/chat',
        secondaryCtaLabel: t('逛逛 AI 广场'),
        right: (
          <div className="rounded-2xl border border-white/20 bg-white/10 backdrop-blur-md p-5 shadow-xl">
            <div className="flex items-center gap-2 text-white/90 text-sm font-medium mb-3">
              <Sparkles className="w-4 h-4 text-yellow-300" />
              {t('YIKnow 能力版图（规划中）')}
            </div>
            <div className="flex flex-wrap gap-2">
              {['智能对话', '我的方案', '岗位库', '场景库', '知识库', '设置'].map((label, i) => (
                <span
                  key={label}
                  className={
                    i === 0
                      ? 'rounded-full bg-white text-primary px-3 py-1 text-xs font-semibold shadow'
                      : 'rounded-full border border-white/30 text-white/80 px-3 py-1 text-xs'
                  }
                >
                  {t(label)}
                  {i > 0 && <span className="ml-1 opacity-70">· {t('待上线')}</span>}
                </span>
              ))}
            </div>
            <p className="mt-4 text-xs text-white/70 leading-relaxed">
              {t('融合场景化数智教学模式，为职业教育提供智能化教学辅助、岗位能力评估、个性化学习路径规划等全方位 AI 服务。')}
            </p>
          </div>
        ),
      }}
      stats={[
        { icon: Bot, value: data?.agentTotal ?? '-', label: t('已发布智能体') },
        { icon: BookOpen, value: data?.kbTotal ?? '-', label: t('已发布知识库') },
        { icon: Blocks, value: data?.integrations.length ?? '-', label: t('第三方服务') },
      ]}
      listRef={squareRef}
    >
      <div className="space-y-14">
        {/* 第一区：我的工坊（师生主诉求：创建/管理） */}
        <section id="studio" className="scroll-mt-20">
          <StudioSection />
        </section>

        {/* 第二区：AI 广场（平铺三板块，无 Tab） */}
        <section id="square" ref={squareRef} className="scroll-mt-20 space-y-10">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Blocks className="w-5 h-5 text-primary" />
              {t('AI 广场')}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              {t('全校师生共建共享的智能体、知识库与第三方服务')}
            </p>
          </div>

          {/* 智能体板块 */}
          <FlatBlock
            title={t('智能体')}
            desc={t('点开即聊的 AI 助手')}
            moreHref="/portal/apps/ai/hall/agents"
            moreLabel={t('查看更多')}
            emptyLabel={t('暂无已发布智能体')}
            hasItems={!!data && data.agents.length > 0}
          >
            {data?.agents.map((a) => <AgentHallCard key={a.id} agent={a} />)}
          </FlatBlock>

          {/* 知识库板块 */}
          <FlatBlock
            title={t('知识库')}
            desc={t('可提问的资料库')}
            moreHref="/portal/apps/ai/hall/kbs"
            moreLabel={t('查看更多')}
            emptyLabel={t('暂无已发布知识库')}
            hasItems={!!data && data.kbs.length > 0}
          >
            {data?.kbs.map((kb) => <KbHallCard key={kb.id} kb={kb} />)}
          </FlatBlock>

          {/* 第三方服务板块 */}
          <FlatBlock
            title={t('第三方服务')}
            desc={t('管理员精选挂接的外部智能体与应用')}
            emptyLabel={t('暂无第三方服务')}
            hasItems={!!data && data.integrations.length > 0}
          >
            {data?.integrations.map((it) => <IntegrationLinkCard key={it.id} item={it} />)}
          </FlatBlock>
        </section>
      </div>
    </LandingShell>
  )
}

function FlatBlock({
  title,
  desc,
  moreHref,
  moreLabel,
  emptyLabel,
  hasItems,
  children,
}: {
  title: string
  desc: string
  moreHref?: string
  moreLabel?: string
  emptyLabel: string
  hasItems: boolean
  children?: React.ReactNode
}) {
  const t = useT()
  return (
    <div>
      <div className="flex items-end justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold">{title}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
        </div>
        {moreHref && (
          <Link
            href={moreHref}
            className="inline-flex items-center gap-1 text-sm text-primary hover:underline shrink-0"
          >
            {moreLabel}
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        )}
      </div>
      {hasItems ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">{children}</div>
      ) : (
        <div className="rounded-xl border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
          {t(emptyLabel)}
        </div>
      )}
    </div>
  )
}
