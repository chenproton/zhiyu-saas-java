import { describe, it, expect } from 'vitest'
import { isFileViewerUrl } from './file-viewer-preview'

describe('isFileViewerUrl', () => {
  it('office/pdf/文本类型返回 true（大小写不敏感）', () => {
    expect(isFileViewerUrl('/uploads/a.docx')).toBe(true)
    expect(isFileViewerUrl('/uploads/a.DOC')).toBe(true)
    expect(isFileViewerUrl('/uploads/a.pdf')).toBe(true)
    expect(isFileViewerUrl('/uploads/a.xlsx')).toBe(true)
    expect(isFileViewerUrl('/uploads/a.pptx')).toBe(true)
    expect(isFileViewerUrl('/uploads/a.txt')).toBe(true)
    expect(isFileViewerUrl('/uploads/a.csv')).toBe(true)
  })

  it('zip / 图片 / 音视频返回 false（走 ZipPreview 或 iframe 原生预览）', () => {
    expect(isFileViewerUrl('/uploads/a.zip')).toBe(false)
    expect(isFileViewerUrl('/uploads/a.png')).toBe(false)
    expect(isFileViewerUrl('/uploads/a.jpg')).toBe(false)
    expect(isFileViewerUrl('/uploads/a.mp4')).toBe(false)
    expect(isFileViewerUrl('/uploads/a.mp3')).toBe(false)
  })

  it('空值返回 false', () => {
    expect(isFileViewerUrl('')).toBe(false)
    expect(isFileViewerUrl(null)).toBe(false)
    expect(isFileViewerUrl(undefined)).toBe(false)
  })

  it('带查询串的 office URL 仍识别', () => {
    expect(isFileViewerUrl('/uploads/a.pdf?exp=123&sig=abc')).toBe(true)
  })
})
