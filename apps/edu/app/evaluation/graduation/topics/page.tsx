"use client"

import { useState, useMemo } from "react"
import { Search, Plus, BookOpen, Briefcase, MapPin, Users, Lock, Unlock, CheckCircle2, Clock, XCircle, Trash2, Pencil, Eye, GraduationCap, UserCheck, ArrowRightLeft, Settings, Layers, Lightbulb, UserCircle, Building2, Send, RotateCcw, MoreHorizontal } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useData } from "@/components/providers/data-provider"
import { useToast } from "@/hooks/use-toast"
import type { GraduationProjectTopic, TopicStatus, TopicApplication } from "@/lib/types"

const STATUS_LABELS: Record<TopicStatus, string> = {
  draft: '草稿',
  pending: '审批中',
  published: '已发布',
  locked: '已锁定',
}

const TEACHERS = [
  { id: 't1', name: '张教授', dept: '计算机学院' },
  { id: 't2', name: '王教授', dept: '计算机学院' },
  { id: 't3', name: '李教授', dept: '软件学院' },
  { id: 't4', name: '刘教授', dept: '信息学院' },
  { id: 't5', name: '陈教授', dept: '计算机学院' },
]

const ENTERPRISE_MENTORS = [
  { id: 'm1', name: '李工程师', company: '腾讯科技' },
  { id: 'm2', name: '赵架构师', company: '阿里巴巴' },
  { id: 'm3', name: '周总监', company: '字节跳动' },
  { id: 'm4', name: '吴经理', company: '华为技术' },
  { id: 'm5', name: '郑专家', company: '美团' },
]

const SCENE_OPTIONS = [
  { id: 'sc-1', name: 'Web前端开发实训室', abilities: 'HTML/CSS/JS、React/Vue框架、响应式设计', knowledge: '前端基础、组件化开发、状态管理', tasks: '静态页面开发、动态交互实现、项目部署' },
  { id: 'sc-2', name: 'React专项训练室', abilities: 'React Hooks、Context、Redux', knowledge: '虚拟DOM、Diff算法、生命周期', tasks: '组件设计、状态管理、路由配置' },
  { id: 'sc-3', name: '软件工程实训室', abilities: '需求分析、系统设计、代码评审', knowledge: '软件工程、设计模式、版本控制', tasks: '项目开发、团队协作、文档撰写' },
  { id: 'sc-4', name: '后端开发实训室', abilities: 'Java/Go/Node.js、数据库、微服务', knowledge: 'RESTful API、ORM、缓存策略', tasks: '接口开发、数据库设计、服务部署' },
  { id: 'sc-5', name: '人工智能实验室', abilities: '机器学习、深度学习、数据处理', knowledge: '线性代数、概率统计、神经网络', tasks: '模型训练、数据分析、算法优化' },
]

