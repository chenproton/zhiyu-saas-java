import { chromium } from './node_modules/playwright-core/index.mjs'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { execSync } = require('node:child_process')
const BASE = 'http://127.0.0.1'

const browser = await chromium.launch({ headless: true, channel: 'chrome' })
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message))

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

const dumpTile = async (tag) => {
  const info = await page.evaluate(() => {
    const tile = document.querySelector('div[class*="index-module_tile"]')
    const body = document.querySelector('div[class*="module_body"]')
    const cs = getComputedStyle(tile)
    const bcs = getComputedStyle(body)
    const r = tile.getBoundingClientRect()
    const br = body.getBoundingClientRect()
    return {
      tileClass: tile.className,
      tileInlineLeft: tile.style.left,
      tileLeft: r.left, tileTop: r.top,
      bodyLeft: br.left, bodyTop: br.top,
      tilePos: cs.position, bodyPos: bcs.position,
      tileCssLeft: cs.left,
      bodyCssPos: bcs.position,
      bodyClass: body.className,
    }
  })
  console.log(`[${tag}]`, JSON.stringify(info))
}
await dumpTile('初始')

const db = await page.locator('div[class*="dragBlock"]').first().boundingBox()
const ratio = (300 - captcha.thumbWidth - captcha.thumbX) / (300 - db.width)
const delta = (ansX - captcha.thumbX) / ratio

// 逐步拖动并采样
await page.mouse.move(db.x + db.width / 2, db.y + db.height / 2)
await page.mouse.down()
for (let i = 1; i <= 4; i++) {
  await page.mouse.move(db.x + db.width / 2 + (delta * i) / 4, db.y + db.height / 2, { steps: 3 })
  await page.waitForTimeout(150)
  await dumpTile('拖动中 ' + i + '/4')
}
await page.mouse.up()
await page.waitForTimeout(400)
await dumpTile('松手后')
console.log('答案 ansX:', ansX, 'thumbX:', captcha.thumbX, 'thumbY:', captcha.thumbY)

await browser.close()
