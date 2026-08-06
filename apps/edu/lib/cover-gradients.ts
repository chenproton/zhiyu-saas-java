/**
 * Landing 对象卡片默认封面渐变（8 种，色系对齐 /portal 门户图标色：
 * purple / cyan / emerald / amber / blue / red / teal / indigo）。
 * 各 landing 页面无 coverImage 时按对象 id 哈希稳定取色，
 * 同一对象在列表卡片与详情页封面颜色保持一致。
 */
export const COVER_GRADIENTS = [
  'linear-gradient(135deg,#7c3aed,#a855f7)',
  'linear-gradient(135deg,#0e7490,#06b6d4)',
  'linear-gradient(135deg,#047857,#10b981)',
  'linear-gradient(135deg,#b45309,#f59e0b)',
  'linear-gradient(135deg,#1d4ed8,#3b82f6)',
  'linear-gradient(135deg,#b91c1c,#ef4444)',
  'linear-gradient(135deg,#0f766e,#14b8a6)',
  'linear-gradient(135deg,#4338ca,#818cf8)',
]

/** 按对象 id 哈希取稳定渐变，同一对象在所有页面颜色一致。 */
export function coverGradientFor(id: string): string {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return COVER_GRADIENTS[h % COVER_GRADIENTS.length]
}
