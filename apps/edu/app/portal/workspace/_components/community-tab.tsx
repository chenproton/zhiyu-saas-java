'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  ArrowLeft,
  Flame,
  Loader2,
  MessageCircle,
  MessageSquare,
  Plus,
  Reply,
  Send,
  ThumbsUp,
  Users,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import Image from 'next/image'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@zhiyu/ui'
import { SectionCard } from './section-card'
import { StatCard } from './stat-card'
import { portalCommunityApi } from '@/lib/api'
import { reportError } from '@/lib/error-handling'
import { formatDateTime } from '@/lib/format-utils'
import type { CommunityReply, CommunityTopic, CommunityTopicSort } from '@/lib/types'

// 右侧学习小组/导师保持演示数据（需求明确保留 mock）
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

const SORTS: { id: CommunityTopicSort; label: string }[] = [
  { id: 'hot', label: '热门话题' },
  { id: 'latest', label: '最新发布' },
  { id: 'mine', label: '我的提问' },
]

function avatarChar(name: string, url?: string) {
  if (url) return null
  return name ? name.charAt(0) : '?'
}

export function CommunityTab() {
  const { toast } = useToast()

  const [sort, setSort] = useState<CommunityTopicSort>('latest')
  const [topics, setTopics] = useState<CommunityTopic[]>([])
  const [hotTotal, setHotTotal] = useState(0)
  const [mineTotal, setMineTotal] = useState(0)
  const [loading, setLoading] = useState(true)

  // 帖子详情
  const [detail, setDetail] = useState<CommunityTopic | null>(null)
  const [replies, setReplies] = useState<CommunityReply[]>([])
  const [detailLoading, setDetailLoading] = useState(false)
  const [replyingTo, setReplyingTo] = useState<CommunityReply | null>(null)
  const [replyText, setReplyText] = useState('')
  const [replySubmitting, setReplySubmitting] = useState(false)

  // 发帖弹窗
  const [postOpen, setPostOpen] = useState(false)
  const [postTitle, setPostTitle] = useState('')
  const [postTag, setPostTag] = useState('')
  const [postContent, setPostContent] = useState('')
  const [postSubmitting, setPostSubmitting] = useState(false)

  const loadTopics = useCallback(async (s: CommunityTopicSort) => {
    setLoading(true)
    try {
      const [res, mineRes, hotRes] = await Promise.all([
        portalCommunityApi.listTopics({ sort: s, limit: 50 }),
        portalCommunityApi.listTopics({ sort: 'mine', limit: 1 }),
        portalCommunityApi.listTopics({ sort: 'hot', limit: 1 }),
      ])
      setTopics(res.items)
      setMineTotal(mineRes.total)
      setHotTotal(hotRes.total)
    } catch (e) {
      reportError(e, '加载学习社区话题失败')
      setTopics([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    ;(async () => {
      await loadTopics(sort)
    })()
  }, [sort, loadTopics])

  const openDetail = useCallback(async (topic: CommunityTopic) => {
    setDetail(topic)
    setDetailLoading(true)
    setReplies([])
    setReplyingTo(null)
    setReplyText('')
    try {
      const [topicDetail, replyRes] = await Promise.all([
        portalCommunityApi.getTopic(topic.id),
        portalCommunityApi.listReplies(topic.id),
      ])
      setDetail(topicDetail)
      setReplies(replyRes.items)
    } catch (e) {
      reportError(e, '加载话题详情失败')
      setDetail(null)
    } finally {
      setDetailLoading(false)
    }
  }, [])

  const closeDetail = useCallback(() => {
    setDetail(null)
    setReplyingTo(null)
    setReplyText('')
    loadTopics(sort)
  }, [loadTopics, sort])

  const submitPost = async () => {
    const title = postTitle.trim()
    const content = postContent.trim()
    if (!title) {
      toast({ title: '请填写标题', variant: 'destructive' })
      return
    }
    if (!content) {
      toast({ title: '请填写内容', variant: 'destructive' })
      return
    }
    setPostSubmitting(true)
    try {
      await portalCommunityApi.createTopic({ title, content, tag: postTag.trim() || undefined })
      toast({ title: '发布成功' })
      setPostOpen(false)
      setPostTitle('')
      setPostTag('')
      setPostContent('')
      await loadTopics(sort)
    } catch (e) {
      reportError(e, '发布话题失败')
    } finally {
      setPostSubmitting(false)
    }
  }

  const submitReply = async () => {
    const content = replyText.trim()
    if (!detail || !content) return
    setReplySubmitting(true)
    try {
      await portalCommunityApi.createReply(detail.id, {
        content,
        parentId: replyingTo?.id,
      })
      toast({ title: '回复成功' })
      setReplyText('')
      setReplyingTo(null)
      const [topicDetail, replyRes] = await Promise.all([
        portalCommunityApi.getTopic(detail.id),
        portalCommunityApi.listReplies(detail.id),
      ])
      setDetail(topicDetail)
      setReplies(replyRes.items)
    } catch (e) {
      reportError(e, '回复失败')
    } finally {
      setReplySubmitting(false)
    }
  }

  const totalTopics = hotTotal || topics.length

  return (
    <div className="space-y-5">
      {/* 统计 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="热门话题"
          value={totalTopics}
          icon={Flame}
          trend="按阅读热度排序"
          color="rose"
        />
        <StatCard
          title="我的提问"
          value={mineTotal}
          icon={MessageSquare}
          trend={mineTotal > 0 ? `${mineTotal} 个提问` : '暂未发起'}
          color="blue"
        />
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
        <Button
          className="bg-primary hover:bg-primary/90"
          onClick={() => setPostOpen(true)}
          disabled={!!detail}
        >
          <Plus className="w-4 h-4 mr-1" />
          发起提问
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* 话题列表 / 详情 */}
        <div className="lg:col-span-2">
          {detail ? (
            <div className="p-5 rounded-xl border border-gray-100 bg-white shadow-sm">
              <button
                className="flex items-center gap-1 text-xs text-gray-500 hover:text-primary transition-colors mb-4"
                onClick={closeDetail}
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                返回列表
              </button>

              {detailLoading ? (
                <div className="flex items-center justify-center py-16 text-gray-400">
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                  加载中...
                </div>
              ) : (
                <>
                  <div className="flex items-start gap-3">
                    <Avatar className="w-10 h-10 shrink-0">
                      {detail.avatarUrl ? (
                        <Image
                          src={detail.avatarUrl}
                          alt={detail.authorName}
                          width={40}
                          height={40}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <AvatarFallback className="bg-primary/5 text-primary text-sm font-medium">
                          {avatarChar(detail.authorName)}
                        </AvatarFallback>
                      )}
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h2 className="text-base font-semibold text-gray-900">{detail.title}</h2>
                        {detail.viewCount >= 50 && (
                          <Badge className="text-xs bg-rose-50 text-rose-600 hover:bg-rose-50 border-rose-100">
                            <Flame className="w-3 h-3 mr-0.5" />
                            热门
                          </Badge>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 mb-3">
                        <span className="font-medium text-gray-700">{detail.authorName}</span>
                        {detail.tag && (
                          <Badge
                            variant="outline"
                            className="text-[10px] px-1.5 py-0 border-gray-100 text-gray-500"
                          >
                            {detail.tag}
                          </Badge>
                        )}
                        <span>{formatDateTime(detail.createdAt)}</span>
                        <span className="flex items-center gap-1">
                          <MessageSquare className="w-3.5 h-3.5" />
                          {detail.replyCount} 回复
                        </span>
                        <span>{detail.viewCount} 浏览</span>
                      </div>
                    </div>
                  </div>

                  <div className="whitespace-pre-wrap text-sm text-gray-700 leading-7 bg-gray-50 rounded-xl p-4 mb-5">
                    {detail.content}
                  </div>

                  {/* 回复流 */}
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">
                    全部回复（{replies.length}）
                  </h3>
                  <div className="space-y-4 mb-5">
                    {replies.length === 0 && (
                      <div className="py-6 text-center text-xs text-gray-400">
                        暂无回复，快来抢沙发～
                      </div>
                    )}
                    {replies.map((reply) => (
                      <div key={reply.id} className="flex items-start gap-3">
                        <Avatar className="w-8 h-8 shrink-0">
                          {reply.avatarUrl ? (
                            <Image
                              src={reply.avatarUrl}
                              alt={reply.authorName}
                              width={32}
                              height={32}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <AvatarFallback className="bg-gray-50 text-gray-600 text-xs font-medium">
                              {avatarChar(reply.authorName)}
                            </AvatarFallback>
                          )}
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 text-xs text-gray-500 mb-0.5">
                            <span className="font-medium text-gray-700">{reply.authorName}</span>
                            {reply.parentAuthorName && (
                              <span className="text-gray-400">回复 @{reply.parentAuthorName}</span>
                            )}
                            <span>{formatDateTime(reply.createdAt)}</span>
                          </div>
                          <p className="text-sm text-gray-700 whitespace-pre-wrap">
                            {reply.content}
                          </p>
                          <button
                            className="flex items-center gap-1 mt-1 text-xs text-gray-400 hover:text-primary transition-colors"
                            onClick={() => setReplyingTo(reply)}
                          >
                            <Reply className="w-3 h-3" />
                            回复
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* 回复输入 */}
                  <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                    {replyingTo && (
                      <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
                        <span>
                          回复{' '}
                          <span className="font-medium text-gray-700">
                            @{replyingTo.authorName}
                          </span>
                          的评论
                        </span>
                        <button
                          className="text-gray-400 hover:text-gray-600"
                          onClick={() => setReplyingTo(null)}
                        >
                          取消
                        </button>
                      </div>
                    )}
                    <div className="flex items-end gap-2">
                      <Textarea
                        placeholder="写下你的回复..."
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        className="min-h-[60px] bg-white text-sm resize-none"
                        rows={2}
                      />
                      <Button
                        className="bg-primary hover:bg-primary/90 shrink-0"
                        size="sm"
                        disabled={!replyText.trim() || replySubmitting}
                        onClick={submitReply}
                      >
                        {replySubmitting ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Send className="w-3.5 h-3.5" />
                        )}
                        回复
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </div>
          ) : (
            <Tabs
              value={sort}
              onValueChange={(v) => setSort(v as CommunityTopicSort)}
              className="w-full"
            >
              <TabsList className="h-9 bg-white border border-gray-100 shadow-sm mb-4 p-1">
                {SORTS.map((s) => (
                  <TabsTrigger
                    key={s.id}
                    value={s.id}
                    className="text-sm px-4 data-[state=active]:bg-primary data-[state=active]:text-white"
                  >
                    {s.label}
                  </TabsTrigger>
                ))}
              </TabsList>

              <TabsContent value={sort} className="mt-0">
                {loading ? (
                  <div className="flex items-center justify-center py-16 text-gray-400">
                    <Loader2 className="w-5 h-5 animate-spin mr-2" />
                    加载中...
                  </div>
                ) : topics.length === 0 ? (
                  <div className="p-8 rounded-xl border border-gray-100 bg-white text-center text-gray-400">
                    {sort === 'mine' ? (
                      <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-40" />
                    ) : (
                      <Flame className="w-12 h-12 mx-auto mb-3 opacity-40" />
                    )}
                    <p>{sort === 'mine' ? '你还没有发起过提问' : '暂无话题，来发第一帖吧'}</p>
                    <Button
                      className="mt-4 bg-primary hover:bg-primary/90"
                      size="sm"
                      onClick={() => setPostOpen(true)}
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      {sort === 'mine' ? '去提问' : '发起提问'}
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {topics.map((topic) => (
                      <div
                        key={topic.id}
                        className="p-4 rounded-xl border border-gray-100 bg-white hover:border-primary/25 hover:shadow-sm transition-all cursor-pointer"
                        onClick={() => openDetail(topic)}
                      >
                        <div className="flex items-start gap-3">
                          <Avatar className="w-10 h-10 shrink-0">
                            {topic.avatarUrl ? (
                              <Image
                                src={topic.avatarUrl}
                                alt={topic.authorName}
                                width={40}
                                height={40}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <AvatarFallback className="bg-primary/5 text-primary text-sm font-medium">
                                {avatarChar(topic.authorName)}
                              </AvatarFallback>
                            )}
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="text-sm font-semibold text-gray-900 hover:text-primary transition-colors truncate">
                                {topic.title}
                              </h3>
                              {topic.viewCount >= 50 && (
                                <Badge className="text-xs bg-rose-50 text-rose-600 hover:bg-rose-50 border-rose-100 shrink-0">
                                  <Flame className="w-3 h-3 mr-0.5" />
                                  热门
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-3 text-xs text-gray-500 mb-2">
                              <span className="font-medium text-gray-700">{topic.authorName}</span>
                              {topic.tag && (
                                <Badge
                                  variant="outline"
                                  className="text-[10px] px-1.5 py-0 border-gray-100 text-gray-500"
                                >
                                  {topic.tag}
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-4 text-xs text-gray-400">
                              <span className="flex items-center gap-1">
                                <MessageSquare className="w-3.5 h-3.5" />
                                {topic.replyCount} 回复
                              </span>
                              <span>{topic.viewCount} 浏览</span>
                              <span>{formatDateTime(topic.createdAt)}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          )}
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
                        ? 'bg-primary hover:bg-primary/90 text-xs'
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

      {/* 发帖弹窗 */}
      <Dialog open={postOpen} onOpenChange={setPostOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>发起提问</DialogTitle>
            <DialogDescription>分享你的学习问题或经验，和同学们一起交流。</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-600">标题</label>
              <Input
                placeholder="一句话说清你的问题"
                value={postTitle}
                maxLength={128}
                onChange={(e) => setPostTitle(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-600">标签（选填）</label>
              <Input
                placeholder="如：网络技术"
                value={postTag}
                maxLength={32}
                onChange={(e) => setPostTag(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-600">内容</label>
              <Textarea
                placeholder="补充详细描述，便于同学们解答"
                value={postContent}
                rows={5}
                onChange={(e) => setPostContent(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setPostOpen(false)}>
                取消
              </Button>
              <Button
                className="bg-primary hover:bg-primary/90"
                disabled={postSubmitting}
                onClick={submitPost}
              >
                {postSubmitting && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
                发布
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
