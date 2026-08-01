'use client'

import { sceneNavigationConfig } from '@/lib/navigation-config'
import { PlatformLayout } from '@/components/shared/platform-layout'

export default function SceneLayout({ children }: { children: React.ReactNode }) {
  return (
    <PlatformLayout navigationConfig={sceneNavigationConfig} landingPath="/scene/landing">
      {children}
    </PlatformLayout>
  )
}
