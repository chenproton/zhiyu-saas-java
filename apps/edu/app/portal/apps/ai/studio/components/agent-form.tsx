'use client'

// 智能体编辑共用表单（新建/编辑页共用，v2.6 分卡片版：基本信息 / 对话设定 / 关联知识库）。
// 实时试聊面板由编辑页右栏承载（onPromptChange 上提当前提示词），表单内不再内嵌。
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Loader2 } from 'lucide-react'
import { useToast } from '@zhiyu/ui'
import { aiCenterKbApi, aiCenterSquareApi, fileApi } from '@/lib/api'
import { CoverImageUpload } from '@/components/shared/cover-image-upload'
import type { AIAgent, AIAgentInput, AIKnowledgeBase } from '@/lib/api'
import { useT } from '@/lib/i18n/locale-provider'
import { ClassifySelects, type ClassifyValue } from '../../_components/classify-selects'
import { EditorCard } from '../../_components/studio-editor-shell'

const MAX_PROMPT_LEN = 4000
const MAX_KB = 5
const PRESET_AVATARS = ['🤖', '🧠', '📚', '💡', '🎓', '🧪', '📝', '🗣️', '🔬', '🎨', '🎵', '⚽']

interface AgentFormProps {
  initial?: AIAgent
  submitLabel: string
  onSubmit: (input: AIAgentInput) => Promise<void>
  /** 表单实时状态上提（编辑页右栏实时试聊用：提示词 + 名称 + 头像） */
  onLiveChange?: (v: { prompt: string; name: string; avatar: string }) => void
}

