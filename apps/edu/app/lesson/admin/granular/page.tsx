'use client'

import { CourseAdminPage } from '../_components/courses/course-admin-page'
import { useT } from '@/lib/i18n/locale-provider'

export default function GranularCoursePage() {
  const t = useT()
  return (
    <CourseAdminPage
      title={t('颗粒课管理')}
      subtitle={t('维护颗粒课信息，包含颗粒课创建、提交审批、颗粒课发布等功能')}
      courseType="granular"
      addHref="/lesson/admin/granular/add"
      importExcelEntity="granular-courses"
    />
  )
}
