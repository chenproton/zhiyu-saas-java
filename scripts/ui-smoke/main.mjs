/**
 * 主流程：登录 → 分片并行巡检 → 聚合 → 基线 diff → 报告。
 * P0-4：任何 worker 异常都兜底，报告保证写出。
 */
import { chromium } from 'playwright'
import { execFileSync } from 'child_process'
import path from 'path'
import { resolveConfig, STATE_DIR, PROJECT_ROOT } from './config.mjs'
import { discoverStaticRoutes, resolveDynamicRoutes, scopeRoutesByGitDiff, BUILTIN_DYNAMIC_ROUTES } from './routes.mjs'
import { walkRoute, tokenKeyForRole } from './clicker.mjs'
import { cleanupSmokeData } from './forms.mjs'
import { aggregateErrors, buildResumeDoneSet, classifyApiResponse, diffWithBaseline, isTransientError, printSummary, writeReport } from './report.mjs'
import { promises as fs } from 'fs'

const sleep = ms => new Promise(r => setTimeout(r, ms))

// ── 登录 ──────────────────────────────────────────────────
async function login(ctx, page, cfg, role, listeners) {
  const cred = cfg.accounts?.[role]
  if (!cred) throw new Error(`未知角色: ${role}，可通过 --account ${role}:user:pass 指定`)

  // partner（企业端）为独立认证门户（/partner/login），走最小分支：直接调接口拿 token
  if (role === 'partner') return loginPartner(ctx, page, cfg, role, cred)

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

// ── partner（企业端）登录：账号不存在时自动注册巡检企业，再直接调登录接口拿 token ──
// 与 UI 登录等价：token 写入 localStorage（zhiyu-partner-token）后进入工作台验证不被踢回登录页
async function loginPartner(ctx, page, cfg, role, cred) {
  const post = (p, body) => fetch(`${cfg.baseUrl}${p}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(cfg.loginTimeoutMs),
  })
  let res = await post('/api/v1/auth/partner/login', { username: cred.username, password: cred.password })
  if (res.status === 401) {
    // 账号不存在（或密码错误）：尝试注册巡检企业；409 说明用户名已注册但密码不符
    const enterpriseName = cred.enterpriseName || '巡检测试企业'
    console.log(`  [${role}] 账号登录 401，自动注册巡检企业「${enterpriseName}」（${cred.username}）...`)
    res = await post('/api/v1/auth/partner/register', {
      enterpriseName,
      username: cred.username,
      password: cred.password,
    })
    if (res.status === 409) {
      throw new Error(`partner 账号 ${cred.username} 已存在但密码不符（注册冲突 409），请用 --account ${role}:user:pass 修正`)
    }
  }
  if (res.status === 429) throw new Error(`登录失败: 登录限流（429），请稍后重试`)
  if (!res.ok) throw new Error(`partner 登录/注册失败: HTTP ${res.status}`)
  const data = await res.json().catch(() => ({}))
  if (!data.token) throw new Error('partner 登录响应无 token（疑似多租户预授权场景，暂不支持）')

  await page.goto(`${cfg.baseUrl}/partner/login`, { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.evaluate(t => { try { localStorage.setItem('zhiyu-partner-token', t) } catch { /* ignore */ } }, data.token)
  await page.goto(`${cfg.baseUrl}/partner/workspace`, { waitUntil: 'domcontentloaded', timeout: 30000 })
  await sleep(800)
  if (page.url().includes('/partner/login')) throw new Error('partner token 写入后仍被踢回登录页，登录失败')

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
    if (t === 'error') {
      const text = msg.text().slice(0, 500)
      // 把 401/403/429 的 console 报错也归为权限/限流信号，避免 /partner 等无权限页噪音
      let subType = 'console'
      if (/\b401\b/.test(text) || /\b403\b/.test(text)) subType = 'auth'
      else if (/\b429\b/.test(text)) subType = 'rate-limit'
      push({ type: subType, message: text })
    } else if (t === 'warning' && cfg.verbose) {
      push({ type: 'console-warning', message: msg.text().slice(0, 500) })
    }
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
async function runRouteWithTimeout(page, ctx, route, cfg, role, sink, routeState, token, globalSeen) {
  const timeoutMs = (cfg.routeTimeoutSec || 120) * 1000
  let timer
  const timeout = new Promise(resolve => {
    timer = setTimeout(() => resolve({
      route, status: 'error', clicks: 0, actions: [], info: [], timedOut: true,
      errors: [{ type: 'timeout', message: `单路由巡检超时（>${cfg.routeTimeoutSec || 120}s）` }],
    }), timeoutMs)
  })
  const r = await Promise.race([walkRoute(page, ctx, route, cfg, role, sink, routeState, token, globalSeen), timeout])
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
      const item = (o.localStorage || []).find(l => l.name === tokenKeyForRole(role))
      if (item) return item.value
    }
  } catch { /* ignore */ }
  return ''
}

// ── 启动前就绪探测：等待 nginx 能正常连到前后端，避免部署手顺中 502 ──
async function waitForReady(cfg) {
  const deadline = Date.now() + (cfg.readyTimeoutSec || 120) * 1000
  const probes = [
    { name: 'frontend', url: `${cfg.baseUrl}/portal/login`, expect: 200 },
    { name: 'backend', url: `${cfg.baseUrl}/api/v1/settings/theme`, expect: 200 },
  ]
  let lastErr = ''
  while (Date.now() < deadline) {
    let pending = probes.length
    const statuses = {}
    for (const p of probes) {
      try {
        const res = await fetch(p.url, { method: 'GET', signal: AbortSignal.timeout(3000) })
        statuses[p.name] = res.status
      } catch (e) {
        statuses[p.name] = 0
        lastErr = e.message
      }
    }
    if (Object.values(statuses).every(s => s >= 200 && s < 500)) {
      console.log(`[ready] 前后端就绪（${Object.entries(statuses).map(([k, v]) => `${k}=${v}`).join(', ')}）`)
      return
    }
    console.log(`[ready] 等待就绪：${Object.entries(statuses).map(([k, v]) => `${k}=${v || 'conn_err'}`).join(', ')}${lastErr ? ` (${lastErr.slice(0, 80)})` : ''}`)
    await sleep(cfg.readyIntervalMs || 1500)
  }
  throw new Error(`服务未在 ${cfg.readyTimeoutSec || 120}s 内就绪，最后错误: ${lastErr || 'timeout'}`)
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

  // partner（企业端）独立门户路由：portal 角色的 excludeRoutes 会把 /partner 排除，
  // 这里从排除前的 staticRoutes 单独取（排除登录页与重定向根页）；smoke.config.json 可用 partnerRoutes 覆盖
  const partnerRoutes = cfg.partnerRoutes?.length
    ? cfg.partnerRoutes
    : staticRoutes.filter(r => r.startsWith('/partner/') && r !== '/partner/login')

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
  if (cfg.clickOnly) {
    console.log('[click-only] 仅点击页面元素，不测试 CRUD 按钮/表单')
  } else {
    if (cfg.workers > 1) {
      console.log('[crud] 表单/状态变更操作会产生真实数据，并发降为 1 路串行执行')
      cfg.workers = 1
    }
    console.log(`[crud] 默认启用 CRUD 按钮测试（每页上限 ${cfg.maxFormSubmits} 次，数据前缀 ${cfg.crudMarker}，结束后${cfg.cleanup !== false ? '自动' : '不'}清理）`)
  }

  // 启动前就绪探测，避免部署后上游尚未切换完就开测
  try {
    await waitForReady(cfg)
  } catch (e) {
    console.error(`\n[ready] ${e.message}`)
    process.exit(1)
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

      // 动态路由（拉真实实体 id）；--route 单页调试模式跳过；partner 角色只巡检固定的门户页面
      let dynamicRoutes = []
      let roleToken = ''
      if (!cfg.route) {
        try {
          roleToken = await page.evaluate(k => {
            try { return localStorage.getItem(k) || '' } catch { return '' }
          }, tokenKeyForRole(role))
          if (role !== 'partner') {
            dynamicRoutes = await resolveDynamicRoutes(cfg, cfg.baseUrl, roleToken)
            if (dynamicRoutes.length) console.log(`  [${role}] 动态路由 ${dynamicRoutes.length} 个（拉取真实实体 id）`)
          }
        } catch {
          dynamicRoutes = []
        }
      }
      const dynamicUrls = new Set(dynamicRoutes.map(d => d.url))
      const baseRoutes = role === 'partner' && !cfg.route ? partnerRoutes : routes
      const roleRoutes = resumeDone ? baseRoutes.filter(r => !resumeDone.has(`${role}:${r}`)) : baseRoutes
      const allRoutes = [...roleRoutes, ...dynamicUrls]
      const chunkSize = Math.ceil(allRoutes.length / cfg.workers)
      const chunks = Array.from({ length: cfg.workers }, (_, i) => allRoutes.slice(i * chunkSize, (i + 1) * chunkSize)).filter(c => c.length)

      let done = 0
      const perRole = []
      const roleCreatedIds = new Set()

      await Promise.all(chunks.map(async (chunk, wi) => {
        const wctx = await browser.newContext({ storageState: path.join(STATE_DIR, `state-${role}.json`) })
        let wpage = await wctx.newPage()
        let wsink = []
        const wstate = { clickIndex: -1, url: '', dynamicUrls }
        const globalSeen = new Set() // 全局/共享元素每个 worker 只点一次
        attachListeners(wpage, wsink, cfg, wstate)
        try {
          for (const route of chunk) {
            let r = await runRouteWithTimeout(wpage, wctx, route, cfg, role, wsink, wstate, roleToken, globalSeen)
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
              r = await walkRoute(wpage, wctx, route, cfg, role, wsink, wstate, roleToken, globalSeen)
              // 崩溃重试保留第一次的错误（P1-7）
              if (!r.errors.length && oldSink.length) {
                r.errors.push(...oldSink)
                r.status = 'error'
              }
              allCrashes.count++
              allCrashes.routes.push(route)
            }
            // 瞬态基础设施错误（502/503/504/连接被拒绝）重试，避免部署/重启手顺中的偶发失败污染报告
            const maxTransient = cfg.retryTransient ?? 2
            for (let attempt = 0; r.errors.length && r.errors.every(isTransientError) && attempt < maxTransient; attempt++) {
              console.log(`  [${role}] ${route} 触发瞬态错误，${attempt + 1}/${maxTransient} 后重试...`)
              await sleep(cfg.retryTransientDelayMs || 1200)
              await wpage.close().catch(() => {})
              wpage = await wctx.newPage()
              wsink = []
              attachListeners(wpage, wsink, cfg, wstate)
              r = await runRouteWithTimeout(wpage, wctx, route, cfg, role, wsink, wstate, roleToken, globalSeen)
              if (r.timedOut) {
                await wpage.close().catch(() => {})
                wpage = await wctx.newPage()
                wsink = []
                attachListeners(wpage, wsink, cfg, wstate)
              }
            }
            perRole.push(r)
            for (const id of r.createdIds || []) roleCreatedIds.add(id)
            done++
            const mark = r.status === 'ok' ? 'ok  ' : r.status === 'skip' ? 'skip' : 'ERR '
            console.log(`  [${role}] ${done}/${allRoutes.length} ${mark} ${route}${r.errors.length ? `（${r.errors.length} 个错误）` : ''}`)
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

  // CRUD 测试数据清理（SMOKE_ 前缀），跨角色按 id 去重
  let cleanupTotal = null
  if (!cfg.clickOnly && cfg.cleanup !== false) {
    console.log('\n=== 清理 SMOKE_ 测试数据 ===')
    const specs = buildCleanupSpecs(cfg)
    const seenIds = new Set()
    cleanupTotal = { deleted: 0, failed: 0 }
    for (const role of cfg.roles) {
      if (results[role]?.login !== 'ok') continue
      const token = await readStateToken(role)
      const roleCreatedIds = new Set()
      for (const rt of results[role]?.routes || []) {
        for (const id of rt.createdIds || []) roleCreatedIds.add(id)
      }
      const r = await cleanupSmokeData(cfg, token, specs, seenIds, console.log, roleCreatedIds)
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
    args: { roles: cfg.roles, maxClicks: cfg.maxClicks, workers: cfg.workers, gitDiff: cfg.gitDiff || null, clickOnly: !!cfg.clickOnly },
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
