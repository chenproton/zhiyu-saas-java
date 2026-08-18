import { describe, expect, it, beforeEach } from 'vitest'
import { getServiceClickCounts, recordServiceClick } from './frequent-services'

const memoryStore = new Map<string, string>()

function installStorageMock() {
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => memoryStore.get(key) ?? null,
      setItem: (key: string, value: string) => void memoryStore.set(key, value),
      removeItem: (key: string) => void memoryStore.delete(key),
      clear: () => memoryStore.clear(),
    },
  })
}

describe('frequent-services', () => {
  beforeEach(() => {
    installStorageMock()
    memoryStore.clear()
  })

  it('初始无记录时返回空对象', () => {
    expect(getServiceClickCounts()).toEqual({})
  })

  it('记录点击次数并累加', () => {
    recordServiceClick('/job/positions')
    recordServiceClick('/job/positions')
    recordServiceClick('/scene')
    const counts = getServiceClickCounts()
    expect(counts['/job/positions']).toBe(2)
    expect(counts['/scene']).toBe(1)
  })

  it('localStorage 数据损坏时安全返回空对象', () => {
    globalThis.localStorage.setItem('zhiyu-portal-service-clicks', 'not-json{')
    expect(getServiceClickCounts()).toEqual({})
  })
})
