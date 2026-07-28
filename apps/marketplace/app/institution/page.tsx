"use client"

import { useEffect, useState } from "react"
import { DashboardLayout, useRole } from "@/components/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Building2, Lock, Save, Loader2 } from "lucide-react"
import { institutionApi, type Institution } from "@/lib/api"
import { MAJOR_TAGS } from "@/lib/resource-constants"
import { useToast } from "@/hooks/use-toast"

export default function InstitutionSettingsPage() {
  const { institutionId } = useRole()
  const { toast } = useToast()
  const [institution, setInstitution] = useState<Institution | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const [formData, setFormData] = useState({
    intro: "",
    contactName: "",
    contactPhone: "",
    contactEmail: "",
    expertiseTags: [] as string[],
  })

  useEffect(() => {
    if (!institutionId) {
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)
    institutionApi
      .get(institutionId)
      .then((data) => {
        setInstitution(data)
        setFormData({
          intro: data.intro || "",
          contactName: data.contactName || "",
          contactPhone: data.contactPhone || "",
          contactEmail: data.contactEmail || "",
          expertiseTags: data.expertiseTags || [],
        })
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "获取机构信息失败")
      })
      .finally(() => {
        setLoading(false)
      })
  }, [institutionId])

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex h-[60vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-accent" />
        </div>
      </DashboardLayout>
    )
  }

  if (!institutionId || !institution) {
    return (
      <DashboardLayout>
        <div className="flex h-[60vh] items-center justify-center">
          <p className="text-muted-foreground">请先入驻机构</p>
        </div>
      </DashboardLayout>
    )
  }

  const toggleTag = (tag: string) => {
    setFormData((prev) => ({
      ...prev,
      expertiseTags: prev.expertiseTags.includes(tag)
        ? prev.expertiseTags.filter((t) => t !== tag)
        : [...prev.expertiseTags, tag],
    }))
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      const updated = await institutionApi.update(institutionId, {
        intro: formData.intro,
        contactName: formData.contactName,
        contactPhone: formData.contactPhone,
        contactEmail: formData.contactEmail,
        expertiseTags: formData.expertiseTags,
      })
      setInstitution(updated)
      toast({
        title: "提示",
        description: "机构信息保存成功",
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败")
    } finally {
      setSaving(false)
    }
  }

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">机构信息维护</h1>
          <p className="text-sm text-muted-foreground">维护您的机构基本信息</p>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-accent/20">
                <Building2 className="h-5 w-5 text-accent" />
              </div>
              <div>
                <CardTitle className="text-base">{institution.name}</CardTitle>
                <CardDescription>{institution.type === "school" ? "学校" : "企业"}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Read-only fields */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label className="flex items-center gap-1 text-muted-foreground">
                  机构类型
                </Label>
                <Input value={institution.type === "school" ? "学校" : "企业"} disabled />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-1 text-muted-foreground">
                  <Lock className="h-3 w-3" />
                  统一社会信用代码
                </Label>
                <Input value={institution.creditCode} disabled />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label className="flex items-center gap-1 text-muted-foreground">
                  <Lock className="h-3 w-3" />
                  机构编码
                </Label>
                <Input value={institution.orgCode} disabled className="font-mono" />
              </div>
            </div>

            {/* Editable fields */}
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="contactName">联系人</Label>
                  <Input
                    id="contactName"
                    value={formData.contactName}
                    onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contactPhone">联系电话</Label>
                  <Input
                    id="contactPhone"
                    value={formData.contactPhone}
                    onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="contactEmail">联系邮箱</Label>
                <Input
                  id="contactEmail"
                  type="email"
                  value={formData.contactEmail}
                  onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="intro">机构简介</Label>
                <Textarea
                  id="intro"
                  rows={4}
                  value={formData.intro}
                  onChange={(e) => setFormData({ ...formData, intro: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>擅长专业领域</Label>
                <div className="flex flex-wrap gap-2">
                  {MAJOR_TAGS.map((tag) => (
                    <Badge
                      key={tag}
                      variant={formData.expertiseTags.includes(tag) ? "default" : "outline"}
                      className="cursor-pointer"
                      onClick={() => toggleTag(tag)}
                    >
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <Button className="gap-2" onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                保存修改
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}
