/**
 * 路由发现：静态枚举 + 动态 [id] 路由（从后端拉真实实体 id）+ git-diff 定向圈定。
 * 单栈（Java+Vue）后：路由表从 plus-ui/src-portal/router/index.ts 提取
 * （Vue Router 绝对/相对 path 统一拼接；:id 动态段转 [id] 匹配 BUILTIN_DYNAMIC_ROUTES）。
 */
import { promises as fs } from 'fs'
import { execFileSync } from 'child_process'
import path from 'path'
import { PROJECT_ROOT } from './config.mjs'

const ROUTER_FILE = path.join(PROJECT_ROOT, 'plus-ui', 'src-portal', 'router', 'index.ts')

// 从 portal router 提取全部 path（相对路径拼接 '/' 前缀；空串/纯 redirect 跳过）
async function extractRouterPaths() {
  let src
  try { src = await fs.readFile(ROUTER_FILE, 'utf8') } catch { return [] }
  const paths = new Set()
  for (const m of src.matchAll(/path:\s*'([^']*)'/g)) {
    let p = m[1]
    if (!p) continue
    if (!p.startsWith('/')) p = `/${p}`
    paths.add(p)
  }
  return [...paths]
}

// 静态路由枚举：无动态段（:xxx）的路径
export async function discoverStaticRoutes() {
  const all = await extractRouterPaths()
  return all.filter(p => !p.includes(':')).sort()
}

// 枚举动态路由模式（:xxx 段转 [xxx] 形式，匹配 BUILTIN_DYNAMIC_ROUTES key）
export async function discoverDynamicPatterns() {
  const all = await extractRouterPaths()
  return all
    .filter(p => p.includes(':'))
    .map(p => p.replace(/:[A-Za-z0-9_]+/g, '[id]'))
    .sort()
}

