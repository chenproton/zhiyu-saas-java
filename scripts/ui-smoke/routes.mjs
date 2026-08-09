/**
 * 路由发现：静态枚举 + 动态 [id] 路由（从后端拉真实实体 id）+ git-diff 定向圈定。
 */
import { promises as fs } from 'fs'
import { execFileSync } from 'child_process'
import path from 'path'
import { APP_DIR, PROJECT_ROOT } from './config.mjs'

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
  '/lesson/landing/[id]': { api: '/api/v1/lesson/courses?limit=10', url: '/lesson/landing/{id}' },
  '/lesson/landing/[id]/learn': { api: '/api/v1/lesson/courses?limit=10', url: '/lesson/landing/{id}/learn' },
  // 注意：/library/resources/[type] 的 [type] 是资源类型枚举（course/scene 等），非实体 id，不配置动态路由
  '/portal/alliance/achievements/[id]': { api: '/api/v1/alliance/public/achievements?limit=10', url: '/portal/alliance/achievements/{id}' },
  '/portal/alliance/brands/[id]': { api: '/api/v1/alliance/public/brands?limit=10', url: '/portal/alliance/brands/{id}' },
  '/portal/alliance/enterprises/[id]': { api: '/api/v1/alliance/public/enterprises?limit=10', url: '/portal/alliance/enterprises/{id}' },
  '/portal/alliance/experts/[id]': { api: '/api/v1/alliance/public/experts?limit=10', url: '/portal/alliance/experts/{id}' },
  '/portal/alliance/projects/[id]': { api: '/api/v1/alliance/public/projects?limit=10', url: '/portal/alliance/projects/{id}' },
  '/portal/apps/alliance/achievements/[id]': { api: '/api/v1/alliance/achievements?limit=10', url: '/portal/apps/alliance/achievements/{id}' },
  '/portal/apps/alliance/agreements/[id]': { api: '/api/v1/alliance/agreements?limit=10', url: '/portal/apps/alliance/agreements/{id}' },
  '/portal/apps/alliance/brands/[id]': { api: '/api/v1/alliance/brands?limit=10', url: '/portal/apps/alliance/brands/{id}' },
  '/portal/apps/alliance/enterprises/[id]': { api: '/api/v1/alliance/enterprises?limit=10', url: '/portal/apps/alliance/enterprises/{id}' },
  '/portal/apps/alliance/experts/[id]': { api: '/api/v1/alliance/experts?limit=10', url: '/portal/apps/alliance/experts/{id}' },
  '/portal/apps/alliance/projects/[id]': { api: '/api/v1/alliance/projects?limit=10', url: '/portal/apps/alliance/projects/{id}' },
  '/scene/landing/[id]': { api: '/api/v1/scene/scenarios?limit=10', url: '/scene/landing/{id}' },
  '/scene/landing/[id]/learn': { api: '/api/v1/scene/scenarios?limit=10', url: '/scene/landing/{id}/learn' },
  '/scene/scenarios/[id]': { api: '/api/v1/scene/scenarios?limit=10', url: '/scene/scenarios/{id}' },
  '/scene/scenarios/[id]/edit': { api: '/api/v1/scene/scenarios?limit=10', url: '/scene/scenarios/{id}/edit' },
  '/scene/scenarios/[id]/edit/tasks': { api: '/api/v1/scene/scenarios?limit=10', url: '/scene/scenarios/{id}/edit/tasks' },
}

// 静态路由枚举：跳过动态段 [id]（由 resolveDynamicRoutes 单独处理）；(group) 分组段不占 URL，继续向下遍历
async function walkRoutes(dir, prefix, out) {
  let entries
  try { entries = await fs.readdir(dir, { withFileTypes: true }) } catch { return }
  for (const e of entries) {
    if (e.name.startsWith('.')) continue
    const full = path.join(dir, e.name)
    if (e.isDirectory()) {
      if (e.name.startsWith('(') && e.name.endsWith(')')) {
        await walkRoutes(full, prefix, out)
        continue
      }
      if (e.name.includes('[') || e.name.includes('(')) continue
      await walkRoutes(full, `${prefix}/${e.name}`, out)
    } else if (e.name === 'page.tsx') {
      out.push(prefix)
    }
  }
}

export async function discoverStaticRoutes() {
  const routes = []
  await walkRoutes(APP_DIR, '', routes)
  return [...new Set(routes)].sort()
}

