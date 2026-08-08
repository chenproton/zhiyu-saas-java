import { chromium } from 'playwright'
const browser = await chromium.launch({ headless: true, channel: 'chrome', args: ['--no-sandbox'] })
const ctx = await browser.newContext({ storageState: '/tmp/zhiyu-ui-smoke/state-teacher.json' })
const page = await ctx.newPage()
page.on('console', m => {
  if (m.type() === 'error') console.log('[console-error]', m.text().slice(0, 120))
})
page.on('pageerror', e => console.log('[pageerror]', e.message.slice(0, 120)))
await page.goto('http://127.0.0.1/portal/apps/system/tenant')
await page.waitForTimeout(2500)
await page.evaluate(() => {
  window.__appeared = []
  const obs = new MutationObserver(() => {
    document.querySelectorAll('[role="dialog"], [data-slot="sheet-content"], [data-slot="dropdown-menu-content"]').forEach(d => {
      const key = (d.getAttribute('aria-labelledby') || 'NO-LABEL') + '|' + (d.getAttribute('data-slot') || '')
      if (!window.__appeared.some(x => x.key === key)) {
        window.__appeared.push({ key, html: d.outerHTML.slice(0, 500) })
      }
    })
  })
  obs.observe(document.body, { subtree: true, childList: true })
})
await page.click('text=巡检-教师')
await page.waitForTimeout(800)
const arr = await page.evaluate(() => window.__appeared)
console.log('overlays appeared after opening user menu:', arr.length)
arr.forEach(d => { console.log('---', d.key); console.log(d.html.slice(0, 300)) })
await browser.close()
