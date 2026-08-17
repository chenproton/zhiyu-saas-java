'use client'

// 知识库管理（spec docs/spec/ai-service-center.md §7 F2/F3）：基本信息 / 文档管理 / 协作者。
// v2.6：全宽创作页（无侧边栏）+ 共享编辑器骨架 + 卡片化视觉（对齐 zhiyu-ai/landing 设计语言）。
import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { BookOpen, FileText, Loader2, Trash2, Upload, UserPlus } from 'lucide-react'
import { useToast } from '@zhiyu/ui'
import { aiCenterKbApi } from '@/lib/api'
import type { AIKBCollaborator, AIKBDocument, AIKnowledgeBase } from '@/lib/api'
import { formatDateTime, formatSize } from '@/lib/format-utils'
import { useT } from '@/lib/i18n/locale-provider'
import { AIStatusBadge } from '../../components/ai-status-badge'
import { StudioEditorShell, EditorCard } from '../../../_components/studio-editor-shell'
import { ClassifySelects, type ClassifyValue } from '../../../_components/classify-selects'

const ACCEPT = '.pdf,.docx,.txt,.md'
const POLL_INTERVAL = 2500

export default function KBManagePage() {
  const params = useParams()
  const kbId = String(params.id)
  const t = useT()
  const { toast } = useToast()

  const [kb, setKb] = useState<AIKnowledgeBase | null>(null)
  const [loading, setLoading] = useState(true)

  // 基本信息表单
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [tags, setTags] = useState('')
  const [classify, setClassify] = useState<ClassifyValue>({ majorId: '', departmentId: '', kbType: '' })
  const [saving, setSaving] = useState(false)

  // 文档
  const [docs, setDocs] = useState<AIKBDocument[]>([])
  const [docsLoading, setDocsLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // 协作者
  const [collaborators, setCollaborators] = useState<AIKBCollaborator[]>([])
  const [collabLoading, setCollabLoading] = useState(true)
  const [newUserId, setNewUserId] = useState('')
  const [newRole, setNewRole] = useState<'editor' | 'viewer'>('editor')
  const [collabActing, setCollabActing] = useState(false)
  const [removeCollab, setRemoveCollab] = useState<AIKBCollaborator | null>(null)
  const [deleteDoc, setDeleteDoc] = useState<AIKBDocument | null>(null)
  const [acting, setActing] = useState(false)

  const myRole = kb?.myRole ?? 'viewer'
  const canEdit = myRole === 'owner' || myRole === 'editor'
  const isOwner = myRole === 'owner'

  // setState 只发生在 fetch 回调里（react-hooks/set-state-in-effect）
  const loadKb = useCallback(() => {
    aiCenterKbApi
      .get(kbId)
      .then((data) => {
        setKb(data)
        setName(data.name)
        setDescription(data.description)
        setTags((data.tags ?? []).join(', '))
        setClassify({ majorId: data.majorId ?? '', departmentId: data.departmentId ?? '', kbType: data.kbType ?? '' })
      })
      .catch((err: unknown) =>
        toast({
          title: t('加载失败'),
          description: err instanceof Error ? err.message : undefined,
          variant: 'destructive',
        }),
      )
      .finally(() => setLoading(false))
  }, [kbId, t, toast])

  // 文档列表：返回最新 items 供轮询判断；silent 时不弹错误
  const fetchDocs = useCallback(
    (silent = false): Promise<AIKBDocument[]> =>
      aiCenterKbApi
        .listDocuments(kbId)
        .then((res) => {
          setDocs(res.items)
          return res.items
        })
        .catch((err: unknown) => {
          if (!silent) {
            toast({
              title: t('加载失败'),
              description: err instanceof Error ? err.message : undefined,
              variant: 'destructive',
            })
          }
          return [] as AIKBDocument[]
        })
        .finally(() => setDocsLoading(false)),
    [kbId, t, toast],
  )

  // 上传/删除后若仍有 parsing 文档，2.5s 轮询直到全部解析完（组件卸载清理）。
  // 经 ref 镜像自引用，避免 const 初始化器内访问自身的声明顺序问题（react-hooks/immutability）
  const schedulePollRef = useRef<() => void>(() => {})
  const schedulePoll = useCallback(() => {
    if (pollRef.current) clearTimeout(pollRef.current)
    pollRef.current = setTimeout(() => {
      void fetchDocs(true).then((items) => {
        if (items.some((d) => d.status === 'parsing')) schedulePollRef.current()
      })
    }, POLL_INTERVAL)
  }, [fetchDocs])
  useEffect(() => {
    schedulePollRef.current = schedulePoll
  }, [schedulePoll])

  const refreshDocsAndPoll = useCallback(
    () =>
      fetchDocs().then((items) => {
        if (items.some((d) => d.status === 'parsing')) schedulePoll()
      }),
    [fetchDocs, schedulePoll],
  )

  const loadCollaborators = useCallback(() => {
    aiCenterKbApi
      .listCollaborators(kbId)
      .then((res) => setCollaborators(res.items))
      .catch(() => {
        // 非 owner 也可能无权限查看失败时静默降级为空列表
      })
      .finally(() => setCollabLoading(false))
  }, [kbId])

  useEffect(() => {
    loadKb()
    refreshDocsAndPoll()
    loadCollaborators()
    return () => {
      if (pollRef.current) clearTimeout(pollRef.current)
    }
  }, [loadKb, refreshDocsAndPoll, loadCollaborators])

  const handleSave = async () => {
    if (!name.trim()) {
      toast({ title: t('请填写名称'), variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      await aiCenterKbApi.update(kbId, {
        name: name.trim(),
        description: description.trim(),
        tags: tags
          .split(/[,，]/)
          .map((s) => s.trim())
          .filter(Boolean),
        majorId: classify.majorId || undefined,
        departmentId: classify.departmentId || undefined,
        kbType: (classify.kbType || undefined) as import('@/lib/api').AIKBType | undefined,
      })
      toast({ title: t('保存成功') })
      loadKb()
    } catch (err) {
      toast({
        title: t('保存失败'),
        description: err instanceof Error ? err.message : undefined,
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  const handlePickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase()
    if (!['.pdf', '.docx', '.txt', '.md'].includes(ext)) {
      toast({ title: t('仅支持 PDF / DOCX / TXT / MD 文件'), variant: 'destructive' })
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: t('单个文件不超过 10MB'), variant: 'destructive' })
      return
    }
    setUploading(true)
    aiCenterKbApi
      .uploadDocument(kbId, file)
      .then(() => {
        toast({ title: t('上传成功，正在解析') })
        refreshDocsAndPoll()
        loadKb()
      })
      .catch((err: unknown) => {
        toast({
          title: t('上传失败'),
          description: err instanceof Error ? err.message : undefined,
          variant: 'destructive',
        })
      })
      .finally(() => setUploading(false))
  }

  const handleDeleteDoc = async () => {
    if (!deleteDoc || acting) return
    setActing(true)
    try {
      await aiCenterKbApi.removeDocument(kbId, deleteDoc.id)
      toast({ title: t('已删除') })
      setDeleteDoc(null)
      refreshDocsAndPoll()
      loadKb()
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

  const handleAddCollaborator = async () => {
    if (!newUserId.trim()) {
      toast({ title: t('请填写用户 ID'), variant: 'destructive' })
      return
    }
    setCollabActing(true)
    try {
      await aiCenterKbApi.addCollaborator(kbId, newUserId.trim(), newRole)
      toast({ title: t('操作成功') })
      setNewUserId('')
      setNewRole('editor')
      loadCollaborators()
    } catch (err) {
      toast({
        title: t('操作失败'),
        description: err instanceof Error ? err.message : undefined,
        variant: 'destructive',
      })
    } finally {
      setCollabActing(false)
    }
  }

  const handleRemoveCollaborator = async () => {
    if (!removeCollab || collabActing) return
    setCollabActing(true)
    try {
      await aiCenterKbApi.removeCollaborator(kbId, removeCollab.userId)
      toast({ title: t('已移除') })
      setRemoveCollab(null)
      loadCollaborators()
    } catch (err) {
      toast({
        title: t('操作失败'),
        description: err instanceof Error ? err.message : undefined,
        variant: 'destructive',
      })
    } finally {
      setCollabActing(false)
    }
  }

  const renderDocStatus = (doc: AIKBDocument) => {
    if (doc.status === 'parsing') {
      return (
        <span className="flex items-center gap-1 text-xs text-yellow-700">
          <Loader2 className="w-3 h-3 animate-spin" />
          {t('解析中')}
        </span>
      )
    }
    if (doc.status === 'failed') {
      return (
        <span className="text-xs text-red-600">
          {t('解析失败')}
          {doc.error ? `：${doc.error}` : ''}
        </span>
      )
    }
    return <span className="text-xs text-green-700">{t('就绪')}</span>
  }

  if (loading) {
    return (
      <div className="py-20 flex items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        {t('加载中...')}
      </div>
    )
  }

  if (!kb) {
    return (
      <div className="py-20 text-center text-sm text-muted-foreground">{t('加载失败')}</div>
    )
  }

  return (
    <StudioEditorShell
      icon={
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <BookOpen className="w-4 h-4 text-primary" />
        </div>
      }
      title={kb.name}
      badge={<AIStatusBadge status={kb.status} />}
    >
      {kb.status === 'rejected' && kb.reviewComment && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {t('驳回原因')}：{kb.reviewComment}
        </div>
      )}
      {!canEdit && (
        <div className="mb-4 rounded-xl border border-gray-200 bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
          {t('当前为只读权限，仅可查看')}
        </div>
      )}

      <Tabs defaultValue="info">
        <TabsList className="bg-white p-1 rounded-xl border border-[#e7e5e4] shadow-sm h-11">
          <TabsTrigger value="info" className="px-5 rounded-[10px] data-[state=active]:bg-primary data-[state=active]:text-white">{t('基本信息')}</TabsTrigger>
          <TabsTrigger value="docs" className="px-5 rounded-[10px] data-[state=active]:bg-primary data-[state=active]:text-white">{t('文档管理（{count}）', { count: docs.length })}</TabsTrigger>
          <TabsTrigger value="collaborators" className="px-5 rounded-[10px] data-[state=active]:bg-primary data-[state=active]:text-white">{t('协作者（{count}）', { count: collaborators.length })}</TabsTrigger>
        </TabsList>

        {/* 基本信息 */}
        <TabsContent value="info" className="mt-4">
          <EditorCard title={t('基本信息')} desc={t('名称、描述与分类决定了它在大厅中的展示与筛选')}>
            <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t('名称')}</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} disabled={!canEdit} maxLength={200} />
            </div>
            <div className="space-y-2">
              <Label>{t('描述')}</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                disabled={!canEdit}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('标签')}</Label>
              <Input
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder={t('多个标签用逗号分隔')}
                disabled={!canEdit}
              />
            </div>
            <div className={canEdit ? '' : 'pointer-events-none opacity-60'}>
              <ClassifySelects value={classify} onChange={setClassify} withKbType />
            </div>
            {canEdit && (
              <div className="flex justify-end">
                <Button onClick={handleSave} disabled={saving} className="px-8">
                  {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  {t('保存')}
                </Button>
              </div>
            )}
            </div>
          </EditorCard>
        </TabsContent>

        {/* 文档管理 */}
        <TabsContent value="docs" className="mt-4">
          <EditorCard title={t('文档管理')} desc={t('支持 PDF / DOCX / TXT / MD，单个文件不超过 10MB，解析后即可被检索提问')} className="overflow-hidden" contentClassName="p-0">
            <div className="px-5 py-3 border-b border-dashed border-[#e7e5e4] flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                {t('支持 PDF / DOCX / TXT / MD，单个文件不超过 10MB')}
              </p>
              {canEdit && (
                <>
                  <input
                    ref={fileRef}
                    type="file"
                    accept={ACCEPT}
                    className="hidden"
                    onChange={handlePickFile}
                  />
                  <Button size="sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
                    {uploading ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-1" />
                    ) : (
                      <Upload className="w-4 h-4 mr-1" />
                    )}
                    {uploading ? t('上传中...') : t('上传文档')}
                  </Button>
                </>
              )}
            </div>
            <div className="divide-y divide-gray-100">
              {docsLoading ? (
                <div className="px-4 py-10 flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t('加载中...')}
                </div>
              ) : docs.length === 0 ? (
                <p className="px-4 py-10 text-sm text-muted-foreground text-center">{t('暂无文档')}</p>
              ) : (
                docs.map((doc) => (
                  <div key={doc.id} className="px-4 py-3 flex items-start gap-3">
                    <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                      <FileText className="w-4 h-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{doc.name}</p>
                      <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                        <span>{formatSize(doc.fileSize)}</span>
                        {renderDocStatus(doc)}
                        {doc.status === 'ready' && (
                          <span>{t('{count} 个分块', { count: doc.chunkCount })}</span>
                        )}
                        {doc.uploaderName && (
                          <span>
                            {t('上传人')}：{doc.uploaderName}
                          </span>
                        )}
                        <span>{formatDateTime(doc.createdAt)}</span>
                      </div>
                    </div>
                    {canEdit && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-600 hover:text-red-700 shrink-0"
                        disabled={acting}
                        onClick={() => setDeleteDoc(doc)}
                      >
                        <Trash2 className="w-3.5 h-3.5 mr-1" />
                        {t('删除')}
                      </Button>
                    )}
                  </div>
                ))
              )}
            </div>
          </EditorCard>
        </TabsContent>

        {/* 协作者 */}
        <TabsContent value="collaborators" className="mt-4">
          <EditorCard title={t('协作者')} desc={t('邀请同租户成员共建：编辑者可维护文档，查看者只读')} className="overflow-hidden" contentClassName="p-0">
            {isOwner && (
              <div className="px-5 py-4 border-b border-dashed border-[#e7e5e4] flex items-end gap-2 flex-wrap">
                <div className="space-y-1 flex-1 min-w-[12rem]">
                  <Label className="text-xs">{t('用户 ID')}</Label>
                  <Input
                    value={newUserId}
                    onChange={(e) => setNewUserId(e.target.value)}
                    placeholder={t('输入同租户用户的 ID')}
                  />
                </div>
                <div className="space-y-1 w-32">
                  <Label className="text-xs">{t('角色')}</Label>
                  <Select value={newRole} onValueChange={(v) => setNewRole(v as 'editor' | 'viewer')}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="editor">{t('编辑者')}</SelectItem>
                      <SelectItem value="viewer">{t('查看者')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button size="sm" onClick={handleAddCollaborator} disabled={collabActing}>
                  {collabActing ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-1" />
                  ) : (
                    <UserPlus className="w-4 h-4 mr-1" />
                  )}
                  {t('添加协作者')}
                </Button>
              </div>
            )}
            <div className="divide-y divide-gray-100">
              {collabLoading ? (
                <div className="px-4 py-10 flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t('加载中...')}
                </div>
              ) : collaborators.length === 0 ? (
                <p className="px-4 py-10 text-sm text-muted-foreground text-center">{t('暂无协作者')}</p>
              ) : (
                collaborators.map((c) => (
                  <div key={c.id} className="px-4 py-3 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{c.userName || c.userId}</p>
                      <p className="text-xs text-muted-foreground">
                        {c.role === 'editor' ? t('编辑者') : t('查看者')} · {formatDateTime(c.createdAt)}
                      </p>
                    </div>
                    {isOwner && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-600 hover:text-red-700"
                        disabled={collabActing}
                        onClick={() => setRemoveCollab(c)}
                      >
                        {t('移除')}
                      </Button>
                    )}
                  </div>
                ))
              )}
            </div>
          </EditorCard>
        </TabsContent>
      </Tabs>

      {/* 删除文档二次确认 */}
      <Dialog open={!!deleteDoc} onOpenChange={(open) => !open && setDeleteDoc(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('确认删除')}</DialogTitle>
            <DialogDescription>
              {t('删除后不可恢复，确定删除「{name}」吗？', { name: deleteDoc?.name ?? '' })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDoc(null)}>
              {t('取消')}
            </Button>
            <Button variant="destructive" onClick={handleDeleteDoc} disabled={acting}>
              {acting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {t('删除')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 移除协作者二次确认 */}
      <Dialog open={!!removeCollab} onOpenChange={(open) => !open && setRemoveCollab(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('移除协作者')}</DialogTitle>
            <DialogDescription>
              {t('确定移除协作者「{name}」吗？', {
                name: removeCollab?.userName || removeCollab?.userId || '',
              })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoveCollab(null)}>
              {t('取消')}
            </Button>
            <Button variant="destructive" onClick={handleRemoveCollaborator} disabled={collabActing}>
              {collabActing && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {t('移除')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </StudioEditorShell>
  )
}
