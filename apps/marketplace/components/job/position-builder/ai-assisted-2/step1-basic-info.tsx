'use client'

import { useState, useEffect, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Sparkles, Check, X, ArrowRight, AlertCircle } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { CertificateCard, AddCertificateButton } from './certificate-card'
import { industryApi, majorApi, certificateLibraryApi } from '@/lib/api'
import type { Position, PositionCertificate, PositionResponsibility } from '@/lib/types/job-source'

export interface Step1Draft extends Position {
  rawResponsibilities: string
  rawRequirements: string
  rawCareerPath: string
}

type LibraryCert = { id: string; name: string; url?: string; description?: string }

interface Step1BasicInfoProps {
  draft: Step1Draft
  onUpdate: (data: Partial<Step1Draft>) => void
  onNext: () => void
}

export function Step1BasicInfo({ draft, onUpdate, onNext }: Step1BasicInfoProps) {
  const [industries, setIndustries] = useState<{ id: string; name: string }[]>([])
  const [majors, setMajors] = useState<{ id: string; name: string }[]>([])
  const [optionsLoading, setOptionsLoading] = useState(false)
  const [aiNotice, setAiNotice] = useState<string | null>(null)
  const [certificateLibrary, setCertificateLibrary] = useState<LibraryCert[]>([])

  useEffect(() => {
    let cancelled = false
    setOptionsLoading(true)
    Promise.all([
      industryApi.list({ limit: 1000 }),
      majorApi.list({ limit: 1000 }),
      certificateLibraryApi.list({ limit: 1000 }),
    ])
      .then(([indRes, majorRes, libRes]) => {
        if (cancelled) return
        setIndustries((indRes.items || []).filter((i) => i.enabled).map((i) => ({ id: i.id, name: i.name })))
        setMajors((majorRes.items || []).filter((m) => m.enabled).map((m) => ({ id: m.id, name: m.name })))
        setCertificateLibrary(libRes.items.map((item) => ({ id: item.id, name: item.name, url: item.url, description: item.description })))
      })
      .catch(() => {
        if (cancelled) return
        setIndustries([])
        setMajors([])
        setCertificateLibrary([])
      })
      .finally(() => {
        if (!cancelled) setOptionsLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  const [suggestedCertificates, setSuggestedCertificates] = useState<PositionCertificate[] | null>(null)
  const [certSelectorOpen, setCertSelectorOpen] = useState(false)
  const [selectedCertIds, setSelectedCertIds] = useState<string[]>([])

  const validateRequired = () => {
    if (!draft.name.trim()) return '岗位名称'
    if (!draft.industry.trim()) return '所属行业'
    if (!draft.description.trim()) return '岗位简介'
    if (!draft.rawResponsibilities.trim()) return '工作职责'
    if (!draft.rawRequirements.trim()) return '任职要求'
    return null
  }

  const startAiAssist = () => {
    setAiNotice('AI 生成服务暂未接入，请手动填写')
  }

  const showCertSelector = () => {
    setSuggestedCertificates(certificateLibrary as unknown as PositionCertificate[])
    setSelectedCertIds([])
    setCertSelectorOpen(true)
  }

  const adoptCertificates = () => {
    const existingLibraryIds = new Set(draft.certificates.map((c) => c.libraryId || c.id))
    const selected = certificateLibrary.filter(
      (c) => selectedCertIds.includes(c.id) && !existingLibraryIds.has(c.id)
    )
    if (selected.length > 0) {
      const newCerts: PositionCertificate[] = selected.map((c) => ({
        id: `cert-ref-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        libraryId: c.id,
        name: c.name,
        url: c.url ?? '',
        description: c.description ?? '',
      }))
      onUpdate({ certificates: [...draft.certificates, ...newCerts] })
    }
    setCertSelectorOpen(false)
    setSelectedCertIds([])
    setSuggestedCertificates(null)
  }

  const updateResponsibility = (index: number, name: string) => {
    const next = draft.responsibilities.map((r, i) => (i === index ? { ...r, name } : r))
    onUpdate({ responsibilities: next })
  }

  const removeResponsibility = (index: number) => {
    onUpdate({ responsibilities: draft.responsibilities.filter((_, i) => i !== index) })
  }

  const addResponsibility = () => {
    onUpdate({
      responsibilities: [
        ...draft.responsibilities,
        { id: `resp-manual-${Date.now()}`, name: '', description: '' },
      ],
    })
  }

  const updateRequirement = (index: number, value: string) => {
    const next = draft.requirements.map((r, i) => (i === index ? value : r))
    onUpdate({ requirements: next })
  }

  const removeRequirement = (index: number) => {
    onUpdate({ requirements: draft.requirements.filter((_, i) => i !== index) })
  }

  const addRequirement = () => {
    onUpdate({ requirements: [...draft.requirements, ''] })
  }

  const updateCareerPath = (value: string) => {
    onUpdate({ careerPath: value })
  }

  const updateCertificate = (index: number, cert: PositionCertificate) => {
    const next = [...draft.certificates]
    next[index] = cert
    onUpdate({ certificates: next })
  }

  const removeCertificate = (index: number) => {
    onUpdate({ certificates: draft.certificates.filter((_, i) => i !== index) })
  }

  const missingLabel = validateRequired()

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">步骤一：岗位基础信息</h2>
          <p className="text-sm text-gray-500 mt-0.5">填写基础信息后，点击右上角「AI 辅助编写」让大模型帮您润色、补齐与条目化</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className="border-purple-200 text-purple-700 hover:bg-purple-50 hover:text-purple-800 gap-1"
            onClick={startAiAssist}
          >
            <Sparkles className="h-4 w-4" />
            AI 辅助编写
          </Button>
        </div>
      </div>

      {aiNotice && (
        <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3 flex items-start gap-2 text-sm text-amber-800">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{aiNotice}</span>
        </div>
      )}

      {/* Basic info card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">基础信息</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">岗位名称 <span className="text-red-500">*</span></Label>
              <Input
                id="name"
                value={draft.name}
                onChange={(e) => onUpdate({ name: e.target.value })}
                placeholder="例如：Java 后端开发工程师"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="shortName">岗位简称</Label>
              <Input
                id="shortName"
                value={draft.shortName}
                onChange={(e) => onUpdate({ shortName: e.target.value })}
                placeholder="例如：Java开发"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="industry">所属行业 <span className="text-red-500">*</span></Label>
              <Select value={draft.industry} onValueChange={(v) => onUpdate({ industry: v })} disabled={optionsLoading}>
                <SelectTrigger id="industry">
                  <SelectValue placeholder={optionsLoading ? '加载中...' : '选择行业'} />
                </SelectTrigger>
                <SelectContent>
                  {industries.map((ind) => (
                    <SelectItem key={ind.id} value={ind.name}>{ind.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="major">适用专业</Label>
              <Select
                value={draft.majors[0] || ''}
                onValueChange={(v) => onUpdate({ majors: v ? [v] : [] })}
                disabled={optionsLoading}
              >
                <SelectTrigger id="major">
                  <SelectValue placeholder={optionsLoading ? '加载中...' : '选择专业（可选）'} />
                </SelectTrigger>
                <SelectContent>
                  {majors.map((m) => (
                    <SelectItem key={m.id} value={m.name}>{m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>参考薪资（元/月）</Label>
            <div className="flex items-center gap-3">
              <Input
                type="number"
                value={draft.salaryRange[0] || ''}
                onChange={(e) => onUpdate({ salaryRange: [Number(e.target.value), draft.salaryRange[1]] })}
                placeholder="最低"
                className="w-32"
              />
              <span className="text-muted-foreground">-</span>
              <Input
                type="number"
                value={draft.salaryRange[1] || ''}
                onChange={(e) => onUpdate({ salaryRange: [draft.salaryRange[0], Number(e.target.value)] })}
                placeholder="最高"
                className="w-32"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">岗位简介 <span className="text-red-500">*</span></Label>
            <Textarea
              id="description"
              value={draft.description}
              onChange={(e) => onUpdate({ description: e.target.value })}
              placeholder="对岗位做简要的背景介绍"
              rows={4}
            />
          </div>
        </CardContent>
      </Card>

      {/* Responsibilities raw input + itemized */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">工作职责 <span className="text-red-500">*</span></CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label>原始工作职责描述</Label>
            <Textarea
              value={draft.rawResponsibilities}
              onChange={(e) => onUpdate({ rawResponsibilities: e.target.value })}
              placeholder="请输入工作职责，可以是一句话或一大段话，AI 将帮您拆解为条目..."
              rows={4}
            />
          </div>

          <div className="space-y-2">
            <Label>条目化工作职责</Label>
            <div className="space-y-2">
              {draft.responsibilities.map((item, index) => (
                <div key={item.id} className="flex items-center gap-2">
                  <Badge variant="outline" className="shrink-0">{index + 1}</Badge>
                  <Input
                    value={item.name}
                    onChange={(e) => updateResponsibility(index, e.target.value)}
                    className="flex-1 text-sm h-8"
                  />
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-red-500" onClick={() => removeResponsibility(index)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button variant="outline" size="sm" className="w-full border-dashed" onClick={addResponsibility}>
                + 添加工作职责
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Requirements raw input + itemized */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">任职要求 <span className="text-red-500">*</span></CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label>原始任职要求描述</Label>
            <Textarea
              value={draft.rawRequirements}
              onChange={(e) => onUpdate({ rawRequirements: e.target.value })}
              placeholder="请输入任职要求，可以是一句话或一大段话，AI 将帮您拆解为条目..."
              rows={4}
            />
          </div>

          <div className="space-y-2">
            <Label>条目化任职要求</Label>
            <div className="space-y-2">
              {draft.requirements.map((item, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Badge variant="outline" className="shrink-0">{index + 1}</Badge>
                  <Input
                    value={item}
                    onChange={(e) => updateRequirement(index, e.target.value)}
                    className="flex-1 text-sm h-8"
                  />
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-red-500" onClick={() => removeRequirement(index)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button variant="outline" size="sm" className="w-full border-dashed" onClick={addRequirement}>
                + 添加任职要求
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Career path */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">晋升路径</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label>原始晋升路径描述</Label>
            <Textarea
              value={draft.rawCareerPath}
              onChange={(e) => onUpdate({ rawCareerPath: e.target.value })}
              placeholder="请输入晋升路径，可以是一句话或一大段话，AI 将帮您整理为 A→B→C 的发展路线..."
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label>发展路线</Label>
            <Textarea
              value={draft.careerPath}
              onChange={(e) => updateCareerPath(e.target.value)}
              placeholder="例如：纵向晋升：开发工程师 → 高级开发工程师 → 技术专家 → 架构师 → 技术总监"
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      {/* Certificates */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">证书推荐</CardTitle>
          <Button variant="outline" size="sm" onClick={showCertSelector}>
            从证书库选择
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3">
            {draft.certificates.map((cert, index) => (
              <CertificateCard
                key={cert.id}
                certificate={cert}
                onChange={(c) => updateCertificate(index, c)}
                onRemove={() => removeCertificate(index)}
              />
            ))}
            <AddCertificateButton onAdd={async (cert) => {
              try {
                const created = await certificateLibraryApi.create({
                  name: cert.name,
                  url: cert.url || undefined,
                  description: cert.description || undefined,
                })
                const newCert: PositionCertificate = {
                  id: `cert-ref-${Date.now()}`,
                  libraryId: created.id,
                  name: created.name,
                  url: created.url ?? '',
                  description: created.description ?? '',
                }
                onUpdate({ certificates: [...draft.certificates, newCert] })
              } catch {
                setAiNotice('新增证书失败')
              }
            }} />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={onNext} disabled={!!missingLabel} className="gap-1">
          {missingLabel ? `请先填写${missingLabel}` : '下一步'}
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Certificate Selector Dialog */}
      <Dialog open={certSelectorOpen} onOpenChange={setCertSelectorOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>从证书库选择证书</DialogTitle>
            <DialogDescription>选择与该岗位相关的职业资格证书</DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-3">
            <div className="max-h-80 overflow-y-auto space-y-2">
              {(suggestedCertificates || []).map((cert) => (
                <div
                  key={cert.id}
                  className="flex items-start gap-3 p-3 rounded-lg border hover:bg-accent/50 cursor-pointer"
                  onClick={() => {
                    setSelectedCertIds((prev) =>
                      prev.includes(cert.id) ? prev.filter((id) => id !== cert.id) : [...prev, cert.id]
                    )
                  }}
                >
                  <div
                    className={`mt-0.5 h-4 w-4 rounded border flex items-center justify-center shrink-0 ${
                      selectedCertIds.includes(cert.id) ? 'bg-primary border-primary' : 'border-gray-300'
                    }`}
                  >
                    {selectedCertIds.includes(cert.id) && <Check className="h-3 w-3 text-white" />}
                  </div>
                  <div className="flex-1">
                    <div className="font-medium">{cert.name}</div>
                    <div className="text-sm text-muted-foreground">{cert.description}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCertSelectorOpen(false)}>
              取消
            </Button>
            <Button onClick={adoptCertificates} disabled={selectedCertIds.length === 0}>
              确认选择 ({selectedCertIds.length})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
