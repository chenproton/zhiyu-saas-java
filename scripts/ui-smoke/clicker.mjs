/**
 * 页面点击巡检：可点击元素收集、点击、弹窗关闭、跳转回访、增量补充。
 * 含 locale 防护（点击语言切换按钮后自动切回中文，防止危险词失效）。
 * --test-forms 下，点击创建/编辑类入口或页面内表单会触发表单填充提交测试（forms.mjs）。
 */

import { maybeTestForm, buildTriggerRe, keyText } from './forms.mjs'

export const CLICKABLE_SELECTOR = ['button', 'a[href]', '[role="tab"]', '[role="button"]'].join(',')
// 弹层容器：Radix Dialog 是 dialog，AlertDialog（确认删除等）是 alertdialog，两者都必须纳入
export const DIALOG_SELECTOR = '[role="dialog"], [role="alertdialog"], [data-radix-dialog-content]'
export const DIALOG_VISIBLE_SELECTOR = '[role="dialog"]:visible, [role="alertdialog"]:visible'

// 角色对应的 localStorage token 键与登录页路径（partner 企业端为独立认证门户）
export const tokenKeyForRole = role => (role === 'partner' ? 'zhiyu-partner-token' : 'zhiyu-portal-token')
export const loginPathForRole = role => (role === 'partner' ? '/partner/login' : '/portal/login')

// 不计入错误的类型（401/403 权限信号、429 限流）
export const NON_ERROR_TYPES = new Set(['auth', 'rate-limit'])

export function buildDangerousRe(cfg) {
  return wordRe([...(cfg.dangerousWords || []), ...(cfg.dangerousWordsEn || [])])
}

export function buildDestructiveRe(cfg) {
  return wordRe([...(cfg.destructiveWords || []), ...(cfg.destructiveWordsEn || [])])
}

export function buildNavRe(cfg) {
  return wordRe([...(cfg.navWords || []), ...(cfg.navWordsEn || [])])
}

