"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import {
  BookOpen,
  Bot,
  ExternalLink,
  LayoutGrid,
  MessageCircle,
  Plus,
  Search,
  Send,
  Sparkles,
  X,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
interface AppModule {
  id: string
  title: string
  desc: string
  href: string
}

type ResourceCategory = "knowledge" | "agent" | "platform"



interface Resource {
  id: string
  category: ResourceCategory
  title: string
  desc: string
  tags?: string[]
  icon: string
  color: string
  platformId?: string
  originalId?: number
  originalType?: "kb" | "bot"
  href?: string
}

interface QuickAction {
  id: string
  label: string
  icon: string
  href: string
  color: string
}

const RESOURCES: Resource[] = [
  {
    id: "finance-kb",
    category: "knowledge",
    title: "金融专业知识库",
    desc: "覆盖银行、证券、保险等金融岗位核心知识与案例。",
    tags: ["金融", "专业"],
    icon: "book",
    color: "bg-amber-50 text-amber-600 border-amber-100",
  },
  {
    id: "logistics-kb",
    category: "knowledge",
    title: "物流专业知识库",
    desc: "仓储、运输、供应链管理等物流领域知识沉淀。",
    tags: ["物流", "专业"],
    icon: "book",
    color: "bg-emerald-50 text-emerald-600 border-emerald-100",
  },
  {
    id: "cnc-kb",
    category: "knowledge",
    title: "数控实训知识库",
    desc: "数控加工、设备操作与维护等实训资源汇总。",
    tags: ["数控", "实训"],
    icon: "book",
    color: "bg-blue-50 text-blue-600 border-blue-100",
  },
  {
    id: "hotel-kb",
    category: "knowledge",
    title: "酒店管理案例库",
    desc: "前厅、客房、餐饮等酒店服务真实教学案例。",
    tags: ["酒店", "案例"],
    icon: "book",
    color: "bg-rose-50 text-rose-600 border-rose-100",
  },
  {
    id: "position-agent",
    category: "agent",
    title: "岗位 AI 辅助创建",
    desc: "根据专业方向快速生成岗位能力模型与任务。",
    tags: ["官方", "岗位", "创建"],
    icon: "bot",
    color: "bg-indigo-50 text-indigo-600 border-indigo-100",
    originalId: 5,
    originalType: "bot",
    href: "http://demo2.zhiyu.com.cn:5000/job_ai",
  },
  {
    id: "scene-agent",
    category: "agent",
    title: "场景 AI 辅助创建",
    desc: "智能拆解岗位任务，生成配套实践场景。",
    tags: ["官方", "场景", "创建"],
    icon: "bot",
    color: "bg-cyan-50 text-cyan-600 border-cyan-100",
    originalId: 6,
    originalType: "bot",
    href: "http://demo2.zhiyu.com.cn:5000/scene_ai",
  },
  {
    id: "qa-robot",
    category: "agent",
    title: "课程答疑机器人",
    desc: "7×24 小时解答课程知识点与学习路径问题。",
    tags: ["答疑", "课程"],
    icon: "bot",
    color: "bg-violet-50 text-violet-600 border-violet-100",
  },
  {
    id: "custom-robot",
    category: "agent",
    title: "师生自建机器人",
    desc: "支持师生自定义知识库，打造专属智能体。",
    tags: ["自建", "自定义"],
    icon: "bot",
    color: "bg-fuchsia-50 text-fuchsia-600 border-fuchsia-100",
  },
  {
    id: "brand-platform",
    category: "platform",
    title: "产业联盟与品牌运营平台",
    desc: "校企合作单位、重点项目与专家资源统一展示。",
    tags: ["校企", "品牌"],
    icon: "external",
    color: "bg-rose-50 text-rose-600 border-rose-100",
    platformId: "alliance",
  },
  {
    id: "career-platform",
    category: "platform",
    title: "职业岗位学习平台",
    desc: "岗位能力模型、典型任务与证书要求一站呈现。",
    tags: ["岗位", "学习"],
    icon: "external",
    color: "bg-purple-50 text-purple-600 border-purple-100",
    platformId: "career",
  },
  {
    id: "scene-platform",
    category: "platform",
    title: "实践场景学习平台",
    desc: "按专业浏览已发布实践场景，一键进入详情。",
    tags: ["场景", "实训"],
    icon: "external",
    color: "bg-cyan-50 text-cyan-600 border-cyan-100",
    platformId: "scene",
  },
  {
    id: "eval-platform",
    category: "platform",
    title: "能力评价与测评资源管理平台",
    desc: "能力画像对比认证标准，推荐测评与练习资源。",
    tags: ["测评", "认证"],
    icon: "external",
    color: "bg-emerald-50 text-emerald-600 border-emerald-100",
    platformId: "ability",
  },
]

