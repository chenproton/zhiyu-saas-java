import type { PlatformNavigationConfig } from "@/components/platform-shell"
import { Building, Calendar, Database, History, Rocket, Users, type LucideIcon } from "lucide-react"

/* ============================================================
   统一导航树（数字课程平台）
   不再区分课程资源中心 / 课程建设与教学运行 / 学生学习平台
   ============================================================ */
export const unifiedNavigationConfig: PlatformNavigationConfig = {
  brandTitle: "数字课程服务平台",
  currentPlatformId: "lesson-unified",
  currentPlatformLabel: "数字课程服务平台",
  brandHref: "/lesson/admin/system",
  brandIcon: "bookOpen",
  platformIcon: "bookOpen",
  sideBackHref: "/lesson/admin/system",
  currentUserName: "教师",
  currentUserRoleLabel: "教学用户",
  showCurrentTime: true,
  showUserMenu: true,
  userMenuItems: [
    { id: "profile", label: "个人中心", icon: "user" },
    { id: "account", label: "账号设置", icon: "settings" },
    { id: "logout", label: "退出登录", tone: "danger" },
  ],
  sideNavItems: [
    {
      id: "resource-center",
      label: "在线课资源库",
      icon: "folderKanban",
      children: [
        { id: "system", label: "体系课管理", href: "/lesson/admin/system", matchers: ["/lesson/admin/system$", "/lesson/admin/system/add"] },
        { id: "granular", label: "颗粒课管理", href: "/lesson/admin/granular", matchers: ["/lesson/admin/granular$", "/lesson/admin/granular/add"] },
      ],
    },
    {
      id: "hybrid-center",
      label: "混合课资源库",
      icon: "layers3",
      children: [
        { id: "hybrid", label: "混合课模板管理", href: "/lesson/admin/hybrid", matchers: ["/lesson/admin/hybrid$", "/lesson/admin/hybrid/add"] },
        { id: "hybrid-archive", label: "混合课历史档案库", href: "/lesson/admin/archive", matchers: ["/lesson/admin/archive"] },
      ],
    },
    {
      id: "approval-center",
      label: "批次与审批管理",
      icon: "badgeCheck",
      children: [
        { id: "batches", label: "批次分组管理", href: "/lesson/admin/batches", matchers: ["/lesson/admin/batches"] },
        { id: "workflows", label: "审批流程配置", href: "/lesson/admin/workflows", matchers: ["/lesson/admin/workflows"] },
        { id: "approvals", label: "审批中心", href: "/lesson/admin/approvals", matchers: ["/lesson/admin/approvals"] },
      ],
    },
  ],
  defaultExpandedSideNavIds: [
    "resource-center",
    "hybrid-center",
    "approval-center",
  ],
  platformSwitchItems: [],
  shellClassName: "bg-background",
  mainClassName: "min-w-0 flex-1",
}

