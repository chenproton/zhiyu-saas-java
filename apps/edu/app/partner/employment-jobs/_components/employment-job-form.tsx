'use client'

import { useMemo, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { FormFieldRow, FormFieldGrid } from '@/components/shared/form-field-row'
import { DateInput } from '@/components/shared/date-input'
import { Loader2 } from 'lucide-react'
import { useAsync, ComboboxSelect } from '@zhiyu/ui'
import { partnerEmploymentApi, partnerSchoolApi } from '@/lib/api'
import {
  EMPLOYMENT_JOB_TYPE_LABELS,
  type EmploymentJob,
  type EmploymentJobType,
} from '@/lib/types'
import { usePartnerAuth } from '@/components/partner-auth-provider'
import { useT } from '@/lib/i18n/locale-provider'

/** 表单对外提交的岗位数据（数字/数组已按后端契约转换） */
export interface EmploymentJobSubmitValues {
  title: string
  schoolTenantId: string
  projectId?: string
  jobType: EmploymentJobType
  location?: string
  salaryMin?: number
  salaryMax?: number
  headcount?: number
  education?: string
  suitableMajors?: string[]
  description?: string
  responsibilities?: string
  requirements?: string
  contactPerson?: string
  contactPhone?: string
  deadline?: string
}

interface EmploymentJobFormProps {
  mode: 'create' | 'edit'
  /** 编辑模式：已加载的岗位 */
  job?: EmploymentJob | null
  /** 创建模式：从 query 预填的合作学校（挂项目时随项目一并锁定） */
  fixedSchoolTenantId?: string
  /** 创建模式：从 query 预填并锁定的就业项目 */
  fixedProjectId?: string
  submitting: boolean
  onSubmit: (values: EmploymentJobSubmitValues) => void
}

/** 逗号/顿号/中文逗号分隔的专业文本 → 数组 */
function splitMajors(text: string): string[] {
  return text
    .split(/[,，、]/)
    .map((s) => s.trim())
    .filter(Boolean)
}

function toNumber(v: string): number | undefined {
  if (v === '' || v == null) return undefined
  const n = Number(v)
  return Number.isFinite(n) ? n : undefined
}

export function EmploymentJobForm({
  mode,
  job,
  fixedSchoolTenantId,
  fixedProjectId,
  submitting,
  onSubmit,
}: EmploymentJobFormProps) {
  const { user, loading: authLoading } = usePartnerAuth()
  const t = useT()

  const isEdit = mode === 'edit'

  const [title, setTitle] = useState(job?.title ?? '')
  const [schoolTenantId, setSchoolTenantId] = useState(
    isEdit ? job?.tenantId ?? '' : fixedSchoolTenantId ?? '',
  )
  const [projectId, setProjectId] = useState(isEdit ? job?.projectId ?? '' : fixedProjectId ?? '')
  const [jobType, setJobType] = useState<EmploymentJobType | ''>(isEdit ? job?.jobType ?? '' : '')
  const [location, setLocation] = useState(job?.location ?? '')
  const [salaryMin, setSalaryMin] = useState(job?.salaryMin != null ? String(job.salaryMin) : '')
  const [salaryMax, setSalaryMax] = useState(job?.salaryMax != null ? String(job.salaryMax) : '')
  const [headcount, setHeadcount] = useState(job?.headcount != null ? String(job.headcount) : '')
  const [education, setEducation] = useState(job?.education ?? '')
  const [suitableMajors, setSuitableMajors] = useState((job?.suitableMajors ?? []).join('、'))
  const [description, setDescription] = useState(job?.description ?? '')
  const [responsibilities, setResponsibilities] = useState(job?.responsibilities ?? '')
  const [requirements, setRequirements] = useState(job?.requirements ?? '')
  const [contactPerson, setContactPerson] = useState(job?.contactPerson ?? '')
  const [contactPhone, setContactPhone] = useState(job?.contactPhone ?? '')
  const [deadline, setDeadline] = useState(job?.deadline ?? '')
  const [error, setError] = useState<string | null>(null)

  // 合作学校：新建时可选（仅 active），编辑时只读展示
  const { data: schoolsData } = useAsync(
    async () => {
      if (authLoading || !user) return []
      const res = await partnerSchoolApi.list({ limit: 200 })
      return res.items || []
    },
    { deps: [authLoading, user?.id], onError: () => true },
  )
  const schools = useMemo(() => schoolsData ?? [], [schoolsData])
  const selectableSchools = useMemo(() => schools.filter((s) => s.status === 'active'), [schools])
  const schoolName = useMemo(
    () => schools.find((s) => s.tenantId === schoolTenantId)?.schoolName,
    [schools, schoolTenantId],
  )

  // 所属就业项目：仅随学校过滤（项目须归属同一合作学校）；编辑模式只读展示 projectName
  const projectSchoolTenantId = isEdit ? job?.tenantId ?? '' : schoolTenantId
  const { data: projectsData } = useAsync(
    async () => {
      if (!projectSchoolTenantId) return []
      const res = await partnerEmploymentApi.listProjects(projectSchoolTenantId)
      return res.items || []
    },
    { deps: [projectSchoolTenantId, authLoading, user?.id], onError: () => true },
  )
  const projects = projectsData ?? []

  const projectLocked = isEdit || !!fixedProjectId
  // 挂项目时随项目一并锁定合作学校（项目归属该校，避免换学校后提交校验失败）
  const schoolLocked = !!fixedProjectId

  const handleSubmit = () => {
    if (!title.trim()) {
      setError(t('请填写岗位名称'))
      return
    }
    if (!jobType) {
      setError(t('请选择岗位类型'))
      return
    }
    if (!isEdit && !schoolTenantId) {
      setError(t('请选择合作学校'))
      return
    }
    setError(null)
    onSubmit({
      title: title.trim(),
      schoolTenantId,
      projectId: projectId || undefined,
      jobType,
      location: location.trim() || undefined,
      salaryMin: toNumber(salaryMin),
      salaryMax: toNumber(salaryMax),
      headcount: toNumber(headcount),
      education: education.trim() || undefined,
      suitableMajors: splitMajors(suitableMajors),
      description: description.trim() || undefined,
      responsibilities: responsibilities.trim() || undefined,
      requirements: requirements.trim() || undefined,
      contactPerson: contactPerson.trim() || undefined,
      contactPhone: contactPhone.trim() || undefined,
      deadline: deadline || undefined,
    })
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        handleSubmit()
      }}
      className="space-y-6"
    >
      <FormFieldGrid>
        <FormFieldRow label={t('岗位名称')} required>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t('请输入岗位名称')}
          />
        </FormFieldRow>

        <FormFieldRow label={t('岗位类型')} required>
          <Select value={jobType || undefined} onValueChange={(v) => setJobType(v as EmploymentJobType)}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder={t('请选择岗位类型')} />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(EMPLOYMENT_JOB_TYPE_LABELS) as EmploymentJobType[]).map((k) => (
                <SelectItem key={k} value={k}>
                  {EMPLOYMENT_JOB_TYPE_LABELS[k]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormFieldRow>
      </FormFieldGrid>

      <FormFieldGrid>
        <FormFieldRow label={t('合作学校')} required={!isEdit}>
          {isEdit ? (
            <p className="text-sm text-foreground">{schoolName || schoolTenantId || '-'}</p>
          ) : (
            <ComboboxSelect
              options={selectableSchools.map((s) => ({ value: s.tenantId, label: s.schoolName }))}
              value={schoolTenantId}
              onChange={(v) => {
                setSchoolTenantId(v)
                setProjectId('')
              }}
              placeholder={t('请选择合作学校')}
              searchPlaceholder={t('搜索学校')}
              disabled={schoolLocked}
              className="w-full"
            />
          )}
        </FormFieldRow>

        <FormFieldRow
          label={t('所属就业项目')}
          hint={isEdit ? t('项目绑定请通过岗位列表的「发布」操作修改') : t('不选择则为独立岗位')}
        >
          {isEdit ? (
            <p className="text-sm text-foreground">{job?.projectName || t('独立岗位')}</p>
          ) : (
            <ComboboxSelect
              options={projects.map((p) => ({ value: p.id, label: p.name }))}
              value={projectId}
              onChange={setProjectId}
              placeholder={t('不绑定项目（独立岗位）')}
              searchPlaceholder={t('搜索项目')}
              disabled={projectLocked || !schoolTenantId}
              className="w-full"
            />
          )}
        </FormFieldRow>
      </FormFieldGrid>

      <FormFieldGrid>
        <FormFieldRow label={t('工作地点')}>
          <Input value={location} onChange={(e) => setLocation(e.target.value)} />
        </FormFieldRow>
        <FormFieldRow label={t('学历要求')}>
          <Input
            value={education}
            onChange={(e) => setEducation(e.target.value)}
            placeholder={t('如：本科及以上')}
          />
        </FormFieldRow>
      </FormFieldGrid>

      <FormFieldGrid cols={3}>
        <FormFieldRow label={t('最低薪资（千元/月）')}>
          <Input
            type="number"
            min={0}
            value={salaryMin}
            onChange={(e) => setSalaryMin(e.target.value)}
          />
        </FormFieldRow>
        <FormFieldRow label={t('最高薪资（千元/月）')}>
          <Input
            type="number"
            min={0}
            value={salaryMax}
            onChange={(e) => setSalaryMax(e.target.value)}
          />
        </FormFieldRow>
        <FormFieldRow label={t('招聘人数')}>
          <Input
            type="number"
            min={0}
            value={headcount}
            onChange={(e) => setHeadcount(e.target.value)}
          />
        </FormFieldRow>
      </FormFieldGrid>

      <FormFieldRow
        label={t('面向专业')}
        hint={t('多个专业用逗号或顿号分隔')}
      >
        <Input
          value={suitableMajors}
          onChange={(e) => setSuitableMajors(e.target.value)}
          placeholder={t('如：计算机科学与技术、软件工程')}
        />
      </FormFieldRow>

      <FormFieldGrid>
        <FormFieldRow label={t('联系人')}>
          <Input value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} />
        </FormFieldRow>
        <FormFieldRow label={t('联系电话')}>
          <Input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} />
        </FormFieldRow>
        <FormFieldRow label={t('截止日期')}>
          <DateInput value={deadline} onChange={(e) => setDeadline(e.target.value)} />
        </FormFieldRow>
      </FormFieldGrid>

      <FormFieldRow label={t('岗位介绍')}>
        <Textarea
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </FormFieldRow>

      <FormFieldRow label={t('工作职责')}>
        <Textarea
          rows={3}
          value={responsibilities}
          onChange={(e) => setResponsibilities(e.target.value)}
        />
      </FormFieldRow>

      <FormFieldRow label={t('任职要求')}>
        <Textarea
          rows={3}
          value={requirements}
          onChange={(e) => setRequirements(e.target.value)}
        />
      </FormFieldRow>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={submitting}>
          {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {t('保存')}
        </Button>
      </div>
    </form>
  )
}
