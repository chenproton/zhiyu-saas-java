/**
 * 页面点击巡检：可点击元素收集、点击、弹窗关闭、跳转回访、增量补充。
 * 含 locale 防护（点击语言切换按钮后自动切回中文，防止危险词失效）。
 * 默认模式下会测试 CRUD 按钮（创建/编辑/删除/启用/禁用），--click-only 退回到纯点击。
 */

import { maybeTestForm, buildTriggerRe, keyText } from './forms.mjs'

export const CLICKABLE_SELECTOR = ['button', 'a[href]', '[role="tab"]', '[role="button"]'].join(',')
// 弹层容器：Radix Dialog 是 dialog，AlertDialog（确认删除等）是 alertdialog，两者都必须纳入
export const DIALOG_SELECTOR = '[role="dialog"], [role="alertdialog"], [data-radix-dialog-content]'
export const DIALOG_VISIBLE_SELECTOR = '[role="dialog"]:visible, [role="alertdialog"]:visible'

// 表单字段选择器（与 forms.mjs 保持一致，避免循环依赖）
const FIELD_SELECTOR = 'input, textarea, select, [role="combobox"]'

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

export function buildEditRe(cfg) {
  return wordRe([...(cfg.editWords || []), ...(cfg.editWordsEn || [])])
}

export function buildDeleteRe(cfg) {
  return wordRe([...(cfg.deleteWords || []), ...(cfg.deleteWordsEn || [])])
}

export function buildEnableRe(cfg) {
  return wordRe([...(cfg.enableWords || []), ...(cfg.enableWordsEn || [])])
}

export function buildDisableRe(cfg) {
  return wordRe([...(cfg.disableWords || []), ...(cfg.disableWordsEn || [])])
}

