import { chromium } from './node_modules/playwright-core/index.mjs'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { execSync } = require('node:child_process')
const BASE = 'http://127.0.0.1'

const browser = await chromium.launch({ headless: true, channel: 'chrome' })
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
const consoleErrors = []
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()) })
page.on('pageerror', (e) => consoleErrors.push('PAGEERROR: ' + e.message))

let captcha = null
page.on('response', async (r) => { if (r.url().includes('/auth/captcha')) captcha = await r.json() })

await page.goto(`${BASE}/portal/login`, { waitUntil: 'domcontentloaded' })
await page.fill('#username', 'no-such-user-x')
await page.fill('#password', 'badpass123')
for (let i = 0; i < 3; i++) { await page.click('button[type=submit]'); await page.waitForTimeout(1000) }
await page.click('button[type=submit]')
await page.waitForTimeout(2500)

// 1. 检查官方 CSS 是否加载
const cssLoaded = await page.evaluate(() => {
  for (const sheet of document.styleSheets) {
    let rules = []
    try { rules = sheet.cssRules } catch { continue }
    for (const r of rules) {
      if (r.selectorText && r.selectorText.includes('dragBlock')) return { href: sheet.href, sel: r.selectorText }
    }
  }
  return null
})
console.log('CSS dragBlock 规则:', JSON.stringify(cssLoaded))

// 2. 组件结构 dump
const structure = await page.evaluate(() => {
  const wrapper = document.querySelector('div[style*="324px"]')
  if (!wrapper) return 'wrapper not found'
  const cls = (el) => el.className
  return {
    wrapper: cls(wrapper) + ' style=' + wrapper.getAttribute('style'),
    children: Array.from(wrapper.children).map((c) => ({ tag: c.tagName, cls: cls(c), style: c.getAttribute('style') })),
    footer: wrapper.lastElementChild?.outerHTML?.slice(0, 500),
  }
})
console.log('组件结构:', JSON.stringify(structure, null, 1))

// 3. 拖拼图块（用户可能这样操作）
const img = await page.locator('img[src*="data:image/jpeg"]').first().boundingBox()
const tileImg = await page.locator('img[src*="data:image/png"]').first().boundingBox()
const ans = execSync(`docker exec zhiyu-redis redis-cli GET zhiyu:captcha:answer:${captcha.captchaId}`).toString().trim()
const [ansX] = ans.split(',').map(Number)
// 拼图块中心按下，拖到缺口位置
const tileCenterX = tileImg.x + tileImg.width / 2
const targetX = img.x + ansX
await page.mouse.move(tileCenterX, tileImg.y + tileImg.height / 2)
await page.mouse.down()
await page.mouse.move(targetX, tileImg.y + tileImg.height / 2, { steps: 15 })
await page.mouse.up()
await page.waitForTimeout(600)
let tileAfter = await page.locator('img[src*="data:image/png"]').first().boundingBox()
console.log('拖拼图块: 拖动前 x=' + Math.round(tileImg.x) + ' 拖动后 x=' + Math.round(tileAfter.x) + ' ->', tileAfter.x !== tileImg.x ? '拼图块移动了' : '❌ 拼图块没动（拖拼图块无效）')

// 4. 拖轨道滑块（官方正确交互）
const db = await page.locator('div[class*="dragBlock"]').first().boundingBox()
console.log('dragBlock 位置:', JSON.stringify(db), 'class:', await page.locator('div[class*="dragBlock"]').first().getAttribute('class'))
await page.screenshot({ path: '/tmp/captcha-structure.png' })
const tile2 = await page.locator('img[src*="data:image/png"]').first().boundingBox()
const ratio = (300 - captcha.thumbWidth - captcha.thumbX) / (300 - db.width)
const delta = (ansX - captcha.thumbX) / ratio
await page.mouse.move(db.x + db.width / 2, db.y + db.height / 2)
await page.mouse.down()
await page.mouse.move(db.x + db.width / 2 + delta, db.y + db.height / 2, { steps: 20 })
await page.mouse.up()
await page.waitForTimeout(600)
const tile3 = await page.locator('img[src*="data:image/png"]').first().boundingBox()
const gap = Math.abs(tile3.x - (img.x + ansX))
console.log(`拖轨道滑块: 拼图块 x=${Math.round(tile3.x)} 缺口 x=${Math.round(img.x + ansX)} 偏差 ${Math.round(gap)}px ->`, gap <= 8 ? '✅ 视觉对齐' : '未对齐')

// 5. 提交验证
const submitted = []
page.on('request', (r) => { if (r.url().includes('/auth/portal/login')) submitted.push(r.postData()) })
await page.click('button[type=submit]')
await page.waitForTimeout(2000)
const p = submitted.length ? JSON.parse(submitted.at(-1)) : null
console.log('提交:', p ? `(${p.captchaX}, ${p.captchaY})` : '无请求', '| console 错误:', consoleErrors.length ? consoleErrors : '无')

await browser.close()
