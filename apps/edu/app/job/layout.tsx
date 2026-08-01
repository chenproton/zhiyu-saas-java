'use client'

import { jobNavigationConfig } from '@/lib/navigation-config'
import { PlatformLayout } from '@/components/shared/platform-layout'

export default function JobLayout({ children }: { children: React.ReactNode }) {
  return (
    <PlatformLayout navigationConfig={jobNavigationConfig} landingPath="/job/student">
      {children}
    </PlatformLayout>
  )
}
