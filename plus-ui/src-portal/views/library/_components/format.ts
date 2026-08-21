// 本地时间格式化工具（等价原 React 版 format-utils.ts 的 formatDate 语义；
// Vue 门户 utils/format.ts 仅有 formatSize / isSafeLinkUrl，故这里补日期相关辅助）

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** 格式化为 YYYY-MM-DD，空值/非法值返回 fallback（默认 "-"）。 */
export function formatDate(value?: string | null, fallback = '-'): string {
  if (!value) return fallback;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return fallback;
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** 格式化为 YYYY-MM-DD HH:mm（本地时区），空值/非法值返回 fallback。 */
export function formatDateTime(value?: string | null, fallback = '-'): string {
  if (!value) return fallback;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return fallback;
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** 在 base 时间基础上加减天数，返回新 Date（等价 date-fns addDays）。 */
export function addDays(base: Date | number, days: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

/** 格式化为 YYYY-MM-DD（本地时区）。 */
export function toYMD(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
