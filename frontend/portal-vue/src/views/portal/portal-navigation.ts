/**
 * 门户首页 / 应用服务中心的共享数据与权限助手（对齐 React）。
 *
 * 对齐来源（React）：
 * - 原 React 版 portal/page.tsx           → 首页 hero + 特性胶囊 + 三组生态 + 12 张平台卡
 * - 原 React 版 portal/apps/page.tsx      → 应用中心菜单/常用服务/模块卡
 * - 原 React 版 lib/navigation-config.ts  → platformModuleDefs / getPlatformCardModules
 * - 原 React 版 lib/menu-permissions.ts   → checkMenuPermission
 * - 原 React 版 lib/frequent-services.ts  → 常用服务点击计数
 * - 原 React 版 portal-auth-context.tsx   → hasMenuPermission 语义
 *
 * 说明：src/api/*.ts 未收录订阅/登录态聚合端点，按任务约定不改 api/*.ts，
 * 这里用同一 request()/portalRequest() 直连相同后端路径（Java 后端 /api/v1 已注册）。
 * 图标以字符串 key 表达，由页面映射到 @element-plus/icons-vue 组件，避免 ts 里耦合具体图标。
 */

import { request, portalRequest } from '@/api/http';
import type { Role } from '@/types/system';
import type { User } from '@/types/user';

/* ==================== 首页（/portal）==================== */

export interface HomePlatformItem {
  id: string;
  icon: string; // 图标 key，见 HOME_ICONS / APP_ICONS
  color: string; // 图标前景色（hex，对齐 React tailwind -500 系）
  bg: string; // 图标底色（hex，对齐 React tailwind -50 系）
  title: string;
  desc: string;
}

export const HOME_FEATURES = [
  '以产业需求为牵引',
  '以学生能力为中心',
  '以场景实践为载体',
  '以跨专业融合为特征',
  '以数智技术为支撑'
];

/** 首页 12 张平台卡（顺序即 BENTO_LAYOUT 展示顺序） */
export const HOME_PLATFORMS: HomePlatformItem[] = [
  {
    id: 'alliance',
    icon: 'users',
    color: '#f43f5e',
    bg: '#fff1f2',
    title: '产教融合与就业服务平台',
    desc: '共建校企合作生态，打造具有行业影响力的人才培养品牌。'
  },
  {
    id: 'career',
    icon: 'briefcase',
    color: '#a855f7',
    bg: '#faf5ff',
    title: '产业岗位学习平台',
    desc: '清晰呈现岗位能力图谱，为学生提供目标清晰、路径可视的职业生涯导航。'
  },
  {
    id: 'scene',
    icon: 'layers',
    color: '#06b6d4',
    bg: '#ecfeff',
    title: '产业应用场景学习实践平台',
    desc: '还原真实工作场景，让学生在解决实际问题中习得技能，培养做中学的实践本领。'
  },
  {
    id: 'ability',
    icon: 'check-circle',
    color: '#10b981',
    bg: '#ecfdf5',
    title: 'COFA测评中心',
    desc: '基于统一评价标准，实现对实践过程与结果的精准量化评估与技能认证。'
  },
  {
    id: 'course',
    icon: 'book',
    color: '#f59e0b',
    bg: '#fffbeb',
    title: '数字课程服务平台',
    desc: '以颗粒课资源支撑体系课程，实现按需学习与查漏补缺的知识高效获取。'
  },
  {
    id: 'resource',
    icon: 'share',
    color: '#3b82f6',
    bg: '#eff6ff',
    title: '教学资产共享中心',
    desc: '沉淀校本智力资产，构建共建共享、持续进化的场景化数智教学资源生态。'
  },
  {
    id: 'mall',
    icon: 'shopping-cart',
    color: '#ec4899',
    bg: '#fdf2f8',
    title: '产教资源中心',
    desc: '汇聚精品教学资源，链接企业与院校，促进教育智力资产流转共享。'
  },
  {
    id: 'affairs',
    icon: 'calendar',
    color: '#14b8a6',
    bg: '#f0fdfa',
    title: '教务管理服务平台',
    desc: '统筹人培标准、排课，保障教学秩序顺畅运行'
  },
  {
    id: 'research',
    icon: 'graduation-cap',
    color: '#8b5cf6',
    bg: '#f5f3ff',
    title: '教科研服务中心',
    desc: '统筹教科研业务与成果资源，助力教师专业成长，赋能教改提质与成果转化。'
  },
  {
    id: 'decision',
    icon: 'bar-chart',
    color: '#0ea5e9',
    bg: '#f0f9ff',
    title: '数智决策中心',
    desc: '整合办学多维数据，可视化研判办学态势，赋能院校科学治理、高效决策。'
  },
  {
    id: 'opc',
    icon: 'rocket',
    color: '#f97316',
    bg: '#fff7ed',
    title: 'OPC 专区',
    desc: '依托一人公司培育模式，赋能学生灵活就业、轻量化创业，拓宽职业发展赛道。'
  }
];

