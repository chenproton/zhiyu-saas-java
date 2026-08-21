/**
 * Vue 门户全局导航配置
 *
 * 完整移植自原 React 版 `lib/navigation-config.ts`
 * （类型定义移植自原 React 版 `platform-shell/config.ts`
 *  与 `icons.ts`，路径匹配语义移植自同目录 `utils.ts` / `PlatformSideNav.tsx`）。
 *
 * 移植原则：
 * 1. brandTitle / currentPlatformLabel / 分组结构 / 子项 label / href / matchers 与 React 逐项一致；
 * 2. 图标由 lucide-react 组件改为「字符串键 → @element-plus/icons-vue 组件」映射（platformIconMap），
 *    键名沿用 React icons.ts 的键，React 中直接引用 lucide 组件的项（Building/Database/Users/History/
 *    KeyRound/School/Handshake/Briefcase/ClipboardList/Workflow）在此补为同名字符串键；
 * 3. sideBackHref 取 React 运行时的「有效值」：走 PlatformLayout / 各域 layout 的平台一律被覆盖为
 *    `/portal/apps`（见 React components/shared/platform-layout.tsx、app/lesson/admin/layout.tsx、
 *    app/library/layout.tsx、app/portal/apps/{system,ai}/layout.tsx），alliance 与 partner 用各自配置值；
 * 4. Tailwind 专属字段（shellClassName / mainClassName / contentClassName）不移植（Element Plus 无对应类）；
 * 5. Vue 路由与 React 路径不一致处，在 matchers 追加「Vue 别名」并就近注释，保证高亮不丢；
 *    仅新增别名，不修改 React 原有 matchers 语义。
 */
import type { Component } from 'vue';
import {
  Box,
  Calendar,
  Checked,
  CircleCheck,
  Clock,
  Collection,
  Connection,
  DataBoard,
  Document,
  Files,
  FolderOpened,
  Grid,
  Guide,
  Histogram,
  HomeFilled,
  Key,
  Medal,
  OfficeBuilding,
  Operation,
  PriceTag,
  Reading,
  School,
  Setting,
  Share,
  Star,
  Suitcase,
  Tickets,
  TrendCharts,
  User,
  UserFilled
} from '@element-plus/icons-vue';

/* ============================================================
   图标映射（对齐 React packages/ui/.../platform-shell/icons.ts）
   lucide-react 无对应 Element Plus 图标时取语义最近的一枚
   ============================================================ */
export const platformIconMap = {
  archive: Box, // lucide Archive
  award: Medal, // lucide Award
  badgeCheck: Checked, // lucide BadgeCheck
  barChart: Histogram, // lucide BarChart3
  barChart3: Histogram,
  bookOpen: Reading, // lucide BookOpen
  briefcase: Suitcase, // lucide Briefcase
  building: OfficeBuilding, // lucide Building（React 直接引用组件）
  calendar: Calendar,
  checkCircle: CircleCheck,
  clipboardList: Tickets, // lucide ClipboardList（React 直接引用组件）
  database: DataBoard, // lucide Database（React 直接引用组件）
  fileText: Document,
  folderKanban: FolderOpened,
  gitBranch: Share,
  graduationCap: School,
  handshake: Connection, // lucide Handshake（React 直接引用组件）
  history: Clock, // lucide History（React 直接引用组件）
  home: HomeFilled,
  keyRound: Key, // lucide KeyRound（React 直接引用组件）
  layoutGrid: Grid,
  layers: Files,
  layers3: Collection,
  lineChart: TrendCharts,
  route: Guide,
  school: School, // lucide School（React 直接引用组件）
  settings: Setting,
  share2: Share,
  star: Star,
  tags: PriceTag,
  user: User,
  users: UserFilled,
  workflow: Operation // lucide Workflow（React 直接引用组件）
} satisfies Record<string, Component>;

export type PlatformIconKey = keyof typeof platformIconMap;

/** 解析图标键为 Element Plus 图标组件；未知键回落 Setting（对齐 React resolvePlatformIcon） */
export function resolvePlatformIcon(icon?: PlatformIconKey): Component {
  if (!icon) return Setting;
  return platformIconMap[icon] ?? Setting;
}

/* ============================================================
   类型（对齐 React platform-shell/config.ts）
   ============================================================ */
export interface TopNavItem {
  id: string;
  label: string;
  href: string;
  icon: PlatformIconKey;
  matchers?: string[];
  disabled?: boolean;
}

export interface SideNavChild {
  id: string;
  label: string;
  href: string;
  matchers?: string[];
  hidden?: boolean;
}

export interface SideNavItem {
  id: string;
  label: string;
  icon: PlatformIconKey;
  href?: string;
  matchers?: string[];
  children?: SideNavChild[];
  hidden?: boolean;
}

export interface UserMenuItem {
  id: string;
  label: string;
  href?: string;
  icon?: PlatformIconKey;
  tone?: 'default' | 'danger';
}

