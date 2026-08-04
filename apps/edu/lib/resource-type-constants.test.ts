import { describe, it, expect } from 'vitest'
import {
  resourceTypeAccept,
  resourceTypeExtensionMap,
  validateResourceFile,
  DOCUMENT_EXTS,
  SPREADSHEET_EXTS,
  IMAGE_EXTS,
  AUDIO_EXTS,
  VIDEO_EXTS,
  ARCHIVE_EXTS,
  SOFTWARE_EXTS,
} from './resource-type-constants'

describe('resource-type-constants 与 kkFileView 支持格式对齐', () => {
  const allExts = [
    ...DOCUMENT_EXTS,
    ...SPREADSHEET_EXTS,
    ...IMAGE_EXTS,
    ...AUDIO_EXTS,
    ...VIDEO_EXTS,
    ...ARCHIVE_EXTS,
    ...SOFTWARE_EXTS,
  ]

  it('accept 字符串与 extensionMap 完全一致', () => {
    for (const [type, exts] of Object.entries(resourceTypeExtensionMap)) {
      if (exts.length === 0) continue
      const acceptList = resourceTypeAccept[type].split(',').filter(Boolean)
      expect(acceptList.map((e) => e.slice(1))).toEqual(exts)
    }
  })

  it('所有 kkFileView 支持格式均可通过 validateResourceFile 校验', () => {
    const fake = (name: string) => new File(['x'], name)
    const typeOf = (ext: string): string => {
      if (DOCUMENT_EXTS.includes(ext)) return 'document'
      if (SPREADSHEET_EXTS.includes(ext)) return 'spreadsheet'
      if (IMAGE_EXTS.includes(ext)) return 'image'
      if (AUDIO_EXTS.includes(ext)) return 'audio'
      if (VIDEO_EXTS.includes(ext)) return 'video'
      if (ARCHIVE_EXTS.includes(ext)) return 'archive'
      if (SOFTWARE_EXTS.includes(ext)) return 'software'
      return 'other'
    }
    for (const ext of allExts) {
      expect(validateResourceFile(fake(`file.${ext}`), typeOf(ext))).toBeNull()
    }
  })

  it('未收录格式返回错误提示', () => {
    expect(validateResourceFile(new File(['x'], 'a.exe.jsx'), 'document')).toMatch(
      '不支持的文件格式',
    )
  })
})
