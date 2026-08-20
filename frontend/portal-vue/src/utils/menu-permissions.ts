/**
 * 角色权限配置数据（对齐 React frontend/edu/lib/menu-permissions.ts）。
 *
 * MENU_TREE 由 React navigation-config 的 buildMenuTree() 输出静态生成（142 节点），
 * 用于角色权限配置对话框的「菜单权限」Tab；permissionModuleConfig 驱动「操作权限」Tab。
 * 判定逻辑（checkMenuPermission）见 @/views/portal/portal-navigation.ts。
 */

export interface MenuTreeItem {
  id: string;
  label: string;
  href?: string;
  children?: MenuTreeItem[];
}

export const MENU_TREE: MenuTreeItem[] = [
  { id: 'workspace', label: '门户服务台',
    children: [
    { id: 'workspace-main', label: '我的服务台', href: '/portal/workspace' }
    ] },
  { id: 'system-entry', label: '系统设置',
    children: [
    { id: 'system-entry-main', label: '系统管理入口', href: '/portal/apps/system' },
    { id: 'system-entry-tenant', label: '租户信息管理', href: '/portal/apps/system/tenant' },
    { id: 'system-entry-resource', label: '系统资源管理',
      children: [
      { id: 'system-entry-resource-package', label: '套餐情况查看', href: '/portal/apps/system/resource/package' },
      { id: 'system-entry-resource-codes', label: '资源编码管理', href: '/portal/apps/system/resource/codes' },
      { id: 'system-entry-resource-industries', label: '行业管理', href: '/portal/apps/system/resource/industries' },
      { id: 'system-entry-resource-majors', label: '专业管理', href: '/portal/apps/system/resource/majors' }
      ] },
    { id: 'system-entry-org-user', label: '组织用户管理',
      children: [
      { id: 'system-entry-org-user-org-types', label: '组织类型管理', href: '/portal/apps/system/org-user/org-types' },
      { id: 'system-entry-org-user-org-structure', label: '组织架构管理', href: '/portal/apps/system/org-user/org-structure' },
      { id: 'system-entry-org-user-students', label: '学生管理', href: '/portal/apps/system/org-user/students' },
      { id: 'system-entry-org-user-teachers', label: '教职工管理', href: '/portal/apps/system/org-user/teachers' },
      { id: 'system-entry-org-user-accounts', label: '账户列表', href: '/portal/apps/system/org-user/accounts' },
      { id: 'system-entry-org-user-fields', label: '用户字段扩展', href: '/portal/apps/system/org-user/fields' },
      { id: 'system-entry-org-user-relations', label: '关系类型管理', href: '/portal/apps/system/org-user/relations' },
      { id: 'system-entry-org-user-graduates', label: '毕业学生管理', href: '/portal/apps/system/org-user/graduates' },
      { id: 'system-entry-org-user-roles', label: '角色权限管理', href: '/portal/apps/system/org-user/roles' },
      { id: 'system-entry-org-user-positions', label: '职位管理', href: '/portal/apps/system/org-user/positions' }
      ] },
    { id: 'system-entry-logs', label: '日志管理',
      children: [
      { id: 'system-entry-logs-login', label: '登录日志查看', href: '/portal/apps/system/logs/login' },
      { id: 'system-entry-logs-operation', label: '操作日志查看', href: '/portal/apps/system/logs/operation' }
      ] }
    ] },
  { id: 'ai', label: 'AI 智能服务平台',
    children: [
    { id: 'ai-main', label: 'AI 智能服务中心', href: '/portal/apps/ai' },
    { id: 'ai-admin', label: 'AI 广场管理',
      children: [
      { id: 'ai-admin-reviews', label: '知识库/智能体审核', href: '/portal/apps/ai/admin/reviews' },
      { id: 'ai-admin-kbs', label: '知识库管理', href: '/portal/apps/ai/admin/kbs' },
      { id: 'ai-admin-agents', label: '智能体管理', href: '/portal/apps/ai/admin/agents' },
      { id: 'ai-admin-integrations', label: '外部 AI 服务上架', href: '/portal/apps/ai/admin/integrations' }
      ] }
    ] },
  { id: 'career', label: '职业岗位学习平台',
    children: [
    { id: 'career-position-center', label: '岗位中心',
      children: [
      { id: 'career-position-center-positions', label: '岗位管理', href: '/job/positions' },
      { id: 'career-position-center-position-archive', label: '岗位归档', href: '/job/archive' }
      ] },
    { id: 'career-flow-center', label: '批次与审批管理',
      children: [
      { id: 'career-flow-center-batches', label: '批次分组管理', href: '/job/batches' },
      { id: 'career-flow-center-workflows', label: '审批流程配置', href: '/job/workflows' },
      { id: 'career-flow-center-approvals', label: '审批中心', href: '/job/approvals' }
      ] },
    { id: 'career-batch-center', label: '岗位展示配置',
      children: [
      { id: 'career-batch-center-recommend', label: '岗位推荐', href: '/job/recommend' },
      { id: 'career-batch-center-learn-roads', label: '学习路径', href: '/job/learn-roads' }
      ] },
    { id: 'career-landing', label: '前台落地页', href: '/job/landing' }
    ] },
  { id: 'course', label: '数字课程服务平台',
    children: [
    { id: 'course-resource-center', label: '在线课资源库',
      children: [
      { id: 'course-resource-center-system', label: '体系课管理', href: '/lesson/admin/system' },
      { id: 'course-resource-center-granular', label: '颗粒课管理', href: '/lesson/admin/granular' }
      ] },
    { id: 'course-hybrid-center', label: '混合课资源库',
      children: [
      { id: 'course-hybrid-center-hybrid', label: '混合课模板管理', href: '/lesson/admin/hybrid' },
      { id: 'course-hybrid-center-hybrid-archive', label: '混合课历史档案库', href: '/lesson/admin/archive' }
      ] },
    { id: 'course-approval-center', label: '批次与审批管理',
      children: [
      { id: 'course-approval-center-batches', label: '批次分组管理', href: '/lesson/admin/batches' },
      { id: 'course-approval-center-workflows', label: '审批流程配置', href: '/lesson/admin/workflows' },
      { id: 'course-approval-center-approvals', label: '审批中心', href: '/lesson/admin/approvals' }
      ] },
    { id: 'course-landing', label: '前台落地页', href: '/lesson/landing' }
    ] },
  { id: 'scene', label: '实践场景学习平台',
    children: [
    { id: 'scene-scenario-center', label: '场景中心',
      children: [
      { id: 'scene-scenario-center-scenarios', label: '场景管理', href: '/scene/' },
      { id: 'scene-scenario-center-archive', label: '场景归档', href: '/scene/archive' }
      ] },
    { id: 'scene-batch-flow', label: '批次与审批管理',
      children: [
      { id: 'scene-batch-flow-batches', label: '批次分组管理', href: '/scene/batches' },
      { id: 'scene-batch-flow-workflows', label: '审批流程配置', href: '/scene/workflows' },
      { id: 'scene-batch-flow-approvals', label: '审批中心', href: '/scene/approvals' }
      ] },
    { id: 'scene-landing', label: '前台落地页', href: '/scene/landing' }
    ] },
  { id: 'ability', label: '能力评价与测评资源管理平台',
    children: [
    { id: 'ability-exam-center', label: '测评资源',
      children: [
      { id: 'ability-exam-center-question-banks', label: '题库管理', href: '/evaluation/question-banks' },
      { id: 'ability-exam-center-exams', label: '试卷管理', href: '/evaluation/exams' },
      { id: 'ability-exam-center-exam-usage', label: '考试管理', href: '/evaluation/exam-usage' }
      ] },
    { id: 'ability-batch-flow', label: '批次与审批管理',
      children: [
      { id: 'ability-batch-flow-batches', label: '批次分组管理', href: '/evaluation/batches' },
      { id: 'ability-batch-flow-workflows', label: '审批流程配置', href: '/evaluation/workflows' },
      { id: 'ability-batch-flow-approvals', label: '审批中心', href: '/evaluation/approvals' }
      ] },
    { id: 'ability-result-center', label: '结果与认证',
      children: [
      { id: 'ability-result-center-scene-results', label: '场景任务评价', href: '/evaluation/scene-results' },
      { id: 'ability-result-center-lesson-results', label: '课程节点评价', href: '/evaluation/lesson-results' },
      { id: 'ability-result-center-daily-exam-results', label: '日常考试评价', href: '/evaluation/lesson-results/daily-exams' },
      { id: 'ability-result-center-job-ability', label: '岗位能力认定规则', href: '/evaluation/job-ability' },
      { id: 'ability-result-center-job-ability-results', label: '岗位能力认定结果', href: '/evaluation/job-ability/results' }
      ] },
    { id: 'ability-landing', label: '前台落地页', href: '/evaluation/landing' }
    ] },
  { id: 'resource', label: '教学资源共享服务平台',
    children: [
    { id: 'resource-resource-center', label: '公共资源库',
      children: [
      { id: 'resource-resource-center-knowledge', label: '知识点库', href: '/library/knowledge' },
      { id: 'resource-resource-center-ability', label: '能力点库', href: '/library/ability' },
      { id: 'resource-resource-center-certificates', label: '证书库', href: '/library/certificates' },
      { id: 'resource-resource-center-resources-document', label: '文档资源库', href: '/library/resources/document' },
      { id: 'resource-resource-center-resources-spreadsheet', label: '表格资源库', href: '/library/resources/spreadsheet' },
      { id: 'resource-resource-center-resources-image', label: '图片资源库', href: '/library/resources/image' },
      { id: 'resource-resource-center-resources-link', label: '链接资源库', href: '/library/resources/link' },
      { id: 'resource-resource-center-resources-audio', label: '音频资源库', href: '/library/resources/audio' },
      { id: 'resource-resource-center-resources-video', label: '视频资源库', href: '/library/resources/video' },
      { id: 'resource-resource-center-resources-archive', label: '压缩包资源库', href: '/library/resources/archive' },
      { id: 'resource-resource-center-resources-venue', label: '场地资源库', href: '/library/resources/venue' },
      { id: 'resource-resource-center-resources-facility', label: '设施设备资源库', href: '/library/resources/facility' },
      { id: 'resource-resource-center-resources-software', label: '软件资源库', href: '/library/resources/software' },
      { id: 'resource-resource-center-resources-other', label: '其他资源库', href: '/library/resources/other' },
      { id: 'resource-resource-center-questions', label: '现场问答题库', href: '/library/questions' }
      ] },
    { id: 'resource-my-resource-center', label: '我的资源库',
      children: [
      { id: 'resource-my-resource-center-my-resources', label: '我的资源', href: '/library/my-resources' }
      ] },
    { id: 'resource-tag-center', label: '标签管理',
      children: [
      { id: 'resource-tag-center-tags', label: '标签管理', href: '/library/tags' }
      ] },
    { id: 'resource-landing', label: '前台落地页', href: '/library/landing' }
    ] },
  { id: 'affairs', label: '教务管理服务平台',
    children: [
    { id: 'affairs-affairs-mgmt', label: '教务管理',
      children: [
      { id: 'affairs-affairs-mgmt-org-structure', label: '组织架构管理', href: '/affairs/org-structure' },
      { id: 'affairs-affairs-mgmt-majors', label: '专业管理', href: '/affairs/majors' },
      { id: 'affairs-affairs-mgmt-students', label: '学生管理', href: '/affairs/students' },
      { id: 'affairs-affairs-mgmt-teachers', label: '教职工管理', href: '/affairs/teachers' },
      { id: 'affairs-affairs-mgmt-relations', label: '人员关系管理', href: '/affairs/relations' },
      { id: 'affairs-affairs-mgmt-positions', label: '职位管理', href: '/affairs/positions' },
      { id: 'affairs-affairs-mgmt-config', label: '教务配置', href: '/affairs/config' }
      ] },
    { id: 'affairs-teaching-mgmt', label: '教学管理',
      children: [
      { id: 'affairs-teaching-mgmt-programs', label: '人才培养方案', href: '/affairs/programs' },
      { id: 'affairs-teaching-mgmt-teaching-plans', label: '教学计划', href: '/affairs/teaching-plans' },
      { id: 'affairs-teaching-mgmt-scheduling', label: '排课管理', href: '/affairs/scheduling' },
      { id: 'affairs-teaching-mgmt-student-portraits', label: '学生画像', href: '/affairs/student-portraits' }
      ] },
    { id: 'affairs-teaching-approval', label: '审批管理',
      children: [
      { id: 'affairs-teaching-approval-batches', label: '批次管理', href: '/affairs/batches' },
      { id: 'affairs-teaching-approval-workflows', label: '工作流管理', href: '/affairs/workflows' },
      { id: 'affairs-teaching-approval-approvals', label: '审批中心', href: '/affairs/approvals' }
      ] }
    ] },
  { id: 'alliance', label: '产教融合与就业服务平台',
    children: [
    { id: 'alliance-cooperation', label: '产教融合管理',
      children: [
      { id: 'alliance-cooperation-school', label: '学校信息', href: '/portal/apps/alliance/school' },
      { id: 'alliance-cooperation-enterprises', label: '合作企业', href: '/portal/apps/alliance/enterprises' },
      { id: 'alliance-cooperation-projects', label: '合作项目', href: '/portal/apps/alliance/projects' },
      { id: 'alliance-cooperation-agreements', label: '合作协议', href: '/portal/apps/alliance/agreements' },
      { id: 'alliance-cooperation-achievements', label: '合作成果', href: '/portal/apps/alliance/achievements' },
      { id: 'alliance-cooperation-experts', label: '专家资源库', href: '/portal/apps/alliance/experts' },
      { id: 'alliance-cooperation-permissions', label: '专家合作权限', href: '/portal/apps/alliance/permissions' },
      { id: 'alliance-cooperation-dictionaries', label: '字典管理', href: '/portal/apps/alliance/dictionaries' }
      ] },
    { id: 'alliance-brand', label: '品牌运营管理',
      children: [
      { id: 'alliance-brand-brand-overview', label: '品牌概览', href: '/portal/apps/alliance/brands' },
      { id: 'alliance-brand-brand-talent', label: '人才品牌管理', href: '/portal/apps/alliance/brands/talent' },
      { id: 'alliance-brand-brand-employer', label: '雇主品牌管理', href: '/portal/apps/alliance/brands/employer' },
      { id: 'alliance-brand-brand-job', label: '岗位品牌管理', href: '/portal/apps/alliance/brands/job' },
      { id: 'alliance-brand-brand-major', label: '专业品牌管理', href: '/portal/apps/alliance/brands/major' },
      { id: 'alliance-brand-brand-teacher', label: '师资品牌管理', href: '/portal/apps/alliance/brands/teacher' },
      { id: 'alliance-brand-brand-culture', label: '文化思政品牌管理', href: '/portal/apps/alliance/brands/culture' }
      ] },
    { id: 'alliance-employment', label: '就业服务管理',
      children: [
      { id: 'alliance-employment-employmentproject', label: '就业项目', href: '/portal/apps/alliance/employmentproject' },
      { id: 'alliance-employment-employmentjob', label: '岗位与投递', href: '/portal/apps/alliance/employmentjob' }
      ] },
    { id: 'alliance-landing', label: '前台落地页', href: '/portal/alliance/landing' }
    ] }
];