export interface PlatformNavigationConfig {
  brandTitle: string;
  currentPlatformId: string;
  currentPlatformLabel: string;
  sideBackHref: string;
  brandHref?: string;
  brandIcon?: PlatformIconKey;
  platformIcon?: PlatformIconKey;
  topNavItems?: TopNavItem[];
  sideNavItems: SideNavItem[];
  currentUserName?: string;
  currentUserRoleLabel?: string;
  showUserMenu?: boolean;
  userMenuItems?: UserMenuItem[];
  showCurrentTime?: boolean;
  defaultExpandedSideNavIds?: string[];
  hideSideNav?: boolean;
  platformSwitchItems?: TopNavItem[];
}

/* ============================================================
   路径匹配（对齐 React platform-shell/utils.ts matchesPath 与
   PlatformSideNav.tsx getMatchedTarget/getActiveChild）
   规则：target 以 `$` 结尾表示精确匹配；`/` 单独表示根路径；
        其余为「相等或前缀 + /」匹配。
   ============================================================ */
export function getMatchedTarget(
  pathname: string,
  href?: string,
  matchers?: string[]
): string | undefined {
  const targets = matchers && matchers.length > 0 ? matchers : href ? [href] : [];
  return targets.find((target) => {
    if (target === '/') return pathname === '/';
    if (target.endsWith('$')) return pathname === target.slice(0, -1);
    return pathname === target || pathname.startsWith(`${target}/`);
  });
}

export function matchesPath(pathname: string, href?: string, matchers?: string[]): boolean {
  return getMatchedTarget(pathname, href, matchers) !== undefined;
}

/** 命中的子项：多个 matcher 命中时取「最长 target」（对齐 React getActiveChild） */
export function getActiveChild(
  pathname: string,
  children?: SideNavChild[]
): SideNavChild | undefined {
  if (!children?.length) return undefined;
  const matched = children
    .map((child) => ({ child, target: getMatchedTarget(pathname, child.href, child.matchers) }))
    .filter((entry): entry is { child: SideNavChild; target: string } => entry.target !== undefined);
  if (matched.length === 0) return undefined;
  return matched.sort((a, b) => b.target.length - a.target.length)[0].child;
}

/** 一级项是否激活（有子项时取决于子项，对齐 React isSideItemActive） */
export function isSideItemActive(pathname: string, item: SideNavItem): boolean {
  if (item.children?.length) {
    return getActiveChild(pathname, item.children) !== undefined;
  }
  return matchesPath(pathname, item.href, item.matchers);
}

/* ============================================================
   通用用户菜单（对齐 React COMMON_USER_MENU_ITEMS）
   ============================================================ */
const COMMON_USER_MENU_ITEMS: UserMenuItem[] = [
  { id: 'profile', label: '个人中心', icon: 'user' },
  { id: 'account', label: '账号设置', icon: 'settings' },
  { id: 'logout', label: '退出登录', tone: 'danger' }
];

/* ============================================================
   统一导航树（数字课程平台）
   ============================================================ */
const LESSON_SIDE_NAV_ITEMS: SideNavItem[] = [
  {
    id: 'resource-center',
    label: '在线课资源库',
    icon: 'folderKanban',
    children: [
      {
        id: 'system',
        label: '体系课管理',
        href: '/lesson/admin/system',
        // Vue 别名：/lesson/courses（Vue 通用课程列表页，React 无此路径）
        matchers: ['/lesson/admin/system$', '/lesson/admin/system/add', '/lesson/courses$']
      },
      {
        id: 'granular',
        label: '颗粒课管理',
        href: '/lesson/admin/granular',
        matchers: ['/lesson/admin/granular$', '/lesson/admin/granular/add']
      }
    ]
  },
  {
    id: 'hybrid-center',
    label: '混合课资源库',
    icon: 'layers3',
    children: [
      {
        id: 'hybrid',
        label: '混合课模板管理',
        href: '/lesson/admin/hybrid',
        // Vue 别名：/lesson/courses/hybrid/add（Vue 混合课编辑页旧路径）
        matchers: ['/lesson/admin/hybrid$', '/lesson/admin/hybrid/add', '/lesson/courses/hybrid']
      },
      {
        id: 'hybrid-archive',
        label: '混合课历史档案库',
        href: '/lesson/admin/archive',
        // Vue 别名：/lesson/archive
        matchers: ['/lesson/admin/archive', '/lesson/archive']
      }
    ]
  },
  {
    id: 'approval-center',
    label: '批次与审批管理',
    icon: 'badgeCheck',
    children: [
      {
        id: 'batches',
        label: '批次分组管理',
        href: '/lesson/admin/batches',
        // Vue 别名：/lesson/batches
        matchers: ['/lesson/admin/batches', '/lesson/batches']
      },
      {
        id: 'workflows',
        label: '审批流程配置',
        href: '/lesson/admin/workflows',
        matchers: ['/lesson/admin/workflows']
      },
      {
        id: 'approvals',
        label: '审批中心',
        href: '/lesson/admin/approvals',
        matchers: ['/lesson/admin/approvals']
      }
    ]
  }
];

