'use client'

import { Bell, Lock, Mail, Phone, Shield, Smartphone, User } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { FormFieldRow } from '@/components/shared/form-field-row'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { SectionCard } from './section-card'
// 演示数据：以下 import 来自占位 mock 文件，后续应替换为真实 API（详见该文件头部说明）
import { mockTeacherInfo, teacherSecurityItems } from '../_data/workspace-teacher-types'

export function TeacherProfileTab() {
  const formData = {
    name: mockTeacherInfo.name,
    teacherNo: mockTeacherInfo.teacherNo,
    phone: '138****6666',
    email: 'zhang@example.edu.cn',
    department: mockTeacherInfo.department,
    title: mockTeacherInfo.title,
    gender: '男',
    age: '42',
    city: '北京市',
    position: '网络技术专业负责人',
    workYears: '18',
    education: '博士研究生 · 北京邮电大学',
    researchAreas: '网络架构、网络安全、云计算技术',
    businessDirection: '计算机网络技术专业建设、校企合作实训基地建设',
    bio: '从事计算机网络技术教学与研究18年，主持完成省部级教改项目3项，发表学术论文20余篇。多次指导学生参加全国职业技能大赛获一等奖。',
    experience:
      '2006-2010  华为技术有限公司  网络工程师\n2010-2015  北京邮电大学  讲师\n2015-至今   本校计算机学院  教授 / 网络技术专业负责人',
    status: '在职',
    roles: ['教师', '专业负责人'],
  }

  const notifications = {
    course: true,
    exam: true,
    teaching: true,
    system: true,
    email: true,
    sms: false,
  }

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
            <div className="flex items-center gap-4 mb-8 pb-6 border-b border-gray-100">
              <Avatar className="w-20 h-20 ring-4 ring-white shadow-md">
                <AvatarFallback className="bg-gradient-to-br from-blue-500 to-blue-600 text-white text-2xl font-bold">
                  {mockTeacherInfo.avatar}
                </AvatarFallback>
              </Avatar>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">{mockTeacherInfo.name}</h3>
                <p className="text-sm text-gray-500">{mockTeacherInfo.department}</p>
              </div>
            </div>

            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <FormFieldRow label="姓名" labelClassName="text-xs text-gray-500">
                  <Input
                    value={formData.name}
                    disabled
                    className="bg-gray-50 border-gray-200 h-9"
                  />
                </FormFieldRow>
                <FormFieldRow label="工号" labelClassName="text-xs text-gray-500">
                  <Input
                    value={formData.teacherNo}
                    disabled
                    className="bg-gray-50 border-gray-200 h-9"
                  />
                </FormFieldRow>
                <FormFieldRow label="所属部门" labelClassName="text-xs text-gray-500">
                  <Input
                    value={formData.department}
                    disabled
                    className="bg-gray-50 border-gray-200 h-9"
                  />
                </FormFieldRow>
                <FormFieldRow label="状态" labelClassName="text-xs text-gray-500">
                  <Input
                    value={formData.status}
                    disabled
                    className="bg-gray-50 border-gray-200 h-9"
                  />
                </FormFieldRow>
                <FormFieldRow label="职位" labelClassName="text-xs text-gray-500">
                  <Input
                    value={formData.position}
                    disabled
                    className="bg-gray-50 border-gray-200 h-9"
                  />
                </FormFieldRow>
                <div className="space-y-1.5">
                  <Label className="text-xs text-gray-500">关联角色</Label>
                  <div className="flex items-center gap-1.5 flex-wrap min-h-[36px]">
                    {formData.roles.map((role) => (
                      <Badge
                        key={role}
                        variant="secondary"
                        className="text-xs px-2 py-1 bg-blue-50 text-blue-700 border border-blue-200"
                      >
                        {role}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </SectionCard>
        </TabsContent>

        <TabsContent value="security" className="mt-0">
          <SectionCard title="账号安全" icon={Shield} iconColor="rose">
            <div className="space-y-3">
              {teacherSecurityItems.map((item, index) => {
                const Icon = [Lock, Smartphone, Mail, Phone][index]
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
                          className={`text-xs ${item.status === 'strong' || item.status === 'bound' ? 'text-emerald-600' : 'text-gray-400'}`}
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
                建议定期修改登录密码，教师账号涉及成绩管理等敏感操作，请务必确保账号安全。
              </p>
            </div>
          </SectionCard>
        </TabsContent>

        <TabsContent value="notifications" className="mt-0">
          <SectionCard title="通知偏好" icon={Bell} iconColor="amber">
            <div className="space-y-6">
              <div>
                <h4 className="text-sm font-semibold text-gray-900 mb-3">教学通知</h4>
                <div className="space-y-3">
                  {[
                    {
                      key: 'course',
                      label: '课程动态提醒',
                      desc: '当学生提交作业或课程有新进展时通知我',
                    },
                    {
                      key: 'exam',
                      label: '考试与成绩提醒',
                      desc: '当考试安排变动或成绩需要录入时通知我',
                    },
                    {
                      key: 'teaching',
                      label: '教学管理通知',
                      desc: '当有新的教学安排、教务通知时通知我',
                    },
                    {
                      key: 'system',
                      label: '系统维护通知',
                      desc: '当系统有更新维护时有新通知时提醒',
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
                    { key: 'email', label: '邮件通知', desc: '发送通知到绑定邮箱' },
                    { key: 'sms', label: '短信通知', desc: '发送通知到绑定手机（紧急事项）' },
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
