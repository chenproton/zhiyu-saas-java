'use client'

// AI 大厅卡片族（landing 平铺区与 hall 大厅页共用，spec §2.1）：
// 三类内容三种卡片样式——智能体（封面横幅 + emoji + 立即体验按钮）、
// 知识库（封面横幅 + BookOpen + tags + 文档/提问数）、第三方服务（链接卡片）。
// 封面：coverImage 优先，无则 coverGradientFor 渐变 + 居中图标（对齐考试中心卡片模式）。
import { useNavigate } from 'react-router'
import { BookOpen, ExternalLink, Eye, FileText, HelpCircle, MessageSquare, Sparkles } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { AIAgent, AIKnowledgeBase, AIIntegration } from '@/lib/api'
import { useT } from '@/lib/i18n/locale-provider'
import { coverGradientFor } from '@/lib/cover-gradients'
import { AICenterFavoriteButton } from './favorite-button'

const NEW_DAYS = 7

export function isNewContent(createdAt: string): boolean {
  return Date.now() - new Date(createdAt).getTime() < NEW_DAYS * 24 * 3600 * 1000
}

function NewBadge() {
  const t = useT()
  return (
    <span className="absolute top-3 right-3 rounded-full bg-amber-500/95 backdrop-blur-sm px-2 py-0.5 text-[11px] font-medium text-white shadow">
      {t('新上线')}
    </span>
  )
}

const cardClass =
  'bg-white rounded-2xl border border-[#e7e5e4] overflow-hidden flex flex-col h-full shadow-[0_2px_6px_rgba(0,0,0,0.04)] hover:shadow-[0_12px_32px_rgba(0,0,0,0.1)] hover:-translate-y-1 transition-all group'

/** 封面横幅：有图用图，无图渐变 + 居中内容 */
function CardBanner({
  cover,
  seed,
  center,
  isNew,
}: {
  cover?: string
  seed: string
  center: React.ReactNode
  isNew: boolean
}) {
  return (
    <div
      className="h-24 flex items-center justify-center shrink-0 relative"
      style={
        cover
          ? { backgroundImage: `url('${cover}')`, backgroundSize: 'cover', backgroundPosition: 'center' }
          : { background: coverGradientFor(seed) }
      }
    >
      {!cover && center}
      {isNew && <NewBadge />}
    </div>
  )
}

/** 智能体卡片：封面横幅 + 名称/创建者 + 描述 + 对话数 + 立即体验 */
export function AgentHallCard({ agent }: { agent: AIAgent }) {
  const t = useT()
  const navigate = useNavigate()
  return (
    <div className={cardClass}>
      <CardBanner
        cover={agent.coverImage}
        seed={agent.id}
        center={<span className="text-4xl drop-shadow-sm">{agent.avatar || '🤖'}</span>}
        isNew={isNewContent(agent.createdAt)}
      />
      <div className="p-4 flex-1 flex flex-col">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <p className="font-semibold truncate group-hover:text-primary transition-colors">
              {agent.name}
            </p>
            <p className="text-xs text-muted-foreground truncate mt-0.5">
              {agent.ownerName || t('未知')}
            </p>
          </div>
          <AICenterFavoriteButton targetType="ai_agent" targetId={agent.id} />
        </div>
        <p className="text-sm text-muted-foreground line-clamp-2 min-h-[2.5rem] mt-2">
          {agent.description || agent.greeting || t('无描述')}
        </p>
        <div className="flex items-center justify-between mt-auto pt-3 border-t border-border">
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <MessageSquare className="h-3.5 w-3.5" />
            {t('{count} 次对话', { count: agent.chatCount })}
          </span>
          <span className="inline-flex items-center gap-1">
            <Eye className="h-3.5 w-3.5" />
            {t('{count} 次浏览', { count: agent.viewCount ?? 0 })}
          </span>
          <Button
            size="sm"
            className="gap-1"
            onClick={() => navigate(`/portal/apps/ai/agents/${agent.id}`)}
          >
            <Sparkles className="h-3.5 w-3.5" />
            {t('立即体验')}
          </Button>
        </div>
      </div>
    </div>
  )
}

/** 知识库卡片：封面横幅 + 名称/创建者 + 描述 + tags + 文档/提问数，整卡进详情 */
export function KbHallCard({ kb }: { kb: AIKnowledgeBase }) {
  const t = useT()
  const navigate = useNavigate()
  return (
    <div
      className={`${cardClass} cursor-pointer`}
      onClick={() => navigate(`/portal/apps/ai/kb/${kb.id}`)}
    >
      <CardBanner
        cover={kb.coverImage}
        seed={kb.id}
        center={<BookOpen className="h-10 w-10 text-white/80" />}
        isNew={isNewContent(kb.createdAt)}
      />
      <div className="p-4 flex-1 flex flex-col">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <p className="font-semibold truncate group-hover:text-primary transition-colors">
              {kb.name}
            </p>
            <p className="text-xs text-muted-foreground truncate mt-0.5">
              {kb.ownerName || t('未知')}
            </p>
          </div>
          <AICenterFavoriteButton targetType="ai_kb" targetId={kb.id} />
        </div>
        <p className="text-sm text-muted-foreground line-clamp-2 min-h-[2.5rem] mt-2">
          {kb.description || t('无描述')}
        </p>
        {kb.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {kb.tags.slice(0, 3).map((tag) => (
              <Badge key={tag} variant="secondary" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>
        )}
        <div className="flex items-center gap-4 mt-auto pt-3 border-t border-border text-xs text-muted-foreground">
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
        </div>
      </div>
    </div>
  )
}

/** 第三方服务卡片：链接卡片，新窗口打开 */
export function IntegrationLinkCard({ item }: { item: AIIntegration }) {
  const t = useT()
  return (
    <button
      onClick={() => window.open(item.url, '_blank', 'noopener')}
      className="flex items-center gap-3 rounded-xl border border-border bg-background p-4 text-left hover:shadow-md hover:border-primary/40 transition-all w-full"
    >
      <span className="w-11 h-11 rounded-xl bg-gradient-to-br from-sky-500/20 to-sky-500/5 border border-sky-500/20 flex items-center justify-center text-2xl shrink-0">
        {item.icon || '🔗'}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="text-sm font-semibold truncate">{item.name}</span>
          {item.category && (
            <Badge variant="secondary" className="text-[10px] shrink-0">
              {item.category}
            </Badge>
          )}
        </span>
        <span className="block text-xs text-muted-foreground truncate mt-0.5">
          {item.description || t('无描述')}
        </span>
      </span>
      <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0" />
    </button>
  )
}
