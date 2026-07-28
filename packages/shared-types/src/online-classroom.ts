// ==================== 在线课堂评价相关 ====================

export interface OnlineClassroomStudent {
  id: string
  name: string
  studentNumber: string
  className: string
  enrollmentYear: number
  status: 'pending' | 'graded'
  submittedAt?: string
  score?: number
}

export interface OnlineClassroom {
  id: string
  name: string
  code: string
  category: string
  teacherName: string
  studentCount: number
  pendingCount: number
  gradedCount: number
  students: OnlineClassroomStudent[]
}

// ==================== 智慧课程评价相关 ====================

export interface SmartCourseChapter {
  id: string
  name: string
  order: number
  studentCount: number
  pendingCount: number
  gradedCount: number
}

export interface SmartCourseStudent {
  id: string
  name: string
  studentNumber: string
  className: string
  enrollmentYear: number
  status: 'pending' | 'graded'
  submittedAt?: string
  score?: number
}

export interface SmartCourse {
  id: string
  name: string
  code: string
  category: string
  teacherName: string
  chapters: SmartCourseChapter[]
  students: SmartCourseStudent[]
}