export const adminNavigationConfig: PlatformNavigationConfig = {
  brandTitle: "数字课程服务平台",
  currentPlatformId: "lesson-admin",
  currentPlatformLabel: "课程资源中心",
  brandHref: "/lesson/admin/system",
  brandIcon: "folderKanban",
  platformIcon: "folderKanban",
  sideBackHref: "/lesson/admin/system",
  currentUserName: "教研管理员",
  currentUserRoleLabel: "课程资源中心",
  showCurrentTime: true,
  showUserMenu: true,
  userMenuItems: [
    { id: "profile", label: "个人中心", icon: "user" },
    { id: "account", label: "账号设置", icon: "settings" },
    { id: "logout", label: "退出登录", tone: "danger" },
  ],
  sideNavItems: [
    {
      id: "resource-center",
      label: "在线课资源库",
      icon: "folderKanban",
      children: [
        { id: "system", label: "体系课管理", href: "/lesson/admin/system", matchers: ["/lesson/admin/system$", "/lesson/admin/system/add"] },
        { id: "granular", label: "颗粒课管理", href: "/lesson/admin/granular", matchers: ["/lesson/admin/granular$", "/lesson/admin/granular/add"] },
      ],
    },
    {
      id: "hybrid-center",
      label: "混合课资源库",
      icon: "layers3",
      children: [
        { id: "hybrid", label: "混合课模板管理", href: "/lesson/admin/hybrid", matchers: ["/lesson/admin/hybrid$", "/lesson/admin/hybrid/add"] },
        { id: "hybrid-archive", label: "混合课历史档案库", href: "/lesson/admin/archive", matchers: ["/lesson/admin/archive"] },
      ],
    },
    {
      id: "approval-center",
      label: "批次与审批管理",
      icon: "badgeCheck",
      children: [
        { id: "batches", label: "批次分组管理", href: "/lesson/admin/batches", matchers: ["/lesson/admin/batches"] },
        { id: "workflows", label: "审批流程配置", href: "/lesson/admin/workflows", matchers: ["/lesson/admin/workflows"] },
        { id: "approvals", label: "审批中心", href: "/lesson/admin/approvals", matchers: ["/lesson/admin/approvals"] },
      ],
    },
  ],
  defaultExpandedSideNavIds: ["resource-center", "hybrid-center", "approval-center"],
  platformSwitchItems: [],
  shellClassName: "bg-background",
  mainClassName: "min-w-0 flex-1",
}


/* ============================================================
   Job 模块导航（产业岗位学习平台）
   ============================================================ */
export const jobNavigationConfig: PlatformNavigationConfig = {
  brandTitle: "产业岗位学习平台",
  currentPlatformId: "job",
  currentPlatformLabel: "产业岗位学习平台",
  brandHref: "/job/positions",
  brandIcon: "briefcase",
  platformIcon: "briefcase",
  sideBackHref: "/job/positions",
  currentUserName: "教师",
  currentUserRoleLabel: "教学用户",
  showCurrentTime: true,
  showUserMenu: true,
  userMenuItems: [
    { id: "profile", label: "个人中心", icon: "user" },
    { id: "account", label: "账号设置", icon: "settings" },
    { id: "logout", label: "退出登录", tone: "danger" },
  ],
  sideNavItems: [
    {
      id: "position-center",
      label: "岗位中心",
      icon: "briefcase",
      children: [
        { id: "positions", label: "岗位管理", href: "/job/positions", matchers: ["/job/positions$", "/job/positions/"] },
        { id: "position-archive", label: "岗位归档", href: "/job/archive", matchers: ["/job/archive"] },
      ],
    },
    {
      id: "flow-center",
      label: "批次与审批管理",
      icon: "settings",
      children: [
        { id: "batches", label: "批次分组管理", href: "/job/batches", matchers: ["/job/batches"] },
        { id: "workflows", label: "审批流程配置", href: "/job/workflows", matchers: ["/job/workflows"] },
        { id: "approvals", label: "审批中心", href: "/job/approvals", matchers: ["/job/approvals"] },
      ],
    },
    {
      id: "batch-center",
      label: "岗位展示配置",
      icon: "layers",
      children: [
        { id: "recommend", label: "岗位推荐", href: "/job/recommend", matchers: ["/job/recommend"] },
        { id: "learn-roads", label: "学习路径", href: "/job/learn-roads", matchers: ["/job/learn-roads"] },
      ],
    },
  ],
  defaultExpandedSideNavIds: ["position-center", "flow-center", "batch-center"],
  platformSwitchItems: [],
  shellClassName: "bg-background",
  mainClassName: "min-w-0 flex-1",
}

/* ============================================================
   Scene 模块导航（产业应用场景学习实践平台）
   ============================================================ */
