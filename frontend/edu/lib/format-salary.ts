/**
 * 薪资区间格式化（单一来源）。
 * 原在 job-brand-dialogs / public-cards / employer-brand-detail / brands/[id]/page
 * 四处重复实现，统一收敛于此。
 * 两个端点都缺失时返回 null（由调用方决定空态文案），否则返回如 "8-12K"。
 */
export function formatSalaryRange(p: { salaryMin?: number; salaryMax?: number }): string | null {
  if (p.salaryMin == null && p.salaryMax == null) return null;
  if (p.salaryMin == null) return `${p.salaryMax}K`;
  if (p.salaryMax == null) return `${p.salaryMin}K`;
  return `${p.salaryMin}-${p.salaryMax}K`;
}
