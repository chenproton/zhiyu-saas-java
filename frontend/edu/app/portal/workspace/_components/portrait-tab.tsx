'use client'

import { useT } from '@/lib/i18n/locale-provider'

export function PortraitTab({ userId }: { userId?: string }) {
  const t = useT()
  const src = userId
    ? `/student_portrait.html?userId=${encodeURIComponent(userId)}`
    : '/student_portrait.html'
  return (
    <div className="w-full" style={{ height: 'calc(100vh - 200px)' }}>
      <iframe src={src} className="w-full h-full border-0 rounded-md" title={t('学生画像')} />
    </div>
  )
}
