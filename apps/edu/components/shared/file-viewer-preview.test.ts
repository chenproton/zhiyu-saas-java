import { describe, it, expect } from 'vitest'
import { isFileViewerUrl } from './file-viewer-preview'

describe('isFileViewerUrl', () => {
  it('file-viewer 支持的 office/pdf/文本/压缩包/图片/音视频返回 true', () => {
    expect(isFileViewerUrl('/uploads/a.docx')).toBe(true)
    expect(isFileViewerUrl('/uploads/a.pdf')).toBe(true)
    expect(isFileViewerUrl('/uploads/a.xlsx')).toBe(true)
    expect(isFileViewerUrl('/uploads/a.pptx')).toBe(true)
    expect(isFileViewerUrl('/uploads/a.txt')).toBe(true)
    expect(isFileViewerUrl('/uploads/a.csv')).toBe(true)
    // 压缩包：file-viewer archive renderer 支持 zip/7z/rar/tar/gz 等
    expect(isFileViewerUrl('/uploads/a.zip')).toBe(true)
    expect(isFileViewerUrl('/uploads/a.7z')).toBe(true)
    expect(isFileViewerUrl('/uploads/a.rar')).toBe(true)
    expect(isFileViewerUrl('/uploads/a.tar.gz')).toBe(true)
    // 图片/音视频：file-viewer image/media renderer 支持
    expect(isFileViewerUrl('/uploads/a.png')).toBe(true)
    expect(isFileViewerUrl('/uploads/a.jpg')).toBe(true)
    expect(isFileViewerUrl('/uploads/a.mp4')).toBe(true)
    expect(isFileViewerUrl('/uploads/a.mp3')).toBe(true)
  })

  it('大小写不敏感', () => {
    expect(isFileViewerUrl('/uploads/a.DOCX')).toBe(true)
    expect(isFileViewerUrl('/uploads/a.PDF')).toBe(true)
  })

  it('file-viewer 不支持的扩展名返回 false（回退 kkfileview）', () => {
    expect(isFileViewerUrl('/uploads/a.unknownxyz')).toBe(false)
    expect(isFileViewerUrl('/uploads/a')).toBe(false)
  })

  it('空值返回 false', () => {
    expect(isFileViewerUrl('')).toBe(false)
    expect(isFileViewerUrl(null)).toBe(false)
    expect(isFileViewerUrl(undefined)).toBe(false)
  })

  it('带查询串/片段的 URL 仍按扩展名识别', () => {
    expect(isFileViewerUrl('/uploads/a.pdf?exp=123&sig=abc')).toBe(true)
    expect(isFileViewerUrl('/uploads/a.zip#fragment')).toBe(true)
  })
})
