"use client"

import { CourseAdminPage } from "../_components/courses/course-admin-page"

export default function GranularCoursePage() {
  return (
    <CourseAdminPage
      title="颗粒课管理"
      subtitle="维护颗粒课信息，包含颗粒课创建、提交审批、颗粒课发布等功能"
      courseType="granular"
      addHref="/lesson/admin/granular/add"
      importExcelEntity="granular-courses"
    />
  )
}
