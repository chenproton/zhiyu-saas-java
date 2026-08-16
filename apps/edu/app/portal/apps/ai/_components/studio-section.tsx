'use client'

// 我的工坊区块（spec docs/spec/ai-service-center.md §7 F2/F5）：我的知识库 + 我的智能体管理。
// 由落地页（landing）嵌入；/studio 旧路由重定向至 landing#studio。
// v1.4 卡片化：对齐 evaluation/landing 考试中心卡片模式——封面横幅（coverImage，无则渐变兜底）
// + 右上角状态徽标 + 正文统计 + 操作按钮；卡片带 data-smoke-card 供验收 flow clickCard 定位。
// v2.0 面板化（对标考试中心大面板）：图标头部 + 胶囊 CTA + 左侧状态环图 + 右侧分组卡片，
// 取消 Tabs（一个面板全看到）。
import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  BookOpen,
  FileText,
  HelpCircle,
  Loader2,
  MessageSquare,
  Pencil,
  Plus,
  Send,
  Trash2,
  Undo2,
  Wrench,
} from 'lucide-react'
import { useToast } from '@zhiyu/ui'
import { aiCenterAgentApi, aiCenterKbApi, fileApi } from '@/lib/api'
import type { AIAgent, AIKnowledgeBase } from '@/lib/api'
import { useT } from '@/lib/i18n/locale-provider'
import { coverGradientFor } from '@/lib/cover-gradients'
import { CoverImageUpload } from '@/components/shared/cover-image-upload'
import { AIStatusBadge } from '../studio/components/ai-status-badge'

/** 卡片封面横幅：有封面图用图，无则渐变 + 居中图标（对齐 ExamCenterCard） */
function CardCover({
  cover,
  seed,
  icon,
  status,
}: {
  cover?: string
  seed: string
  icon: React.ReactNode
  status: React.ReactNode
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
      {!cover && icon}
      <div className="absolute top-3 right-3 [&_span]:bg-white/90 [&_span]:backdrop-blur-sm [&_span]:shadow-sm">
        {status}
      </div>
    </div>
  )
}

const cardClass =
  'bg-white rounded-2xl border border-[#e7e5e4] overflow-hidden flex flex-col shadow-[0_2px_6px_rgba(0,0,0,0.04)] hover:shadow-[0_12px_32px_rgba(0,0,0,0.1)] hover:-translate-y-1 transition-all'