/** 首页三组生态（每组 4 张卡，顺序同 React SECTIONS） */
export const HOME_SECTIONS = [
  { title: '产教协同育人生态', ids: ['alliance', 'career', 'scene', 'ability'] },
  { title: '教学资源保障生态', ids: ['course', 'resource', 'mall'] },
  { title: '教学治理服务生态', ids: ['affairs', 'research', 'decision', 'opc'] }
];

/** 首页卡片的内部路由（React INTERNAL_ROUTES；缺失 id = 暂未开放） */
export const HOME_INTERNAL_ROUTES: Record<string, string> = {
  career: '/job/landing',
  scene: '/scene/landing',
  ability: '/evaluation/landing',
  course: '/lesson/landing',
  resource: '/library/landing',
  affairs: '/affairs/programs',
  alliance: '/portal/alliance/landing'
};

/* ==================== 应用服务中心（/portal/apps）==================== */

export interface AppsMenuItem {
  id: string;
  label: string;
  icon: string;
}

export const APPS_MENU_ITEMS: AppsMenuItem[] = [
  { id: 'system', label: '系统管理', icon: 'setting' },
  { id: 'career', label: '职业岗位学习平台', icon: 'briefcase' },
  { id: 'scene', label: '实践场景学习平台', icon: 'layers' },
  { id: 'course', label: '数字课程服务平台', icon: 'book' },
  { id: 'ability', label: '能力评价与测评资源管理平台', icon: 'check-circle' },
  { id: 'resource', label: '教学资源共享服务平台', icon: 'share' },
  { id: 'alliance', label: '产教协同与人才品牌运营平台', icon: 'users' },
  { id: 'affairs', label: '教务服务平台', icon: 'calendar' },
  { id: 'opc', label: 'OPC专区', icon: 'rocket' },
  { id: 'decision', label: '敏捷决策中心', icon: 'bar-chart' },
  { id: 'research', label: '教科研服务中心', icon: 'graduation-cap' }
];

/** 平台分组配色（对齐 React platformStyles） */
export const APPS_PLATFORM_STYLES: Record<string, { color: string; bg: string }> = {
  system: { color: '#2563eb', bg: '#eff6ff' },
  alliance: { color: '#e11d48', bg: '#fff1f2' },
  career: { color: '#9333ea', bg: '#faf5ff' },
  course: { color: '#d97706', bg: '#fffbeb' },
  scene: { color: '#0891b2', bg: '#ecfeff' },
  ability: { color: '#059669', bg: '#ecfdf5' },
  affairs: { color: '#0d9488', bg: '#f0fdfa' },
  resource: { color: '#2563eb', bg: '#eff6ff' },
  opc: { color: '#ea580c', bg: '#fff7ed' },
  decision: { color: '#0284c7', bg: '#f0f9ff' },
  research: { color: '#7c3aed', bg: '#f5f3ff' }
};

/** 平台分组的落地入口（对齐 React platformModuleDefs[].href） */
export const APPS_PLATFORM_HREFS: Record<string, string> = {
  system: '/portal/apps/system/tenant',
  career: '/job/positions',
  scene: '/scene',
  course: '/lesson/admin/system',
  ability: '/evaluation/question-banks',
  resource: '/library/knowledge',
  alliance: '/portal/alliance/landing',
  affairs: '/affairs/org-structure',
  opc: '#',
  decision: '#',
  research: '#'
};

export interface AppsModuleItem {
  id: string;
  title: string;
  desc: string;
  href: string;
}

