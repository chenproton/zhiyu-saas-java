import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildDangerousRe, buildEditRe, buildDeleteRe, buildEnableRe, buildDisableRe } from '../clicker.mjs'
import { errorSignature, aggregateErrors, classifyApiResponse, buildResumeDoneSet, isTransientError } from '../report.mjs'
import { resolveImportCandidates } from '../routes.mjs'

const CFG = {
  dangerousWords: ['保存', '提交', '删除'],
  dangerousWordsEn: ['Save', 'Delete', 'Submit'],
}

test('危险词中英双语匹配', () => {
  const re = buildDangerousRe(CFG)
  assert.ok(re.test('保存草稿'), '中文危险词应命中')
  assert.ok(re.test('提交审批'), '中文危险词应命中')
  assert.ok(re.test('Save Draft'), '英文危险词应命中')
  assert.ok(re.test('Delete Item'), '英文危险词应命中')
  assert.ok(!re.test('编辑'), '普通按钮不应命中')
  assert.ok(!re.test('查看详情'), '普通按钮不应命中')
})

test('危险词正则转义', () => {
  const cfg = { dangerousWords: ['a+b'], dangerousWordsEn: [] }
  const re = buildDangerousRe(cfg)
  assert.ok(re.test('a+b'), '正则特殊字符应被转义')
  assert.ok(!re.test('aab'), '不应误匹配')
})

test('错误签名归一化动态 id 与数字', () => {
  const uuid1 = '12345678-1234-1234-1234-1234567890ab'
  const uuid2 = 'abcdef01-2345-6789-abcd-ef0123456789'
  const s1 = errorSignature('/a', { type: 'api', message: `500 GET /api/v1/x/${uuid1}` })
  const s2 = errorSignature('/a', { type: 'api', message: `500 GET /api/v1/x/${uuid2}` })
  assert.equal(s1, s2, '不同 uuid 应归一化为同一签名')
  const s3 = errorSignature('/a', { type: 'api', message: '500 GET /api/v1/x?limit=100' })
  const s4 = errorSignature('/a', { type: 'api', message: '500 GET /api/v1/x?limit=200' })
  assert.equal(s3, s4, '数字参数应归一化')
  const s5 = errorSignature('/b', { type: 'api', message: '500 GET /api/v1/x?limit=100' })
  assert.notEqual(s3, s5, '不同路由应区分')
})

test('错误聚合去重', () => {
  const results = {
    school: {
      login: 'ok',
      routes: [
        { route: '/a', errors: [{ type: 'api', message: '500 GET /api/v1/eval?limit=100' }] },
        { route: '/b', errors: [{ type: 'api', message: '500 GET /api/v1/eval?limit=200' }] },
        { route: '/a', errors: [{ type: 'console', message: 'boom' }] },
      ],
    },
    teacher: {
      login: 'ok',
      routes: [
        { route: '/a', errors: [{ type: 'api', message: '500 GET /api/v1/eval?limit=1' }] },
      ],
    },
  }
  const agg = aggregateErrors(results)
  const aApi = agg.find(a => a.type === 'api' && a.routes.length === 1 && a.routes[0] === '/a')
  assert.equal(aApi.count, 2, '/a 的 api 错误跨角色应聚合')
  assert.deepEqual(aApi.roles.sort(), ['school', 'teacher'])
  assert.equal(agg.length, 3, '3 类签名：/a api、/b api、/a console')
})

test('API 响应分类：401/403→auth，429→rate-limit，动态页 404→ignore，5xx→api', () => {
  assert.equal(classifyApiResponse(401), 'auth')
  assert.equal(classifyApiResponse(403), 'auth')
  assert.equal(classifyApiResponse(429), 'rate-limit')
  assert.equal(classifyApiResponse(404, { isDynamicRoute: true }), 'ignore')
  assert.equal(classifyApiResponse(404, { isDynamicRoute: true, dynamicIgnore404: false }), 'api')
  assert.equal(classifyApiResponse(404, { isDynamicRoute: false }), 'api')
  assert.equal(classifyApiResponse(500), 'api')
  assert.equal(classifyApiResponse(400), 'api')
})

