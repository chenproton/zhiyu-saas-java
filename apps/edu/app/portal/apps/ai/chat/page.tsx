'use client'

// YIKnow 全局智能助手直达路由（/portal/apps/ai/chat，spec §2.1 YIKnow）。
// 体验本体在 _components/yi-know-chat.tsx；前台入口（/portal/apps 卡片、落地页「立即体验」）
// 统一以弹窗打开（v2.7），本路由供直达链接/平台内导航使用。
import { YIKnowChat } from '../_components/yi-know-chat'

export default function YIKnowChatPage() {
  return <YIKnowChat variant="page" />
}
