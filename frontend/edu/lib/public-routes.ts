// 无需登录即可访问的独立页面清单
// 这些页面不参与登录态获取与数据预加载，避免未登录时 401 跳转登录页
export function isPublicPage(pathname: string): boolean {
  return pathname === '/changelog' || pathname.startsWith('/changelog/')
}
