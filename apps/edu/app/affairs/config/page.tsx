"use client"

import { PageHeaderCard } from "@/components/shared/page-header-card"
import { VenuePeriodConfigTab } from "@/app/affairs/scheduling/_components/venue-period-config-tab"

export default function AffairsConfigPage() {
  return (
    <div className="space-y-6">
      <PageHeaderCard
        title="教务配置"
        description="维护学期、场地、节次等基础数据，教学计划与排课均依赖此配置"
      />
      <VenuePeriodConfigTab />
    </div>
  )
}
