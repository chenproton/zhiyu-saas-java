import type { PlatformNavigationConfig } from '@/components/platform-shell'
import {
  jobNavigationConfig,
  unifiedNavigationConfig,
  sceneNavigationConfig,
  evaluationNavigationConfig,
  libraryNavigationConfig,
  affairsNavigationConfig,
  allianceNavigationConfig,
  systemNavigationConfig,
} from '@/lib/navigation-config'

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
  const career = platformGroup('career', '职业岗位学习平台', jobNavigationConfig)
  career.children?.push({ id: 'career-landing', label: '前台落地页', href: '/job/landing' })
  const course = platformGroup('course', '数字课程服务平台', unifiedNavigationConfig)
  course.children?.push({ id: 'course-landing', label: '前台落地页', href: '/lesson/landing' })
  const scene = platformGroup('scene', '实践场景学习平台', sceneNavigationConfig)
  scene.children?.push({ id: 'scene-landing', label: '前台落地页', href: '/scene/landing' })
  const ability = platformGroup('ability', '能力评价与测评资源管理平台', evaluationNavigationConfig)
  ability.children?.push({
    id: 'ability-landing',
    label: '前台落地页',
    href: '/evaluation/landing',
  })
  const resource = platformGroup('resource', '教学资源共享服务平台', libraryNavigationConfig)
  resource.children?.push({ id: 'resource-landing', label: '前台落地页', href: '/library/landing' })
  const affairs = platformGroup('affairs', '教务管理服务平台', affairsNavigationConfig)
  const alliance = platformGroup('alliance', '产教融合与就业服务平台', allianceNavigationConfig)
  alliance.children?.push({
    id: 'alliance-landing',
    label: '前台落地页',
    href: '/portal/alliance/landing',
  })

  // AI 平台菜单树：前台功能（助手/广场/工坊/落地页）合并为单一开关，
  // href=/portal/apps/ai 由前缀继承机制覆盖全部前台子路径（checkMenuPermission 向上回溯）；
  // 管理功能（知识库/智能体审核、外部 AI 服务上架）保持独立勾选，不随前台开关授权。
  const ai: MenuTreeItem = {
    id: 'ai',
    label: 'AI 智能服务平台',
    children: [
      { id: 'ai-main', label: 'AI 智能服务中心', href: '/portal/apps/ai' },
      {
        id: 'ai-admin',
        label: 'AI 广场管理',
        children: [
          { id: 'ai-admin-reviews', label: '知识库/智能体审核', href: '/portal/apps/ai/admin/reviews' },
          { id: 'ai-admin-kbs', label: '知识库管理', href: '/portal/apps/ai/admin/kbs' },
          { id: 'ai-admin-agents', label: '智能体管理', href: '/portal/apps/ai/admin/agents' },
          {
            id: 'ai-admin-integrations',
            label: '外部 AI 服务上架',
            href: '/portal/apps/ai/admin/integrations',
          },
        ],
      },
    ],
  }

  const system = platformGroup('system-entry', '系统设置', systemNavigationConfig)
  system.children?.unshift({
    id: 'system-entry-main',
    label: '系统管理入口',
    href: '/portal/apps/system',
  })

  // 我的服务台：入口开关统一指向 /portal/workspace，具体视图由角色自动匹配
  const workspace: MenuTreeItem = {
    id: 'workspace',
    label: '门户服务台',
    children: [{ id: 'workspace-main', label: '我的服务台', href: '/portal/workspace' }],
  }

  return [
    workspace,
    system,
    ai,
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
  if (clean.length > 1 && clean.endsWith('/')) return clean.slice(0, -1)
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

function getKnownMenuPaths(): ReadonlySet<string> {
  return knownMenuPaths
}

const PLATFORM_PATH_PREFIXES = [
  { prefix: '/portal/apps/system', platform: 'system' },
  { prefix: '/portal/apps/ai', platform: 'ai' },
  { prefix: '/portal/apps/alliance', platform: 'alliance' },
  { prefix: '/job', platform: 'career' },
  { prefix: '/lesson', platform: 'course' },
  { prefix: '/scene', platform: 'scene' },
  { prefix: '/evaluation', platform: 'ability' },
  { prefix: '/library', platform: 'resource' },
  { prefix: '/affairs', platform: 'affairs' },
]

function getPathPlatformId(path: string): string | null {
  const normalized = normalizeMenuPath(path)
  for (const { prefix, platform } of PLATFORM_PATH_PREFIXES) {
    if (normalized === prefix || normalized.startsWith(prefix + '/')) {
      return platform
    }
  }
  return null
}

/**
 * 菜单权限判定（纯菜单门禁，fail-closed）：
 * - 先受租户套餐（subscriptionModules）控制：路径所属平台未订阅 → 直接不可见
 * - menus 缺失/非法（null/undefined/非对象）→ 视为无授权，权限树内已知菜单路径拒绝
 *   （超级管理员全量放行由调用方按角色显式短路，不再依赖「无 menus = 全部可见」的隐式约定）
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

  const granted = new Set<string>()
  if (menus && typeof menus === 'object') {
    for (const [key, value] of Object.entries(menus as Record<string, unknown>)) {
      if (value === true) granted.add(normalizeMenuPath(key))
    }
  }

  const known = getKnownMenuPaths()
  let current = normalizeMenuPath(path)
  while (current && current !== '/') {
    if (granted.has(current)) return true
    if (known.has(current)) return false
    const idx = current.lastIndexOf('/')
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

// 内容型模块共用的审批/发布/删除/审核操作清单（四页重复定义，收敛为单点）。
const COMMON_APPROVAL_ACTIONS: PermissionAction[] = [
  { action: 'submit_approval', label: '提交审批' },
  { action: 'withdraw_approval', label: '撤回审批' },
  { action: 'publish', label: '发布' },
  { action: 'unpublish', label: '取消发布' },
  { action: 'delete', label: '删除' },
  { action: 'review', label: '审核' },
  { action: 'reject', label: '驳回' },
]

export const permissionModuleConfig: PermissionModule[] = [
  {
    module: 'scene',
    label: '场景学习平台',
    pages: [
      {
        page: 'scenarios',
        label: '场景管理',
        actions: COMMON_APPROVAL_ACTIONS,
      },
    ],
  },
  {
    module: 'job',
    label: '产业岗位学习平台',
    pages: [
      {
        page: 'positions',
        label: '岗位管理',
        actions: COMMON_APPROVAL_ACTIONS,
      },
    ],
  },
  {
    module: 'lesson',
    label: '数字课程服务平台',
    pages: [
      {
        page: 'courses',
        label: '课程管理',
        actions: COMMON_APPROVAL_ACTIONS,
      },
    ],
  },
  {
    module: 'evaluation',
    label: '能力评价与测评管理平台',
    pages: [
      {
        page: 'exams',
        label: '试卷管理',
        actions: COMMON_APPROVAL_ACTIONS,
      },
    ],
  },
]
