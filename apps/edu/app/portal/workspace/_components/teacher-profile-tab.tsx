'use client'

import { Bell, Shield, User } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { FormFieldRow, FormFieldGrid } from '@/components/shared/form-field-row'
import { Switch } from '@/components/ui/switch'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { SectionCard } from './section-card'
import { AccountInfoForm } from './account-info-form'
import { ChangePasswordForm } from './change-password-form'
import { usePortalAuth } from '@/contexts/portal-auth-context'
import { useT } from '@/lib/i18n/locale-provider'
// 演示数据：以下 import 来自占位 mock 文件，后续应替换为真实 API（详见该文件头部说明）
import { teacherSecurityItems } from '../_data/workspace-teacher-types'

export function TeacherProfileTab() {
  const { user, major, orgNode } = usePortalAuth()
  const t = useT()

  const notifications = {
    course: true,
    exam: true,
    teaching: true,
    system: true,
    email: true,
    sms: false,
  }

  const readOnlyFields = [
    { label: t('工号'), value: user?.workId || '—' },
    { label: t('所属部门'), value: orgNode?.name || '—' },
    { label: t('专业'), value: major?.name || '—' },
    { label: t('手机号'), value: user?.phone || '—' },
    { label: t('邮箱'), value: user?.email || '—' },
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
            <div className="flex items-center gap-4 mb-8 pb-6 border-b border-gray-100">
              <Avatar className="w-20 h-20 ring-4 ring-white shadow-md">
                <AvatarFallback className="bg-gradient-to-br from-primary to-primary/70 text-white text-2xl font-bold">
                  {user?.name?.charAt(0)?.toUpperCase() || 'U'}
                </AvatarFallback>
              </Avatar>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">{user?.name || '—'}</h3>
                <p className="text-sm text-gray-500">
                  {[orgNode?.name, major?.name].filter(Boolean).join(' · ') || t('暂无身份信息')}
                </p>
              </div>
            </div>

            <div className="space-y-6">
              <AccountInfoForm />

              <div className="border-t border-gray-100 pt-5">
                <p className="text-sm font-medium text-gray-900 mb-3">
                  {t('其它信息（不可修改）')}
                </p>
                <FormFieldGrid cols={3}>
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

        <TabsContent value="security" className="mt-0">
          <SectionCard title={t('账号安全')} icon={Shield} iconColor="rose">
            <div className="space-y-5">
              <div className="p-4 rounded-xl border border-gray-100 bg-white">
                <p className="text-sm font-medium text-gray-900 mb-3">{t('修改密码')}</p>
                <ChangePasswordForm />
              </div>
              <div className="space-y-3">
                {teacherSecurityItems.map((item, index) => {
                  // 图标由数据条目自带（item.icon），不再依赖数组下标推导
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
                            className={`text-xs ${item.status === 'strong' || item.status === 'bound' ? 'text-emerald-600' : 'text-gray-400'}`}
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
                  {t('建议定期修改登录密码，教师账号涉及成绩管理等敏感操作，请务必确保账号安全。')}
                </p>
              </div>
            </div>
          </SectionCard>
        </TabsContent>

        <TabsContent value="notifications" className="mt-0">
          <SectionCard title={t('通知偏好')} icon={Bell} iconColor="amber">
            <div className="space-y-6">
              <div>
                <h4 className="text-sm font-semibold text-gray-900 mb-3">{t('教学通知')}</h4>
                <div className="space-y-3">
                  {[
                    {
                      key: 'course',
                      label: t('课程动态提醒'),
                      desc: t('当学生提交作业或课程有新进展时通知我'),
                    },
                    {
                      key: 'exam',
                      label: t('考试与成绩提醒'),
                      desc: t('当考试安排变动或成绩需要录入时通知我'),
                    },
                    {
                      key: 'teaching',
                      label: t('教学管理通知'),
                      desc: t('当有新的教学安排、教务通知时通知我'),
                    },
                    {
                      key: 'system',
                      label: t('系统维护通知'),
                      desc: t('当系统有更新维护时有新通知时提醒'),
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
                    { key: 'email', label: t('邮件通知'), desc: t('发送通知到绑定邮箱') },
                    {
                      key: 'sms',
                      label: t('短信通知'),
                      desc: t('发送通知到绑定手机（紧急事项）'),
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
            </div>
          </SectionCard>
        </TabsContent>
      </Tabs>
    </div>
  )
}
