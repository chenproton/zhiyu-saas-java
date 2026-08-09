/**
 * 页面点击巡检：可点击元素收集、点击、弹窗关闭、跳转回访、增量补充。
 * 含 locale 防护（点击语言切换按钮后自动切回中文，防止危险词失效）。
 */

export const CLICKABLE_SELECTOR = ['button', 'a[href]', '[role="tab"]', '[role="button"]'].join(',')
// 弹层容器：Radix Dialog 是 dialog，AlertDialog（确认删除等）是 alertdialog，两者都必须纳入
export const DIALOG_SELECTOR = '[role="dialog"], [role="alertdialog"], [data-radix-dialog-content]'
export const DIALOG_VISIBLE_SELECTOR = '[role="dialog"]:visible, [role="alertdialog"]:visible'

// 不计入错误的类型（401/403 权限信号、429 限流）
export const NON_ERROR_TYPES = new Set(['auth', 'rate-limit'])

export function buildDangerousRe(cfg) {
  const words = [...(cfg.dangerousWords || []), ...(cfg.dangerousWordsEn || [])]
  return new RegExp(`^(?:${words.map(escapeRe).join('|')})`)
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// 收集可见可点击元素（含文档序 index 与行内序号 key）。
// scope='page'：只收弹层外元素（默认）；scope='dialog'：只收弹层内元素（key 加 dlg| 前缀）。
export async function collectClickables(page, cfg, dangerousRe, scope = 'page') {
  return page.evaluate(({ selector, dialogSel, re, clickDangerous, allowIconButtons, localeWords, scope }) => {
    const skipRe = new RegExp(re)
    const localeRe = new RegExp(`^(?:${localeWords.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})$`)
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
          if (skipRe.test(effText)) return
          if (localeRe.test(effText)) return // 语言切换按钮：点击会改变全局语言，跳过
        }
      }
      const base = `${el.tagName}|${effText}|${href}`
      const n = (countByKey.get(base) || 0) + 1
      countByKey.set(base, n)
      out.push({ key: `${scope === 'dialog' ? 'dlg|' : ''}${base}|${n}`, index })
    })
    return out
  }, {
    selector: CLICKABLE_SELECTOR,
    dialogSel: DIALOG_SELECTOR,
    re: dangerousRe.source,
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

// 检查并关闭弹窗/下拉
export async function closeOverlays(page, cfg) {
  try {
    if (await page.locator(`${DIALOG_VISIBLE_SELECTOR}, [role="menu"]:visible`).count()) {
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
async function enqueueDialogItems(page, cfg, dangerousRe, queue, attempted) {
  try {
    if (!(await page.locator(DIALOG_VISIBLE_SELECTOR).count())) return
    const dlgItems = await collectClickables(page, cfg, dangerousRe, 'dialog').catch(() => [])
    for (const d of dlgItems) {
      if (!attempted.has(d.key) && !queue.some(q => q.key === d.key)) queue.push(d)
    }
  } catch { /* 页面可能已崩溃 */ }
}

// 单页巡检：队列式点击全部唯一可点元素
export async function walkRoute(page, ctx, route, cfg, role, sink, routeState) {
  const routeResult = { route, status: 'ok', clicks: 0, actions: [], errors: [], info: [] }
  try {
    await page.goto(cfg.baseUrl + route, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await waitSettled(page, cfg, undefined, true)
    if (page.url().includes('/portal/login')) { // 未登录被重定向
      routeResult.status = 'skip'
      return routeResult
    }

    const basePath = new URL(page.url()).pathname
    const dangerousRe = buildDangerousRe(cfg)
    const attempted = new Set()
    const queue = await collectClickables(page, cfg, dangerousRe)
    for (let qi = 0; qi < queue.length && routeResult.clicks < cfg.maxClicks; qi++) {
      const pick = queue[qi]
      if (attempted.has(pick.key)) continue
      attempted.add(pick.key)
      // 记录当前点击序号与 URL，供错误监听器关联上下文
      routeState.clickIndex = routeResult.clicks
      routeState.url = page.url()
      await clickByIndex(page, pick)
      routeResult.clicks++
      routeResult.actions.push({ key: pick.key, index: routeResult.clicks })
      await sleep(cfg.clickIntervalMs)
      // 点击若打开了弹窗，先把弹窗内元素入队再关闭
      await enqueueDialogItems(page, cfg, dangerousRe, queue, attempted)
      await closeOverlays(page, cfg)
      // 跳转回访
      const nowPath = new URL(page.url()).pathname
      if (nowPath !== basePath && !nowPath.includes('/portal/login')) {
        await page.goto(cfg.baseUrl + route, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {})
        await waitSettled(page, cfg, 400, true)
      }
      // locale 防护
      await ensureZhLocale(page, cfg)
      // 增量补充
      const fresh = await collectClickables(page, cfg, dangerousRe).catch(() => [])
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
  // sink 分流：真实错误 vs 信息类（auth/rate-limit），预期权限页直接丢弃 auth
  const expectedAuth = (cfg.expectedAuthPages || []).some(x => route.includes(x))
  for (const err of sink.splice(0)) {
    if (err.type === 'auth' && expectedAuth) continue
    if (NON_ERROR_TYPES.has(err.type)) routeResult.info.push(err)
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
