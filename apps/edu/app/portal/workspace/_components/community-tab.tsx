'use client'

import { Flame, MessageCircle, MessageSquare, Plus, ThumbsUp, Users } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { SectionCard } from './section-card'
import { StatCard } from './stat-card'
// 演示数据：以下 import 来自占位 mock 文件，后续应替换为真实 API（详见该文件头部说明）
import { mockTopics } from '../_data/mock-student-data'

const studyGroups = [
  { id: 'g1', name: '网络技术学习小组', members: 28, active: true },
  { id: 'g2', name: 'Linux运维互助群', members: 16, active: true },
  { id: 'g3', name: '岗位面试经验分享', members: 45, active: false },
  { id: 'g4', name: '技能大赛备赛组', members: 12, active: true },
]

const mentors = [
  { id: 'm1', name: '王教授', role: '网络基础课程教师', avatar: '王' },
  { id: 'm2', name: '李老师', role: '企业导师 · 华为', avatar: '李' },
  { id: 'm3', name: '张老师', role: 'Linux系统管理教师', avatar: '张' },
]

export function CommunityTab() {
  return (
    <div className="space-y-5">
      {/* 统计 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="热门话题"
          value={mockTopics.length}
          icon={Flame}
          trend="今日新增 2 个"
          color="rose"
        />
        <StatCard title="我的提问" value={0} icon={MessageSquare} trend="暂未发起" color="blue" />
        <StatCard
          title="学习小组"
          value={studyGroups.length}
          icon={Users}
          trend="3 个可加入"
          color="green"
        />
        <StatCard
          title="我的导师"
          value={mentors.length}
          icon={ThumbsUp}
          trend="可在线咨询"
          color="amber"
        />
      </div>

      <div className="flex justify-end">
        <Button className="bg-blue-600 hover:bg-blue-700">
          <Plus className="w-4 h-4 mr-1" />
          发起提问
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* 话题列表 */}
        <div className="lg:col-span-2">
          <Tabs defaultValue="hot" className="w-full">
            <TabsList className="h-9 bg-white border border-gray-100 shadow-sm mb-4 p-1">
              <TabsTrigger
                value="hot"
                className="text-sm px-4 data-[state=active]:bg-blue-600 data-[state=active]:text-white"
              >
                热门话题
              </TabsTrigger>
              <TabsTrigger
                value="latest"
                className="text-sm px-4 data-[state=active]:bg-blue-600 data-[state=active]:text-white"
              >
                最新回复
              </TabsTrigger>
              <TabsTrigger
                value="mine"
                className="text-sm px-4 data-[state=active]:bg-blue-600 data-[state=active]:text-white"
              >
                我的提问
              </TabsTrigger>
            </TabsList>

            <TabsContent value="hot" className="mt-0 space-y-3">
              {mockTopics.length === 0 && (
                <div className="p-8 rounded-xl border border-gray-100 bg-white text-center text-gray-400">
                  <Flame className="w-12 h-12 mx-auto mb-3 opacity-40" />
                  <p>暂无热门话题</p>
                </div>
              )}
              {mockTopics.map((topic) => (
                <div
                  key={topic.id}
                  className="p-4 rounded-xl border border-gray-100 bg-white hover:border-blue-200 hover:shadow-sm transition-all cursor-pointer"
                >
                  <div className="flex items-start gap-3">
                    <Avatar className="w-10 h-10 shrink-0">
                      <AvatarFallback className="bg-blue-50 text-blue-600 text-sm font-medium">
                        {topic.avatar}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-sm font-semibold text-gray-900 hover:text-blue-600 transition-colors truncate">
                          {topic.title}
                        </h3>
                        {topic.isHot && (
                          <Badge className="text-xs bg-rose-50 text-rose-600 hover:bg-rose-50 border-rose-100">
                            <Flame className="w-3 h-3 mr-0.5" />
                            热门
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-gray-500 mb-2">
                        <span className="font-medium text-gray-700">{topic.author}</span>
                        <Badge
                          variant="outline"
                          className="text-[10px] px-1.5 py-0 border-gray-100 text-gray-500"
                        >
                          {topic.tag}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-gray-400">
                        <span className="flex items-center gap-1">
                          <MessageSquare className="w-3.5 h-3.5" />
                          {topic.replies} 回复
                        </span>
                        <span>{topic.views} 浏览</span>
                        <span>最后回复：{topic.lastReply}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </TabsContent>

            <TabsContent value="latest" className="mt-0">
              <div className="p-8 rounded-xl border border-gray-100 bg-white text-center text-gray-400">
                <MessageCircle className="w-12 h-12 mx-auto mb-3 opacity-40" />
                <p>最新回复话题将在这里展示</p>
              </div>
            </TabsContent>

            <TabsContent value="mine" className="mt-0">
              <div className="p-8 rounded-xl border border-gray-100 bg-white text-center text-gray-400">
                <MessageCircle className="w-12 h-12 mx-auto mb-3 opacity-40" />
                <p>你还没有发起过提问</p>
                <Button className="mt-4 bg-blue-600 hover:bg-blue-700" size="sm">
                  <Plus className="w-4 h-4 mr-1" />
                  去提问
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* 侧边栏 */}
        <div className="space-y-5">
          {/* 学习小组 */}
          <SectionCard title="学习小组" icon={Users} iconColor="blue">
            <div className="space-y-2">
              {studyGroups.map((group) => (
                <div
                  key={group.id}
                  className="flex items-center justify-between p-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900">{group.name}</p>
                    <p className="text-xs text-gray-500">{group.members} 人</p>
                  </div>
                  <Button
                    size="sm"
                    variant={group.active ? 'default' : 'outline'}
                    className={
                      group.active
                        ? 'bg-blue-600 hover:bg-blue-700 text-xs'
                        : 'text-xs border-gray-200 text-gray-600'
                    }
                  >
                    {group.active ? '加入' : '已满'}
                  </Button>
                </div>
              ))}
            </div>
          </SectionCard>

          {/* 导师/教师 */}
          <SectionCard title="我的导师" icon={ThumbsUp} iconColor="amber">
            <div className="space-y-3">
              {mentors.map((mentor) => (
                <div key={mentor.id} className="flex items-center gap-3">
                  <Avatar className="w-10 h-10">
                    <AvatarFallback className="bg-amber-50 text-amber-600 text-sm font-medium">
                      {mentor.avatar}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">{mentor.name}</p>
                    <p className="text-xs text-gray-500 truncate">{mentor.role}</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs border-gray-200 text-gray-700 hover:bg-gray-50 shrink-0"
                  >
                    咨询
                  </Button>
                </div>
              ))}
            </div>
          </SectionCard>

          {/* 社区公告 */}
          <SectionCard title="社区规范" icon={MessageCircle} iconColor="green">
            <ul className="space-y-2 text-xs text-gray-500">
              <li>• 请友善交流，尊重他人观点</li>
              <li>• 提问前建议先搜索已有话题</li>
              <li>• 鼓励分享学习笔记与实践经验</li>
              <li>• 禁止发布与教学无关的内容</li>
            </ul>
          </SectionCard>
        </div>
      </div>
    </div>
  )
}
