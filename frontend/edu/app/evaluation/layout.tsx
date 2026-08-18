'use client'

import { evaluationNavigationConfig } from '@/lib/navigation-config'
import { PlatformLayout } from '@/components/shared/platform-layout'
import { DataProvider } from '@/components/providers/data-provider'

// 评测数据（题库/试卷）Provider 仅挂载在测评域内：
// 只有 /evaluation/* 的页面与弹窗消费 useData()，其他平台页面不再加载测评数据
export default function EvaluationLayout({ children }: { children: React.ReactNode }) {
  return (
    <PlatformLayout navigationConfig={evaluationNavigationConfig} landingPath="/evaluation/landing">
      <DataProvider>{children}</DataProvider>
    </PlatformLayout>
  )
}
