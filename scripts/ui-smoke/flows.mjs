/**
 * 验收流程执行器：解析 docs/spec/06-acceptance-flows.md 的 ```flow YAML 块，
 * 按步骤顺序驱动浏览器执行跨角色业务链路（DSL 规范见该文件 §1）。
 *
 * 设计原则：线性步骤、最小步骤类型、复用 clicker/forms 既有基建（waitSettled/
 * closeOverlays/submit 词表），SMOKE_ 前缀数据走统一清理；optional 步骤失败仅警告。
 */
import { load as yamlLoad } from 'js-yaml'
import { promises as fs } from 'fs'
import { buildSubmitRe } from './forms.mjs'
import { waitSettled } from './clicker.mjs'

const sleep = ms => new Promise(r => setTimeout(r, ms))

// ── 解析 spec 中的 flow 块 ─────────────────────────────────
export async function loadFlows(specPath) {
  const md = await fs.readFile(specPath, 'utf8')
  const flows = []
  const re = /```flow\s*\n([\s\S]*?)```/g
  let m
  while ((m = re.exec(md))) {
    const def = yamlLoad(m[1])
    if (!def || typeof def !== 'object') throw new Error(`flow 块解析失败: ${m[1].slice(0, 80)}`)
    if (!def.flow || !Array.isArray(def.steps) || !def.steps.length) {
      throw new Error(`flow「${def.flow || '?'}」缺少 flow id 或 steps`)
    }
    for (const [i, s] of def.steps.entries()) {
      if (!s.role) throw new Error(`flow「${def.flow}」第 ${i + 1} 步缺少 role`)
    }
    flows.push(def)
  }
  return flows
}

// ── 模板变量：{rand} 每流程一次；{{var}} 来自上下文 ────────
function render(value, vars, rand) {
  if (typeof value !== 'string') return value
  return value.replace(/\{rand\}/g, rand).replace(/\{\{(\w+)\}\}/g, (_, k) => {
    if (!(k in vars)) throw new Error(`未定义的流程变量 {{${k}}}（需先 saveAs）`)
    return vars[k]
  })
}

// ── 元素定位策略 ───────────────────────────────────────────

// 按 label 定位输入框：getByLabel → placeholder 包含 → label 文本邻近容器内 input/textarea
async function fieldInput(page, label) {
  const byLabel = page.getByLabel(label, { exact: false })
  if (await byLabel.count() && await byLabel.first().isVisible().catch(() => false)) return byLabel.first()
  const byPh = page.locator(`input[placeholder*="${cssEscape(label)}" i]:visible, textarea[placeholder*="${cssEscape(label)}" i]:visible`)
  if (await byPh.count()) return byPh.first()
  // FormFieldRow 等布局：label 文本节点的祖先容器里找第一个可编辑控件
  // （label 文案可能在页面描述中重复出现，遍历候选容器，取第一个真正包含控件的）
  const texts = page.locator(`xpath=//*[normalize-space(text())=${JSON.stringify(label)}]`)
  const tn = Math.min(await texts.count(), 5)
  for (let i = 0; i < tn; i++) {
    const box = texts.nth(i).locator(`xpath=ancestor::*[self::div or self::label][1]`)
    const ctl = box.locator('input:not([type=hidden]):visible, textarea:visible')
    if (await ctl.count()) return ctl.first()
  }
  // 退化：label 文本之后最近的输入框
  const after = page.locator(`xpath=//*[contains(normalize-space(.), ${JSON.stringify(label)})][1]/following::input[not(@type='hidden')][1] | //*[contains(normalize-space(.), ${JSON.stringify(label)})][1]/following::textarea[1]`)
  if (await after.count()) return after.first()
  return null
}

