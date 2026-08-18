'use client'

import { Badge } from '@/components/ui/badge'
import type { TagItem } from '@/lib/types/library'

/**
 * 彩色标签徽标：颜色来自标签配置（边框/文字/底色均由标签色派生）。
 */
export function TagBadge({ tag, className }: { tag: TagItem; className?: string }) {
  return (
    <Badge
      variant="outline"
      className={`text-xs font-normal ${className ?? ''}`}
      style={{
        color: tag.color,
        borderColor: `${tag.color}55`,
        backgroundColor: `${tag.color}14`,
      }}
    >
      {tag.name}
    </Badge>
  )
}
