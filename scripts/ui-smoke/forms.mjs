/**
 * 表单自动填充 + 提交测试（默认启用，--click-only 时跳过）。
 * 启发式识别表单，按字段类型填充，点击提交按钮，以写接口响应判定 pass/error。
 * 提交成功的数据统一带 SMOKE_ 前缀，由 cleanupSmokeData 在巡检结束后清理。
 */

const DIALOG_VISIBLE = '[role="dialog"]:visible, [role="alertdialog"]:visible' // playwright locator 专用
const DIALOG_ANY = '[role="dialog"], [role="alertdialog"]' // 原生 querySelector 用（无 :visible 伪类）
const FIELD_SELECTOR = 'input, textarea, select, [role="combobox"]'

const sleep = ms => new Promise(r => setTimeout(r, ms))

// 从收集 key（TAG|text|href|n，可带 dlg| 前缀）提取按钮文本
export function keyText(key) {
  let base = key
  if (base.startsWith('dlg|')) base = base.slice(4)
  const parts = base.split('|')
  return parts[1] || ''
}

export function buildTriggerRe(cfg) {
  const words = [...(cfg.formTriggerWords || []), ...(cfg.formTriggerWordsEn || [])]
  if (!words.length) return null
  // 支持 "+ 新建"、"新建教师" 等带前缀/后缀的文案
  return new RegExp(words.map(escapeRe).join('|'))
}

