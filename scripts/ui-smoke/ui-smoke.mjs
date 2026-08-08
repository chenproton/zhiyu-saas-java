#!/usr/bin/env node
/**
 * 知育前端全站点击巡检工具（UI Smoke Test）
 *
 * 功能：
 *   1. 从 apps/edu/app 目录递归扫描 page.tsx，自动枚举所有页面路由（跳过动态 [id] 与分组 (group) 路由）
 *   2. 按角色登录（school / teacher / student），逐页进入
 *   3. 对每页的可见按钮 / 内部链接 / Tab 逐个点击（触发弹窗后按 Esc 关闭，点击导致跳转后回到原页面）
 *   4. 全程监控四类报错：
 *      - pageerror  前端 JS 异常（React 崩溃等）
 *      - console    前端 console.error / warning
 *      - api        HTTP >= 400 的接口响应（后端服务端错误会在这里暴露）
 *      - network    请求失败（DNS/网络层）
 *   5. 可选 --tail-backend：用 docker compose logs 增量抓取后端日志中的 error/panic 行
 *
 * 用法：
 *   node scripts/ui-smoke/ui-smoke.mjs [选项]
 *
 * 选项：
 *   --base-url <url>        目标站点（默认 http://127.0.0.1，即 nginx 网关；注意不能直连 3020，
 *                          容器内 Next rewrite 到 127.0.0.1:8080 会失败，必须走网关）
 *   --roles <a,b,c>         角色列表（默认 school,teacher,student）
 *   --max-clicks <n>        每页点击次数安全阀（默认 100，正常每页唯一可点元素不会触达）
 *   --workers <n>           并行巡检路数（默认 3）
 *   --report <path>         报告 JSON 输出路径（默认 /tmp/zhiyu-ui-smoke/report.json）
 *   --exclude <sub,a,b>     按路径子串排除路由（逗号分隔）
 *   --route <path>          只巡检指定路由（调试用）
 *   --click-dangerous       允许点击保存/提交/删除/发布等会修改数据的按钮（默认跳过，防止污染数据）
 *   --tail-backend          同时抓取后端容器日志中的 error/panic 增量（需在项目根目录、有 docker compose）
 *   --fail-on-error         发现错误时退出码返回 1（供 CI 使用）
 *   --headed                显示浏览器窗口（默认无头）
 *   --verbose               连 warning 一并输出
 */
import { chromium } from 'playwright'
import { promises as fs } from 'fs'
import { execFileSync } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = path.resolve(SCRIPT_DIR, '..', '..')
const APP_DIR = path.join(PROJECT_ROOT, 'apps', 'edu', 'app')
const STATE_DIR = '/tmp/zhiyu-ui-smoke'
const DEFAULT_REPORT = path.join(STATE_DIR, 'report.json')

const ROLE_ACCOUNTS = {
  school: { username: 'school', password: 'school123' },
  teacher: { username: 'teacher', password: 'teacher123' },
  student: { username: 'student', password: 'student123' },
}

// 会修改/提交数据的按钮，默认跳过（防止污染数据；含新建/创建/禁用/完成等，避免误操作）
const DANGEROUS_RE = /^(保存|提交|删除|发布|确认|确定|归档|驳回|通过|启用|停用|禁用|冻结|锁定|重置密码|退出|注销|登出|批量|创建|新增|新建|添加|完成)/

// 种子数据中的占位图片等已知噪音，默认过滤（--verbose 可关闭过滤）
const NOISE_RE = /example\.com/

