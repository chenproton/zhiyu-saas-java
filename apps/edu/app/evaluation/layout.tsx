"use client"

import { evaluationNavigationConfig } from "@/lib/navigation-config"
import { PlatformLayout } from "@/components/shared/platform-layout"

export default function EvaluationLayout({ children }: { children: React.ReactNode }) {
  return (
    <PlatformLayout navigationConfig={evaluationNavigationConfig} landingPath="/evaluation/landing">
      {children}
    </PlatformLayout>
  )
}