export const sceneNavigationConfig: PlatformNavigationConfig = {
  brandTitle: "产业应用场景学习实践平台",
  currentPlatformId: "scene",
  currentPlatformLabel: "场景学习平台",
  brandHref: "/scene/",
  brandIcon: "layers",
  platformIcon: "layers",
  sideBackHref: "/scene/",
  currentUserName: "教师",
  currentUserRoleLabel: "教学用户",
  showCurrentTime: true,
  showUserMenu: true,
  userMenuItems: [
    { id: "profile", label: "个人中心", icon: "user" },
    { id: "account", label: "账号设置", icon: "settings" },
    { id: "logout", label: "退出登录", tone: "danger" },
  ],
  sideNavItems: [
    {
      id: "scenario-center",
      label: "场景中心",
      icon: "layers",
      children: [
        { id: "scenarios", label: "场景管理", href: "/scene/", matchers: ["/scene$", "/scene/scenarios", "/scene/ai", "/scene/ai-first"] },
        { id: "archive", label: "场景归档", href: "/scene/archive", matchers: ["/scene/archive"] },
      ],
    },
    {
      id: "batch-flow",
      label: "批次与审批管理",
      icon: "settings",
      children: [
        { id: "batches", label: "批次分组管理", href: "/scene/batches", matchers: ["/scene/batches"] },
        { id: "workflows", label: "审批流程配置", href: "/scene/workflows", matchers: ["/scene/workflows"] },
        { id: "approvals", label: "审批中心", href: "/scene/approvals", matchers: ["/scene/approvals"] },
      ],
    },
  ],
  defaultExpandedSideNavIds: ["scenario-center", "batch-flow"],
  platformSwitchItems: [],
  shellClassName: "bg-background",
  mainClassName: "min-w-0 flex-1",
}

/* ============================================================
   Evaluation 模块导航（能力评价与测评资源管理平台）
   ============================================================ */
export const evaluationNavigationConfig: PlatformNavigationConfig = {
  brandTitle: "能力评价与测评资源管理平台",
  currentPlatformId: "evaluation",
  currentPlatformLabel: "测评管理平台",
  brandHref: "/evaluation/question-banks",
  brandIcon: "checkCircle",
  platformIcon: "checkCircle",
  sideBackHref: "/evaluation/question-banks",
  currentUserName: "教师",
  currentUserRoleLabel: "教学用户",
  showCurrentTime: true,
  showUserMenu: true,
  userMenuItems: [
    { id: "profile", label: "个人中心", icon: "user" },
    { id: "account", label: "账号设置", icon: "settings" },
    { id: "logout", label: "退出登录", tone: "danger" },
  ],
  sideNavItems: [
    {
      id: "exam-center",
      label: "测评资源",
      icon: "bookOpen",
      children: [
        { id: "question-banks", label: "题库管理", href: "/evaluation/question-banks", matchers: ["/evaluation/question-banks"] },
        { id: "exams", label: "试卷管理", href: "/evaluation/exams", matchers: ["/evaluation/exams"] },
        { id: "exam-usage", label: "考试管理", href: "/evaluation/exam-usage", matchers: ["/evaluation/exam-usage"] },
      ],
    },
    {
      id: "batch-flow",
      label: "批次与审批管理",
      icon: "settings",
      children: [
        { id: "batches", label: "批次分组管理", href: "/evaluation/batches", matchers: ["/evaluation/batches"] },
        { id: "workflows", label: "审批流程配置", href: "/evaluation/workflows", matchers: ["/evaluation/workflows"] },
        { id: "approvals", label: "审批中心", href: "/evaluation/approvals", matchers: ["/evaluation/approvals"] },
      ],
    },
    {
      id: "result-center",
      label: "结果与认证",
      icon: "barChart",
      children: [
        { id: "scene-results", label: "场景任务评价", href: "/evaluation/scene-results", matchers: ["/evaluation/scene-results"] },
        { id: "job-ability", label: "岗位能力认定规则", href: "/evaluation/job-ability", matchers: ["/evaluation/job-ability$", "/evaluation/job-ability/config"] },
        { id: "job-ability-results", label: "岗位能力认定结果", href: "/evaluation/job-ability/results", matchers: ["/evaluation/job-ability/results"] },
      ],
    },
  ],
  defaultExpandedSideNavIds: ["exam-center", "batch-flow", "result-center"],
  platformSwitchItems: [],
  shellClassName: "bg-background",
  mainClassName: "min-w-0 flex-1",
}

