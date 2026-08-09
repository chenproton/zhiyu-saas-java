/**
 * collectClickables 的浏览器集成测试（playwright + 本地静态 HTML）。
 * 环境无 Chrome 时自动跳过。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { chromium } from 'playwright'
import { buildDangerousRe, collectClickables } from '../clicker.mjs'

const CFG = {
  clickDangerous: false,
  allowIconButtons: false,
  localeSwitchWords: ['中文', 'English'],
}

const HTML = `
<html><body>
  <button id="view">查看</button>
  <button id="save">保存</button>
  <button id="icon-del" aria-label="删除"><svg></svg></button>
  <button id="icon-fold" aria-label="折叠面板"><svg></svg></button>
  <button id="icon-empty"><svg></svg></button>
  <a href="/inner">内链</a>
  <a href="https://external.com/x">外链</a>
  <div role="dialog" style="position:fixed;top:0;left:0;width:200px;height:200px">
    <button id="dlg-btn">弹窗内按钮</button>
  </div>
  <div role="alertdialog" style="position:fixed;top:0;left:300px;width:200px;height:200px">
    <button id="alert-btn">alert内按钮</button>
  </div>
</body></html>`

let browser
async function getPage() {
  if (!browser) browser = await chromium.launch({ headless: true, channel: 'chrome', args: ['--no-sandbox'] })
  const page = await browser.newPage()
  await page.setContent(HTML)
  return page
}

test('collectClickables：弹层排除/图标按钮防护/危险词过滤', async t => {
  let page
  try {
    page = await getPage()
  } catch (e) {
    t.skip(`Chrome 不可用：${e.message}`)
    return
  }
  const re = buildDangerousRe({ dangerousWords: ['保存', '删除'], dangerousWordsEn: [] })

  const pageScope = await collectClickables(page, CFG, re, 'page')
  const texts = pageScope.map(p => p.key)
  assert.ok(texts.some(k => k.includes('查看')), '普通按钮应被收集')
  assert.ok(texts.some(k => k.includes('/inner')), '站内链接应被收集')
  assert.ok(texts.some(k => k.includes('折叠面板')), '有 aria-label 的图标按钮应被收集')
  assert.ok(!texts.some(k => k.includes('保存')), '危险词按钮应被过滤')
  assert.ok(!texts.some(k => k.includes('删除')), '危险词 aria-label 图标按钮应被过滤')
  assert.ok(!texts.some(k => k.includes('external')), '外链应被过滤')
  assert.ok(!texts.some(k => k.includes('弹窗内按钮')), 'dialog 内元素应在 page 范围排除')
  assert.ok(!texts.some(k => k.includes('alert内按钮')), 'alertdialog 内元素应在 page 范围排除')
  assert.equal(texts.filter(k => /BUTTON\|\|/.test(k)).length, 0, '无文本无 label 的图标按钮应被跳过')

  const dlgScope = await collectClickables(page, CFG, re, 'dialog')
  const dlgTexts = dlgScope.map(p => p.key)
  assert.ok(dlgTexts.some(k => k.startsWith('dlg|') && k.includes('弹窗内按钮')), 'dialog 范围应收集弹窗内元素并加 dlg| 前缀')
  assert.ok(dlgTexts.some(k => k.includes('alert内按钮')), 'dialog 范围应包含 alertdialog 内元素')
  assert.ok(!dlgTexts.some(k => k.includes('查看')), 'dialog 范围不应包含弹层外元素')

  await page.close()
})

test('collectClickables：allowIconButtons 放开无文本按钮', async t => {
  let page
  try {
    page = await getPage()
  } catch (e) {
    t.skip(`Chrome 不可用：${e.message}`)
    return
  }
  const re = buildDangerousRe({ dangerousWords: ['保存', '删除'], dangerousWordsEn: [] })
  const items = await collectClickables(page, { ...CFG, allowIconButtons: true }, re, 'page')
  assert.ok(items.some(p => /BUTTON\|\|/.test(p.key)), '放开后无文本图标按钮应被收集')
  await page.close()
  await browser?.close()
  browser = null
})

test('collectClickables：testForms 触发词放行危险词', async t => {
  let page
  try {
    if (!browser) browser = await chromium.launch({ headless: true, channel: 'chrome', args: ['--no-sandbox'] })
    page = await browser.newPage()
    await page.setContent('<html><body><button>新增 课程</button><button>删除</button><button>查看</button></body></html>')
  } catch (e) { t.skip(`Chrome 不可用：${e.message}`); return }
  const re = buildDangerousRe({ dangerousWords: ['新增', '删除'], dangerousWordsEn: [] })
  const noTrigger = await collectClickables(page, CFG, re, 'page')
  assert.ok(!noTrigger.some(p => p.key.includes('新增')), '默认模式下新增被危险词过滤')
  const triggerRe = /^(?:新增|创建)/
  const withTrigger = await collectClickables(page, CFG, re, 'page', triggerRe)
  assert.ok(withTrigger.some(p => p.key.includes('新增')), '表单测试模式下新增入口应放行')
  assert.ok(!withTrigger.some(p => p.key.includes('删除')), '删除类仍被过滤')
  await page.close()
  await browser?.close()
  browser = null
})

test('collectClickables：动作分类 actionType 标注', async t => {
  let page
  try {
    if (!browser) browser = await chromium.launch({ headless: true, channel: 'chrome', args: ['--no-sandbox'] })
    page = await browser.newPage()
    await page.setContent('<html><body><button>新增</button><button>保存</button><button>删除</button><button>查看</button><a href="/x">内链</a></body></html>')
  } catch (e) { t.skip(`Chrome 不可用：${e.message}`); return }
  const cfg = {
    clickDangerous: true, allowIconButtons: false, localeSwitchWords: [],
    submitWords: ['保存'], submitWordsEn: [],
    destructiveWords: ['删除'], destructiveWordsEn: [],
    navWords: ['查看'], navWordsEn: [],
  }
  const re = buildDangerousRe({ dangerousWords: ['新增', '保存', '删除'], dangerousWordsEn: [] })
  const triggerRe = /^(?:新增|创建)/
  const items = await collectClickables(page, cfg, re, 'page', triggerRe)
  const byText = Object.fromEntries(items.map(p => [p.key.split('|')[1], p.actionType]))
  assert.equal(byText['新增'], 'form-trigger', '页面级新增应为表单入口')
  assert.equal(byText['保存'], 'submit')
  assert.equal(byText['删除'], 'destructive')
  assert.equal(byText['查看'], 'nav')
  assert.equal(byText['内链'], 'nav')
  await page.close()
  await browser?.close()
  browser = null
})
