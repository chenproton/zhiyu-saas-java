/**
 * forms.mjs 测试：纯函数（取值/触发词/提交词）+ 浏览器集成（mock API 的填充提交判定）。
 * 环境无 Chrome 时浏览器用例自动跳过。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { chromium } from 'playwright'
import { valueForField, keyText, buildTriggerRe, buildSubmitRe, maybeTestForm } from '../forms.mjs'

const CFG = {
  baseUrl: 'http://smoke.local',
  submitWords: ['保存', '提交', '创建', '确定'],
  submitWordsEn: ['Save'],
  formTriggerWords: ['创建', '新增', '编辑'],
  formTriggerWordsEn: ['Create', 'Edit'],
  clickIntervalMs: 1,
  dialogEscMs: 1,
}

test('valueForField 按类型与语义取值', () => {
  assert.match(valueForField({ type: 'email', name: '', label: '' }, 'abc'), /^smoke_abc@test\.local$/)
  assert.equal(valueForField({ type: 'number', name: '', label: '' }, 'abc'), '1')
  assert.match(valueForField({ type: 'text', name: 'name', label: '名称' }, 'abc'), /^SMOKE_测试abc$/)
  assert.match(valueForField({ type: 'text', name: 'code', label: '编码' }, 'abc'), /^SMOKEABC$/)
  assert.match(valueForField({ type: 'text', name: 'desc', label: '描述' }, 'abc'), /^SMOKE_自动巡检描述 abc$/)
  assert.match(valueForField({ type: 'text', name: '', label: '' }, 'abc'), /^SMOKE_abc$/)
  assert.equal(valueForField({ type: 'tel', name: '', label: '手机号' }, 'abc'), '13800000000')
})

test('keyText 提取收集 key 中的按钮文本', () => {
  assert.equal(keyText('BUTTON|新增 课程||1'), '新增 课程')
  assert.equal(keyText('dlg|BUTTON|保存||2'), '保存')
  assert.equal(keyText('A||/inner|1'), '')
})

test('触发词与提交词正则（中英双语）', () => {
  const trig = buildTriggerRe(CFG)
  assert.ok(trig.test('创建'))
  assert.ok(trig.test('Edit'))
  assert.ok(!trig.test('查看'))
  const sub = buildSubmitRe(CFG)
  assert.ok(sub.test('保存'))
  assert.ok(sub.test('Save Draft'))
  assert.ok(!sub.test('取消'))
})

// ── 浏览器集成：mock API 验证填充提交判定 ──
const FORM_HTML = `
<html><body>
  <div role="dialog" style="position:fixed;top:0;left:0;width:400px;height:300px">
    <label for="f-name">名称 *</label>
    <input id="f-name" name="name" required />
    <label for="f-desc">描述</label>
    <textarea id="f-desc" name="desc"></textarea>
    <button id="cancel">取消</button>
    <button id="ok">保存</button>
  </div>
  <script>
    document.getElementById('ok').addEventListener('click', () => {
      fetch('/api/v1/widgets', { method: 'POST', body: '{}' })
    })
  </script>
</body></html>`

let browser
async function getPage(apiStatus) {
  if (!browser) browser = await chromium.launch({ headless: true, channel: 'chrome', args: ['--no-sandbox'] })
  const page = await browser.newPage()
  await page.route('**/*', route => {
    const url = route.request().url()
    if (url.includes('/api/')) return route.fulfill({ status: apiStatus, contentType: 'application/json', body: '{}' })
    return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: FORM_HTML })
  })
  await page.goto('http://smoke.local/form')
  return page
}

test('maybeTestForm：填充并提交成功记 pass', async t => {
  let page
  try { page = await getPage(200) } catch (e) { t.skip(`Chrome 不可用：${e.message}`); return }
  const rec = await maybeTestForm(page, CFG, '新增')
  assert.ok(rec, '应识别到表单')
  assert.equal(rec.submitStatus, 'pass', `期望 pass，实际 ${rec.submitStatus}`)
  assert.ok(rec.filled >= 2, `应填充至少 2 个字段，实际 ${rec.filled}`)
  assert.equal(rec.apiResult.status, 200)
  const nameVal = await page.locator('#f-name').inputValue()
  assert.match(nameVal, /^SMOKE_测试/, '名称字段应按语义填充 SMOKE_ 前缀值')
  await page.close()
})

test('maybeTestForm：接口 500 记 error', async t => {
  let page
  try { page = await getPage(500) } catch (e) { t.skip(`Chrome 不可用：${e.message}`); return }
  const rec = await maybeTestForm(page, CFG, '新增')
  assert.equal(rec.submitStatus, 'error')
  assert.equal(rec.apiResult.status, 500)
  await page.close()
})

test('maybeTestForm：响应体含 id 时记录 createdId', async t => {
  let page
  try {
    if (!browser) browser = await chromium.launch({ headless: true, channel: 'chrome', args: ['--no-sandbox'] })
    page = await browser.newPage()
    await page.route('**/*', route => {
      const url = route.request().url()
      if (url.includes('/api/')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 'widget-123' }) })
      return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: FORM_HTML })
    })
    await page.goto('http://smoke.local/form')
  } catch (e) { t.skip(`Chrome 不可用：${e.message}`); return }
  const rec = await maybeTestForm(page, CFG, '新增')
  assert.equal(rec.submitStatus, 'pass')
  assert.equal(rec.createdId, 'widget-123')
  await page.close()
})

test('maybeTestForm：编辑模式覆盖名称字段', async t => {
  let page
  try {
    if (!browser) browser = await chromium.launch({ headless: true, channel: 'chrome', args: ['--no-sandbox'] })
    page = await browser.newPage()
    await page.route('**/*', route => {
      const url = route.request().url()
      if (url.includes('/api/')) return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
      return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: FORM_HTML })
    })
    await page.goto('http://smoke.local/form')
    await page.fill('#f-name', 'SMOKE_旧名称')
  } catch (e) { t.skip(`Chrome 不可用：${e.message}`); return }
  const rec = await maybeTestForm(page, CFG, '编辑', null, { isEdit: true })
  assert.equal(rec.submitStatus, 'pass')
  assert.ok(rec.filled >= 1, '编辑模式应至少覆盖名称字段')
  const nameVal = await page.locator('#f-name').inputValue()
  assert.notEqual(nameVal, 'SMOKE_旧名称', '名称字段应被更新')
  assert.match(nameVal, /^SMOKE_/, '名称字段应保持 SMOKE_ 前缀')
  await page.close()
})

test('maybeTestForm：无提交按钮不提交', async t => {
  let page
  try {
    if (!browser) browser = await chromium.launch({ headless: true, channel: 'chrome', args: ['--no-sandbox'] })
    page = await browser.newPage()
    await page.setContent(`<html><body><form><input name="a"/><input name="b"/><button>搜索</button></form></body></html>`)
  } catch (e) { t.skip(`Chrome 不可用：${e.message}`); return }
  const rec = await maybeTestForm(page, CFG, null)
  assert.equal(rec.submitStatus, 'no-submit-button')
  assert.equal(rec.filled, 0, '无提交按钮时不应填充')
  await page.close()
  await browser?.close()
  browser = null
})