/** 对齐 React unifiedNavigationConfig */
export const unifiedNavigationConfig: PlatformNavigationConfig = {
  brandTitle: '数字课程服务平台',
  currentPlatformId: 'lesson-unified',
  currentPlatformLabel: '数字课程服务平台',
  brandHref: '/lesson/admin/system',
  brandIcon: 'bookOpen',
  platformIcon: 'bookOpen',
  sideBackHref: '/portal/apps',
  currentUserName: '教师',
  currentUserRoleLabel: '教学用户',
  showCurrentTime: true,
  showUserMenu: true,
  userMenuItems: COMMON_USER_MENU_ITEMS,
  sideNavItems: LESSON_SIDE_NAV_ITEMS,
  defaultExpandedSideNavIds: ['resource-center', 'hybrid-center', 'approval-center'],
  platformSwitchItems: []
};

/** 对齐 React adminNavigationConfig（/lesson/admin/* 实际使用，sideBackHref 被覆盖为 /portal/apps） */
export const adminNavigationConfig: PlatformNavigationConfig = {
  brandTitle: '数字课程服务平台',
  currentPlatformId: 'lesson-admin',
  currentPlatformLabel: '课程资源中心',
  brandHref: '/lesson/admin/system',
  brandIcon: 'folderKanban',
  platformIcon: 'folderKanban',
  sideBackHref: '/portal/apps',
  currentUserName: '教研管理员',
  currentUserRoleLabel: '课程资源中心',
  showCurrentTime: true,
  showUserMenu: true,
  userMenuItems: COMMON_USER_MENU_ITEMS,
  sideNavItems: LESSON_SIDE_NAV_ITEMS,
  defaultExpandedSideNavIds: ['resource-center', 'hybrid-center', 'approval-center'],
  platformSwitchItems: []
};

/* ============================================================
   Job 模块导航（产业岗位学习平台）
   ============================================================ */
export const jobNavigationConfig: PlatformNavigationConfig = {
  brandTitle: '产业岗位学习平台',
  currentPlatformId: 'job',
  currentPlatformLabel: '产业岗位学习平台',
  brandHref: '/job/positions',
  brandIcon: 'briefcase',
  platformIcon: 'briefcase',
  sideBackHref: '/portal/apps',
  currentUserName: '教师',
  currentUserRoleLabel: '教学用户',
  showCurrentTime: true,
  showUserMenu: true,
  userMenuItems: COMMON_USER_MENU_ITEMS,
  sideNavItems: [
    {
      id: 'position-center',
      label: '岗位中心',
      icon: 'briefcase',
      children: [
        {
          id: 'positions',
          label: '岗位管理',
          href: '/job/positions',
          matchers: ['/job/positions$', '/job/positions/']
        },
        {
          id: 'position-archive',
          label: '岗位归档',
          href: '/job/archive',
          matchers: ['/job/archive']
        }
      ]
    },
    {
      id: 'flow-center',
      label: '批次与审批管理',
      icon: 'settings',
      children: [
        { id: 'batches', label: '批次分组管理', href: '/job/batches', matchers: ['/job/batches'] },
        {
          id: 'workflows',
          label: '审批流程配置',
          href: '/job/workflows',
          matchers: ['/job/workflows']
        },
        {
          id: 'approvals',
          label: '审批中心',
          href: '/job/approvals',
          matchers: ['/job/approvals']
        }
      ]
    },
    {
      id: 'batch-center',
      label: '岗位展示配置',
      icon: 'layers',
      children: [
        {
          id: 'recommend',
          label: '岗位推荐',
          href: '/job/recommend',
          matchers: ['/job/recommend']
        },
        {
          id: 'learn-roads',
          label: '学习路径',
          href: '/job/learn-roads',
          matchers: ['/job/learn-roads']
        }
      ]
    }
  ],
  defaultExpandedSideNavIds: ['position-center', 'flow-center', 'batch-center'],
  platformSwitchItems: []
};

/* ============================================================
   Scene 模块导航（产业应用场景学习实践平台）
   ============================================================ */
export const sceneNavigationConfig: PlatformNavigationConfig = {
  brandTitle: '产业应用场景学习实践平台',
  currentPlatformId: 'scene',
  currentPlatformLabel: '场景学习平台',
  // React brandHref/sideBackHref 为 '/scene/'（React 有 /scene 索引页）；
  // Vue 无 /scene 路由，落点改为实际列表页 /scene/scenarios，sideBackHref 同其他平台回 /portal/apps
  brandHref: '/scene/scenarios',
  brandIcon: 'layers',
  platformIcon: 'layers',
  sideBackHref: '/portal/apps',
  currentUserName: '教师',
  currentUserRoleLabel: '教学用户',
  showCurrentTime: true,
  showUserMenu: true,
  userMenuItems: COMMON_USER_MENU_ITEMS,
  sideNavItems: [
    {
      id: 'scenario-center',
      label: '场景中心',
      icon: 'layers',
      children: [
        {
          id: 'scenarios',
          label: '场景管理',
          // React href '/scene/'，Vue 无该路由 → 指向 /scene/scenarios（matchers 保持 React 原值）
          href: '/scene/scenarios',
          matchers: ['/scene$', '/scene/scenarios']
        },
        { id: 'archive', label: '场景归档', href: '/scene/archive', matchers: ['/scene/archive'] }
      ]
    },
    {
      id: 'batch-flow',
      label: '批次与审批管理',
      icon: 'settings',
      children: [
        {
          id: 'batches',
          label: '批次分组管理',
          href: '/scene/batches',
          matchers: ['/scene/batches']
        },
        {
          id: 'workflows',
          label: '审批流程配置',
          href: '/scene/workflows',
          matchers: ['/scene/workflows']
        },
        {
          id: 'approvals',
          label: '审批中心',
          href: '/scene/approvals',
          matchers: ['/scene/approvals']
        }
      ]
    }
  ],
  defaultExpandedSideNavIds: ['scenario-center', 'batch-flow'],
  platformSwitchItems: []
};