const QUICK_ACTIONS: QuickAction[] = [
  {
    id: "create-position",
    label: "我要建岗位",
    icon: "plus",
    href: "http://111.170.170.202:3002/positions",
    color: "bg-purple-50 text-purple-600 border-purple-100 hover:bg-purple-100",
  },
  {
    id: "create-scene",
    label: "我要建场景",
    icon: "plus",
    href: "http://111.170.170.202:3003/",
    color: "bg-cyan-50 text-cyan-600 border-cyan-100 hover:bg-cyan-100",
  },
  {
    id: "ai-create-position",
    label: "我要 AI 帮我建岗位",
    icon: "sparkles",
    href: "http://demo2.zhiyu.com.cn:5000/job_ai",
    color: "bg-indigo-50 text-indigo-600 border-indigo-100 hover:bg-indigo-100",
  },
]

const APP_MODULES: Record<string, { id: string; title: string; desc: string; href: string }[]> = {
  alliance: [
    { id: "alliance-1", title: "产教融合管理", desc: "产教资源协同对接中枢", href: "http://111.170.170.202:3004/admin" },
    { id: "alliance-2", title: "品牌运营管理", desc: "品牌资产配置与发布管理", href: "http://111.170.170.202:3004/admin/brands" },
    { id: "alliance-3", title: "就业服务管理", desc: "就业项目与岗位推荐管理", href: "http://111.170.170.202:3004/admin/employment" },
    { id: "alliance-4", title: "【企业端】服务平台", desc: "企业合作伙伴登录入口", href: "http://111.170.170.202:3004/partner/login" },
  ],
  career: [
    { id: "career-1", title: "岗位资源管理", desc: "职业岗位资源与能力模型管理", href: "http://111.170.170.202:3002/positions" },
    { id: "career-2", title: "批次分组管理", desc: "批次分组与审批关联管理", href: "http://111.170.170.202:3002/batches" },
    { id: "career-3", title: "审批流程管理", desc: "审批流模板预设与配置", href: "http://111.170.170.202:3002/workflows" },
  ],
  scene: [
    { id: "scene-1", title: "场景资源管理", desc: "实践场景资源总览与管理", href: "http://111.170.170.202:3003/" },
    { id: "scene-2", title: "批次分组管理", desc: "批次分组与审批关联管理", href: "http://111.170.170.202:3003/batches" },
    { id: "scene-3", title: "审批流程管理", desc: "审批流模板预设配置", href: "http://111.170.170.202:3003/workflows" },
  ],
  ability: [
    { id: "ability-1", title: "通用测评管理", desc: "测评题库与通用测评管理", href: "http://111.170.170.202:3005/question-banks" },
    { id: "ability-2", title: "岗位认定管理", desc: "岗位能力模型与认定管理", href: "http://111.170.170.202:3005/job-ability" },
    { id: "ability-3", title: "测评方式库", desc: "能力测评方法与量规配置", href: "http://111.170.170.202:3005/evaluation-methods" },
    { id: "ability-4", title: "毕业设计管理", desc: "毕业设计选题与评审管理", href: "http://111.170.170.202:3005/graduation-project/topics" },
    { id: "ability-5", title: "学生画像管理", desc: "学生能力画像与成长档案", href: "http://111.170.170.202:3005/student-portrait/portraits" },
  ],
}

const PROMPT_TAGS = [
  { label: "建岗位", value: "我要建岗位" },
  { label: "建场景", value: "我要建场景" },
  { label: "AI建岗", value: "我要AI帮我建岗位" },
  { label: "网络安全", value: "我想做网络安全工程师，需要学什么？" },
  { label: "实训场景", value: "信息安全专业有哪些实训场景？" },
  { label: "岗位认证", value: "我距离岗位认证还差哪些能力？" },
  { label: "校企合作", value: "我们学校有哪些校企合作单位？" },
]

const CATEGORY_META: Record<
  ResourceCategory,
  { label: string; icon: string; color: string }
> = {
  knowledge: { label: "学校知识库", icon: "book", color: "text-amber-600" },
  agent: { label: "智能体助手", icon: "bot", color: "text-indigo-600" },
  platform: { label: "外部教学平台", icon: "external", color: "text-cyan-600" },
}

interface ChatMessage {
  id: string
  role: "user" | "assistant"
  content: string
  recommendations?: Resource[]
  quickActions?: QuickAction[]
}

function getIcon(name: string) {
  const className = "w-4 h-4"
  switch (name) {
    case "book":
      return <BookOpen className={className} />
    case "bot":
      return <Bot className={className} />
    case "external":
      return <ExternalLink className={className} />
    case "sparkles":
      return <Sparkles className={className} />
    case "plus":
      return <Plus className={className} />
    default:
      return <LayoutGrid className={className} />
  }
}

