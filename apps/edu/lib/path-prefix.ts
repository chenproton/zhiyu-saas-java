/**
 * 路径前缀工具：检测当前是否通过 /java/ 前缀访问，返回对应前缀
 * 用于 Go/Java 双栈共用同一前端代码时，跳转路径自动适配
 */
export function getPathPrefix(): string {
  if (typeof window === 'undefined') return ''
  const pathname = window.location.pathname
  return pathname.startsWith('/java/') ? '/java' : ''
}

/**
 * 为绝对路径添加前缀（如需要）
 * @param path 以 / 开头的绝对路径
 */
export function withPrefix(path: string): string {
  const prefix = getPathPrefix()
  return prefix + path
}