/* ============================================================
   Evaluation 模块导航（能力评价与测评资源管理平台）
   ============================================================ */
export const evaluationNavigationConfig: PlatformNavigationConfig = {
  brandTitle: '能力评价与测评资源管理平台',
  currentPlatformId: 'evaluation',
  currentPlatformLabel: '测评管理平台',
  brandHref: '/evaluation/question-banks',
  brandIcon: 'checkCircle',
  platformIcon: 'checkCircle',
  sideBackHref: '/portal/apps',
  currentUserName: '教师',
  currentUserRoleLabel: '教学用户',
  showCurrentTime: true,
  showUserMenu: true,
  userMenuItems: COMMON_USER_MENU_ITEMS,
  sideNavItems: [
    {
      id: 'exam-center',
      label: '测评资源',
      icon: 'bookOpen',
      children: [
        {
          id: 'question-banks',
          label: '题库管理',
          href: '/evaluation/question-banks',
          matchers: ['/evaluation/question-banks']
        },
        {
          id: 'exams',
          label: '试卷管理',
          href: '/evaluation/exams',
          matchers: ['/evaluation/exams']
        },
        {
          id: 'exam-usage',
          label: '考试管理',
          href: '/evaluation/exam-usage',
          // Vue 别名：/evaluation/exam-usage-results（Vue 结果页旧路径）
          matchers: ['/evaluation/exam-usage', '/evaluation/exam-usage-results']
        }
      ]
    },
    {
      id: 'batch-flow',
      label: '批次与审批管理',
      icon: 'settings',
      children: [
        {
          id: 'batches',
          label: '批次分组管理',
          href: '/evaluation/batches',
          matchers: ['/evaluation/batches']
        },
        {
          id: 'workflows',
          label: '审批流程配置',
          href: '/evaluation/workflows',
          matchers: ['/evaluation/workflows']
        },
        {
          id: 'approvals',
          label: '审批中心',
          href: '/evaluation/approvals',
          matchers: ['/evaluation/approvals']
        }
      ]
    },
    {
      id: 'result-center',
      label: '结果与认证',
      icon: 'barChart',
      children: [
        {
          id: 'scene-results',
          label: '场景任务评价',
          href: '/evaluation/scene-results',
          matchers: ['/evaluation/scene-results']
        },
        {
          id: 'lesson-results',
          label: '课程节点评价',
          href: '/evaluation/lesson-results',
          matchers: ['/evaluation/lesson-results']
        },
        {
          id: 'daily-exam-results',
          label: '日常考试评价',
          href: '/evaluation/lesson-results/daily-exams',
          matchers: ['/evaluation/lesson-results/daily-exams']
        },
        {
          id: 'job-ability',
          label: '岗位能力认定规则',
          href: '/evaluation/job-ability',
          // Vue 别名：/evaluation/job-ability-config/:id（Vue 配置页旧路径）
          matchers: [
            '/evaluation/job-ability$',
            '/evaluation/job-ability/config',
            '/evaluation/job-ability-config'
          ]
        },
        {
          id: 'job-ability-results',
          label: '岗位能力认定结果',
          href: '/evaluation/job-ability/results',
          // Vue 别名：/evaluation/job-ability-results
          matchers: ['/evaluation/job-ability/results', '/evaluation/job-ability-results']
        }
      ]
    }
  ],
  defaultExpandedSideNavIds: ['exam-center', 'batch-flow', 'result-center'],
  platformSwitchItems: []
};

/* ============================================================
   系统管理导航（门户-系统设置）
   ============================================================ */