/* ============================================================
   系统管理导航（门户-系统设置）
   ============================================================ */
export const systemNavigationConfig: PlatformNavigationConfig = {
  brandTitle: "系统设置",
  currentPlatformId: "portal-system",
  currentPlatformLabel: "系统设置",
  brandHref: "/portal/apps/system/tenant",
  brandIcon: "settings",
  platformIcon: "settings",
  sideBackHref: "/portal/apps",
  currentUserName: "用户",
  currentUserRoleLabel: "平台用户",
  showCurrentTime: true,
  showUserMenu: true,
  userMenuItems: [
    { id: "workspace", label: "我的服务台", href: "/portal/workspace", icon: "briefcase" },
    { id: "apps", label: "应用中心", href: "/portal/apps", icon: "layoutGrid" },
    { id: "logout", label: "退出登录", tone: "danger" },
  ],
  sideNavItems: [
    {
      id: "tenant",
      label: "租户信息管理",
      icon: Building,
      href: "/portal/apps/system/tenant",
      matchers: ["/portal/apps/system/tenant"],
    },
    {
      id: "resource",
      label: "系统资源管理",
      icon: Database,
      children: [
        { id: "package", label: "套餐情况查看", href: "/portal/apps/system/resource/package", matchers: ["/portal/apps/system/resource/package"] },
        { id: "codes", label: "资源编码管理", href: "/portal/apps/system/resource/codes", matchers: ["/portal/apps/system/resource/codes"] },
        { id: "industries", label: "行业管理", href: "/portal/apps/system/resource/industries", matchers: ["/portal/apps/system/resource/industries"] },
        { id: "majors", label: "专业管理", href: "/portal/apps/system/resource/majors", matchers: ["/portal/apps/system/resource/majors"] },
      ],
    },
    {
      id: "org-user",
      label: "组织用户管理",
      icon: Users,
      children: [
        { id: "org-types", label: "组织类型管理", href: "/portal/apps/system/org-user/org-types", matchers: ["/portal/apps/system/org-user/org-types"] },
        { id: "org-structure", label: "组织架构管理", href: "/portal/apps/system/org-user/org-structure", matchers: ["/portal/apps/system/org-user/org-structure"] },
        { id: "students", label: "学生管理", href: "/portal/apps/system/org-user/students", matchers: ["/portal/apps/system/org-user/students"] },
        { id: "teachers", label: "教职工管理", href: "/portal/apps/system/org-user/teachers", matchers: ["/portal/apps/system/org-user/teachers"] },
        { id: "accounts", label: "账户列表", href: "/portal/apps/system/org-user/accounts", matchers: ["/portal/apps/system/org-user/accounts"] },
        { id: "fields", label: "用户字段扩展", href: "/portal/apps/system/org-user/fields", matchers: ["/portal/apps/system/org-user/fields"] },
        { id: "relations", label: "关系类型管理", href: "/portal/apps/system/org-user/relations", matchers: ["/portal/apps/system/org-user/relations"] },
        { id: "graduates", label: "毕业学生管理", href: "/portal/apps/system/org-user/graduates", matchers: ["/portal/apps/system/org-user/graduates"] },
        { id: "roles", label: "角色权限管理", href: "/portal/apps/system/org-user/roles", matchers: ["/portal/apps/system/org-user/roles"] },
        { id: "positions", label: "职位管理", href: "/portal/apps/system/org-user/positions", matchers: ["/portal/apps/system/org-user/positions"] },
      ],
    },
    {
      id: "logs",
      label: "日志管理",
      icon: History,
      children: [
        { id: "login", label: "登录日志查看", href: "/portal/apps/system/logs/login", matchers: ["/portal/apps/system/logs/login"] },
        { id: "operation", label: "操作日志查看", href: "/portal/apps/system/logs/operation", matchers: ["/portal/apps/system/logs/operation"] },
      ],
    },
  ],
  defaultExpandedSideNavIds: ["tenant", "resource", "org-user", "logs"],
  platformSwitchItems: [],
  shellClassName: "bg-background",
  mainClassName: "min-w-0 flex-1",
}

