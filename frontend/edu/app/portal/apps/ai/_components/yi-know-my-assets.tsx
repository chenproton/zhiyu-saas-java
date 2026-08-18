'use client'

// YIKnow 聊天「我的知识库 / 我的智能体」视图（v2.7）：
// 两个分段上下排——我创建的（listMine owned / agents listMine）、我收藏的（favoriteApi.list 的 ai_kb/ai_agent）。
// 点击条目跳详情/对话页（知识库→/portal/apps/ai/kb/{id}，智能体→/portal/apps/ai/agents/{id}）。
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { BookOpen, Bot, Eye, FileText, Heart, Loader2 } from 'lucide-react'
import { aiCenterAgentApi, aiCenterKbApi, favoriteApi } from '@/lib/api'
import type { AIAgent, AIKnowledgeBase } from '@/lib/api'
import { useT } from '@/lib/i18n/locale-provider'
import { AIStatusBadge } from '../studio/components/ai-status-badge'

interface AssetRow {
  id: string
  name: string
  status: string
  viewCount?: number
  docCount?: number
  avatar?: string
}

export function YIKnowMyAssets({
  kind,
  onNavigate,
}: {
  kind: 'kbs' | 'agents'
  onNavigate?: () => void
}) {
  const t = useT()
  const navigate = useNavigate()
  const [mine, setMine] = useState<AssetRow[]>([])
  const [favs, setFavs] = useState<AssetRow[]>([])
  const [loading, setLoading] = useState(true)

  const isKb = kind === 'kbs'

  useEffect(() => {
    let cancelled = false
    const toKbRow = (k: AIKnowledgeBase): AssetRow => ({
      id: k.id,
      name: k.name,
      status: k.status,
      viewCount: k.viewCount,
      docCount: k.docCount,
    })
    const toAgentRow = (a: AIAgent): AssetRow => ({
      id: a.id,
      name: a.name,
      status: a.status,
      viewCount: a.viewCount,
      avatar: a.avatar,
    })
    Promise.allSettled([
      isKb
        ? aiCenterKbApi.listMine({ scope: 'owned', pageSize: 100 }).then((r) => r.items.map(toKbRow))
        : aiCenterAgentApi.listMine().then((r) => r.items.map(toAgentRow)),
      favoriteApi.list(),
    ]).then(([mineRes, favRes]) => {
      if (cancelled) return
      if (mineRes.status === 'fulfilled') setMine(mineRes.value)
      if (favRes.status === 'fulfilled') {
        const fl = favRes.value
        setFavs(isKb ? (fl.ai_kb ?? []).map(toKbRow) : (fl.ai_agent ?? []).map(toAgentRow))
      }
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [isKb])

  const openItem = (id: string) => {
    navigate(isKb ? `/portal/apps/ai/kb/${id}` : `/portal/apps/ai/agents/${id}`)
    onNavigate?.()
  }

  // lint（no-components-in-render）：用普通渲染函数而非内联组件
  const renderSection = (title: string, Icon: typeof Heart, items: AssetRow[]) => (
    <div>
      <div className="flex items-center gap-2 mb-2.5">
        <Icon className="w-3.5 h-3.5 text-primary" />
        <span className="text-xs font-semibold text-foreground">{title}</span>
        <span className="text-[11px] text-muted-foreground">{items.length}</span>
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground py-4 text-center rounded-xl border border-dashed border-[#e7e5e4]">
          {isKb ? t('暂无知识库') : t('暂无智能体')}
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {items.map((item) => (
            <button
              key={item.id}
              onClick={() => openItem(item.id)}
              className="flex items-center gap-3 rounded-xl border border-[#e7e5e4] bg-white px-3.5 py-3 text-left transition-all hover:border-primary/40 hover:shadow-md hover:-translate-y-0.5"
            >
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 text-lg">
                {isKb ? <BookOpen className="w-4 h-4 text-primary" /> : item.avatar || <Bot className="w-4 h-4 text-primary" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium truncate">{item.name}</span>
                  <AIStatusBadge status={item.status as never} />
                </div>
                <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <Eye className="w-3 h-3" />
                    {item.viewCount ?? 0}
                  </span>
                  {isKb && (
                    <span className="inline-flex items-center gap-1">
                      <FileText className="w-3 h-3" />
                      {t('{count} 个文档', { count: item.docCount ?? 0 })}
                    </span>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )

  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      <div className="max-w-4xl w-full mx-auto px-4 sm:px-8 py-5 space-y-6">
        <div>
          <h2 className="text-base font-semibold">{isKb ? t('我的知识库') : t('我的智能体')}</h2>
          <p className="text-xs text-muted-foreground mt-1">
            {isKb
              ? t('你创建的与收藏的知识库，点击即可进入详情提问')
              : t('你创建的与收藏的智能体，点击即可进入对话')}
          </p>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-16 gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t('加载中...')}
          </div>
        ) : (
          <>
            {renderSection(t('我创建的'), isKb ? BookOpen : Bot, mine)}
            {renderSection(t('我收藏的'), Heart, favs)}
          </>
        )}
      </div>
    </div>
  )
}
