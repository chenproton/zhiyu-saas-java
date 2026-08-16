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
          <div className="rounded-2xl border border-white/20 bg-white/10 backdrop-blur-md p-5 shadow-xl space-y-3">
            <div className="flex items-center gap-2 text-white/90 text-sm font-medium">
              <Sparkles className="w-4 h-4 text-yellow-300" />
              {t('YIKnow 智能对话')}
            </div>
            <div className="space-y-2.5">
              <div className="flex justify-end">
                <div className="rounded-2xl rounded-tr-sm bg-white text-slate-700 px-3.5 py-2 text-xs shadow max-w-[85%]">
                  {t('帮我总结一下这周实训报告的写作要点')}
                </div>
              </div>
              <div className="flex justify-start">
                <div className="rounded-2xl rounded-tl-sm bg-white/15 border border-white/20 text-white/90 px-3.5 py-2 text-xs max-w-[85%] leading-relaxed">
                  {t('好的！实训报告一般包含：目的、内容、步骤、结果与反思。建议按「任务→操作→收获」三段式展开……')}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-full bg-white/10 border border-white/20 px-3.5 py-2">
              <span className="text-xs text-white/50 flex-1">{t('输入消息，Enter 发送')}</span>
              <span className="w-6 h-6 rounded-full bg-white text-primary flex items-center justify-center text-xs">➤</span>
            </div>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {['我的方案', '岗位库', '场景库', '知识库', '设置'].map((label) => (
                <span key={label} className="rounded-full border border-white/25 text-white/60 px-2.5 py-0.5 text-[10px]">
                  {t(label)} · {t('待上线')}
                </span>
              ))}
            </div>
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
        <section id="square" ref={squareRef} className="scroll-mt-20 space-y-8">
          <div>
            <h2 className="text-xl font-bold text-[#0f172a] flex items-center gap-2">
              <span className="w-1 h-5 rounded-full bg-gradient-to-b from-primary/80 to-primary/70" />
              {t('AI 广场')}
            </h2>
            <p className="text-sm text-muted-foreground mt-1.5 ml-3">
              {t('全校师生共建共享的智能体、知识库与第三方服务')}
            </p>
          </div>

          {/* 智能体板块 */}
          <FlatBlock
            title={t('智能体')}
            desc={t('点开即聊的 AI 助手')}
            icon={<Bot className="w-5 h-5 text-primary" />}
            count={data?.agentTotal}
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
            icon={<BookOpen className="w-5 h-5 text-primary" />}
            count={data?.kbTotal}
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
            icon={<Blocks className="w-5 h-5 text-primary" />}
            count={data?.integrations.length}
            emptyLabel={t('暂无第三方服务')}
            hasItems={!!data && data.integrations.length > 0}
          >
            {data?.integrations.map((it) => <IntegrationLinkCard key={it.id} item={it} />)}
          </FlatBlock>
        </section>

        {/* 底部行动卡：引导创作 */}
        <section className="bg-gradient-to-r from-primary via-primary to-primary/80 rounded-2xl p-6 sm:p-8 shadow-[0_8px_24px_rgba(22,119,255,0.25)] relative overflow-hidden">
          <div className="absolute top-[-60px] right-[-40px] w-64 h-64 rounded-full bg-white/10 blur-3xl pointer-events-none" />
          <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-2xl bg-white/15 backdrop-blur-sm border border-white/20 flex items-center justify-center shrink-0">
                <Sparkles className="w-7 h-7 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">
                  {t('把你的知识变成全校可用的 AI 服务')}
                </h2>
                <p className="text-sm text-white/80 mt-1 max-w-xl">
                  {t('上传资料建成知识库，或配置一个专属智能体，审核通过后即可发布到广场。')}
                </p>
              </div>
            </div>
            <div className="flex gap-2.5 shrink-0">
              <button
                onClick={() =>
                  document.getElementById('studio')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                }
                className="rounded-full bg-white text-primary hover:bg-primary/5 px-6 h-10 text-sm font-semibold shadow-lg transition-all hover:-translate-y-0.5"
              >
                {t('去工坊创作')}
              </button>
            </div>
          </div>
        </section>
      </div>
    </LandingShell>
  )
}

function FlatBlock({
  title,
  desc,
  icon,
  count,
  moreHref,
  moreLabel,
  emptyLabel,
  hasItems,
  children,
}: {
  title: string
  desc: string
  icon: React.ReactNode
  count?: number
  moreHref?: string
  moreLabel?: string
  emptyLabel: string
  hasItems: boolean
  children?: React.ReactNode
}) {
  const t = useT()
  return (
    <div className="bg-white rounded-2xl border border-[#e7e5e4] shadow-[0_4px_20px_rgba(0,0,0,0.04)] overflow-hidden">
      <div className="px-6 pt-5 pb-4 flex items-center justify-between gap-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/10 flex items-center justify-center shrink-0">
            {icon}
          </div>
          <div>
            <h3 className="text-base font-bold text-[#0f172a] flex items-center gap-2">
              {title}
              {count != null && (
                <span className="text-[13px] text-[#64748b] font-normal">({count})</span>
              )}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">{desc}</p>
          </div>
        </div>
        {moreHref && (
          <Link
            href={moreHref}
            className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline shrink-0"
          >
            {moreLabel}
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        )}
      </div>
      <div className="p-5">
        {hasItems ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">{children}</div>
        ) : (
          <div className="rounded-xl border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
            {t(emptyLabel)}
          </div>
        )}
      </div>
    </div>
  )
}
