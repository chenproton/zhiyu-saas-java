import { describe, it, expect } from 'vitest'
import { getStatusConfig } from './status'

describe('getStatusConfig', () => {
  it('返回已知状态的中文配置', () => {
    const cfg = getStatusConfig('draft')
    expect(cfg.label).toBe('草稿')
    expect(cfg.color).toBeTruthy()
    expect(cfg.bg).toBeTruthy()
  })

  it('未知状态返回默认配置而非抛错', () => {
    const cfg = getStatusConfig('unknown_status_xyz')
    expect(cfg).toBeTruthy()
    expect(typeof cfg.label).toBe('string')
  })
})
