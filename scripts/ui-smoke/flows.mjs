/**
 * 验收流程执行器：解析 docs/spec/06-acceptance-flows.md 的 ```flow YAML 块，
 * 按步骤顺序驱动浏览器执行跨角色业务链路（DSL 规范见该文件 §1）。
 *
 * 设计原则：线性步骤、最小步骤类型、复用 clicker/forms 既有基建（waitSettled/
 * closeOverlays/submit 词表），SMOKE_ 前缀数据走统一清理；optional 步骤
 * 「未找到/已禁用」记 skip 静默跳过（幂等前置已完成），其余失败仅警告。
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

// 元素等待出现（列表刷新/弹窗挂载有延迟，count() 立即判无太脆）
async function waitFirstVisible(locator, ms = 6000) {
  try {
    await locator.first().waitFor({ state: 'visible', timeout: ms })
    return true
  } catch {
    return false
  }
}

// 精确文字点击按钮/链接；找不到退回任意可点击元素
async function clickExact(page, text) {
  const btn = page.getByRole('button', { name: text, exact: true })
  if (await waitFirstVisible(btn, 4000)) {
    if (!await btn.first().isEnabled().catch(() => true)) throw new Error(`元素「${text}」已禁用（幂等前置已完成）`)
    await btn.first().click(); return
  }
  const link = page.getByRole('link', { name: text, exact: true })
  if (await waitFirstVisible(link, 1500)) { await link.first().click(); return }
  // Radix Tabs 的 TabsTrigger 是 role="tab"（不是 button）：getByRole('button') 匹配不到，
  // 兜底的 button:has-text 也可能被同文字的页头/面包屑抢先 → Tab 实际没切换、列表仍是上一个 Tab 的数据，
  // 表现为后续 expectText/clickRow 找不到目标（2026-08-19 实测：AI「智能体审核」Tab 踩到）
  const tab = page.getByRole('tab', { name: text, exact: true })
  if (await waitFirstVisible(tab, 1500)) { await tab.first().click(); return }
  // Radix Select/下拉的选项（role=option）：需先点击触发器让下拉展开（flow 里在点击前先点触发器文本）
  const opt = page.getByRole('option', { name: text, exact: true })
  if (await waitFirstVisible(opt, 1500)) { await opt.first().click(); return }
  // Radix DropdownMenu 的菜单项（role=menuitem）：触发器（Button+ChevronDown）点开后，
  // 菜单项随菜单打开才挂载（如考试「新增题目」题型菜单、题库「添加题目」题型菜单）
  const item = page.getByRole('menuitem', { name: text, exact: true })
  if (await waitFirstVisible(item, 1500)) { await item.first().click(); return }
  // 模糊兜底：排除被遮挡/禁用的候选（如弹窗遮罩后同文字页头按钮），
  // 全部不可点击视为幂等无操作（目标不存在/前置已完成）
  const any = page.locator(`button:has-text("${cssEscape(text)}"), a:has-text("${cssEscape(text)}")`)
  if (await waitFirstVisible(any, 1500)) {
    const candidates = await any.all()
    for (const c of candidates) {
      try {
        await c.click({ trial: true, timeout: 1500 }) // 可点击性探测：visible/enabled/不被遮挡
        await c.click()
        return
      } catch { /* 该候选不可点击，试下一个 */ }
    }
    throw new Error(`元素「${text}」不可点击（已禁用或被遮挡）`)
  }
  throw new Error(`未找到可点击元素「${text}」`)
}

// 点击包含文字的可点击元素（卡片/链接/行标题）
async function clickContaining(page, text) {
  const link = page.getByRole('link').filter({ hasText: text })
  if (await waitFirstVisible(link, 6000)) { await link.first().click(); return }
  const btn = page.getByRole('button').filter({ hasText: text })
  if (await waitFirstVisible(btn, 1500)) { await btn.first().click(); return }
  const t = page.getByText(text, { exact: false })
  if (await waitFirstVisible(t, 1500)) { await t.first().click(); return }
  throw new Error(`未找到包含「${text}」的元素`)
}