export default function GraduationProjectTopicsPage() {
  const { graduationProjectTopics, positionsList, topicApplications, createGraduationProjectTopic, updateGraduationProjectTopic, deleteGraduationProjectTopic, updateTopicApplication } = useData()
  const { toast } = useToast()

  const COLLEGES = ['全部学院', '计算机学院', '软件学院', '信息工程学院', '人工智能学院', '数字媒体学院']
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [sourceFilter, setSourceFilter] = useState<string>("all")
  const [collegeFilter, setCollegeFilter] = useState<string>("全部学院")

  const [formOpen, setFormOpen] = useState(false)
  const [editingTopic, setEditingTopic] = useState<GraduationProjectTopic | null>(null)
  const [viewTopic, setViewTopic] = useState<GraduationProjectTopic | null>(null)
  const [deleteTopic, setDeleteTopic] = useState<GraduationProjectTopic | null>(null)
  const [lockTopic, setLockTopic] = useState<GraduationProjectTopic | null>(null)
  const [viewApplications, setViewApplications] = useState<GraduationProjectTopic | null>(null)

  const [advisorSearchOpen, setAdvisorSearchOpen] = useState(false)
  const [mentorSearchOpen, setMentorSearchOpen] = useState(false)
  const [advisorSearchQuery, setAdvisorSearchQuery] = useState('')
  const [mentorSearchQuery, setMentorSearchQuery] = useState('')

  const [formData, setFormData] = useState({
    name: '', positionId: '', college: '计算机学院', source: 'enterprise' as 'scene' | 'enterprise',
    capacity: 1, advisorNames: [] as string[], mentorNames: [] as string[], startDate: '', endDate: '', description: '',
    sceneId: '', sceneName: '',
  })

  const [allocateAdvisorId, setAllocateAdvisorId] = useState('')
  const [allocateApp, setAllocateApp] = useState<TopicApplication | null>(null)

  const filteredTopics = useMemo(() => {
    let list = [...graduationProjectTopics]
    if (statusFilter !== "all") list = list.filter((t) => t.status === statusFilter)
    if (sourceFilter !== "all") list = list.filter((t) => t.source === sourceFilter)
    if (collegeFilter !== "全部学院") list = list.filter((t) => t.college === collegeFilter)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter((t) => t.name.toLowerCase().includes(q) || t.positionName.toLowerCase().includes(q) || t.advisorName.toLowerCase().includes(q))
    }
    return list.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
  }, [graduationProjectTopics, statusFilter, sourceFilter, collegeFilter, search])

  const stats = useMemo(() => {
    const total = graduationProjectTopics.length
    const draft = graduationProjectTopics.filter((t) => t.status === 'draft').length
    const pending = graduationProjectTopics.filter((t) => t.status === 'pending').length
    const published = graduationProjectTopics.filter((t) => t.status === 'published').length
    const locked = graduationProjectTopics.filter((t) => t.status === 'locked').length
    return { total, draft, pending, published, locked }
  }, [graduationProjectTopics])

  const topicApps = useMemo(() => (topicId: string) => topicApplications.filter((a) => a.topicId === topicId), [topicApplications])

  const resetForm = () => {
    setFormData({ name: '', positionId: '', college: '计算机学院', source: 'enterprise', capacity: 1, advisorNames: [], mentorNames: [], startDate: '', endDate: '', description: '', sceneId: '', sceneName: '' })
    setEditingTopic(null)
  }
  const openCreate = () => { resetForm(); setFormOpen(true) }
  const openEdit = (topic: GraduationProjectTopic) => {
    setEditingTopic(topic)
    const advisorArr = topic.advisorName ? topic.advisorName.split(/[,，]/).map(s => s.trim()).filter(Boolean) : []
    const mentorArr = topic.enterpriseMentorName ? topic.enterpriseMentorName.split(/[,，]/).map(s => s.trim()).filter(Boolean) : []
    setFormData({
      name: topic.name, positionId: topic.positionId, college: topic.college || '计算机学院',
      source: topic.source, capacity: topic.capacity, advisorNames: advisorArr, mentorNames: mentorArr,
      startDate: topic.startDate.toISOString().split('T')[0], endDate: topic.endDate.toISOString().split('T')[0], description: topic.description || '',
      sceneId: '', sceneName: '',
    })
    setFormOpen(true)
  }
  const handleSubmit = () => {
    if (!formData.name.trim() || formData.advisorNames.length === 0 || !formData.startDate || !formData.endDate) {
      toast({ title: '请填写必填项', variant: 'destructive' }); return
    }
    const position = positionsList.find((p) => p.id === formData.positionId)
    const payload = {
      ...formData,
      positionName: position?.name || formData.positionId,
      advisorName: formData.advisorNames.join('，'),
      enterpriseMentorName: formData.mentorNames.length ? formData.mentorNames.join('，') : undefined,
    }
    if (editingTopic) { updateGraduationProjectTopic(editingTopic.id, payload); toast({ title: '选题已更新' }) }
    else { createGraduationProjectTopic(payload); toast({ title: '选题已发布' }) }
    setFormOpen(false); resetForm()
  }
  const handleDelete = () => { if (deleteTopic) { deleteGraduationProjectTopic(deleteTopic.id); toast({ title: '选题已删除' }); setDeleteTopic(null) } }
  const handleLock = () => {
    if (lockTopic) {
      updateGraduationProjectTopic(lockTopic.id, { status: 'locked' })
      toast({ title: '选题已锁定，已生成毕设档案' })
      setLockTopic(null)
    }
  }
  const handleSubmitForApproval = (topic: GraduationProjectTopic) => {
    updateGraduationProjectTopic(topic.id, { status: 'pending' })
    toast({ title: '选题已提交审批' })
  }
  const handleWithdrawApproval = (topic: GraduationProjectTopic) => {
    updateGraduationProjectTopic(topic.id, { status: 'draft' })
    toast({ title: '选题已撤回至草稿' })
  }
  const handleApprove = (topic: GraduationProjectTopic) => {
    updateGraduationProjectTopic(topic.id, { status: 'published' })
    toast({ title: '选题审批已通过，已发布' })
  }
  const handleRejectApproval = (topic: GraduationProjectTopic) => {
    updateGraduationProjectTopic(topic.id, { status: 'draft' })
    toast({ title: '选题审批已驳回，已退回草稿' })
  }
  const handleCancelPublish = (topic: GraduationProjectTopic) => {
    updateGraduationProjectTopic(topic.id, { status: 'draft' })
    toast({ title: '选题已取消发布，退回草稿' })
  }
  const handleCancelLock = (topic: GraduationProjectTopic) => {
    updateGraduationProjectTopic(topic.id, { status: 'published' })
    toast({ title: '选题已取消锁定，退回已发布' })
  }
  const handleAllocateConfirm = () => {
    if (allocateApp && allocateAdvisorId) {
      const teacher = TEACHERS.find(t => t.id === allocateAdvisorId)
      updateTopicApplication(allocateApp.id, { status: 'allocated', allocatedAdvisorId: allocateAdvisorId, allocatedAdvisorName: teacher?.name })
      toast({ title: `已将 ${allocateApp.studentName} 分配至该选题，指导教师：${teacher?.name || allocateAdvisorId}` })
      setAllocateApp(null)
      setAllocateAdvisorId('')
    }
  }
  const getStatusBadge = (status: TopicStatus) => {
    switch (status) {
      case 'draft': return <Badge variant="secondary"><Clock className="mr-1 size-3" />{STATUS_LABELS[status]}</Badge>
      case 'pending': return <Badge variant="outline" className="text-amber-600"><Users className="mr-1 size-3" />{STATUS_LABELS[status]}</Badge>
      case 'published': return <Badge variant="default" className="bg-blue-500"><BookOpen className="mr-1 size-3" />{STATUS_LABELS[status]}</Badge>
      case 'locked': return <Badge variant="default" className="bg-emerald-500"><Lock className="mr-1 size-3" />{STATUS_LABELS[status]}</Badge>
    }
  }
  const formatDate = (date: Date) => new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" }).format(date)

  const filteredTeachers = TEACHERS.filter(t => t.name.includes(advisorSearchQuery) || t.dept.includes(advisorSearchQuery))
  const filteredMentors = ENTERPRISE_MENTORS.filter(m => m.name.includes(mentorSearchQuery) || m.company.includes(mentorSearchQuery))
  const selectedScene = SCENE_OPTIONS.find(s => s.id === formData.sceneId)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">毕业设计选题管理</h1>
          <p className="text-muted-foreground">发布、配置、审核毕设选题，管理选题全生命周期</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => window.open('/graduation-project/student/apply', '_blank')}>
            <GraduationCap className="mr-2 size-4" />学生申请入口
          </Button>
          <Button onClick={openCreate}><Plus className="mr-2 size-4" />发布选题</Button>
        </div>
      </div>

      <div className="flex gap-3">
        <div className="flex flex-1 items-center gap-3 rounded-lg border bg-white px-4 py-3">
          <div className="flex size-8 items-center justify-center rounded-md bg-blue-50"><BookOpen className="size-4 text-blue-600" /></div>
          <div className="min-w-0 flex-1">
            <div className="text-xs text-muted-foreground">选题概况</div>
            <div className="flex items-center gap-2 text-xs">
              <span>总数 <strong className="text-foreground">{stats.total}</strong></span>
              <span className="text-gray-300">|</span>
              <span>草稿 <strong className="text-muted-foreground">{stats.draft}</strong></span>
              <span className="text-gray-300">|</span>
              <span>审批中 <strong className="text-amber-600">{stats.pending}</strong></span>
              <span className="text-gray-300">|</span>
              <span>已发布 <strong className="text-blue-600">{stats.published}</strong></span>
              <span className="text-gray-300">|</span>
              <span>已锁定 <strong className="text-emerald-600">{stats.locked}</strong></span>
            </div>
          </div>
        </div>
        <div className="flex flex-1 items-center gap-3 rounded-lg border bg-white px-4 py-3">
          <div className="flex size-8 items-center justify-center rounded-md bg-amber-50"><MapPin className="size-4 text-amber-600" /></div>
          <div className="min-w-0 flex-1">
            <div className="text-xs text-muted-foreground">选题来源</div>
            <div className="flex items-center gap-2 text-xs">
              <span>场景库 <strong className="text-foreground">{graduationProjectTopics.filter((t) => t.source === 'scene').length}</strong></span>
              <span className="text-gray-300">|</span>
              <span>企业需求 <strong className="text-emerald-600">{graduationProjectTopics.filter((t) => t.source === 'enterprise').length}</strong></span>
            </div>
          </div>
        </div>
      </div>

      {/* 学院 Tab 切换 */}
      <div className="flex flex-wrap gap-2">
        {COLLEGES.map((college) => (
          <Button
            key={college}
            variant={collegeFilter === college ? 'default' : 'outline'}
            size="sm"
            className="h-8 text-xs"
            onClick={() => setCollegeFilter(college)}
          >
            {college}
          </Button>
        ))}
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="搜索选题名称、岗位、导师..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder="全部状态" /></SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="all">全部状态</SelectItem><SelectItem value="draft">草稿</SelectItem><SelectItem value="pending">审批中</SelectItem><SelectItem value="published">已发布</SelectItem><SelectItem value="locked">已锁定</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
        <Select value={sourceFilter} onValueChange={setSourceFilter}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder="全部来源" /></SelectTrigger>
          <SelectContent>
            <SelectGroup><SelectItem value="all">全部来源</SelectItem><SelectItem value="scene">场景库</SelectItem><SelectItem value="enterprise">企业需求</SelectItem></SelectGroup>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border bg-white px-4 py-3">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[240px]">选题名称</TableHead>
                <TableHead className="w-[100px]">所属学院</TableHead>
                <TableHead className="w-[100px]"><div className="flex items-center gap-1"><Briefcase className="size-3.5" />关联岗位</div></TableHead>
                <TableHead className="w-[80px]">来源</TableHead>
                <TableHead className="w-[80px]">状态</TableHead>
                <TableHead className="w-[70px]">容量</TableHead>
                <TableHead className="w-[90px]">指导教师</TableHead>
                <TableHead className="w-[90px]">企业导师</TableHead>
                <TableHead className="w-[140px]">起止时间</TableHead>
                <TableHead className="sticky right-0 w-[200px] bg-white text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTopics.length === 0 ? (
                <TableRow><TableCell colSpan={10} className="h-24 text-center text-muted-foreground">暂无选题记录</TableCell></TableRow>
              ) : (filteredTopics.map((topic) => (
                <TableRow key={topic.id}>
                  <TableCell>
                    <div className="text-sm font-medium">{topic.name}</div>
                    <div className="text-xs text-muted-foreground line-clamp-1">{topic.description || '-'}</div>
                  </TableCell>
                  <TableCell><span className="text-sm">{topic.college}</span></TableCell>
                  <TableCell><div className="flex items-center gap-1.5"><Briefcase className="size-3.5 text-blue-500" /><span className="text-sm">{topic.positionName}</span></div></TableCell>
                  <TableCell><Badge variant="outline" className="text-xs font-normal">{topic.source === 'scene' ? '场景库' : '企业需求'}</Badge></TableCell>
                  <TableCell>{getStatusBadge(topic.status)}</TableCell>
                  <TableCell><span className="text-sm">{topic.appliedCount} / {topic.capacity}</span></TableCell>
                  <TableCell><span className="text-sm">{topic.advisorName}</span></TableCell>
                  <TableCell><span className="text-sm text-muted-foreground">{topic.enterpriseMentorName || '-'}</span></TableCell>
                  <TableCell className="text-xs text-muted-foreground"><div>{formatDate(topic.startDate)}</div><div>至 {formatDate(topic.endDate)}</div></TableCell>
                  <TableCell className="sticky right-0 bg-white text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setViewTopic(topic)}>
                          查看
                        </DropdownMenuItem>

                        {topic.status === 'draft' && (
                          <>
                            <DropdownMenuItem onClick={() => openEdit(topic)}>
                              编辑
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive" onClick={() => setDeleteTopic(topic)}>
                              删除
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleSubmitForApproval(topic)}>
                              提交审批
                            </DropdownMenuItem>
                          </>
                        )}

                        {topic.status === 'pending' && (
                          <>
                            <DropdownMenuItem onClick={() => handleWithdrawApproval(topic)}>
                              撤回
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleApprove(topic)}>
                              通过
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive" onClick={() => handleRejectApproval(topic)}>
                              驳回
                            </DropdownMenuItem>
                          </>
                        )}

                        {topic.status === 'published' && (
                          <>
                            <DropdownMenuItem onClick={() => setViewApplications(topic)}>
                              申请({topicApps(topic.id).length})
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleCancelPublish(topic)}>
                              取消发布
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setLockTopic(topic)}>
                              锁定
                            </DropdownMenuItem>
                          </>
                        )}

                        {topic.status === 'locked' && (
                          <>
                            <DropdownMenuItem onClick={() => setViewApplications(topic)}>
                              申请({topicApps(topic.id).length})
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleCancelLock(topic)}>
                              取消锁定
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              )))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* 发布/编辑弹窗 - 变大 */}
      <Dialog open={formOpen} onOpenChange={(open) => { if (!open) { setFormOpen(false); resetForm() } }}>
        <DialogContent size="xl" className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingTopic ? '编辑选题' : '发布选题'}</DialogTitle><DialogDescription>配置选题基础信息、关联场景/能力模型、指导团队</DialogDescription></DialogHeader>
          <div className="grid grid-cols-12 gap-6 py-4">
            {/* 左侧：选题来源配置 + 关联岗位 + 能力要求 */}
            <div className="col-span-7 space-y-4">
              <div className="grid gap-2"><Label>选题名称 *</Label><Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="请输入选题名称" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2"><Label>所属二级学院 *</Label><Select value={formData.college} onValueChange={(v) => setFormData({ ...formData, college: v })}><SelectTrigger><SelectValue placeholder="选择学院" /></SelectTrigger><SelectContent>{COLLEGES.filter(c => c !== '全部学院').map((c) => (<SelectItem key={c} value={c}>{c}</SelectItem>))}</SelectContent></Select></div>
                <div className="grid gap-2"><Label>选题来源</Label><Select value={formData.source} onValueChange={(v) => setFormData({ ...formData, source: v as 'scene' | 'enterprise' })}><SelectTrigger><SelectValue placeholder="选择来源" /></SelectTrigger><SelectContent><SelectItem value="scene">场景库</SelectItem><SelectItem value="enterprise">企业需求</SelectItem></SelectContent></Select></div>
              </div>

              {/* 关联岗位（与能力要求联动） */}
              <div className="grid gap-2"><Label>关联岗位</Label><Select value={formData.positionId} onValueChange={(v) => setFormData({ ...formData, positionId: v })}><SelectTrigger><SelectValue placeholder="选择岗位" /></SelectTrigger><SelectContent>{positionsList.map((pos) => (<SelectItem key={pos.id} value={pos.id}>{pos.name}</SelectItem>))}</SelectContent></Select></div>

              {/* 场景库：关联场景下拉 + 场景卡片 */}
              {formData.source === 'scene' && (
                <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
                  <div className="grid gap-2">
                    <Label>关联场景 *</Label>
                    <Select value={formData.sceneId} onValueChange={(v) => setFormData({ ...formData, sceneId: v, sceneName: SCENE_OPTIONS.find(s => s.id === v)?.name || '' })}>
                      <SelectTrigger><SelectValue placeholder="请选择关联场景" /></SelectTrigger>
                      <SelectContent>{SCENE_OPTIONS.map((s) => (<SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>))}</SelectContent>
                    </Select>
                  </div>
                  {selectedScene && (
                    <div className="rounded-lg border bg-white p-4 space-y-3">
                      <div className="flex items-center gap-2 text-sm font-semibold"><Layers className="size-4 text-blue-600" />{selectedScene.name}</div>
                      <div className="rounded-md bg-amber-50 p-3 text-xs text-amber-800 space-y-1">
                        <div><span className="font-medium">能力点：</span>{selectedScene.abilities}</div>
                        <div><span className="font-medium">知识点：</span>{selectedScene.knowledge}</div>
                        <div><span className="font-medium">任务链：</span>{selectedScene.tasks}</div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 企业需求：选题项目配置区域 */}
              {formData.source === 'enterprise' && (
                <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
                  <div className="flex items-center gap-2 text-sm font-semibold"><Building2 className="size-4 text-emerald-600" />选题项目配置</div>
                  <div className="rounded-md border-2 border-dashed border-emerald-200 bg-emerald-50/50 p-6 text-center">
                    <Settings className="mx-auto mb-2 size-8 text-emerald-300" />
                    <p className="text-sm text-emerald-700 font-medium">企业需求项目配置区域</p>
                    <p className="text-xs text-emerald-600 mt-1">此处将配置对应的能力模型和测评标准（待开发）</p>
                  </div>
                </div>
              )}

              {/* 能力要求配置模块 */}
              <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold"><Lightbulb className="size-4 text-amber-600" />能力要求配置</div>
                <div className="rounded-md border-2 border-dashed border-amber-200 bg-amber-50/50 p-6 text-center">
                  <Lightbulb className="mx-auto mb-2 size-8 text-amber-300" />
                  <p className="text-sm text-amber-700 font-medium">能力要求配置模块</p>
                  <p className="text-xs text-amber-600 mt-1">此处将配置学生完成该选题所需的能力要求、知识储备和技能等级（待开发）</p>
                </div>
              </div>
            </div>

            {/* 右侧：容量/日期/描述 + 指导团队 */}
            <div className="col-span-5 space-y-4">
              <div className="rounded-lg border p-4 space-y-3">
                <Label className="text-base font-semibold">基本信息</Label>
                <div className="grid gap-2"><Label>学生容量</Label><Input type="number" min={1} value={formData.capacity} onChange={(e) => setFormData({ ...formData, capacity: Number(e.target.value) })} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-2"><Label>开始日期 *</Label><Input type="date" value={formData.startDate} onChange={(e) => setFormData({ ...formData, startDate: e.target.value })} /></div>
                  <div className="grid gap-2"><Label>结束日期 *</Label><Input type="date" value={formData.endDate} onChange={(e) => setFormData({ ...formData, endDate: e.target.value })} /></div>
                </div>
                <div className="grid gap-2"><Label>选题描述</Label><Textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} placeholder="请输入选题描述" rows={3} /></div>
              </div>

              {/* 指导团队 */}
              {/* 指导教师 */}
              <div className="rounded-lg border p-4 space-y-3">
                <div className="flex items-center justify-between"><Label className="text-base font-semibold">指导教师 *</Label><Button variant="outline" size="sm" onClick={() => setAdvisorSearchOpen(true)}><UserCircle className="mr-1 size-3" />选择教师</Button></div>
                {formData.advisorNames.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {formData.advisorNames.map((name, i) => (
                      <Badge key={i} variant="secondary" className="gap-1">{name}<button onClick={() => setFormData({ ...formData, advisorNames: formData.advisorNames.filter((_, idx) => idx !== i) })} className="ml-1 rounded-full hover:bg-muted-foreground/20">×</button></Badge>
                    ))}
                  </div>
                ) : <div className="text-sm text-muted-foreground">未选择指导教师</div>}
              </div>
              {/* 企业导师 */}
              <div className="rounded-lg border p-4 space-y-3">
                <div className="flex items-center justify-between"><Label className="text-base font-semibold">企业导师</Label><Button variant="outline" size="sm" onClick={() => setMentorSearchOpen(true)}><Building2 className="mr-1 size-3" />选择导师</Button></div>
                {formData.mentorNames.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {formData.mentorNames.map((name, i) => (
                      <Badge key={i} variant="outline" className="gap-1">{name}<button onClick={() => setFormData({ ...formData, mentorNames: formData.mentorNames.filter((_, idx) => idx !== i) })} className="ml-1 rounded-full hover:bg-muted-foreground/20">×</button></Badge>
                    ))}
                  </div>
                ) : <div className="text-sm text-muted-foreground">未选择企业导师</div>}
              </div>
            </div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => { setFormOpen(false); resetForm() }}>取消</Button><Button onClick={handleSubmit}>{editingTopic ? '保存修改' : '发布选题'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 指导教师搜索弹窗 */}
      <Dialog open={advisorSearchOpen} onOpenChange={(open) => !open && setAdvisorSearchOpen(false)}>
        <DialogContent size="sm">
          <DialogHeader><DialogTitle>选择指导教师</DialogTitle></DialogHeader>
          <div className="py-2">
            <Input placeholder="搜索教师姓名或学院..." value={advisorSearchQuery} onChange={(e) => setAdvisorSearchQuery(e.target.value)} className="mb-3" />
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {filteredTeachers.map((t) => {
                const selected = formData.advisorNames.includes(t.name)
                return (
                  <div key={t.id} className={`flex items-center justify-between rounded-lg border px-3 py-2 cursor-pointer ${selected ? 'bg-blue-50 border-blue-200' : 'hover:bg-muted'}`} onClick={() => {
                    if (selected) setFormData({ ...formData, advisorNames: formData.advisorNames.filter(n => n !== t.name) })
                    else setFormData({ ...formData, advisorNames: [...formData.advisorNames, t.name] })
                  }}>
                    <div><div className="text-sm font-medium">{t.name}</div><div className="text-xs text-muted-foreground">{t.dept}</div></div>
                    {selected && <CheckCircle2 className="size-4 text-blue-600" />}
                  </div>
                )
              })}
            </div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setAdvisorSearchOpen(false)}>关闭</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 企业导师搜索弹窗 */}
      <Dialog open={mentorSearchOpen} onOpenChange={(open) => !open && setMentorSearchOpen(false)}>
        <DialogContent size="sm">
          <DialogHeader><DialogTitle>选择企业导师</DialogTitle></DialogHeader>
          <div className="py-2">
            <Input placeholder="搜索导师姓名或企业..." value={mentorSearchQuery} onChange={(e) => setMentorSearchQuery(e.target.value)} className="mb-3" />
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {filteredMentors.map((m) => {
                const selected = formData.mentorNames.includes(m.name)
                return (
                  <div key={m.id} className={`flex items-center justify-between rounded-lg border px-3 py-2 cursor-pointer ${selected ? 'bg-blue-50 border-blue-200' : 'hover:bg-muted'}`} onClick={() => {
                    if (selected) setFormData({ ...formData, mentorNames: formData.mentorNames.filter(n => n !== m.name) })
                    else setFormData({ ...formData, mentorNames: [...formData.mentorNames, m.name] })
                  }}>
                    <div><div className="text-sm font-medium">{m.name}</div><div className="text-xs text-muted-foreground">{m.company}</div></div>
                    {selected && <CheckCircle2 className="size-4 text-blue-600" />}
                  </div>
                )
              })}
            </div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setMentorSearchOpen(false)}>关闭</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 查看详情弹窗 */}
      <Dialog open={!!viewTopic} onOpenChange={(open) => !open && setViewTopic(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>选题详情</DialogTitle></DialogHeader>
          {viewTopic && (
            <div className="space-y-3 py-4 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">选题名称</span><span className="font-medium">{viewTopic.name}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">关联岗位</span><span>{viewTopic.positionName}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">选题来源</span><Badge variant="outline">{viewTopic.source === 'scene' ? '场景库' : '企业需求'}</Badge></div>
              <div className="flex justify-between"><span className="text-muted-foreground">状态</span>{getStatusBadge(viewTopic.status)}</div>
              <div className="flex justify-between"><span className="text-muted-foreground">学生容量</span><span>{viewTopic.appliedCount} / {viewTopic.capacity}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">指导教师</span><span>{viewTopic.advisorName}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">企业导师</span><span>{viewTopic.enterpriseMentorName || '-'}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">起止时间</span><span>{formatDate(viewTopic.startDate)} 至 {formatDate(viewTopic.endDate)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">描述</span><span className="max-w-[280px] text-right">{viewTopic.description || '-'}</span></div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setViewTopic(null)}>关闭</Button>
            {viewTopic && viewTopic.status === 'draft' && (
              <>
                <Button variant="outline" onClick={() => { setViewTopic(null); openEdit(viewTopic) }}><Pencil className="mr-2 size-4" />编辑</Button>
                <Button onClick={() => { setViewTopic(null); handleSubmitForApproval(viewTopic) }}><Send className="mr-2 size-4" />提交审批</Button>
              </>
            )}
            {viewTopic && viewTopic.status === 'pending' && (
              <>
                <Button variant="outline" className="text-amber-600" onClick={() => { setViewTopic(null); handleWithdrawApproval(viewTopic) }}><RotateCcw className="mr-2 size-4" />撤回</Button>
                <Button className="bg-emerald-500 hover:bg-emerald-600" onClick={() => { setViewTopic(null); handleApprove(viewTopic) }}><CheckCircle2 className="mr-2 size-4" />审批通过</Button>
                <Button variant="destructive" onClick={() => { setViewTopic(null); handleRejectApproval(viewTopic) }}><XCircle className="mr-2 size-4" />驳回</Button>
              </>
            )}
            {viewTopic && viewTopic.status === 'published' && (
              <>
                <Button variant="outline" className="text-amber-600" onClick={() => { setViewTopic(null); handleCancelPublish(viewTopic) }}><RotateCcw className="mr-2 size-4" />取消发布</Button>
                <Button className="bg-emerald-500 hover:bg-emerald-600" onClick={() => { setViewTopic(null); setLockTopic(viewTopic) }}><Lock className="mr-2 size-4" />锁定</Button>
              </>
            )}
            {viewTopic && viewTopic.status === 'locked' && (
              <Button variant="outline" className="text-amber-600" onClick={() => { setViewTopic(null); handleCancelLock(viewTopic) }}><Unlock className="mr-2 size-4" />取消锁定</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除确认弹窗 */}
      <Dialog open={!!deleteTopic} onOpenChange={(open) => !open && setDeleteTopic(null)}>
        <DialogContent size="sm">
          <DialogHeader><DialogTitle>确认删除</DialogTitle><DialogDescription>确定要删除选题「{deleteTopic?.name}」吗？此操作不可撤销。</DialogDescription></DialogHeader>
          <DialogFooter><Button variant="outline" onClick={() => setDeleteTopic(null)}>取消</Button><Button variant="destructive" onClick={handleDelete}><Trash2 className="mr-2 size-4" />删除</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 锁定确认弹窗 */}
      <Dialog open={!!lockTopic} onOpenChange={(open) => !open && setLockTopic(null)}>
        <DialogContent size="sm">
          <DialogHeader><DialogTitle>确认锁定选题</DialogTitle><DialogDescription>锁定后选题将不可再申请，并自动生成毕设项目档案。确定要锁定「{lockTopic?.name}」吗？</DialogDescription></DialogHeader>
          <DialogFooter><Button variant="outline" onClick={() => setLockTopic(null)}>取消</Button><Button onClick={handleLock}><Lock className="mr-2 size-4" />确认锁定</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 查看申请列表弹窗 */}
      <Dialog open={!!viewApplications} onOpenChange={(open) => !open && setViewApplications(null)}>
        <DialogContent size="xl" className="max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>「{viewApplications?.name}」选题申请列表</DialogTitle></DialogHeader>
          <div className="py-2">
            {viewApplications && topicApps(viewApplications.id).length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">暂无申请记录</div>
            ) : (
              <div className="rounded-lg border overflow-x-auto">
                <Table>
                  <TableHeader><TableRow><TableHead className="w-[90px]">学生</TableHead><TableHead className="w-[120px]">班级</TableHead><TableHead className="w-[180px]">申请理由</TableHead><TableHead className="w-[100px]">负责教师</TableHead><TableHead className="w-[120px]">申请时间</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {viewApplications && topicApps(viewApplications.id).map((app) => (
                      <TableRow key={app.id}>
                        <TableCell><span className="text-sm font-medium">{app.studentName}</span><div className="text-xs text-muted-foreground">{app.studentId}</div></TableCell>
                        <TableCell><span className="text-sm">{app.className}</span></TableCell>
                        <TableCell><span className="block max-w-[180px] truncate text-sm text-muted-foreground" title={app.applyReason}>{app.applyReason}</span></TableCell>
                        <TableCell><span className="text-sm">{app.allocatedAdvisorName || '—'}</span></TableCell>
                        <TableCell><span className="text-xs text-muted-foreground">{new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(app.appliedAt)}</span></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setViewApplications(null)}>关闭</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