function cssEscape(s) {
  return s.replace(/["\\]/g, '\\$&')
}

// 精确文字点击按钮/链接；找不到退回任意可点击元素
async function clickExact(page, text) {
  const btn = page.getByRole('button', { name: text, exact: true })
  if (await btn.count()) { await btn.first().click(); return }
  const link = page.getByRole('link', { name: text, exact: true })
  if (await link.count()) { await link.first().click(); return }
  const any = page.locator(`button:has-text("${cssEscape(text)}"), a:has-text("${cssEscape(text)}")`)
  if (await any.count()) { await any.first().click(); return }
  throw new Error(`未找到可点击元素「${text}」`)
}

// 点击包含文字的可点击元素（卡片/链接/行标题）
async function clickContaining(page, text) {
  const link = page.getByRole('link').filter({ hasText: text })
  if (await link.count()) { await link.first().click(); return }
  const btn = page.getByRole('button').filter({ hasText: text })
  if (await btn.count()) { await btn.first().click(); return }
  const t = page.getByText(text, { exact: false })
  if (await t.count()) { await t.first().click(); return }
  throw new Error(`未找到包含「${text}」的元素`)
}

// 表格行内操作：按行文字定位 tr，点击行内按钮；action 缺省时点击整行（行点击开详情/弹窗场景）
async function clickRowAction(page, rowText, action) {
  const row = page.locator('tr').filter({ hasText: rowText })
  if (!await row.count()) throw new Error(`未找到包含「${rowText}」的表格行`)
  const r = row.first()
  if (!action) { await r.click(); return }
  const btn = r.getByRole('button', { name: action, exact: true })
  if (await btn.count()) { await btn.first().click(); return }
  const anyBtn = r.locator(`button:has-text("${cssEscape(action)}"), a:has-text("${cssEscape(action)}")`)
  if (await anyBtn.count()) { await anyBtn.first().click(); return }
  throw new Error(`行「${rowText}」内未找到操作「${action}」`)
}

// 下拉选择：label 邻近的 combobox 触发器 → 选项；Combobox 带搜索框时先输入
async function selectOption(page, label, option) {
  let trigger = null
  const texts = page.locator(`xpath=//*[normalize-space(text())=${JSON.stringify(label)}]`)
  const tn = Math.min(await texts.count(), 5)
  for (let i = 0; i < tn && !trigger; i++) {
    const box = texts.nth(i).locator(`xpath=ancestor::*[self::div or self::label][1]`)
    const t = box.locator('[role="combobox"], button:has([data-placeholder])')
    if (await t.count()) trigger = t.first()
  }
  if (!trigger) {
    const fb = page.locator(`xpath=//*[contains(normalize-space(.), ${JSON.stringify(label)})][1]/following::*[@role='combobox'][1]`)
    if (await fb.count()) trigger = fb.first()
  }
  if (!trigger) throw new Error(`未找到「${label}」的下拉控件`)
  await trigger.click()
  await sleep(250)
  // Combobox 搜索框：输入过滤（选项文字非 first 时）；cmdk Command 输入框为 [cmdk-input]
  if (option !== 'first') {
    const search = page.locator('[cmdk-input], [data-slot="command-input"], [role="listbox"] input, [role="dialog"] [role="combobox"] input, [role="dialog"]:visible input[type="text"]')
    if (await search.count() && await search.first().isVisible().catch(() => false)) {
      await search.first().fill(option).catch(() => {})
      await sleep(300)
    }
  }
  const opt = option === 'first'
    ? page.getByRole('option').first()
    : page.getByRole('option').filter({ hasText: option }).first()
  // 选项面板仍打开时（多选 Combobox 选完不关）才按 Escape 收拢；单选 Radix Select 选完自动关，
  // 此时再按 Escape 会把宿主 Dialog 一并关掉（条件触发避免误关）
  const dismissIfOpen = async () => {
    await sleep(150)
    const open = await page.locator('[role="listbox"]:visible, [cmdk-list]:visible').count()
    if (open) await page.keyboard.press('Escape')
  }
  if (await opt.count()) { await opt.click(); await dismissIfOpen(); return }
  const item = option === 'first'
    ? page.locator('[role="listbox"] [role="option"], [role="menu"] [role="menuitem"], [cmdk-item]').first()
    : page.locator('[role="listbox"] [role="option"], [role="menu"] [role="menuitem"], [cmdk-item]').filter({ hasText: option }).first()
  if (await item.count()) { await item.click(); await dismissIfOpen(); return }
  throw new Error(`「${label}」下拉中未找到选项「${option}」`)
}

// 提交按钮：true 用词表自动识别；字符串精确匹配
async function clickSubmit(page, cfg, submit) {
  if (typeof submit === 'string') { await clickExact(page, submit); return }
  const re = buildSubmitRe(cfg)
  const scope = await page.locator('[role="dialog"]:visible').count()
    ? page.locator('[role="dialog"]:visible').last()
    : page
  const btns = scope.locator('button:visible')
  const n = await btns.count()
  for (let i = 0; i < n; i++) {
    const b = btns.nth(i)
    const text = ((await b.textContent()) || '').trim()
    if (text && re.test(text) && await b.isEnabled().catch(() => true)) { await b.click(); return }
  }
  throw new Error('未识别到提交按钮')
}

// 弹窗确认：点击确认/删除/发布/下架/确定类按钮
async function clickConfirm(page, cfg) {
  const dialog = page.locator('[role="dialog"]:visible, [role="alertdialog"]:visible').last()
  if (!await dialog.count()) throw new Error('confirm：当前无可确认弹窗')
  const words = ['确认', '确定', '删除', '发布', '下架', '关闭', '启用', '禁用', 'OK', 'Confirm', 'Delete']
  const re = new RegExp(`^(?:${words.join('|')})`)
  const btns = dialog.locator('button:visible')
  const n = await btns.count()
  for (let i = 0; i < n; i++) {
    const b = btns.nth(i)
    const text = ((await b.textContent()) || '').trim()
    if (text && re.test(text)) { await b.click(); return }
  }
  throw new Error('弹窗内未找到确认类按钮')
}

// ── 单步执行 ───────────────────────────────────────────────
async function execStep(page, cfg, step, vars, rand, progress) {
  const actions = []
  const mark = a => { if (progress) progress.current = a }
  // expectApi 响应收集（本步窗口内）
  const apiHits = []
  const collector = res => {
    if (res.url().includes('/api/')) apiHits.push({ method: res.request().method(), url: res.url(), status: res.status() })
  }
  if (step.expectApi) page.on('response', collector)
  try {
    if (step.goto) {
      mark(`goto ${step.goto}`)
      await page.goto(`${cfg.baseUrl}${render(step.goto, vars, rand)}`, { waitUntil: 'domcontentloaded', timeout: 30000 })
      await waitSettled(page, cfg)
      actions.push(`goto ${step.goto}`)
    }
    if (step.click) {
      mark(`click ${step.click}`)
      await clickExact(page, render(step.click, vars, rand))
      await waitSettled(page, cfg)
      actions.push(`click ${step.click}`)
    }
    if (step.clickText) {
      mark(`clickText ${step.clickText}`)
      await clickContaining(page, render(step.clickText, vars, rand))
      await waitSettled(page, cfg)
      actions.push(`clickText ${step.clickText}`)
    }
    if (step.clickRow) {
      mark(`clickRow ${step.clickRow.text}→${step.clickRow.action || '(行)'}`)
      const rowText = render(step.clickRow.text, vars, rand)
      const action = render(step.clickRow.action, vars, rand)
      await clickRowAction(page, rowText, action)
      await waitSettled(page, cfg)
      actions.push(`clickRow ${rowText}→${action}`)
    }
    if (step.fill) {
      for (const [label, raw] of Object.entries(step.fill)) {
        mark(`fill ${label}`)
        const value = render(String(raw), vars, rand)
        const input = await fieldInput(page, label)
        if (!input) throw new Error(`未找到字段「${label}」的输入框`)
        await input.click().catch(() => {})
        await input.fill(value)
        if (step.saveAs) {
          for (const [varName, fieldLabel] of Object.entries(step.saveAs)) {
            if (fieldLabel === label) vars[varName] = value
          }
        }
        actions.push(`fill ${label}`)
      }
    }
    if (step.select) {
      for (const [label, raw] of Object.entries(step.select)) {
        mark(`select ${label}`)
        const option = render(String(raw), vars, rand)
        await selectOption(page, label, option)
        await sleep(200)
        actions.push(`select ${label}=${option}`)
      }
    }
    if (step.submit) {
      mark('submit')
      await clickSubmit(page, cfg, step.submit === true ? true : render(step.submit, vars, rand))
      await waitSettled(page, cfg)
      actions.push('submit')
    }
    if (step.confirm) {
      mark('confirm')
      await clickConfirm(page, cfg)
      await waitSettled(page, cfg)
      actions.push('confirm')
    }
    if (step.expectApi) {
      mark('expectApi')
      const exp = step.expectApi
      const hit = apiHits.find(h =>
        (!exp.method || h.method === exp.method) &&
        h.url.includes(exp.url) &&
        (!exp.status || h.status === exp.status))
      if (!hit) {
        throw new Error(`expectApi 未命中 ${exp.method || '*'} ${exp.url} → ${exp.status || '*'}（窗口内 API: ${apiHits.map(h => `${h.status} ${h.method} ${new URL(h.url).pathname}`).slice(-6).join(', ') || '无'}）`)
      }
      actions.push(`expectApi ✓ ${hit.status} ${hit.method}`)
    }
    if (step.expectText) {
      mark(`expectText ${step.expectText}`)
      const text = render(step.expectText, vars, rand)
      await page.getByText(text, { exact: false }).first().waitFor({ state: 'visible', timeout: step.timeoutMs || 8000 })
      actions.push(`expectText ✓`)
    }
  } finally {
    if (step.expectApi) page.off('response', collector)
  }
  return actions
}

// ── 流程执行（跨角色）──────────────────────────────────────
/**
 * @param deps { login, attachListeners, ensureContext } 由 main 注入，复用登录/监听基建
 *   ensureContext(role) → { ctx, page, sink, close() }：按角色创建（或复用）已登录上下文
 */
export async function runFlows(flows, cfg, deps) {
  const results = []
  for (const flow of flows) {
    const vars = {}
    const rand = Math.random().toString(36).slice(2, 8)
    const fr = { flow: flow.flow, story: flow.story || null, status: 'pass', steps: [], startedAt: Date.now() }
    console.log(`\n=== [flow] ${flow.flow}（${flow.desc || ''}）===`)
    let failed = false
    for (const [i, step] of flow.steps.entries()) {
      const desc = [step.goto, step.click, step.clickText, step.clickRow && `${step.clickRow.action}`, step.fill && 'fill', step.select && 'select', step.submit && 'submit', step.confirm && 'confirm', step.expectText && `expect:${step.expectText}`].filter(Boolean).join(' → ')
      const rec = { i: i + 1, role: step.role, desc: (desc || '(空步骤)').slice(0, 120), status: 'pass', actions: [], optional: !!step.optional }
      const progress = { current: '' }
      try {
        const { page } = await deps.ensureContext(step.role)
        const run = execStep(page, cfg, step, vars, rand, progress)
        const timeoutMs = step.timeoutMs || 20000
        rec.actions = await Promise.race([
          run,
          new Promise((_, rej) => setTimeout(() => rej(new Error(`步骤超时（>${timeoutMs / 1000}s，停在 ${progress.current || '起始'}）`)), timeoutMs)),
        ])
        console.log(`  [flow:${flow.flow}] ${i + 1}/${flow.steps.length} ok   [${step.role}] ${rec.desc}`)
      } catch (e) {
        rec.status = step.optional ? 'warn' : 'fail'
        rec.reason = (e.message || String(e)).slice(0, 300)
        try {
          const { page } = await deps.ensureContext(step.role)
          rec.pageUrl = page.url()
          const shot = `/tmp/zhiyu-ui-smoke/flow-${flow.flow}-step${i + 1}.png`
          await page.screenshot({ path: shot, fullPage: false })
          rec.screenshot = shot
        } catch { /* 截图失败忽略 */ }
        console.log(`  [flow:${flow.flow}] ${i + 1}/${flow.steps.length} ${rec.status.toUpperCase()} [${step.role}] ${rec.desc} — ${rec.reason}`)
        if (!step.optional) {
          fr.status = 'fail'
          failed = true
        }
      }
      fr.steps.push(rec)
      if (failed) {
        // 失败后跳过后续步骤（上下文已不可信）
        for (let j = i + 1; j < flow.steps.length; j++) {
          fr.steps.push({ i: j + 1, role: flow.steps[j].role, desc: '', status: 'skip', reason: '前置步骤失败' })
        }
        break
      }
    }
    if (fr.status === 'pass' && fr.steps.some(s => s.status === 'warn')) fr.status = 'pass-with-warn'
    fr.durationMs = Date.now() - fr.startedAt
    results.push(fr)
    console.log(`  [flow] ${flow.flow} → ${fr.status}（${Math.round(fr.durationMs / 1000)}s）`)
  }
  return results
}
