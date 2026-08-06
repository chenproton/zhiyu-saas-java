import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildQuery, request, setGlobalErrorHandler } from './api-helpers'

interface FakeLocation {
  pathname: string
  href: string
}

function fakeResponse(status: number, body: unknown): Response {
  return {
    status,
    ok: status >= 200 && status < 300,
    headers: { get: () => null },
    json: async () => body,
  } as unknown as Response
}

function fakeWindow(pathname: string): FakeLocation {
  const location: FakeLocation = { pathname, href: '' }
  ;(globalThis as Record<string, unknown>).window = { location }
  return location
}

function fakeLocalStorage() {
  const store = new Map<string, string>()
  ;(globalThis as Record<string, unknown>).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  }
  return store
}

describe('buildQuery', () => {
  it('拼接查询参数', () => {
    expect(buildQuery({ limit: 100, status: 'approved', page: 2 })).toBe(
      '?limit=100&status=approved&page=2',
    )
  })

  it('忽略 undefined 与空字符串', () => {
    expect(buildQuery({ a: undefined, b: '', c: 0, d: false })).toBe('?c=0&d=false')
  })

  it('空参数返回空字符串', () => {
    expect(buildQuery({})).toBe('')
  })
})

describe('request 401 处理', () => {
  const originalFetch = globalThis.fetch

  afterEach(() => {
    globalThis.fetch = originalFetch
    delete (globalThis as Record<string, unknown>).window
    delete (globalThis as Record<string, unknown>).localStorage
    setGlobalErrorHandler(null)
    vi.restoreAllMocks()
  })

  it('无 token 时 401 自动跳转登录页，且不再触发全局错误 toast', async () => {
    const location = fakeWindow('/portal/workspace')
    fakeLocalStorage()
    globalThis.fetch = vi.fn(async () => fakeResponse(401, { error: 'missing authorization header' }))
    const toast = vi.fn()
    setGlobalErrorHandler(toast)

    await expect(request('/some/api')).rejects.toThrow('missing authorization header')
    expect(location.href).toBe('/portal/login')
    expect(toast).not.toHaveBeenCalled()
  })

  it('有 token 时 401 清除 token 并跳转登录页', async () => {
    const location = fakeWindow('/portal/workspace')
    const store = fakeLocalStorage()
    store.set('zhiyu-portal-token', 'stale-token')
    globalThis.fetch = vi.fn(async () => fakeResponse(401, { error: 'token expired' }))

    await expect(request('/some/api')).rejects.toThrow('token expired')
    expect(store.get('zhiyu-portal-token')).toBeUndefined()
    expect(location.href).toBe('/portal/login')
  })

  it('已在登录页时 401 不跳转（避免死循环），错误仍抛出', async () => {
    const location = fakeWindow('/portal/login')
    fakeLocalStorage()
    globalThis.fetch = vi.fn(async () => fakeResponse(401, { error: '用户名或密码错误' }))

    await expect(request('/api/auth/portal/login')).rejects.toThrow('用户名或密码错误')
    expect(location.href).toBe('')
  })

  it('非 401 错误仍走全局错误处理器', async () => {
    fakeWindow('/portal/workspace')
    fakeLocalStorage()
    globalThis.fetch = vi.fn(async () => fakeResponse(403, { error: '权限不足' }))
    const toast = vi.fn()
    setGlobalErrorHandler(toast)

    await expect(request('/some/api')).rejects.toThrow('权限不足')
    expect(toast).toHaveBeenCalledWith('权限不足', 403, '/some/api')
  })
})
