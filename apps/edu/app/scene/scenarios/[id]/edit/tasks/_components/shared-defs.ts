export const allQuestions: any[] = []
export const questionCache = new Map<string, any>()
export const loadedExams: any[] = []

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
