/**
 * 主流程：登录 → 分片并行巡检 → 聚合 → 基线 diff → 报告。
 * P0-4：任何 worker 异常都兜底，报告保证写出。
 */
import { chromium } from 'playwright'
import { execFileSync } from 'child_process'
import path from 'path'
import { resolveConfig, STATE_DIR, PROJECT_ROOT } from './config.mjs'
import { discoverStaticRoutes, resolveDynamicRoutes, scopeRoutesByGitDiff, BUILTIN_DYNAMIC_ROUTES, BUILTIN_CLEANUP_APIS } from './routes.mjs'
import { walkRoute, tokenKeyForRole } from './clicker.mjs'
import { cleanupSmokeData } from './forms.mjs'
import { aggregateErrors, buildResumeDoneSet, classifyApiResponse, diffWithBaseline, isTransientError, printSummary, writeReport } from './report.mjs'
import { promises as fs } from 'fs'

const sleep = ms => new Promise(r => setTimeout(r, ms))

// ── 验证码（新设备登录自动识别）──────────────────────────────
// 登录页固定设备标识：信任跨运行累积（30 天滑窗），第二次起不再触发新设备验证码；
// 首次运行/信任过期时由下面逻辑从 Redis 读取答案自动填写。
const SMOKE_DEVICE_ID = 'smoke-device-portal'

/**
 * 从 Redis 读取验证码明文答案（base64Captcha 答案仅存服务端 Redis，
 * 巡检环境可直接读取；生产环境验证码答案只在服务端内存流转）。
 */
function captchaAnswer(captchaId) {
  if (!captchaId) return null
  try {
    const out = execFileSync(
      'docker', ['exec', 'zhiyu-redis', 'redis-cli', 'GET', `zhiyu:captcha:answer:${captchaId}`],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
    )
    return (out || '').trim() || null
  } catch {
    return null
  }
}