// 动态路由 → 实体 id 获取方式：内置常见映射，配置文件中可覆盖/追加。
// api: GET 后返回 {items:[{id}]} 或 {id} 结构；url: 用 {id} 占位生成真实路由。
const BUILTIN_DYNAMIC_ROUTES = {
  '/affairs/programs/[id]': { api: '/api/v1/affairs/programs?limit=10', url: '/affairs/programs/{id}' },
  '/affairs/teaching-plans/[id]': { api: '/api/v1/affairs/teaching-plans?limit=10', url: '/affairs/teaching-plans/{id}' },
  '/evaluation/exams/[id]': { api: '/api/v1/evaluation/exams?limit=10', url: '/evaluation/exams/{id}' },
  '/evaluation/job-ability/config/[id]': { api: '/api/v1/evaluation/job-ability/config?limit=10', url: '/evaluation/job-ability/config/{id}' },
  '/evaluation/landing/banks/[id]': { api: '/api/v1/evaluation/question-banks?limit=10', url: '/evaluation/landing/banks/{id}' },
  '/evaluation/landing/exams/[id]': { api: '/api/v1/evaluation/exams?limit=10', url: '/evaluation/landing/exams/{id}' },
  '/evaluation/lesson-results/[id]': { api: '/api/v1/evaluation/lesson-results?limit=10', url: '/evaluation/lesson-results/{id}' },
  '/evaluation/lesson-results/daily-exams/[resultId]': { api: '/api/v1/evaluation/lesson-results?limit=10', url: '/evaluation/lesson-results/daily-exams/{id}' },
  '/evaluation/question-banks/[id]': { api: '/api/v1/evaluation/question-banks?limit=10', url: '/evaluation/question-banks/{id}' },
  '/evaluation/scene-results/[id]': { api: '/api/v1/evaluation/scene-results?limit=10', url: '/evaluation/scene-results/{id}' },
  '/job/landing/[id]': { api: '/api/v1/job/public/positions?limit=10', url: '/job/landing/{id}' },
  '/job/landing/[id]/learn': { api: '/api/v1/job/public/positions?limit=10', url: '/job/landing/{id}/learn' },
  // 岗位编辑页（含 AI 辅助编写）：从岗位列表拉真实 id
  '/job/positions/[id]/edit': { api: '/api/v1/job/positions?limit=10', url: '/job/positions/{id}/edit' },
  '/lesson/landing/[id]': { api: '/api/v1/lesson/courses?limit=10', url: '/lesson/landing/{id}' },
  '/lesson/landing/[id]/learn': { api: '/api/v1/lesson/courses?limit=10', url: '/lesson/landing/{id}/learn' },
  // 注意：/library/resources/[type] 的 [type] 是资源类型枚举（course/scene 等），非实体 id，不配置动态路由
  // 注意：/portal/alliance 详情页带 tenantId（本校数据），拉 id 必须同步带 tenantId，
  // 否则全局列表拉到非本校实体，详情页 404 造成误报（{tenantId} 由 resolveDynamicRoutes 从 token 注入）
  '/portal/alliance/achievements/[id]': { api: '/api/v1/alliance/public/achievements?limit=10&tenantId={tenantId}', url: '/portal/alliance/achievements/{id}' },
  '/portal/alliance/brands/[id]': { api: '/api/v1/alliance/public/brands?limit=10&tenantId={tenantId}', url: '/portal/alliance/brands/{id}' },
  '/portal/alliance/enterprises/[id]': { api: '/api/v1/alliance/public/enterprises?limit=10&tenantId={tenantId}', url: '/portal/alliance/enterprises/{id}' },
  '/portal/alliance/experts/[id]': { api: '/api/v1/alliance/public/experts?limit=10&tenantId={tenantId}', url: '/portal/alliance/experts/{id}' },
  '/portal/alliance/projects/[id]': { api: '/api/v1/alliance/public/projects?limit=10&tenantId={tenantId}', url: '/portal/alliance/projects/{id}' },
  '/portal/apps/alliance/achievements/[id]': { api: '/api/v1/alliance/achievements?limit=10', url: '/portal/apps/alliance/achievements/{id}' },
  '/portal/apps/alliance/achievements/[id]/edit': { api: '/api/v1/alliance/achievements?limit=10', url: '/portal/apps/alliance/achievements/{id}/edit' },
  '/portal/apps/alliance/agreements/[id]': { api: '/api/v1/alliance/agreements?limit=10', url: '/portal/apps/alliance/agreements/{id}' },
  '/portal/apps/alliance/agreements/[id]/edit': { api: '/api/v1/alliance/agreements?limit=10', url: '/portal/apps/alliance/agreements/{id}/edit' },
  '/portal/apps/alliance/brands/[id]': { api: '/api/v1/alliance/brands?limit=10', url: '/portal/apps/alliance/brands/{id}' },
  '/portal/apps/alliance/enterprises/[id]': { api: '/api/v1/alliance/enterprises?limit=10', url: '/portal/apps/alliance/enterprises/{id}' },
  '/portal/apps/alliance/experts/[id]': { api: '/api/v1/alliance/experts?limit=10', url: '/portal/apps/alliance/experts/{id}' },
  '/portal/apps/alliance/projects/[id]': { api: '/api/v1/alliance/projects?limit=10', url: '/portal/apps/alliance/projects/{id}' },
  '/portal/apps/alliance/projects/[id]/edit': { api: '/api/v1/alliance/projects?limit=10', url: '/portal/apps/alliance/projects/{id}/edit' },
  '/scene/landing/[id]': { api: '/api/v1/scene/scenarios?limit=10', url: '/scene/landing/{id}' },
  '/scene/landing/[id]/learn': { api: '/api/v1/scene/scenarios?limit=10', url: '/scene/landing/{id}/learn' },
  '/scene/scenarios/[id]': { api: '/api/v1/scene/scenarios?limit=10', url: '/scene/scenarios/{id}' },
  '/scene/scenarios/[id]/edit': { api: '/api/v1/scene/scenarios?limit=10', url: '/scene/scenarios/{id}/edit' },
  '/scene/scenarios/[id]/edit/tasks': { api: '/api/v1/scene/scenarios?limit=10', url: '/scene/scenarios/{id}/edit/tasks' },

  // ===== partner（企业端独立门户）动态路由 =====
  // 企业专家详情/编辑
  '/partner/experts/[id]': { api: '/api/v1/partner/experts?limit=10', url: '/partner/experts/{id}' },
  '/partner/experts/[id]/edit': { api: '/api/v1/partner/experts?limit=10', url: '/partner/experts/{id}/edit' },
  // 企业端资源共建：岗位/场景详情编辑与任务配置
  '/partner/co-build/positions/[id]/edit': { api: '/api/v1/partner/co-build/positions?limit=10', url: '/partner/co-build/positions/{id}/edit' },
  '/partner/co-build/scenes/[id]/edit': { api: '/api/v1/partner/co-build/scenes?limit=10', url: '/partner/co-build/scenes/{id}/edit' },
  '/partner/co-build/scenes/[id]/edit/tasks': { api: '/api/v1/partner/co-build/scenes?limit=10', url: '/partner/co-build/scenes/{id}/edit/tasks' },

  // ===== 就业供需（L-4）动态路由 =====
  '/portal/apps/alliance/employmentproject/[id]': { api: '/api/v1/alliance/employment-projects?limit=10', url: '/portal/apps/alliance/employmentproject/{id}' },
  '/portal/alliance/employment/[id]': { api: '/api/v1/alliance/public/employment-projects?limit=10&tenantId={tenantId}', url: '/portal/alliance/employment/{id}' },
  '/portal/alliance/employment/job/[id]': { api: '/api/v1/alliance/public/employment-jobs?limit=10', url: '/portal/alliance/employment/job/{id}' },
  '/partner/employment-jobs/[id]': { api: '/api/v1/partner/employment-jobs?limit=10', url: '/partner/employment-jobs/{id}' },
  '/partner/employment-jobs/[id]/edit': { api: '/api/v1/partner/employment-jobs?limit=10', url: '/partner/employment-jobs/{id}/edit' },
  '/partner/employment-projects/[id]': { api: '/api/v1/partner/employment-projects?limit=10', url: '/partner/employment-projects/{id}' },
}