export function buildSubmitRe(cfg) {
  const words = [...(cfg.submitWords || []), ...(cfg.submitWordsEn || [])]
  return new RegExp(`^(?:${words.map(escapeRe).join('|')})`)
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// 按字段特征生成填充值（纯函数，便于测试）
export function valueForField(field, rand) {
  const hint = `${field.name} ${field.label} ${field.placeholder || ''}`.toLowerCase()
  const t = (field.type || '').toLowerCase()
  if (t === 'email' || /email|邮箱/.test(hint)) return `smoke_${rand}@test.local`
  if (t === 'tel' || /phone|tel|手机|电话/.test(hint)) return '13800000000'
  if (t === 'number') return '1'
  if (t === 'date') return new Date().toISOString().slice(0, 10)
  if (t === 'url') return 'https://smoke.test'
  if (t === 'password') return 'Smoke123456'
  if (/编码|代号|\bcode\b/.test(hint)) return `SMOKE${rand}`.toUpperCase()
  if (/名称|标题|姓名|名字|\bname\b|\btitle\b/.test(hint)) return `SMOKE_测试${rand}`
  if (/描述|备注|简介|说明|desc|remark|note/.test(hint)) return `SMOKE_自动巡检描述 ${rand}`
  return `SMOKE_${rand}`
}

// 在指定容器内枚举可填充字段（可见、非禁用、未填写）
async function enumerateFields(page) {
  return page.evaluate(({ fieldSel, dialogAny }) => {
    const visible = el => el.offsetParent !== null || el.getClientRects().length > 0
    const scope = [...document.querySelectorAll(dialogAny)].find(visible)
      || [...document.querySelectorAll('form')].find(visible)
      || document.querySelector('main')
      || document.querySelector('article')
      || document.body
      || null
    if (!scope) return { found: false, fields: [], skipped: [], inDialog: false }
    const fields = []
    const skipped = []
    const els = [...scope.querySelectorAll(fieldSel)]
    els.forEach((el, index) => {
      const rect = el.getBoundingClientRect()
      if (rect.width < 4 || rect.height < 4) return
      if (el.disabled || el.getAttribute('aria-disabled') === 'true') return
      const tag = el.tagName.toLowerCase()
      const type = (el.getAttribute('type') || (tag === 'input' ? 'text' : tag)).toLowerCase()
      if (['hidden', 'submit', 'button', 'reset', 'file'].includes(type)) {
        if (type === 'file') skipped.push('file-upload')
        return
      }
      // 关联文本：label > aria-label > placeholder
      let label = ''
      const id = el.id
      if (id) label = scope.querySelector(`label[for="${id}"]`)?.innerText || ''
      if (!label && el.labels?.length) label = el.labels[0].innerText || ''
      if (!label) label = el.getAttribute('aria-label') || el.getAttribute('placeholder') || ''
      const name = el.name || el.getAttribute('name') || ''
      const role = el.getAttribute('role') || ''
      const value = (el.value || '').trim()
      const required = el.required || el.getAttribute('aria-required') === 'true' || /\*|必填/.test(label)
      fields.push({ index, tag, type, name, label: label.slice(0, 30), role, empty: !value, required })
    })
    // 富文本检测
    if (scope.querySelector('[contenteditable="true"]')) skipped.push('richtext')
    return { found: fields.length >= 2, fields, skipped, inDialog: ![...document.querySelectorAll('form')].includes(scope) }
  }, { fieldSel: FIELD_SELECTOR, dialogAny: DIALOG_ANY })
}

// 填充文本类字段（React 受控组件需走 native setter + input 事件）
async function fillTextFields(page, fields, rand) {
  return page.evaluate(({ fields, rand, dialogAny, fieldSel }) => {
    const visible = el => el.offsetParent !== null || el.getClientRects().length > 0
    const scope = [...document.querySelectorAll(dialogAny)].find(visible)
      || [...document.querySelectorAll('form')].find(visible)
      || document.querySelector('main')
      || document.querySelector('article')
      || document.body
      || null
    if (!scope) return 0
    const els = scope.querySelectorAll(fieldSel)
    const setReactValue = (el, value) => {
      const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
      const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set
      if (setter) setter.call(el, value)
      else el.value = value
      el.focus()
      el.dispatchEvent(new Event('input', { bubbles: true }))
      el.dispatchEvent(new Event('change', { bubbles: true }))
      el.blur()
    }
    let filled = 0
    for (const f of fields) {
      const el = els[f.index]
      if (!el) continue
      setReactValue(el, f.value)
      filled++
    }
    return filled
  }, { fields, rand, dialogAny: DIALOG_ANY, fieldSel: FIELD_SELECTOR })
}

// 填充 select / combobox / radio（需要真实点击，走 playwright）
async function fillChoiceFields(page, fields, cfg) {
  let filled = 0
  const skipped = []
  const scopeLoc = page.locator(`${DIALOG_VISIBLE}, form:visible`).last()
  for (const f of fields) {
    try {
      if (f.tag === 'select') {
        const sel = scopeLoc.locator('select:visible').nth(f.selectIndex)
        const val = await sel.evaluate(el => {
          const opt = [...el.options].find(o => o.value && !o.disabled)
          return opt ? opt.value : null
        })
        if (val == null) { skipped.push(f.label || f.name || 'select'); continue }
        await sel.selectOption(val)
        filled++
      } else if (f.role === 'combobox') {
        const box = scopeLoc.locator('[role="combobox"]:visible').nth(f.comboIndex)
        await box.click({ timeout: 2000 })
        await sleep(cfg.dialogEscMs)
        // 过滤占位选项（请选择 / Select / Choose / 全部 / - 等）
        const opts = page.locator('[role="option"]:visible')
        const n = await opts.count()
        let clicked = false
        const placeholderRe = /^(请选择|选择|全部|Select|Choose|All|-|—)$/i
        for (let i = 0; i < n; i++) {
          const text = ((await opts.nth(i).innerText().catch(() => '')) || '').trim()
          if (!text || placeholderRe.test(text)) continue
          await opts.nth(i).click({ timeout: 2000 })
          clicked = true
          break
        }
        if (!clicked) {
          skipped.push(f.label || f.name || 'combobox')
          await page.keyboard.press('Escape').catch(() => {})
          continue
        }
        filled++
      } else if (f.type === 'radio') {
        // 同名组选第一个
        const radio = scopeLoc.locator(`input[type="radio"][name="${f.name}"]`).first()
        await radio.check({ timeout: 2000 }).catch(async () => {
          // 自研 radio：尝试点击
          await radio.click({ timeout: 1500 }).catch(() => {})
        })
        filled++
      }
    } catch {
      skipped.push(f.label || f.name || f.type)
    }
  }
  return { filled, skipped }
}

// 找提交按钮：表单/弹层内优先；无表单时扩大到 main/article/body。
// 按文本匹配 submitRe，而不是按 type=submit，避免把“返回”等按钮误判为提交。
// 过滤掉浮层菜单/下拉列表里的按钮（它们会盖住主表单提交按钮）。
async function findSubmitButton(page, submitRe, preferredText = null) {
  const scopeSel = `${DIALOG_VISIBLE}, form:visible, main:visible, article:visible, body`
  const scopes = page.locator(scopeSel)
  const scopeCount = await scopes.count()
  const candidates = []
  for (let s = scopeCount - 1; s >= 0; s--) {
    const inScope = scopes.nth(s)
    const buttons = inScope.locator('button:visible')
    const n = await buttons.count()
    for (let i = 0; i < n; i++) {
      const btn = buttons.nth(i)
      const text = ((await btn.innerText().catch(() => '')) || '').trim()
      if (!text || !submitRe.test(text)) continue
      // 跳过下拉/菜单里的按钮
      const inFloat = await btn.evaluate(el => !!el.closest('[role="menu"], [role="listbox"], [role="option"], [data-radix-popper-content-wrapper]')).catch(() => false)
      if (inFloat) continue
      candidates.push({ btn, text, preferred: preferredText && text === preferredText })
    }
  }
  if (!candidates.length) return null
  // 优先使用与入口文案完全一致的按钮（如创建页本身就是提交按钮）
  const exact = candidates.find(c => c.preferred)
  return exact ? exact.btn : candidates[0].btn
}

/**
 * 尝试对当前页面/弹窗中的表单执行 填充→提交→判定。
 * 返回表单测试记录（写入 routeResult.forms），无表单返回 null。
 */
export async function maybeTestForm(page, cfg, triggerText, submitClick = null, opts = {}) {
  // 表单（尤其是弹层/创建页）可能需要短暂时间完成挂载
  await sleep(1000)
  const rand = Math.random().toString(36).slice(2, 8)
  const rec = { trigger: triggerText || '(页面内表单)', filled: 0, skippedFields: [], submitStatus: 'none', apiResult: null, createdId: null }

  const meta = await enumerateFields(page).catch(() => null)
  if (!meta || !meta.found) return null
  rec.skippedFields.push(...meta.skipped)

  const submitRe = buildSubmitRe(cfg)
  const submitBtn = submitClick ? null : await findSubmitButton(page, submitRe, triggerText)
  if (!submitClick && !submitBtn) {
    rec.submitStatus = 'no-submit-button'
    return rec // 有字段但没有提交按钮（如搜索区），不算错误
  }

  // 必填与空字段拆分：空文本字段全部填充，下拉/单选仅填必填或空值
  // select/combobox 的序号基于全部字段统计（跳过已有值的字段不影响定位）
  const skipFields = cfg.skipFormFields || []
  const textFields = []
  const choiceFields = []
  let selectIdx = 0
  let comboIdx = 0
  const isEdit = !!opts.isEdit
  for (const f of meta.fields) {
    if (f.tag === 'select') f.selectIndex = selectIdx++
    else if (f.role === 'combobox') f.comboIndex = comboIdx++
    if (skipFields.some(s => s && `${f.name} ${f.label}`.includes(s))) {
      rec.skippedFields.push(f.label || f.name || f.type)
      continue
    }
    const hint = `${f.name} ${f.label}`.toLowerCase()
    const isNameLike = /名称|标题|姓名|名字|\bname\b|\btitle\b|\bcode\b|编码|代号/.test(hint)
    // 编辑模式下，名称/标题/编码类字段需要更新为新 SMOKE_ 值，避免重复提交无变化；其他已有值字段不动
    const shouldFill = f.empty || (isEdit && isNameLike)
    if (!shouldFill) continue
    if (f.tag === 'select' || f.role === 'combobox' || f.type === 'radio') { choiceFields.push(f); continue }
    if (f.type === 'checkbox') continue // 复选框默认不动
    textFields.push({ index: f.index, value: valueForField(f, rand) })
  }
  if (textFields.length) rec.filled += await fillTextFields(page, textFields, rand).catch(() => 0)
  if (choiceFields.length) {
    const r = await fillChoiceFields(page, choiceFields, cfg)
    rec.filled += r.filled
    rec.skippedFields.push(...r.skipped)
  }
  await sleep(cfg.clickIntervalMs)

  // 提交并等待写接口响应
  const respPromise = page.waitForResponse(
    res => ['POST', 'PUT', 'PATCH'].includes(res.request().method()) && res.url().includes('/api/'),
    { timeout: 8000 },
  ).catch(() => null)
  if (cfg.verbose) {
    const label = submitClick ? `(trigger click)` : await submitBtn.innerText().catch(() => '?')
    console.log(`    [form] fields=${meta.fields.length} text=${textFields.length} choice=${choiceFields.length} submitBtn=${label}`)
  }
  try {
    if (submitClick) await submitClick()
    else await submitBtn.click({ timeout: 3000 })
  } catch (e) {
    if (cfg.verbose) console.log(`    [form] click error: ${e.message}`)
  }
  const res = await respPromise

  if (res) {
    const status = res.status()
    rec.apiResult = { status, method: res.request().method(), url: res.url().replace(cfg.baseUrl, '') }
    rec.submitStatus = status < 400 ? 'pass' : 'error'
    if (status < 400) {
      try {
        const body = await res.json()
        rec.createdId = body?.id || body?.data?.id || null
      } catch { /* 响应体非 JSON 或无双击 id */ }
    }
  } else {
    // 无写请求：弹窗关了可能走了无 API 流程，否则视为被前端校验拦截（信息，不算错误）
    await sleep(cfg.dialogEscMs)
    const dialogOpen = await page.locator(DIALOG_VISIBLE).count()
    rec.submitStatus = dialogOpen ? 'no-request' : 'closed-without-request'
  }
  return rec
}

// 巡检结束后清理 SMOKE_ 前缀数据：list API 拉取 → 名称匹配 / fallbackIds 匹配 → DELETE（seen 跨角色去重）
export async function cleanupSmokeData(cfg, token, cleanupSpecs, seen = new Set(), log = console.log, fallbackIds = new Set()) {
  if (!cleanupSpecs.length) return { deleted: 0, failed: 0 }
  const marker = cfg.crudMarker || 'SMOKE_'
  let deleted = 0
  let failed = 0
  for (const spec of cleanupSpecs) {
    try {
      const res = await fetch(cfg.baseUrl + spec.list, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        signal: AbortSignal.timeout(10000),
      })
      if (!res.ok) continue
      const data = await res.json()
      const items = Array.isArray(data) ? data : data.items || []
      for (const item of items) {
        const name = (spec.fields || ['name', 'title']).map(f => item[f]).find(v => typeof v === 'string') || ''
        const shouldDelete = (name.startsWith(marker) || fallbackIds.has(item.id)) && item.id
        if (!shouldDelete) continue
        if (seen.has(item.id)) continue
        seen.add(item.id)
        try {
          const del = await fetch(cfg.baseUrl + spec.del.replace(/\{id\}/g, item.id), {
            method: 'DELETE',
            headers: token ? { Authorization: `Bearer ${token}` } : {},
            signal: AbortSignal.timeout(10000),
          })
          if (del.ok || del.status === 404) { deleted++; log(`  [cleanup] 删除 ${spec.list} ${item.id}（${name}）`) }
          else failed++
        } catch { failed++ }
      }
    } catch { /* 单个实体清理失败不阻塞 */ }
  }
  return { deleted, failed }
}