// ── 登录 ──────────────────────────────────────────────────
async function login(ctx, page, cfg, role, listeners) {
  const cred = cfg.accounts?.[role]
  if (!cred) throw new Error(`未知角色: ${role}，可通过 --account ${role}:user:pass 指定`)

  // partner（企业端）为独立认证门户（/partner/login），走最小分支：直接调接口拿 token
  if (role === 'partner') return loginPartner(ctx, page, cfg, role, cred)

  // 提交一次登录表单，返回响应状态；captcha_required/captcha_wrong 返回 'captcha:...'
  // 注意：必须先调用本函数（注册监听）再点击提交，否则本地毫秒级响应会在监听注册前返回，事件错过
  const submitAndWait = () => new Promise(resolve => {
    const timer = setTimeout(() => resolve('timeout'), cfg.loginTimeoutMs + 5000)
    const onResponse = async res => {
      if (res.url().includes('/auth/portal/login') && res.request().method() === 'POST') {
        clearTimeout(timer)
        page.off('response', onResponse)
        const status = res.status()
        if (status === 400) {
          const body = await res.json().catch(() => null)
          if (body?.code === 'captcha_required' || body?.code === 'captcha_wrong') {
            resolve(`captcha:${body.code}`)
            return
          }
        }
        resolve(status)
      }
    }
    page.on('response', onResponse)
    listeners.push({ handler: onResponse, kind: 'response' })
  })

  // 提交并等待响应：先注册监听，再点击（监听器在 resolve 时自移除，重复调用安全）
  const submit = () => {
    const wait = submitAndWait()
    return page.click('button[type="submit"]').then(() => wait)
  }

  // 页面出现验证码后：主动刷新验证码（确保在监听之后发请求）→ 从 Redis 读答案 → 填入输入框
  const solveCaptchaViaUi = async () => {
    const input = page.locator('input[aria-label="验证码"]')
    await input.waitFor({ state: 'visible', timeout: 5000 })
    const captchaIdPromise = new Promise(resolve => {
      const h = async res => {
        if (res.url().includes('/auth/captcha') && res.request().method() === 'GET') {
          page.off('response', h)
          const body = await res.json().catch(() => null)
          resolve(body?.captchaId || null)
        }
      }
      page.on('response', h)
      setTimeout(() => { page.off('response', h); resolve(null) }, 10000)
    })
    // 点击验证码图片刷新，触发一次新的 GET /auth/captcha（注册监听后发请求，避免竞态）
    const imgBtn = page.locator('button[title="点击刷新验证码"]')
    await imgBtn.waitFor({ state: 'visible', timeout: 5000 })
    await imgBtn.click()
    const captchaId = await captchaIdPromise
    if (!captchaId) throw new Error('验证码自动识别失败: 未获取到 captchaId')
    const code = captchaAnswer(captchaId)
    if (!code) throw new Error(`验证码自动识别失败: Redis 无答案 ${captchaId}`)
    await input.fill(code)
  }

  try {
    await page.goto(`${cfg.baseUrl}/portal/login`, { waitUntil: 'domcontentloaded', timeout: 30000 })
    // 等待 React 水合完成（DOM 元素挂上 __reactProps 即事件处理器就绪）：
    // 否则点击提交会走原生表单提交（POST 打到页面路径而非 /api），登录响应永远等不到
    await page.waitForFunction(
      () => {
        const btn = document.querySelector('button[type="submit"]')
        return btn && Object.keys(btn).some(k => k.startsWith('__reactProps'))
      },
      null, { timeout: 20000 },
    ).catch(() => {})
    // 固定设备标识：信任跨运行累积，避免每次巡检都触发新设备验证码
    await page.evaluate(() => { try { localStorage.setItem('zhiyu-device-id', SMOKE_DEVICE_ID) } catch { /* ignore */ } })
    await page.fill('#username', cred.username)
    await page.fill('#password', cred.password)
  } catch (e) {
    throw new Error(`登录页操作失败: ${e.message}`)
  }

  // 新设备/失败计数触发验证码：自动识别并重试（最多 3 轮）
  let status = await submit()
  let captchaTries = 0
  while (typeof status === 'string' && status.startsWith('captcha:') && captchaTries < 3) {
    await solveCaptchaViaUi()
    status = await submit()
    captchaTries++
  }

  if (status === 401) throw new Error(`登录失败: 用户名或密码错误（401），或账号已被禁用`)
  if (status === 429) throw new Error(`登录失败: 登录限流（429），请稍后重试`)
  if (status === 'timeout') throw new Error(`登录超时: 登录请求未完成`)
  if (typeof status === 'string' && status.startsWith('captcha:')) {
    throw new Error(`登录被验证码拦截（${status}）：自动识别 3 轮仍失败，请人工确认。` +
      `或清除验证码失败计数后重试（redis: DEL "zhiyu:captcha:fail:*"）`)
  }

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
  const getCaptcha = async () => {
    const r = await fetch(`${cfg.baseUrl}/api/v1/auth/captcha`, {
      signal: AbortSignal.timeout(cfg.loginTimeoutMs),
    })
    if (!r.ok) throw new Error(`验证码获取失败: HTTP ${r.status}`)
    return r.json()
  }
  // 无 deviceId 的接口登录每次都要验证码；带固定设备标识 + 自动读 Redis 答案通过
  const deviceId = 'smoke-device-partner'
  let res = await post('/api/v1/auth/partner/login', { username: cred.username, password: cred.password, deviceId })
  let captchaTries = 0
  while (res.status === 400 && captchaTries < 3) {
    const body = await res.json().catch(() => null)
    if (body?.code !== 'captcha_required' && body?.code !== 'captcha_wrong') break
    const cap = await getCaptcha()
    const code = captchaAnswer(cap.captchaId)
    if (!code) throw new Error('partner 验证码自动识别失败: Redis 无答案')
    res = await post('/api/v1/auth/partner/login', {
      username: cred.username, password: cred.password, deviceId,
      captchaId: cap.captchaId, captchaCode: code,
    })
    captchaTries++
  }
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
      // 把 401/403/429 的 console 报错也归为权限/限流信号，避免 /partner 等无权限页噪音；
      // "too many requests" 是前端 reportError 对 429 的透传文案（不含状态码），一并归为限流
      let subType = 'console'
      if (/\b401\b/.test(text) || /\b403\b/.test(text)) subType = 'auth'
      else if (/\b429\b/.test(text) || /too many requests/i.test(text)) subType = 'rate-limit'
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
  for (const base of BUILTIN_CLEANUP_APIS) {
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
    const out = execFileSync('docker', ['compose', '-f', 'deploy/docker-compose.yml', 'logs', '--since', startTime, 'backend'],
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
  const bstate = {}
  const launchBrowser = async () => {
    const b = await chromium.launch({
      headless: !cfg.headed,
      channel: process.env.UI_SMOKE_CHANNEL || 'chrome',
      args: [
        ...(process.getuid?.() === 0 ? ['--no-sandbox', '--disable-dev-shm-usage'] : []),
        '--disable-gpu',
        '--disable-background-networking',
      ],
    })
    bstate.browser = b
    return b
  }
  // 浏览器实例状态容器：chrome 进程偶发崩溃（内存/环境因素）时检测并重启续跑
  bstate.browser = await launchBrowser()
  const browser = bstate.browser

  // playwright 操作在浏览器进程死亡后可能永远挂起（CDP 连接悬置），统一加超时兜底
  const withTimeout = (p, ms, label) =>
    Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error(`${label} 超时（${ms}ms）`)), ms))])

  // 检查浏览器是否存活；死亡则重启并返回新实例
  const ensureBrowser = async () => {
    try {
      if (bstate.browser.isConnected()) return bstate.browser
    } catch { /* isConnected 异常按断开处理 */ }
    console.warn('  [browser] 浏览器进程已断开，重启浏览器续跑...')
    await bstate.browser.close().catch(() => {})
    return launchBrowser()
  }

  const results = {}
  const allCrashes = { count: 0, routes: [] }

  // 全局看门狗：超时强制结束
  let watchdogTimer = null
  if (cfg.timeoutMin) {
    watchdogTimer = setTimeout(() => {
      console.error(`\n[watchdog] 超过 ${cfg.timeoutMin} 分钟，强制结束（已巡检结果保留）`)
      bstate.browser.close().catch(() => {})
    }, cfg.timeoutMin * 60000)
  }

  try {
    for (const role of cfg.roles) {
      console.log(`\n=== [${role}] 开始巡检 ===`)
      let ctx
      try {
        await ensureBrowser()
        ctx = await withTimeout(bstate.browser.newContext(), 20000, 'newContext')
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
        await withTimeout(ctx.close().catch(() => {}), 5000, "closeCtx")
        continue
      } finally {
        for (const l of loginListeners) page.off(l.kind, l.handler)
      }

      // 动态路由（拉真实实体 id）；--route 单页调试模式跳过。
      // portal 与 partner 都解析：各自 token 调各自域接口（异域接口自然 403 跳过，不阻塞）
      let dynamicRoutes = []
      let roleToken = ''
      if (!cfg.route) {
        try {
          roleToken = await page.evaluate(k => {
            try { return localStorage.getItem(k) || '' } catch { return '' }
          }, tokenKeyForRole(role))
          dynamicRoutes = await resolveDynamicRoutes(cfg, cfg.baseUrl, roleToken)
          if (dynamicRoutes.length) console.log(`  [${role}] 动态路由 ${dynamicRoutes.length} 个（拉取真实实体 id）`)
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
        // 浏览器可能已在登录/上一角色阶段崩溃，先确保存活再开 worker 上下文
        await ensureBrowser()
        let wctx = await withTimeout(bstate.browser.newContext({ storageState: path.join(STATE_DIR, `state-${role}.json`) }), 20000, 'newContext')
        let wpage = await withTimeout(wctx.newPage(), 20000, 'newPage')
        let wsink = []
        const wstate = { clickIndex: -1, url: '', dynamicUrls }
        const globalSeen = new Set() // 全局/共享元素每个 worker 只点一次
        attachListeners(wpage, wsink, cfg, wstate)
        const refreshWorkerPage = async () => {
          await withTimeout(wpage.close().catch(() => {}), 5000, 'closePage')
          wpage = await withTimeout(wctx.newPage(), 20000, 'newPage')
          wsink = []
          attachListeners(wpage, wsink, cfg, wstate)
        }
        try {
          for (const route of chunk) {
            // 浏览器进程偶发崩溃自愈：断开则重启浏览器并重建上下文，续跑剩余路由
            if (!bstate.browser.isConnected()) {
              console.warn(`  [${role}] worker 检测到浏览器断开，重启浏览器续跑...`)
              await ensureBrowser()
              await withTimeout(wctx.close().catch(() => {}), 5000, 'closeContext')
              wctx = await withTimeout(bstate.browser.newContext({ storageState: path.join(STATE_DIR, `state-${role}.json`) }), 20000, 'newContext')
              await refreshWorkerPage()
            }
            let r = await runRouteWithTimeout(wpage, wctx, route, cfg, role, wsink, wstate, roleToken, globalSeen)
            if (r.timedOut) {
              // 单路由超时：换新页面继续，不重试
              await refreshWorkerPage()
            }
            for (let attempt = 0; r.crashed && attempt < cfg.retryCrashes; attempt++) {
              await refreshWorkerPage()
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
              await refreshWorkerPage()
              r = await runRouteWithTimeout(wpage, wctx, route, cfg, role, wsink, wstate, roleToken, globalSeen)
              if (r.timedOut) {
                await refreshWorkerPage()
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
          await withTimeout(wctx.close().catch(() => {}), 5000, 'closeContext')
        }
      }))

      results[role] = { login: 'ok', routes: perRole.sort((a, b) => a.route.localeCompare(b.route)) }
      await withTimeout(ctx.close().catch(() => {}), 5000, "closeCtx")
    }
  } finally {
    if (watchdogTimer) clearTimeout(watchdogTimer)
    await bstate.browser.close().catch(() => {})
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
