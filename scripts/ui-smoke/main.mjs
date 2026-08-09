/**
 * 主流程：登录 → 分片并行巡检 → 聚合 → 基线 diff → 报告。
 * P0-4：任何 worker 异常都兜底，报告保证写出。
 */
import { chromium } from 'playwright'
import { execFileSync } from 'child_process'
import path from 'path'
import { resolveConfig, STATE_DIR, PROJECT_ROOT } from './config.mjs'
import { discoverStaticRoutes, resolveDynamicRoutes, scopeRoutesByGitDiff, BUILTIN_DYNAMIC_ROUTES } from './routes.mjs'
import { walkRoute } from './clicker.mjs'
import { cleanupSmokeData } from './forms.mjs'
import { aggregateErrors, buildResumeDoneSet, classifyApiResponse, diffWithBaseline, printSummary, writeReport } from './report.mjs'
import { promises as fs } from 'fs'

const sleep = ms => new Promise(r => setTimeout(r, ms))

// ── 登录 ──────────────────────────────────────────────────
async function login(ctx, page, cfg, role, listeners) {
  const cred = cfg.accounts?.[role]
  if (!cred) throw new Error(`未知角色: ${role}，可通过 --account ${role}:user:pass 指定`)

  // 监听登录响应，区分失败原因（先建监听，再操作页面）
  const loginStatusPromise = new Promise(resolve => {
    const timer = setTimeout(() => resolve('timeout'), cfg.loginTimeoutMs + 5000)
    const onResponse = res => {
      if (res.url().includes('/auth/portal/login') && res.request().method() === 'POST') {
        clearTimeout(timer)
        resolve(res.status())
      }
    }
    page.on('response', onResponse)
    listeners.push({ handler: onResponse, kind: 'response' })
  })

  try {
    await page.goto(`${cfg.baseUrl}/portal/login`, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await page.fill('#username', cred.username)
    await page.fill('#password', cred.password)
    await page.click('button[type="submit"]')
  } catch (e) {
    throw new Error(`登录页操作失败: ${e.message}`)
  }

  const status = await loginStatusPromise
  if (status === 401) throw new Error(`登录失败: 用户名或密码错误（401），或账号已被禁用`)
  if (status === 429) throw new Error(`登录失败: 登录限流（429），请稍后重试`)
  if (status === 'timeout') throw new Error(`登录超时: 登录请求未完成`)

  await sleep(800)
  // 多租户账号需在弹出的租户选择框中选第一个
  const dialog = page.locator('[role="dialog"]:visible')
  if (await dialog.count()) {
    await dialog.locator('button').first().click()
  }
  await page.waitForFunction(
    () => !location.pathname.includes('/portal/login'),
    null, { timeout: cfg.loginTimeoutMs },
  ).catch(() => { throw new Error('登录超时: 登录后未跳转，请检查账号权限/租户') })

  await ctx.storageState({ path: path.join(STATE_DIR, `state-${role}.json`) })
  return true
}

// ── 错误收集（带点击序号与 URL 上下文） ────────────────────
function attachListeners(page, sink, cfg, routeState) {
  const push = err => {
    err.clickIndex = routeState.clickIndex
    err.url = routeState.url
    if (cfg.verbose || !cfg.noisePatterns.some(p => new RegExp(p).test(err.message || ''))) {
      sink.push(err)
    }
  }
  page.on('pageerror', err => push({
    type: 'pageerror', message: err.message || String(err),
    stack: (err.stack || '').split('\n').slice(0, 6).join('\n'),
  }))
  page.on('console', msg => {
    const t = msg.type()
    if (t === 'error') push({ type: 'console', message: msg.text().slice(0, 500) })
    else if (t === 'warning' && cfg.verbose) push({ type: 'console-warning', message: msg.text().slice(0, 500) })
  })
  page.on('response', res => {
    const status = res.status()
    const url = res.url()
    if (status < 400 || !url.includes('/api/')) return
    let isDynamic = false
    try { isDynamic = routeState.dynamicUrls?.has(new URL(page.url()).pathname) || false } catch { /* ignore */ }
    const kind = classifyApiResponse(status, { isDynamicRoute: isDynamic, dynamicIgnore404: cfg.dynamicIgnore404 })
    if (kind === 'ignore') return
    push({ type: kind, message: `${status} ${res.request().method()} ${url.replace(cfg.baseUrl, '')}` })
  })
  page.on('requestfailed', req => {
    const err = req.failure()?.errorText || 'failed'
    if (err !== 'net::ERR_ABORTED') {
      push({ type: 'network', message: `${err} ${req.method()} ${req.url().replace(cfg.baseUrl, '')}` })
    }
  })
  page.on('dialog', d => d.dismiss().catch(() => {}))
}

// ── 单路由超时包装：超时返回带 timedOut 标记的结果，由调用方换新页面 ──
async function runRouteWithTimeout(page, ctx, route, cfg, role, sink, routeState) {
  const timeoutMs = (cfg.routeTimeoutSec || 120) * 1000
  let timer
  const timeout = new Promise(resolve => {
    timer = setTimeout(() => resolve({
      route, status: 'error', clicks: 0, actions: [], info: [], timedOut: true,
      errors: [{ type: 'timeout', message: `单路由巡检超时（>${cfg.routeTimeoutSec || 120}s）` }],
    }), timeoutMs)
  })
  const r = await Promise.race([walkRoute(page, ctx, route, cfg, role, sink, routeState), timeout])
  clearTimeout(timer)
  return r
}

// ── 清理规格：内置动态路由实体的 list/delete 映射 + 配置追加 ──
function buildCleanupSpecs(cfg) {
  const byBase = new Map()
  for (const spec of Object.values(BUILTIN_DYNAMIC_ROUTES)) {
    const base = spec.api.split('?')[0]
    if (!byBase.has(base)) byBase.set(base, { list: `${base}?limit=100`, del: `${base}/{id}`, fields: ['name', 'title'] })
  }
  for (const extra of cfg.cleanupApis || []) byBase.set(extra.list.split('?')[0], extra)
  return [...byBase.values()]
}

// 从 storageState 文件读取角色 token
async function readStateToken(role) {
  try {
    const st = JSON.parse(await fs.readFile(path.join(STATE_DIR, `state-${role}.json`), 'utf8'))
    for (const o of st.origins || []) {
      const item = (o.localStorage || []).find(l => l.name === 'zhiyu-portal-token')
      if (item) return item.value
    }
  } catch { /* ignore */ }
  return ''
}

// ── 后端容器日志增量抓取（可选） ───────────────────────────
function tailBackendLogs(startTime) {
  try {
    const out = execFileSync('docker', ['compose', '-f', 'deploy/docker-compose.yml', 'logs', '--since', startTime, 'zhiyu-backend'],
      { cwd: PROJECT_ROOT, encoding: 'utf8', timeout: 30000 })
    return out.split('\n').filter(l => /error|panic|fatal/i.test(l)).slice(0, 50)
  } catch (e) {
    return [`[docker compose logs 不可用] ${e.message}`]
  }
}

// ── 主流程 ────────────────────────────────────────────────
export async function main() {
  const cfg = await resolveConfig(process.argv.slice(2))
  await fs.mkdir(STATE_DIR, { recursive: true })
  const startedAt = Date.now()
  

  // 路由清单
  let staticRoutes = await discoverStaticRoutes()
  if (cfg.gitDiff) {
    staticRoutes = await scopeRoutesByGitDiff(staticRoutes, cfg, cfg.gitDiff)
  }
  let routes = staticRoutes.filter(r => !(cfg.excludeRoutes || []).some(x => r.includes(x)))
  if (cfg.route) routes = [cfg.route]

  // 断点续跑：跳过上次报告中已 ok/skip 的路由（按 角色:路由 记录，避免跨角色误跳过）
  let resumeDone = null
  if (cfg.resume) {
    try {
      const prev = JSON.parse(await fs.readFile(cfg.resume, 'utf8'))
      resumeDone = buildResumeDoneSet(prev)
      console.log(`[resume] 上次已完成 ${resumeDone.size} 个 角色:路由，本次将跳过`)
    } catch {
      console.warn('[resume] 无法读取续跑报告，全量巡检')
    }
  }

  console.log(`目标站点: ${cfg.baseUrl}`)
  console.log(`发现页面: ${routes.length} 个，角色: ${cfg.roles.join('/')}，每页点击全部唯一可点元素（上限 ${cfg.maxClicks}）`)
  if (cfg.testForms) {
    if (cfg.workers > 1) {
      console.log('[test-forms] 表单提交会产生真实数据，并发降为 1 路串行执行')
      cfg.workers = 1
    }
    console.log(`[test-forms] 表单填充+提交测试已启用（每页上限 ${cfg.maxFormSubmits} 次，数据前缀 SMOKE_，结束后${cfg.cleanup !== false ? '自动' : '不'}清理）`)
  }

  const backendStart = new Date().toISOString()
  const browser = await chromium.launch({
    headless: !cfg.headed,
    channel: process.env.UI_SMOKE_CHANNEL || 'chrome',
    args: process.getuid?.() === 0 ? ['--no-sandbox', '--disable-dev-shm-usage'] : [],
  })

  const results = {}
  const allCrashes = { count: 0, routes: [] }

  // 全局看门狗：超时强制结束
  let watchdogTimer = null
  if (cfg.timeoutMin) {
    watchdogTimer = setTimeout(() => {
      console.error(`\n[watchdog] 超过 ${cfg.timeoutMin} 分钟，强制结束（已巡检结果保留）`)
      browser.close().catch(() => {})
    }, cfg.timeoutMin * 60000)
  }

  try {
    for (const role of cfg.roles) {
      console.log(`\n=== [${role}] 开始巡检 ===`)
      let ctx
      try {
        ctx = await browser.newContext()
      } catch (e) {
        if (/browser has been closed|context or browser has been closed/i.test(e.message)) {
          console.error(`  [${role}] 浏览器已被关闭，停止后续角色巡检`)
          break
        }
        throw e
      }
      const page = await ctx.newPage()
      const sink = []
      const loginListeners = []
      const routeState = { clickIndex: -1, url: '' }
      attachListeners(page, sink, cfg, routeState)

      try {
        await login(ctx, page, cfg, role, loginListeners)
        console.log(`  [${role}] 登录成功`)
      } catch (e) {
        console.error(`  [${role}] ${e.message}，跳过该角色`)
        results[role] = { login: 'failed', error: e.message, routes: [] }
        await ctx.close().catch(() => {})
        continue
      } finally {
        for (const l of loginListeners) page.off(l.kind, l.handler)
      }

      // 动态路由（拉真实实体 id）；--route 单页调试模式跳过
      let dynamicRoutes = []
      if (!cfg.route) {
        try {
          const token = await page.evaluate(() => {
            try { return localStorage.getItem('zhiyu-portal-token') || '' } catch { return '' }
          })
          dynamicRoutes = await resolveDynamicRoutes(cfg, cfg.baseUrl, token)
          if (dynamicRoutes.length) console.log(`  [${role}] 动态路由 ${dynamicRoutes.length} 个（拉取真实实体 id）`)
        } catch {
          dynamicRoutes = []
        }
      }
      const dynamicUrls = new Set(dynamicRoutes.map(d => d.url))
      const roleRoutes = resumeDone ? routes.filter(r => !resumeDone.has(`${role}:${r}`)) : routes
      const allRoutes = [...roleRoutes, ...dynamicUrls]
      const chunkSize = Math.ceil(allRoutes.length / cfg.workers)
      const chunks = Array.from({ length: cfg.workers }, (_, i) => allRoutes.slice(i * chunkSize, (i + 1) * chunkSize)).filter(c => c.length)

      let done = 0
      const perRole = []

      await Promise.all(chunks.map(async (chunk, wi) => {
        const wctx = await browser.newContext({ storageState: path.join(STATE_DIR, `state-${role}.json`) })
        let wpage = await wctx.newPage()
        let wsink = []
        const wstate = { clickIndex: -1, url: '', dynamicUrls }
        attachListeners(wpage, wsink, cfg, wstate)
        let authStreak = 0 // 连续 401 计数：疑似 token 过期时重新登录
        try {
          for (const route of chunk) {
            let r = await runRouteWithTimeout(wpage, wctx, route, cfg, role, wsink, wstate)
            if (r.timedOut) {
              // 单路由超时：换新页面继续，不重试
              await wpage.close().catch(() => {})
              wpage = await wctx.newPage()
              wsink = []
              attachListeners(wpage, wsink, cfg, wstate)
            }
            for (let attempt = 0; r.crashed && attempt < cfg.retryCrashes; attempt++) {
              await wpage.close().catch(() => {})
              wpage = await wctx.newPage()
              const oldSink = wsink
              wsink = []
              attachListeners(wpage, wsink, cfg, wstate)
              r = await walkRoute(wpage, wctx, route, cfg, role, wsink, wstate)
              // 崩溃重试保留第一次的错误（P1-7）
              if (!r.errors.length && oldSink.length) {
                r.errors.push(...oldSink)
                r.status = 'error'
              }
              allCrashes.count++
              allCrashes.routes.push(route)
            }
            perRole.push(r)
            done++
            const mark = r.status === 'ok' ? 'ok  ' : r.status === 'skip' ? 'skip' : 'ERR '
            console.log(`  [${role}] ${done}/${allRoutes.length} ${mark} ${route}${r.errors.length ? `（${r.errors.length} 个错误）` : ''}`)
            // 连续多页 401 → token 可能过期，重新登录一次
            authStreak = r.info?.some(e => e.type === 'auth' && /^401/.test(e.message)) ? authStreak + 1 : 0
            if (authStreak >= 3) {
              authStreak = 0
              try {
                await login(wctx, wpage, cfg, role, [])
                console.log(`  [${role}] 检测到连续 401，已重新登录`)
              } catch (e) {
                console.error(`  [${role}] 重新登录失败: ${e.message}`)
              }
            }
          }
        } catch (e) {
          console.error(`  [${role}] worker#${wi} 异常（已保留其他结果）: ${e.message}`)
        } finally {
          await wctx.close().catch(() => {})
        }
      }))

      results[role] = { login: 'ok', routes: perRole.sort((a, b) => a.route.localeCompare(b.route)) }
      await ctx.close().catch(() => {})
    }
  } finally {
    if (watchdogTimer) clearTimeout(watchdogTimer)
    await browser.close().catch(() => {})
  }

  // 表单测试数据清理（SMOKE_ 前缀），跨角色按 id 去重
  let cleanupTotal = null
  if (cfg.testForms && cfg.cleanup !== false) {
    console.log('\n=== 清理 SMOKE_ 测试数据 ===')
    const specs = buildCleanupSpecs(cfg)
    const seenIds = new Set()
    cleanupTotal = { deleted: 0, failed: 0 }
    for (const role of cfg.roles) {
      if (results[role]?.login !== 'ok') continue
      const token = await readStateToken(role)
      const r = await cleanupSmokeData(cfg, token, specs, seenIds)
      cleanupTotal.deleted += r.deleted
      cleanupTotal.failed += r.failed
    }
    console.log(`  清理完成：删除 ${cleanupTotal.deleted} 条${cleanupTotal.failed ? `，失败 ${cleanupTotal.failed} 条（仅警告）` : ''}`)
  }

  let backendLogLines = null
  if (cfg.tailBackend) {
    console.log('\n=== 后端容器日志（增量抓取） ===')
    backendLogLines = tailBackendLogs(backendStart)
    console.log(backendLogLines.length ? backendLogLines.join('\n') : '  无 error/panic/fatal 行')
  }

  // 汇总
  const totalErrors = Object.values(results).reduce((acc, r) => {
    return acc + (r?.routes?.filter(x => x.errors.length).length || 0)
  }, 0)
  const aggregate = aggregateErrors(results)
  const diff = cfg.baseline ? await diffWithBaseline(cfg.baseline, results) : null
  printSummary(results, aggregate, diff, totalErrors, cfg)

  const report = {
    generatedAt: new Date().toISOString(),
    durationSeconds: Math.round((Date.now() - startedAt) / 1000),
    baseUrl: cfg.baseUrl,
    args: { roles: cfg.roles, maxClicks: cfg.maxClicks, workers: cfg.workers, gitDiff: cfg.gitDiff || null, testForms: !!cfg.testForms },
    crashedPages: allCrashes.routes,
    aggregate,
    diff: diff ? {
      newErrors: diff.newErrors,
      fixedErrors: diff.fixedErrors,
      persistentErrors: diff.persistentErrors,
    } : null,
    cleanup: cleanupTotal,
    backendLogLines,
    results,
  }
  await writeReport(cfg.report, report)
  console.log(`\n共 ${totalErrors} 个页面发现问题，报告已保存: ${cfg.report}（耗时 ${Math.round((Date.now() - startedAt) / 1000)}s）`)

  if (cfg.failOnError && totalErrors > 0) process.exit(1)
}
