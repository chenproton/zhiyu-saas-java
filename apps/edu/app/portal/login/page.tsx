"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { AlertCircle, GraduationCap, User, Lock, MessageCircle, QrCode, Building2 } from "lucide-react"
import { authApi, setToken } from "@/lib/api"
import type { TenantOption } from "@/lib/api"
import { usePortalAuth } from "@/contexts/portal-auth-context"
import { useAuth } from "@/components/auth-provider"
import { resolveActiveRole } from "@/lib/active-role"

function getPostLoginPath(roleCode?: string): string {
  switch (roleCode) {
    case "school_admin":
      return "/portal/apps"
    case "teacher":
    case "student":
      return "/portal/workspace"
    default:
      return "/portal"
  }
}

type LoginMethod = "password" | "sms" | "wechat"

const methodTabs: { key: LoginMethod; label: string; icon: typeof MessageCircle }[] = [
  { key: "password", label: "账号密码", icon: Lock },
  { key: "sms", label: "短信登录", icon: MessageCircle },
  { key: "wechat", label: "微信扫码", icon: QrCode },
]

export default function PortalLoginPage() {
  const router = useRouter()
  const { refresh } = usePortalAuth()
  const { refresh: refreshRootAuth } = useAuth()
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [loginMethod, setLoginMethod] = useState<LoginMethod>("password")
  const [tenantOptions, setTenantOptions] = useState<TenantOption[]>([])
  const [preAuthToken, setPreAuthToken] = useState("")
  const [showTenantSelect, setShowTenantSelect] = useState(false)
  const [selectingTenant, setSelectingTenant] = useState(false)

  const doLogin = async (token: string) => {
    setToken(token, "portal")
    await Promise.all([refresh(), refreshRootAuth()])
    const me = await authApi.portalMe()
    const activeRole = resolveActiveRole(me.user?.id, me.roles)
    router.replace(getPostLoginPath(activeRole?.code))
  }

  const handleSelectTenant = async (tenantId: string) => {
    setSelectingTenant(true)
    try {
      const res = await authApi.selectTenant({ preAuthToken, tenantId })
      await doLogin(res.token)
    } catch (err: any) {
      setError(err.message || "选择租户失败")
      setShowTenantSelect(false)
    } finally {
      setSelectingTenant(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (loginMethod !== "password") return
    setError("")
    setLoading(true)

    try {
      const res = await authApi.portalLogin({ username, password })
      if (res.needsTenantSelection && res.preAuthToken && res.tenants) {
        setTenantOptions(res.tenants)
        setPreAuthToken(res.preAuthToken)
        setShowTenantSelect(true)
        setLoading(false)
        return
      }
      await doLogin(res.token)
    } catch (err: any) {
      setError(err.message || "登录失败")
      setLoading(false)
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 p-4">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -left-32 -top-32 h-[500px] w-[500px] rounded-full bg-indigo-500/10 blur-3xl" />
        <div className="absolute -bottom-32 -right-32 h-[500px] w-[500px] rounded-full bg-purple-500/10 blur-3xl" />
        <div className="absolute left-1/3 top-1/2 h-64 w-64 rounded-full bg-blue-500/5 blur-3xl" />
        <div className="absolute left-1/4 top-1/4 h-32 w-32 rounded-full bg-cyan-500/10 blur-2xl" />
        <svg className="absolute left-1/3 top-1/3 h-96 w-96 text-indigo-500/5" viewBox="0 0 200 200" fill="none">
          <polygon points="100,0 200,100 100,200 0,100" />
        </svg>
        <svg className="absolute bottom-1/4 right-1/4 h-48 w-48 text-purple-500/5" viewBox="0 0 200 200" fill="none">
          <polygon points="100,20 180,100 100,180 20,100" />
        </svg>
      </div>

      <div className="relative w-full max-w-md">
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-500/30 ring-1 ring-white/20">
            <GraduationCap className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">场景化数智教学服务平台</h1>
          <p className="text-sm text-indigo-200/60">数智融合 · 精准教学</p>
        </div>

        <Card className="border-0 bg-white/95 shadow-2xl shadow-black/20 backdrop-blur-xl">
          <CardContent className="px-8 py-8">
            <div className="mb-6 flex rounded-lg bg-slate-100 p-1">
              {methodTabs.map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  type="button"
                  disabled={key !== "password"}
                  onClick={() => setLoginMethod(key)}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-all ${
                    loginMethod === key
                      ? "bg-white text-indigo-700 shadow-sm"
                      : "text-slate-500 hover:text-slate-700"
                  } ${key !== "password" ? "cursor-not-allowed opacity-60" : ""}`}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </button>
              ))}
            </div>

            {loginMethod === "password" ? (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="username" className="text-sm font-medium text-slate-700">账号</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input
                      id="username"
                      placeholder="请输入账号"
                      className="border-slate-200 pl-10 focus-visible:border-indigo-400 focus-visible:ring-indigo-400/20"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-sm font-medium text-slate-700">密码</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input
                      id="password"
                      type="password"
                      placeholder="请输入密码"
                      className="border-slate-200 pl-10 focus-visible:border-indigo-400 focus-visible:ring-indigo-400/20"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                  </div>
                </div>

                {error && (
                  <div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    {error}
                  </div>
                )}

                <Button
                  type="submit"
                  className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 py-2.5 text-base shadow-lg shadow-indigo-600/25 hover:from-indigo-700 hover:to-purple-700"
                  disabled={loading}
                  size="lg"
                >
                  {loading ? "登录中..." : "登 录"}
                </Button>
              </form>
            ) : loginMethod === "sms" ? (
              <div className="py-8 text-center text-sm text-slate-400">
                <MessageCircle className="mx-auto mb-3 h-10 w-10 text-slate-300" />
                <p>短信登录功能开发中</p>
              </div>
            ) : (
              <div className="py-8 text-center text-sm text-slate-400">
                <QrCode className="mx-auto mb-3 h-10 w-10 text-slate-300" />
                <p>微信扫码登录功能开发中</p>
              </div>
            )}

            <div className="mt-6 rounded-lg bg-slate-50 p-3 text-xs text-slate-400">
              <p className="mb-1 font-medium text-slate-500">测试账号：</p>
              <ul className="space-y-0.5">
                <li>学校管理员：school / school123</li>
                <li>教师：teacher / teacher123</li>
                <li>学生：student / student123</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        <p className="mt-6 text-center text-xs text-indigo-200/40">
          © {new Date().getFullYear()} 场景化数智教学服务平台 All Rights Reserved
        </p>
      </div>

      <Dialog open={showTenantSelect} onOpenChange={setShowTenantSelect}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>选择租户</DialogTitle>
            <DialogDescription>
              您的账号关联了多个学校，请选择要登录的学校
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2 py-4">
            {tenantOptions.map((t) => (
              <Button
                key={t.tenantId}
                variant="outline"
                className="justify-start gap-3 h-auto py-4"
                onClick={() => handleSelectTenant(t.tenantId)}
                disabled={selectingTenant}
              >
                <Building2 className="h-5 w-5 text-primary shrink-0" />
                <div className="text-left">
                  <div className="font-medium">{t.tenantName}</div>
                  <div className="text-xs text-muted-foreground">{t.tenantId}</div>
                </div>
              </Button>
            ))}
          </div>
          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
