import type { Exam, ExamQuestion } from '@/lib/types'
import type { ExamSnapshot } from '@/lib/api'

// 试卷快照行字段为 snake_case，映射为前端 Exam 形状。
// 三处调用点（landing/exams/[id]、lesson-results/daily-exams/[resultId]、scene-results/[id]）共用，
// 以 landing/exams/[id] 的既有实现为基准（含 type/answer 兜底与 order 排序字段）。
export function examFromSnapshot(snap: ExamSnapshot): Exam {
  return {
    id: snap.exam.id,
    name: snap.exam.name,
    description: snap.exam.description,
    status: (snap.exam.status as Exam['status']) || 'published',
    totalScore: snap.exam.total_score ?? 0,
    duration: snap.exam.duration ?? 0,
    ownerType: 'mine',
    questions: (snap.exam_questions || []).map(
      (q): ExamQuestion => ({
        id: q.id,
        questionId: q.question_id || q.id,
        type: (q.type || 'single') as ExamQuestion['type'],
        content: q.content,
        options: q.options,
        answer: q.answer ?? '',
        analysis: q.analysis,
        score: q.score ?? 0,
        order: q.sort_order ?? 0,
      }),
    ),
    createdAt: '',
    updatedAt: '',
  }
}