export function StudioSection() {
  const t = useT()
  const router = useRouter()
  const { toast } = useToast()

  // ---------- 知识库 ----------
  const [myKbs, setMyKbs] = useState<AIKnowledgeBase[]>([])
  const [sharedKbs, setSharedKbs] = useState<AIKnowledgeBase[]>([])
  const [kbLoading, setKbLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [newTags, setNewTags] = useState('')
  const [newCover, setNewCover] = useState('')
  const [coverUploading, setCoverUploading] = useState(false)
  const [creating, setCreating] = useState(false)

  // ---------- 智能体 ----------
  const [agents, setAgents] = useState<AIAgent[]>([])
  const [agentLoading, setAgentLoading] = useState(true)

  // ---------- 通用 ----------
  const [acting, setActing] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<{ kind: 'kb' | 'agent'; id: string; name: string } | null>(null)
  const [warnings, setWarnings] = useState<string[] | null>(null)

  // setState 只发生在 fetch 回调里（react-hooks/set-state-in-effect）；重新加载由事件处理器触发，loading 初值为 true 仅覆盖首屏
  const loadKbs = useCallback(() => {
    Promise.all([
      aiCenterKbApi.listMine({ scope: 'owned' }),
      aiCenterKbApi.listMine({ scope: 'collaborating' }),
    ])
      .then(([mine, shared]) => {
        setMyKbs(mine.items)
        setSharedKbs(shared.items)
      })
      .catch((err: unknown) =>
        toast({
          title: t('加载失败'),
          description: err instanceof Error ? err.message : undefined,
          variant: 'destructive',
        }),
      )
      .finally(() => setKbLoading(false))
  }, [t, toast])

  const loadAgents = useCallback(() => {
    aiCenterAgentApi
      .listMine()
      .then((res) => setAgents(res.items))
      .catch((err: unknown) =>
        toast({
          title: t('加载失败'),
          description: err instanceof Error ? err.message : undefined,
          variant: 'destructive',
        }),
      )
      .finally(() => setAgentLoading(false))
  }, [t, toast])

  useEffect(() => {
    loadKbs()
    loadAgents()
  }, [loadKbs, loadAgents])

  // 封面上传（复用通用组件 CoverImageUpload，落 fileApi 本地存储，≤5MB）
  const handleCoverUpload = async (file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      toast({ variant: 'destructive', title: t('提示'), description: t('文件大小不能超过 5MB') })
      return
    }
    if (!file.type.startsWith('image/')) {
      toast({ variant: 'destructive', title: t('提示'), description: t('请上传图片文件') })
      return
    }
    setCoverUploading(true)
    try {
      const res = await fileApi.upload(file)
      setNewCover(res.url)
    } catch (err: unknown) {
      toast({
        variant: 'destructive',
        title: t('上传失败'),
        description: err instanceof Error ? err.message : undefined,
      })
    } finally {
      setCoverUploading(false)
    }
  }

  const handleCreateKb = async () => {
    if (!newName.trim()) {
      toast({ title: t('请填写名称'), variant: 'destructive' })
      return
    }
    setCreating(true)
    try {
      const tags = newTags
        .split(/[,，]/)
        .map((s) => s.trim())
        .filter(Boolean)
      await aiCenterKbApi.create({
        name: newName.trim(),
        description: newDesc.trim(),
        tags,
        coverImage: newCover || undefined,
      })
      toast({ title: t('创建成功') })
      setCreateOpen(false)
      setNewName('')
      setNewDesc('')
      setNewTags('')
      setNewCover('')
      loadKbs()
    } catch (err) {
      toast({
        title: t('创建失败'),
        description: err instanceof Error ? err.message : undefined,
        variant: 'destructive',
      })
    } finally {
      setCreating(false)
    }
  }

  const runAction = async (fn: () => Promise<unknown>, successTitle: string, reload: () => void) => {
    if (acting) return
    setActing(true)
    try {
      await fn()
      toast({ title: successTitle })
      reload()
    } catch (err) {
      toast({
        title: t('操作失败'),
        description: err instanceof Error ? err.message : undefined,
        variant: 'destructive',
      })
    } finally {
      setActing(false)
    }
  }

  const handleSubmitKb = (id: string) =>
    runAction(() => aiCenterKbApi.submit(id), t('已提交，等待管理员审核'), loadKbs)

  const handleUnpublishKb = (id: string) =>
    runAction(() => aiCenterKbApi.unpublish(id), t('已下架'), loadKbs)

  const handleSubmitAgent = async (id: string) => {
    if (acting) return
    setActing(true)
    try {
      const res = await aiCenterAgentApi.submit(id)
      if (res.warnings && res.warnings.length > 0) {
        // 关联私有库等提示：逐条展示（spec §3.1 AG-2）
        setWarnings(res.warnings)
      } else {
        toast({ title: t('已提交，等待管理员审核') })
      }
      loadAgents()
    } catch (err) {
      toast({
        title: t('操作失败'),
        description: err instanceof Error ? err.message : undefined,
        variant: 'destructive',
      })
    } finally {
      setActing(false)
    }
  }

  const handleUnpublishAgent = (id: string) =>
    runAction(() => aiCenterAgentApi.unpublish(id), t('已下架'), loadAgents)

  const handleDelete = async () => {
    if (!deleteTarget || acting) return
    setActing(true)
    try {
      if (deleteTarget.kind === 'kb') {
        await aiCenterKbApi.remove(deleteTarget.id)
      } else {
        await aiCenterAgentApi.remove(deleteTarget.id)
      }
      toast({ title: t('已删除') })
      setDeleteTarget(null)
      if (deleteTarget.kind === 'kb') loadKbs()
      else loadAgents()
    } catch (err) {
      toast({
        title: t('操作失败'),
        description: err instanceof Error ? err.message : undefined,
        variant: 'destructive',
      })
    } finally {
      setActing(false)
    }
  }

  const renderKbCard = (kb: AIKnowledgeBase) => {
    const role = kb.myRole ?? 'owner'
    const canEdit = role === 'owner' || role === 'editor'
    const isOwner = role === 'owner'
    return (
      <div key={kb.id} data-smoke-card className={cardClass}>
        <CardCover
          cover={kb.coverImage}
          seed={kb.id}
          icon={<BookOpen className="w-10 h-10 text-white/80" />}
          status={<AIStatusBadge status={kb.status} />}
        />
        <div className="p-4 flex-1 flex flex-col">
          <h3 className="text-[15px] font-semibold text-slate-800 truncate">{kb.name}</h3>
          {kb.description && (
            <p className="text-xs text-slate-400 mt-1 truncate">{kb.description}</p>
          )}
          {kb.tags.length > 0 && (
            <div className="mt-1.5 flex items-center gap-1 flex-wrap">
              {kb.tags.map((tag) => (
                <span key={tag} className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                  {tag}
                </span>
              ))}
            </div>
          )}
          {kb.status === 'rejected' && kb.reviewComment && (
            <p className="mt-1 text-xs text-red-600">
              {t('驳回原因')}：{kb.reviewComment}
            </p>
          )}
          <div className="flex items-center gap-4 text-[11px] text-slate-400 py-2.5 mt-2 border-b border-slate-50">
            <span className="flex items-center gap-1">
              <FileText className="w-3 h-3" /> {t('{count} 个文档', { count: kb.docCount })}
            </span>
            <span className="flex items-center gap-1">
              <HelpCircle className="w-3 h-3" /> {t('{count} 次提问', { count: kb.askCount })}
            </span>
          </div>
          <div className="flex flex-wrap gap-1 pt-2.5">
            {canEdit && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push(`/portal/apps/ai/studio/kb/${kb.id}`)}
              >
                <Pencil className="w-3.5 h-3.5 mr-1" />
                {t('编辑')}
              </Button>
            )}
            {isOwner && (kb.status === 'private' || kb.status === 'rejected') && (
              <Button variant="ghost" size="sm" disabled={acting} onClick={() => handleSubmitKb(kb.id)}>
                <Send className="w-3.5 h-3.5 mr-1" />
                {t('提交审核')}
              </Button>
            )}
            {isOwner && kb.status === 'published' && (
              <Button variant="ghost" size="sm" disabled={acting} onClick={() => handleUnpublishKb(kb.id)}>
                <Undo2 className="w-3.5 h-3.5 mr-1" />
                {t('下架')}
              </Button>
            )}
            {isOwner && (kb.status === 'private' || kb.status === 'rejected') && (
              <Button
                variant="ghost"
                size="sm"
                className="text-red-600 hover:text-red-700"
                disabled={acting}
                onClick={() => setDeleteTarget({ kind: 'kb', id: kb.id, name: kb.name })}
              >
                <Trash2 className="w-3.5 h-3.5 mr-1" />
                {t('删除')}
              </Button>
            )}
          </div>
        </div>
      </div>
    )
  }

  const renderAgentCard = (agent: AIAgent) => (
    <div key={agent.id} data-smoke-card className={cardClass}>
      <CardCover
        cover={agent.coverImage}
        seed={agent.id}
        icon={<span className="text-4xl">{agent.avatar || '🤖'}</span>}
        status={<AIStatusBadge status={agent.status} />}
      />
      <div className="p-4 flex-1 flex flex-col">
        <h3 className="text-[15px] font-semibold text-slate-800 truncate">{agent.name}</h3>
        {agent.description && (
          <p className="text-xs text-slate-400 mt-1 truncate">{agent.description}</p>
        )}
        {agent.status === 'rejected' && agent.reviewComment && (
          <p className="mt-1 text-xs text-red-600">
            {t('驳回原因')}：{agent.reviewComment}
          </p>
        )}
        <div className="flex items-center gap-4 text-[11px] text-slate-400 py-2.5 mt-2 border-b border-slate-50">
          <span className="flex items-center gap-1">
            <MessageSquare className="w-3 h-3" /> {t('{count} 次对话', { count: agent.chatCount })}
          </span>
        </div>
        <div className="flex flex-wrap gap-1 pt-2.5">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push(`/portal/apps/ai/studio/agents/${agent.id}`)}
          >
            <Pencil className="w-3.5 h-3.5 mr-1" />
            {t('编辑')}
          </Button>
          {(agent.status === 'private' || agent.status === 'rejected') && (
            <Button variant="ghost" size="sm" disabled={acting} onClick={() => handleSubmitAgent(agent.id)}>
              <Send className="w-3.5 h-3.5 mr-1" />
              {t('提交审核')}
            </Button>
          )}
          {agent.status === 'published' && (
            <>
              <Button variant="ghost" size="sm" disabled={acting} onClick={() => handleUnpublishAgent(agent.id)}>
                <Undo2 className="w-3.5 h-3.5 mr-1" />
                {t('下架')}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push(`/portal/apps/ai/agents/${agent.id}`)}
              >
                <MessageSquare className="w-3.5 h-3.5 mr-1" />
                {t('对话')}
              </Button>
            </>
          )}
          {(agent.status === 'private' || agent.status === 'rejected') && (
            <Button
              variant="ghost"
              size="sm"
              className="text-red-600 hover:text-red-700"
              disabled={acting}
              onClick={() => setDeleteTarget({ kind: 'agent', id: agent.id, name: agent.name })}
            >
              <Trash2 className="w-3.5 h-3.5 mr-1" />
              {t('删除')}
            </Button>
          )}
        </div>
      </div>
    </div>
  )

  const renderLoading = (
    <div className="px-4 py-10 flex items-center justify-center gap-2 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" />
      {t('加载中...')}
    </div>
  )

  const emptyBox = (text: string) => (
    <div className="rounded-2xl border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
      {text}
    </div>
  )


  const totalMine = myKbs.length + agents.length

  return (
    <div className="max-w-[1400px] mx-auto">
      {/* 工坊大面板（对标考试中心面板） */}
      <div className="bg-white rounded-2xl border border-[#e7e5e4] shadow-[0_4px_20px_rgba(0,0,0,0.04)] overflow-hidden">
        <div className="px-6 pt-6 pb-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-100">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/10 flex items-center justify-center shrink-0">
              <Wrench className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#0f172a]">{t('我的工坊')}</h2>
              <p className="text-sm text-slate-500 mt-1 max-w-xl">
                {t('创建并管理你的知识库与智能体，提交审核后发布到广场')}
              </p>
            </div>
          </div>
          <div className="flex gap-2.5 shrink-0">
            <Button
              className="rounded-full px-5 h-10 text-sm font-semibold bg-primary text-white hover:bg-primary/90 hover:-translate-y-0.5 shadow-lg shadow-primary/20 transition-all"
              onClick={() => setCreateOpen(true)}
            >
              <Plus className="w-4 h-4 mr-1" />
              {t('新建知识库')}
            </Button>
            <Button
              variant="outline"
              className="rounded-full px-5 h-10 text-sm font-semibold hover:-translate-y-0.5 transition-all"
              onClick={() => router.push('/portal/apps/ai/studio/agents/new')}
            >
              <Plus className="w-4 h-4 mr-1" />
              {t('新建智能体')}
            </Button>
          </div>
        </div>

        <div className="p-5">
          {kbLoading || agentLoading ? (
            renderLoading
          ) : totalMine + sharedKbs.length === 0 ? (
            emptyBox(t('还没有产出，点击右上角新建知识库或智能体开始'))
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {[
                ...myKbs.map(renderKbCard),
                ...agents.map(renderAgentCard),
                ...sharedKbs.map(renderKbCard),
              ]}
            </div>
          )}
        </div>
      </div>

      {/* 新建知识库 */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('新建知识库')}</DialogTitle>
            <DialogDescription>{t('创建后为私有，可上传文档并提交审核发布到广场')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <CoverImageUpload
                imageUrl={newCover}
                uploading={coverUploading}
                label={t('封面')}
                alt={t('知识库封面')}
                onUpload={handleCoverUpload}
                onRemove={() => setNewCover('')}
              />
            </div>
            <div className="space-y-2">
              <span className="text-sm font-medium">{t('名称')}</span>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} maxLength={200} />
            </div>
            <div className="space-y-2">
              <span className="text-sm font-medium">{t('描述')}</span>
              <Textarea value={newDesc} onChange={(e) => setNewDesc(e.target.value)} rows={3} />
            </div>
            <div className="space-y-2">
              <span className="text-sm font-medium">{t('标签')}</span>
              <Input
                value={newTags}
                onChange={(e) => setNewTags(e.target.value)}
                placeholder={t('多个标签用逗号分隔')}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              {t('取消')}
            </Button>
            <Button onClick={handleCreateKb} disabled={creating}>
              {creating && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {t('创建')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除二次确认 */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('确认删除')}</DialogTitle>
            <DialogDescription>
              {t('删除后不可恢复，确定删除「{name}」吗？', { name: deleteTarget?.name ?? '' })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              {t('取消')}
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={acting}>
              {acting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {t('删除')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 提交审核 warnings 提示（spec §3.1 AG-2：关联私有库对他人不可见） */}
      <Dialog open={!!warnings} onOpenChange={(open) => !open && setWarnings(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('已提交，等待管理员审核')}</DialogTitle>
            <DialogDescription>{t('提交成功，但请注意以下事项')}</DialogDescription>
          </DialogHeader>
          <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
            {(warnings ?? []).map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
          <DialogFooter>
            <Button onClick={() => setWarnings(null)}>{t('确认')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

