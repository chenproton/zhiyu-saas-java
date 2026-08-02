'use client'

import { Bell, Lock, Mail, Phone, Shield, Smartphone, User, Award } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { FormFieldRow } from '@/components/shared/form-field-row'
import { Switch } from '@/components/ui/switch'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { SectionCard } from './section-card'
// 演示数据：以下 import 来自占位 mock 文件，后续应替换为真实 API（详见该文件头部说明）
import { mockStudentInfo } from '../_data/mock-student-data'

export function ProfileTab() {
  const formData = {
    name: mockStudentInfo.name,
    studentNo: mockStudentInfo.studentNo,
    phone: '138****8888',
    email: 'liming@example.edu.cn',
    major: mockStudentInfo.major,
    className: mockStudentInfo.className,
  }

  const honors = [
    { id: '1', name: '国家励志奖学金', issuer: '教育部', date: '2025-11', fileName: '' },
    { id: '2', name: '三好学生', issuer: '学校教务处', date: '2025-09', fileName: '' },
    {
      id: '3',
      name: '全国职业技能大赛省赛二等奖',
      issuer: '省教育厅',
      date: '2026-03',
      fileName: 'award_cert.pdf',
    },
    {
      id: '4',
      name: '华为HCIA-Datacom认证',
      issuer: '华为技术有限公司',
      date: '2025-12',
      fileName: 'hcia_cert.pdf',
    },
    {
      id: '5',
      name: '大学英语四级证书',
      issuer: '教育部考试中心',
      date: '2025-06',
      fileName: 'cet4.pdf',
    },
  ]

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
      label: '手机绑定',
      status: 'bound',
      statusText: '138****8888',
      action: '更换',
      icon: Smartphone,
    },
    { label: '邮箱绑定', status: 'bound', statusText: '已绑定', action: '更换', icon: Mail },
    { label: '微信绑定', status: 'unbound', statusText: '未绑定', action: '绑定', icon: Phone },
  ]

  return (
    <div className="space-y-5">
      <Tabs defaultValue="profile" className="w-full">
        <TabsList className="h-9 bg-white border border-gray-100 shadow-sm mb-4 p-1">
          <TabsTrigger
            value="profile"
            className="text-sm px-4 data-[state=active]:bg-blue-600 data-[state=active]:text-white"
          >
            个人资料
          </TabsTrigger>
          <TabsTrigger
            value="archive"
            className="text-sm px-4 data-[state=active]:bg-blue-600 data-[state=active]:text-white"
          >
            我的荣誉奖励
          </TabsTrigger>
          <TabsTrigger
            value="security"
            className="text-sm px-4 data-[state=active]:bg-blue-600 data-[state=active]:text-white"
          >
            账号安全
          </TabsTrigger>
          <TabsTrigger
            value="notifications"
            className="text-sm px-4 data-[state=active]:bg-blue-600 data-[state=active]:text-white"
          >
            通知偏好
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="mt-0">
          <SectionCard title="个人资料" icon={User} iconColor="blue">
            <div className="flex items-center gap-4 mb-6">
              <Avatar className="w-20 h-20">
                <AvatarFallback className="bg-blue-600 text-white text-2xl font-bold">
                  {mockStudentInfo.avatar}
                </AvatarFallback>
              </Avatar>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">{mockStudentInfo.name}</h3>
                <p className="text-sm text-gray-500">
                  {mockStudentInfo.grade} · {mockStudentInfo.major}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <FormFieldRow label="姓名" htmlFor="name" labelClassName="text-gray-700">
                <Input
                  id="name"
                  value={formData.name}
                  disabled
                  className="bg-gray-50 border-gray-100"
                />
              </FormFieldRow>
              <FormFieldRow label="学号" htmlFor="studentNo" labelClassName="text-gray-700">
                <Input
                  id="studentNo"
                  value={formData.studentNo}
                  disabled
                  className="bg-gray-50 border-gray-100"
                />
              </FormFieldRow>
              <FormFieldRow label="手机号" htmlFor="phone" labelClassName="text-gray-700">
                <Input
                  id="phone"
                  value={formData.phone}
                  disabled
                  className="bg-gray-50 border-gray-100"
                />
              </FormFieldRow>
              <FormFieldRow label="邮箱" htmlFor="email" labelClassName="text-gray-700">
                <Input
                  id="email"
                  value={formData.email}
                  disabled
                  className="bg-gray-50 border-gray-100"
                />
              </FormFieldRow>
              <FormFieldRow label="专业" htmlFor="major" labelClassName="text-gray-700">
                <Input
                  id="major"
                  value={formData.major}
                  disabled
                  className="bg-gray-50 border-gray-100"
                />
              </FormFieldRow>
              <FormFieldRow label="班级" htmlFor="className" labelClassName="text-gray-700">
                <Input
                  id="className"
                  value={formData.className}
                  disabled
                  className="bg-gray-50 border-gray-100"
                />
              </FormFieldRow>
            </div>
          </SectionCard>
        </TabsContent>

        <TabsContent value="archive" className="mt-0">
          <SectionCard title="我的荣誉奖励" icon={Award} iconColor="purple">
            <div className="space-y-4">
              <p className="text-xs text-gray-500">共 {honors.length} 项荣誉与证书</p>
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
                        {item.issuer} · {item.date}
                        {item.fileName ? ` · 附件：${item.fileName}` : ''}
                      </p>
                    </div>
                  </div>
                ))}
                {honors.length === 0 && (
                  <div className="py-8 text-center text-xs text-gray-400">暂无荣誉记录</div>
                )}
              </div>
            </div>
          </SectionCard>
        </TabsContent>

        <TabsContent value="security" className="mt-0">
          <SectionCard title="账号安全" icon={Shield} iconColor="rose">
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
                        <p className="text-sm font-medium text-gray-900">{item.label}</p>
                        <p
                          className={`text-xs ${
                            item.status === 'strong' || item.status === 'bound'
                              ? 'text-emerald-600'
                              : 'text-gray-400'
                          }`}
                        >
                          {item.statusText}
                        </p>
                      </div>
                    </div>
                    <span className="text-xs text-gray-400">{item.action}</span>
                  </div>
                )
              })}
            </div>
            <div className="mt-4 p-4 rounded-xl bg-rose-50 border border-rose-100">
              <p className="text-sm text-gray-900 flex items-center gap-2">
                <Shield className="w-4 h-4 text-rose-500" />
                <strong>安全建议</strong>
              </p>
              <p className="text-xs text-gray-500 mt-1">
                建议定期修改登录密码，开启二次验证，不要在公共设备上保存登录状态。
              </p>
            </div>
          </SectionCard>
        </TabsContent>

        <TabsContent value="notifications" className="mt-0">
          <SectionCard title="通知偏好" icon={Bell} iconColor="amber">
            <div className="space-y-6">
              <div>
                <h4 className="text-sm font-semibold text-gray-900 mb-3">学习通知</h4>
                <div className="space-y-3">
                  {[
                    {
                      key: 'course',
                      label: '课程任务提醒',
                      desc: '当有新的课程任务或作业截止时通知我',
                    },
                    {
                      key: 'exam',
                      label: '考试测评提醒',
                      desc: '当有新的考试安排或成绩发布时通知我',
                    },
                    {
                      key: 'scene',
                      label: '场景任务提醒',
                      desc: '当有新的场景任务或评分反馈时通知我',
                    },
                    {
                      key: 'position',
                      label: '岗位推荐通知',
                      desc: '当有匹配岗位或招聘活动上线时通知我',
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
                <h4 className="text-sm font-semibold text-gray-900 mb-3">通知渠道</h4>
                <div className="space-y-3">
                  {[
                    { key: 'system', label: '站内消息', desc: '在工作台消息中心接收通知' },
                    { key: 'email', label: '邮件通知', desc: '发送通知到绑定邮箱' },
                    { key: 'sms', label: '短信通知', desc: '发送通知到绑定手机' },
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
