'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { FormFieldRow, FormFieldGrid } from '@/components/shared/form-field-row'
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
import { MultiSelect } from '@/components/ui/multi-select'
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
  Settings,
} from 'lucide-react'
import { toast } from '@zhiyu/ui'
import { industryApi, majorApi, certificateLibraryApi, fileApi, positionAiAssist } from '@/lib/api'
import type { AIPositionAssistField } from '@/lib/api'
import { useT } from '@/lib/i18n/locale-provider'
import { reportError } from '@/lib/error-handling'
import type { Position, PositionResponsibility } from '@/lib/types/job-source'
import { AiAssistProgressDialog } from './ai-assist-progress-dialog'

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
}: StepBasicInfoProps) {
  const t = useT()
  const isCreate = variant === 'create'
  const [industries, setIndustries] = useState<{ id: string; name: string }[]>([])
  const [majors, setMajors] = useState<{ id: string; name: string }[]>([])
  const [optionsLoading, setOptionsLoading] = useState(false)
  const [isGenerating, setIsGenerating] = useState<AIPositionAssistField | null>(null)
  const [aiNotice, setAiNotice] = useState<string | null>(null)

  // AI 辅助编写状态
  const [aiOpen, setAiOpen] = useState(false)
  const [aiPhase, setAiPhase] = useState(0)
  const [aiProgress, setAiProgress] = useState(0)
  const [notConfiguredOpen, setNotConfiguredOpen] = useState(false)
  const [quickFillOpen, setQuickFillOpen] = useState(false)
  const [quickFill, setQuickFill] = useState({
    name: '',
    industry: '',
    description: '',
    responsibilities: '',
    requirements: '',
  })
  const [confirmRegenOpen, setConfirmRegenOpen] = useState(false)
  // 字段级 AI 写入历史（1 级）：key 为字段，值为该字段被 AI 覆盖前的快照，用于「恢复上版」
  const [aiHistories, setAiHistories] = useState<Partial<Record<AiWriteKey, Partial<Position>>>>({})
  // 写入高亮字段（短暂紫色闪烁，提示"哪里被 AI 改了"）
  const [flashKey, setFlashKey] = useState<AiWriteKey | null>(null)
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const notConfiguredRef = useRef(false)
  // 最新 position 快照：AI 回调时读取，避免闭包内拿到过期值
  const positionRef = useRef(position)
  useEffect(() => {
    positionRef.current = position
  }, [position])

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

  /** 单字段调用后端（返回建议；失败返回 null 并统一提示，412 打开配置引导） */
  const callAssist = async (field: AIPositionAssistField) => {
    setIsGenerating(field)
    try {
      return await positionAiAssist({ field, position: buildAiContext() })
    } catch (err) {
      if (err instanceof Error && err.message === 'ai_not_configured') {
        notConfiguredRef.current = true
        setNotConfiguredOpen(true)
      } else {
        toast({
          title: t('AI 生成失败'),
          description: err instanceof Error ? err.message : undefined,
          variant: 'destructive',
        })
      }
      return null
    } finally {
      setIsGenerating(null)
    }
  }

  // ===== AI 直接写入（逐字段）=====

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

  /** 触发写入高亮闪烁 */
  const flashField = (key: AiWriteKey) => {
    setFlashKey(key)
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current)
    flashTimerRef.current = setTimeout(() => setFlashKey(null), 1400)
  }

  /**
   * 直接写入某字段：记录首次覆盖前的快照（1 级历史）+ 应用新值 + 高亮。
   * 多次覆盖同一字段不覆盖历史，保证「恢复上版」回到 AI 介入前的原值。
   */
  const writeField = (key: AiWriteKey, values: Partial<Position>) => {
    setAiHistories((prev) => {
      if (prev[key] !== undefined) return prev
      return { ...prev, [key]: snapshotField(key) }
    })
    onUpdate(values)
    flashField(key)
  }

  /** 恢复某字段到 AI 覆盖前的值（清除该字段历史） */
  const restoreField = (key: AiWriteKey) => {
    const snapshot = aiHistories[key]
    if (snapshot) onUpdate(snapshot)
    setAiHistories((prev) => {
      const next = { ...prev }
      delete next[key]
      return next
    })
  }

  /** 全部撤销：恢复所有被 AI 覆盖的字段 */
  const handleRestoreAll = () => {
    const snaps = AI_WRITE_KEYS.map((k) => aiHistories[k]).filter(
      (s): s is Partial<Position> => s !== undefined,
    )
    if (snaps.length > 0) {
      const merged: Partial<Position> = {}
      for (const snap of snaps) Object.assign(merged, snap)
      onUpdate(merged)
    }
    setAiHistories({})
    toast({ title: t('已全部恢复 AI 覆盖前的内容') })
  }

  /** 基础信息单字段生成：调 polish 一次，仅应用目标字段 */
  const handlePolishField = async (target: PolishFieldKey) => {
    const res = await callAssist('polish')
    if (!res?.polish) return
    const p = res.polish
    if (target === 'name' && p.name.trim()) writeField('name', { name: p.name.trim() })
    else if (target === 'shortName' && p.shortName.trim()) {
      writeField('shortName', { shortName: p.shortName.trim() })
    } else if (target === 'description' && p.description.trim()) {
      writeField('description', { description: p.description.trim() })
    } else if (target === 'salaryRange' && p.salaryMin > 0 && p.salaryMax >= p.salaryMin) {
      writeField('salaryRange', { salaryRange: [p.salaryMin, p.salaryMax] })
    }
  }

  /** 职责整节替换 */
  const handleWriteResponsibilities = async () => {
    const res = await callAssist('responsibilities')
    if (!res?.responsibilities) return
    writeField('responsibilities', {
      responsibilities: res.responsibilities.map((name) => ({
        id: `resp-ai-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name,
        description: '',
      })),
    })
  }

  /** 要求整节替换 */
  const handleWriteRequirements = async () => {
    const res = await callAssist('requirements')
    if (res?.requirements) writeField('requirements', { requirements: res.requirements })
  }

  /** 晋升路径替换 */
  const handleWriteCareerPath = async () => {
    const res = await callAssist('careerPath')
    if (res?.careerPath) writeField('careerPath', { careerPath: res.careerPath })
  }

  /** 证书追加 */
  const handleWriteCertificates = async () => {
    const res = await callAssist('certificates')
    if (!res?.certificates) return
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

  /** 当前被 AI 覆盖且未恢复的字段数 */
  const updatedCount = useMemo(
    () => AI_WRITE_KEYS.filter((k) => aiHistories[k] !== undefined).length,
    [aiHistories],
  )

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
    const cur = positionRef.current
    const ctx = {
      name: quickFill.name,
      shortName: cur.shortName,
      industry: resolveIndustryName(quickFill.industry),
      majors: resolveMajorNames(cur.majors),
      salaryRange: cur.salaryRange,
      description: quickFill.description,
      responsibilities: respItems,
      requirements: reqItems,
      careerPath: cur.careerPath,
    }
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
    setQuickFillOpen(false)
    runAiAssist(ctx)
  }

  /** 一键流程：按字段顺序逐个生成，进度弹窗逐步展示；结束后顶部出现结果提示条 */
  const runAiAssist = async (ctx?: ReturnType<typeof buildAiContext>) => {
    notConfiguredRef.current = false
    const context = ctx || buildAiContext()
    setAiOpen(true)
    setAiPhase(0)
    setAiProgress(3)
    // polish 一次返回 4 个基础字段，逐个直接写入（各自独立历史/高亮）
    const applyPolish = (res: NonNullable<Awaited<ReturnType<typeof positionAiAssist>>>) => {
      const p = res.polish
      if (!p) return
      if (p.name.trim()) writeField('name', { name: p.name.trim() })
      if (p.shortName.trim()) writeField('shortName', { shortName: p.shortName.trim() })
      if (p.description.trim()) writeField('description', { description: p.description.trim() })
      if (p.salaryMin > 0 && p.salaryMax >= p.salaryMin) {
        writeField('salaryRange', { salaryRange: [p.salaryMin, p.salaryMax] })
      }
    }
    const tasks: { field: AIPositionAssistField; apply: (res: NonNullable<Awaited<ReturnType<typeof positionAiAssist>>>) => void }[] = [
      { field: 'polish', apply: applyPolish },
      { field: 'responsibilities', apply: (res) => {
        if (res.responsibilities) {
          writeField('responsibilities', {
            responsibilities: res.responsibilities.map((name) => ({
              id: `resp-ai-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
              name,
              description: '',
            })),
          })
        }
      } },
      { field: 'requirements', apply: (res) => {
        if (res.requirements) writeField('requirements', { requirements: res.requirements })
      } },
      { field: 'careerPath', apply: (res) => {
        if (res.careerPath) writeField('careerPath', { careerPath: res.careerPath })
      } },
      { field: 'certificates', apply: (res) => {
        if (res.certificates) {
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
      } },
    ]
    for (let i = 0; i < tasks.length; i++) {
      if (notConfiguredRef.current) break
      const { field, apply } = tasks[i]
      setIsGenerating(field)
      try {
        const res = await positionAiAssist({ field, position: context })
        if (res) apply(res)
      } catch (err) {
        if (err instanceof Error && err.message === 'ai_not_configured') {
          notConfiguredRef.current = true
          setNotConfiguredOpen(true)
          break
        }
        toast({
          title: t('AI 生成失败'),
          description: err instanceof Error ? err.message : undefined,
          variant: 'destructive',
        })
      } finally {
        setIsGenerating(null)
        const nextPhase = i + 1
        setAiPhase(nextPhase)
        setAiProgress(Math.round(((nextPhase + 1) / AI_ASSIST_STEPS.length) * 100))
      }
    }
    setAiOpen(false)
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
          disabled={isGenerating !== null}
        >
          {isGenerating === field ? (
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
        disabled={isGenerating !== null}
        title={t('AI 生成')}
      >
        {isGenerating === 'polish' ? (
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
            disabled={isGenerating !== null}
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
          <FormFieldGrid cols={3}>
            {showIndustryMajor && (
              <>
                <FormFieldRow label={t('面向行业')} htmlFor="industry">
                  <MultiSelect
                    options={industries.map((i) => ({ label: i.name, value: i.id }))}
                    value={position.industry ? [position.industry] : []}
                    onChange={(values) => onUpdate({ industry: values[values.length - 1] || '' })}
                    placeholder={optionsLoading ? t('加载中...') : t('选择行业')}
                  />
                </FormFieldRow>
                <FormFieldRow label={t('适用专业')} htmlFor="major">
                  <MultiSelect
                    options={majors.map((m) => ({ label: m.name, value: m.id }))}
                    value={position.majors}
                    onChange={(values) => onUpdate({ majors: values })}
                    placeholder={optionsLoading ? t('加载中...') : t('选择专业')}
                  />
                </FormFieldRow>
              </>
            )}
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
            <div className="text-center py-8 text-muted-foreground">
              <Award className="h-10 w-10 mx-auto mb-2 opacity-50" />
              <p>{t('暂无相关证书')}</p>
            </div>
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
          <div className="flex-1 flex flex-col min-h-0">
            <Input
              placeholder={t('搜索证书名称或描述...')}
              value={certSearchQuery}
              onChange={(e) => setCertSearchQuery(e.target.value)}
              className="mb-4"
            />
            <div className="flex-1 overflow-y-auto">
              {filteredCertificates.length === 0 ? (
                <p className="py-12 text-center text-sm text-muted-foreground">{t('未找到匹配证书')}</p>
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
          <DialogFooter className="pt-4 border-t">
            <Button variant="outline" onClick={() => setIsCertDialogOpen(false)}>
              {t('取消')}
            </Button>
            <Button onClick={handleConfirmCertificates}>{t('确认选择')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 新增证书对话框 */}
      <Dialog open={isNewCertDialogOpen} onOpenChange={setIsNewCertDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('新增证书')}</DialogTitle>
            <DialogDescription>{t('添加一个新的职业资格证书')}</DialogDescription>
          </DialogHeader>
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
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsNewCertDialogOpen(false)}>
              {t('取消')}
            </Button>
            <Button onClick={handleAddNewCertificate} disabled={!newCert.name}>
              {t('添加')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AI 辅助编写进度弹窗 */}
      <AiAssistProgressDialog
        open={aiOpen}
        onOpenChange={setAiOpen}
        title={t('AI 辅助编写')}
        description={t('大模型正在阅读岗位信息并生成润色、拆解与补齐结果')}
        steps={AI_ASSIST_STEPS}
        currentStep={aiPhase}
        progress={aiProgress}
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
                <MultiSelect
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
      <Dialog open={notConfiguredOpen} onOpenChange={setNotConfiguredOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5 text-primary" />
              {t('尚未配置 AI 服务')}
            </DialogTitle>
            <DialogDescription>
              {t('请先在 系统管理 > 租户信息 中配置 AI 服务，再使用 AI 辅助编写')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setNotConfiguredOpen(false)}>
              {t('取消')}
            </Button>
            <Button asChild onClick={() => setNotConfiguredOpen(false)}>
              <Link href="/portal/apps/system/tenant">{t('前往配置')}</Link>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
