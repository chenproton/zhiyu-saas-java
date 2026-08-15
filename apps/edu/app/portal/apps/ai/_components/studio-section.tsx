'use client'

// 我的工坊区块（spec docs/spec/ai-service-center.md §7 F2/F5）：我的知识库 + 我的智能体管理。
// 由落地页（landing）嵌入；/studio 旧路由重定向至 landing#studio。
// 列表采用与 admin/reviews 一致的表格布局（Table 组件，每行 <tr> 含名称文本，供验收 flow clickRow 定位）。
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
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { Loader2, MessageSquare, Pencil, Plus, Send, Trash2, Undo2 } from 'lucide-react'
import { useToast } from '@zhiyu/ui'
import { aiCenterAgentApi, aiCenterKbApi } from '@/lib/api'
import type { AIAgent, AIKnowledgeBase } from '@/lib/api'
import { useT } from '@/lib/i18n/locale-provider'
import { AIStatusBadge } from '../studio/components/ai-status-badge'

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
      await aiCenterKbApi.create({ name: newName.trim(), description: newDesc.trim(), tags })
      toast({ title: t('创建成功') })
      setCreateOpen(false)
      setNewName('')
      setNewDesc('')
      setNewTags('')
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

  const kbTableHeader = (
    <TableHeader>
      <TableRow>
        <TableHead>{t('名称')}</TableHead>
        <TableHead>{t('状态')}</TableHead>
        <TableHead>{t('文档数')}</TableHead>
        <TableHead>{t('被问次数')}</TableHead>
        <TableHead className="text-right">{t('操作')}</TableHead>
      </TableRow>
    </TableHeader>
  )

  const renderKbRow = (kb: AIKnowledgeBase) => {
    const role = kb.myRole ?? 'owner'
    const canEdit = role === 'owner' || role === 'editor'
    const isOwner = role === 'owner'
    return (
      <TableRow key={kb.id}>
        <TableCell className="max-w-[280px]">
          <p className="font-medium truncate">{kb.name}</p>
          {kb.description && (
            <p className="text-xs text-muted-foreground truncate mt-0.5">{kb.description}</p>
          )}
          {kb.tags.length > 0 && (
            <div className="mt-1 flex items-center gap-1 flex-wrap">
              {kb.tags.map((tag) => (
                <span key={tag} className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                  {tag}
                </span>
              ))}
            </div>
          )}
          {kb.status === 'rejected' && kb.reviewComment && (
            <p className="mt-0.5 text-xs text-red-600">
              {t('驳回原因')}：{kb.reviewComment}
            </p>
          )}
        </TableCell>
        <TableCell>
          <AIStatusBadge status={kb.status} />
        </TableCell>
        <TableCell>{kb.docCount}</TableCell>
        <TableCell>{kb.askCount}</TableCell>
        <TableCell className="text-right">
          <div className="flex justify-end gap-1">
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
        </TableCell>
      </TableRow>
    )
  }

  const renderAgentRow = (agent: AIAgent) => (
    <TableRow key={agent.id}>
      <TableCell className="max-w-[280px]">
        <div className="flex items-center gap-2">
          {agent.avatar && <span className="text-lg shrink-0">{agent.avatar}</span>}
          <div className="min-w-0">
            <p className="font-medium truncate">{agent.name}</p>
            {agent.description && (
              <p className="text-xs text-muted-foreground truncate mt-0.5">{agent.description}</p>
            )}
            {agent.status === 'rejected' && agent.reviewComment && (
              <p className="mt-0.5 text-xs text-red-600">
                {t('驳回原因')}：{agent.reviewComment}
              </p>
            )}
          </div>
        </div>
      </TableCell>
      <TableCell>
        <AIStatusBadge status={agent.status} />
      </TableCell>
      <TableCell>{agent.chatCount}</TableCell>
      <TableCell className="text-right">
        <div className="flex justify-end gap-1">
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
      </TableCell>
    </TableRow>
  )

  const renderLoading = (
    <div className="px-4 py-10 flex items-center justify-center gap-2 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" />
      {t('加载中...')}
    </div>
  )

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-semibold">{t('我的工坊')}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t('创建并管理你的知识库与智能体，提交审核后发布到广场')}
        </p>
      </div>

      <Tabs defaultValue="kb">
        <TabsList>
          <TabsTrigger value="kb">{t('我的知识库')}</TabsTrigger>
          <TabsTrigger value="agent">{t('我的智能体')}</TabsTrigger>
        </TabsList>

        <TabsContent value="kb" className="mt-4 space-y-6">
          <div className="rounded-lg border border-gray-100 bg-white shadow-sm">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-sm font-medium">{t('我的知识库')}</h2>
              <Button size="sm" onClick={() => setCreateOpen(true)}>
                <Plus className="w-4 h-4 mr-1" />
                {t('新建知识库')}
              </Button>
            </div>
            {kbLoading ? (
              renderLoading
            ) : myKbs.length === 0 ? (
              <p className="px-4 py-10 text-sm text-muted-foreground text-center">
                {t('暂无知识库，点击「新建知识库」开始')}
              </p>
            ) : (
              <Table>
                {kbTableHeader}
                <TableBody>{myKbs.map(renderKbRow)}</TableBody>
              </Table>
            )}
          </div>

          <div className="rounded-lg border border-gray-100 bg-white shadow-sm">
            <div className="px-4 py-3 border-b border-gray-100">
              <h2 className="text-sm font-medium">{t('共享给我的')}</h2>
            </div>
            {kbLoading ? (
              renderLoading
            ) : sharedKbs.length === 0 ? (
              <p className="px-4 py-10 text-sm text-muted-foreground text-center">
                {t('暂无共享给我的知识库')}
              </p>
            ) : (
              <Table>
                {kbTableHeader}
                <TableBody>{sharedKbs.map(renderKbRow)}</TableBody>
              </Table>
            )}
          </div>
        </TabsContent>

        <TabsContent value="agent" className="mt-4">
          <div className="rounded-lg border border-gray-100 bg-white shadow-sm">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-sm font-medium">{t('我的智能体')}</h2>
              <Button size="sm" onClick={() => router.push('/portal/apps/ai/studio/agents/new')}>
                <Plus className="w-4 h-4 mr-1" />
                {t('新建智能体')}
              </Button>
            </div>
            {agentLoading ? (
              renderLoading
            ) : agents.length === 0 ? (
              <p className="px-4 py-10 text-sm text-muted-foreground text-center">
                {t('暂无智能体，点击「新建智能体」开始')}
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('名称')}</TableHead>
                    <TableHead>{t('状态')}</TableHead>
                    <TableHead>{t('对话轮数')}</TableHead>
                    <TableHead className="text-right">{t('操作')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>{agents.map(renderAgentRow)}</TableBody>
              </Table>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* 新建知识库 */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('新建知识库')}</DialogTitle>
            <DialogDescription>{t('创建后为私有，可上传文档并提交审核发布到广场')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t('名称')}</Label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} maxLength={200} />
            </div>
            <div className="space-y-2">
              <Label>{t('描述')}</Label>
              <Textarea value={newDesc} onChange={(e) => setNewDesc(e.target.value)} rows={3} />
            </div>
            <div className="space-y-2">
              <Label>{t('标签')}</Label>
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
