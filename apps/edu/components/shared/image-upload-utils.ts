/**
 * 图片上传通用判定：
 * - GIF/SVG 不经图片编辑器直接上传（编辑会丢失动画 / 矢量特性）
 * - HEIC/HEIF 浏览器无法解码，直接提示
 */
export function isPassthroughImage(file: File): boolean {
  return file.type === 'image/gif' || file.type === 'image/svg+xml'
}

export function isUndecodableImage(file: File): boolean {
  return file.type === 'image/heic' || file.type === 'image/heif'
}
