"use client"

import { useState, useMemo } from "react"
import { Search, User, BarChart3, TrendingUp, Award, Target, Users, Settings, Eye, Pencil, RefreshCw, SlidersHorizontal, Briefcase, BookOpen, GraduationCap, Layers, FileText, Star, Medal, MapPin, CheckCircle2, Clock, Calendar } from "lucide-react"
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
import { Progress } from "@/components/ui/progress"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
// import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useData } from "@/components/providers/data-provider"
import { useToast } from "@/hooks/use-toast"
import { StudentPortraitModal } from "@/components/shared/student-portrait-modal"
import type { StudentAbilityPortrait, EvaluationGrade, AbilityDomainScore } from "@/lib/types"
import { PrdAnnotation } from "@/components/prd-annotation"
import { getAnnotation } from "@/lib/prd-annotations"

export default function StudentAbilityPortraitsPage() {
  const { studentAbilityPortraits, portraitUpdateConfig, updateStudentAbilityPortrait, updatePortraitUpdateConfig } = useData()
  const { toast } = useToast()

  const [search, setSearch] = useState("")
  const [gradeFilter, setGradeFilter] = useState<string>("all")
  const [selectedClass, setSelectedClass] = useState<string>("all")
  const [navSearch, setNavSearch] = useState("")

  const [editPortrait, setEditPortrait] = useState<StudentAbilityPortrait | null>(null)
  const [editReason, setEditReason] = useState('')
  const [editDomains, setEditDomains] = useState<AbilityDomainScore[]>([])
  const [configOpen, setConfigOpen] = useState(false)
  const [compareOpen, setCompareOpen] = useState(false)
  const [recommendOpen, setRecommendOpen] = useState(false)
  const [generateOpen, setGenerateOpen] = useState(false)
  const [portraitModalOpen, setPortraitModalOpen] = useState(false)
  const [moduleConfigOpen, setModuleConfigOpen] = useState(false)

  const filteredPortraits = useMemo(() => {
    let list = [...studentAbilityPortraits]
    if (gradeFilter !== "all") list = list.filter((p) => p.overallGrade === gradeFilter)
    if (selectedClass !== "all") list = list.filter((p) => p.className === selectedClass)
    if (search.trim()) { const q = search.toLowerCase(); list = list.filter((p) => p.studentName.toLowerCase().includes(q) || p.studentId.toLowerCase().includes(q) || p.className.toLowerCase().includes(q) || p.positionName.toLowerCase().includes(q)) }
    return list
  }, [studentAbilityPortraits, gradeFilter, selectedClass, search])

  const groupedMajors = useMemo(() => {
    const majorMap = new Map<string, Set<string>>()
    studentAbilityPortraits.forEach((p) => {
      if (!majorMap.has(p.majorName)) majorMap.set(p.majorName, new Set())
      majorMap.get(p.majorName)!.add(p.className)
    })
    const result: { major: string; classes: string[] }[] = []
    majorMap.forEach((classes, major) => {
      if (!navSearch.trim() || major.toLowerCase().includes(navSearch.toLowerCase()) || Array.from(classes).some((c) => c.toLowerCase().includes(navSearch.toLowerCase()))) {
        result.push({ major, classes: Array.from(classes).sort() })
      }
    })
    return result.sort((a, b) => a.major.localeCompare(b.major))
  }, [studentAbilityPortraits, navSearch])

  const stats = useMemo(() => {
    const total = studentAbilityPortraits.length
    const avgScore = total > 0 ? Math.round(studentAbilityPortraits.reduce((sum, p) => {
      const domainLen = p.domainScores.length
      const avg = domainLen > 0 ? p.domainScores.reduce((s, d) => s + d.score, 0) / domainLen : 0
      return sum + avg
    }, 0) / total) : 0
    return { total, gradeA: studentAbilityPortraits.filter((p) => p.overallGrade === 'A').length, gradeB: studentAbilityPortraits.filter((p) => p.overallGrade === 'B').length, gradeC: studentAbilityPortraits.filter((p) => p.overallGrade === 'C').length, gradeD: studentAbilityPortraits.filter((p) => p.overallGrade === 'D').length, avgScore }
  }, [studentAbilityPortraits])

  const openEdit = (portrait: StudentAbilityPortrait) => {
    setEditPortrait(portrait)
    setEditDomains([...portrait.domainScores])
    setEditReason('')
  }
  const handleManualAdjust = () => {
    if (editPortrait && editReason.trim()) {
      const avg = editDomains.reduce((s, d) => s + d.score, 0) / editDomains.length
      let grade: EvaluationGrade = 'E'
      if (avg >= 90) grade = 'A'; else if (avg >= 80) grade = 'B'; else if (avg >= 70) grade = 'C'; else if (avg >= 60) grade = 'D'
      updateStudentAbilityPortrait(editPortrait.id, { domainScores: editDomains, overallGrade: grade })
      toast({ title: '画像数据已手动调整' }); setEditPortrait(null); setEditReason('')
    } else { toast({ title: '请填写调整原因', variant: 'destructive' }) }
  }
  const handleGenerate = () => { toast({ title: '画像生成引擎已启动，正在重新计算所有学生能力画像...' }); setGenerateOpen(false) }

  const getGradeBadge = (grade: EvaluationGrade) => {
    const colors: Record<EvaluationGrade, string> = { A: 'bg-emerald-500', B: 'bg-blue-500', C: 'bg-amber-500', D: 'bg-orange-500', E: 'bg-red-500' }
    return <Badge variant="default" className={`${colors[grade]} gap-1`}>{grade}</Badge>
  }
  const formatDate = (date: Date) => new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" }).format(date)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-800">学生画像管理</h1>
          <p className="text-sm text-gray-500 mt-1">基于课程任务、实践场景、毕设评价、档案材料等全量数据，自动生成学生能力画像</p>
        </div>
        <div className="flex items-center gap-2">
          <PrdAnnotation data={getAnnotation("sp-btn-generate")}><Button variant="outline" onClick={() => setGenerateOpen(true)}><RefreshCw className="mr-2 size-4" />手动更新画像</Button></PrdAnnotation>
          <PrdAnnotation data={getAnnotation("sp-btn-config-time")}><Button variant="outline" onClick={() => setConfigOpen(true)}><Settings className="mr-2 size-4" />画像更新时间</Button></PrdAnnotation>
          <PrdAnnotation data={getAnnotation("sp-btn-module-config")}><Button variant="outline" onClick={() => setModuleConfigOpen(true)}><SlidersHorizontal className="mr-2 size-4" />学生画像模块配置</Button></PrdAnnotation>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* 左侧专业-班级导航 */}
        <div className="col-span-3">
          <div className="rounded-lg border bg-white">
            <div className="border-b p-3">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input placeholder="搜索专业或班级..." value={navSearch} onChange={(e) => setNavSearch(e.target.value)} className="h-8 pl-7 text-xs" />
              </div>
            </div>
            <div className="max-h-[calc(100vh-280px)] overflow-y-auto p-2">
              <button
                onClick={() => setSelectedClass("all")}
                className={`flex w-full items-center rounded-md px-2 py-1.5 text-left text-sm transition-colors ${selectedClass === 'all' ? 'bg-blue-50 text-blue-700 font-medium' : 'hover:bg-muted'}`}
              >
                <span>全部班级</span>
                <span className="ml-auto text-xs text-muted-foreground">{studentAbilityPortraits.length}</span>
              </button>
              {groupedMajors.map(({ major, classes }) => (
                <div key={major} className="mb-2">
                  <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">{major}</div>
                  <div className="space-y-1">
                    {classes.map((cls) => {
                      const count = studentAbilityPortraits.filter((p) => p.className === cls).length
                      const isActive = selectedClass === cls
                      return (
                        <button
                          key={cls}
                          onClick={() => setSelectedClass(cls)}
                          className={`flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm transition-colors ${isActive ? 'bg-blue-50 text-blue-700 font-medium' : 'hover:bg-muted'}`}
                        >
                          <span>{cls}</span>
                          <span className="text-xs text-muted-foreground">{count}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 右侧学生列表 */}
        <div className="col-span-9 space-y-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="relative flex-1 sm:max-w-xs"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input placeholder="搜索姓名、学号、班级或岗位..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" /></div>
            <Select value={gradeFilter} onValueChange={setGradeFilter}><SelectTrigger className="w-[140px]"><SelectValue placeholder="全部等级" /></SelectTrigger><SelectContent><SelectGroup><SelectItem value="all">全部等级</SelectItem><SelectItem value="A">A - 优秀</SelectItem><SelectItem value="B">B - 良好</SelectItem><SelectItem value="C">C - 中等</SelectItem><SelectItem value="D">D - 及格</SelectItem><SelectItem value="E">E - 不及格</SelectItem></SelectGroup></SelectContent></Select>
          </div>
          <div className="rounded-lg border bg-white px-4 py-3">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow><TableHead className="w-[100px]"><PrdAnnotation data={getAnnotation("sp-col-student-id")}>学号</PrdAnnotation></TableHead><TableHead className="w-[100px]"><PrdAnnotation data={getAnnotation("sp-col-student-name")}>姓名</PrdAnnotation></TableHead><TableHead className="w-[160px]"><PrdAnnotation data={getAnnotation("sp-col-class")}>班级</PrdAnnotation></TableHead><TableHead className="w-[140px]"><PrdAnnotation data={getAnnotation("sp-col-major")}>专业</PrdAnnotation></TableHead><TableHead className="sticky right-0 w-[140px] bg-white text-right"><PrdAnnotation data={getAnnotation("sp-col-actions")}>操作</PrdAnnotation></TableHead></TableRow></TableHeader>
                <TableBody>
                  {filteredPortraits.length === 0 ? (<TableRow><TableCell colSpan={5} className="h-24 text-center text-muted-foreground">暂无画像记录</TableCell></TableRow>) : (filteredPortraits.map((portrait) => (
                    <TableRow key={portrait.id}>
                      <TableCell><span className="text-sm text-muted-foreground">{portrait.studentId}</span></TableCell>
                      <TableCell><span className="text-sm font-medium">{portrait.studentName}</span></TableCell>
                      <TableCell><span className="text-sm">{portrait.className}</span></TableCell>
                      <TableCell><span className="text-sm text-muted-foreground">{portrait.majorName}</span></TableCell>
                      <TableCell className="sticky right-0 bg-white text-right">
                        <PrdAnnotation data={getAnnotation("sp-col-actions")}><Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={() => setPortraitModalOpen(true)}><Eye className="size-3" />查看学生画像</Button></PrdAnnotation>
                      </TableCell>
                    </TableRow>
                  )))}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      </div>


      {/* 手动维护弹窗 */}
      <Dialog open={!!editPortrait} onOpenChange={(open) => !open && setEditPortrait(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>手动维护画像数据</DialogTitle></DialogHeader>
          {editPortrait && (
            <div className="space-y-4 py-4">
              <div className="text-sm text-muted-foreground">学生：{editPortrait.studentName}（{editPortrait.studentId}）</div>
              <div className="rounded-lg border p-3">
                <h4 className="mb-3 text-xs font-semibold text-muted-foreground">能力领域得分调整</h4>
                <div className="space-y-3">
                  {editDomains.map((domain, i) => (
                    <div key={domain.domain} className="flex items-center gap-3">
                      <span className="w-20 text-sm">{domain.domainLabel}</span>
                      <Input type="number" min={0} max={100} value={domain.score} onChange={(e) => { const next = [...editDomains]; next[i] = { ...next[i], score: Number(e.target.value) }; setEditDomains(next) }} className="w-24" />
                      <Progress value={domain.score} className="h-2 flex-1" />
                    </div>
                  ))}
                </div>
              </div>
              <div className="grid gap-2"><Label>调整原因 *</Label><Textarea value={editReason} onChange={(e) => setEditReason(e.target.value)} placeholder="请详细说明调整原因..." rows={3} /></div>
            </div>
          )}
          <DialogFooter><Button variant="outline" onClick={() => { setEditPortrait(null); setEditReason('') }}>取消</Button><Button onClick={handleManualAdjust}><Pencil className="mr-2 size-4" />确认维护</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 画像更新时间弹窗 */}
      <Dialog open={configOpen} onOpenChange={(open) => !open && setConfigOpen(false)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>画像更新时间</DialogTitle></DialogHeader>
          <div className="py-4">
            <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
              <div className="text-sm">
                <span className="text-muted-foreground">画像自动更新周期：</span>
                <span className="font-medium">每日更新</span>
              </div>
              <div className="text-sm">
                <span className="text-muted-foreground">更新时间：</span>
                <span className="font-medium">每天凌晨 2 点</span>
              </div>
              <div className="text-sm">
                <span className="text-muted-foreground">最后更新时间：</span>
                <span className="font-medium">2026/2/1 2:00</span>
              </div>
            </div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setConfigOpen(false)}>关闭</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 画像对比分析弹窗 */}
      <Dialog open={compareOpen} onOpenChange={(open) => !open && setCompareOpen(false)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader><DialogTitle>学生能力画像对比分析</DialogTitle></DialogHeader>
          <div className="py-4">
            <div className="rounded-lg border p-4">
              <h4 className="mb-3 text-sm font-semibold">班级/专业/年级能力分布对比</h4>
              <div className="space-y-3">
                {['2021级全栈开发1班', '2021级后端开发1班', '2021级前端开发1班'].map((cls, i) => (
                  <div key={cls} className="space-y-1">
                    <div className="flex justify-between text-xs font-medium"><span>{cls}</span><span>平均能力分：{[82, 78, 75][i]}</span></div>
                    <Progress value={[82, 78, 75][i]} className="h-2" />
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-4 rounded-lg border p-4">
              <h4 className="mb-3 text-sm font-semibold">能力领域横向对比</h4>
              <div className="grid grid-cols-5 gap-2 text-center text-xs">
                {['行业认知', '专业知识', '专业技能', '通用能力', '职业素养'].map((label, i) => (
                  <div key={label} className="rounded-md bg-muted p-2">
                    <div className="font-medium">{label}</div>
                    <div className="mt-1 text-lg font-bold text-blue-600">{[78, 85, 80, 76, 82][i]}</div>
                    <div className="text-muted-foreground">班级均分</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setCompareOpen(false)}>关闭</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 就业推荐配置弹窗 */}
      <Dialog open={recommendOpen} onOpenChange={(open) => !open && setRecommendOpen(false)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>就业推荐配置</DialogTitle></DialogHeader>
          <div className="py-4">
            <div className="rounded-lg border p-4 space-y-3">
              <div className="flex items-center justify-between text-sm"><span>AI匹配算法</span><Badge variant="outline">岗位胜任力模型匹配</Badge></div>
              <div className="flex items-center justify-between text-sm"><span>匹配权重-能力得分</span><span className="font-medium">60%</span></div>
              <div className="flex items-center justify-between text-sm"><span>匹配权重-学历评价</span><span className="font-medium">25%</span></div>
              <div className="flex items-center justify-between text-sm"><span>匹配权重-档案材料</span><span className="font-medium">15%</span></div>
              <div className="flex items-center gap-2 pt-2"><Switch defaultChecked /><Label>启用企业招聘人才筛选</Label></div>
            </div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setRecommendOpen(false)}>关闭</Button><Button onClick={() => { toast({ title: '推荐配置已保存' }); setRecommendOpen(false) }}><SlidersHorizontal className="mr-2 size-4" />保存配置</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 画像生成弹窗 */}
      <Dialog open={generateOpen} onOpenChange={(open) => !open && setGenerateOpen(false)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>手动更新学生能力画像</DialogTitle></DialogHeader>
          <div className="py-4">
            <div className="rounded-lg bg-blue-50 p-4 text-sm text-blue-800">
              <div className="font-medium mb-1">画像生成引擎将执行以下操作：</div>
              <ul className="list-disc list-inside space-y-1 text-xs text-blue-700">
                <li>聚合课程任务完成情况数据</li>
                <li>聚合实践场景测评结果数据</li>
                <li>聚合毕设评价数据</li>
                <li>聚合档案材料审核数据</li>
                <li>重新计算各能力点得分和综合评级</li>
              </ul>
            </div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setGenerateOpen(false)}>取消</Button><Button onClick={handleGenerate}><RefreshCw className="mr-2 size-4" />确认手动更新</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 学生画像详情弹窗（HTML） */}
      <StudentPortraitModal
        open={portraitModalOpen}
        onOpenChange={setPortraitModalOpen}
      />

      {/* 学生画像模块配置弹窗 */}
      <Dialog open={moduleConfigOpen} onOpenChange={(open) => !open && setModuleConfigOpen(false)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>学生画像模块配置</DialogTitle></DialogHeader>
          <div className="py-4 space-y-4">
            <div className="rounded-lg border p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium">课程成绩</div>
                  <div className="text-xs text-muted-foreground">在学生画像中展示课程成绩模块</div>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium">毕业设计</div>
                  <div className="text-xs text-muted-foreground">在学生画像中展示毕业设计模块</div>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium">荣誉</div>
                  <div className="text-xs text-muted-foreground">在学生画像中展示获得荣誉模块</div>
                </div>
                <Switch defaultChecked />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModuleConfigOpen(false)}>取消</Button>
            <Button onClick={() => { toast({ title: '模块配置已保存' }); setModuleConfigOpen(false) }}><Settings className="mr-2 size-4" />保存配置</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
