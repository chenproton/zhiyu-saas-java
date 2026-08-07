'use client'

import { Info, Route } from 'lucide-react'
import type { CareerPosition } from '@/lib/types'
import { useT } from '@/lib/i18n/locale-provider'

interface OverviewTabProps {
  position: CareerPosition
}

export function OverviewTab({ position }: OverviewTabProps) {
  const t = useT()
  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-base font-medium text-[#1f2937] mb-4 flex items-center gap-2">
          <Info className="w-5 h-5 text-primary" />
          {t('岗位简介')}
        </h3>
        <p className="text-[14px] text-[#1f2937] leading-[1.8] whitespace-pre-line">
          {position.description || t('暂无岗位介绍')}
        </p>
      </div>

      {position.careerPath && (
        <div>
          <h3 className="text-base font-medium text-[#1f2937] mb-4 flex items-center gap-2">
            <Route className="w-5 h-5 text-primary" />
            {t('职业发展路线')}
          </h3>
          <div className="bg-[#f8fafc] border border-[#e7e5e4] rounded-xl p-5 text-[14px] text-[#1f2937] leading-[1.8] whitespace-pre-line">
            {position.careerPath}
          </div>
        </div>
      )}
    </div>
  )
}
