/**
 * 报告：错误聚合去重、基线回归 diff（新增/已修复/持续）、输出。
 */
import { promises as fs } from 'fs'

// API 响应分类：auth（401/403，不计错误）/ rate-limit（429，不计错误）/ ignore（动态详情页 404）/ api（真实错误）
export function classifyApiResponse(status, { isDynamicRoute = false, dynamicIgnore404 = true } = {}) {
  if (status === 401 || status === 403) return 'auth'
  if (status === 429) return 'rate-limit'
  if (status === 404 && isDynamicRoute && dynamicIgnore404) return 'ignore'
  return 'api'
}

// 断点续跑：按 角色:路由 记录已完成（ok/skip），避免跨角色误跳过
export function buildResumeDoneSet(prevReport) {
  const done = new Set()
  for (const role of Object.keys(prevReport?.results || {})) {
    for (const rt of prevReport.results[role]?.routes || []) {
      if (rt.status === 'ok' || rt.status === 'skip') done.add(`${role}:${rt.route}`)
    }
  }
  return done
}

// 错误签名归一化：去掉动态 id / 数字参数，用于跨运行对比与聚合
export function errorSignature(route, err) {
  const msg = String(err.message || '')
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '{id}')
    .replace(/\d+/g, '{n}')
    .slice(0, 120)
  return `${route}|${err.type}|${msg}`
}

// 聚合：同一签名只保留一条，附出现次数与出现页面列表
export function aggregateErrors(results) {
  const bySig = new Map()
  for (const role of Object.keys(results)) {
    const r = results[role]
    if (!r || r.login !== 'ok') continue
    for (const rt of r.routes || []) {
      for (const err of rt.errors || []) {
        const sig = errorSignature(rt.route, err)
        if (!bySig.has(sig)) {
          bySig.set(sig, { ...err, count: 0, routes: new Set(), role: new Set() })
        }
        const agg = bySig.get(sig)
        agg.count++
        agg.routes.add(rt.route)
        agg.role.add(role)
      }
    }
  }
  return [...bySig.values()].map(a => ({
    type: a.type,
    message: a.message,
    count: a.count,
    routes: [...a.routes].sort(),
    roles: [...a.role].sort(),
  })).sort((a, b) => b.count - a.count)
}

// 基线 diff：与上次报告对比，输出新增/已修复/持续
export async function diffWithBaseline(baselineFile, results) {
  let baseline
  try {
    baseline = JSON.parse(await fs.readFile(baselineFile, 'utf8'))
  } catch {
    console.warn(`  [baseline] 无法读取基线报告 ${baselineFile}，跳过 diff`)
    return null
  }

  const prev = new Set()
  for (const role of Object.keys(baseline.results || {})) {
    const r = baseline.results[role]
    for (const rt of r?.routes || []) {
      for (const err of rt.errors || []) {
        prev.add(errorSignature(rt.route, err))
      }
    }
  }

  const cur = new Set()
  const curRoutes = []
  for (const role of Object.keys(results)) {
    const r = results[role]
    for (const rt of r?.routes || []) {
      curRoutes.push(rt)
      for (const err of rt.errors || []) {
        cur.add(errorSignature(rt.route, err))
      }
    }
  }

  const newErrors = [...cur].filter(s => !prev.has(s))
  const fixedErrors = [...prev].filter(s => !cur.has(s))
  const persistentErrors = [...cur].filter(s => prev.has(s))

  return { newErrors, fixedErrors, persistentErrors }
}

export function printDiff(diff) {
  if (!diff) return
  console.log('\n========== 回归对比（相对基线） ==========')
  console.log(`  新增错误: ${diff.newErrors.length}  已修复: ${diff.fixedErrors.length}  持续存在: ${diff.persistentErrors.length}`)
  if (diff.newErrors.length) {
    console.log('\n  ⚠ 新增错误（重构可能引入）：')
    for (const s of diff.newErrors.slice(0, 30)) console.log(`    + ${s}`)
    if (diff.newErrors.length > 30) console.log(`    ... 其余 ${diff.newErrors.length - 30} 条见报告`)
  }
  if (diff.fixedErrors.length) {
    console.log('\n  ✓ 已修复：')
    for (const s of diff.fixedErrors.slice(0, 15)) console.log(`    - ${s}`)
  }
}

export async function writeReport(reportPath, report) {
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2))
}

export function printSummary(results, aggregate, diff, totalErrors, cfg) {
  console.log('\n========== 巡检报告 ==========')
  for (const role of Object.keys(results)) {
    const r = results[role]
    if (!r || r.login !== 'ok') { console.log(`\n[${role}] 登录失败，未巡检`); continue }
    const errRoutes = r.routes.filter(x => x.errors.length)
    const skipped = r.routes.filter(x => x.status === 'skip').length
    console.log(`\n[${role}] 页面 ${r.routes.length} 个，跳过 ${skipped} 个，出错 ${errRoutes.length} 个`)
    if (cfg?.verbose) {
      const infoCount = r.routes.reduce((acc, x) => acc + (x.info?.length || 0), 0)
      if (infoCount) console.log(`  （信息类信号 ${infoCount} 条：401/403/429，不计错误，见报告 info 字段）`)
    }
    const formRecs = r.routes.flatMap(x => x.forms || [])
    if (formRecs.length) {
      const pass = formRecs.filter(f => f.submitStatus === 'pass').length
      const err = formRecs.filter(f => f.submitStatus === 'error').length
      const other = formRecs.length - pass - err
      console.log(`  表单测试 ${formRecs.length} 次：通过 ${pass}，失败 ${err}，未发出请求 ${other}`)
      for (const f of formRecs.filter(f => f.submitStatus === 'error').slice(0, 5)) {
        console.log(`    ✗ ${f.trigger} → ${f.apiResult?.status} ${f.apiResult?.method} ${f.apiResult?.url}`)
      }
    }
    for (const rt of errRoutes.slice(0, 20)) {
      console.log(`  ✗ ${rt.route}（点击 ${rt.clicks} 次）`)
      for (const e of rt.errors.slice(0, 5)) console.log(`      [${e.type}] ${e.message.split('\n')[0]}`)
    }
    if (errRoutes.length > 20) console.log(`    ... 其余 ${errRoutes.length - 20} 个出错页面见报告`)
  }

  if (aggregate.length) {
    console.log('\n========== 错误聚合（去重后） ==========')
    for (const a of aggregate.slice(0, 15)) {
      console.log(`  [${a.type}] x${a.count} ${a.message.split('\n')[0].slice(0, 110)}`)
      console.log(`       页面: ${a.routes.slice(0, 6).join(', ')}${a.routes.length > 6 ? ` ...等${a.routes.length}个` : ''}`)
    }
    if (aggregate.length > 15) console.log(`  ... 其余 ${aggregate.length - 15} 类错误见报告`)
  }

  printDiff(diff)
  console.log(`\n共 ${totalErrors} 个页面发现问题`)
}
