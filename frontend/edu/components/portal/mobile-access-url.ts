/**
 * 移动端访问二维码 URL 拼接。
 * siteUrl 为手机可访问的站点地址（NEXT_PUBLIC_SITE_URL 或当前窗口 origin），
 * 拼接当前页面路径与查询参数生成扫码目标地址。
 */
export function buildMobileAccessUrl(siteUrl: string, pathname: string, search?: string): string {
  const base = siteUrl.replace(/\/+$/, '')
  return `${base}${pathname}${search || ''}`
}
