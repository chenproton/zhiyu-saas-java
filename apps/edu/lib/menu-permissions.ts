import type { PlatformNavigationConfig } from "@/components/platform-shell"
import {
  jobNavigationConfig,
  unifiedNavigationConfig,
  sceneNavigationConfig,
  evaluationNavigationConfig,
  libraryNavigationConfig,
  affairsNavigationConfig,
  allianceNavigationConfig,
} from "@/lib/navigation-config"

export interface MenuTreeItem {
  id: string
  label: string
  href?: string
  children?: MenuTreeItem[]
}

function platformGroup(id: string, label: string, config: PlatformNavigationConfig): MenuTreeItem {
  return {
    id,
    label,
    children: config.sideNavItems
      .filter((item) => !item.hidden)
      .map((item) => ({
        id: `${id}-${item.id}`,
        label: item.label,
        href: item.children?.length ? undefined : item.href,
        children: item.children
          ?.filter((child) => !child.hidden)
          .map((child) => ({
            id: `${id}-${item.id}-${child.id}`,
            label: child.label,
            href: child.href,
          })),
      })),
  }
}

export function buildMenuTree(): MenuTreeItem[] {
  const career = platformGroup("career", "职业岗位学习平台", jobNavigationConfig)
  career.children?.push({ id: "career-landing", label: "前台落地页", href: "/job/student" })
  const course = platformGroup("course", "数字课程服务平台", unifiedNavigationConfig)
  course.children?.push({ id: "course-landing", label: "前台落地页", href: "/lesson/landing" })
  const scene = platformGroup("scene", "实践场景学习平台", sceneNavigationConfig)
  scene.children?.push({ id: "scene-landing", label: "前台落地页", href: "/scene/landing" })
  const ability = platformGroup("ability", "能力评价与测评资源管理平台", evaluationNavigationConfig)
  ability.children?.push({ id: "ability-landing", label: "前台落地页", href: "/evaluation/landing" })
  const resource = platformGroup("resource", "教学资源共享服务平台", libraryNavigationConfig)
  resource.children?.push({ id: "resource-landing", label: "前台落地页", href: "/library/landing" })
  const affairs = platformGroup("affairs", "教务管理服务平台", affairsNavigationConfig)
  const alliance = platformGroup("alliance", "产教融合与就业服务平台", allianceNavigationConfig)

  return [
    {
      id: "system-entry",
      label: "系统设置",
      children: [
        { id: "system-entry-main", label: "系统管理入口", href: "/portal/apps/system" },
        { id: "tenant-config", label: "租户信息管理", href: "/portal/apps/system/tenant" },
        { id: "resource-package", label: "套餐情况查看", href: "/portal/apps/system/resource/package" },
        { id: "resource-codes", label: "资源编码管理", href: "/portal/apps/system/resource/codes" },
        { id: "resource-industries", label: "行业管理", href: "/portal/apps/system/resource/industries" },
        { id: "resource-majors", label: "专业管理", href: "/portal/apps/system/resource/majors" },
        { id: "org-user-teachers", label: "教职工管理", href: "/portal/apps/system/org-user/teachers" },
        { id: "org-user-students", label: "学生管理", href: "/portal/apps/system/org-user/students" },
        { id: "org-user-graduates", label: "毕业学生管理", href: "/portal/apps/system/org-user/graduates" },
        { id: "org-user-accounts", label: "账户列表", href: "/portal/apps/system/org-user/accounts" },
        { id: "org-user-roles", label: "角色权限管理", href: "/portal/apps/system/org-user/roles" },
        { id: "org-user-positions", label: "职位管理", href: "/portal/apps/system/org-user/positions" },
        { id: "org-user-org-types", label: "组织类型管理", href: "/portal/apps/system/org-user/org-types" },
        { id: "org-user-org-structure", label: "组织架构管理", href: "/portal/apps/system/org-user/org-structure" },
        { id: "org-user-fields", label: "用户字段扩展", href: "/portal/apps/system/org-user/fields" },
        { id: "org-user-relations", label: "关系类型管理", href: "/portal/apps/system/org-user/relations" },
        { id: "logs-login", label: "登录日志查看", href: "/portal/apps/system/logs/login" },
        { id: "logs-operation", label: "操作日志查看", href: "/portal/apps/system/logs/operation" },
      ],
    },
    career,
    course,
    scene,
    ability,
    resource,
    affairs,
    alliance,
  ]
}

