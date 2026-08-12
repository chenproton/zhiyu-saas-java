'use client'

// Partner 专家表单（新建/编辑共用）：企业侧自维护字段，
// 不含学校侧管理字段（所属机构选择/二级学院/评级）。
import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { SingleImageUpload, ImageListUpload } from '@/components/shared/image-list-upload'
import { FormFieldRow, FormFieldGrid } from '@/components/shared/form-field-row'
import { X, Plus } from 'lucide-react'
import { useT } from '@/lib/i18n/locale-provider'

export interface PartnerExpertFormState {
  name: string
  gender: string
  age?: number
  city: string
  title: string
  position: string
  experienceYears?: number
  education: string
  industry: string
  specialties: string[]
  introduction: string
  workExperience: string
  avatarUrl: string
  coverImage: string
  attachments: string[]
  status: string
  isPublic: boolean
}

export const emptyPartnerExpertForm: PartnerExpertFormState = {
  name: '',
  gender: 'male',
  age: undefined,
  city: '',
  title: '',
  position: '',
  experienceYears: undefined,
  education: '',
  industry: '',
  specialties: [],
  introduction: '',
  workExperience: '',
  avatarUrl: '',
  coverImage: '',
  attachments: [],
  status: 'active',
  isPublic: false,
}

export function PartnerExpertForm({
  item,
  onChange,
}: {
  item: PartnerExpertFormState
  onChange: (item: PartnerExpertFormState) => void
}) {
  const t = useT()
  const [specialtyInput, setSpecialtyInput] = useState('')

  const setField = (field: string, value: any) => onChange({ ...item, [field]: value })

  const addSpecialty = () => {
    const v = specialtyInput.trim()
    if (v && !item.specialties.includes(v)) setField('specialties', [...item.specialties, v])
    setSpecialtyInput('')
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>{t('基础信息')}</CardTitle>
        </CardHeader>
        <CardContent>
          <FormFieldGrid>
            <FormFieldRow label={t('姓名')} required>
              <Input value={item.name} onChange={(e) => setField('name', e.target.value)} />
            </FormFieldRow>
            <FormFieldRow label={t('性别')}>
              <Select value={item.gender} onValueChange={(v) => setField('gender', v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">{t('男')}</SelectItem>
                  <SelectItem value="female">{t('女')}</SelectItem>
                </SelectContent>
              </Select>
            </FormFieldRow>
            <FormFieldRow label={t('年龄')}>
              <Input
                type="number"
                value={item.age ?? ''}
                onChange={(e) =>
                  setField('age', e.target.value ? Number(e.target.value) : undefined)
                }
              />
            </FormFieldRow>
            <FormFieldRow label={t('所在城市')}>
              <Input value={item.city} onChange={(e) => setField('city', e.target.value)} />
            </FormFieldRow>
            <FormFieldRow label={t('职称/职位')}>
              <Input
                value={item.title}
                onChange={(e) => setField('title', e.target.value)}
                placeholder={t('如：高级工程师')}
              />
            </FormFieldRow>
            <FormFieldRow label={t('任职岗位')}>
              <Input value={item.position} onChange={(e) => setField('position', e.target.value)} />
            </FormFieldRow>
            <FormFieldRow label={t('从业年限')}>
              <Input
                type="number"
                value={item.experienceYears ?? ''}
                onChange={(e) =>
                  setField('experienceYears', e.target.value ? Number(e.target.value) : undefined)
                }
              />
            </FormFieldRow>
            <FormFieldRow label={t('教育背景')}>
              <Input
                value={item.education}
                onChange={(e) => setField('education', e.target.value)}
                placeholder={t('如：XX大学 硕士')}
              />
            </FormFieldRow>
            <FormFieldRow label={t('行业方向')}>
              <Input
                value={item.industry}
                onChange={(e) => setField('industry', e.target.value)}
                placeholder={t('如：智能制造')}
              />
            </FormFieldRow>
          </FormFieldGrid>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('专家形象')}</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <SingleImageUpload
            label={t('专家头像')}
            value={item.avatarUrl}
            onChange={(v) => setField('avatarUrl', v)}
            allowUrlInput={false}
          />
          <SingleImageUpload
            label={t('专家主页封面')}
            value={item.coverImage}
            onChange={(v) => setField('coverImage', v)}
            allowUrlInput={false}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('擅长领域')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {item.specialties.map((s) => (
              <span
                key={s}
                className="inline-flex items-center gap-1 rounded bg-primary/5 text-primary px-2 py-0.5 text-xs"
              >
                {s}
                <button
                  type="button"
                  onClick={() =>
                    setField(
                      'specialties',
                      item.specialties.filter((x) => x !== s),
                    )
                  }
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              value={specialtyInput}
              onChange={(e) => setSpecialtyInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addSpecialty())}
              placeholder={t('输入擅长领域后回车添加')}
              className="h-8 text-xs"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addSpecialty}
              className="h-8 text-xs"
            >
              <Plus className="h-3 w-3 mr-1" />
              {t('添加')}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('专家简介')}</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={item.introduction}
            onChange={(e) => setField('introduction', e.target.value)}
            rows={4}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('从业经历')}</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={item.workExperience}
            onChange={(e) => setField('workExperience', e.target.value)}
            rows={4}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('资质荣誉（佐证材料）')}</CardTitle>
        </CardHeader>
        <CardContent>
          <ImageListUpload
            label={t('佐证材料')}
            value={item.attachments}
            onChange={(v) => setField('attachments', v)}
            multiple
            placeholder={t('上传附件或输入 URL')}
          />
        </CardContent>
      </Card>
    </>
  )
}

/** 右侧"设置"卡片：状态（对外展示由学校侧开关控制） */
export function PartnerExpertSettingsCard({
  item,
  onChange,
}: {
  item: PartnerExpertFormState
  onChange: (item: PartnerExpertFormState) => void
}) {
  const t = useT()
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('设置')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <FormFieldRow label={t('状态')}>
          <Select value={item.status} onValueChange={(v) => onChange({ ...item, status: v })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">{t('启用')}</SelectItem>
              <SelectItem value="inactive">{t('禁用')}</SelectItem>
            </SelectContent>
          </Select>
        </FormFieldRow>
      </CardContent>
    </Card>
  )
}