/** 菜单树根节点 id → 套餐模块 id（对齐 React MENU_TREE_PLATFORM_MAP） */
export const MENU_TREE_PLATFORM_MAP: Record<string, string> = {
  'system-entry': 'system',
  career: 'career',
  course: 'course',
  scene: 'scene',
  ability: 'ability',
  resource: 'resource',
  affairs: 'affairs',
  alliance: 'alliance'
};

/** 操作权限模块 → 套餐模块 id（对齐 React ACTION_MODULE_PLATFORM_MAP） */
export const ACTION_MODULE_PLATFORM_MAP: Record<string, string> = {
  scene: 'scene',
  job: 'career',
  lesson: 'course',
  evaluation: 'ability',
  alliance: 'alliance'
};

/** 按租户套餐过滤菜单树（未订阅平台整组隐藏；未映射根节点始终保留） */
export function filterMenuTreeBySubscription(
  tree: MenuTreeItem[],
  modules: Record<string, boolean> | null | undefined
): MenuTreeItem[] {
  if (!modules) return tree;
  return tree.filter((node) => {
    const platformId = MENU_TREE_PLATFORM_MAP[node.id];
    if (!platformId) return true;
    return modules[platformId] === true;
  });
}

export function normalizeMenuPath(path: string): string {
  if (!path) return path;
  const clean = path.split(/[?#]/)[0];
  if (clean.length > 1 && clean.endsWith('/')) return clean.slice(0, -1);
  return clean;
}

export interface PermissionAction {
  action: string;
  label: string;
}

export interface PermissionPage {
  page: string;
  label: string;
  actions: PermissionAction[];
}

export interface PermissionModule {
  module: string;
  label: string;
  pages: PermissionPage[];
}

// 内容型模块共用的审批/发布/删除/审核操作清单（对齐 React COMMON_APPROVAL_ACTIONS）
const COMMON_APPROVAL_ACTIONS: PermissionAction[] = [
  { action: 'submit_approval', label: '提交审批' },
  { action: 'withdraw_approval', label: '撤回审批' },
  { action: 'publish', label: '发布' },
  { action: 'unpublish', label: '取消发布' },
  { action: 'delete', label: '删除' },
  { action: 'review', label: '审核' },
  { action: 'reject', label: '驳回' }
];

export const permissionModuleConfig: PermissionModule[] = [
  {
    module: 'scene',
    label: '场景学习平台',
    pages: [{ page: 'scenarios', label: '场景管理', actions: COMMON_APPROVAL_ACTIONS }]
  },
  {
    module: 'job',
    label: '产业岗位学习平台',
    pages: [{ page: 'positions', label: '岗位管理', actions: COMMON_APPROVAL_ACTIONS }]
  },
  {
    module: 'lesson',
    label: '数字课程服务平台',
    pages: [{ page: 'courses', label: '课程管理', actions: COMMON_APPROVAL_ACTIONS }]
  },
  {
    module: 'evaluation',
    label: '能力评价与测评管理平台',
    pages: [{ page: 'exams', label: '试卷管理', actions: COMMON_APPROVAL_ACTIONS }]
  }
];
