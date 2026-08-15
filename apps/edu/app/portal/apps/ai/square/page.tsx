'use client'

// 旧路由重定向：AI 广场已并入落地页（/portal/apps/ai/landing#square），见 spec §2.1。
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function AICenterSquareRedirect() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/portal/apps/ai/landing#square')
  }, [router])
  return null
}
