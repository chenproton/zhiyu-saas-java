import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildDangerousRe } from '../clicker.mjs'
import { errorSignature, aggregateErrors } from '../report.mjs'

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
