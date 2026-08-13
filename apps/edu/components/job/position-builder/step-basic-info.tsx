'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import Image from 'next/image'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { FormFieldRow, FormFieldGrid } from '@/components/shared/form-field-row'
import { SearchInput } from '@/components/shared/search-input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Sparkles,
  Plus,
  X,
  Undo2,
  Loader2,
  Award,
  ExternalLink,
  Image as ImageIcon,
  AlertCircle,
} from 'lucide-react'
import { toast, EmptyState, FormDialogFooter, ComboboxSelect } from '@zhiyu/ui'
import { industryApi, majorApi, certificateLibraryApi, fileApi, positionAiAssist } from '@/lib/api'
import type { AIPositionAssistField, AIPositionAssistResponse } from '@/lib/api'
import { useT } from '@/lib/i18n/locale-provider'
import { reportError } from '@/lib/error-handling'
import type { Position, PositionResponsibility } from '@/lib/types/job-source'
import { AiAssistProgressDialog } from './ai-assist-progress-dialog'
import { AiNotConfiguredDialog } from '@/components/shared/ai-not-configured-dialog'
import {
  useAiNotConfigured,
  useAiFieldWriter,
  useAiPipeline,
} from '@/lib/ai/use-ai-assist'

/** AI 辅助编写一键流程的步骤（与字段顺序一一对应） */
const AI_ASSIST_STEPS = [
  '阅读岗位基础信息',
  '润色基础信息',
  '拆解工作职责',
  '拆解任职要求',
  '生成晋升路径',
  '推荐相关证书',
]

/** AI 可直接写入的字段键（基础信息 4 个 + 区块 4 个），各含 1 级撤销历史 */
type AiWriteKey =
  | 'name'
  | 'shortName'
  | 'description'
  | 'salaryRange'
  | 'responsibilities'
  | 'requirements'
  | 'careerPath'
  | 'certificates'

const AI_WRITE_KEYS: AiWriteKey[] = [
  'name',
  'shortName',
  'description',
  'salaryRange',
  'responsibilities',
  'requirements',
  'careerPath',
  'certificates',
]

/** 基础信息中可由 AI 单独填充的字段（polish 一次返回 4 个，按目标字段单独应用） */
type PolishFieldKey = 'name' | 'shortName' | 'description' | 'salaryRange'

interface StepBasicInfoProps {
  position: Position
  onUpdate: (data: Partial<Position>) => void
  aiMode?: boolean
  variant?: 'default' | 'create'
  /** 是否展示"面向行业/适用专业"（缺省 true；企业共建端无行业/专业字典数据源时传 false 隐藏，已有值随保存原样回传） */
  showIndustryMajor?: boolean
  /** 是否启用证书库选择/新增（缺省 true；企业共建端无证书库数据源时传 false，仅展示/移除已关联证书） */
  certificateLibraryEnabled?: boolean
  /** 锁定岗位类型不可改（缺省 false；品牌模块独立岗位固定为"企业岗位"） */
  lockedPositionType?: boolean
  /** 隐藏岗位类型字段（缺省 false；/job/positions 岗位库固定为"教学岗位"，无需展示） */
  hidePositionType?: boolean
}

interface Certificate {
  id: string // certificate_library id
  name: string
  url: string
  description: string
  image?: string
}

function isValidImageUrl(url?: string): boolean {
  return !!url && !url.startsWith('blob:')
}