export function AgentForm({ initial, submitLabel, onSubmit, onLiveChange }: AgentFormProps) {
  const t = useT()
  const { toast } = useToast()
  const [name, setNameState] = useState(initial?.name ?? '')
  const [avatar, setAvatarState] = useState(initial?.avatar ?? '🤖')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [greeting, setGreeting] = useState(initial?.greeting ?? '')
  const [systemPrompt, setSystemPromptState] = useState(initial?.systemPrompt ?? '')
  const liveRef = { prompt: systemPrompt, name, avatar }
  const emitLive = (patch: Partial<typeof liveRef>) => {
    onLiveChange?.({ ...liveRef, ...patch })
  }
  const setName = (v: string) => {
    setNameState(v)
    emitLive({ name: v })
  }
  const setAvatar = (v: string) => {
    setAvatarState(v)
    emitLive({ avatar: v })
  }
  const setSystemPrompt = (v: string) => {
    setSystemPromptState(v)
    emitLive({ prompt: v })
  }
  const [classify, setClassify] = useState<ClassifyValue>({
    majorId: initial?.majorId ?? '',
    departmentId: initial?.departmentId ?? '',
    kbType: '',
  })
  const [kbIds, setKbIds] = useState<string[]>(initial?.kbIds ?? [])
  const [coverUrl, setCoverUrl] = useState(initial?.coverImage ?? '')
  const [coverUploading, setCoverUploading] = useState(false)
  const [kbOptions, setKbOptions] = useState<AIKnowledgeBase[]>([])
  const [loadingKbs, setLoadingKbs] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  // 三路合并去重：我创建的 / 共享给我的 / 广场已发布的（spec §3.1 AG-1 关联范围）
  useEffect(() => {
    let cancelled = false
    Promise.allSettled([
      aiCenterKbApi.listMine({ scope: 'owned' }),
      aiCenterKbApi.listMine({ scope: 'collaborating' }),
      aiCenterSquareApi.kbs({ pageSize: 100 }),
    ]).then((results) => {
      if (cancelled) return
      const seen = new Map<string, AIKnowledgeBase>()
      for (const r of results) {
        if (r.status === 'fulfilled') {
          for (const kb of r.value.items) {
            if (!seen.has(kb.id)) seen.set(kb.id, kb)
          }
        }
      }
      setKbOptions(Array.from(seen.values()))
      setLoadingKbs(false)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const toggleKb = useCallback((id: string) => {
    setKbIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id)
      if (prev.length >= MAX_KB) return prev
      return [...prev, id]
    })
  }, [])

  const promptLen = useMemo(() => Array.from(systemPrompt).length, [systemPrompt])

  // 封面上传（复用通用 CoverImageUpload，fileApi 本地存储，≤5MB）
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
      setCoverUrl(res.url)
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

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast({ title: t('请填写名称'), variant: 'destructive' })
      return
    }
    if (!systemPrompt.trim()) {
      toast({ title: t('请填写角色提示词'), variant: 'destructive' })
      return
    }
    setSubmitting(true)
    try {
      await onSubmit({
        name: name.trim(),
        avatar: avatar.trim(),
        description: description.trim(),
        coverImage: coverUrl || undefined,
        greeting: greeting.trim(),
        systemPrompt: systemPrompt.trim(),
        kbIds,
        majorId: classify.majorId || undefined,
        departmentId: classify.departmentId || undefined,
      })
    } catch (err) {
      toast({
        title: t('操作失败'),
        description: err instanceof Error ? err.message : undefined,
        variant: 'destructive',
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-5">
      <EditorCard title={t('基本信息')} desc={t('名称、头像与分类决定了它在大厅中的展示与筛选')}>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>{t('名称')}</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('智能体名称')}
            maxLength={100}
          />
        </div>
        <div className="space-y-2">
          <Label>{t('头像')}</Label>
          <div className="flex items-center gap-2 flex-wrap">
            {PRESET_AVATARS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => setAvatar(emoji)}
                className={`w-9 h-9 rounded-md border text-lg flex items-center justify-center transition-colors ${
                  avatar === emoji
                    ? 'border-primary bg-primary/10'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                {emoji}
              </button>
            ))}
            <Input
              value={avatar}
              onChange={(e) => setAvatar(e.target.value)}
              className="w-20"
              maxLength={8}
              placeholder={t('输入 emoji')}
            />
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Label>{t('描述')}</Label>
        <Input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={t('描述智能体的用途')}
          maxLength={200}
        />
      </div>

      <div className="space-y-2 max-w-[400px] mt-4">
        <CoverImageUpload
          imageUrl={coverUrl}
          uploading={coverUploading}
          label={t('封面')}
          alt={t('智能体封面')}
          onUpload={handleCoverUpload}
          onRemove={() => setCoverUrl('')}
        />
      </div>

      <div className="mt-4">
        <ClassifySelects value={classify} onChange={setClassify} />
      </div>
      </EditorCard>

      <EditorCard title={t('对话设定')} desc={t('开场白与角色提示词直接决定对话风格与回答边界')}>
      <div className="space-y-2">
        <Label>{t('开场白')}</Label>
        <Textarea
          value={greeting}
          onChange={(e) => setGreeting(e.target.value)}
          placeholder={t('用户进入对话时展示的欢迎语')}
          rows={2}
          maxLength={500}
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>{t('角色提示词')}</Label>
          <span className={`text-xs ${promptLen > MAX_PROMPT_LEN ? 'text-red-600' : 'text-muted-foreground'}`}>
            {t('{count}/4000 字', { count: promptLen })}
          </span>
        </div>
        <Textarea
          value={systemPrompt}
          onChange={(e) => setSystemPrompt(e.target.value)}
          placeholder={t('定义智能体的角色设定与回答规则')}
          rows={8}
        />
      </div>

      </EditorCard>

      <EditorCard
        title={t('关联知识库')}
        desc={t('勾选后对话将基于库内文档检索回答（我创建的 / 共享给我的 / 广场已发布）')}
      >
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>{t('关联知识库')}</Label>
          <span className="text-xs text-muted-foreground">
            {t('最多关联 5 个知识库（已选 {count}/5）', { count: kbIds.length })}
          </span>
        </div>
        <div className="rounded-md border border-gray-200 divide-y divide-gray-100 max-h-64 overflow-y-auto">
          {loadingKbs ? (
            <div className="px-4 py-6 text-sm text-muted-foreground flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t('加载中...')}
            </div>
          ) : kbOptions.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted-foreground">{t('暂无可关联的知识库')}</p>
          ) : (
            kbOptions.map((kb) => {
              const checked = kbIds.includes(kb.id)
              const disabled = !checked && kbIds.length >= MAX_KB
              return (
                <label
                  key={kb.id}
                  className={`flex items-center gap-3 px-4 py-2.5 text-sm ${
                    disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-muted/50'
                  }`}
                >
                  <Checkbox checked={checked} disabled={disabled} onCheckedChange={() => toggleKb(kb.id)} />
                  <span className="flex-1 truncate">{kb.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {t('{count} 个文档', { count: kb.docCount })}
                  </span>
                </label>
              )
            })
          )}
        </div>
      </div>
      </EditorCard>

      <div className="flex justify-end">
        <Button onClick={handleSubmit} disabled={submitting} className="px-8">
          {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          {submitLabel}
        </Button>
      </div>
    </div>
  )
}