function wordRe(words) {
  return new RegExp(`^(?:${words.map(escapeRe).join('|')})`)
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// 按路由覆盖配置（前缀匹配，最长优先）
export function routeCfg(cfg, route) {
  const overrides = cfg.routeOverrides || {}
  let best = null
  for (const key of Object.keys(overrides)) {
    if (route === key || route.startsWith(key.endsWith('/') ? key : key + '/') || route.startsWith(key)) {
      if (!best || key.length > best.length) best = key
    }
  }
  return best ? { ...cfg, ...overrides[best] } : cfg
}

// 收集可见可点击元素（含文档序 index 与行内序号 key）。
// scope='page'：只收弹层外元素（默认）；scope='dialog'：只收弹层内元素（key 加 dlg| 前缀）。
// triggerRe：表单测试模式下，创建/编辑类入口词即使命中危险词也放行（点击后由 maybeTestForm 接管）。
export async function collectClickables(page, cfg, dangerousRe, scope = 'page', triggerRe = null) {
  return page.evaluate(({ selector, dialogSel, re, triggerSrc, submitWords, destructiveWords, navWords, clickDangerous, allowIconButtons, localeWords, scope }) => {
    const escapeRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    // 空词表时正则永不命中（否则 ^(?:) 会匹配一切）
    const wordRe = (words, anchorEnd) => words.length
      ? new RegExp(`^(?:${words.map(escapeRe).join('|')})${anchorEnd ? '$' : ''}`)
      : { test: () => false }
    const skipRe = new RegExp(re)
    const triggerRegex = triggerSrc ? new RegExp(triggerSrc) : null
    const submitRe = wordRe(submitWords)
    const destructiveRe = wordRe(destructiveWords)
    const navRe = wordRe(navWords)
    const localeRe = wordRe(localeWords, true)
    // 动作分类：弹层内提交词优先（保存/创建是提交按钮），页面级入口词优先（创建/新增是表单入口）
    const classify = (el, effText, href) => {
      if (effText) {
        if (destructiveRe.test(effText)) return 'destructive'
        if (scope === 'dialog') {
          if (submitRe.test(effText)) return 'submit'
          if (triggerRegex?.test(effText)) return 'form-trigger'
        } else {
          if (triggerRegex?.test(effText)) return 'form-trigger'
          if (submitRe.test(effText)) return 'submit'
        }
        if (navRe.test(effText)) return 'nav'
      }
      if (el.tagName === 'A' && href) return 'nav'
      if (!effText) return 'unknown'
      return 'overlay'
    }
    const countByKey = new Map()
    const out = []
    const els = [...document.querySelectorAll(selector)]
    els.forEach((el, index) => {
      const inDialog = !!el.closest(dialogSel)
      if (scope === 'page' && inDialog) return
      if (scope === 'dialog' && !inDialog) return
      const rect = el.getBoundingClientRect()
      if (rect.width < 4 || rect.height < 4) return
      const cs = getComputedStyle(el)
      if (cs.visibility === 'hidden' || cs.display === 'none') return
      if (el.disabled || el.getAttribute('aria-disabled') === 'true') return
      const href = el.getAttribute('href') || ''
      if (el.tagName === 'A' && href && !href.startsWith('/')) return
      const text = (el.innerText || '').trim().replace(/\s+/g, ' ').slice(0, 40)
      // 图标按钮兜底：innerText 为空时看 aria-label / title
      const label = (el.getAttribute('aria-label') || el.getAttribute('title') || '').trim().slice(0, 40)
      const effText = text || label
      if (!clickDangerous) {
        if (!effText && !allowIconButtons) return // 无文本图标按钮：宁漏勿删
        if (effText) {
          if (localeRe.test(effText)) return // 语言切换按钮：点击会改变全局语言，跳过
          if (skipRe.test(effText) && !triggerRegex?.test(effText)) return
        }
      }
      const base = `${el.tagName}|${effText}|${href}`
      const n = (countByKey.get(base) || 0) + 1
      countByKey.set(base, n)
      // 全局/共享元素（侧边栏、顶部导航等）只在第一次遇到时点击，避免每页重复点击拖慢全量回归
      const isGlobal = scope !== 'dialog' && !!el.closest('nav, aside, header, [role="navigation"], [role="banner"]')
      out.push({ key: `${scope === 'dialog' ? 'dlg|' : ''}${base}|${n}`, index, actionType: classify(el, effText, href), isGlobal })
    })
    return out
  }, {
    selector: CLICKABLE_SELECTOR,
    dialogSel: DIALOG_SELECTOR,
    re: dangerousRe.source,
    triggerSrc: triggerRe?.source || null,
    submitWords: [...(cfg.submitWords || []), ...(cfg.submitWordsEn || [])],
    destructiveWords: [...(cfg.destructiveWords || []), ...(cfg.destructiveWordsEn || [])],
    navWords: [...(cfg.navWords || []), ...(cfg.navWordsEn || [])],
    clickDangerous: cfg.clickDangerous,
    allowIconButtons: cfg.allowIconButtons,
    localeWords: cfg.localeSwitchWords || [],
    scope,
  })
}

// 按 index 定位点击，DOM 错位时按 key 回退
export function clickByIndex(page, pick) {
  return page.evaluate(({ selector, key, index }) => {
    let base = key.slice(0, key.lastIndexOf('|'))
    if (base.startsWith('dlg|')) base = base.slice(4)
    const matchKey = el => {
      const text = (el.innerText || '').trim().replace(/\s+/g, ' ').slice(0, 40)
      const label = (el.getAttribute('aria-label') || el.getAttribute('title') || '').trim().slice(0, 40)
      const href = el.getAttribute('href') || ''
      return `${el.tagName}|${text || label}|${href}` === base
    }
    const els = [...document.querySelectorAll(selector)]
    const el = els[index] && matchKey(els[index]) ? els[index] : els.find(matchKey)
    if (el) el.click()
  }, { selector: CLICKABLE_SELECTOR, key: pick.key, index: pick.index }).catch(() => {})
}

const sleep = ms => new Promise(r => setTimeout(r, ms))

// 等待页面稳定：导航后尝试 networkidle（短超时），否则 load + 短延时
export async function waitSettled(page, cfg, settleOverride, afterNav = false) {
  const state = afterNav ? 'networkidle' : 'load'
  await page.waitForLoadState(state, { timeout: cfg.navWaitMs }).catch(() => {})
  await sleep(settleOverride ?? cfg.settleMs)
}

// 检查并关闭弹窗/下拉（连按 Escape，兼容 Radix 弹窗与自定义下拉）
export async function closeOverlays(page, cfg) {
  try {
    const still = await page.locator(`${DIALOG_VISIBLE_SELECTOR}, [role="menu"]:visible, [role="listbox"]:visible`).count()
    if (still) {
      await page.keyboard.press('Escape').catch(() => {})
      await sleep(cfg.dialogEscMs)
      await page.keyboard.press('Escape').catch(() => {})
      await sleep(cfg.dialogEscMs)
    }
  } catch { /* 页面可能已崩溃 */ }
}

// locale 防护：若页面语言被切成英文，切回中文
export async function ensureZhLocale(page, cfg) {
  try {
    const locale = await page.evaluate(() => {
      try {
        const raw = localStorage.getItem('zhiyu-locale') || localStorage.getItem('locale') || ''
        return raw || document.documentElement.lang || ''
      } catch { return '' }
    })
    if (locale && locale.toLowerCase().startsWith('en')) {
      await page.evaluate(() => {
        try {
          localStorage.setItem('zhiyu-locale', 'zh')
          localStorage.setItem('locale', 'zh')
        } catch { /* ignore */ }
      })
      await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {})
      await waitSettled(page, cfg, 800)
    }
  } catch { /* 忽略 */ }
}