function ModuleItem({ module }: { module: AppModule }) {
  if (!module.href) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-muted-foreground opacity-60 bg-muted/50">
        <LayoutGrid className="w-3 h-3" />
        <span>{module.title}</span>
      </div>
    )
  }

  return (
    <a
      href={module.href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-foreground hover:bg-primary/5 hover:text-primary transition-colors group"
    >
      <ExternalLink className="w-3 h-3 text-muted-foreground group-hover:text-primary" />
      <span className="line-clamp-1">{module.title}</span>
    </a>
  )
}

function ResourceItem({
  resource,
  expanded,
  onToggle,
  modules,
}: {
  resource: Resource
  expanded: boolean
  onToggle: () => void
  modules: AppModule[]
}) {
  const isExpandable = resource.category === "platform"
  const isClickable = resource.originalType === "kb" || resource.originalType === "bot"

  const handleClick = () => {
    if (resource.href) {
      window.open(resource.href, "_blank")
    }
  }

  return (
    <div
      className={cn(
        "rounded-xl border transition-all duration-200 overflow-hidden",
        resource.color.replace(/text-\w+-600/g, "").trim(),
        isExpandable ? "hover:shadow-md hover:border-primary/40 hover:-translate-y-0.5 cursor-pointer" : isClickable ? "hover:shadow-md hover:border-primary/40 hover:-translate-y-0.5 cursor-pointer" : "opacity-80"
      )}
    >
      <button
        onClick={isClickable ? handleClick : onToggle}
        className="w-full text-left p-3 group"
        disabled={!isExpandable && !isClickable}
      >
        <div className="flex items-start gap-3">
          <div
            className={cn(
              "w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-110",
              resource.color
            )}
          >
            {getIcon(resource.icon)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h4 className="font-medium text-sm text-foreground truncate group-hover:text-primary transition-colors duration-200">
                {resource.title}
              </h4>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
              {resource.desc}
            </p>
            {resource.tags && (
              <div className="flex flex-wrap gap-1 mt-2">
                {resource.tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="text-[10px] px-1.5 py-0">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>
      </button>

      {isExpandable && expanded && (
        <div className="border-t bg-muted/30 px-2 py-2">
          {modules.length > 0 ? (
            <div className="grid grid-cols-2 gap-1">
              {modules.map((m) => (
                <ModuleItem key={m.id} module={m} />
              ))}
            </div>
          ) : (
            <div className="text-center py-3 text-xs text-muted-foreground">
              暂无模块配置
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function QuickActionItem({ action }: { action: QuickAction }) {
  return (
    <a
      href={action.href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium transition-all duration-200 group hover:shadow-sm active:scale-[0.98]",
        action.color
      )}
    >
      {getIcon(action.icon)}
      <span>{action.label}</span>
      <ExternalLink className="w-3 h-3 ml-auto opacity-40 group-hover:opacity-100 transition-opacity" />
    </a>
  )
}

export function YiKnowAssistant() {
  const [open, setOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<ResourceCategory | "all">("all")
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [inputValue, setInputValue] = useState("")
  const [isTyping, setIsTyping] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  const getModules = (platformId: string) => APP_MODULES[platformId] || []

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [chatMessages, isTyping])

  const isOfficialAgent = (resource: Resource) =>
    resource.category === "agent" && resource.tags?.includes("官方")

  const filteredResources = useMemo(() => {
    const query = inputValue.trim().toLowerCase()
    const list = RESOURCES.filter((resource) => {
      const matchesCategory = activeTab === "all" || resource.category === activeTab
      const matchesQuery =
        !query ||
        resource.title.toLowerCase().includes(query) ||
        resource.desc.toLowerCase().includes(query) ||
        resource.tags?.some((t) => t.toLowerCase().includes(query))
      return matchesCategory && matchesQuery
    })

    if (activeTab !== "agent") return list

    return list.slice().sort((a, b) => {
      const aOfficial = isOfficialAgent(a) ? 1 : 0
      const bOfficial = isOfficialAgent(b) ? 1 : 0
      if (aOfficial !== bOfficial) return bOfficial - aOfficial
      if (!aOfficial) return 0
      // 官方智能体中，岗位 > 场景 > 其他
      const aName = a.title.toLowerCase()
      const bName = b.title.toLowerCase()
      const aIsPosition = aName.includes("岗位")
      const bIsPosition = bName.includes("岗位")
      const aIsScene = aName.includes("场景")
      const bIsScene = bName.includes("场景")
      if (aIsPosition && !bIsPosition) return -1
      if (!aIsPosition && bIsPosition) return 1
      if (aIsScene && !bIsScene && !bIsPosition) return -1
      if (!aIsScene && bIsScene && !aIsPosition) return 1
      return 0
    })
  }, [activeTab, inputValue, isOfficialAgent])

  const isChatMode = chatMessages.length > 0 || isTyping

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  function generateReply(question: string): {
    reply: string
    recommendations: Resource[]
    quickActions?: QuickAction[]
  } {
    let reply = ""
    let recommendations: Resource[] = []
    let quickActions: QuickAction[] | undefined

    const q = question.toLowerCase()

    if (q.includes("我要建岗位")) {
      reply = "已为你找到岗位管理入口，点击即可进入岗位新建页面。"
      quickActions = QUICK_ACTIONS.filter((a) => a.id === "create-position")
    } else if (q.includes("我要建场景")) {
      reply = "已为你找到新建场景入口，点击即可进入场景新建页面。"
      quickActions = QUICK_ACTIONS.filter((a) => a.id === "create-scene")
    } else if (q.includes("我要ai帮我建岗位")) {
      reply = "已为你唤起 AI 智能体，点击即可使用 AI 辅助创建岗位。"
      quickActions = QUICK_ACTIONS.filter((a) => a.id === "ai-create-position")
    } else if (q.includes("网络安全工程师") || q.includes("岗位")) {
      reply =
        "推荐你进入【职业岗位学习平台】的网络安全工程师岗位页面。该岗位需要掌握网络协议分析、安全设备配置、渗透测试与日志审计等能力，涉及 NISP、CISP 等证书。建议先学习《网络协议与安全基础》，再完成对应实训场景。"
      recommendations = RESOURCES.filter((r) =>
        ["career-platform", "finance-kb", "position-agent"].includes(r.id)
      )
    } else if (q.includes("实训场景") || q.includes("信息安全")) {
      reply =
        "信息安全专业已发布 12 个实践场景，包括 Web 渗透测试、内网安全加固、日志审计分析等。每个场景已标注关联岗位、能力点和任务数，你可以直接进入【实践场景学习平台】查看详情。"
      recommendations = RESOURCES.filter((r) =>
        ["scene-platform", "cnc-kb", "scene-agent"].includes(r.id)
      )
    } else if (q.includes("岗位认证") || q.includes("能力")) {
      reply =
        "根据你的能力画像对比网络安全工程师岗位认证标准：已达成网络基础、系统配置；待提升渗透测试、安全报告撰写。已为你推荐对应测评任务和 3 个练习资源。"
      recommendations = RESOURCES.filter((r) =>
        ["eval-platform", "qa-robot", "custom-robot"].includes(r.id)
      )
    } else if (q.includes("校企合作") || q.includes("合作单位")) {
      reply =
        "学校现有 8 家深度合作企业，包括金融科技、智能制造、现代服务等领域。你可以在【产业联盟与品牌运营平台】查看合作类型、重点项目成果及专家资源。"
      recommendations = RESOURCES.filter((r) =>
        ["brand-platform", "hotel-kb", "logistics-kb"].includes(r.id)
      )
    } else {
      reply =
        "我帮你找到了一些相关资源，你可以点击卡片快速查看。如需更精准的推荐，可以补充专业、年级或目标岗位。"
      recommendations = RESOURCES.filter((r) => {
        return (
          r.title.toLowerCase().includes(q) ||
          r.desc.toLowerCase().includes(q) ||
          r.tags?.some((t) => t.toLowerCase().includes(q))
        )
      }).slice(0, 4)
      if (recommendations.length === 0) {
        recommendations = RESOURCES.slice(0, 3)
      }
    }

    return { reply, recommendations, quickActions }
  }

  const handleSend = () => {
    const question = inputValue.trim()
    if (!question || isTyping) return

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: question,
    }
    setChatMessages((prev) => [...prev, userMsg])
    setInputValue("")
    setIsTyping(true)

    setTimeout(() => {
      const { reply, recommendations, quickActions } = generateReply(question)

      const assistantMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: reply,
        recommendations,
        quickActions,
      }
      setChatMessages((prev) => [...prev, assistantMsg])
      setIsTyping(false)
    }, 800)
  }

  const handleCloseChat = () => {
    setChatMessages([])
    setInputValue("")
    setIsTyping(false)
  }

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen)
    if (!nextOpen) {
      setInputValue("")
      setChatMessages([])
      setExpandedIds(new Set())
      setActiveTab("all")
    }
  }

  const resourceList = (
    <div className="space-y-2">
      {filteredResources.map((r) => (
        <ResourceItem
          key={r.id}
          resource={r}
          expanded={expandedIds.has(r.id)}
          onToggle={() => toggleExpand(r.id)}
          modules={r.platformId ? getModules(r.platformId) : []}
        />
      ))}
      {filteredResources.length === 0 && (
        <div className="text-center py-8 text-sm text-muted-foreground">
          未找到相关资源
        </div>
      )}
    </div>
  )

  const groupedResourceList = (
    <div className="space-y-4">
      {(Object.keys(CATEGORY_META) as ResourceCategory[]).map((cat) => {
        const items = filteredResources.filter((r) => r.category === cat)
        if (items.length === 0) return null
        return (
          <div key={cat}>
            <div className="flex items-center gap-2 mb-2.5">
              <div className="w-5 h-5 rounded-md bg-muted/60 flex items-center justify-center">
                {getIcon(CATEGORY_META[cat].icon)}
              </div>
              <h4 className="text-xs font-semibold text-muted-foreground/70 uppercase tracking-wider">
                {CATEGORY_META[cat].label}
              </h4>
              <div className="flex-1 h-px bg-gradient-to-r from-border/60 to-transparent ml-1" />
            </div>
            <div className="space-y-2">
              {items.map((r) => (
                <ResourceItem
                  key={r.id}
                  resource={r}
                  expanded={expandedIds.has(r.id)}
                  onToggle={() => toggleExpand(r.id)}
                  modules={r.platformId ? getModules(r.platformId) : []}
                />
              ))}
            </div>
          </div>
        )
      })}
      {filteredResources.length === 0 && (
        <div className="text-center py-8 text-sm text-muted-foreground">
          未找到相关资源，换个关键词试试
        </div>
      )}
    </div>
  )

  const chatView = (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between px-3 py-2 border-b bg-gradient-to-r from-primary/[0.04] to-transparent shrink-0">
        <div className="flex items-center gap-2">
          <MessageCircle className="w-4 h-4 text-primary" />
          <span className="text-xs font-medium">AI 对话</span>
        </div>
        <button
          onClick={handleCloseChat}
          className="w-6 h-6 rounded-full hover:bg-muted/80 flex items-center justify-center transition-all duration-200 hover:scale-105 active:scale-95"
          title="返回导航面板"
        >
          <X className="w-3.5 h-3.5 text-muted-foreground" />
        </button>
      </div>
      <div className="flex-1 h-full overflow-y-auto scrollbar-thin px-3 py-2" ref={scrollRef}>
        <div className="space-y-3">
          {chatMessages.map((msg) => (
            <div
              key={msg.id}
              className={cn(
                "flex gap-2",
                msg.role === "user" ? "justify-end" : "justify-start"
              )}
            >
              {msg.role === "assistant" && (
                <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0 mt-0.5">
                  <Sparkles className="w-3 h-3" />
                </div>
              )}
              <div
                className={cn(
                  "max-w-[90%] rounded-2xl px-3 py-2 text-xs leading-relaxed shadow-sm",
                  msg.role === "user"
                    ? "bg-gradient-to-br from-primary to-primary/90 text-primary-foreground rounded-br-none"
                    : "bg-background border rounded-bl-none"
                )}
              >
                {msg.content}
                {msg.quickActions && msg.quickActions.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {msg.quickActions.map((action) => (
                      <QuickActionItem key={action.id} action={action} />
                    ))}
                  </div>
                )}
                {msg.recommendations && msg.recommendations.length > 0 && (
                  <div className="mt-2 space-y-1">
                    <p className="text-[10px] text-muted-foreground">为你推荐：</p>
                    {msg.recommendations.map((r) => (
                      <div
                        key={r.id}
                        className="flex items-center gap-2 p-1.5 rounded-md bg-muted/60 hover:bg-muted cursor-pointer"
                        onClick={() => {
                          if (r.platformId) {
                            setActiveTab("platform")
                            setExpandedIds((prev) => new Set(prev).add(r.id))
                          } else {
                            setActiveTab(r.category)
                          }
                        }}
                      >
                        <span className={CATEGORY_META[r.category].color}>
                          {getIcon(r.icon)}
                        </span>
                        <span className="text-[10px] truncate flex-1">{r.title}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
          {isTyping && (
            <div className="flex gap-2 justify-start">
              <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0 mt-0.5">
                <Sparkles className="w-3 h-3" />
              </div>
              <div className="bg-background border rounded-2xl rounded-bl-none px-3 py-2 text-xs text-muted-foreground shadow-sm flex items-center gap-1.5">
                <span className="inline-flex gap-0.5">
                  <span className="w-1 h-1 rounded-full bg-primary/40 animate-bounce" style={{ animationDelay: "0ms", animationDuration: "1.2s" }} />
                  <span className="w-1 h-1 rounded-full bg-primary/40 animate-bounce" style={{ animationDelay: "200ms", animationDuration: "1.2s" }} />
                  <span className="w-1 h-1 rounded-full bg-primary/40 animate-bounce" style={{ animationDelay: "400ms", animationDuration: "1.2s" }} />
                </span>
                <span>思考中</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )

  if (dismissed) return null

  return (
    <>
      {/* Floating robot button */}
      <div className="fixed bottom-6 right-5 z-[100] yi-robot-wrap flex items-end gap-3 group">
        {/* Close button — appears on hover */}
        <button
          onClick={() => setDismissed(true)}
          className="absolute -top-1 -right-1 z-10 w-5 h-5 rounded-full bg-muted-foreground/50 hover:bg-muted-foreground/80 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200"
          aria-label="关闭 YI KNOW"
        >
          <X className="w-3 h-3 text-white" />
        </button>
        {/* Speech bubble */}
        {!open && (
          <div
            className="relative bg-white rounded-2xl px-5 py-3.5 shadow-lg max-w-[210px]"
            style={{
              boxShadow: "0 20px 48px -8px rgba(60,80,140,0.2), 0 4px 12px rgba(60,80,140,0.06)",
              animation: "rb-pop 0.6s cubic-bezier(.2,1.3,.4,1) both",
              animationDelay: ".5s",
            }}
          >
            <div className="absolute -top-px left-6 right-6 h-[2px] bg-gradient-to-r from-transparent via-primary/30 to-transparent rounded-full" />
            <span className="text-lg font-extrabold text-[#1a73e8] inline-flex items-center gap-1.5">
              <span style={{ animation: "rb-wave 1.6s ease-in-out infinite", transformOrigin: "70% 70%" }}>
                👋
              </span>
              Hi～
            </span>
            <p className="mt-1.5 text-sm text-[#2a3650] leading-relaxed">
              我是 <span className="text-[#1a73e8] font-extrabold">YI<span className="inline-block w-1.5 h-1.5 bg-[#ffce3d] rounded-full mx-0.5 align-middle shadow-[0_0_8px_#ffce3d]" />Know</span><br />
              你的专属智能助理
            </p>
            {/* tail */}
            <div
              className="absolute -right-[14px] top-14 w-0 h-0"
              style={{
                borderStyle: "solid",
                borderWidth: "10px 0 10px 16px",
                borderColor: "transparent transparent transparent #fff",
                filter: "drop-shadow(3px 2px 3px rgba(90,120,180,.08))",
              }}
            />
          </div>
        )}

        <button
          onClick={() => handleOpenChange(!open)}
          className="block w-28 h-28 rounded-full p-0 border-0 bg-transparent cursor-pointer transition-transform hover:scale-110 active:scale-95 shrink-0"
          aria-label="YI KNOW 教学智能助理"
          style={{ filter: "drop-shadow(0 8px 16px rgba(120,140,180,.35))" }}
        >
          <div className={`transition-all duration-300 ${open ? "opacity-0 scale-50" : "opacity-100 scale-100"}`}>
            <svg viewBox="0 0 380 380" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "100%", display: "block" }}>
              <defs>
                <linearGradient id="rb-helmet" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="#f1f5fb"/>
                  <stop offset="0.5" stopColor="#dfe6f0"/>
                  <stop offset="1" stopColor="#c4cedd"/>
                </linearGradient>
                <radialGradient id="rb-visor" cx="50%" cy="38%" r="75%">
                  <stop offset="0" stopColor="#1c4258"/>
                  <stop offset="0.55" stopColor="#123243"/>
                  <stop offset="1" stopColor="#0a2230"/>
                </radialGradient>
                <linearGradient id="rb-body" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="#eef2f9"/>
                  <stop offset="0.6" stopColor="#dde4ef"/>
                  <stop offset="1" stopColor="#bfc8d8"/>
                </linearGradient>
                <linearGradient id="rb-arm" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stopColor="#e6ecf5"/>
                  <stop offset="1" stopColor="#c0cad9"/>
                </linearGradient>
                <linearGradient id="rb-ear" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0" stopColor="#d4dce8"/>
                  <stop offset="1" stopColor="#b3bdcd"/>
                </linearGradient>
                <radialGradient id="rb-eyeGlow" cx="50%" cy="40%" r="60%">
                  <stop offset="0" stopColor="#bdf6ff"/>
                  <stop offset="0.5" stopColor="#5fe1f0"/>
                  <stop offset="1" stopColor="#2bb6cf"/>
                </radialGradient>
                <filter id="rb-soft" x="-30%" y="-30%" width="160%" height="160%">
                  <feGaussianBlur stdDeviation="3"/>
                </filter>
                <clipPath id="rb-visorClip">
                  <path d="M90 105 C90 73 128 58 190 58 C252 58 290 73 290 105 C290 137 288 147 274 156 C254 168 222 174 190 174 C158 174 126 168 106 156 C92 147 90 137 90 105 Z"/>
                </clipPath>
              </defs>
              <g className="robot-all">
                <g className="arm-left">
                  <path d="M95 200 C58 215 38 270 32 305 C28 332 40 352 60 350 C80 348 90 322 95 296 C100 270 108 235 118 220 Z" fill="url(#rb-arm)"/>
                </g>
                <g className="arm-right">
                  <path d="M285 200 C322 215 342 270 348 305 C352 332 340 352 320 350 C300 348 290 322 285 296 C280 270 272 235 262 220 Z" fill="url(#rb-arm)"/>
                </g>
                <g className="body-breath">
                  <path d="M105 235 C105 200 140 180 190 180 C240 180 275 200 275 235 C275 305 240 355 190 355 C140 355 105 305 105 235 Z" fill="url(#rb-body)"/>
                  <path d="M150 178 C150 165 168 160 190 160 C212 160 230 165 230 178 L230 196 C230 210 212 216 190 216 C168 216 150 210 150 196 Z" fill="#c3ccdb"/>
                  <circle cx="190" cy="300" r="8" fill="#5fe1f0" className="eye-shine"/>
                  <circle cx="190" cy="300" r="8" fill="none" stroke="#bdf6ff" strokeWidth="1.5" opacity=".5"/>
                </g>
                <g className="head">
                  <path d="M160 22 C160 10 175 6 190 6 C205 6 220 10 220 22 L220 34 L160 34 Z" fill="url(#rb-helmet)"/>
                  <line x1="190" y1="6" x2="190" y2="-8" stroke="#aab5c6" strokeWidth="3"/>
                  <circle cx="190" cy="-10" r="6" fill="#5fe1f0" className="antenna-light"/>
                  <rect x="48" y="92" width="34" height="62" rx="16" fill="url(#rb-ear)"/>
                  <rect x="56" y="100" width="14" height="46" rx="7" fill="#9aa6b8" opacity=".5"/>
                  <circle cx="63" cy="123" r="5" fill="#5fe1f0" className="ear-light"/>
                  <rect x="298" y="92" width="34" height="62" rx="16" fill="url(#rb-ear)"/>
                  <rect x="310" y="100" width="14" height="46" rx="7" fill="#9aa6b8" opacity=".5"/>
                  <circle cx="317" cy="123" r="5" fill="#5fe1f0" className="ear-light r"/>
                  <path d="M70 110 C70 58 120 32 190 32 C260 32 310 58 310 110 C310 138 305 160 295 168 C300 145 290 80 190 80 C90 80 80 145 85 168 C75 160 70 138 70 110 Z" fill="url(#rb-helmet)"/>
                  <path d="M82 105 C82 68 125 50 190 50 C255 50 298 68 298 105 C298 142 298 152 282 162 C260 176 225 182 190 182 C155 182 120 176 98 162 C82 152 82 142 82 105 Z" fill="#aeb9ca"/>
                  <path d="M90 105 C90 73 128 58 190 58 C252 58 290 73 290 105 C290 137 288 147 274 156 C254 168 222 174 190 174 C158 174 126 168 106 156 C92 147 90 137 90 105 Z" fill="url(#rb-visor)"/>
                  <g clipPath="url(#rb-visorClip)">
                    <path d="M110 72 C140 62 240 62 270 72 C245 66 135 66 110 72 Z" fill="#3a6378" opacity=".6"/>
                    <ellipse cx="135" cy="78" rx="28" ry="9" fill="#ffffff" opacity=".12"/>
                    <rect className="scanline" x="90" y="100" width="200" height="3" fill="#5fe1f0" opacity=".4"/>
                  </g>
                  <circle cx="143" cy="103" r="26" fill="#1d4a5e" opacity=".55"/>
                  <circle cx="237" cy="103" r="26" fill="#1d4a5e" opacity=".55"/>
                  <g className="eyes">
                    <g className="pupils">
                      <circle cx="143" cy="103" r="18" fill="url(#rb-eyeGlow)"/>
                      <path d="M127 100 Q143 88 159 100 Q143 96 127 100 Z" fill="#eafdff" className="eye-shine"/>
                      <circle cx="143" cy="103" r="18" fill="none" stroke="#bdf6ff" strokeWidth="1.5" opacity=".5"/>
                      <circle cx="237" cy="103" r="18" fill="url(#rb-eyeGlow)"/>
                      <path d="M221 100 Q237 88 253 100 Q237 96 221 100 Z" fill="#eafdff" className="eye-shine"/>
                      <circle cx="237" cy="103" r="18" fill="none" stroke="#bdf6ff" strokeWidth="1.5" opacity=".5"/>
                    </g>
                  </g>
                  <path className="mouth" d="M178 132 C178 142 184 148 190 148 C196 148 202 142 202 132 Z" fill="url(#rb-eyeGlow)"/>
                </g>
              </g>
            </svg>
          </div>
          {open && (
            <div className="absolute inset-0 flex items-center justify-center">
              <X className="w-8 h-8 text-white drop-shadow-lg" />
            </div>
          )}
        </button>
      </div>

      {/* Assistant panel */}
      {open && (
        <div
          className="fixed bottom-[130px] right-6 z-[100] w-[420px] max-w-[calc(100vw-3rem)] h-[580px] max-h-[calc(100vh-10rem)] flex flex-col overflow-hidden rounded-2xl border shadow-2xl"
          style={{
            background: "oklch(from var(--background) l c h / 0.82)",
            backdropFilter: "blur(20px) saturate(1.4)",
            WebkitBackdropFilter: "blur(20px) saturate(1.4)",
            boxShadow: "0 25px 60px -12px oklch(0 0 0 / 0.25), 0 8px 24px -6px oklch(0 0 0 / 0.08), inset 0 1px 0 oklch(1 1 0 / 0.06)",
            animation: "rb-slideUp 0.35s cubic-bezier(0.16, 1, 0.3, 1)",
          }}
        >
          {/* Top decorative gradient line */}
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-primary/20 via-primary/60 to-primary/20 rounded-t-2xl" />

          {/* Header */}
          <div className="relative px-4 py-3 border-b bg-gradient-to-r from-primary/[0.08] to-transparent flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="relative w-8 h-8 rounded-full bg-gradient-to-br from-primary to-primary/70 text-primary-foreground flex items-center justify-center shadow-sm">
                <Sparkles className="w-4 h-4" />
                <div className="absolute -inset-0.5 rounded-full bg-primary/20 animate-pulse" style={{ animationDuration: "3s" }} />
              </div>
              <div>
                <h3 className="font-semibold text-sm tracking-wide">
                  <span className="text-primary">YI</span>{" "}
                  <span>KNOW</span>
                </h3>
                <p className="text-[10px] text-muted-foreground/80">职业教育场景化教学智能助理</p>
              </div>
            </div>
            <button
              onClick={() => handleOpenChange(false)}
              className="w-7 h-7 rounded-full hover:bg-muted/80 flex items-center justify-center transition-all duration-200 hover:scale-105 active:scale-95"
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>

          {/* Tabs */}
          <Tabs
            value={activeTab}
            onValueChange={(v) => {
              setActiveTab(v as ResourceCategory | "all")
              setInputValue("")
            }}
            className="px-4 pt-3 pb-2 shrink-0"
          >
            <TabsList className="w-full grid grid-cols-4 h-9 bg-muted/60 p-0.5 rounded-xl">
              <TabsTrigger value="all" className="text-xs data-[state=active]:shadow-sm data-[state=active]:bg-background rounded-lg transition-all duration-200">
                全部
              </TabsTrigger>
              <TabsTrigger value="knowledge" className="text-xs data-[state=active]:shadow-sm data-[state=active]:bg-background rounded-lg transition-all duration-200">
                知识库
              </TabsTrigger>
              <TabsTrigger value="agent" className="text-xs data-[state=active]:shadow-sm data-[state=active]:bg-background rounded-lg transition-all duration-200">
                智能体
              </TabsTrigger>
              <TabsTrigger value="platform" className="text-xs data-[state=active]:shadow-sm data-[state=active]:bg-background rounded-lg transition-all duration-200">
                教学平台
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Content area */}
          <div className="flex-1 min-h-0 px-4 pb-3 overflow-hidden">
            {isChatMode ? (
              chatView
            ) : activeTab === "all" ? (
              <div className="h-full overflow-y-auto scrollbar-thin pr-1.5">
                {groupedResourceList}
              </div>
            ) : (
              <div className="h-full overflow-y-auto scrollbar-thin pr-1.5">
                {resourceList}
              </div>
            )}
          </div>
          <Separator className="opacity-50" />

          {/* Bottom unified input area */}
          <div className="shrink-0 bg-gradient-to-t from-muted/20 to-transparent">
            {!isChatMode && (
              <div className="px-4 pt-3 pb-0">
                <div className="flex items-center gap-1.5 mb-2 text-[11px] text-muted-foreground/70">
                  <Sparkles className="w-3 h-3 text-primary/70" />
                  <span>试试问我：</span>
                </div>
                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
                  {PROMPT_TAGS.map((tag) => (
                    <button
                      key={tag.label}
                      type="button"
                      className="shrink-0 px-3 py-1.5 rounded-full text-xs border bg-background/80 hover:border-primary/50 hover:text-primary hover:bg-primary/5 transition-all duration-200 active:scale-95 shadow-sm"
                      onClick={() => {
                        setInputValue(tag.value)
                      }}
                    >
                      {tag.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="p-2 pt-3 bg-background/60 border-t flex items-center gap-2">
              <div className="relative flex-1 group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/60 group-focus-within:text-primary transition-colors duration-200" />
                <Input
                  placeholder="搜索资源或提问..."
                  className="pl-9 h-9 text-sm bg-muted/40 border-muted-foreground/20 focus-visible:bg-background transition-all duration-200"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault()
                      handleSend()
                    }
                  }}
                />
              </div>
              <Button
                size="icon"
                className="h-9 w-9 shrink-0 bg-gradient-to-br from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-sm transition-all duration-200 active:scale-95"
                onClick={handleSend}
                disabled={!inputValue.trim() || isTyping}
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
