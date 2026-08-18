/**
 * 权重平均分配工具：支持小数权重（后端 numeric(5,2)）。
 * 旧实现用 Math.floor + % 做整数分配，遇到 33.33/12.50 这类小数权重时，
 * 合计会偏离目标值（如 100.34、83.34），导致「权重校验未通过」。
 * 这里统一用「分」（两位小数的整数表示）计算，余数按顺序 +0.01 分给前几项。
 */

/** 将 total 平均分给 n 项，返回长度 n、保留两位小数、合计精确等于 total 的权重数组。 */
export function splitWeightEvenly(total: number, n: number): number[] {
  if (n <= 0) return []
  const totalCents = Math.round(total * 100)
  const eachCents = Math.floor(totalCents / n)
  const remainderCents = totalCents - eachCents * n
  return Array.from({ length: n }, (_, i) => (eachCents + (i < remainderCents ? 1 : 0)) / 100)
}
