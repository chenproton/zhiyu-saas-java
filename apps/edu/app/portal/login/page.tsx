'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { AlertCircle, User, Lock, Building2, History } from 'lucide-react'
import { authApi, setToken } from '@/lib/api'
import type { TenantOption } from '@/lib/api'
import { usePortalAuth } from '@/contexts/portal-auth-context'
import { useAuth } from '@/components/auth-provider'
import { useT } from '@/lib/i18n/locale-provider'
import { resolveActiveRole } from '@/lib/active-role'

function getPostLoginPath(roleCode?: string): string {
  switch (roleCode) {
    case 'school_admin':
      return '/portal/apps'
    case 'teacher':
    case 'student':
      return '/portal/workspace'
    default:
      return '/portal'
  }
}

export default function PortalLoginPage() {
  const t = useT()
  const router = useRouter()
  const { refresh } = usePortalAuth()
  const { refresh: refreshRootAuth } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [tenantOptions, setTenantOptions] = useState<TenantOption[]>([])
  const [preAuthToken, setPreAuthToken] = useState('')
  const [showTenantSelect, setShowTenantSelect] = useState(false)
  const [selectingTenant, setSelectingTenant] = useState(false)

  const doLogin = async (token: string) => {
    setToken(token, 'portal')
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
      setError(err.message || t('选择租户失败'))
      setShowTenantSelect(false)
    } finally {
      setSelectingTenant(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
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
      setError(err.message || t('登录失败'))
      setLoading(false)
    }
  }

  return (
    <div className="relative flex min-h-screen items-start justify-center overflow-hidden bg-gradient-to-br from-[#f6f9ff] via-[#f7f9fc] to-[#eef3fb] p-4 pt-12 sm:pt-16">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -left-40 -top-40 h-[560px] w-[560px] rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -bottom-40 -right-40 h-[560px] w-[560px] rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute left-1/3 top-1/2 h-64 w-64 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute left-1/4 top-1/4 h-32 w-32 rounded-full bg-cyan-500/10 blur-2xl" />
        <svg
          className="absolute left-1/3 top-1/3 h-96 w-96 text-primary/5"
          viewBox="0 0 200 200"
          fill="none"
        >
          <polygon points="100,0 200,100 100,200 0,100" />
        </svg>
        <svg
          className="absolute bottom-1/4 right-1/4 h-48 w-48 text-primary/5"
          viewBox="0 0 200 200"
          fill="none"
        >
          <polygon points="100,20 180,100 100,180 20,100" />
        </svg>
      </div>

      <div className="relative w-full max-w-md">
        <div className="relative mb-8 flex flex-col items-center gap-4">
          <div className="absolute right-0 top-0">
            <Link
              href="/changelog"
              title={t('查看平台更新记录')}
              className="group flex items-center gap-0 rounded-full border border-[#e6ebf3] bg-white/80 px-2.5 py-1.5 text-xs text-[#8a94a6] shadow-sm backdrop-blur transition-all hover:gap-1 hover:border-primary/30 hover:bg-white hover:text-primary"
            >
              <History className="h-3.5 w-3.5 shrink-0" />
              <span className="max-w-0 overflow-hidden whitespace-nowrap opacity-0 transition-all duration-200 group-hover:max-w-[8rem] group-hover:opacity-100">
                {t('查看平台更新记录')}
              </span>
            </Link>
          </div>
          <Image
            src="/logo.png"
            alt="知育"
            width={369}
            height={139}
            className="h-16 w-auto object-contain drop-shadow-sm"
          />
          <div className="flex flex-col items-center gap-1.5">
            <h1 className="bg-gradient-to-r from-primary via-primary to-primary/60 bg-clip-text text-2xl sm:text-[26px] font-bold tracking-wide text-transparent">
              {t('场景化数智教学服务平台')}
            </h1>
            <p className="text-sm tracking-[0.35em] text-[#98a2b3] pl-[0.35em]">
              {t('数智融合 · 精准教学')}
            </p>
          </div>
        </div>

        <Card className="relative overflow-hidden rounded-2xl border border-[#e8ecf3] bg-white/95 shadow-[0_24px_70px_-28px] shadow-primary/25 backdrop-blur-xl">
          <div className="absolute left-0 right-0 top-0 h-1 bg-gradient-to-r from-primary via-primary/70 to-primary/30" />
          <CardContent className="px-6 py-8 sm:px-9 sm:py-9">
            <div className="mb-7 flex flex-col items-center gap-1.5">
              <h2 className="text-lg font-semibold text-[#333]">{t('账号登录')}</h2>
              <p className="text-xs text-[#98a2b3]">{t('使用学校分配的账号登录系统')}</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-1.5">
                <Label htmlFor="username" className="text-sm font-medium text-slate-600">
                  {t('账号')}
                </Label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-400" />
                  <Input
                    id="username"
                    placeholder={t('请输入账号')}
                    className="h-11 rounded-lg border-slate-200 bg-slate-50/80 pl-10 text-sm transition-all placeholder:text-slate-400 hover:border-slate-300 focus-visible:border-primary/60 focus-visible:bg-white focus-visible:ring-primary/20"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    autoComplete="username"
                    required
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-sm font-medium text-slate-600">
                  {t('密码')}
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-400" />
                  <Input
                    id="password"
                    type="password"
                    placeholder={t('请输入密码')}
                    className="h-11 rounded-lg border-slate-200 bg-slate-50/80 pl-10 text-sm transition-all placeholder:text-slate-400 hover:border-slate-300 focus-visible:border-primary/60 focus-visible:bg-white focus-visible:ring-primary/20"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    required
                  />
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <Button
                type="submit"
                className="h-11 w-full rounded-lg bg-gradient-to-r from-primary via-primary to-primary/80 text-base shadow-lg shadow-primary/30 transition-all hover:-translate-y-px hover:shadow-xl hover:shadow-primary/30 active:translate-y-0 disabled:translate-y-0"
                disabled={loading}
                size="lg"
              >
                {loading ? t('登录中...') : t('登 录')}
              </Button>
            </form>

            {process.env.NODE_ENV !== 'production' && (
              <div className="mt-6 rounded-xl border border-dashed border-[#e6ebf3] bg-[#fafbfc] p-3.5 text-xs text-slate-400">
                <p className="mb-1 font-medium text-slate-500">
                  {t('测试账号（仅开发环境显示）：')}
                </p>
                <ul className="space-y-0.5">
                  <li>{t('学校管理员：school / school123')}</li>
                  <li>{t('教师：teacher / teacher123')}</li>
                  <li>{t('学生：student / student123')}</li>
                </ul>
              </div>
            )}
          </CardContent>
        </Card>

        <p className="mt-7 px-6 text-center text-xs leading-relaxed text-slate-400">
          {t('版权所有 © 2020-2026 杭州知与未来科技有限公司 ｜ 软件著作权登记号：2020SR0123456 ｜ 京ICP备2025105397号-1')}
        </p>
      </div>

      <Dialog open={showTenantSelect} onOpenChange={setShowTenantSelect}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('选择租户')}</DialogTitle>
            <DialogDescription>{t('您的账号关联了多个学校，请选择要登录的学校')}</DialogDescription>
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
