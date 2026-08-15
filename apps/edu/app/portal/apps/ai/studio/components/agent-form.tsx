'use client'

// 智能体编辑共用表单（新建/编辑页共用）：基础信息 + 提示词 + 关联知识库（≤5）。
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Loader2 } from 'lucide-react'
import { useToast } from '@zhiyu/ui'
import { aiCenterKbApi, aiCenterSquareApi } from '@/lib/api'
import type { AIAgent, AIAgentInput, AIKnowledgeBase } from '@/lib/api'
import { useT } from '@/lib/i18n/locale-provider'

const MAX_PROMPT_LEN = 4000
const MAX_KB = 5
const PRESET_AVATARS = ['🤖', '🧠', '📚', '💡', '🎓', '🧪', '📝', '🗣️', '🔬', '🎨', '🎵', '⚽']

interface AgentFormProps {
  initial?: AIAgent
  submitLabel: string
  onSubmit: (input: AIAgentInput) => Promise<void>
}

export function AgentForm({ initial, submitLabel, onSubmit }: AgentFormProps) {
  const t = useT()
  const { toast } = useToast()
  const [name, setName] = useState(initial?.name ?? '')
  const [avatar, setAvatar] = useState(initial?.avatar ?? '🤖')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [greeting, setGreeting] = useState(initial?.greeting ?? '')
  const [systemPrompt, setSystemPrompt] = useState(initial?.systemPrompt ?? '')
  const [kbIds, setKbIds] = useState<string[]>(initial?.kbIds ?? [])
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
        greeting: greeting.trim(),
        systemPrompt: systemPrompt.trim(),
        kbIds,
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
    <div className="space-y-6">
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

      <div className="flex justify-end">
        <Button onClick={handleSubmit} disabled={submitting}>
          {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          {submitLabel}
        </Button>
      </div>
    </div>
  )
}