function parseArgs(argv) {
  const args = { baseUrl: 'http://127.0.0.1', roles: ['school', 'teacher', 'student'],
    maxClicks: 100, workers: 3, report: DEFAULT_REPORT, exclude: [], route: null,
    clickDangerous: false, tailBackend: false, failOnError: false, headed: false, verbose: false }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    const next = () => argv[++i]
    switch (a) {
      case '--base-url': args.baseUrl = next(); break
      case '--roles': args.roles = next().split(',').map(s => s.trim()); break
      case '--max-clicks': args.maxClicks = parseInt(next(), 10); break
      case '--workers': args.workers = parseInt(next(), 10); break
      case '--report': args.report = next(); break
      case '--exclude': args.exclude = next().split(',').map(s => s.trim()); break
      case '--route': args.route = next(); break
      case '--click-dangerous': args.clickDangerous = true; break
      case '--tail-backend': args.tailBackend = true; break
      case '--fail-on-error': args.failOnError = true; break
      case '--headed': args.headed = true; break
      case '--verbose': args.verbose = true; break
      case '--help': case '-h':
        console.log(fs.readFileSync(new URL(import.meta.url), 'utf8').split('*/')[0].replace(/\/\*|\*\//g, '').trim())
        process.exit(0)
      default:
        console.error(`未知参数: ${a}（--help 查看用法）`); process.exit(2)
    }
  }
  if (!args.headed && process.env.UI_SMOKE_HEADED) args.headed = true
  return args
}

const sleep = ms => new Promise(r => setTimeout(r, ms))

// ── 路由枚举 ──────────────────────────────────────────────
async function discoverRoutes() {
  const routes = []
  async function walk(dir, prefix) {
    let entries
    try { entries = await fs.readdir(dir, { withFileTypes: true }) } catch { return }
    for (const e of entries) {
      if (e.name.startsWith('.')) continue
      const full = path.join(dir, e.name)
      if (e.isDirectory()) {
        if (e.name.includes('(') || e.name.includes('[')) continue // 分组/动态段跳过
        await walk(full, `${prefix}/${e.name}`)
      } else if (e.name === 'page.tsx') {
        if (prefix !== '/portal/login') routes.push(prefix)
      }
    }
  }
  await walk(APP_DIR, '')
  return [...new Set(routes)].sort()
}

// ── 登录 ──────────────────────────────────────────────────
async function login(ctx, page, args, role) {
  const cred = ROLE_ACCOUNTS[role]
  if (!cred) throw new Error(`未知角色: ${role}`)
  await page.goto(`${args.baseUrl}/portal/login`, { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.fill('#username', cred.username)
  await page.fill('#password', cred.password)
  await page.click('button[type="submit"]')
  await sleep(800)
  // 多租户账号需在弹出的租户选择框中选第一个
  const dialog = page.locator('[role="dialog"]:visible')
  if (await dialog.count()) {
    await dialog.locator('button').first().click()
  }
  await page.waitForFunction(
    () => !location.pathname.includes('/portal/login'),
    null, { timeout: 20000 },
  ).catch(() => { throw new Error('登录超时') })
  await ctx.storageState({ path: path.join(STATE_DIR, `state-${role}.json`) })
  return true
}

// ── 错误收集 ──────────────────────────────────────────────
function attachListeners(page, sink, args) {
  const push = err => { if (args.verbose || !NOISE_RE.test(err.message)) sink.push(err) }
  page.on('pageerror', err => push({
    type: 'pageerror', message: err.message || String(err),
    stack: (err.stack || '').split('\n').slice(0, 6).join('\n'),
  }))
  page.on('console', msg => {
    const t = msg.type()
    if (t === 'error') push({ type: 'console', message: msg.text().slice(0, 500) })
    else if (t === 'warning' && args.verbose) push({ type: 'console-warning', message: msg.text().slice(0, 500) })
  })
  page.on('response', res => {
    const status = res.status()
    const url = res.url()
    if (status >= 400 && url.includes('/api/')) {
      push({ type: 'api', message: `${status} ${res.request().method()} ${url.replace(args.baseUrl, '')}` })
    }
  })
  page.on('requestfailed', req => {
    const err = req.failure()?.errorText || 'failed'
    if (err !== 'net::ERR_ABORTED') {
      push({ type: 'network', message: `${err} ${req.method()} ${req.url().replace(args.baseUrl, '')}` })
    }
  })
  page.on('dialog', d => d.dismiss().catch(() => {}))
}

// ── 单页点击巡检 ──────────────────────────────────────────
const CLICKABLE_SELECTOR = ['button', 'a[href]', '[role="tab"]', '[role="button"]'].join(',')

async function collectClickables(page, args) {
  return page.evaluate(({ selector, dangerous, clickDangerous }) => {
    const skipRe = new RegExp(dangerous)
    const countByKey = new Map()
    const out = []
    const els = [...document.querySelectorAll(selector)]
    els.forEach((el, index) => {
      const rect = el.getBoundingClientRect()
      if (rect.width < 4 || rect.height < 4) return
      const cs = getComputedStyle(el)
      if (cs.visibility === 'hidden' || cs.display === 'none') return
      if (el.disabled || el.getAttribute('aria-disabled') === 'true') return
      if (el.closest('[role="dialog"], [data-radix-dialog-content]')) return // 弹窗内部交给"打开→Esc 关闭"策略
      const href = el.getAttribute('href') || ''
      if (el.tagName === 'A' && href && !href.startsWith('/')) return // 仅内部链接
      const text = (el.innerText || '').trim().replace(/\s+/g, ' ').slice(0, 40)
      if (text && !clickDangerous && skipRe.test(text)) return
      // 同类元素（如表格每行"编辑"）按出现次数编号，保证每个都点一次
      const base = `${el.tagName}|${text}|${href}`
      const n = (countByKey.get(base) || 0) + 1
      countByKey.set(base, n)
      out.push({ key: `${base}|${n}`, index })
    })
    return out
  }, { selector: CLICKABLE_SELECTOR, dangerous: DANGEROUS_RE.source, clickDangerous: args.clickDangerous })
}

// 按收集时的文档序 index 定位并点击；DOM 变化导致错位时校验 base key，不一致则按 key 回退查找
function clickByIndex(page, selector, pick) {
  return page.evaluate(({ selector, key, index }) => {
    const base = key.slice(0, key.lastIndexOf('|'))
    const matchKey = el => {
      const text = (el.innerText || '').trim().replace(/\s+/g, ' ').slice(0, 40)
      const href = el.getAttribute('href') || ''
      return `${el.tagName}|${text}|${href}` === base
    }
    const els = [...document.querySelectorAll(selector)]
    const el = els[index] && matchKey(els[index]) ? els[index] : els.find(matchKey)
    if (el) el.click()
  }, { selector, key: pick.key, index: pick.index }).catch(() => {})
}

async function walkRoute(page, ctx, route, args, role, sink) {
  const routeResult = { route, status: 'ok', clicks: 0, errors: [] }
  try {
    await page.goto(args.baseUrl + route, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {})
    await sleep(600)
    if (page.url().includes('/portal/login')) { // 无权限/未登录被重定向
      routeResult.status = 'skip'
      return routeResult
    }
    const basePath = new URL(page.url()).pathname
    // 队列式点击：初始收集一次唯一元素清单，逐个点一遍（弹窗开→Esc 关，跳走→回本页），
    // 每轮结束后补充点击产生的新元素（Tab 切换/展开菜单等），max-clicks 仅作安全阀
    const attempted = new Set()
    const queue = await collectClickables(page, args)
    for (let qi = 0; qi < queue.length && routeResult.clicks < args.maxClicks; qi++) {
      const pick = queue[qi]
      if (attempted.has(pick.key)) continue
      attempted.add(pick.key)
      await clickByIndex(page, CLICKABLE_SELECTOR, pick)
      routeResult.clicks++
      await sleep(350)
      // 弹窗/下拉菜单打开则 Esc 关闭
      if (await page.locator('[role="dialog"]:visible, [role="menu"]:visible').count()) {
        await page.keyboard.press('Escape').catch(() => {})
        await sleep(300)
      }
      // 点击导致跳转到其他页面 → 回到本页继续
      const nowPath = new URL(page.url()).pathname
      if (nowPath !== basePath && !nowPath.includes('/portal/login')) {
        await page.goto(args.baseUrl + route, { waitUntil: 'domcontentloaded', timeout: 30000 })
          .catch(() => {})
        await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {})
        await sleep(400)
      }
      // 增量补充点击后新出现的可点击元素（已尝试过的不重复点）
      const fresh = await collectClickables(page, args).catch(() => [])
      for (const f of fresh) {
        if (!attempted.has(f.key) && !queue.some(q => q.key === f.key)) {
          queue.push(f)
        }
      }
    }
  } catch (e) {
    routeResult.status = 'error'
    routeResult.errors.push({ type: 'page', message: `页面巡检失败: ${e.message}` })
    if (/crash|target closed/i.test(e.message || '')) {
      routeResult.crashed = true // 渲染进程崩溃（多并发大页面时内存压力），由 worker 重试
    }
  }
  for (const err of sink.splice(0)) {
    routeResult.errors.push(err)
  }
  if (routeResult.errors.length) routeResult.status = 'error'
  return routeResult
}

// ── 后端容器日志增量抓取（可选） ───────────────────────────
function tailBackendLogs(startTime) {
  try {
    const out = execFileSync('docker', ['compose', 'logs', '--since', startTime, 'zhiyu-backend'],
      { cwd: PROJECT_ROOT, encoding: 'utf8', timeout: 30000 })
    return out.split('\n').filter(l => /error|panic|fatal/i.test(l)).slice(0, 50)
  } catch (e) {
    return [`[docker compose logs 不可用] ${e.message}`]
  }
}

// ── 主流程 ────────────────────────────────────────────────
async function main() {
  const args = parseArgs(process.argv.slice(2))
  await fs.mkdir(STATE_DIR, { recursive: true })
  const startedAt = Date.now()

  const routes = args.route ? [args.route] : (await discoverRoutes()).filter(r => !args.exclude.some(x => r.includes(x)))
  console.log(`目标站点: ${args.baseUrl}`)
  console.log(`发现页面: ${routes.length} 个，角色: ${args.roles.join('/')}，每页点击全部唯一可点元素（上限 ${args.maxClicks}）`)

  const backendStart = new Date().toISOString()
  // 优先用系统 Chrome（channel: 'chrome'），避免从 cdn.playwright.dev 下载浏览器（该 CDN 在国内不通）
  const browser = await chromium.launch({
    headless: !args.headed,
    channel: process.env.UI_SMOKE_CHANNEL || 'chrome',
    args: process.getuid?.() === 0 ? ['--no-sandbox', '--disable-dev-shm-usage'] : [],
  })
  const results = {}

  for (const role of args.roles) {
    console.log(`\n=== [${role}] 开始巡检 ===`)
    const ctx = await browser.newContext()
    const page = await ctx.newPage()
    const sink = []
    attachListeners(page, sink, args)
    try {
      await login(ctx, page, args, role)
      console.log(`  [${role}] 登录成功`)
    } catch (e) {
      console.error(`  [${role}] 登录失败: ${e.message}，跳过该角色`)
      results[role] = { login: 'failed', error: e.message, routes: [] }
      await ctx.close()
      continue
    }

    const chunkSize = Math.ceil(routes.length / args.workers)
    const chunks = Array.from({ length: args.workers }, (_, i) => routes.slice(i * chunkSize, (i + 1) * chunkSize)).filter(c => c.length)
    let done = 0
    const perRole = []

    await Promise.all(chunks.map(async (chunk, wi) => {
      const wctx = await browser.newContext({ storageState: path.join(STATE_DIR, `state-${role}.json`) })
      let wpage = await wctx.newPage()
      let wsink = []
      attachListeners(wpage, wsink, args)
      for (const route of chunk) {
        let r = await walkRoute(wpage, wctx, route, args, role, wsink)
        // 渲染进程崩溃（多 worker 并发大页面时的内存压力）→ 换新页面重试，最多 2 次
        for (let attempt = 0; r.crashed && attempt < 2; attempt++) {
          await wpage.close().catch(() => {})
          wpage = await wctx.newPage()
          wsink = []
          attachListeners(wpage, wsink, args)
          r = await walkRoute(wpage, wctx, route, args, role, wsink)
        }
        perRole.push(r)
        done++
        const mark = r.status === 'ok' ? 'ok  ' : r.status === 'skip' ? 'skip' : 'ERR '
        console.log(`  [${role}] ${done}/${routes.length} ${mark} ${route}${r.errors.length ? `（${r.errors.length} 个错误）` : ''}`)
      }
      await wctx.close()
    }))

    results[role] = { login: 'ok', routes: perRole.sort((a, b) => a.route.localeCompare(b.route)) }
    await ctx.close()
  }
  await browser.close()

  if (args.tailBackend) {
    console.log('\n=== 后端容器日志（增量抓取） ===')
    const lines = tailBackendLogs(backendStart)
    console.log(lines.length ? lines.join('\n') : '  无 error/panic/fatal 行')
    results.backendLogLines = lines
  }

  // 汇总输出
  console.log('\n========== 巡检报告 ==========')
  let totalErrors = 0
  for (const role of args.roles) {
    const r = results[role]
    if (!r || r.login !== 'ok') { console.log(`\n[${role}] 登录失败，未巡检`); continue }
    const errRoutes = r.routes.filter(x => x.errors.length)
    const skipped = r.routes.filter(x => x.status === 'skip').length
    totalErrors += errRoutes.length
    console.log(`\n[${role}] 页面 ${r.routes.length} 个，跳过 ${skipped} 个，出错 ${errRoutes.length} 个`)
    for (const rt of errRoutes) {
      console.log(`  ✗ ${rt.route}（点击 ${rt.clicks} 次）`)
      for (const e of rt.errors) console.log(`      [${e.type}] ${e.message.split('\n')[0]}`)
    }
  }
  console.log(`\n共 ${totalErrors} 个页面发现问题，报告已保存: ${args.report}（耗时 ${Math.round((Date.now() - startedAt) / 1000)}s）`)

  const report = {
    generatedAt: new Date().toISOString(),
    durationSeconds: Math.round((Date.now() - startedAt) / 1000),
    baseUrl: args.baseUrl,
    args: { roles: args.roles, maxClicks: args.maxClicks, workers: args.workers },
    results,
  }
  await fs.writeFile(args.report, JSON.stringify(report, null, 2))

  if (args.failOnError && totalErrors > 0) process.exit(1)
}

main().catch(e => { console.error(e); process.exit(1) })