// 弹层可见时收集其内部元素并入队（点击打开弹窗后、Esc 关闭前调用）
async function enqueueDialogItems(page, cfg, dangerousRe, queue, attempted, triggerRe = null) {
  try {
    if (!(await page.locator(DIALOG_VISIBLE_SELECTOR).count())) return
    const dlgItems = await collectClickables(page, cfg, dangerousRe, 'dialog', triggerRe).catch(() => [])
    for (const d of dlgItems) {
      if (!attempted.has(d.key) && !queue.some(q => q.key === d.key)) queue.push(d)
    }
  } catch { /* 页面可能已崩溃 */ }
}

// 表单测试记录写入 routeResult 并返回是否消耗了一次提交额度
function recordFormResult(routeResult, rec) {
  if (!rec) return false
  if (rec.submitStatus === 'none' || rec.submitStatus === 'no-submit-button') {
    if (!rec.filled) return false // 无表单或无提交按钮（搜索区等），不记录
  }
  routeResult.forms.push(rec)
  if (rec.submitStatus === 'error') {
    const api = rec.apiResult
    routeResult.errors.push({ type: 'form', message: `表单提交失败: ${api?.status} ${api?.method} ${api?.url}（触发: ${rec.trigger}）` })
  }
  return ['pass', 'error', 'no-request'].includes(rec.submitStatus)
}

