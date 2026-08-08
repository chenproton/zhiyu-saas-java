/**
 * 页面点击巡检：可点击元素收集、点击、弹窗关闭、跳转回访、增量补充。
 * 含 locale 防护（点击语言切换按钮后自动切回中文，防止危险词失效）。
 */

export const CLICKABLE_SELECTOR = ['button', 'a[href]', '[role="tab"]', '[role="button"]'].join(',')

export function buildDangerousRe(cfg) {
  const words = [...(cfg.dangerousWords || []), ...(cfg.dangerousWordsEn || [])]
  return new RegExp(`^(?:${words.map(escapeRe).join('|')})`)
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// 收集可见可点击元素（含文档序 index 与行内序号 key）
export async function collectClickables(page, cfg, dangerousRe) {
  return page.evaluate(({ selector, re, clickDangerous, localeWords }) => {
    const skipRe = new RegExp(re)
    const localeRe = new RegExp(`^(?:${localeWords.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})$`)
    const countByKey = new Map()
    const out = []
    const els = [...document.querySelectorAll(selector)]
    els.forEach((el, index) => {
      const rect = el.getBoundingClientRect()
      if (rect.width < 4 || rect.height < 4) return
      const cs = getComputedStyle(el)
      if (cs.visibility === 'hidden' || cs.display === 'none') return
      if (el.disabled || el.getAttribute('aria-disabled') === 'true') return
      if (el.closest('[role="dialog"], [data-radix-dialog-content]')) return
      const href = el.getAttribute('href') || ''
      if (el.tagName === 'A' && href && !href.startsWith('/')) return
      const text = (el.innerText || '').trim().replace(/\s+/g, ' ').slice(0, 40)
      if (text && !clickDangerous) {
        if (skipRe.test(text)) return
        if (localeRe.test(text)) return // 语言切换按钮：点击会改变全局语言，跳过
      }
      const base = `${el.tagName}|${text}|${href}`
      const n = (countByKey.get(base) || 0) + 1
      countByKey.set(base, n)
      out.push({ key: `${base}|${n}`, index })
    })
    return out
  }, {
    selector: CLICKABLE_SELECTOR,
    re: dangerousRe.source,
    clickDangerous: cfg.clickDangerous,
    localeWords: cfg.localeSwitchWords || [],
  })
}

// 按 index 定位点击，DOM 错位时按 key 回退
export function clickByIndex(page, pick) {
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
  }, { selector: CLICKABLE_SELECTOR, key: pick.key, index: pick.index }).catch(() => {})
}

const sleep = ms => new Promise(r => setTimeout(r, ms))

// 等待页面稳定：networkidle + 短延时
export async function waitSettled(page, cfg, settleOverride) {
  await page.waitForLoadState('networkidle', { timeout: cfg.navWaitMs }).catch(() => {})
  await sleep(settleOverride ?? cfg.settleMs)
}

// 检查并关闭弹窗/下拉
export async function closeOverlays(page, cfg) {
  try {
    if (await page.locator('[role="dialog"]:visible, [role="menu"]:visible').count()) {
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

// 单页巡检：队列式点击全部唯一可点元素
export async function walkRoute(page, ctx, route, cfg, role, sink, routeState) {
  const routeResult = { route, status: 'ok', clicks: 0, actions: [], errors: [] }
  try {
    await page.goto(cfg.baseUrl + route, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await waitSettled(page, cfg)
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
      await closeOverlays(page, cfg)
      // 跳转回访
      const nowPath = new URL(page.url()).pathname
      if (nowPath !== basePath && !nowPath.includes('/portal/login')) {
        await page.goto(cfg.baseUrl + route, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {})
        await waitSettled(page, cfg, 400)
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

    // skip 判定升级：无权限遮罩页（无点击且错误全为 401/403）记 skip
    const authish = routeResult.errors.filter(e => e.type === 'api' && /^4(01|03)/.test(e.message))
    if (routeResult.clicks === 0 && routeResult.errors.length > 0 && authish.length === routeResult.errors.filter(e => e.type === 'api').length) {
      routeResult.status = 'skip'
      routeResult.errors = []
    }
  } catch (e) {
    routeResult.status = 'error'
    routeResult.errors.push({ type: 'page', message: `页面巡检失败: ${e.message}` })
    if (/crash|target closed/i.test(e.message || '')) {
      routeResult.crashed = true
    }
  }
  for (const err of sink.splice(0)) {
    routeResult.errors.push(err)
  }
  if (routeResult.errors.length) routeResult.status = 'error'
  return routeResult
}
