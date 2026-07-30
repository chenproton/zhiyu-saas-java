"use client"

import { affairsNavigationConfig } from "@/lib/navigation-config"
import { PlatformLayout } from "@/components/shared/platform-layout"

export default function AffairsLayout({ children }: { children: React.ReactNode }) {
  return (
    <PlatformLayout navigationConfig={affairsNavigationConfig} landingPath="/affairs/landing">
      {children}
    </PlatformLayout>
  )
}
