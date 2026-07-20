import type { PlatformNavigationConfig } from "@/components/platform-shell"
import {
  jobNavigationConfig,
  unifiedNavigationConfig,
  sceneNavigationConfig,
  evaluationNavigationConfig,
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
  return [
    {
      id: "org-user",
      label: "组织用户管理",
      children: [
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
      ],
    },
    {
      id: "resource",
      label: "系统资源管理",
      children: [
        { id: "resource-package", label: "套餐情况查看", href: "/portal/apps/system/resource/package" },
        { id: "resource-codes", label: "资源编码管理", href: "/portal/apps/system/resource/codes" },
        { id: "resource-industries", label: "行业管理", href: "/portal/apps/system/resource/industries" },
        { id: "resource-majors", label: "专业管理", href: "/portal/apps/system/resource/majors" },
      ],
    },
    {
      id: "logs",
      label: "日志管理",
      children: [
        { id: "logs-login", label: "登录日志查看", href: "/portal/apps/system/logs/login" },
        { id: "logs-operation", label: "操作日志查看", href: "/portal/apps/system/logs/operation" },
      ],
    },
    {
      id: "tenant",
      label: "租户信息管理",
      children: [
        { id: "tenant-config", label: "租户信息管理", href: "/portal/apps/system/tenant" },
      ],
    },
    platformGroup("career", "职业岗位学习平台", jobNavigationConfig),
    platformGroup("course", "数字课程服务平台", unifiedNavigationConfig),
    platformGroup("scene", "实践场景学习平台", sceneNavigationConfig),
    platformGroup("ability", "能力评价与测评资源管理平台", evaluationNavigationConfig),
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

let knownMenuPaths: Set<string> | undefined

export function getKnownMenuPaths(): Set<string> {
  if (!knownMenuPaths) {
    knownMenuPaths = new Set(collectHrefs(buildMenuTree(), []))
  }
  return knownMenuPaths
}

/**
 * 菜单权限判定：
 * - 角色未配置 menus（如 {schoolAdmin: true}）→ 不限制，全部可见
 * - 已配置 menus → 权限树内的页面严格按勾选控制；子路径（如 /job/positions/xxx/edit）继承最近的已授权父菜单
 * - 权限树未覆盖的路径（如资源商城）→ 默认可见
 */
export function checkMenuPermission(menus: unknown, path: string): boolean {
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