test('瞬态错误识别：502/503/504 与连接错误可重试，5xx 业务错误不可重试', () => {
  assert.ok(isTransientError({ type: 'api', message: '502 GET /api/v1/settings/theme' }))
  assert.ok(isTransientError({ type: 'api', message: '503 GET /api/v1/settings/theme' }))
  assert.ok(isTransientError({ type: 'api', message: '504 POST /api/v1/x' }))
  assert.ok(isTransientError({ type: 'console', message: 'Failed to load resource: the server responded with a status of 502 (Bad Gateway)' }))
  assert.ok(isTransientError({ type: 'network', message: 'net::ERR_CONNECTION_REFUSED GET /api/v1/x' }))
  assert.ok(isTransientError({ type: 'page', message: 'net::ERR_CONNECTION_REFUSED at http://127.0.0.1/affairs/relations' }))
  assert.ok(!isTransientError({ type: 'api', message: '500 GET /api/v1/settings/theme' }))
  assert.ok(!isTransientError({ type: 'api', message: '400 GET /api/v1/settings/theme' }))
  assert.ok(!isTransientError({ type: 'console', message: 'TypeError: Cannot read properties of undefined' }))
})

test('断点续跑按 角色:路由 记录', () => {
  const prev = {
    results: {
      school: { routes: [{ route: '/a', status: 'ok' }, { route: '/b', status: 'error' }] },
      teacher: { routes: [{ route: '/a', status: 'error' }, { route: '/c', status: 'skip' }] },
    },
  }
  const done = buildResumeDoneSet(prev)
  assert.ok(done.has('school:/a'), 'school 已完成 /a')
  assert.ok(!done.has('school:/b'), 'error 不算完成')
  assert.ok(!done.has('teacher:/a'), 'teacher 的 /a 上次出错，不能因 school 完成而跳过')
  assert.ok(done.has('teacher:/c'), 'skip 也算完成')
})

test('import 解析：@/ 别名与相对路径', () => {
  const alias = resolveImportCandidates('app/portal/page.tsx', '@/components/foo')
  assert.ok(alias.includes('components/foo.tsx'))
  const rel = resolveImportCandidates('app/portal/apps/system/page.tsx', './_components/bar')
  assert.ok(rel.includes('app/portal/apps/system/_components/bar.tsx'), `相对路径应相对引用者目录解析，得到 ${rel[0]}`)
  const up = resolveImportCandidates('app/lesson/admin/page.tsx', '../_components/baz')
  assert.ok(up.includes('app/lesson/_components/baz.tsx'))
  assert.deepEqual(resolveImportCandidates('app/x/page.tsx', 'react'), [])
})

test('CRUD 动作词正则（中英双语）', () => {
  const cfg = {
    editWords: ['编辑', '修改'], editWordsEn: ['Edit', 'Modify'],
    deleteWords: ['删除'], deleteWordsEn: ['Delete', 'Remove'],
    enableWords: ['启用', '激活'], enableWordsEn: ['Enable', 'Activate'],
    disableWords: ['禁用', '停用'], disableWordsEn: ['Disable', 'Deactivate'],
  }
  assert.ok(buildEditRe(cfg).test('编辑'))
  assert.ok(buildEditRe(cfg).test('Edit'))
  assert.ok(buildDeleteRe(cfg).test('删除'))
  assert.ok(buildDeleteRe(cfg).test('Remove'))
  assert.ok(buildEnableRe(cfg).test('启用'))
  assert.ok(buildEnableRe(cfg).test('Activate'))
  assert.ok(buildDisableRe(cfg).test('停用'))
  assert.ok(buildDisableRe(cfg).test('Deactivate'))
  assert.ok(!buildDeleteRe(cfg).test('编辑器'))
})

test('routeCfg 路由覆盖：前缀匹配最长优先', async () => {
  const { routeCfg } = await import('../clicker.mjs')
  const cfg = {
    maxClicks: 100,
    routeOverrides: {
      '/scene': { maxClicks: 10 },
      '/scene/scenarios': { maxClicks: 5, maxFormSubmits: 0 },
    },
  }
  assert.equal(routeCfg(cfg, '/scene/scenarios').maxClicks, 5)
  assert.equal(routeCfg(cfg, '/scene/scenarios/abc').maxClicks, 5, '子路径应命中前缀')
  assert.equal(routeCfg(cfg, '/scene/other').maxClicks, 10)
  assert.equal(routeCfg(cfg, '/other').maxClicks, 100)
  assert.equal(routeCfg(cfg, '/scene/scenarios').maxFormSubmits, 0, '覆盖项应合并')
})
