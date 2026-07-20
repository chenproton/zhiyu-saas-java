'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Award, ExternalLink, Trash2, Pencil, Check, X } from 'lucide-react'
import type { PositionCertificate } from '@/lib/types/job-source'

interface CertificateCardProps {
  certificate: PositionCertificate
  onChange: (cert: PositionCertificate) => void
  onRemove: () => void
}

export function CertificateCard({ certificate, onChange, onRemove }: CertificateCardProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [draft, setDraft] = useState(certificate)

  const handleSave = () => {
    onChange(draft)
    setIsEditing(false)
  }

  const handleCancel = () => {
    setDraft(certificate)
    setIsEditing(false)
  }

  return (
    <Card className="border-gray-200">
      <CardContent className="p-4">
        {isEditing ? (
          <div className="space-y-3">
            <div>
              <label className="text-xs text-gray-500">证书名称</label>
              <Input
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                className="mt-1 h-8 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500">证书介绍</label>
              <Textarea
                value={draft.description}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                className="mt-1 text-sm min-h-[60px] resize-none"
                rows={2}
              />
            </div>
            <div>
              <label className="text-xs text-gray-500">相关网址</label>
              <Input
                value={draft.url || ''}
                onChange={(e) => setDraft({ ...draft, url: e.target.value })}
                className="mt-1 h-8 text-sm"
                placeholder="https://..."
              />
            </div>
            <div className="flex items-center justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={handleCancel}>
                <X className="h-3.5 w-3.5 mr-1" /> 取消
              </Button>
              <Button size="sm" className="bg-gray-900 hover:bg-gray-800" onClick={handleSave}>
                <Check className="h-3.5 w-3.5 mr-1" /> 保存
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-purple-100">
              <Award className="h-5 w-5 text-purple-600" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium text-gray-800">{certificate.name}</span>
                {certificate.url && (
                  <a
                    href={certificate.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-purple-600 hover:text-purple-700"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
              </div>
              {certificate.description && (
                <p className="text-sm text-gray-500 mt-0.5">{certificate.description}</p>
              )}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-gray-400 hover:text-gray-700" onClick={() => setIsEditing(true)}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-gray-400 hover:text-red-500" onClick={onRemove}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

interface AddCertificateButtonProps {
  onAdd: (cert: PositionCertificate) => void | Promise<void>
}

export function AddCertificateButton({ onAdd }: AddCertificateButtonProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [draft, setDraft] = useState<Partial<PositionCertificate>>({ name: '', description: '', url: '' })

  const handleSave = async () => {
    if (!draft.name?.trim()) return
    setIsSaving(true)
    try {
      await onAdd({
        id: `cert-custom-${Date.now()}`,
        name: draft.name.trim(),
        description: draft.description || '',
        url: draft.url || '',
      })
      setDraft({ name: '', description: '', url: '' })
      setIsEditing(false)
    } finally {
      setIsSaving(false)
    }
  }

  if (!isEditing) {
    return (
      <Button variant="outline" size="sm" className="border-dashed border-gray-300 text-gray-600" onClick={() => setIsEditing(true)}>
        + 新增证书
      </Button>
    )
  }

  return (
    <Card className="border-gray-200 border-dashed">
      <CardContent className="p-4 space-y-3">
        <Input
          placeholder="证书名称"
          value={draft.name}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          className="h-8 text-sm"
        />
        <Textarea
          placeholder="证书介绍"
          value={draft.description}
          onChange={(e) => setDraft({ ...draft, description: e.target.value })}
          className="text-sm min-h-[60px] resize-none"
          rows={2}
        />
        <Input
          placeholder="相关网址 https://..."
          value={draft.url}
          onChange={(e) => setDraft({ ...draft, url: e.target.value })}
          className="h-8 text-sm"
        />
        <div className="flex items-center justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={() => setIsEditing(false)}>
            <X className="h-3.5 w-3.5 mr-1" /> 取消
          </Button>
          <Button size="sm" className="bg-gray-900 hover:bg-gray-800" onClick={handleSave}>
            <Check className="h-3.5 w-3.5 mr-1" /> 添加
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
