// 通用格式化工具（等价 frontend/edu/lib/format-utils.ts 的 formatSize / isSafeLinkUrl）

export function formatSize(bytes?: number): string {
  if (bytes == null || Number.isNaN(bytes)) return '-';
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const v = bytes / Math.pow(1024, i);
  return `${v.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export function isSafeLinkUrl(url?: string): boolean {
  if (!url) return false;
  try {
    const u = new URL(url, window.location.origin);
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch {
    return false;
  }
}