export const systemNavigationConfig: PlatformNavigationConfig = {
  brandTitle: '系统设置',
  currentPlatformId: 'portal-system',
  currentPlatformLabel: '系统设置',
  brandHref: '/portal/apps/system/tenant',
  brandIcon: 'settings',
  platformIcon: 'settings',
  sideBackHref: '/portal/apps',
  currentUserName: '用户',
  currentUserRoleLabel: '平台用户',
  showCurrentTime: true,
  showUserMenu: true,
  userMenuItems: [
    { id: 'workspace', label: '我的服务台', href: '/portal/workspace', icon: 'briefcase' },
    { id: 'apps', label: '应用中心', href: '/portal/apps', icon: 'layoutGrid' },
    { id: 'logout', label: '退出登录', tone: 'danger' }
  ],
  sideNavItems: [
    {
      id: 'tenant',
      label: '租户信息管理',
      icon: 'building',
      href: '/portal/apps/system/tenant',
      matchers: ['/portal/apps/system/tenant']
    },
    {
      id: 'resource',
      label: '系统资源管理',
      icon: 'database',
      children: [
        {
          id: 'package',
          label: '套餐情况查看',
          href: '/portal/apps/system/resource/package',
          matchers: ['/portal/apps/system/resource/package']
        },
        {
          id: 'codes',
          label: '资源编码管理',
          href: '/portal/apps/system/resource/codes',
          matchers: ['/portal/apps/system/resource/codes']
        },
        {
          id: 'industries',
          label: '行业管理',
          href: '/portal/apps/system/resource/industries',
          // Vue 别名：/system/industries
          matchers: ['/portal/apps/system/resource/industries', '/system/industries']
        },
        {
          id: 'majors',
          label: '专业管理',
          href: '/portal/apps/system/resource/majors',
          // Vue 别名：/system/majors
          matchers: ['/portal/apps/system/resource/majors', '/system/majors']
        }
      ]
    },
    {
      id: 'org-user',
      label: '组织用户管理',
      icon: 'users',
      children: [
        {
          id: 'org-types',
          label: '组织类型管理',
          href: '/portal/apps/system/org-user/org-types',
          // Vue 别名：/system/org-types
          matchers: ['/portal/apps/system/org-user/org-types', '/system/org-types']
        },
        {
          id: 'org-structure',
          label: '组织架构管理',
          href: '/portal/apps/system/org-user/org-structure',
          // Vue 别名：/system/organizations
          matchers: ['/portal/apps/system/org-user/org-structure', '/system/organizations']
        },
        {
          id: 'students',
          label: '学生管理',
          href: '/portal/apps/system/org-user/students',
          matchers: ['/portal/apps/system/org-user/students']
        },
        {
          id: 'teachers',
          label: '教职工管理',
          href: '/portal/apps/system/org-user/teachers',
          matchers: ['/portal/apps/system/org-user/teachers']
        },
        {
          id: 'accounts',
          label: '账户列表',
          href: '/portal/apps/system/org-user/accounts',
          // Vue 别名：/users（Vue 用户管理页）
          matchers: ['/portal/apps/system/org-user/accounts', '/users']
        },
        {
          id: 'fields',
          label: '用户字段扩展',
          href: '/portal/apps/system/org-user/fields',
          matchers: ['/portal/apps/system/org-user/fields']
        },
        {
          id: 'relations',
          label: '关系类型管理',
          href: '/portal/apps/system/org-user/relations',
          matchers: ['/portal/apps/system/org-user/relations']
        },
        {
          id: 'graduates',
          label: '毕业学生管理',
          href: '/portal/apps/system/org-user/graduates',
          matchers: ['/portal/apps/system/org-user/graduates']
        },
        {
          id: 'roles',
          label: '角色权限管理',
          href: '/portal/apps/system/org-user/roles',
          // Vue 别名：/system/roles
          matchers: ['/portal/apps/system/org-user/roles', '/system/roles']
        },
        {
          id: 'positions',
          label: '职位管理',
          href: '/portal/apps/system/org-user/positions',
          matchers: ['/portal/apps/system/org-user/positions']
        }
      ]
    },
    {
      id: 'logs',
      label: '日志管理',
      icon: 'history',
      children: [
        {
          id: 'login',
          label: '登录日志查看',
          href: '/portal/apps/system/logs/login',
          matchers: ['/portal/apps/system/logs/login']
        },
        {
          id: 'operation',
          label: '操作日志查看',
          href: '/portal/apps/system/logs/operation',
          matchers: ['/portal/apps/system/logs/operation']
        }
      ]
    }
  ],
  defaultExpandedSideNavIds: ['tenant', 'resource', 'org-user', 'logs'],
  platformSwitchItems: []
};

/* ============================================================
   Library 模块导航（资源共享平台）
   ============================================================ */