/** 平台 → 模块卡（对齐 React getPlatformCardModules，顶层菜单粒度） */
export const APPS_PLATFORM_MODULES: Record<string, AppsModuleItem[]> = {
  system: [
    { id: 'tenant', title: '租户信息管理', desc: '维护租户基本信息与联系方式', href: '/portal/apps/system/tenant' },
    { id: 'resource', title: '系统资源管理', desc: '管理套餐、资源编码与行业标准', href: '/portal/apps/system/resource/package' },
    { id: 'org-user', title: '组织用户管理', desc: '维护组织架构、账户与角色权限', href: '/portal/apps/system/org-user/org-types' },
    { id: 'logs', title: '日志管理', desc: '查看登录与操作审计日志', href: '/portal/apps/system/logs/login' }
  ],
  career: [
    { id: 'position-center', title: '岗位中心', desc: '建设与管理产业岗位资源', href: '/job/positions' },
    { id: 'flow-center', title: '批次与审批管理', desc: '配置审批流程与分组批次', href: '/job/batches' },
    { id: 'batch-center', title: '岗位展示配置', desc: '配置推荐岗位与学习路径', href: '/job/recommend' }
  ],
  scene: [
    { id: 'scenario-center', title: '场景中心', desc: '建设与管理实践场景资源', href: '/scene/' },
    { id: 'batch-flow', title: '批次与审批管理', desc: '配置场景审批流程与批次', href: '/scene/batches' }
  ],
  course: [
    { id: 'resource-center', title: '在线课资源库', desc: '建设体系课与颗粒课资源', href: '/lesson/admin/system' },
    { id: 'hybrid-center', title: '混合课资源库', desc: '管理混合课模板与历史档案', href: '/lesson/admin/hybrid' },
    { id: 'approval-center', title: '批次与审批管理', desc: '配置课程审批流程与批次', href: '/lesson/admin/batches' }
  ],
  ability: [
    { id: 'exam-center', title: '测评资源', desc: '管理题库、试卷与考试资源', href: '/evaluation/question-banks' },
    { id: 'batch-flow', title: '批次与审批管理', desc: '配置测评审批流程与批次', href: '/evaluation/batches' },
    { id: 'result-center', title: '结果与认证', desc: '查看场景任务评价与认证结果', href: '/evaluation/scene-results' }
  ],
  resource: [
    { id: 'resource-center', title: '公共资源库', desc: '管理知识点、能力点与教学资源', href: '/library/knowledge' },
    { id: 'my-resource-center', title: '我的资源库', desc: '管理个人教学资源', href: '/library/my-resources' },
    { id: 'tag-center', title: '标签管理', desc: '管理资源标签，支撑资源分类与检索筛选', href: '/library/tags' }
  ],
  alliance: [
    { id: 'cooperation', title: '产教融合管理', desc: '管理校企合作项目与成果', href: '/portal/apps/alliance/school' },
    { id: 'brand', title: '品牌运营管理', desc: '管理六大品牌资源', href: '/portal/apps/alliance/brands' },
    { id: 'employment', title: '就业服务管理', desc: '', href: '/portal/apps/alliance/employmentproject' }
  ],
  affairs: [
    { id: 'affairs-mgmt', title: '教务管理', desc: '维护组织架构、专业、师生与职位数据，配置学期场地等教务基础数据', href: '/affairs/org-structure' },
    { id: 'teaching-mgmt', title: '教学管理', desc: '维护培养方案、教学计划与排课', href: '/affairs/programs' },
    { id: 'teaching-approval', title: '审批管理', desc: '维护审批流程与批次管理', href: '/affairs/batches' }
  ],
  opc: [],
  decision: [],
  research: []
};

/** 常用服务（对齐 React quickAccess） */
export const APPS_QUICK_ACCESS = [
  { icon: 'setting', label: '组织权限', href: '/portal/apps/system/org-user/roles' },
  { icon: 'briefcase', label: '岗位资源管理', href: '/job/positions' },
  { icon: 'layers', label: '场景资源管理', href: '/scene' },
  { icon: 'bar-chart', label: '日志管理', href: '/portal/apps/system/logs/login' }
];

/* ==================== 常用服务点击计数（对齐 frequent-services.ts）==================== */

const SERVICE_CLICKS_KEY = 'zhiyu-portal-service-clicks';

export function getServiceClickCounts(): Record<string, number> {
  try {
    const raw = globalThis.localStorage.getItem(SERVICE_CLICKS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, number>) : {};
  } catch {
    return {};
  }
}

export function recordServiceClick(href: string): void {
  try {
    const counts = getServiceClickCounts();
    counts[href] = (counts[href] || 0) + 1;
    globalThis.localStorage.setItem(SERVICE_CLICKS_KEY, JSON.stringify(counts));
  } catch {
    // localStorage 不可用时忽略
  }
}

/* ==================== 登录态与菜单权限（对齐 auth-provider + menu-permissions）==================== */

export interface PortalMeResponse {
  user: User;
  tenant?: { id: string; name: string };
  roles?: Role[];
}

const ROLE_PRIORITY = ['school_admin', 'teacher', 'student', 'enterprise_mentor'];
const ACTIVE_ROLE_PREFIX = 'zhiyu-active-role:';

export function resolveActiveRole(userId: string | undefined, roles: Role[] | undefined): Role | undefined {
  if (!roles || roles.length === 0) return undefined;
  if (userId) {
    try {
      const saved = localStorage.getItem(ACTIVE_ROLE_PREFIX + userId);
      if (saved) {
        const found = roles.find((r) => r.id === saved);
        if (found) return found;
      }
    } catch {
      // ignore storage errors
    }
  }
  for (const code of ROLE_PRIORITY) {
    const found = roles.find((r) => r.code === code);
    if (found) return found;
  }
  return roles[0];
}