/* ============================================================
   Portal 导航（门户首页 / 应用中心 / 服务台）
   ============================================================ */
export const portalNavigationConfig: PlatformNavigationConfig = {
  brandTitle: "场景化数智教学服务体系",
  currentPlatformId: "portal",
  currentPlatformLabel: "统一门户",
  brandHref: "/portal",
  brandIcon: "home",
  platformIcon: "home",
  sideBackHref: "/portal",
  currentUserName: "用户",
  currentUserRoleLabel: "平台用户",
  showCurrentTime: true,
  showUserMenu: true,
  userMenuItems: [
    { id: "workspace", label: "我的服务台", href: "/portal/workspace", icon: "briefcase" },
    { id: "apps", label: "应用中心", href: "/portal/apps", icon: "layoutGrid" },
    { id: "logout", label: "退出登录", tone: "danger" },
  ],
  sideNavItems: systemNavigationConfig.sideNavItems,
  defaultExpandedSideNavIds: systemNavigationConfig.defaultExpandedSideNavIds,
  platformSwitchItems: [],
  shellClassName: "bg-background",
  mainClassName: "min-w-0 flex-1",
}

/* ============================================================
   Library 模块导航（资源共享平台）
   ============================================================ */
export const libraryNavigationConfig: PlatformNavigationConfig = {
  brandTitle: "资源共享平台",
  currentPlatformId: "library",
  currentPlatformLabel: "资源共享平台",
  brandHref: "/library/knowledge",
  brandIcon: "folderKanban",
  platformIcon: "folderKanban",
  sideBackHref: "/library/knowledge",
  currentUserName: "教师",
  currentUserRoleLabel: "教学用户",
  showCurrentTime: true,
  showUserMenu: true,
  userMenuItems: [
    { id: "profile", label: "个人中心", icon: "user" },
    { id: "account", label: "账号设置", icon: "settings" },
    { id: "logout", label: "退出登录", tone: "danger" },
  ],
  sideNavItems: [
    {
      id: "resource-center",
      label: "公共资源库",
      icon: "folderKanban",
      children: [
        { id: "knowledge", label: "知识点库", href: "/library/knowledge", matchers: ["/library/knowledge"] },
        { id: "ability", label: "能力点库", href: "/library/ability", matchers: ["/library/ability"] },
        { id: "certificates", label: "证书库", href: "/library/certificates", matchers: ["/library/certificates"] },
        { id: "resources-document", label: "文档资源库", href: "/library/resources/document", matchers: ["/library/resources/document"] },
        { id: "resources-spreadsheet", label: "表格资源库", href: "/library/resources/spreadsheet", matchers: ["/library/resources/spreadsheet"] },
        { id: "resources-image", label: "图片资源库", href: "/library/resources/image", matchers: ["/library/resources/image"] },
        { id: "resources-link", label: "链接资源库", href: "/library/resources/link", matchers: ["/library/resources/link"] },
        { id: "resources-audio", label: "音频资源库", href: "/library/resources/audio", matchers: ["/library/resources/audio"] },
        { id: "resources-video", label: "视频资源库", href: "/library/resources/video", matchers: ["/library/resources/video"] },
        { id: "resources-archive", label: "压缩包资源库", href: "/library/resources/archive", matchers: ["/library/resources/archive"] },
        { id: "resources-venue", label: "场地资源库", href: "/library/resources/venue", matchers: ["/library/resources/venue"] },
        { id: "resources-facility", label: "设施设备资源库", href: "/library/resources/facility", matchers: ["/library/resources/facility"] },
        { id: "resources-software", label: "软件资源库", href: "/library/resources/software", matchers: ["/library/resources/software"] },
        { id: "resources-other", label: "其他资源库", href: "/library/resources/other", matchers: ["/library/resources/other"] },
        { id: "questions", label: "现场问答题库", href: "/library/questions", matchers: ["/library/questions"] },
      ],
    },
    {
      id: "my-resource-center",
      label: "我的资源库",
      icon: "user",
      children: [
        { id: "my-resources", label: "我的资源", href: "/library/my-resources", matchers: ["/library/my-resources"] },
      ],
    },
  ],
  defaultExpandedSideNavIds: ["resource-center", "my-resource-center"],
  platformSwitchItems: [],
  shellClassName: "bg-background",
  mainClassName: "min-w-0 flex-1",
}