export const libraryNavigationConfig: PlatformNavigationConfig = {
  brandTitle: '资源共享平台',
  currentPlatformId: 'library',
  currentPlatformLabel: '资源共享平台',
  brandHref: '/library/knowledge',
  brandIcon: 'folderKanban',
  platformIcon: 'folderKanban',
  sideBackHref: '/portal/apps',
  currentUserName: '教师',
  currentUserRoleLabel: '教学用户',
  showCurrentTime: true,
  showUserMenu: true,
  userMenuItems: COMMON_USER_MENU_ITEMS,
  sideNavItems: [
    {
      id: 'resource-center',
      label: '公共资源库',
      icon: 'folderKanban',
      children: [
        {
          id: 'knowledge',
          label: '知识点库',
          href: '/library/knowledge',
          matchers: ['/library/knowledge']
        },
        {
          id: 'ability',
          label: '能力点库',
          href: '/library/ability',
          matchers: ['/library/ability']
        },
        {
          id: 'certificates',
          label: '证书库',
          href: '/library/certificates',
          matchers: ['/library/certificates']
        },
        {
          id: 'resources-document',
          label: '文档资源库',
          href: '/library/resources/document',
          matchers: ['/library/resources/document']
        },
        {
          id: 'resources-spreadsheet',
          label: '表格资源库',
          href: '/library/resources/spreadsheet',
          matchers: ['/library/resources/spreadsheet']
        },
        {
          id: 'resources-image',
          label: '图片资源库',
          href: '/library/resources/image',
          matchers: ['/library/resources/image']
        },
        {
          id: 'resources-link',
          label: '链接资源库',
          href: '/library/resources/link',
          matchers: ['/library/resources/link']
        },
        {
          id: 'resources-audio',
          label: '音频资源库',
          href: '/library/resources/audio',
          matchers: ['/library/resources/audio']
        },
        {
          id: 'resources-video',
          label: '视频资源库',
          href: '/library/resources/video',
          matchers: ['/library/resources/video']
        },
        {
          id: 'resources-archive',
          label: '压缩包资源库',
          href: '/library/resources/archive',
          matchers: ['/library/resources/archive']
        },
        {
          id: 'resources-venue',
          label: '场地资源库',
          href: '/library/resources/venue',
          matchers: ['/library/resources/venue']
        },
        {
          id: 'resources-facility',
          label: '设施设备资源库',
          href: '/library/resources/facility',
          matchers: ['/library/resources/facility']
        },
        {
          id: 'resources-software',
          label: '软件资源库',
          href: '/library/resources/software',
          matchers: ['/library/resources/software']
        },
        {
          id: 'resources-other',
          label: '其他资源库',
          href: '/library/resources/other',
          matchers: ['/library/resources/other']
        },
        {
          id: 'questions',
          label: '现场问答题库',
          href: '/library/questions',
          matchers: ['/library/questions']
        }
      ]
    },
    {
      id: 'my-resource-center',
      label: '我的资源库',
      icon: 'user',
      children: [
        {
          id: 'my-resources',
          label: '我的资源',
          href: '/library/my-resources',
          matchers: ['/library/my-resources']
        }
      ]
    },
    {
      id: 'tag-center',
      label: '标签管理',
      icon: 'tags',
      children: [
        {
          id: 'tags',
          label: '标签管理',
          href: '/library/tags',
          matchers: ['/library/tags']
        }
      ]
    }
  ],
  defaultExpandedSideNavIds: ['resource-center', 'my-resource-center', 'tag-center'],
  platformSwitchItems: []
};

/* ============================================================
   Affairs 模块导航（教务管理服务平台）
   ============================================================ */
export const affairsNavigationConfig: PlatformNavigationConfig = {
  brandTitle: '教务管理服务平台',
  currentPlatformId: 'affairs',
  currentPlatformLabel: '教务管理平台',
  brandHref: '/affairs/programs',
  brandIcon: 'calendar',
  platformIcon: 'calendar',
  sideBackHref: '/portal/apps',
  currentUserName: '教师',
  currentUserRoleLabel: '教学用户',
  showCurrentTime: true,
  showUserMenu: true,
  userMenuItems: COMMON_USER_MENU_ITEMS,
  sideNavItems: [
    {
      id: 'affairs-mgmt',
      label: '教务管理',
      icon: 'graduationCap',
      children: [
        {
          id: 'org-structure',
          label: '组织架构管理',
          href: '/affairs/org-structure',
          matchers: ['/affairs/org-structure']
        },
        {
          id: 'majors',
          label: '专业管理',
          href: '/affairs/majors',
          matchers: ['/affairs/majors']
        },
        {
          id: 'students',
          label: '学生管理',
          href: '/affairs/students',
          matchers: ['/affairs/students']
        },
        {
          id: 'teachers',
          label: '教职工管理',
          href: '/affairs/teachers',
          matchers: ['/affairs/teachers']
        },
        {
          id: 'relations',
          label: '人员关系管理',
          href: '/affairs/relations',
          matchers: ['/affairs/relations']
        },
        {
          id: 'positions',
          label: '职位管理',
          href: '/affairs/positions',
          matchers: ['/affairs/positions']
        },
        {
          id: 'config',
          label: '教务配置',
          href: '/affairs/config',
          // Vue 别名：/affairs/scheduling-config（Vue 场地节次配置页旧路径）
          matchers: ['/affairs/config', '/affairs/scheduling-config']
        }
      ]
    },
    {
      id: 'teaching-mgmt',
      label: '教学管理',
      icon: 'calendar',
      children: [
        {
          id: 'programs',
          label: '人才培养方案',
          href: '/affairs/programs',
          matchers: ['/affairs/programs']
        },
        {
          id: 'teaching-plans',
          label: '教学计划',
          href: '/affairs/teaching-plans',
          matchers: ['/affairs/teaching-plans']
        },
        {
          id: 'scheduling',
          label: '排课管理',
          href: '/affairs/scheduling',
          matchers: ['/affairs/scheduling']
        },
        {
          id: 'student-portraits',
          label: '学生画像',
          href: '/affairs/student-portraits',
          matchers: ['/affairs/student-portraits']
        }
      ]
    },
    {
      id: 'teaching-approval',
      label: '审批管理',
      icon: 'settings',
      children: [
        {
          id: 'batches',
          label: '批次管理',
          href: '/affairs/batches',
          matchers: ['/affairs/batches']
        },
        {
          id: 'workflows',
          label: '工作流管理',
          href: '/affairs/workflows',
          matchers: ['/affairs/workflows']
        },
        {
          id: 'approvals',
          label: '审批中心',
          href: '/affairs/approvals',
          matchers: ['/affairs/approvals']
        }
      ]
    }
  ],
  defaultExpandedSideNavIds: ['affairs-mgmt', 'teaching-mgmt', 'teaching-approval'],
  platformSwitchItems: []
};

