import { describe, it, expect } from 'vitest'
import { unzipSync, strFromU8 } from 'fflate'
import { isZipUrl, fixName } from './zip-preview'

describe('isZipUrl', () => {
  it('识别 .zip 结尾的 url（大小写不敏感）', () => {
    expect(isZipUrl('/uploads/a.zip')).toBe(true)
    expect(isZipUrl('/uploads/a.ZIP')).toBe(true)
    expect(isZipUrl('https://example.com/a.zip?x=1')).toBe(false)
  })

  it('非 zip 返回 false', () => {
    expect(isZipUrl('/uploads/a.rar')).toBe(false)
    expect(isZipUrl('/uploads/a.7z')).toBe(false)
    expect(isZipUrl('/uploads/a.pdf')).toBe(false)
    expect(isZipUrl('')).toBe(false)
    expect(isZipUrl(null)).toBe(false)
    expect(isZipUrl(undefined)).toBe(false)
  })
})

// 手工构造 zip：文件名按 UTF-8 字节写入，但不置位 UTF-8 标志（bit 11），
// 模拟 macOS Archive Utility / Finder 生成的压缩包。
function makeMacStyleZip(files: { name: string; data: Uint8Array }[]): Uint8Array {
  const enc = new TextEncoder()
  const parts: Uint8Array[] = []
  const central: Uint8Array[] = []
  let offset = 0
  for (const { name, data } of files) {
    const nb = enc.encode(name)
    const lh = new Uint8Array(30)
    const dv = new DataView(lh.buffer)
    dv.setUint32(0, 0x04034b50, true)
    dv.setUint16(4, 20, true)
    dv.setUint16(6, 0, true) // flags=0，不置 UTF-8 位
    dv.setUint16(8, 0, true) // stored
    dv.setUint32(14, 0, true) // crc（空文件）
    dv.setUint32(18, data.length, true)
    dv.setUint32(22, data.length, true)
    dv.setUint16(26, nb.length, true)
    parts.push(lh, nb, data)

    const ch = new Uint8Array(46)
    const cv = new DataView(ch.buffer)
    cv.setUint32(0, 0x02014b50, true)
    cv.setUint16(4, 20, true)
    cv.setUint16(6, 20, true)
    cv.setUint16(8, 0, true)
    cv.setUint32(16, 0, true)
    cv.setUint32(20, data.length, true)
    cv.setUint32(24, data.length, true)
    cv.setUint16(28, nb.length, true)
    cv.setUint32(42, offset, true)
    central.push(ch, nb)
    offset += 30 + nb.length + data.length
  }
  const cdSize = central.reduce((s, u) => s + u.length, 0)
  const eocd = new Uint8Array(22)
  const ev = new DataView(eocd.buffer)
  ev.setUint32(0, 0x06054b50, true)
  ev.setUint16(8, files.length, true)
  ev.setUint16(10, files.length, true)
  ev.setUint32(12, cdSize, true)
  ev.setUint32(16, offset, true)
  const all = [...parts, ...central, eocd]
  const out = new Uint8Array(all.reduce((s, u) => s + u.length, 0))
  let p = 0
  for (const u of all) {
    out.set(u, p)
    p += u.length
  }
  return out
}

describe('fixName（macOS 压缩包文件名乱码修复）', () => {
  it('还原 fflate latin1 解码的 UTF-8 中文名', () => {
    const bytes = new TextEncoder().encode('测试.txt')
    const mojibake = strFromU8(bytes, true)
    expect(fixName(mojibake)).toBe('测试.txt')
  })

  it('还原 GBK 编码的中文名', () => {
    // GBK: 中=D6D0 文=CEC4
    const gbk = String.fromCharCode(0xd6, 0xd0, 0xce, 0xc4, 0x2e, 0x74, 0x78, 0x74)
    expect(fixName(gbk)).toBe('中文.txt')
  })

  it('正常 UTF-8 名称原样返回', () => {
    expect(fixName('中文文件.txt')).toBe('中文文件.txt')
    expect(fixName('readme.txt')).toBe('readme.txt')
  })

  it('真实 latin1 名称不受影响', () => {
    expect(fixName('café.txt')).toBe('café.txt')
  })

  it('端到端：mac 风格 zip 解压后文件名不乱码', () => {
    const zip = makeMacStyleZip([
      { name: '测试.txt', data: new Uint8Array() },
      { name: '照片.png', data: new Uint8Array() },
      { name: 'README', data: new Uint8Array() },
    ])
    const files = unzipSync(zip)
    const names = Object.keys(files).map(fixName)
    expect(names.sort()).toEqual(['README', '测试.txt', '照片.png'].sort())
  })
})
