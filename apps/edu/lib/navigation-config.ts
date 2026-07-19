import type { PlatformNavigationConfig } from "@/components/platform-shell"

/* ============================================================
   统一导航树（数字课程平台）
   不再区分课程资源中心 / 课程建设与教学运行 / 学生学习平台
   ============================================================ */
export const unifiedNavigationConfig: PlatformNavigationConfig = {
  brandTitle: "数字课程服务平台",
  currentPlatformId: "lesson-unified",
  currentPlatformLabel: "数字课程服务平台",
  brandHref: "/lesson/teacher/claim",
  brandIcon: "bookOpen",
  platformIcon: "bookOpen",
  sideBackHref: "/lesson/teacher/claim",
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
      id: "course-open",
      label: "教学空间",
      icon: "layoutGrid",
      children: [
        { id: "claim", label: "开课计划管理", href: "/lesson/teacher/claim", matchers: ["/lesson/teacher/claim"] },
        { id: "behavior-collection", label: "课程学习跟踪", href: "/lesson/teacher/behavior-collection", matchers: ["/lesson/teacher/behavior-collection"] },
        { id: "progress-tracking", label: "课程测评跟踪", href: "/lesson/teacher/progress-tracking", matchers: ["/lesson/teacher/progress-tracking"] },
        { id: "final-assessment", label: "课程期末总评", href: "/lesson/teacher/final-assessment", matchers: ["/lesson/teacher/final-assessment"] },
        { id: "grade-submit", label: "成绩确认与提交", href: "/lesson/teacher/grade-submit", matchers: ["/lesson/teacher/grade-submit"] },
        { id: "learning-portrait", label: "我的学生画像", href: "/lesson/teacher/learning-portrait", matchers: ["/lesson/teacher/learning-portrait"] },
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
    "course-open",
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
    {
      id: "course-open",
      label: "教学空间",
      icon: "layoutGrid",
      children: [
        { id: "claim", label: "开课计划管理", href: "/lesson/teacher/claim", matchers: ["/lesson/teacher/claim"] },
        { id: "behavior-collection", label: "课程学习跟踪", href: "/lesson/teacher/behavior-collection", matchers: ["/lesson/teacher/behavior-collection"] },
        { id: "progress-tracking", label: "课程测评跟踪", href: "/lesson/teacher/progress-tracking", matchers: ["/lesson/teacher/progress-tracking"] },
        { id: "final-assessment", label: "课程期末总评", href: "/lesson/teacher/final-assessment", matchers: ["/lesson/teacher/final-assessment"] },
        { id: "grade-submit", label: "成绩确认与提交", href: "/lesson/teacher/grade-submit", matchers: ["/lesson/teacher/grade-submit"] },
        { id: "learning-portrait", label: "我的学生画像", href: "/lesson/teacher/learning-portrait", matchers: ["/lesson/teacher/learning-portrait"] },
      ],
    },
  ],
  defaultExpandedSideNavIds: ["resource-center", "hybrid-center", "approval-center", "course-open"],
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
        { id: "methods", label: "测评方式", href: "/evaluation/methods", matchers: ["/evaluation/methods"] },
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
        { id: "scene-results", label: "场景结果", href: "/evaluation/scene-results", matchers: ["/evaluation/scene-results"] },
        { id: "job-ability", label: "岗位能力", href: "/evaluation/job-ability", matchers: ["/evaluation/job-ability"] },
        { id: "certificates", label: "微证书", href: "/evaluation/certificates/templates", matchers: ["/evaluation/certificates"] },
      ],
    },
    {
      id: "graduate-portrait",
      label: "毕业与画像",
      icon: "graduationCap",
      children: [
        { id: "graduation", label: "毕业设计", href: "/evaluation/graduation/topics", matchers: ["/evaluation/graduation"] },
        { id: "portraits", label: "学生画像", href: "/evaluation/portraits", matchers: ["/evaluation/portraits"] },
      ],
    },
  ],
  defaultExpandedSideNavIds: ["exam-center", "batch-flow", "result-center", "graduate-portrait"],
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
  sideNavItems: [
    {
      id: "system",
      label: "系统管理",
      icon: "settings",
      children: [
        { id: "tenant", label: "租户信息", href: "/portal/apps/system/tenant", matchers: ["/portal/apps/system/tenant"] },
        { id: "org-user", label: "组织用户", href: "/portal/apps/system/org-user/org-structure", matchers: ["/portal/apps/system/org-user"] },
        { id: "resource", label: "系统资源", href: "/portal/apps/system/resource/package", matchers: ["/portal/apps/system/resource"] },
        { id: "logs", label: "日志管理", href: "/portal/apps/system/logs/login", matchers: ["/portal/apps/system/logs"] },
      ],
    },
  ],
  defaultExpandedSideNavIds: ["system"],
  platformSwitchItems: [],
  shellClassName: "bg-background",
  mainClassName: "min-w-0 flex-1",
}