/* ============================================================
   Affairs 模块导航（教务管理服务平台）
   ============================================================ */
export const affairsNavigationConfig: PlatformNavigationConfig = {
  brandTitle: "教务管理服务平台",
  currentPlatformId: "affairs",
  currentPlatformLabel: "教务管理平台",
  brandHref: "/affairs/programs",
  brandIcon: "calendar",
  platformIcon: "calendar",
  sideBackHref: "/affairs/programs",
  currentUserName: "教师",
  currentUserRoleLabel: "教学用户",
  showCurrentTime: true,
  showUserMenu: true,
  userMenuItems: [
    { id: "profile", label: "个人中心", icon: "user" },
    { id: "account", label: "账号设置", icon: "settings" },
    { id: "logout", label: "退出登录", tone: "danger" },
  ],
  sideNavItems: [
    {
      id: "teaching-mgmt",
      label: "教学管理",
      icon: "calendar",
      children: [
        { id: "config", label: "教务配置", href: "/affairs/config", matchers: ["/affairs/config"] },
        { id: "programs", label: "人才培养方案", href: "/affairs/programs", matchers: ["/affairs/programs"] },
        { id: "teaching-plans", label: "教学计划", href: "/affairs/teaching-plans", matchers: ["/affairs/teaching-plans"] },
        { id: "scheduling", label: "排课管理", href: "/affairs/scheduling", matchers: ["/affairs/scheduling"] },
      ],
    },
  ],
  defaultExpandedSideNavIds: ["teaching-mgmt"],
  platformSwitchItems: [],
  shellClassName: "bg-background",
  mainClassName: "min-w-0 flex-1",
}

/* ============================================================
   平台模块卡片 / 套餐页统一数据源
   所有平台的一级功能模块都从这里读取，保证 /portal/apps 与
   /portal/apps/system/resource/package 看到的内容一致。
   ============================================================ */
export interface PlatformCardModule {
  id: string
  title: string
  desc: string
  href: string
}

function firstHrefFromNavConfig(config: PlatformNavigationConfig): string {
  for (const item of config.sideNavItems) {
    if (item.children && item.children.length > 0) {
      const firstChild = item.children.find((c) => c.href && c.href !== "#")
      if (firstChild?.href) return firstChild.href
    }
    if (item.href && item.href !== "#") {
      return item.href
    }
  }
  return "#"
}

function subModulesFromNavConfig(
  config: PlatformNavigationConfig,
): { id: string; label: string; href: string; children?: { id: string; label: string; href: string }[] }[] {
  return config.sideNavItems
    .filter((item) => !item.hidden)
    .map((item) => ({
      id: item.id,
      label: item.label,
      href: item.children?.find((c) => c.href && c.href !== "#")?.href || item.href || "#",
      children: item.children
        ?.filter((c) => c.href && c.href !== "#")
        .map((c) => ({ id: c.id, label: c.label, href: c.href })),
    }))
    .filter((m) => m.href !== "#")
}