// 从 JWT payload 解出 tenantId（alliance public 等按租户过滤的列表拉 id 用）。
function tokenTenantId(token) {
  if (!token) return ''
  try {
    const payload = token.split('.')[1]
    const claims = JSON.parse(Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString())
    return claims?.tenantId || ''
  } catch {
    return ''
  }
}

// 从后端 API 拉真实实体 id，生成动态路由实例
export async function resolveDynamicRoutes(cfg, baseUrl, token) {
  const patterns = await discoverDynamicPatterns()
  const resolved = []
  const seen = new Set()
  const tenantId = tokenTenantId(token)
  for (const pattern of patterns) {
    const spec = cfg.dynamicRoutes?.[pattern] || BUILTIN_DYNAMIC_ROUTES[pattern]
    if (!spec) continue
    try {
      const api = spec.api.replace(/\{tenantId\}/g, tenantId)
      const res = await fetch(baseUrl + api, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        signal: AbortSignal.timeout(8000),
      })
      if (!res.ok) continue
      const data = await res.json()
      const items = Array.isArray(data) ? data : data.items || (data.id ? [data] : [])
      const ids = (items || []).slice(0, 3).map(i => i.id).filter(Boolean)
      for (const id of ids) {
        const url = spec.url.replace(/\{id\}/g, id)
        if (!seen.has(url)) {
          seen.add(url)
          resolved.push({ url, dynamic: true, pattern })
        }
      }
    } catch {
      // 拉不到 id 则跳过该动态路由（不阻塞巡检）
    }
  }
  return resolved
}

// git-diff 圈定受影响路由：Vue 为单 router 表 + 组件引用复杂，改动 plus-ui（admin/portal）
// 一律全量巡检（不做组件级反查，避免圈定不准漏检）
export async function scopeRoutesByGitDiff(routes, cfg, gitRef) {
  let files = []
  try {
    const out = execFileSync('git', ['diff', '--name-only', `${gitRef}...HEAD`], {
      cwd: PROJECT_ROOT, encoding: 'utf8', timeout: 15000,
    })
    files = out.split('\n').filter(Boolean)
  } catch {
    try {
      const out = execFileSync('git', ['diff', '--name-only'], {
        cwd: PROJECT_ROOT, encoding: 'utf8', timeout: 15000,
      })
      files = out.split('\n').filter(Boolean)
    } catch {
      console.warn('  [git-diff] 无法读取 git 改动，回退为全量巡检')
      return routes
    }
  }
  const touched = files.some(f => f.startsWith('plus-ui/'))
  if (!touched) {
    console.warn('  [git-diff] 前端无改动，跳过巡检（或回退为全量）')
  } else {
    console.warn('  [git-diff] 前端有改动，Vue 单 router 表不圈定单页，回退为全量巡检')
  }
  return routes
}

// 仅清理、不巡检的内置实体 API：表单测试可能在这些实体上创建 SMOKE_ 数据，但无对应动态路由页，
// 故不纳入 BUILTIN_DYNAMIC_ROUTES（避免巡检范围扩大），只注册到清理规格。
const BUILTIN_CLEANUP_APIS = [
  '/api/v1/library/tags',
  '/api/v1/job/abilities',
  '/api/v1/job/certificate-library',
  '/api/v1/evaluation/random-draw-questions',
  '/api/v1/affairs/workflows',
  '/api/v1/partner/experts',
  '/api/v1/majors',
]

export { BUILTIN_DYNAMIC_ROUTES, BUILTIN_CLEANUP_APIS }
