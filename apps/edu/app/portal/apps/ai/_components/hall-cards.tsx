'use client'

// AI 大厅卡片族（landing 平铺区与 hall 大厅页共用，spec §2.1）：
// 三类内容三种卡片样式——智能体（emoji 头像 + 立即体验按钮）、
// 知识库（BookOpen 图标 + tags + 文档/提问数）、第三方服务（链接卡片）。
import { useRouter } from 'next/navigation'
import { BookOpen, ExternalLink, FileText, HelpCircle, MessageSquare, Sparkles } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import type { AIAgent, AIKnowledgeBase, AIIntegration } from '@/lib/api'
import { useT } from '@/lib/i18n/locale-provider'
import { AICenterFavoriteButton } from './favorite-button'

const NEW_DAYS = 7

export function isNewContent(createdAt: string): boolean {
  return Date.now() - new Date(createdAt).getTime() < NEW_DAYS * 24 * 3600 * 1000
}

function NewBadge() {
  const t = useT()
  return (
    <span className="absolute -top-1.5 -right-1.5 rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-medium text-white shadow">
      {t('新上线')}
    </span>
  )
}

/** 智能体卡片：emoji 头像 + 名称/创建者 + 描述 + 对话数 + 立即体验 */
export function AgentHallCard({ agent }: { agent: AIAgent }) {
  const t = useT()
  const router = useRouter()
  return (
    <Card className="hover:shadow-lg hover:border-primary/40 transition-all group h-full">
      <CardContent className="p-5 flex flex-col h-full">
        <div className="flex items-start gap-3">
          <div className="relative shrink-0">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 flex items-center justify-center text-2xl">
              {agent.avatar || agent.name.charAt(0)}
            </div>
            {isNewContent(agent.createdAt) && <NewBadge />}
          </div>
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
        <p className="text-sm text-muted-foreground line-clamp-2 min-h-[2.5rem] mt-3">
          {agent.description || agent.greeting || t('无描述')}
        </p>
        <div className="flex items-center justify-between mt-auto pt-3 border-t border-border">
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <MessageSquare className="h-3.5 w-3.5" />
            {t('{count} 次对话', { count: agent.chatCount })}
          </span>
          <Button
            size="sm"
            className="gap-1"
            onClick={() => router.push(`/portal/apps/ai/agents/${agent.id}`)}
          >
            <Sparkles className="h-3.5 w-3.5" />
            {t('立即体验')}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

/** 知识库卡片：BookOpen 图标 + 名称/创建者 + 描述 + tags + 文档/提问数，整卡进详情 */
export function KbHallCard({ kb }: { kb: AIKnowledgeBase }) {
  const t = useT()
  const router = useRouter()
  return (
    <Card
      className="cursor-pointer hover:shadow-lg hover:border-primary/40 transition-all group h-full"
      onClick={() => router.push(`/portal/apps/ai/kb/${kb.id}`)}
    >
      <CardContent className="p-5 flex flex-col h-full">
        <div className="flex items-start gap-3">
          <div className="relative shrink-0">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 border border-emerald-500/20 flex items-center justify-center">
              <BookOpen className="h-5 w-5 text-emerald-600" />
            </div>
            {isNewContent(kb.createdAt) && <NewBadge />}
          </div>
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
        <p className="text-sm text-muted-foreground line-clamp-2 min-h-[2.5rem] mt-3">
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
        </div>
      </CardContent>
    </Card>
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