/* ============================================================
   Partner 模块导航（企业服务台，与 Portal 学校平台平级）
   ============================================================ */
export const partnerNavigationConfig: PlatformNavigationConfig = {
  brandTitle: '企业服务台',
  currentPlatformId: 'partner',
  currentPlatformLabel: '企业服务台',
  brandHref: '/partner/workspace',
  brandIcon: 'briefcase',
  platformIcon: 'briefcase',
  sideBackHref: '/partner/workspace',
  showCurrentTime: false,
  showUserMenu: false,
  sideNavItems: [
    {
      id: 'workspace',
      label: '服务台',
      icon: 'home',
      href: '/partner/workspace',
      matchers: ['/partner/workspace$']
    },
    {
      id: 'enterprise',
      label: '企业信息',
      icon: 'building',
      href: '/partner/enterprise',
      matchers: ['/partner/enterprise$']
    },
    {
      id: 'experts',
      label: '专家资源',
      icon: 'users',
      href: '/partner/experts',
      matchers: ['/partner/experts']
    },
    {
      id: 'schools',
      label: '合作学校',
      icon: 'school',
      href: '/partner/schools',
      matchers: ['/partner/schools$']
    },
    {
      id: 'cooperation',
      label: '合作内容',
      icon: 'handshake',
      href: '/partner/cooperation',
      matchers: ['/partner/cooperation$']
    },
    {
      id: 'cobuild-positions',
      label: '岗位共建',
      icon: 'briefcase',
      href: '/partner/co-build/positions',
      // Vue 别名：/partner/co-build-positions
      matchers: ['/partner/co-build/positions', '/partner/co-build-positions']
    },
    {
      id: 'employment-projects',
      label: '就业项目',
      icon: 'clipboardList',
      href: '/partner/employment-projects',
      matchers: ['/partner/employment-projects']
    },
    {
      id: 'cobuild-scenes',
      label: '场景共建',
      icon: 'workflow',
      href: '/partner/co-build/scenes',
      // Vue 别名：/partner/co-build-scenarios
      matchers: ['/partner/co-build/scenes', '/partner/co-build-scenarios']
    },
    {
      id: 'tasks',
      label: '测评任务',
      icon: 'clipboardList',
      href: '/partner/tasks',
      matchers: ['/partner/tasks$']
    },
    {
      id: 'settings',
      label: '账号安全',
      icon: 'keyRound',
      href: '/partner/settings',
      matchers: ['/partner/settings$']
    }
  ],
  defaultExpandedSideNavIds: [],
  platformSwitchItems: []
};

/* ============================================================
   Alliance 模块导航（产教融合与就业服务平台，管理端 /portal/apps/alliance/*）
   ============================================================ */
