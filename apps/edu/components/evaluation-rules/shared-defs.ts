export interface CachedQuestion {
  id: string
  name?: string
  content?: string
  type?: string
  difficulty?: string
  score?: number
  questionBank?: string
  [key: string]: unknown
}

export interface LoadedExam {
  id: string
  name: string
  questions?: unknown[]
  questionCount?: number
  totalScore?: number
}

// 模块级私有状态，禁止直接从外部读写，避免跨组件污染。
const _allQuestions: CachedQuestion[] = []
const _questionCache = new Map<string, CachedQuestion>()
const _loadedExams: LoadedExam[] = []

// ---------- allQuestions ----------
export function getAllQuestions(): readonly CachedQuestion[] {
  return _allQuestions
}

// ---------- questionCache ----------
export function getCachedQuestion(id: string): CachedQuestion | undefined {
  return _questionCache.get(id)
}

export function hasCachedQuestion(id: string): boolean {
  return _questionCache.has(id)
}

export function setCachedQuestion(question: CachedQuestion): void {
  _questionCache.set(question.id, question)
}

export function setCachedQuestions(questions: CachedQuestion[]): void {
  for (const q of questions) {
    _questionCache.set(q.id, q)
  }
}

// ---------- loadedExams ----------
export function getLoadedExams(): readonly LoadedExam[] {
  return _loadedExams
}

export function setLoadedExams(exams: LoadedExam[]): void {
  _loadedExams.length = 0
  _loadedExams.push(...exams)
}

export function addLoadedExam(exam: LoadedExam): void {
  _loadedExams.push(exam)
}

export function clearAllCaches(): void {
  _allQuestions.length = 0
  _questionCache.clear()
  _loadedExams.length = 0
}

export {
  QUESTION_TYPE_BADGE_CLASSES as typeColorMap,
  QUESTION_TYPE_LABELS_SHORT as questionTypeLabels,
  DIFFICULTY_LABELS as difficultyLabels,
} from '@zhiyu/shared-types'
