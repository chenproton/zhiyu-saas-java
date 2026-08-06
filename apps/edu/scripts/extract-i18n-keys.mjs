#!/usr/bin/env node
/**
 * 提取代码中 t('...') / t("...") 的中文 key，生成/更新 messages/en.json。
 * 已有翻译保留，新 key 以空串占位（未翻译自动回退中文）。
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs'
import { join, extname } from 'node:path'

const ROOT = new URL('../', import.meta.url).pathname

function collect(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (name === 'node_modules' || name === '.next' || name === 'messages') continue
    if (statSync(p).isDirectory()) {
      collect(p, out)
    } else if (extname(p) === '.ts' || extname(p) === '.tsx') {
      out.push(p)
    }
  }
  return out
}

const files = collect(ROOT)

const keyRe = /\bt\(\s*(['"])((?:[^'"]|\\'|\\")*?)\1/g
const keys = new Set()
for (const f of files) {
  const src = readFileSync(f, 'utf8')
  for (const m of src.matchAll(keyRe)) {
    const key = m[2].replace(/\\'/g, "'").replace(/\\"/g, '"')
    if (key.includes('{') || /[\u4e00-\u9fff]/.test(key)) keys.add(key)
  }
}

const enPath = ROOT + 'messages/en.json'
let en = {}
try {
  en = JSON.parse(readFileSync(enPath, 'utf8'))
} catch {
  en = {}
}

const missing = []
for (const k of [...keys].sort()) {
  if (!(k in en)) {
    en[k] = ''
    missing.push(k)
  }
}
// 清理代码中已不存在的 key（避免死条目）
for (const k of Object.keys(en)) {
  if (!keys.has(k)) delete en[k]
}

writeFileSync(enPath, JSON.stringify(en, null, 2) + '\n')
console.log(`keys: ${keys.size}, missing (blank): ${missing.length}`)
if (missing.length > 0) console.log('missing sample:', missing.slice(0, 5).join(' | '))