// 表格行内操作：按行文字定位 tr，点击行内按钮；action 缺省时点击整行（行点击开详情/弹窗场景）
async function clickRowAction(page, rowText, action) {
  const row = page.locator('tr').filter({ hasText: rowText })
  // 列表搜索有防抖+接口延迟，给行出现留出窗口
  if (!await waitFirstVisible(row, 8000)) throw new Error(`未找到包含「${rowText}」的表格行`)
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
  // 1) 优先：定位「文本含 label」的 combobox 触发器本身（filter hasText 子串匹配）。
  //    避免「文本的 ancestor 容器内含整行多个 combobox」时误取第一个（如人培方案课程行：
  //    「搜索体系课...」的 ancestor div 含行类型 select「体系课」，先取到它就点错了，2026-08-20 实测）
  const byText = page.locator('[role="combobox"]:visible').filter({ hasText: label }).first()
  if (await byText.count()) {
    trigger = byText
  }
  // 2) 文本的邻近容器内找 combobox（placeholder 渲染为按钮文本的场景）
  if (!trigger) {
    const texts = page.locator(`xpath=//*[normalize-space(text())=${JSON.stringify(label)}]`)
    const tn = Math.min(await texts.count(), 5)
    for (let i = 0; i < tn && !trigger; i++) {
      const box = texts.nth(i).locator(`xpath=ancestor::*[self::div or self::label][1]`)
      const t = box.locator('[role="combobox"], button:has([data-placeholder])')
      if (await t.count()) trigger = t.first()
    }
  }
  // 3) 兜底：文本之后最近的 combobox
  if (!trigger) {
    const fb = page.locator(`xpath=//*[contains(normalize-space(.), ${JSON.stringify(label)})][1]/following::*[@role='combobox'][1]`)
    if (await fb.count()) trigger = fb.first()
  }
  if (!trigger) throw new Error(`未找到「${label}」的下拉控件`)
  await trigger.click()
  await sleep(250)
  // 选项面板仍打开时（多选 Combobox 选完不关）才按 Escape 收拢；单选 Radix Select 选完自动关，
  // 此时再按 Escape 会把宿主 Dialog 一并关掉（条件触发避免误关）
  const dismissIfOpen = async () => {
    await sleep(150)
    const open = await page.locator('[role="listbox"]:visible, [cmdk-list]:visible').count()
    if (open) await page.keyboard.press('Escape')
  }
  // Combobox 搜索框：输入过滤（选项文字非 first 时）；cmdk Command 输入框为 [cmdk-input]
  if (option !== 'first') {
    const search = page.locator('[cmdk-input], [data-slot="command-input"], [role="listbox"] input, [role="dialog"] [role="combobox"] input, [role="dialog"]:visible input[type="text"]')
    if (await search.count() && await search.first().isVisible().catch(() => false)) {
      await search.first().fill(option).catch(() => {})
      await sleep(300)
    }
  }
  const panelSel = '[data-state="open"] [role="option"]:visible:not([aria-disabled="true"]), [data-state="open"] [cmdk-item]:visible:not([aria-disabled="true"])'
  // first 时跳过占位选项（「请选择/不指定」等空值项），避免选中后表单仍为空
  const opt = option === 'first'
    ? page.locator(panelSel + ':not(:has-text("请选择")):not(:has-text("不指定"))').first()
    : page.locator(panelSel).filter({ hasText: option }).first()
  // 选项限定在「当前打开的面板」内：无差别 getByRole('option') 会命中已关闭 Select 残留的 portal
  // 选项（如人培方案课程行的行类型 Select），导致点错；禁用项（占位/空态）跳过（2026-08-20 实测）
  try {
    // 等待选项出现（下拉数据异步加载，如方案课程行体系课列表；cmdk 选项随数据渲染挂载）
    await opt.waitFor({ state: 'visible', timeout: 6000 })
    await opt.click()
    await dismissIfOpen()
    return
  } catch { /* 主选择器未命中，走兜底 */ }
  // 兜底：仍限定「当前打开面板」（data-state=open）内的可见非禁用选项；无状态面板（旧实现）才放宽
  const item = option === 'first'
    ? page.locator(panelSel + ':not(:has-text("请选择")):not(:has-text("不指定")), [cmdk-list] [cmdk-item]:visible:not([aria-disabled="true"]):not(:has-text("请选择")):not(:has-text("不指定"))').first()
    : page.locator(panelSel + ', [cmdk-list] [cmdk-item]:visible:not([aria-disabled="true"])').filter({ hasText: option }).first()
  try {
    await item.waitFor({ state: 'visible', timeout: 3000 })
    await item.click()
    await dismissIfOpen()
    return
  } catch { /* 兜底也未命中 */ }
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
  const words = ['确认', '确定', '删除', '通过', '发布', '下架', '关闭', '启用', '禁用', '取消排课', 'OK', 'Confirm', 'Delete']
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
// 动作按步骤内 YAML 键的书写顺序执行（js-yaml 保留键序），与 spec §1 语义一致
async function execStep(page, cfg, step, vars, rand, progress) {
  const actions = []
  const mark = a => { if (progress) progress.current = a }
  // expectApi 响应收集（本步窗口内）
  const apiHits = []
  const collector = res => {
    if (res.url().includes('/api/')) apiHits.push({ method: res.request().method(), url: res.url(), status: res.status() })
  }
  if (step.expectApi) page.on('response', collector)
  // pageerror 哨兵：本步窗口内任何未捕获前端异常（React 渲染崩溃等）都判步骤失败，
  // 覆盖「接口正常但页面白屏」的事故类（2026-08 AI 工坊 params 事故：接口 200 但页面崩溃，
  // 流程未进动态路由页因而漏检）。步骤可选 skipPageErrorCheck: true 显式豁免。
  const pageErrors = []
  const onPageError = err => pageErrors.push(String((err && err.message) || err))
  page.on('pageerror', onPageError)
  try {
    for (const [key, rawVal] of Object.entries(step)) {
      switch (key) {
        case 'role': case 'expectApi': case 'saveAs': case 'optional': case 'timeoutMs': case 'skipPageErrorCheck':
          break
        case 'goto': {
          mark(`goto ${rawVal}`)
          const target = `${cfg.baseUrl}${render(rawVal, vars, rand)}`
          if (page.url() === target) {
            // 重访相同 URL（含相同 hash）：page.goto 只做同文档 hash 导航不重载，
            // 页面停留旧数据导致断言失败（2026-08 AI 挂接流程学生重访广场事故），强制 reload
            await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 })
          } else {
            await page.goto(target, { waitUntil: 'domcontentloaded', timeout: 30000 })
          }
          await waitSettled(page, cfg)
          actions.push(`goto ${rawVal}`)
          break
        }
        case 'click': {
          mark(`click ${rawVal}`)
          await clickExact(page, render(rawVal, vars, rand))
          await waitSettled(page, cfg)
          actions.push(`click ${rawVal}`)
          break
        }
        case 'clickText': {
          mark(`clickText ${rawVal}`)
          await clickContaining(page, render(rawVal, vars, rand))
          await waitSettled(page, cfg)
          actions.push(`clickText ${rawVal}`)
          break
        }
        case 'clickRow': {
          mark(`clickRow ${rawVal.text}→${rawVal.action || '(行)'}`)
          const rowText = render(rawVal.text, vars, rand)
          const action = rawVal.action ? render(rawVal.action, vars, rand) : null
          await clickRowAction(page, rowText, action)
          await waitSettled(page, cfg)
          actions.push(`clickRow ${rowText}→${action || '(行)'}`)
          break
        }
        case 'clickCell': {
          // 表格网格单元格（排课周课表等）：按「行文字 × 列头文字」定位交点单元格点击。
          // 写法：clickCell: { 上午第一节课: 周一 }（key=行内文字，value=列头文字）
          for (const [rowLabel, colLabel] of Object.entries(rawVal)) {
            mark(`clickCell ${rowLabel}×${colLabel}`)
            const rowText = render(rowLabel, vars, rand)
            const colText = render(String(colLabel), vars, rand)
            const ths = page.locator('table:visible thead th')
            const thCount = await ths.count()
            let colIdx = -1
            for (let i = 0; i < thCount; i++) {
              const txt = ((await ths.nth(i).innerText()) || '').trim()
              if (txt === colText) { colIdx = i; break }
            }
            if (colIdx < 0) throw new Error(`未找到表头列「${colText}」`)
            const row = page.locator('table:visible tbody tr').filter({ hasText: rowText })
            if (!await waitFirstVisible(row, 6000)) throw new Error(`未找到包含「${rowText}」的表格行`)
            const cell = row.first().locator('td').nth(colIdx)
            if (!await waitFirstVisible(cell, 4000)) throw new Error(`单元格「${rowText}×${colText}」不可见`)
            await cell.click()
            await waitSettled(page, cfg)
            actions.push(`clickCell ${rowText}×${colText}`)
          }
          break
        }
        case 'clickCard': {
          // 卡片式列表的行内操作（工坊等卡片网格，卡片需带 data-smoke-card 属性）
          mark(`clickCard ${rawVal.text}→${rawVal.action}`)
          const cardText = render(rawVal.text, vars, rand)
          const cardAction = render(rawVal.action, vars, rand)
          const card = page.locator('[data-smoke-card]').filter({ hasText: cardText }).first()
          if (!await waitFirstVisible(card, 8000)) throw new Error(`未找到包含「${cardText}」的卡片`)
          const cardBtn = card.getByRole('button', { name: cardAction, exact: false }).first()
          if (!await cardBtn.count()) throw new Error(`卡片「${cardText}」内未找到操作「${cardAction}」`)
          await cardBtn.click()
          await waitSettled(page, cfg)
          actions.push(`clickCard ${cardText}→${cardAction}`)
          break
        }
        case 'fill': {
          for (const [label, raw] of Object.entries(rawVal)) {
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
          break
        }
        case 'select': {
          for (const [label, raw] of Object.entries(rawVal)) {
            mark(`select ${label}`)
            const option = render(String(raw), vars, rand)
            await selectOption(page, label, option)
            await sleep(200)
            actions.push(`select ${label}=${option}`)
          }
          break
        }
        case 'submit': {
          mark('submit')
          await clickSubmit(page, cfg, rawVal === true ? true : render(String(rawVal), vars, rand))
          await waitSettled(page, cfg)
          actions.push('submit')
          break
        }
        case 'confirm': {
          mark('confirm')
          await clickConfirm(page, cfg)
          await waitSettled(page, cfg)
          actions.push('confirm')
          break
        }
        case 'toggle': {
          // 开关切换（Radix Switch，[role="switch"]）：按 label 文案定位其邻近开关，
          // 确保其达到目标状态——已满足则不动（幂等），避免线性流程把已开的开关关掉。
          // 写法：toggle: { 前台展示: true } / { 前台展示: false }
          for (const [label, raw] of Object.entries(rawVal)) {
            mark(`toggle ${label}`)
            const target = raw === true || String(raw).toLowerCase() === 'true'
            let sw = null
            // 1) label htmlFor/id 关联（getByLabel 直接命中开关）
            const byLabel = page.getByLabel(label, { exact: false })
            if (await byLabel.count() && (await byLabel.first().getAttribute('role')) === 'switch') {
              sw = byLabel.first()
            }
            // 2) label 文本的邻近容器内找 [role=switch]（shadcn Switch + 兄弟 Label 布局）
            if (!sw) {
              const texts = page.locator(`xpath=//*[normalize-space(text())=${JSON.stringify(label)}]`)
              const tn = Math.min(await texts.count(), 5)
              for (let i = 0; i < tn && !sw; i++) {
                for (const depth of [1, 2, 3]) {
                  const box = texts.nth(i).locator(`xpath=ancestor::*[self::div or self::label][${depth}]`)
                  const s = box.locator('[role="switch"]:visible')
                  if (await s.count()) { sw = s.first(); break }
                }
              }
            }
            // 3) 兜底：页面唯一开关
            if (!sw) {
              const all = page.locator('[role="switch"]:visible')
              if (await all.count() !== 1) throw new Error(`未找到「${label}」对应的开关`)
              sw = all.first()
            }
            const checked = (await sw.getAttribute('aria-checked')) === 'true'
            if (checked !== target) {
              await sw.click()
              await sleep(250)
            }
            actions.push(`toggle ${label}=${target}${checked === target ? '（已满足）' : ''}`)
          }
          break
        }
        case 'check': {
          // 复选勾选（Radix Checkbox，[role="checkbox"]）：按 label 文案定位其邻近复选框，
          // 确保目标勾选状态（已满足则不动，幂等）。用于组织树选择器等「名字是 span、勾选在 Checkbox」的布局。
          // 写法：check: { 软件技术2401: true }
          for (const [label, raw] of Object.entries(rawVal)) {
            mark(`check ${label}`)
            const target = raw === true || String(raw).toLowerCase() === 'true'
            let cb = null
            const texts = page.locator(`xpath=//*[normalize-space(text())=${JSON.stringify(label)}]`)
            const tn = Math.min(await texts.count(), 5)
            for (let i = 0; i < tn && !cb; i++) {
              for (const depth of [1, 2, 3]) {
                const box = texts.nth(i).locator(`xpath=ancestor::*[self::div or self::label][${depth}]`)
                const c = box.locator('[role="checkbox"]:visible')
                if (await c.count()) { cb = c.first(); break }
              }
            }
            if (!cb) {
              const all = page.locator('[role="checkbox"]:visible')
              if (await all.count() !== 1) throw new Error(`未找到「${label}」对应的复选框`)
              cb = all.first()
            }
            const checked = (await cb.getAttribute('aria-checked')) === 'true'
            if (checked !== target) {
              await cb.click()
              await sleep(250)
            }
            actions.push(`check ${label}=${target}${checked === target ? '（已满足）' : ''}`)
          }
          break
        }
        case 'expectText': {
          mark(`expectText ${rawVal}`)
          const text = render(String(rawVal), vars, rand)
          await page.getByText(text, { exact: false }).first().waitFor({ state: 'visible', timeout: step.timeoutMs || 8000 })
          actions.push('expectText ✓')
          break
        }
        default:
          throw new Error(`未知步骤键「${key}」（支持 goto/click/clickText/clickRow/clickCard/clickCell/fill/select/submit/confirm/toggle/check/expectApi/expectText/saveAs/optional/timeoutMs/skipPageErrorCheck）`)
      }
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
    if (!step.skipPageErrorCheck && pageErrors.length > 0) {
      throw new Error(`页面脚本错误（pageerror ×${pageErrors.length}）：${pageErrors[0].slice(0, 200)}`)
    }
  } finally {
    if (step.expectApi) page.off('response', collector)
    page.off('pageerror', onPageError)
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
      const desc = [step.goto, step.click, step.clickText, step.clickRow && (step.clickRow.action || `行:${step.clickRow.text}`), step.fill && 'fill', step.select && 'select', step.submit && 'submit', step.confirm && 'confirm', step.expectText && `expect:${step.expectText}`].filter(Boolean).join(' → ')
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
        const msg = (e.message || String(e)).slice(0, 300)
        // 幂等前置的「正常无操作」：目标未找到（无可清理）/按钮已禁用（前置已完成）→ 记 skip 静默跳过，
        // 不截图不算 warn；其余失败按 optional 记 warn（真实信号：残留无法清理/页面回归）
        const noop = /未找到|已禁用/.test(msg)
        rec.status = !step.optional ? 'fail' : noop ? 'skip' : 'warn'
        rec.reason = msg
        if (rec.status !== 'skip') {
          try {
            const { page } = await deps.ensureContext(step.role)
            rec.pageUrl = page.url()
            const shot = `/tmp/zhiyu-ui-smoke/flow-${flow.flow}-step${i + 1}.png`
            await page.screenshot({ path: shot, fullPage: false })
            rec.screenshot = shot
          } catch { /* 截图失败忽略 */ }
        }
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
