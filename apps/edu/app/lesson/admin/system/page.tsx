'use client'

import { CourseAdminPage } from '../_components/courses/course-admin-page'

export default function SystemCoursePage() {
  return (
    <CourseAdminPage
      title="体系课管理"
      subtitle="维护体系课课程及节点信息，包含课程创建、配置课程节点、提交审批、课程发布等功能"
      courseType="system"
      addHref="/lesson/admin/system/add"
    />
  )
}
