'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  Bell,
  Mail,
  Phone,
  Shield,
  Smartphone,
  User,
  Award,
  Pencil,
  Trash2,
  Loader2,
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { FormFieldRow, FormFieldGrid } from '@/components/shared/form-field-row'
import { Switch } from '@/components/ui/switch'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { SectionCard } from './section-card'
import { AccountInfoForm } from './account-info-form'
import { ChangePasswordForm } from './change-password-form'
import { usePortalAuth } from '@/contexts/portal-auth-context'
import { studentHonorApi, fileApi } from '@/lib/api'
import { toast, FormDialogFooter } from '@zhiyu/ui'
import type { StudentHonor } from '@/lib/types'
import { useT } from '@/lib/i18n/locale-provider'

interface ProfileTabProps {
  /** student：学生个人中心（含荣誉奖励）；staff：学校管理员（无荣誉奖励，展示机构/工号） */
  variant?: 'student' | 'staff'
}

interface HonorForm {
  name: string
  issuer: string
  honorDate: string
  fileName: string
  fileUrl: string
}

const emptyForm: HonorForm = { name: '', issuer: '', honorDate: '', fileName: '', fileUrl: '' }

/** 手机号脱敏：长号码保留前 3 后 4；短号码（<8 位）仅保留首尾各 1 位，避免遮蔽段重叠泄露 */
function maskPhone(phone: string): string {
  if (phone.length <= 4) return '*'.repeat(phone.length)
  if (phone.length < 8) {
    return `${phone.slice(0, 1)}${'*'.repeat(phone.length - 2)}${phone.slice(-1)}`
  }
  return `${phone.slice(0, 3)}****${phone.slice(-4)}`
}

