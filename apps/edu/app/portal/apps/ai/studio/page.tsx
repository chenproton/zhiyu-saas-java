'use client'

// 旧路由重定向：我的工坊已并入落地页（/portal/apps/ai/landing#studio），见 spec §2.1。
// 注意：/studio/kb/[id] 与 /studio/agents/* 编辑页仍是独立路由，不受影响。
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function AICenterStudioRedirect() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/portal/apps/ai/landing#studio')
  }, [router])
  return null
}
