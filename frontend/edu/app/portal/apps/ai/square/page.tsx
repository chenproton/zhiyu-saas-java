'use client'

// 旧路由重定向：AI 广场已并入落地页（/portal/apps/ai/landing#square），见 spec §2.1。
import { useEffect } from 'react'
import { useNavigate } from 'react-router'

export default function AICenterSquareRedirect() {
  const navigate = useNavigate()
  useEffect(() => {
    navigate('/portal/apps/ai/landing#square', { replace: true })
  }, [navigate])
  return null
}