export const allianceNavigationConfig: PlatformNavigationConfig = {
  brandTitle: '产教融合与就业服务平台',
  currentPlatformId: 'alliance',
  currentPlatformLabel: '产教融合管理平台',
  brandHref: '/portal/apps/alliance/enterprises',
  brandIcon: 'users',
  platformIcon: 'users',
  // React 未覆盖 sideBackHref，保持配置原值
  sideBackHref: '/portal/apps/alliance/enterprises',
  currentUserName: '管理员',
  currentUserRoleLabel: '学校管理员',
  showCurrentTime: true,
  showUserMenu: true,
  userMenuItems: [
    { id: 'workspace', label: '我的服务台', href: '/portal/workspace', icon: 'briefcase' },
    { id: 'apps', label: '应用中心', href: '/portal/apps', icon: 'layoutGrid' },
    { id: 'logout', label: '退出登录', tone: 'danger' }
  ],
  topNavItems: [],
  sideNavItems: [
    {
      id: 'cooperation',
      label: '产教融合管理',
      icon: 'folderKanban',
      children: [
        {
          id: 'school',
          label: '学校信息',
          href: '/portal/apps/alliance/school',
          matchers: ['/portal/apps/alliance/school']
        },
        {
          id: 'enterprises',
          label: '合作企业',
          href: '/portal/apps/alliance/enterprises',
          matchers: ['/portal/apps/alliance/enterprises']
        },
        {
          id: 'projects',
          label: '合作项目',
          href: '/portal/apps/alliance/projects',
          // Vue 别名：/alliance/projects
          matchers: ['/portal/apps/alliance/projects', '/alliance/projects']
        },
        {
          id: 'agreements',
          label: '合作协议',
          href: '/portal/apps/alliance/agreements',
          // Vue 别名：/alliance/agreements
          matchers: ['/portal/apps/alliance/agreements', '/alliance/agreements']
        },
        {
          id: 'achievements',
          label: '合作成果',
          href: '/portal/apps/alliance/achievements',
          // Vue 别名：/alliance/achievements
          matchers: ['/portal/apps/alliance/achievements', '/alliance/achievements']
        },
        {
          id: 'experts',
          label: '专家资源库',
          href: '/portal/apps/alliance/experts',
          matchers: ['/portal/apps/alliance/experts']
        },
        {
          id: 'permissions',
          label: '专家合作权限',
          href: '/portal/apps/alliance/permissions',
          matchers: ['/portal/apps/alliance/permissions']
        },
        {
          id: 'dictionaries',
          label: '字典管理',
          href: '/portal/apps/alliance/dictionaries',
          matchers: ['/portal/apps/alliance/dictionaries']
        }
      ]
    },
    {
      id: 'brand',
      label: '品牌运营管理',
      icon: 'share2',
      children: [
        {
          id: 'brand-overview',
          label: '品牌概览',
          href: '/portal/apps/alliance/brands',
          // Vue 别名：/alliance/brands
          matchers: ['/portal/apps/alliance/brands', '/alliance/brands']
        },
        {
          id: 'brand-talent',
          label: '人才品牌管理',
          href: '/portal/apps/alliance/brands/talent',
          matchers: ['/portal/apps/alliance/brands/talent']
        },
        {
          id: 'brand-employer',
          label: '雇主品牌管理',
          href: '/portal/apps/alliance/brands/employer',
          matchers: ['/portal/apps/alliance/brands/employer']
        },
        {
          id: 'brand-job',
          label: '岗位品牌管理',
          href: '/portal/apps/alliance/brands/job',
          matchers: ['/portal/apps/alliance/brands/job']
        },
        {
          id: 'brand-major',
          label: '专业品牌管理',
          href: '/portal/apps/alliance/brands/major',
          matchers: ['/portal/apps/alliance/brands/major']
        },
        {
          id: 'brand-teacher',
          label: '师资品牌管理',
          href: '/portal/apps/alliance/brands/teacher',
          matchers: ['/portal/apps/alliance/brands/teacher']
        },
        {
          id: 'brand-culture',
          label: '文化思政品牌管理',
          href: '/portal/apps/alliance/brands/culture',
          matchers: ['/portal/apps/alliance/brands/culture']
        }
      ]
    },
    {
      id: 'employment',
      label: '就业服务管理',
      icon: 'briefcase',
      children: [
        {
          id: 'employmentproject',
          label: '就业项目',
          href: '/portal/apps/alliance/employmentproject',
          matchers: ['/portal/apps/alliance/employmentproject']
        },
        {
          id: 'employmentjob',
          label: '岗位与投递',
          href: '/portal/apps/alliance/employmentjob',
          matchers: ['/portal/apps/alliance/employmentjob']
        }
      ]
    }
  ],
  defaultExpandedSideNavIds: ['cooperation', 'brand', 'employment'],
  platformSwitchItems: []
};

/* ============================================================
   路径 → 域配置解析
   React 用「各域 app/<domain>/layout.tsx」静态挂载侧边栏；
   Vue 路由为单层 PortalLayout children，故按路径前缀解析（等价映射）。
   返回 null = 该路径无左侧导航（门户页 / 前台全宽页）。
   ============================================================ */

/** 产教联盟前台页（无侧栏），对齐 React app/portal/alliance/layout.tsx */
const ALLIANCE_PUBLIC_PREFIX = '/portal/alliance';

interface DomainRule {
  /** 命中判定 */
  test: (path: string) => boolean;
  config: PlatformNavigationConfig | null;
}

const DOMAIN_RULES: DomainRule[] = [
  // ---- portal 域：先排除无侧栏的前台/门户页，再匹配管理应用 ----
  { test: (p) => p === ALLIANCE_PUBLIC_PREFIX || p.startsWith(`${ALLIANCE_PUBLIC_PREFIX}/`), config: null },
  { test: (p) => p.startsWith('/portal/apps/system'), config: systemNavigationConfig },
  { test: (p) => p.startsWith('/portal/apps/alliance'), config: allianceNavigationConfig },
  // 门户首页 / 我的服务台 / 应用服务中心及其余 /portal/* 页面：纯内容，无侧栏
  { test: (p) => p === '/portal' || p.startsWith('/portal/'), config: null },

  // ---- 业务域 ----
  { test: (p) => p.startsWith('/job/'), config: jobNavigationConfig },
  { test: (p) => p === '/scene' || p.startsWith('/scene/'), config: sceneNavigationConfig },
  { test: (p) => p.startsWith('/lesson/'), config: adminNavigationConfig },
  { test: (p) => p.startsWith('/evaluation/'), config: evaluationNavigationConfig },
  { test: (p) => p.startsWith('/library/'), config: libraryNavigationConfig },
  { test: (p) => p.startsWith('/affairs/'), config: affairsNavigationConfig },
  { test: (p) => p.startsWith('/partner/'), config: partnerNavigationConfig },
  // Vue 旧短路径：/system/*、/users 等价 React /portal/apps/system/*；/alliance/* 等价管理端联盟
  { test: (p) => p.startsWith('/system/') || p === '/users', config: systemNavigationConfig },
  { test: (p) => p.startsWith('/alliance/'), config: allianceNavigationConfig }
];

/**
 * 按当前路由路径解析左侧导航配置。
 * 返回 null 表示当前路径无左侧导航（门户页、前台全宽页、聚合页等）。
 */
export function resolvePlatformNavigationConfig(path: string): PlatformNavigationConfig | null {
  const rule = DOMAIN_RULES.find((entry) => entry.test(path));
  return rule ? rule.config : null;
}
