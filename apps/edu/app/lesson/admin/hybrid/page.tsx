'use client'

import { CourseAdminPage } from '../_components/courses/course-admin-page'
import { useT } from '@/lib/i18n/locale-provider'

export default function HybridCoursePage() {
  const t = useT()
  return (
    <CourseAdminPage
      title={t('混合课模板管理')}
      subtitle={t('维护线上线下混合式课程模板，支持课程创建、大纲设计、资源组课，开课后自动归档至历史档案库')}
      courseType="hybrid"
      addHref="/lesson/admin/hybrid/add"
    />
  )
}
