#!/usr/bin/env node
/**
 * 知育前端全站点击巡检工具（UI Smoke Test）入口。
 * 用法见 --help 或 README.md。
 */
import { main } from './main.mjs'

main().catch(e => { console.error(e); process.exit(1) })