export function normalizeMenuPath(path: string): string {
  if (!path) return path
  const clean = path.split(/[?#]/)[0]
  if (clean.length > 1 && clean.endsWith("/")) return clean.slice(0, -1)
  return clean
}

function collectHrefs(items: MenuTreeItem[], acc: string[]): string[] {
  for (const item of items) {
    if (item.href) acc.push(normalizeMenuPath(item.href))
    if (item.children) collectHrefs(item.children, acc)
  }
  return acc
}

// 菜单路径集合完全来自静态导航配置，模块加载时计算一次即可，无需可变缓存
const knownMenuPaths: ReadonlySet<string> = new Set(collectHrefs(buildMenuTree(), []))

export function getKnownMenuPaths(): ReadonlySet<string> {
  return knownMenuPaths
}

const PLATFORM_PATH_PREFIXES = [
  { prefix: "/portal/apps/system", platform: "system" },
  { prefix: "/portal/apps/alliance", platform: "alliance" },
  { prefix: "/job", platform: "career" },
  { prefix: "/lesson", platform: "course" },
  { prefix: "/scene", platform: "scene" },
  { prefix: "/evaluation", platform: "ability" },
  { prefix: "/library", platform: "resource" },
  { prefix: "/affairs", platform: "affairs" },
]

function getPathPlatformId(path: string): string | null {
  const normalized = normalizeMenuPath(path)
  for (const { prefix, platform } of PLATFORM_PATH_PREFIXES) {
    if (normalized === prefix || normalized.startsWith(prefix + "/")) {
      return platform
    }
  }
  return null
}

/**
 * 菜单权限判定：
 * - 先受租户套餐（subscriptionModules）控制：路径所属平台未订阅 → 直接不可见
 * - 角色未配置 menus（如 school_admin）→ 不限制，全部可见
 * - 已配置 menus → 权限树内的页面严格按勾选控制；子路径（如 /job/positions/xxx/edit）继承最近的已授权父菜单
 * - 权限树未覆盖的路径（如资源商城）→ 默认可见
 *
 * @param subscriptionModules 为 undefined 时表示尚未加载，跳过套餐检查，避免加载期间误拦截
 */
export function checkMenuPermission(
  menus: unknown,
  path: string,
  subscriptionModules?: Record<string, boolean>,
): boolean {
  const platformId = getPathPlatformId(path)
  if (platformId && subscriptionModules && subscriptionModules[platformId] !== true) {
    return false
  }

  if (!menus || typeof menus !== "object") return true

  const granted = new Set<string>()
  for (const [key, value] of Object.entries(menus as Record<string, unknown>)) {
    if (value === true) granted.add(normalizeMenuPath(key))
  }

  const known = getKnownMenuPaths()
  let current = normalizeMenuPath(path)
  while (current && current !== "/") {
    if (granted.has(current)) return true
    if (known.has(current)) return false
    const idx = current.lastIndexOf("/")
    if (idx <= 0) break
    current = current.slice(0, idx)
  }
  return true
}

export interface PermissionAction {
  action: string
  label: string
}

export interface PermissionPage {
  page: string
  label: string
  actions: PermissionAction[]
}

export interface PermissionModule {
  module: string
  label: string
  pages: PermissionPage[]
}

export const permissionModuleConfig: PermissionModule[] = [
  {
    module: "scene",
    label: "场景学习平台",
    pages: [
      {
        page: "scenarios",
        label: "场景管理",
        actions: [
          { action: "submit_approval", label: "提交审批" },
          { action: "withdraw_approval", label: "撤回审批" },
          { action: "publish", label: "发布" },
          { action: "unpublish", label: "取消发布" },
          { action: "delete", label: "删除" },
          { action: "review", label: "审核" },
          { action: "reject", label: "驳回" },
        ],
      },
    ],
  },
  {
    module: "job",
    label: "产业岗位学习平台",
    pages: [
      {
        page: "positions",
        label: "岗位管理",
        actions: [
          { action: "submit_approval", label: "提交审批" },
          { action: "withdraw_approval", label: "撤回审批" },
          { action: "publish", label: "发布" },
          { action: "unpublish", label: "取消发布" },
          { action: "delete", label: "删除" },
          { action: "review", label: "审核" },
          { action: "reject", label: "驳回" },
        ],
      },
    ],
  },
  {
    module: "lesson",
    label: "数字课程服务平台",
    pages: [
      {
        page: "courses",
        label: "课程管理",
        actions: [
          { action: "submit_approval", label: "提交审批" },
          { action: "withdraw_approval", label: "撤回审批" },
          { action: "publish", label: "发布" },
          { action: "unpublish", label: "取消发布" },
          { action: "delete", label: "删除" },
          { action: "review", label: "审核" },
          { action: "reject", label: "驳回" },
        ],
      },
    ],
  },
  {
    module: "evaluation",
    label: "能力评价与测评管理平台",
    pages: [
      {
        page: "exams",
        label: "试卷管理",
        actions: [
          { action: "submit_approval", label: "提交审批" },
          { action: "withdraw_approval", label: "撤回审批" },
          { action: "publish", label: "发布" },
          { action: "unpublish", label: "取消发布" },
          { action: "delete", label: "删除" },
          { action: "review", label: "审核" },
          { action: "reject", label: "驳回" },
        ],
      },
    ],
  },
]

export function getPermissionModuleConfigForRole(permissions: unknown): PermissionModule[] {
  return permissionModuleConfig
}
