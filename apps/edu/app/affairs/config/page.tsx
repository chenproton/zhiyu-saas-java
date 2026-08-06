'use client'

import { useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Upload } from 'lucide-react'
import { PageHeaderCard } from '@/components/shared/page-header-card'
import { VenuePeriodConfigTab } from '@/app/affairs/scheduling/_components/venue-period-config-tab'
import { AffairsConfigImportDialog } from '@/app/affairs/scheduling/_components/affairs-config-import-dialog'

export default function AffairsConfigPage() {
  const [refreshKey, setRefreshKey] = useState(0)
  const [importOpen, setImportOpen] = useState(false)

  const handleImported = useCallback(() => {
    setRefreshKey((k) => k + 1)
  }, [])

  return (
    <div className="space-y-6">
      <PageHeaderCard
        title="教务配置"
        description="维护学期、场地、节次等基础数据，教学计划与排课均依赖此配置"
        actions={
          <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
            <Upload className="mr-2 size-4" />
            批量导入
          </Button>
        }
      />
      <VenuePeriodConfigTab key={refreshKey} onTermsChanged={handleImported} />
      <AffairsConfigImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onImported={handleImported}
      />
    </div>
  )
}