function wordRe(words) {
  if (!words.length) return { test: () => false }
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
// crud 模式下额外识别 edit/delete/enable/disable，并标注元素所在行是否含 SMOKE_ 标记。
export async function collectClickables(page, cfg, dangerousRe, scope = 'page', triggerRe = null) {
  const crudMode = !cfg.clickOnly
  return page.evaluate(({ selector, dialogSel, re, triggerSrc, submitWords, destructiveWords, navWords, clickDangerous, allowIconButtons, localeWords, scope, crudMode, editSrc, deleteSrc, enableSrc, disableSrc, marker, maxRowClicks }) => {
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
    const editRe = crudMode && editSrc ? new RegExp(editSrc) : { test: () => false }
    const deleteRe = crudMode && deleteSrc ? new RegExp(deleteSrc) : { test: () => false }
    const enableRe = crudMode && enableSrc ? new RegExp(enableSrc) : { test: () => false }
    const disableRe = crudMode && disableSrc ? new RegExp(disableSrc) : { test: () => false }
    const rowSel = 'tr, li, [role="listitem"], [role="row"]'
    const cardSel = 'article, [class*="card"], [class*="Card"]'
    // 动作分类：CRUD 动作 > 危险删除类 > 弹层内提交 > 页面级表单入口 > 导航
    const classify = (el, effText, href) => {
      if (effText) {
        if (crudMode) {
          if (editRe.test(effText)) return 'edit'
          if (deleteRe.test(effText)) return 'delete'
          if (enableRe.test(effText)) return 'enable'
          if (disableRe.test(effText)) return 'disable'
        }
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
    // 判定元素所在"数据行"是否含 SMOKE_ 标记：
    // 优先行级容器（tr/li/row/listitem）；卡片容器仅在内部不含表格/列表时使用，
    // 防止整页大卡片容器把"任一 SMOKE_ 行"扩散成"全部行都是 SMOKE_"
    const rowOf = el => {
      const rowEl = el.closest(rowSel)
      if (rowEl) return rowEl
      const cardEl = el.closest(cardSel)
      if (cardEl && !cardEl.querySelector('table, tr, li, [role="row"]')) return cardEl
      return null
    }
    const countByKey = new Map()
    const out = []
    // 行内按钮去重：rowsByType[类型] = 已收录的行序号集合（上限 maxRowClicks）
    const rowsByType = new Map()
    const rowSeq = new Map()
    let rowSeqCounter = 0
    const seqFor = row => {
      if (!rowSeq.has(row)) rowSeq.set(row, rowSeqCounter++)
      return rowSeq.get(row)
    }
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
          if (skipRe.test(effText) && !triggerRegex?.test(effText)) {
            // CRUD 模式下，编辑/删除/启用/禁用/表单入口即使命中危险词也放行
            const action = classify(el, effText, href)
            if (!crudMode || !['edit', 'delete', 'enable', 'disable', 'form-trigger'].includes(action)) return
          }
        }
      }
      const base = `${el.tagName}|${effText}|${href}`
      const row = rowOf(el)
      // 列表行内按钮去重提速：同一按钮类型只保留前 maxRowClicks 行的实例。
      // 类型键不含 href——行内"查看/详情"链接的 href 每行不同，若带 href 则去重失效。
      if (row && maxRowClicks >= 0) {
        const typeKey = `${el.tagName}|${effText}`
        let seen = rowsByType.get(typeKey)
        if (!seen) {
          seen = new Set()
          rowsByType.set(typeKey, seen)
        }
        const rowKey = seqFor(row)
        const isSmokeRow = !!(marker && (row.innerText || '').includes(marker))
        if (seen.size >= maxRowClicks && !seen.has(rowKey) && !isSmokeRow) return
        seen.add(rowKey)
      }
      const n = (countByKey.get(base) || 0) + 1
      countByKey.set(base, n)
      // 全局/共享元素（侧边栏、顶部导航等）只在第一次遇到时点击，避免每页重复点击拖慢全量回归
      const isGlobal = scope !== 'dialog' && !!el.closest('nav, aside, header, [role="navigation"], [role="banner"]')
      const inSmokeRow = !!(marker && row && (row.innerText || '').includes(marker))
      out.push({ key: `${scope === 'dialog' ? 'dlg|' : ''}${base}|${n}`, index, actionType: classify(el, effText, href), isGlobal, inSmokeRow })
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
    crudMode,
    editSrc: buildEditRe(cfg).source,
    deleteSrc: buildDeleteRe(cfg).source,
    enableSrc: buildEnableRe(cfg).source,
    disableSrc: buildDisableRe(cfg).source,
    marker: cfg.crudMarker || '',
    maxRowClicks: cfg.maxRowClicks ?? 1,
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
function recordFormResult(routeResult, rec, actionType = 'create') {
  if (!rec) return false
  if (rec.submitStatus === 'none' || rec.submitStatus === 'no-submit-button') {
    if (!rec.filled) return false // 无表单或无提交按钮（搜索区等），不记录
  }
  routeResult.forms.push(rec)
  if (rec.submitStatus === 'error') {
    const api = rec.apiResult
    routeResult.errors.push({ type: 'form', message: `表单提交失败: ${api?.status} ${api?.method} ${api?.url}（触发: ${rec.trigger}）` })
  }
  // CRUD 统计
  routeResult.crudActions.push({
    action: actionType,
    target: rec.trigger,
    status: rec.submitStatus === 'pass' ? 'pass' : rec.submitStatus === 'error' ? 'error' : 'skip',
    apiResult: rec.apiResult,
    createdId: rec.createdId,
  })
  if (rec.createdId) {
    if (!routeResult.createdIds) routeResult.createdIds = []
    routeResult.createdIds.push(rec.createdId)
  }
  return ['pass', 'error', 'no-request'].includes(rec.submitStatus)
}

// 处理 CRUD 编辑/删除/启用/禁用动作（点击已由调用方完成）。
// 编辑：弹窗或页面内出现表单时调用 maybeTestForm 修改并提交。
// 删除/启用/禁用：等待确认弹窗，点击确认，等待写接口响应。
async function handleCrudAction(page, cfg, pick, pickText) {
  await sleep(cfg.dialogEscMs)

  if (pick.actionType === 'edit') {
    // 若点击后进入编辑表单（弹窗或编辑页），执行编辑填充
    const hasDialog = await page.locator(DIALOG_VISIBLE_SELECTOR).count() > 0
    const hasForm = await page.locator('form:visible').count() > 0 || await page.evaluate(() => !!document.querySelector('main input, article input'))
    if (!hasDialog && !hasForm) return { action: 'edit', target: pickText, status: 'skip', reason: '未进入编辑表单' }
    const rec = await maybeTestForm(page, cfg, pickText, null, { isEdit: true }).catch(() => null)
    if (!rec) return { action: 'edit', target: pickText, status: 'skip', reason: '未识别到编辑表单' }
    return {
      action: 'edit',
      target: pickText,
      status: rec.submitStatus === 'pass' ? 'pass' : rec.submitStatus === 'error' ? 'error' : 'skip',
      apiResult: rec.apiResult,
      createdId: rec.createdId,
    }
  }

  // 删除/启用/禁用：等待确认弹窗并点击确认
  const dialogOpen = await page.locator(DIALOG_VISIBLE_SELECTOR).count() > 0
  if (!dialogOpen) return { action: pick.actionType, target: pickText, status: 'skip', reason: '无确认弹窗' }

  const submitWords = [...(cfg.submitWords || []), ...(cfg.submitWordsEn || [])]
  const submitRe = submitWords.length ? new RegExp(`^(?:${submitWords.map(s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`) : { test: () => false }
  const destructiveWords = [...(cfg.destructiveWords || []), ...(cfg.destructiveWordsEn || []), ...(cfg.deleteWords || []), ...(cfg.deleteWordsEn || []), ...(cfg.enableWords || []), ...(cfg.enableWordsEn || []), ...(cfg.disableWords || []), ...(cfg.disableWordsEn || [])]
  const destructiveRe = destructiveWords.length ? new RegExp(`^(?:${destructiveWords.map(s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`) : { test: () => false }

  let confirmed = false
  try {
    const buttons = page.locator(DIALOG_VISIBLE_SELECTOR).locator('button:visible')
    const n = await buttons.count()
    for (let i = 0; i < n; i++) {
      const text = ((await buttons.nth(i).innerText().catch(() => '')) || '').trim()
      if (submitRe.test(text) || destructiveRe.test(text)) {
        await buttons.nth(i).click({ timeout: 2000 })
        confirmed = true
        break
      }
    }
  } catch { /* ignore */ }
  if (!confirmed) return { action: pick.actionType, target: pickText, status: 'skip', reason: '未找到确认按钮' }

  // 等待写接口响应（DELETE/PATCH/PUT）
  try {
    const res = await page.waitForResponse(
      r => ['DELETE', 'PATCH', 'PUT'].includes(r.request().method()) && r.url().includes('/api/'),
      { timeout: 8000 },
    )
    const status = res.status()
    return {
      action: pick.actionType,
      target: pickText,
      status: status < 400 ? 'pass' : 'error',
      apiResult: { status, method: res.request().method(), url: res.url().replace(cfg.baseUrl, '') },
    }
  } catch {
    return { action: pick.actionType, target: pickText, status: 'skip', reason: '未捕获到写接口响应' }
  }
}

// 判断当前编辑页的实体是否为巡检创建的 SMOKE_ 测试数据：
// 取页面上名称/标题类输入框的现值，非空且不以 SMOKE_ 开头 → 真实实体，禁止填充提交
export async function isSmokeEntityPage(page, cfg) {  const marker = cfg.crudMarker || 'SMOKE_'
  try {
    return await page.evaluate(({ fieldSel, marker }) => {
      const visible = el => el.offsetParent !== null || el.getClientRects().length > 0
      const scope = [...document.querySelectorAll('form')].find(visible)
        || document.querySelector('main')
        || document.querySelector('article')
        || document.body
        || null
      if (!scope) return true
      const els = [...scope.querySelectorAll(fieldSel)]
      let seenNameField = false
      for (const el of els) {
        if (!visible(el) || el.disabled) continue
        const id = el.id
        let label = ''
        if (id) label = scope.querySelector(`label[for="${id}"]`)?.innerText || ''
        if (!label && el.labels?.length) label = el.labels[0].innerText || ''
        if (!label) label = el.getAttribute('aria-label') || el.getAttribute('placeholder') || ''
        const hint = `${el.name || ''} ${label}`.toLowerCase()
        if (!/名称|标题|姓名|名字|\bname\b|\btitle\b|\bcode\b|编码|代号/.test(hint)) continue
        seenNameField = true
        const value = (el.value || '').trim()
        if (value && !value.startsWith(marker)) return false // 真实实体，跳过
      }
      // 无名称类字段（如纯配置页）或名称字段为空/已是 SMOKE_：允许表单测试
      return true
    }, { fieldSel: FIELD_SELECTOR, marker })
  } catch {
    return false // 页面异常时保守跳过表单测试
  }
}

// 点击前复核：CRUD 行操作（编辑/删除/启用/禁用）的目标按钮所在行，
// 在点击瞬间仍必须包含 SMOKE_ 标记。防止表内数据变化（如删除后 DOM 前移、
// 分页刷新）导致按 index 误命中真实数据行（曾批量误禁用真实账户）。
export async function isSmokeRowAtClick(page, cfg, pick) {
  const marker = cfg.crudMarker || 'SMOKE_'
  try {
    return await page.evaluate(({ selector, key, index, marker }) => {
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
      if (!el) return false
      const rowSel = 'tr, li, [role="listitem"], [role="row"]'
      const cardSel = 'article, [class*="card"], [class*="Card"]'
      const rowEl = el.closest(rowSel)
      const cardEl = el.closest(cardSel)
      const row = rowEl || (cardEl && !cardEl.querySelector('table, tr, li, [role="row"]') ? cardEl : null)
      return !!(row && (row.innerText || '').includes(marker))
    }, { selector: CLICKABLE_SELECTOR, key: pick.key, index: pick.index, marker })
  } catch {
    return false // 页面异常时保守跳过（不点击）
  }
}

// 单页巡检：队列式点击全部唯一可点元素
export async function walkRoute(page, ctx, route, cfg, role, sink, routeState, token, globalSeen = null) {
  cfg = routeCfg(cfg, route) // per-route 配置覆盖（前缀匹配，最长优先）
  const routeResult = { route, status: 'ok', clicks: 0, actions: [], errors: [], info: [], forms: [], crudActions: [], createdIds: [] }
  const crudDisabled = !cfg.clickOnly && (cfg.crudExcludeRoutes || []).some(r => route.includes(r))
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
    const triggerRe = cfg.clickOnly ? null : buildTriggerRe(cfg)
    const maxForms = cfg.maxFormSubmits || 3
    let formAttempts = 0

    // 独立编辑页：表单已可见，直接填充提交（仅限巡检创建的 SMOKE_ 实体，真实数据不碰）
    const isEditPage = /\/(edit|modify)(\/|$)/.test(route)
    if (!cfg.clickOnly && !crudDisabled && isEditPage) {
      const hasForm = await page.locator('form:visible').count() > 0 || await page.evaluate(() => !!document.querySelector('main input, article input'))
      if (hasForm && formAttempts < maxForms) {
        if (await isSmokeEntityPage(page, cfg)) {
          const rec = await maybeTestForm(page, cfg, '(编辑页)', null, { isEdit: true }).catch(() => null)
          if (recordFormResult(routeResult, rec, 'edit')) formAttempts++
        } else {
          routeResult.crudActions.push({ action: 'edit', target: '(编辑页)', status: 'skip', reason: '非 SMOKE_ 实体，不填充提交' })
        }
      }
    }
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
      // CRUD 行操作点击前复核：目标行必须仍是 SMOKE_ 测试数据。
      // 防止删除/翻页后 DOM 前移，按 index 误命中真实数据行（曾批量误禁用真实账户）。
      if (!cfg.clickOnly && !crudDisabled && ['edit', 'delete', 'enable', 'disable'].includes(pick.actionType)) {
        const stillSmoke = await isSmokeRowAtClick(page, cfg, pick).catch(() => false)
        if (!stillSmoke) {
          routeResult.crudActions.push({ action: pick.actionType, target: pickText, status: 'skip', reason: '点击前校验：行已变化或非 SMOKE_ 测试数据' })
          await closeOverlays(page, cfg)
          continue
        }
      }
      await clickByIndex(page, pick)
      routeResult.clicks++
      routeResult.actions.push({ key: pick.key, index: routeResult.clicks, actionType: pick.actionType })
      await sleep(cfg.clickIntervalMs)
      // 弹层内表单：点击入口后打开弹窗，再填充提交
      if (pick.actionType === 'form-trigger' && formAttempts < maxForms && !formTestedTriggers.has(pickText)) {
        formTestedTriggers.add(pickText)
        const rec = await maybeTestForm(page, cfg, pickText).catch(() => null)
        if (recordFormResult(routeResult, rec, 'create')) formAttempts++
      }
      // CRUD 编辑/删除/启用/禁用
      if (!cfg.clickOnly && !crudDisabled && ['edit', 'delete', 'enable', 'disable'].includes(pick.actionType)) {
        if (!pick.inSmokeRow) {
          routeResult.crudActions.push({ action: pick.actionType, target: pickText, status: 'skip', reason: '非 SMOKE_ 测试数据' })
        } else if (formAttempts < maxForms && !formTestedTriggers.has(`crud:${pickText}`)) {
          formTestedTriggers.add(`crud:${pickText}`)
          const rec = await handleCrudAction(page, cfg, pick, pickText).catch(() => null)
          if (rec) {
            routeResult.crudActions.push(rec)
            if (rec.createdId) routeResult.createdIds.push(rec.createdId)
            if (rec.status === 'error' && rec.apiResult) {
              routeResult.errors.push({ type: 'crud', message: `${rec.action} 操作失败: ${rec.apiResult.status} ${rec.apiResult.method} ${rec.apiResult.url}（触发: ${rec.target}）` })
            }
            if (rec.action === 'edit' && ['pass', 'error', 'no-request'].includes(rec.status)) formAttempts++
          }
        }
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
