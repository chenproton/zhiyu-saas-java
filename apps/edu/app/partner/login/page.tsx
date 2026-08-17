'use client'

import { useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PasswordInput } from '@zhiyu/ui'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { AlertCircle, User, Lock, Building2, Phone, Mail, IdCard } from 'lucide-react'
import { partnerAuthApi, setToken, getDeviceId } from '@/lib/api'
import type { TenantOption } from '@/lib/api'
import { usePartnerAuth } from '@/components/partner-auth-provider'
import { useT } from '@/lib/i18n/locale-provider'
import CaptchaInput from '@/components/shared/captcha-input'

export default function PartnerLoginPage() {
  const t = useT()
  const router = useRouter()
  const { refresh } = usePartnerAuth()
  const [tab, setTab] = useState<'login' | 'register'>('login')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  // 多企业候选登录：账号关联多个企业时弹窗选择
  const [tenantOptions, setTenantOptions] = useState<TenantOption[]>([])
  const [preAuthToken, setPreAuthToken] = useState('')
  const [showTenantSelect, setShowTenantSelect] = useState(false)
  const [selectingTenant, setSelectingTenant] = useState(false)

  const [reg, setReg] = useState({
    enterpriseName: '',
    unifiedSocialCreditCode: '',
    contactPerson: '',
    contactPhone: '',
    contactEmail: '',
    username: '',
    password: '',
    confirmPassword: '',
  })

  // 防爆破验证码：后端返回 captcha_required 后展示，输入完成后随登录请求提交
  const [captchaRequired, setCaptchaRequired] = useState(false)
  const [captchaAnswer, setCaptchaAnswer] = useState<{ id: string; code: string } | null>(null)
  const [captchaVersion, setCaptchaVersion] = useState(0)

  const handleCaptchaPass = (captchaId: string, code: string) => {
    setCaptchaAnswer({ id: captchaId, code })
  }

  const refreshCaptcha = () => {
    setCaptchaVersion((v) => v + 1)
    setCaptchaAnswer(null)
  }

  const doLogin = async (token: string) => {
    setToken(token, 'partner')
    await refresh()
    router.replace('/partner/workspace')
  }

  const handleSelectTenant = async (tenantId: string) => {
    setSelectingTenant(true)
    try {
      const res = await partnerAuthApi.selectTenant({ preAuthToken, tenantId })
      await doLogin(res.token)
    } catch (err: any) {
      setError(err.message || t('选择企业失败'))
      setShowTenantSelect(false)
    } finally {
      setSelectingTenant(false)
    }
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (captchaRequired && !captchaAnswer) {
      setError(t('请先输入验证码'))
      return
    }

    setLoading(true)
    try {
      const res = await partnerAuthApi.login({
        username,
        password,
        deviceId: getDeviceId(),
        ...(captchaAnswer
          ? { captchaId: captchaAnswer.id, captchaCode: captchaAnswer.code }
          : {}),
      })
      if (res.needsTenantSelection && res.preAuthToken && res.tenants) {
        setTenantOptions(res.tenants)
        setPreAuthToken(res.preAuthToken)
        setShowTenantSelect(true)
        setLoading(false)
        return
      }
      await doLogin(res.token)
    } catch (err: any) {
      if (err?.code === 'captcha_required') {
        // 验证码已消费/过期：刷新验证码并清空已填字符（否则旧 id 永远校验失败）
        refreshCaptcha()
        setCaptchaRequired(true)
        setError(t('请先输入验证码后再登录'))
      } else if (err?.code === 'captcha_wrong') {
        refreshCaptcha()
        setError(t('验证码不正确，请重试'))
      } else {
        setError(err.message || t('登录失败'))
      }
      setLoading(false)
    }
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (reg.password !== reg.confirmPassword) {
      setError(t('两次输入的密码不一致'))
      return
    }
    setLoading(true)
    try {
      const res = await partnerAuthApi.register({
        enterpriseName: reg.enterpriseName,
        unifiedSocialCreditCode: reg.unifiedSocialCreditCode,
        contactPerson: reg.contactPerson,
        contactPhone: reg.contactPhone,
        contactEmail: reg.contactEmail || undefined,
        username: reg.username,
        password: reg.password,
      })
      await doLogin(res.token)
    } catch (err: any) {
      setError(err.message || t('注册失败'))
      setLoading(false)
    }
  }

  const setRegField = (field: string, value: string) => setReg({ ...reg, [field]: value })

  const errorView = error && (
    <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
      <AlertCircle className="h-4 w-4 shrink-0" />
      <span>{error}</span>
    </div>
  )

  return (
    <div className="relative flex min-h-screen items-start justify-center overflow-hidden bg-gradient-to-br from-[#f6f9ff] via-[#f7f9fc] to-[#eef3fb] p-4 pt-12 sm:pt-16">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -left-40 -top-40 h-[560px] w-[560px] rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -bottom-40 -right-40 h-[560px] w-[560px] rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute left-1/3 top-1/2 h-64 w-64 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute left-1/4 top-1/4 h-32 w-32 rounded-full bg-cyan-500/10 blur-2xl" />
      </div>

      <div className="relative w-full max-w-md">
        <div className="relative mb-8 flex flex-col items-center gap-4">
          <Image
            src="/logo.png?v=2"
            alt="知育"
            width={369}
            height={139}
            className="h-16 w-auto object-contain drop-shadow-sm"
          />
          <div className="flex flex-col items-center gap-1.5">
            <h1 className="bg-gradient-to-r from-primary via-primary to-primary/60 bg-clip-text text-2xl sm:text-[26px] font-bold tracking-wide text-transparent">
              {t('企业服务台')}
            </h1>
          </div>
        </div>

        <Card className="relative overflow-hidden rounded-2xl border border-[#e8ecf3] bg-white/95 shadow-[0_24px_70px_-28px] shadow-primary/25 backdrop-blur-xl">
          <div className="absolute left-0 right-0 top-0 h-1 bg-gradient-to-r from-primary via-primary/70 to-primary/30" />
          <CardContent className="px-6 py-8 sm:px-9 sm:py-9">
            <div className="mb-7 grid grid-cols-2 rounded-lg bg-slate-100 p-1 text-sm">
              <button
                type="button"
                onClick={() => {
                  setTab('login')
                  setError('')
                }}
                className={`rounded-md py-2 font-medium transition-all ${
                  tab === 'login' ? 'bg-white text-primary shadow-sm' : 'text-slate-500'
                }`}
              >
                {t('账号登录')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setTab('register')
                  setError('')
                }}
                className={`rounded-md py-2 font-medium transition-all ${
                  tab === 'register' ? 'bg-white text-primary shadow-sm' : 'text-slate-500'
                }`}
              >
                {t('企业注册')}
              </button>
            </div>

            {tab === 'login' ? (
              <form onSubmit={handleLogin} className="space-y-5">
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
                    <PasswordInput
                      id="password"
                      placeholder={t('请输入密码')}
                      className="h-11 rounded-lg border-slate-200 bg-slate-50/80 pl-10 text-sm transition-all placeholder:text-slate-400 hover:border-slate-300 focus-visible:border-primary/60 focus-visible:bg-white focus-visible:ring-primary/20"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="current-password"
                      required
                    />
                  </div>
                </div>

                {captchaRequired && (
                  <CaptchaInput
                    key={captchaVersion}
                    onPass={handleCaptchaPass}
                    onError={() => setCaptchaRequired(true)}
                  />
                )}

                {errorView}

                <Button
                  type="submit"
                  className="h-11 w-full rounded-lg bg-gradient-to-r from-primary via-primary to-primary/80 text-base shadow-lg shadow-primary/30 transition-all hover:-translate-y-px hover:shadow-xl hover:shadow-primary/30 active:translate-y-0 disabled:translate-y-0"
                  disabled={loading}
                  size="lg"
                >
                  {loading ? t('登录中...') : t('登 录')}
                </Button>
                <p className="text-center text-xs text-slate-400">
                  {t('忘记密码？请联系平台管理员重置。')}
                </p>
              </form>
            ) : (
              <form onSubmit={handleRegister} className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium text-slate-600">{t('企业名称')}</Label>
                  <div className="relative">
                    <Building2 className="absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-400" />
                    <Input
                      placeholder={t('请输入企业全称')}
                      className="h-10 rounded-lg border-slate-200 bg-slate-50/80 pl-10 text-sm"
                      value={reg.enterpriseName}
                      onChange={(e) => setRegField('enterpriseName', e.target.value)}
                      required
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium text-slate-600">
                    {t('统一社会信用代码')}
                  </Label>
                  <div className="relative">
                    <IdCard className="absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-400" />
                    <Input
                      placeholder={t('如：91320594MA1P7XXXX1')}
                      className="h-10 rounded-lg border-slate-200 bg-slate-50/80 pl-10 text-sm"
                      value={reg.unifiedSocialCreditCode}
                      onChange={(e) => setRegField('unifiedSocialCreditCode', e.target.value)}
                      required
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium text-slate-600">{t('联系人')}</Label>
                    <Input
                      placeholder={t('请输入联系人姓名')}
                      className="h-10 rounded-lg border-slate-200 bg-slate-50/80 text-sm"
                      value={reg.contactPerson}
                      onChange={(e) => setRegField('contactPerson', e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium text-slate-600">{t('手机号')}</Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <Input
                        placeholder={t('请输入手机号')}
                        className="h-10 rounded-lg border-slate-200 bg-slate-50/80 pl-9 text-sm"
                        value={reg.contactPhone}
                        onChange={(e) => setRegField('contactPhone', e.target.value)}
                        required
                      />
                    </div>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium text-slate-600">
                    {t('联系邮箱（选填）')}
                  </Label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-400" />
                    <Input
                      type="email"
                      placeholder={t('请输入联系邮箱')}
                      className="h-10 rounded-lg border-slate-200 bg-slate-50/80 pl-10 text-sm"
                      value={reg.contactEmail}
                      onChange={(e) => setRegField('contactEmail', e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium text-slate-600">{t('用户名')}</Label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-400" />
                    <Input
                      placeholder={t('设置登录用户名（同一账号可加入多个企业）')}
                      className="h-10 rounded-lg border-slate-200 bg-slate-50/80 pl-10 text-sm"
                      value={reg.username}
                      onChange={(e) => setRegField('username', e.target.value)}
                      autoComplete="username"
                      required
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium text-slate-600">{t('密码')}</Label>
                    <PasswordInput
                      placeholder={t('设置登录密码')}
                      className="h-10 rounded-lg border-slate-200 bg-slate-50/80 text-sm"
                      value={reg.password}
                      onChange={(e) => setRegField('password', e.target.value)}
                      autoComplete="new-password"
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium text-slate-600">{t('确认密码')}</Label>
                    <PasswordInput
                      placeholder={t('再次输入密码')}
                      className="h-10 rounded-lg border-slate-200 bg-slate-50/80 text-sm"
                      value={reg.confirmPassword}
                      onChange={(e) => setRegField('confirmPassword', e.target.value)}
                      autoComplete="new-password"
                      required
                    />
                  </div>
                </div>

                {errorView}

                <Button
                  type="submit"
                  className="h-11 w-full rounded-lg bg-gradient-to-r from-primary via-primary to-primary/80 text-base shadow-lg shadow-primary/30 transition-all hover:-translate-y-px hover:shadow-xl hover:shadow-primary/30 active:translate-y-0 disabled:translate-y-0"
                  disabled={loading}
                  size="lg"
                >
                  {loading ? t('注册中...') : t('注册并登录')}
                </Button>
                <p className="text-center text-xs text-slate-400">
                  {t('注册即创建企业管理员账号，无需审核，立即可用；同一用户名可加入多个企业')}
                </p>
              </form>
            )}
          </CardContent>
        </Card>

        <p className="mt-7 px-6 text-center text-xs leading-relaxed text-slate-400">
          {t(
            '版权所有 © 2020-2026 杭州知与未来科技有限公司 ｜ 软件著作权登记号：2020SR0123456 ｜ 京ICP备2025105397号-1',
          )}
        </p>
      </div>

      {/* 多企业候选登录：选择要登录的企业 */}
      <Dialog open={showTenantSelect} onOpenChange={setShowTenantSelect}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('选择企业')}</DialogTitle>
            <DialogDescription>{t('您的账号关联了多个企业，请选择要登录的企业')}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2 py-4">
            {tenantOptions.map((opt) => (
              <Button
                key={opt.tenantId}
                variant="outline"
                className="justify-start gap-3 h-auto py-4"
                onClick={() => handleSelectTenant(opt.tenantId)}
                disabled={selectingTenant}
              >
                <Building2 className="h-5 w-5 text-primary shrink-0" />
                <div className="text-left">
                  <div className="font-medium">{opt.tenantName}</div>
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