export function StepBasicInfo({
  position,
  onUpdate,
  aiMode = false,
  variant = 'default',
  showIndustryMajor = true,
  certificateLibraryEnabled = true,
  lockedPositionType = false,
  hidePositionType = false,
}: StepBasicInfoProps) {
  const t = useT()
  const isCreate = variant === 'create'
  const [industries, setIndustries] = useState<{ id: string; name: string }[]>([])
  const [majors, setMajors] = useState<{ id: string; name: string }[]>([])
  const [optionsLoading, setOptionsLoading] = useState(false)
  const [aiNotice, setAiNotice] = useState<string | null>(null)

  // 最新 position 快照：AI 回调时读取，避免闭包内拿到过期值
  const positionRef = useRef(position)
  useEffect(() => {
    positionRef.current = position
  }, [position])

  /** 某字段被 AI 覆盖前的快照（1 级历史用） */
  const snapshotField = (key: AiWriteKey): Partial<Position> => {
    const cur = positionRef.current
    switch (key) {
      case 'name':
        return { name: cur.name }
      case 'shortName':
        return { shortName: cur.shortName }
      case 'description':
        return { description: cur.description }
      case 'salaryRange':
        return { salaryRange: cur.salaryRange }
      case 'responsibilities':
        return { responsibilities: cur.responsibilities }
      case 'requirements':
        return { requirements: cur.requirements }
      case 'careerPath':
        return { careerPath: cur.careerPath }
      case 'certificates':
        return { certificates: cur.certificates }
    }
  }

  // AI 辅助编写状态（公共 hook：未配置引导 / 字段级写入保护 / 串行流水线）
  const ai = useAiNotConfigured()
  const writer = useAiFieldWriter<AiWriteKey, Partial<Position>>(AI_WRITE_KEYS, onUpdate, snapshotField)
  const pipeline = useAiPipeline<unknown, AIPositionAssistResponse>({
    steps: AI_ASSIST_STEPS,
    request: (task, signal) => {
      // 每步实时构建上下文：后续字段的提示词可看到前序步骤的 AI 结果
      let ctx = buildAiContext()
      // 快速补全路径：首个任务发起时 position 状态可能尚未刷新，用补全值覆盖一次
      if (quickFillOverlayRef.current) {
        ctx = { ...ctx, ...quickFillOverlayRef.current }
        quickFillOverlayRef.current = null
      }
      return positionAiAssist(
        { field: task.id as AIPositionAssistField, position: ctx },
        signal,
      )
    },
    onError: (err) => {
      if (ai.markNotConfigured(err)) return true
      toast({
        title: t('AI 生成失败'),
        description: err instanceof Error ? err.message : undefined,
        variant: 'destructive',
      })
      return false
    },
  })
  const { aiHistories, flashKey, writeField, restoreField, restoreAll, updatedCount } = writer
  const [quickFillOpen, setQuickFillOpen] = useState(false)
  const [quickFill, setQuickFill] = useState({
    name: '',
    industry: '',
    description: '',
    responsibilities: '',
    requirements: '',
  })
  const [confirmRegenOpen, setConfirmRegenOpen] = useState(false)
  // 快速补全值的一次性覆盖（首个 AI 请求使用后即清空）
  const quickFillOverlayRef = useRef<Partial<ReturnType<typeof buildAiContext>> | null>(null)

  // 证书库相关状态
  const [certificateLibrary, setCertificateLibrary] = useState<Certificate[]>([])
  
  // 加载真实行业/专业数据
  useEffect(() => {
    if (!showIndustryMajor) return
    let cancelled = false
    ;(async () => {
      setOptionsLoading(true)
      try {
        const [indRes, majorRes] = await Promise.all([
          industryApi.list({ limit: 1000 }),
          majorApi.list({ limit: 1000 }),
        ])
        if (cancelled) return
        setIndustries(
          (indRes.items || []).filter((i) => i.enabled).map((i) => ({ id: i.id, name: i.name })),
        )
        setMajors(
          (majorRes.items || []).filter((m) => m.enabled).map((m) => ({ id: m.id, name: m.name })),
        )
      } catch (err) {
        if (cancelled) return
        reportError(err, '加载行业列表')
        setIndustries([])
        setMajors([])
      } finally {
        if (!cancelled) setOptionsLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [showIndustryMajor])

  // 证书相关状态
  const [isCertDialogOpen, setIsCertDialogOpen] = useState(false)
  const [isNewCertDialogOpen, setIsNewCertDialogOpen] = useState(false)
  const [certSearchQuery, setCertSearchQuery] = useState('')
  const [selectedCertIds, setSelectedCertIds] = useState<string[]>([])

  // 加载证书库
  useEffect(() => {
    if (!certificateLibraryEnabled) return
    let cancelled = false
    ;(async () => {
      try {
        const res = await certificateLibraryApi.list({ limit: 1000 })
        if (cancelled) return
        setCertificateLibrary(
          res.items.map((item) => ({
            id: item.id,
            name: item.name,
            url: item.url ?? '',
            description: item.description ?? '',
            image: item.imageUrl ?? '',
          })),
        )
      } catch (err) {
        if (!cancelled) {
          reportError(err, '加载证书库')
          setCertificateLibrary([])
        }
      } finally {
      }
    })()
    return () => {
      cancelled = true
    }
  }, [certificateLibraryEnabled])

  // 同步已选证书状态，防止异步加载/重新进入编辑页后选择框与保存数据不一致
  useEffect(() => {
    queueMicrotask(() => {
      setSelectedCertIds(position.certificates?.map((c) => c.libraryId || c.id) || [])
    })
  }, [position.certificates])

  const openCertDialog = () => {
    setSelectedCertIds(position.certificates?.map((c) => c.libraryId || c.id) || [])
    setIsCertDialogOpen(true)
  }

  const [newCert, setNewCert] = useState<Omit<Certificate, 'id'>>({
    name: '',
    url: '',
    description: '',
    image: '',
  })
  const [certImageFile, setCertImageFile] = useState<File | null>(null)

  // ===== AI 辅助编写 =====
  // 行业/专业表单存的是字典 ID，喂给 LLM 前解析为名称
  const resolveIndustryName = (id: string) => {
    if (!id) return ''
    return industries.find((i) => i.id === id)?.name || id
  }
  const resolveMajorNames = (ids: string[]) => {
    return ids.map((id) => majors.find((m) => m.id === id)?.name || id)
  }

  const buildAiContext = () => {
    const cur = positionRef.current
    return {
      name: cur.name,
      shortName: cur.shortName,
      industry: resolveIndustryName(cur.industry),
      majors: resolveMajorNames(cur.majors),
      salaryRange: cur.salaryRange,
      description: cur.description,
      responsibilities: cur.responsibilities.map((r) => r.name),
      requirements: cur.requirements,
      careerPath: cur.careerPath,
    }
  }

  // ===== AI 直接写入（逐字段）=====

  /** 全部撤销：恢复所有被 AI 覆盖的字段 */
  const handleRestoreAll = () => {
    restoreAll(() => toast({ title: t('已全部恢复 AI 覆盖前的内容') }))
  }

  /** polish 目标字段 → 中文名（用于"AI 未生成"提示） */
  const polishFieldLabel = (key: PolishFieldKey) =>
    ({
      name: t('岗位名称'),
      shortName: t('岗位简称'),
      description: t('岗位简介'),
      salaryRange: t('薪资范围'),
    })[key]

  /** 应用 polish 结果到指定字段；AI 未生成该字段时提示保留原值 */
  const applyPolishTarget = (res: AIPositionAssistResponse, target: PolishFieldKey) => {
    const p = res.polish
    if (!p) return
    if (target === 'name' && p.name.trim()) {
      writeField('name', { name: p.name.trim() })
      return
    }
    if (target === 'shortName' && p.shortName.trim()) {
      writeField('shortName', { shortName: p.shortName.trim() })
      return
    }
    if (target === 'description' && p.description.trim()) {
      writeField('description', { description: p.description.trim() })
      return
    }
    if (target === 'salaryRange' && p.salaryMin > 0 && p.salaryMax >= p.salaryMin) {
      writeField('salaryRange', { salaryRange: [p.salaryMin, p.salaryMax] })
      return
    }
    toast({ title: t('AI 未生成{field}，已保留原内容', { field: polishFieldLabel(target) }) })
  }

  /** polish 一次返回 4 个基础字段，逐个直接写入（各自独立历史/高亮）；未生成项提示保留原值 */
  const applyPolishAll = (res: AIPositionAssistResponse) => {
    const p = res.polish
    if (!p) return
    const skipped: string[] = []
    if (p.name.trim()) writeField('name', { name: p.name.trim() })
    else skipped.push(polishFieldLabel('name'))
    if (p.shortName.trim()) writeField('shortName', { shortName: p.shortName.trim() })
    else skipped.push(polishFieldLabel('shortName'))
    if (p.description.trim()) writeField('description', { description: p.description.trim() })
    else skipped.push(polishFieldLabel('description'))
    if (p.salaryMin > 0 && p.salaryMax >= p.salaryMin) {
      writeField('salaryRange', { salaryRange: [p.salaryMin, p.salaryMax] })
    } else skipped.push(polishFieldLabel('salaryRange'))
    if (skipped.length > 0) {
      toast({ title: t('AI 未生成：{fields}，已保留原内容', { fields: skipped.join('、') }) })
    }
  }

  /** 应用职责整节替换结果 */
  const applyResponsibilities = (res: AIPositionAssistResponse) => {
    if (!res.responsibilities) return
    writeField('responsibilities', {
      responsibilities: res.responsibilities.map((name) => ({
        id: `resp-ai-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name,
        description: '',
      })),
    })
  }

  /** 应用证书追加结果（按名称去重） */
  const applyCertificates = (res: AIPositionAssistResponse) => {
    if (!res.certificates) return
    const existing = positionRef.current.certificates || []
    const existingNames = new Set(existing.map((c) => c.name))
    const toAdd = res.certificates
      .filter((c) => !existingNames.has(c.name))
      .map((c) => ({
        id: `cert-ai-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name: c.name,
        url: c.url || '',
        description: c.description || '',
      }))
    if (toAdd.length > 0) {
      writeField('certificates', { certificates: [...existing, ...toAdd] })
    }
  }

  /** 基础信息单字段生成：调 polish 一次，仅应用目标字段 */
  const handlePolishField = (target: PolishFieldKey) => {
    pipeline.run([{ id: 'polish', meta: undefined, apply: (res) => applyPolishTarget(res, target) }], {
      showDialog: false,
    })
  }

  /** 职责整节替换 */
  const handleWriteResponsibilities = () => {
    pipeline.run([{ id: 'responsibilities', meta: undefined, apply: applyResponsibilities }], {
      showDialog: false,
    })
  }

  /** 要求整节替换 */
  const handleWriteRequirements = () => {
    pipeline.run(
      [
        {
          id: 'requirements',
          meta: undefined,
          apply: (res) => {
            if (res.requirements) writeField('requirements', { requirements: res.requirements })
          },
        },
      ],
      { showDialog: false },
    )
  }

  /** 晋升路径替换 */
  const handleWriteCareerPath = () => {
    pipeline.run(
      [
        {
          id: 'careerPath',
          meta: undefined,
          apply: (res) => {
            if (res.careerPath) writeField('careerPath', { careerPath: res.careerPath })
          },
        },
      ],
      { showDialog: false },
    )
  }

  /** 证书追加 */
  const handleWriteCertificates = () => {
    pipeline.run([{ id: 'certificates', meta: undefined, apply: applyCertificates }], {
      showDialog: false,
    })
  }

  const getMissingFields = () => {
    const missing: AIPositionAssistField[] = []
    if (!position.name.trim()) missing.push('polish')
    if (!position.industry.trim()) missing.push('polish')
    if (!position.description.trim()) missing.push('polish')
    if (!position.responsibilities.some((r) => r.name.trim())) missing.push('responsibilities')
    if (!position.requirements.some((r) => r.trim())) missing.push('requirements')
    return [...new Set(missing)]
  }

  const openQuickFill = () => {
    setQuickFill({
      name: position.name,
      industry: position.industry,
      description: position.description,
      responsibilities: position.responsibilities.map((r) => r.name).filter(Boolean).join('\n'),
      requirements: position.requirements.filter(Boolean).join('\n'),
    })
    setQuickFillOpen(true)
  }

  const confirmQuickFillAndStartAi = () => {
    const respItems = quickFill.responsibilities
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)
    const reqItems = quickFill.requirements
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)
    onUpdate({
      name: quickFill.name,
      industry: quickFill.industry,
      description: quickFill.description,
      responsibilities: respItems.map((name) => ({
        id: `resp-ai-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name,
        description: '',
      })),
      requirements: reqItems,
    })
    // 快速补全值作为首个请求的上下文覆盖（position 状态此时尚未刷新）
    quickFillOverlayRef.current = {
      name: quickFill.name,
      industry: resolveIndustryName(quickFill.industry),
      description: quickFill.description,
      responsibilities: respItems,
      requirements: reqItems,
    }
    setQuickFillOpen(false)
    runAiAssist()
  }

  /** 一键流程：按字段顺序逐个生成，进度弹窗逐步展示；结束后顶部出现结果提示条 */
  const runAiAssist = () => {
    ai.resetNotConfigured()
    pipeline.run([
      { id: 'polish', meta: undefined, apply: applyPolishAll },
      { id: 'responsibilities', meta: undefined, apply: applyResponsibilities },
      {
        id: 'requirements',
        meta: undefined,
        apply: (res) => {
          if (res.requirements) writeField('requirements', { requirements: res.requirements })
        },
      },
      {
        id: 'careerPath',
        meta: undefined,
        apply: (res) => {
          if (res.careerPath) writeField('careerPath', { careerPath: res.careerPath })
        },
      },
      { id: 'certificates', meta: undefined, apply: applyCertificates },
    ])
  }

  const startAiAssist = () => {
    if (getMissingFields().length > 0) {
      openQuickFill()
      return
    }
    // 每次点击均先弹确认，明确"将重新生成全部内容"的意图
    setConfirmRegenOpen(true)
  }

  const confirmRegenAndRun = () => {
    setConfirmRegenOpen(false)
    runAiAssist()
  }

  // 回车新增行后聚焦到新输入框
  const pendingFocusIdRef = useRef<string | null>(null)

  useEffect(() => {
    const id = pendingFocusIdRef.current
    if (!id) return
    const el = document.querySelector<HTMLTextAreaElement>(`[data-focus-id="${id}"]`)
    if (el) {
      pendingFocusIdRef.current = null
      el.focus()
    }
  }, [position.responsibilities, position.requirements])

  const addResponsibility = (focusNew = false) => {
    const newItem: PositionResponsibility = {
      id: `resp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: '',
      description: '',
    }
    if (focusNew) pendingFocusIdRef.current = newItem.id
    onUpdate({ responsibilities: [...position.responsibilities, newItem] })
  }

  const removeResponsibility = (index: number) => {
    onUpdate({ responsibilities: position.responsibilities.filter((_, i) => i !== index) })
  }

  const addRequirement = (focusNew = false) => {
    const next = [...position.requirements, '']
    if (focusNew) pendingFocusIdRef.current = `req-${next.length - 1}`
    onUpdate({ requirements: next })
  }

  const removeRequirement = (index: number) => {
    onUpdate({ requirements: position.requirements.filter((_, i) => i !== index) })
  }

  const handleSelectCertificate = (certId: string, checked: boolean) => {
    if (checked) {
      setSelectedCertIds([...selectedCertIds, certId])
    } else {
      setSelectedCertIds(selectedCertIds.filter((id) => id !== certId))
    }
  }

  const filteredCertificates = useMemo(() => {
    if (!certSearchQuery.trim()) return certificateLibrary
    const q = certSearchQuery.trim().toLowerCase()
    return certificateLibrary.filter(
      (c) =>
        c.name.toLowerCase().includes(q) || (c.description?.toLowerCase().includes(q) ?? false),
    )
  }, [certSearchQuery, certificateLibrary])

  const handleConfirmCertificates = () => {
    const existingCerts = position.certificates || []
    const existingLibraryIds = new Set(existingCerts.map((c) => c.libraryId || c.id))

    // Keep certs whose libraryId is still selected
    const keptCerts = existingCerts.filter((c) => selectedCertIds.includes(c.libraryId || c.id))

    // Add newly selected library entries
    for (const libItem of certificateLibrary) {
      if (selectedCertIds.includes(libItem.id) && !existingLibraryIds.has(libItem.id)) {
        keptCerts.push({
          id: `cert-ref-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          libraryId: libItem.id,
          name: libItem.name,
          url: libItem.url,
          description: libItem.description,
          image: libItem.image,
        })
      }
    }

    onUpdate({ certificates: keptCerts })
    setIsCertDialogOpen(false)
  }

  const handleAddNewCertificate = async () => {
    if (!newCert.name) return
    try {
      let imageUrl = newCert.image || undefined
      if (certImageFile) {
        const uploadRes = await fileApi.upload(certImageFile)
        imageUrl = uploadRes.url
      }
      const created = await certificateLibraryApi.create({
        name: newCert.name,
        url: newCert.url || undefined,
        description: newCert.description || undefined,
        imageUrl,
      })
      const cert: Certificate = {
        id: created.id,
        name: created.name,
        url: created.url ?? '',
        description: created.description ?? '',
        image: created.imageUrl ?? '',
      }
      setCertificateLibrary((prev) => [cert, ...prev])
      onUpdate({
        certificates: [
          ...(position.certificates || []),
          {
            id: `cert-ref-${Date.now()}`,
            libraryId: created.id,
            name: created.name,
            url: created.url ?? '',
            description: created.description ?? '',
            image: created.imageUrl ?? '',
          },
        ],
      })
      setNewCert({ name: '', url: '', description: '', image: '' })
      setCertImageFile(null)
      setIsNewCertDialogOpen(false)
    } catch {
      setAiNotice(t('新增证书失败，请稍后重试'))
    }
  }

  const handleRemoveCertificate = (certId: string) => {
    const cert = position.certificates?.find((c) => c.id === certId)
    onUpdate({ certificates: position.certificates?.filter((c) => c.id !== certId) || [] })
    if (cert) {
      setSelectedCertIds((prev) => prev.filter((id) => id !== (cert.libraryId || cert.id)))
    }
  }

  /** 区块级 AI 控件：重新生成 + 已更新标记/恢复上版 */
  const renderSectionAiControls = (key: AiWriteKey) => {
    const regen =
      key === 'responsibilities'
        ? handleWriteResponsibilities
        : key === 'requirements'
          ? handleWriteRequirements
          : key === 'careerPath'
            ? handleWriteCareerPath
            : handleWriteCertificates
    const field: AIPositionAssistField =
      key === 'responsibilities'
        ? 'responsibilities'
        : key === 'requirements'
          ? 'requirements'
          : key === 'careerPath'
            ? 'careerPath'
            : 'certificates'
    return (
      <div className="flex items-center gap-1.5">
        {aiHistories[key] !== undefined && (
          <>
            <Badge
              variant="outline"
              className="h-5 px-1.5 text-[10px] leading-none border-purple-200 text-purple-700 bg-purple-50/50 shrink-0"
            >
              {t('AI 已更新')}
            </Badge>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs text-purple-700 hover:bg-purple-50"
              onClick={() => restoreField(key)}
            >
              <Undo2 className="h-3 w-3 mr-1" />
              {t('恢复上版')}
            </Button>
          </>
        )}
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs border-purple-200 text-purple-700 hover:bg-purple-50 hover:text-purple-800"
          onClick={regen}
          disabled={pipeline.isRunning}
        >
          {pipeline.isRunning && pipeline.runningId === field ? (
            <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
          ) : (
            <Sparkles className="mr-1 h-3.5 w-3.5" />
          )}
          {t('重新生成')}
        </Button>
      </div>
    )
  }

  /** 基础信息单字段 AI 控件：生成按钮 + 已更新标记/恢复上版 */
  const renderFieldAiControls = (key: PolishFieldKey) => (
    <div className="flex items-center gap-1.5">
      {aiHistories[key] !== undefined && (
        <>
          <Badge
            variant="outline"
            className="h-4 px-1.5 text-[10px] leading-none border-purple-200 text-purple-700 bg-purple-50/50 shrink-0"
          >
            {t('已更新')}
          </Badge>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-1.5 text-[11px] text-purple-700 hover:bg-purple-50"
            onClick={() => restoreField(key)}
          >
            <Undo2 className="h-3 w-3 mr-0.5" />
            {t('恢复上版')}
          </Button>
        </>
      )}
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 text-purple-600 hover:bg-purple-50 hover:text-purple-800"
        onClick={() => handlePolishField(key)}
        disabled={pipeline.isRunning}
        title={t('AI 生成')}
      >
        {pipeline.isRunning && pipeline.runningId === 'polish' ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Sparkles className="h-3.5 w-3.5" />
        )}
      </Button>
    </div>
  )

  return (
    <div className="space-y-6">
      {/* AI 辅助编写入口（仅 aiMode） */}
      {aiMode && (
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{t('岗位基础信息')}</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {t('填写基础信息后，点击「AI 辅助编写」让大模型帮您润色、补齐与条目化')}
            </p>
          </div>
          <Button
            variant="outline"
            className="shrink-0 border-purple-200 text-purple-700 hover:bg-purple-50 hover:text-purple-800 gap-1"
            onClick={startAiAssist}
            disabled={pipeline.isRunning}
          >
            <Sparkles className="h-4 w-4" />
            {t('AI 辅助编写')}
          </Button>
        </div>
      )}

      {/* AI 覆盖内容常驻撤销横幅 */}
      {aiMode && updatedCount > 0 && (
        <div className="flex items-center justify-between gap-4 rounded-lg border border-purple-200 bg-purple-50/50 px-4 py-3">
          <div className="flex items-center gap-2 text-sm text-purple-900 min-w-0">
            <Sparkles className="h-4 w-4 text-purple-600 shrink-0" />
            <span className="truncate">
              {t('AI 已更新 {count} 项内容，可逐项恢复上版或全部撤销', { count: updatedCount })}
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs border-purple-200 text-purple-700 hover:bg-purple-50"
              onClick={handleRestoreAll}
            >
              <Undo2 className="h-3 w-3 mr-1" />
              {t('全部撤销')}
            </Button>
          </div>
        </div>
      )}

      {/* Merged Basic Info Card */}
      <Card className={flashKey && ['name', 'shortName', 'description', 'salaryRange'].includes(flashKey) ? 'ai-write-flash' : undefined}>
        <CardHeader>
          <CardTitle>{t('基本信息')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Row 1: Name + Short Name */}
          <FormFieldGrid cols={2}>
            <FormFieldRow
              label={
                <span className="flex items-center gap-2">
                  {t('岗位名称')}
                  {aiMode && renderFieldAiControls('name')}
                </span>
              }
              htmlFor="name"
              className={flashKey === 'name' ? 'ai-write-flash' : undefined}
            >
              <Input
                id="name"
                value={position.name}
                onChange={(e) => onUpdate({ name: e.target.value })}
                placeholder={t('例如：Java 后端开发工程师')}
              />
            </FormFieldRow>
            <FormFieldRow
              label={
                <span className="flex items-center gap-2">
                  {t('岗位简称')}
                  {aiMode && renderFieldAiControls('shortName')}
                </span>
              }
              htmlFor="shortName"
              className={flashKey === 'shortName' ? 'ai-write-flash' : undefined}
            >
              <Input
                id="shortName"
                value={position.shortName}
                onChange={(e) => onUpdate({ shortName: e.target.value })}
                placeholder={t('例如：Java开发')}
              />
            </FormFieldRow>
          </FormFieldGrid>

          {/* Row 2: Industry + Major + Position Type */}
          <FormFieldGrid cols={hidePositionType ? 2 : 3}>
            {showIndustryMajor && (
              <>
                <FormFieldRow label={t('面向行业')} htmlFor="industry">
                  <ComboboxSelect
                    multiple
                    className="w-full"
                    options={industries.map((i) => ({ label: i.name, value: i.id }))}
                    value={position.industry ? [position.industry] : []}
                    onChange={(values) => onUpdate({ industry: values[values.length - 1] || '' })}
                    placeholder={optionsLoading ? t('加载中...') : t('选择行业')}
                  />
                </FormFieldRow>
                <FormFieldRow label={t('适用专业')} htmlFor="major">
                  <ComboboxSelect
                    multiple
                    className="w-full"
                    options={majors.map((m) => ({ label: m.name, value: m.id }))}
                    value={position.majors}
                    onChange={(values) => onUpdate({ majors: values })}
                    placeholder={optionsLoading ? t('加载中...') : t('选择专业')}
                  />
                </FormFieldRow>
              </>
            )}
            {!hidePositionType && (
              <FormFieldRow label={t('岗位类型')} htmlFor="positionType">
                <Select
                  value={position.positionType}
                  disabled={lockedPositionType}
                  onValueChange={(v) => onUpdate({ positionType: v as Position['positionType'] })}
                >
                  <SelectTrigger id="positionType">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="enterprise">{t('企业岗位')}</SelectItem>
                    <SelectItem value="teaching">{t('教学岗位')}</SelectItem>
                  </SelectContent>
                </Select>
                {lockedPositionType && (
                  <p className="text-xs text-muted-foreground">
                    {t('独立岗位固定为企业岗位，仅在本模块展示，不进入职业岗位库')}
                  </p>
                )}
              </FormFieldRow>
            )}
          </FormFieldGrid>

          {/* Row 3: Salary Range */}
          <div className={`grid gap-2 ${flashKey === 'salaryRange' ? 'ai-write-flash' : ''}`}>
            <Label className="flex items-center gap-2">
              {t('薪资范围（元/月）')}
              {aiMode && renderFieldAiControls('salaryRange')}
            </Label>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Input
                  type="number"
                  value={position.salaryRange[0]}
                  onChange={(e) =>
                    onUpdate({
                      salaryRange: [Number(e.target.value), position.salaryRange[1]],
                    })
                  }
                  placeholder={t('最低')}
                  className={`${isCreate ? 'w-40' : 'w-32'} pr-8`}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                  ¥
                </span>
              </div>
              <span className="text-muted-foreground">-</span>
              <div className="relative">
                <Input
                  type="number"
                  value={position.salaryRange[1]}
                  onChange={(e) =>
                    onUpdate({
                      salaryRange: [position.salaryRange[0], Number(e.target.value)],
                    })
                  }
                  placeholder={t('最高')}
                  className={`${isCreate ? 'w-40' : 'w-32'} pr-8`}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                  ¥
                </span>
              </div>
            </div>
          </div>

          {/* Description */}
          <div className={`grid gap-2 ${flashKey === 'description' ? 'ai-write-flash' : ''}`}>
            <Label htmlFor="description" className="flex items-center gap-2">
              {t('岗位背景介绍')}
              {aiMode && renderFieldAiControls('description')}
            </Label>
            <Textarea
              id="description"
              value={position.description}
              onChange={(e) => onUpdate({ description: e.target.value })}
              placeholder={t('描述该岗位的主要工作内容和特点...')}
              rows={isCreate ? 6 : 4}
            />
          </div>
        </CardContent>
      </Card>

      {aiNotice && (
        <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3 flex items-start gap-2 text-sm text-amber-800">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{aiNotice}</span>
        </div>
      )}

      {/* Responsibilities */}
      <Card className={flashKey === 'responsibilities' ? 'ai-write-flash' : undefined}>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base">{t('工作职责')}</CardTitle>
          {aiMode && renderSectionAiControls('responsibilities')}
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {position.responsibilities.map((item, index) => (
              <div key={item.id} className="grid grid-cols-[2rem_1fr_2rem] gap-2 items-start">
                {!isCreate && (
                  <Badge variant="outline" className="w-full justify-center">
                    {index + 1}
                  </Badge>
                )}
                <Textarea
                  value={item.name}
                  onChange={(e) => {
                    const next = position.responsibilities.map((r, i) =>
                      i === index ? { ...r, name: e.target.value } : r,
                    )
                    onUpdate({ responsibilities: next })
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                      e.preventDefault()
                      addResponsibility(true)
                    }
                  }}
                  data-focus-id={item.id}
                  className="text-sm min-h-8 py-1"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={() => removeResponsibility(index)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <div className="grid grid-cols-[2rem_1fr_2rem] gap-2 items-center">
              {!isCreate && <span />}
              <Button
                variant="outline"
                className="h-8 border-dashed"
                onClick={() => addResponsibility()}
              >
                <Plus className="h-4 w-4 mr-2" />
                {t('添加工作职责')}
              </Button>
              <span />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Requirements */}
      <Card className={flashKey === 'requirements' ? 'ai-write-flash' : undefined}>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base">{t('任职要求')}</CardTitle>
          {aiMode && renderSectionAiControls('requirements')}
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {position.requirements.map((item, index) => (
              <div key={index} className="grid grid-cols-[2rem_1fr_2rem] gap-2 items-start">
                {!isCreate && (
                  <Badge variant="outline" className="w-full justify-center">
                    {index + 1}
                  </Badge>
                )}
                <Textarea
                  value={item}
                  onChange={(e) => {
                    const next = position.requirements.map((r, i) =>
                      i === index ? e.target.value : r,
                    )
                    onUpdate({ requirements: next })
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                      e.preventDefault()
                      addRequirement(true)
                    }
                  }}
                  data-focus-id={`req-${index}`}
                  className="text-sm min-h-8 py-1"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={() => removeRequirement(index)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <div className="grid grid-cols-[2rem_1fr_2rem] gap-2 items-center">
              {!isCreate && <span />}
              <Button
                variant="outline"
                className="h-8 border-dashed"
                onClick={() => addRequirement()}
              >
                <Plus className="h-4 w-4 mr-2" />
                {t('添加任职要求')}
              </Button>
              <span />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Career Path */}
      <Card className={flashKey === 'careerPath' ? 'ai-write-flash' : undefined}>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base">{t('发展路径')}</CardTitle>
          {aiMode && renderSectionAiControls('careerPath')}
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            value={position.careerPath}
            onChange={(e) => onUpdate({ careerPath: e.target.value })}
            placeholder={t('请描述该岗位的职业发展路径，如横向发展和纵向晋升方向...')}
            rows={6}
          />
        </CardContent>
      </Card>

      {/* Certificates */}
      <Card className={flashKey === 'certificates' ? 'ai-write-flash' : undefined}>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base">{t('相关证书')}</CardTitle>
          <div className="flex items-center gap-2">
            {aiMode && renderSectionAiControls('certificates')}
            {certificateLibraryEnabled && (
              <>
                <Button variant="outline" size="sm" onClick={openCertDialog}>
                  {t('从证书库选择')}
                </Button>
                <Button variant="outline" size="sm" onClick={() => setIsNewCertDialogOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  {t('新增证书')}
                </Button>
              </>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {!position.certificates || position.certificates.length === 0 ? (
            <EmptyState
              icon={<Award className="h-10 w-10 opacity-50" />}
              title={t('暂无相关证书')}
              className="py-8"
            />
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 items-stretch">
              {position.certificates.map((cert) => (
                <div
                  key={cert.id}
                  className="relative rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm flex flex-col"
                >
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-2 right-2 z-10 h-7 w-7 bg-white/80 hover:bg-white hover:text-destructive rounded-full"
                    onClick={() => handleRemoveCertificate(cert.id)}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                  {isValidImageUrl(cert.image) ? (
                    <div className="relative aspect-video w-full overflow-hidden bg-gray-50">
                      <Image src={cert.image || ''} alt={cert.name} fill className="object-cover" />
                    </div>
                  ) : (
                    <div className="aspect-video w-full bg-primary/10 flex items-center justify-center">
                      <Award className="h-12 w-12 text-primary/50" />
                    </div>
                  )}
                  <div className="p-3 space-y-1.5 flex-1">
                    <div className="flex items-start gap-1">
                      <p className="text-xs text-muted-foreground shrink-0">{t('证书名称：')}</p>
                      <p className="text-sm font-semibold text-gray-900 break-words">{cert.name}</p>
                    </div>
                    {cert.url && (
                      <div className="flex items-start gap-1">
                        <span className="text-xs text-muted-foreground shrink-0">{t('相关网站：')}</span>
                        <a
                          href={cert.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-xs text-primary hover:underline min-w-0"
                        >
                          <ExternalLink className="h-3 w-3 shrink-0" />
                          <span className="truncate">{cert.url}</span>
                        </a>
                      </div>
                    )}
                    {cert.description && (
                      <div className="flex items-start gap-1">
                        <span className="text-xs text-muted-foreground shrink-0">{t('证书介绍：')}</span>
                        <p className="text-xs text-muted-foreground line-clamp-1">
                          {cert.description}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 从证书库选择证书对话框 */}
      <Dialog open={isCertDialogOpen} onOpenChange={setIsCertDialogOpen}>
        <DialogContent size="xl" className="!h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{t('从证书库选择证书')}</DialogTitle>
            <DialogDescription>{t('选择与该岗位相关的职业资格证书')}</DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              handleConfirmCertificates()
            }}
            className="flex flex-col flex-1 min-h-0 gap-4"
          >
            <div className="flex-1 flex flex-col min-h-0">
            <SearchInput
              placeholder={t('搜索证书名称或描述...')}
              value={certSearchQuery}
              onChange={setCertSearchQuery}
              inputClassName="mb-4"
            />
            <div className="flex-1 overflow-y-auto">
              {filteredCertificates.length === 0 ? (
                <EmptyState title={t('未找到匹配证书')} className="py-12" />
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 pr-1">
                  {filteredCertificates.map((cert) => {
                    const isSelected = selectedCertIds.includes(cert.id)
                    return (
                      <div
                        key={cert.id}
                        onClick={() => handleSelectCertificate(cert.id, !isSelected)}
                        className={`relative rounded-xl border-2 overflow-hidden cursor-pointer transition-all hover:shadow-md ${
                          isSelected
                            ? 'border-primary shadow-sm'
                            : 'border-gray-200 hover:border-gray-300 bg-white'
                        }`}
                      >
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={(checked) => handleSelectCertificate(cert.id, !!checked)}
                          className="absolute top-3 right-3 z-10"
                        />
                        {isValidImageUrl(cert.image) ? (
                          <div className="relative aspect-video w-full overflow-hidden bg-gray-50">
                            <Image
                              src={cert.image || ''}
                              alt={cert.name}
                              fill
                              className="object-cover"
                            />
                          </div>
                        ) : (
                          <div
                            className={`aspect-video w-full flex items-center justify-center ${isSelected ? 'bg-primary/10' : 'bg-gray-100'}`}
                          >
                            <Award
                              className={`h-12 w-12 ${isSelected ? 'text-primary/50' : 'text-gray-300'}`}
                            />
                          </div>
                        )}
                        <div className="p-3 space-y-1.5">
                          <div className="flex items-start gap-1">
                            <span className="text-[11px] text-muted-foreground shrink-0">
                              {t('证书名称：')}
                            </span>
                            <span className="text-sm font-semibold text-gray-900 break-words">
                              {cert.name}
                            </span>
                          </div>
                          {cert.url && (
                            <div className="flex items-start gap-1">
                              <span className="text-[11px] text-muted-foreground shrink-0">
                                {t('相关网站：')}
                              </span>
                              <a
                                href={cert.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="flex items-center gap-1 text-xs text-primary hover:underline min-w-0"
                              >
                                <ExternalLink className="h-3 w-3 shrink-0" />
                                <span className="truncate">{cert.url}</span>
                              </a>
                            </div>
                          )}
                          {cert.description && (
                            <div className="flex items-start gap-1">
                              <span className="text-[11px] text-muted-foreground shrink-0">
                                {t('证书介绍：')}
                              </span>
                              <p className="text-xs text-muted-foreground line-clamp-1">
                                {cert.description}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
          <FormDialogFooter
            onCancel={() => setIsCertDialogOpen(false)}
            confirmText={t('确认选择')}
            cancelText={t('取消')}
          />
          </form>
        </DialogContent>
      </Dialog>

      {/* 新增证书对话框 */}
      <Dialog open={isNewCertDialogOpen} onOpenChange={setIsNewCertDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('新增证书')}</DialogTitle>
            <DialogDescription>{t('添加一个新的职业资格证书')}</DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              handleAddNewCertificate()
            }}
            className="grid gap-4"
          >
            <div className="space-y-4 py-4">
            <FormFieldRow label={t('证书名称')}>
              <Input
                value={newCert.name}
                onChange={(e) => setNewCert({ ...newCert, name: e.target.value })}
                placeholder={t('例如：AWS 云从业者认证')}
              />
            </FormFieldRow>
            <FormFieldRow label={t('相关网址')}>
              <Input
                value={newCert.url}
                onChange={(e) => setNewCert({ ...newCert, url: e.target.value })}
                placeholder="https://..."
              />
            </FormFieldRow>
            <FormFieldRow label={t('证书介绍')}>
              <Textarea
                value={newCert.description}
                onChange={(e) => setNewCert({ ...newCert, description: e.target.value })}
                placeholder={t('简要描述该证书...')}
                rows={3}
              />
            </FormFieldRow>
            <div className="grid gap-2">
              <Label>{t('证书图片')}</Label>
              <div
                className="relative flex h-24 w-full cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-input bg-background text-muted-foreground transition-colors hover:bg-accent"
                onClick={() => {
                  const input = document.createElement('input')
                  input.type = 'file'
                  input.accept = 'image/*'
                  input.onchange = (e) => {
                    const file = (e.target as HTMLInputElement).files?.[0]
                    if (file) {
                      setCertImageFile(file)
                      setNewCert({ ...newCert, image: URL.createObjectURL(file) })
                    }
                  }
                  input.click()
                }}
              >
                {newCert.image ? (
                  <Image
                    src={newCert.image}
                    alt={t('证书预览')}
                    fill
                    className="rounded-lg object-contain"
                  />
                ) : (
                  <>
                    <ImageIcon className="mb-2 h-6 w-6" />
                    <span className="text-xs">{t('点击上传证书图片')}</span>
                  </>
                )}
              </div>
            </div>
          </div>
          <FormDialogFooter
            onCancel={() => setIsNewCertDialogOpen(false)}
            confirmText={t('添加')}
            cancelText={t('取消')}
            confirmDisabled={!newCert.name}
          />
          </form>
        </DialogContent>
      </Dialog>

      {/* AI 辅助编写进度弹窗；运行中关闭弹窗视为取消流水线 */}
      <AiAssistProgressDialog
        open={pipeline.open}
        onOpenChange={pipeline.handleOpenChange}
        title={t('AI 辅助编写')}
        description={t('大模型正在阅读岗位信息并生成润色、拆解与补齐结果')}
        steps={AI_ASSIST_STEPS}
        currentStep={pipeline.phase}
        progress={pipeline.progress}
      />

      {/* 快速补全必填信息弹窗 */}
      <Dialog open={quickFillOpen} onOpenChange={setQuickFillOpen}>
        <DialogContent className="sm:max-w-lg rounded-xl border-gray-200 max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-gray-800">
              <Sparkles className="h-5 w-5 text-purple-500" />
              {t('快速补全必填信息')}
            </DialogTitle>
            <DialogDescription className="text-gray-500">
              {t('以下必填字段尚未填写，请补充后继续使用 AI 辅助编写。')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {!position.name.trim() && (
              <div className="space-y-1.5">
                <Label>{t('岗位名称')} <span className="text-red-500">*</span></Label>
                <Input
                  value={quickFill.name}
                  onChange={(e) => setQuickFill({ ...quickFill, name: e.target.value })}
                  placeholder={t('例如：Java 后端开发工程师')}
                  className="h-9"
                />
              </div>
            )}

            {!position.industry.trim() && (
              <div className="space-y-1.5">
                <Label>{t('所属行业')} <span className="text-red-500">*</span></Label>
                <ComboboxSelect
                  multiple
                  className="w-full"
                  options={industries.map((i) => ({ label: i.name, value: i.id }))}
                  value={quickFill.industry ? [quickFill.industry] : []}
                  onChange={(values) => setQuickFill({ ...quickFill, industry: values[values.length - 1] || '' })}
                  placeholder={optionsLoading ? t('加载中...') : t('选择行业')}
                />
              </div>
            )}

            {!position.description.trim() && (
              <div className="space-y-1.5">
                <Label>{t('岗位背景介绍')} <span className="text-red-500">*</span></Label>
                <Textarea
                  value={quickFill.description}
                  onChange={(e) => setQuickFill({ ...quickFill, description: e.target.value })}
                  placeholder={t('描述该岗位的主要工作内容和特点...')}
                  rows={3}
                  className="resize-none"
                />
              </div>
            )}

            {!position.responsibilities.some((r) => r.name.trim()) && (
              <div className="space-y-1.5">
                <Label>{t('工作职责')} <span className="text-red-500">*</span></Label>
                <Textarea
                  value={quickFill.responsibilities}
                  onChange={(e) => setQuickFill({ ...quickFill, responsibilities: e.target.value })}
                  placeholder={t('每行一条，AI 将帮您拆解为专业条目...')}
                  rows={3}
                  className="resize-none"
                />
              </div>
            )}

            {!position.requirements.some((r) => r.trim()) && (
              <div className="space-y-1.5">
                <Label>{t('任职要求')} <span className="text-red-500">*</span></Label>
                <Textarea
                  value={quickFill.requirements}
                  onChange={(e) => setQuickFill({ ...quickFill, requirements: e.target.value })}
                  placeholder={t('每行一条，AI 将帮您拆解为专业条目...')}
                  rows={3}
                  className="resize-none"
                />
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setQuickFillOpen(false)}>
              {t('取消')}
            </Button>
            <Button
              className="bg-purple-600 hover:bg-purple-700 gap-1"
              disabled={
                (!position.name.trim() && !quickFill.name.trim()) ||
                (!position.industry.trim() && !quickFill.industry.trim()) ||
                (!position.description.trim() && !quickFill.description.trim()) ||
                (!position.responsibilities.some((r) => r.name.trim()) &&
                  !quickFill.responsibilities.trim()) ||
                (!position.requirements.some((r) => r.trim()) && !quickFill.requirements.trim())
              }
              onClick={confirmQuickFillAndStartAi}
            >
              <Sparkles className="h-4 w-4" />
              {t('开始 AI 辅助编写')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AI 未配置引导弹窗 */}
      <AiNotConfiguredDialog open={ai.notConfiguredOpen} onOpenChange={ai.setNotConfiguredOpen} />

      {/* 每次 AI 辅助编写前的意图确认弹窗 */}
      <Dialog open={confirmRegenOpen} onOpenChange={setConfirmRegenOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-500" />
              {t('确认重新生成全部内容？')}
            </DialogTitle>
            <DialogDescription>
              {t('AI 将基于当前填写的岗位信息重新生成并直接覆盖：岗位名称、岗位简称、岗位简介、参考薪资、工作职责（{n} 条）、任职要求（{m} 条）、晋升路径与证书推荐。每个字段均可单独「恢复上版」，也可全部撤销。', {
                n: position.responsibilities.filter((r) => r.name.trim()).length,
                m: position.requirements.filter(Boolean).length,
              })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConfirmRegenOpen(false)}>
              {t('取消')}
            </Button>
            <Button className="bg-purple-600 hover:bg-purple-700 gap-1" onClick={confirmRegenAndRun}>
              <Sparkles className="h-4 w-4" />
              {t('确认生成')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