export interface PlatformModuleDef {
  id: string
  label: string
  icon: LucideIcon | string
  href: string
  subModules: ReturnType<typeof subModulesFromNavConfig>
}

export const platformModuleDefs: Record<string, PlatformModuleDef> = {
  system: {
    id: "system",
    label: "系统管理",
    icon: "settings",
    href: firstHrefFromNavConfig(systemNavigationConfig),
    subModules: subModulesFromNavConfig(systemNavigationConfig),
  },
  career: {
    id: "career",
    label: "职业岗位学习平台",
    icon: "briefcase",
    href: firstHrefFromNavConfig(jobNavigationConfig),
    subModules: subModulesFromNavConfig(jobNavigationConfig),
  },
  scene: {
    id: "scene",
    label: "实践场景学习平台",
    icon: "layers",
    href: firstHrefFromNavConfig(sceneNavigationConfig),
    subModules: subModulesFromNavConfig(sceneNavigationConfig),
  },
  course: {
    id: "course",
    label: "数字课程服务平台",
    icon: "bookOpen",
    href: firstHrefFromNavConfig(unifiedNavigationConfig),
    subModules: subModulesFromNavConfig(unifiedNavigationConfig),
  },
  ability: {
    id: "ability",
    label: "能力评价与测评资源管理平台",
    icon: "checkCircle",
    href: firstHrefFromNavConfig(evaluationNavigationConfig),
    subModules: subModulesFromNavConfig(evaluationNavigationConfig),
  },
  resource: {
    id: "resource",
    label: "教学资源共享服务平台",
    icon: "share2",
    href: firstHrefFromNavConfig(libraryNavigationConfig),
    subModules: subModulesFromNavConfig(libraryNavigationConfig),
  },
  affairs: {
    id: "affairs",
    label: "教务管理服务平台",
    icon: "calendar",
    href: firstHrefFromNavConfig(affairsNavigationConfig),
    subModules: subModulesFromNavConfig(affairsNavigationConfig),
  },
}

const PLATFORM_CARD_DESCRIPTIONS: Record<string, string> = {
  "system-tenant": "维护租户基本信息与联系方式",
  "system-resource": "管理套餐、资源编码与行业标准",
  "system-org-user": "维护组织架构、账户与角色权限",
  "system-logs": "查看登录与操作审计日志",
  "career-position-center": "建设与管理产业岗位资源",
  "career-flow-center": "配置审批流程与分组批次",
  "career-batch-center": "配置推荐岗位与学习路径",
  "course-resource-center": "建设体系课与颗粒课资源",
  "course-hybrid-center": "管理混合课模板与历史档案",
  "course-approval-center": "配置课程审批流程与批次",
  "scene-scenario-center": "建设与管理实践场景资源",
  "scene-batch-flow": "配置场景审批流程与批次",
  "ability-exam-center": "管理题库、试卷与考试资源",
  "ability-batch-flow": "配置测评审批流程与批次",
  "ability-result-center": "查看场景任务评价与认证结果",
  "resource-my-resource-center": "管理个人教学资源",
  "resource-resource-center": "管理知识点、能力点与教学资源",
  "affairs-teaching-mgmt": "维护人才培养方案、教学计划与排课",
}

export function getPlatformCardModules(platformId: string): PlatformCardModule[] {
  const def = platformModuleDefs[platformId]
  if (!def) return []

  return def.subModules.map((m) => ({
    id: m.id,
    title: m.label,
    desc: PLATFORM_CARD_DESCRIPTIONS[`${platformId}-${m.id}`] || (m.href === "#" ? "暂未开放" : ""),
    href: m.href,
  }))
}
