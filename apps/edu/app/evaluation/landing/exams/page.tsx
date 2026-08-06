import { redirect } from 'next/navigation'

// 考试列表已并入考试中心（/evaluation/landing/exam-center）：
// 按考试安排（usage）展示，含班级匹配、交卷状态与成绩，答题链路带 usage 归属。
export default function ExamListPage() {
  redirect('/evaluation/landing/exam-center')
}
