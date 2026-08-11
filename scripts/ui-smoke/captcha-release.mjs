import { chromium } from './node_modules/playwright-core/index.mjs'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { execSync } = require('node:child_process')
const BASE = 'http://127.0.0.1'

const browser = await chromium.launch({ headless: true, channel: 'chrome' })
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })

let captcha = null
page.on('response', async (r) => { if (r.url().includes('/auth/captcha')) captcha = await r.json() })

await page.goto(`${BASE}/portal/login`, { waitUntil: 'domcontentloaded' })
await page.fill('#username', 'no-such-user-x')
await page.fill('#password', 'badpass123')
for (let i = 0; i < 3; i++) { await page.click('button[type=submit]'); await page.waitForTimeout(1000) }
await page.click('button[type=submit]')
await page.waitForTimeout(2500)

const ans = execSync(`docker exec zhiyu-redis redis-cli GET zhiyu:captcha:answer:${captcha.captchaId}`).toString().trim()
const [ansX] = ans.split(',').map(Number)

// 用户真实操作：拖 footer 滑块到拼图块对齐缺口，鼠标终点 = 图片上的缺口位置（不在 dragBar 内）
const db = await page.locator('div[class*="dragBlock"]').first().boundingBox()
const img = await page.locator('img[src*="data:image/jpeg"]').first().boundingBox()
const ratio = (300 - captcha.thumbWidth - captcha.thumbX) / (300 - db.width)
const delta = (ansX - captcha.thumbX) / ratio

await page.mouse.move(db.x + db.width / 2, db.y + db.height / 2)
await page.mouse.down()
// 拖动过程：鼠标沿图片上拼图块轨迹移动，终点 = 缺口位置（图片上）
await page.mouse.move(img.x + ansX, db.y + db.height / 2, { steps: 20 })
await page.waitForTimeout(200)
const tilePos1 = await page.evaluate(() => document.querySelector('div[class*="index-module_tile"]').getBoundingClientRect().left)
console.log('松手前拼图块 left:', Math.round(tilePos1), '(应在缺口', Math.round(img.x + ansX), ')')
// 松手位置 = 图片上的缺口处（用户视角：鼠标跟着拼图块）
await page.mouse.up()
await page.waitForTimeout(600)
const tilePos2 = await page.evaluate(() => document.querySelector('div[class*="index-module_tile"]').getBoundingClientRect().left)
console.log('松手后拼图块 left:', Math.round(tilePos2), '->', tilePos2 !== tilePos1 ? '弹回起点（用户看到没反应）' : '停在缺口')

// 点登录，看是否提交验证码坐标
const submitted = []
page.on('request', (r) => { if (r.url().includes('/auth/portal/login')) submitted.push(r.postData()) })
await page.click('button[type=submit]')
await page.waitForTimeout(2000)
const p = submitted.length ? JSON.parse(submitted.at(-1)) : null
console.log('提交:', p ? `captchaX=${p.captchaX}` : '无请求(confirm未触发)')
console.log('页面错误:', await page.locator('.text-destructive').first().textContent().catch(() => 'none'))

await browser.close()
