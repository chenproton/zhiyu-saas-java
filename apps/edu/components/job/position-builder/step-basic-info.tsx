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
  Loader2,
  Award,
  ExternalLink,
  Image as ImageIcon,
  AlertCircle,
} from 'lucide-react'
import { industryApi, majorApi, certificateLibraryApi, fileApi } from '@/lib/api'
import { useT } from '@/lib/i18n/locale-provider'
import { reportError } from '@/lib/error-handling'
import type { Position, PositionResponsibility } from '@/lib/types/job-source'

interface StepBasicInfoProps {
  position: Position
  onUpdate: (data: Partial<Position>) => void
  aiMode?: boolean
  variant?: 'default' | 'create'
  /** 是否展示"面向行业/适用专业"（缺省 true；企业共建端无行业/专业字典数据源时传 false 隐藏，已有值随保存原样回传） */
  showIndustryMajor?: boolean
  /** 是否启用证书库选择/新增（缺省 true；企业共建端无证书库数据源时传 false，仅展示/移除已关联证书） */
  certificateLibraryEnabled?: boolean
}

interface Certificate {
  id: string // certificate_library id
  name: string
  url: string
  description: string
  image?: string
}

type AiSuggestionField = 'description' | 'responsibilities' | 'requirements' | 'careerPath'

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
}: StepBasicInfoProps) {
  const t = useT()
  const isCreate = variant === 'create'
  const [industries, setIndustries] = useState<{ id: string; name: string }[]>([])
  const [majors, setMajors] = useState<{ id: string; name: string }[]>([])
  const [optionsLoading, setOptionsLoading] = useState(false)
  const [isGenerating, setIsGenerating] = useState<string | null>(null)
  const [aiNotice, setAiNotice] = useState<string | null>(null)

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

  const handleAIGenerate = async (field: AiSuggestionField, _direction?: string) => {
    setIsGenerating(field)
    setAiNotice(t('AI 生成服务暂未接入，请手动填写'))
    await new Promise((resolve) => setTimeout(resolve, 300))
    setIsGenerating(null)
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

  const renderAIButton = (field: AiSuggestionField, label: string) => {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => handleAIGenerate(field)}
        disabled={isGenerating !== null}
      >
        {isGenerating === field ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Sparkles className="mr-2 h-4 w-4" />
        )}
        {label}
      </Button>
    )
  }

  return (
    <div className="space-y-6">
      {/* Merged Basic Info Card */}
      <Card>
        <CardHeader>
          <CardTitle>{t('基本信息')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Row 1: Name + Short Name */}
          <FormFieldGrid cols={2}>
            <FormFieldRow label={t('岗位名称')} htmlFor="name">
              <Input
                id="name"
                value={position.name}
                onChange={(e) => onUpdate({ name: e.target.value })}
                placeholder={t('例如：Java 后端开发工程师')}
              />
            </FormFieldRow>
            <FormFieldRow label={t('岗位简称')} htmlFor="shortName">
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
            </FormFieldRow>
          </FormFieldGrid>

          {/* Row 3: Salary Range */}
          <div className="grid gap-2">
            <Label>{t('薪资范围（元/月）')}</Label>
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
          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="description">{t('岗位背景介绍')}</Label>
              {aiMode && renderAIButton('description', t('AI 生成'))}
            </div>
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
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base">{t('工作职责')}</CardTitle>
          {aiMode && renderAIButton('responsibilities', t('AI 生成'))}
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
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base">{t('任职要求')}</CardTitle>
          {aiMode && renderAIButton('requirements', t('AI 生成'))}
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
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base">{t('发展路径')}</CardTitle>
          {aiMode && renderAIButton('careerPath', t('AI 生成'))}
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
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base">{t('相关证书')}</CardTitle>
          {certificateLibraryEnabled && (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={openCertDialog}>
                {t('从证书库选择')}
              </Button>
              <Button variant="outline" size="sm" onClick={() => setIsNewCertDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                {t('新增证书')}
              </Button>
            </div>
          )}
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
    </div>
  )
}