export function ProfileTab({ variant = 'student' }: ProfileTabProps) {
  const { user, major, orgNode, institution } = usePortalAuth()
  const t = useT()
  const isStaff = variant === 'staff'

  const [honors, setHonors] = useState<StudentHonor[]>([])
  const [honorsLoading, setHonorsLoading] = useState(true)
  const [honorDialogOpen, setHonorDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<HonorForm>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const loadHonors = useCallback(async () => {
    setHonorsLoading(true)
    try {
      const res = await studentHonorApi.list()
      setHonors(res.items || [])
    } catch {
      setHonors([])
    } finally {
      setHonorsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (isStaff) return
    // 复用 loadHonors，避免重复实现同一拉取逻辑（微任务调度，避免 effect 内同步 setState）
    queueMicrotask(() => {
      void loadHonors()
    })
  }, [isStaff, loadHonors])

  const openCreate = () => {
    setEditingId(null)
    setForm(emptyForm)
    setHonorDialogOpen(true)
  }

  const openEdit = (item: StudentHonor) => {
    setEditingId(item.id)
    setForm({
      name: item.name,
      issuer: item.issuer || '',
      honorDate: item.honorDate || '',
      fileName: item.fileName || '',
      fileUrl: item.fileUrl || '',
    })
    setHonorDialogOpen(true)
  }

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const res = await fileApi.upload(file)
      setForm((f) => ({ ...f, fileName: res.name, fileUrl: res.url }))
    } catch {
      // 上传失败保持原状
    } finally {
      setUploading(false)
    }
  }

  const handleSave = async () => {
    if (!form.name.trim()) return
    setSaving(true)
    try {
      if (editingId) {
        await studentHonorApi.update(editingId, form)
      } else {
        await studentHonorApi.create(form)
      }
      setHonorDialogOpen(false)
      await loadHonors()
    } catch (err) {
      // 保存失败保持弹窗并提示
      toast({
        variant: 'destructive',
        title: t('保存失败'),
        description: err instanceof Error ? err.message : t('请稍后重试'),
      })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    setDeletingId(id)
    try {
      await studentHonorApi.remove(id)
      setHonors((list) => list.filter((h) => h.id !== id))
    } catch (err) {
      // 删除失败提示
      toast({
        variant: 'destructive',
        title: t('删除失败'),
        description: err instanceof Error ? err.message : t('请稍后重试'),
      })
    } finally {
      setDeletingId(null)
    }
  }

  const notifications = {
    course: true,
    exam: true,
    scene: true,
    position: false,
    system: true,
    email: true,
    sms: false,
  }

  const securityItems = [
    {
      label: t('手机绑定'),
      status: 'bound',
      statusText: user?.phone ? maskPhone(user.phone) : t('未绑定'),
      action: user?.phone ? t('更换') : t('绑定'),
      icon: Smartphone,
    },
    {
      label: t('邮箱绑定'),
      status: user?.email ? 'bound' : 'unbound',
      statusText: user?.email ? t('已绑定') : t('未绑定'),
      action: user?.email ? t('更换') : t('绑定'),
      icon: Mail,
    },
    {
      label: t('微信绑定'),
      status: 'unbound',
      statusText: t('未绑定'),
      action: t('绑定'),
      icon: Phone,
    },
  ]

  const readOnlyFields = isStaff
    ? [
        { label: t('工号'), value: user?.workId || '—' },
        { label: t('所属机构'), value: institution?.name || '—' },
        { label: t('手机号'), value: user?.phone || '—' },
        { label: t('邮箱'), value: user?.email || '—' },
      ]
    : [
        { label: t('学号'), value: user?.studentNo || '—' },
        { label: t('手机号'), value: user?.phone || '—' },
        { label: t('邮箱'), value: user?.email || '—' },
        { label: t('专业'), value: major?.name || '—' },
        { label: t('班级'), value: orgNode?.name || '—' },
      ]

  return (
    <div className="space-y-5">
      <Tabs defaultValue="profile" className="w-full">
        <TabsList className="h-9 bg-white border border-gray-100 shadow-sm mb-4 p-1">
          <TabsTrigger
            value="profile"
            className="text-sm px-4 data-[state=active]:bg-primary data-[state=active]:text-white"
          >
            {t('个人资料')}
          </TabsTrigger>
          {!isStaff && (
            <TabsTrigger
              value="archive"
              className="text-sm px-4 data-[state=active]:bg-primary data-[state=active]:text-white"
            >
              {t('我的荣誉奖励')}
            </TabsTrigger>
          )}
          <TabsTrigger
            value="security"
            className="text-sm px-4 data-[state=active]:bg-primary data-[state=active]:text-white"
          >
            {t('账号安全')}
          </TabsTrigger>
          <TabsTrigger
            value="notifications"
            className="text-sm px-4 data-[state=active]:bg-primary data-[state=active]:text-white"
          >
            {t('通知偏好')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="mt-0">
          <SectionCard title={t('个人资料')} icon={User} iconColor="blue">
            <div className="flex items-center gap-4 mb-6">
              <Avatar className="w-20 h-20">
                <AvatarFallback className="bg-primary text-white text-2xl font-bold">
                  {user?.name?.charAt(0)?.toUpperCase() || 'U'}
                </AvatarFallback>
              </Avatar>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">{user?.name || '—'}</h3>
                <p className="text-sm text-gray-500">
                  {isStaff
                    ? [orgNode?.name, institution?.name].filter(Boolean).join(' · ') ||
                      t('暂无身份信息')
                    : [major?.name, orgNode?.name].filter(Boolean).join(' · ') || t('暂无身份信息')}
                </p>
              </div>
            </div>

            <div className="space-y-6">
              <AccountInfoForm />

              <div className="border-t border-gray-100 pt-5">
                <p className="text-sm font-medium text-gray-900 mb-3">
                  {t('其它信息（不可修改）')}
                </p>
                <FormFieldGrid>
                  {readOnlyFields.map((field) => (
                    <FormFieldRow
                      key={field.label}
                      label={field.label}
                      labelClassName="text-gray-700"
                    >
                      <Input value={field.value} disabled className="bg-gray-50 border-gray-100" />
                    </FormFieldRow>
                  ))}
                </FormFieldGrid>
              </div>
            </div>
          </SectionCard>
        </TabsContent>

        {!isStaff && (
          <TabsContent value="archive" className="mt-0">
            <SectionCard
              title={t('我的荣誉奖励')}
              icon={Award}
              iconColor="purple"
              action={{ label: t('添加荣誉'), onClick: openCreate }}
            >
              <div className="space-y-4">
                <p className="text-xs text-gray-500">
                  {t('共 {count} 项荣誉与证书', { count: honors.length })}
                </p>
                {honorsLoading ? (
                  <div className="py-8 text-center text-xs text-gray-400">{t('加载中...')}</div>
                ) : (
                  <div className="space-y-2">
                    {honors.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center gap-3 p-3 rounded-lg border border-gray-100 bg-white"
                      >
                        <div className="w-9 h-9 rounded-lg bg-amber-50 flex items-center justify-center shrink-0">
                          <Award className="w-4 h-4 text-amber-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{item.name}</p>
                          <p className="text-xs text-gray-500 truncate">
                            {item.issuer}
                            {item.honorDate ? ` · ${item.honorDate}` : ''}
                            {item.fileName
                              ? ` · ${t('附件：{fileName}', { fileName: item.fileName })}`
                              : ''}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0"
                            onClick={() => openEdit(item)}
                          >
                            <Pencil className="w-3.5 h-3.5 text-gray-400" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0"
                            disabled={deletingId === item.id}
                            onClick={() => handleDelete(item.id)}
                          >
                            {deletingId === item.id ? (
                              <Loader2 className="w-3.5 h-3.5 text-gray-400 animate-spin" />
                            ) : (
                              <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                            )}
                          </Button>
                        </div>
                      </div>
                    ))}
                    {honors.length === 0 && (
                      <div className="py-8 text-center text-xs text-gray-400">
                        {t('暂无荣誉记录，点击上方按钮配置')}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </SectionCard>
          </TabsContent>
        )}

        <TabsContent value="security" className="mt-0">
          <SectionCard title={t('账号安全')} icon={Shield} iconColor="rose">
            <div className="space-y-5">
              <div className="p-4 rounded-xl border border-gray-100 bg-white">
                <p className="text-sm font-medium text-gray-900 mb-3">{t('修改密码')}</p>
                <ChangePasswordForm />
              </div>
              <div className="space-y-3">
                {securityItems.map((item, index) => {
                  const Icon = item.icon
                  return (
                    <div
                      key={index}
                      className="flex items-center justify-between p-4 rounded-xl border border-gray-100 bg-white"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center">
                          <Icon className="w-5 h-5 text-gray-500" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{t(item.label)}</p>
                          <p
                            className={`text-xs ${
                              item.status === 'strong' || item.status === 'bound'
                                ? 'text-emerald-600'
                                : 'text-gray-400'
                            }`}
                          >
                            {t(item.statusText)}
                          </p>
                        </div>
                      </div>
                      <span className="text-xs text-gray-400">{t(item.action)}</span>
                    </div>
                  )
                })}
              </div>
              <div className="p-4 rounded-xl bg-rose-50 border border-rose-100">
                <p className="text-sm text-gray-900 flex items-center gap-2">
                  <Shield className="w-4 h-4 text-rose-500" />
                  <strong>{t('安全建议')}</strong>
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {t('建议定期修改登录密码，开启二次验证，不要在公共设备上保存登录状态。')}
                </p>
              </div>
            </div>
          </SectionCard>
        </TabsContent>

        <TabsContent value="notifications" className="mt-0">
          <SectionCard title={t('通知偏好')} icon={Bell} iconColor="amber">
            <div className="space-y-6">
              <div>
                <h4 className="text-sm font-semibold text-gray-900 mb-3">{t('学习通知')}</h4>
                <div className="space-y-3">
                  {[
                    {
                      key: 'course',
                      label: t('课程任务提醒'),
                      desc: t('当有新的课程任务或作业截止时通知我'),
                    },
                    {
                      key: 'exam',
                      label: t('考试测评提醒'),
                      desc: t('当有新的考试安排或成绩发布时通知我'),
                    },
                    {
                      key: 'scene',
                      label: t('场景任务提醒'),
                      desc: t('当有新的场景任务或评分反馈时通知我'),
                    },
                    {
                      key: 'position',
                      label: t('岗位推荐通知'),
                      desc: t('当有匹配岗位或招聘活动上线时通知我'),
                    },
                  ].map((item) => (
                    <div
                      key={item.key}
                      className="flex items-center justify-between p-3 rounded-xl bg-gray-50"
                    >
                      <div>
                        <p className="text-sm text-gray-900 font-medium">{item.label}</p>
                        <p className="text-xs text-gray-500">{item.desc}</p>
                      </div>
                      <Switch
                        checked={notifications[item.key as keyof typeof notifications]}
                        disabled
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t border-gray-100 pt-4">
                <h4 className="text-sm font-semibold text-gray-900 mb-3">{t('通知渠道')}</h4>
                <div className="space-y-3">
                  {[
                    { key: 'system', label: t('站内消息'), desc: t('在工作台消息中心接收通知') },
                    { key: 'email', label: t('邮件通知'), desc: t('发送通知到绑定邮箱') },
                    { key: 'sms', label: t('短信通知'), desc: t('发送通知到绑定手机') },
                  ].map((item) => (
                    <div
                      key={item.key}
                      className="flex items-center justify-between p-3 rounded-xl bg-gray-50"
                    >
                      <div>
                        <p className="text-sm text-gray-900 font-medium">{item.label}</p>
                        <p className="text-xs text-gray-500">{item.desc}</p>
                      </div>
                      <Switch
                        checked={notifications[item.key as keyof typeof notifications]}
                        disabled
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </SectionCard>
        </TabsContent>
      </Tabs>

      {/* 荣誉添加/编辑弹窗 */}
      <Dialog open={honorDialogOpen} onOpenChange={setHonorDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? t('编辑荣誉') : t('添加荣誉')}</DialogTitle>
            <DialogDescription>
              {t('荣誉名称与颁发机构为必填项，可上传证书附件。')}
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              handleSave()
            }}
            className="grid gap-4"
          >
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-sm">{t('荣誉名称 *')}</Label>
              <Input
                value={form.name}
                placeholder={t('如：国家励志奖学金')}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">{t('颁发机构')}</Label>
              <Input
                value={form.issuer}
                placeholder={t('如：教育部')}
                onChange={(e) => setForm((f) => ({ ...f, issuer: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">{t('获得日期')}</Label>
              <Input
                value={form.honorDate}
                placeholder={t('如：2025-11')}
                onChange={(e) => setForm((f) => ({ ...f, honorDate: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">{t('证书附件')}</Label>
              <div className="flex items-center gap-2">
                <input
                  type="file"
                  className="text-xs text-gray-500 file:mr-2 file:rounded-md file:border-0 file:bg-primary/5 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-primary hover:file:bg-primary/10"
                  onChange={handleUpload}
                  disabled={uploading}
                />
                {uploading && <Loader2 className="w-4 h-4 text-primary animate-spin" />}
              </div>
              {form.fileName && (
                <p className="text-xs text-gray-400 truncate">
                  {t('已上传：{fileName}', { fileName: form.fileName })}
                </p>
              )}
            </div>
          </div>
          <FormDialogFooter
            onCancel={() => setHonorDialogOpen(false)}
            confirmText={t('保存')}
            cancelText={t('取消')}
            confirmDisabled={!form.name.trim()}
            loading={saving}
          />
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