// 单页巡检：队列式点击全部唯一可点元素
export async function walkRoute(page, ctx, route, cfg, role, sink, routeState, token, globalSeen = null) {
  cfg = routeCfg(cfg, route) // per-route 配置覆盖（前缀匹配，最长优先）
  const routeResult = { route, status: 'ok', clicks: 0, actions: [], errors: [], info: [], forms: [] }
  try {
    // 门户 token 被其它应用（partner/superadmin）清除或替换后自动恢复，避免后续页面被踢到登录页或用错身份
    if (token) {
      const tokenKey = tokenKeyForRole(role)
      await page.evaluate(([k, t]) => {
        try {
          const current = localStorage.getItem(k)
          if (current !== t) localStorage.setItem(k, t)
        } catch { /* ignore */ }
      }, [tokenKey, token]).catch(() => {})
    }
    await page.goto(cfg.baseUrl + route, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await waitSettled(page, cfg, undefined, true)
    if (page.url().includes(loginPathForRole(role))) { // 未登录被重定向
      routeResult.status = 'skip'
      return routeResult
    }

    const basePath = new URL(page.url()).pathname
    const dangerousRe = buildDangerousRe(cfg)
    const triggerRe = cfg.testForms ? buildTriggerRe(cfg) : null
    let formAttempts = 0
    const maxForms = cfg.maxFormSubmits || 3
    const formTestedTriggers = new Set() // 同一入口文案只测一次，避免重复耗尽额度
    const attempted = new Set()
    const queue = await collectClickables(page, cfg, dangerousRe, 'page', triggerRe)
    for (let qi = 0; qi < queue.length && routeResult.clicks < cfg.maxClicks; qi++) {
      const pick = queue[qi]
      if (attempted.has(pick.key)) continue
      attempted.add(pick.key)
      // 全局/共享元素（侧边栏、顶部导航等）全量回归只点一次，避免每页重复点击拖慢并压垮后端
      if (pick.isGlobal && globalSeen) {
        if (globalSeen.has(pick.key)) continue
        globalSeen.add(pick.key)
      }
      // 记录当前点击序号与 URL，供错误监听器关联上下文
      routeState.clickIndex = routeResult.clicks
      routeState.url = page.url()
      const pickText = keyText(pick.key)
      const isCreatePage = /\/(add|new)(\/|$)/.test(route)
      if (pick.actionType === 'form-trigger' && isCreatePage && formAttempts < maxForms && !formTestedTriggers.has(pickText)) {
        // 独立创建页：表单已可见，直接填充提交，避免先点空提交。
        // 入口按钮本身就是提交按钮，直接复用该元素点击，避免在 body 里重新搜索被浮层按钮干扰。
        formTestedTriggers.add(pickText)
        const submitClick = () => clickByIndex(page, pick)
        const rec = await maybeTestForm(page, cfg, pickText, submitClick).catch(() => null)
        if (recordFormResult(routeResult, rec)) formAttempts++
        routeResult.clicks++
        routeResult.actions.push({ key: pick.key, index: routeResult.clicks, actionType: pick.actionType })
        await sleep(cfg.clickIntervalMs)
        await closeOverlays(page, cfg)
        await ensureZhLocale(page, cfg)
        continue
      }
      await clickByIndex(page, pick)
      routeResult.clicks++
      routeResult.actions.push({ key: pick.key, index: routeResult.clicks, actionType: pick.actionType })
      await sleep(cfg.clickIntervalMs)
      // 弹层内表单：点击入口后打开弹窗，再填充提交
      if (pick.actionType === 'form-trigger' && formAttempts < maxForms && !formTestedTriggers.has(pickText)) {
        formTestedTriggers.add(pickText)
        const rec = await maybeTestForm(page, cfg, pickText).catch(() => null)
        if (recordFormResult(routeResult, rec)) formAttempts++
      }
      // 点击若打开了弹窗，先把弹窗内元素入队再关闭
      await enqueueDialogItems(page, cfg, dangerousRe, queue, attempted, triggerRe)
      await closeOverlays(page, cfg)
      // 跳转回访
      const nowPath = new URL(page.url()).pathname
      if (nowPath !== basePath && !nowPath.includes(loginPathForRole(role))) {
        await page.goto(cfg.baseUrl + route, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {})
        await waitSettled(page, cfg, 400, true)
      }
      // locale 防护
      await ensureZhLocale(page, cfg)
      // 增量补充
      const fresh = await collectClickables(page, cfg, dangerousRe, 'page', triggerRe).catch(() => [])
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
      routeResult.crashed = true
    }
  }
  // sink 分流：真实错误 vs 信息类（auth/rate-limit/console-warning），预期权限页直接丢弃 auth
  const expectedAuth = (cfg.expectedAuthPages || []).some(x => route.includes(x))
  const hasAuthInfo = sink.some(e => e.type === 'auth' || (e.type === 'console' && /\b401\b|\b403\b/.test(e.message || '')))
  for (const err of sink.splice(0)) {
    if (err.type === 'auth' && expectedAuth) continue
    if (NON_ERROR_TYPES.has(err.type) || err.type === 'console-warning') routeResult.info.push(err)
    else if (err.type === 'console' && err.message === '[app-error] Object' && hasAuthInfo) {
      // 前端对 401/403 的兜底报错（如 reportError(err) 时 err 被序列化为 Object）归为权限信号
      routeResult.info.push({ ...err, type: 'auth' })
    }
    else routeResult.errors.push(err)
  }
  // skip 判定：无权限遮罩页（无点击、无真实错误、但有 401/403 信号）记 skip
  if (routeResult.status !== 'error' && routeResult.clicks === 0
    && routeResult.errors.length === 0 && routeResult.info.some(e => e.type === 'auth')) {
    routeResult.status = 'skip'
  }
  if (routeResult.errors.length) routeResult.status = 'error'
  return routeResult
}
