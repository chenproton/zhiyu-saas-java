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

export function setAllQuestions(questions: CachedQuestion[]): void {
  _allQuestions.length = 0
  _allQuestions.push(...questions)
}

export function addAllQuestions(questions: CachedQuestion[]): void {
  _allQuestions.push(...questions)
}

export function clearAllQuestions(): void {
  _allQuestions.length = 0
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

export function clearQuestionCache(): void {
  _questionCache.clear()
}

// ---------- loadedExams ----------
export function getLoadedExams(): readonly LoadedExam[] {
  return _loadedExams
}

export function getLoadedExam(id: string): LoadedExam | undefined {
  return _loadedExams.find(e => e.id === id)
}

export function setLoadedExams(exams: LoadedExam[]): void {
  _loadedExams.length = 0
  _loadedExams.push(...exams)
}

export function addLoadedExam(exam: LoadedExam): void {
  _loadedExams.push(exam)
}

export function upsertLoadedExam(id: string, patch: Partial<LoadedExam>): void {
  const idx = _loadedExams.findIndex(e => e.id === id)
  if (idx >= 0) {
    _loadedExams[idx] = { ..._loadedExams[idx], ...patch, id }
  } else {
    _loadedExams.push({ ...patch, id, name: patch.name ?? "" })
  }
}

export function clearLoadedExams(): void {
  _loadedExams.length = 0
}

export function clearAllCaches(): void {
  _allQuestions.length = 0
  _questionCache.clear()
  _loadedExams.length = 0
}

export const typeColorMap: Record<string, string> = {
  single: "bg-blue-500",
  multiple: "bg-indigo-500",
  judgment: "bg-amber-500",
  judge: "bg-amber-500",
  fill_blank: "bg-purple-500",
  fill: "bg-purple-500",
  essay: "bg-rose-500",
  short_answer: "bg-teal-500",
}

export const questionTypeLabels: Record<string, string> = {
  single: "单选",
  multiple: "多选",
  judgment: "判断",
  judge: "判断",
  short_answer: "简答",
  essay: "论述",
  fill_blank: "填空",
  fill: "填空",
}

export const difficultyLabels: Record<string, string> = {
  easy: "简单",
  medium: "中等",
  hard: "困难",
}

export const questionBankLabels: Record<string, string> = {
  frontend: "前端开发题库",
  backend: "后端开发题库",
  draft: "草稿库",
  public: "公共基础题库",
  professional: "专业技能题库",
}
