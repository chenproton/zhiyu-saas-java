'use client'

// AI 智能服务中心前台落地页（/portal/apps/ai/landing）
// 单页集成前台全部功能（spec §2.1 页面结构 v1.2）：
//   hero + 统计条 → 我的工坊（#studio，创建/管理知识库与智能体）→ AI 广场（#square，发现/收藏/对话入口）
// 旧路由 /portal/apps/ai/square、/studio 重定向至本页对应锚点。
// 复用 LandingShell 统一骨架；工坊/广场复用抽出的共享区块组件（单一事实源）。
import { useEffect, useRef, useState } from 'react'
import { Bot, BookOpen, Blocks } from 'lucide-react'
import { LandingShell } from '@/components/shared/landing-shell'
import { aiCenterSquareApi } from '@/lib/api'
import { useT } from '@/lib/i18n/locale-provider'
import { reportError } from '@/lib/error-handling'
import { StudioSection } from '../_components/studio-section'
import { SquareSection } from '../_components/square-section'

interface LandingStats {
  agentTotal: number
  kbTotal: number
  integrationCount: number
}

export default function AILandingPage() {
  const t = useT()
  const [stats, setStats] = useState<LandingStats | null>(null)
  const squareRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    Promise.all([
      aiCenterSquareApi.agents({ sort: 'hot', pageSize: 1 }),
      aiCenterSquareApi.kbs({ sort: 'hot', pageSize: 1 }),
      aiCenterSquareApi.integrations(),
    ])
      .then(([agents, kbs, integrations]) => {
        if (cancelled) return
        setStats({
          agentTotal: agents.total,
          kbTotal: kbs.total,
          integrationCount: integrations.items.length,
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
        { icon: Bot, value: stats?.agentTotal ?? '-', label: t('已发布智能体') },
        { icon: BookOpen, value: stats?.kbTotal ?? '-', label: t('已发布知识库') },
        { icon: Blocks, value: stats?.integrationCount ?? '-', label: t('第三方服务') },
      ]}
      listRef={squareRef}
    >
      <div className="space-y-12">
        {/* 第一区：我的工坊（师生主诉求：创建/管理） */}
        <section id="studio" className="scroll-mt-20">
          <StudioSection />
        </section>

        {/* 第二区：AI 广场（发现/使用已发布内容） */}
        <section id="square" ref={squareRef} className="scroll-mt-20">
          <SquareSection />
        </section>
      </div>
    </LandingShell>
  )
}