// 枚举动态路由模式（含 [xxx] 段的路径）
async function discoverDynamicPatterns() {
  const patterns = []
  async function walk(dir, prefix) {
    let entries
    try { entries = await fs.readdir(dir, { withFileTypes: true }) } catch { return }
    for (const e of entries) {
      if (e.name.startsWith('.')) continue
      const full = path.join(dir, e.name)
      if (e.isDirectory()) {
        if (e.name.startsWith('(') && e.name.endsWith(')')) {
          await walk(full, prefix)
          continue
        }
        if (e.name.includes('(')) continue
        await walk(full, `${prefix}/${e.name}`)
      } else if (e.name === 'page.tsx' && prefix.includes('[')) {
        patterns.push(prefix)
      }
    }
  }
  await walk(APP_DIR, '')
  return patterns
}

// 从后端 API 拉真实实体 id，生成动态路由实例
export async function resolveDynamicRoutes(cfg, baseUrl, token) {
  const patterns = await discoverDynamicPatterns()
  const resolved = []
  const seen = new Set()
  for (const pattern of patterns) {
    const spec = cfg.dynamicRoutes?.[pattern] || BUILTIN_DYNAMIC_ROUTES[pattern]
    if (!spec) continue
    try {
      const res = await fetch(baseUrl + spec.api, {
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

// import 解析：@/ 别名与相对路径（./ ../）→ APP_DIR 内候选文件列表（纯函数，便于测试）
export function resolveImportCandidates(importerFile, spec) {
  let base
  if (spec.startsWith('@/')) base = spec.slice(2)
  else if (spec.startsWith('.')) base = path.posix.normalize(path.posix.join(path.posix.dirname(importerFile), spec))
  else return []
  return [`${base}.tsx`, `${base}.ts`, `${base}/index.tsx`, `${base}/index.ts`, `${base}/page.tsx`]
}

function resolveImport(importerFile, spec) {
  return resolveImportCandidates(importerFile, spec).find(c => {
    try { fs.accessSync(path.join(APP_DIR, c)); return true } catch { return false }
  }) || null
}

// git-diff 圈定受影响路由：改动文件 → 页面文件/组件依赖反查
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
  // 共享包（packages/ui、api-client 等）影响全站，圈定无意义，直接全量
  if (files.some(f => f.startsWith('packages/'))) {
    console.warn('  [git-diff] 改动涉及 packages/ 共享包，影响面全站，回退为全量巡检')
    return routes
  }
  files = files.filter(l => l.includes('apps/edu') && /\.(tsx?|ts)$/.test(l))
  if (!files.length) {
    console.warn('  [git-diff] 未发现 apps/edu 下的改动文件，回退为全量巡检')
    return routes
  }

  const changed = new Set(files.map(f => f.replace('apps/edu/', '')))
  const appFiles = new Set(files.filter(f => f.startsWith('apps/edu/app/')).map(f => f.replace('apps/edu/app/', '')))
  const compFiles = [...changed].filter(f => !f.startsWith('app/'))

  // 组件 → 页面依赖映射（静态扫描 import，深度受限）
  const pageDeps = new Map() // route -> Set(依赖文件)
  const compImportCache = new Map()
  function scanImports(filePath, depth) {
    if (depth <= 0) return []
    if (compImportCache.has(filePath)) return compImportCache.get(filePath)
    const deps = []
    try {
      const src = fs.readFileSync(path.join(APP_DIR, filePath), 'utf8')
      const imports = [...src.matchAll(/from\s+['"]([^'"]+)['"]/g)].map(m => m[1])
      for (const imp of imports) {
        const hit = resolveImport(filePath, imp)
        if (hit) {
          deps.push(hit)
          deps.push(...scanImports(hit, depth - 1))
        }
      }
    } catch { /* 忽略无法读取的文件 */ }
    compImportCache.set(filePath, deps)
    return deps
  }

  const affected = new Set()
  for (const route of routes) {
    // 页面文件本身被改
    const pageFile = route === '' ? 'app/page.tsx' : `app${route}/page.tsx`
    if (appFiles.has(pageFile) || appFiles.has(pageFile.replace('app/', ''))) {
      affected.add(route)
      continue
    }
    // 页面 import 了改动组件
    const deps = scanImports(pageFile, cfg.depScanDepth)
    if (deps.some(d => compFiles.some(c => c.endsWith(d) || d.endsWith(c)))) {
      affected.add(route)
    }
  }

  if (!affected.size) {
    console.warn('  [git-diff] 改动未涉及任何静态路由（可能只改了动态路由/组件），回退为全量巡检')
    return routes
  }
  console.log(`  [git-diff] 改动文件 ${changed.size} 个，圈定受影响路由 ${affected.size} 个`)
  return routes.filter(r => affected.has(r))
}

export { BUILTIN_DYNAMIC_ROUTES }
