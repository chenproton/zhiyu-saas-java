"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Image from "next/image"
import Link from "next/link"
import { DashboardLayout, useRole } from "@/components/dashboard-layout"
import { useToast } from "@zhiyu/ui"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import {
  ShoppingCart,
  Download,
  FileText,
  Building2,
  CheckCircle,
  TrendingUp,
  Lock,
  GraduationCap,
  Tag,
  Calendar,
  Loader2,
  AlertCircle,
} from "lucide-react"
import {
  resourceApi,
  institutionApi,
  orderApi,
  type Resource,
  type Institution,
  type Authorization,
} from "@/lib/api"

const RESOURCE_CATEGORIES = [
  { id: "post", name: "岗位包", color: "bg-indigo-100 text-indigo-700 border-indigo-200" },
  { id: "scene", name: "场景包", color: "bg-cyan-100 text-cyan-700 border-cyan-200" },
  { id: "course", name: "课程包", color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  { id: "assessment", name: "测评包", color: "bg-amber-100 text-amber-700 border-amber-200" },
  { id: "material", name: "素材包", color: "bg-rose-100 text-rose-700 border-rose-200" },
] as const

function getCategoryName(categoryId: string): string {
  return RESOURCE_CATEGORIES.find((c) => c.id === categoryId)?.name || categoryId
}

function getCategoryColor(categoryId: string): string {
  return RESOURCE_CATEGORIES.find((c) => c.id === categoryId)?.color || "bg-secondary"
}

export default function ResourceDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { role, institutionId } = useRole()
  const { toast } = useToast()
  const [institutionOpen, setInstitutionOpen] = useState(false)

  const [resource, setResource] = useState<Resource | null>(null)
  const [institution, setInstitution] = useState<Institution | null>(null)
  const [authorizations, setAuthorizations] = useState<Authorization[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const resourceId = typeof params.id === "string" ? params.id : Array.isArray(params.id) ? params.id[0] : ""

  useEffect(() => {
    if (!resourceId) {
      setLoading(false)
      setError("无效的资源 ID")
      return
    }

    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)

      try {
        const [resourceRes, authsRes] = await Promise.all([
          resourceApi.get(resourceId),
          orderApi.listAuthorizations(),
        ])
        if (cancelled) return

        setResource(resourceRes)
        setAuthorizations(authsRes.items)

        const institutionRes = await institutionApi.get(resourceRes.institutionId)
        if (cancelled) return
        setInstitution(institutionRes)

        try {
          await resourceApi.incrementView(resourceId)
        } catch {
          // 浏览量增量失败不影响页面展示
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "加载资源失败，请稍后重试")
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    load()

    return () => {
      cancelled = true
    }
  }, [resourceId])

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex h-[60vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-accent" />
        </div>
      </DashboardLayout>
    )
  }

  if (error || !resource || !institution) {
    return (
      <DashboardLayout>
        <div className="flex h-[60vh] flex-col items-center justify-center gap-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <AlertCircle className="h-5 w-5" />
            <p>{error || "资源不存在"}</p>
          </div>
          <Button variant="outline" onClick={() => router.push("/")}>
            返回商城首页
          </Button>
        </div>
      </DashboardLayout>
    )
  }

  const tags = resource.tags || []
  const majorTags = tags.filter((t) => t.tagType === "major").map((t) => t.tagValue)
  const industryTags = tags.filter((t) => t.tagType === "industry").map((t) => t.tagValue)
  const levelTags = tags.filter((t) => t.tagType === "level").map((t) => t.tagValue)
  const difficultyTags = tags.filter((t) => t.tagType === "difficulty").map((t) => t.tagValue)

  const isPurchased = institutionId
    ? authorizations.some(
        (a) => a.buyerId === institutionId && a.resourceId === resourceId && a.status === 1
      )
    : false

  const canPurchase = role === "school" && !isPurchased

  const handleDownload = () => {
    if (!resource.attachment || resource.attachment === "#") {
      toast({
        variant: "destructive",
        title: "提示",
        description: "暂无附件下载链接",
      })
      return
    }
    window.open(resource.attachment, "_blank")
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 pb-8">
        {/* Breadcrumb */}
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href="/">商城首页</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage className="max-w-[200px] truncate">{resource.name}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <div className="grid gap-8 lg:grid-cols-12">
          {/* Left: Cover + Attachments */}
          <div className="space-y-6 lg:col-span-7">
            <Card className="overflow-hidden rounded-2xl">
              <div className="relative aspect-[16/10] w-full bg-muted">
                <Image
                  src={resource.coverImage || "/placeholder.jpg"}
                  alt={resource.name}
                  fill
                  className="object-cover"
                />
              </div>
            </Card>

            <Card className="rounded-2xl">
              <CardHeader>
                <CardTitle className="text-base">资源附件</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between rounded-xl border border-border/60 bg-card p-4">
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-100 to-teal-100 text-cyan-600">
                      <FileText className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {resource.attachmentName || "资源附件"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {isPurchased ? "已授权，可无限次下载" : "购买后可下载"}
                      </p>
                    </div>
                  </div>
                  {isPurchased ? (
                    <Button variant="outline" className="gap-2" onClick={handleDownload}>
                      <Download className="h-4 w-4" />
                      下载
                    </Button>
                  ) : (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Lock className="h-4 w-4" />
                      未授权
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl">
              <CardHeader>
                <CardTitle className="text-base">资源简介</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                  {resource.intro}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Right: Info + Purchase */}
          <div className="space-y-6 lg:col-span-5">
            <Card className="rounded-2xl">
              <CardContent className="space-y-5 p-6">
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <h1 className="text-2xl font-bold leading-tight text-foreground md:text-3xl">
                      {resource.name}
                    </h1>
                    <Badge className={getCategoryColor(resource.category)}>
                      {getCategoryName(resource.category)}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Tag className="h-3.5 w-3.5" />
                      版本 {resource.version}
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5" />
                      上架 {resource.createdAt}
                    </span>
                  </div>
                </div>

                <div
                  className="flex cursor-pointer items-center gap-3 rounded-xl border border-border/60 bg-card p-3 transition-colors hover:bg-indigo-50/50"
                  onClick={() => setInstitutionOpen(true)}
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-indigo-100 to-violet-100 text-indigo-600">
                    <Building2 className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">{institution.name}</p>
                    <p className="text-xs text-muted-foreground">查看机构主页</p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {majorTags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="text-xs">
                      <GraduationCap className="mr-1 h-3 w-3" />
                      {tag}
                    </Badge>
                  ))}
                  {industryTags.map((tag) => (
                    <Badge key={tag} variant="outline" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                  {levelTags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                  {difficultyTags.map((tag) => (
                    <Badge key={tag} variant="outline" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>

                <Separator />

                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <TrendingUp className="h-4 w-4" />
                    销量 {resource.salesCount}
                  </span>
                </div>

                <div className="rounded-xl bg-gradient-to-br from-indigo-50 to-violet-50 p-5">
                  <p className="text-xs font-medium text-indigo-600">买断价格</p>
                  <div className="mt-1 flex items-baseline gap-2">
                    <span className="text-3xl font-bold text-indigo-700 md:text-4xl">
                      ¥{resource.price.toLocaleString()}
                    </span>
                    <span className="text-sm text-indigo-500">买断，永久使用</span>
                  </div>
                </div>

                {isPurchased ? (
                  <div className="space-y-3">
                    <Button disabled className="w-full gap-2" size="lg">
                      <CheckCircle className="h-5 w-5" />
                      已购买
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full gap-2"
                      size="lg"
                      onClick={handleDownload}
                    >
                      <Download className="h-5 w-5" />
                      下载附件
                    </Button>
                  </div>
                ) : canPurchase ? (
                  <Button
                    className="w-full gap-2"
                    size="lg"
                    onClick={() => router.push(`/resources/${resource.id}/checkout`)}
                  >
                    <ShoppingCart className="h-5 w-5" />
                    立即购买
                  </Button>
                ) : (
                  <Button disabled className="w-full" size="lg">
                    仅学校可采购
                  </Button>
                )}
              </CardContent>
            </Card>

            <Card className="rounded-2xl bg-gradient-to-br from-cyan-50 to-teal-50 border-cyan-100">
              <CardContent className="space-y-3 p-5">
                <h4 className="font-medium text-cyan-800">购买须知</h4>
                <ul className="space-y-2 text-sm text-cyan-700/80">
                  <li className="flex items-start gap-2">
                    <CheckCircle className="mt-0.5 h-4 w-4 text-cyan-600" />
                    支付成功后立即获得永久使用授权
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="mt-0.5 h-4 w-4 text-cyan-600" />
                    可无限次下载资源附件到私有化平台
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="mt-0.5 h-4 w-4 text-cyan-600" />
                    已购资源不受后续版本更新影响
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Institution Dialog */}
        <Dialog open={institutionOpen} onOpenChange={setInstitutionOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{institution.name}</DialogTitle>
              <DialogDescription>机构详情</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">机构类型</p>
                  <p className="text-foreground">{institution.type === "school" ? "学校" : "企业"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">机构编码</p>
                  <p className="font-mono text-foreground">{institution.orgCode}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">联系人</p>
                  <p className="text-foreground">{institution.contactName}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">联系电话</p>
                  <p className="text-foreground">{institution.contactPhone}</p>
                </div>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">机构简介</p>
                <p className="text-sm text-foreground">{institution.intro}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">擅长领域</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {institution.expertiseTags.map((tag) => (
                    <Badge key={tag} variant="secondary">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  )
}