/** 一次性拉取登录态 + 订阅模块（对齐 AuthProvider / useSubscriptionModules） */
export async function loadPortalAuth() {
  let me: PortalMeResponse | null = null;
  try {
    me = await request<PortalMeResponse>('/auth/portal/me');
  } catch {
    me = null;
  }

  const tenantId = me?.user?.tenantId;
  let subscriptionModules: Record<string, boolean> | null = null;
  if (tenantId) {
    try {
      const data = await portalRequest<{ modules?: Record<string, boolean> }>(
        `/subscriptions?tenantId=${tenantId}`
      );
      subscriptionModules = data && typeof data.modules === 'object' ? data.modules : {};
    } catch {
      // 订阅接口失败保持 null（跳过套餐校验），避免失败态成为最严拦截态
      subscriptionModules = null;
    }
  }

  return { me, subscriptionModules };
}

const PLATFORM_PATH_PREFIXES: { prefix: string; platform: string }[] = [
  { prefix: '/portal/apps/system', platform: 'system' },
  { prefix: '/portal/apps/alliance', platform: 'alliance' },
  { prefix: '/job', platform: 'career' },
  { prefix: '/lesson', platform: 'course' },
  { prefix: '/scene', platform: 'scene' },
  { prefix: '/evaluation', platform: 'ability' },
  { prefix: '/library', platform: 'resource' },
  { prefix: '/affairs', platform: 'affairs' }
];

function normalizeMenuPath(path: string): string {
  if (!path) return path;
  const clean = path.split(/[?#]/)[0];
  if (clean.length > 1 && clean.endsWith('/')) return clean.slice(0, -1);
  return clean;
}

function getPathPlatformId(path: string): string | null {
  const normalized = normalizeMenuPath(path);
  for (const { prefix, platform } of PLATFORM_PATH_PREFIXES) {
    if (normalized === prefix || normalized.startsWith(prefix + '/')) return platform;
  }
  return null;
}

// 已知菜单路径：来自首页内部路由 + 应用中心模块卡 href（fail-closed 判定用）
const KNOWN_MENU_PATHS: ReadonlySet<string> = (() => {
  const acc = new Set<string>();
  for (const href of Object.values(HOME_INTERNAL_ROUTES)) acc.add(normalizeMenuPath(href));
  for (const href of Object.values(APPS_PLATFORM_HREFS)) {
    if (href && href !== '#') acc.add(normalizeMenuPath(href));
  }
  for (const modules of Object.values(APPS_PLATFORM_MODULES)) {
    for (const m of modules) {
      if (m.href && m.href !== '#') acc.add(normalizeMenuPath(m.href));
    }
  }
  return acc;
})();

/**
 * 菜单权限判定（对齐 React checkMenuPermission，fail-closed）：
 * - 先受租户套餐控制：路径所属平台未订阅 → 不可见
 * - menus 缺失/非法 → 视为无授权，已知菜单路径拒绝
 * - 已配置 menus → 子路径继承最近已授权父菜单
 * - 权限树未覆盖的路径 → 默认可见
 */
export function checkMenuPermission(
  menus: unknown,
  path: string,
  subscriptionModules?: Record<string, boolean> | null
): boolean {
  const platformId = getPathPlatformId(path);
  if (platformId && subscriptionModules && subscriptionModules[platformId] !== true) {
    return false;
  }

  const granted = new Set<string>();
  if (menus && typeof menus === 'object') {
    for (const [key, value] of Object.entries(menus as Record<string, unknown>)) {
      if (value === true) granted.add(normalizeMenuPath(key));
    }
  }

  let current = normalizeMenuPath(path);
  while (current && current !== '/') {
    if (granted.has(current)) return true;
    if (KNOWN_MENU_PATHS.has(current)) return false;
    const idx = current.lastIndexOf('/');
    if (idx <= 0) break;
    current = current.slice(0, idx);
  }
  return true;
}

/**
 * 对齐 React hasMenuPermission：
 * school_admin/platform_admin 未显式配置 menus 时全量放行；一旦显式配置则按菜单判定。
 */
export function hasMenuPermission(
  activeRoleCode: string | undefined,
  menus: unknown,
  path: string,
  subscriptionModules?: Record<string, boolean> | null
): boolean {
  const hasExplicitMenus = menus != null && typeof menus === 'object' && Object.keys(menus as object).length > 0;
  if ((activeRoleCode === 'school_admin' || activeRoleCode === 'platform_admin') && !hasExplicitMenus) {
    return true;
  }
  return checkMenuPermission(menus, path, subscriptionModules);
}
