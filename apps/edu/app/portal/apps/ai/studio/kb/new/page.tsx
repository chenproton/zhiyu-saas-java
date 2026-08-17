'use client'

// 新建知识库（v2.6.1，用户拍板：不弹窗，与 agents/new 一致直接进入编辑页操作）。
// 保存创建成功后自动跳到管理页（/studio/kb/{id}）继续上传文档/邀请协作者。
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { BookOpen, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@zhiyu/ui'
import { aiCenterKbApi, fileApi, type AIKBType } from '@/lib/api'
import { useT } from '@/lib/i18n/locale-provider'
import { CoverImageUpload } from '@/components/shared/cover-image-upload'
import { ClassifySelects, type ClassifyValue } from '../../../_components/classify-selects'
import { StudioEditorShell, EditorCard } from '../../../_components/studio-editor-shell'

export default function NewKbPage() {
  const t = useT()
  const router = useRouter()
  const { toast } = useToast()

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [tags, setTags] = useState('')
  const [cover, setCover] = useState('')
  const [coverUploading, setCoverUploading] = useState(false)
  const [classify, setClassify] = useState<ClassifyValue>({ majorId: '', departmentId: '', kbType: '' })
  const [saving, setSaving] = useState(false)

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
      setCover(res.url)
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

  const handleCreate = async () => {
    if (!name.trim()) {
      toast({ title: t('请填写名称'), variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      const kb = await aiCenterKbApi.create({
        name: name.trim(),
        description: description.trim(),
        tags: tags.split(/[,，]/).map((s) => s.trim()).filter(Boolean),
        coverImage: cover || undefined,
        majorId: classify.majorId || undefined,
        departmentId: classify.departmentId || undefined,
        kbType: (classify.kbType || undefined) as AIKBType | undefined,
      })
      toast({ title: t('创建成功，继续上传文档吧') })
      router.replace(`/portal/apps/ai/studio/kb/${kb.id}`)
    } catch (err) {
      toast({
        title: t('创建失败'),
        description: err instanceof Error ? err.message : undefined,
        variant: 'destructive',
      })
      setSaving(false)
    }
  }

  return (
    <StudioEditorShell
      icon={
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
          <BookOpen className="w-4 h-4 text-primary" />
        </div>
      }
      title={t('新建知识库')}
    >
      <EditorCard
        title={t('基本信息')}
        desc={t('创建后为私有，保存后进入管理页上传文档、邀请协作者，再提交审核发布到广场')}
      >
        <div className="space-y-4">
          <div className="space-y-2 max-w-[400px]">
            <CoverImageUpload
              imageUrl={cover}
              uploading={coverUploading}
              label={t('封面')}
              alt={t('知识库封面')}
              onUpload={handleCoverUpload}
              onRemove={() => setCover('')}
            />
          </div>
          <div className="space-y-2">
            <Label>{t('名称')}</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={200} />
          </div>
          <div className="space-y-2">
            <Label>{t('描述')}</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </div>
          <div className="space-y-2">
            <Label>{t('标签')}</Label>
            <Input
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder={t('多个标签用逗号分隔')}
            />
          </div>
          <ClassifySelects value={classify} onChange={setClassify} withKbType />
          <div className="flex justify-end">
            <Button onClick={handleCreate} disabled={saving} className="px-8">
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {t('创建知识库')}
            </Button>
          </div>
        </div>
      </EditorCard>
    </StudioEditorShell>
  )
}
