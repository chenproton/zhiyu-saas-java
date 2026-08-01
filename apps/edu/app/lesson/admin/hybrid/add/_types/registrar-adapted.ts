export type TaskResourceType = 'textbook' | 'ppt' | 'video' | 'link' | 'document' | 'scene_link'

export interface TaskResource {
  id: string
  taskId: string
  name: string
  type: TaskResourceType
  url?: string
  textbookId?: string
  externalResourceId?: string
  isVisibleToStudents: boolean
  uploadBy: string
  uploadedAt: string
  sortOrder: number
}

export interface TaskPrepContent {
  pre: {
    objectives?: string
    guidePlan?: string
    previewQuestions?: string[]
  }
  in: {
    coursewareResources?: TaskResource[]
    quizQuestions?: string[]
    discussionTopics?: string[]
  }
  post: {
    homework?: string
    quizQuestions?: string[]
    extensionResources?: string[]
  }
}

export interface TaskEvalPoint {
  id: string
  name: string
  desc: string
  weight: number
  maxScore: number
  scoringMethod?: 'score' | 'level' | 'rubric'
  subType?: string
  types?: string[]
}

export interface TaskReviewStep {
  id: string
  label: string
  desc: string
  enabled: boolean
  subjectType: string | null
  weight: number
}

export interface TaskPaperConfig {
  paperId?: string
  duration?: number
  allowRetake?: boolean
  maxRetakeCount?: number
  shuffleQuestions?: boolean
  showScoreAfterSubmit?: boolean
  activationType?: 'manual' | 'scheduled' | 'immediate'
  activationTime?: string
}

export interface TaskMaterialConfig {
  requiresMaterial: boolean
  estimatedDays?: number
  formatRequirements?: string
  venueResources?: string
  allowResubmit?: boolean
}

export interface TaskQuestionBankConfig {
  questionIds: string[]
  randomCount?: number
  difficultyDistribution?: string
  timeLimit?: number
  allowRepeat?: boolean
  shuffleQuestions?: boolean
  showScoreAfterSubmit?: boolean
}

export interface TaskQuizConfig {
  questionIds: string[]
  randomCount?: number
  difficultyDistribution?: string
  timeLimit?: number
  allowRepeat?: boolean
  shuffleQuestions?: boolean
  showScoreAfterSubmit?: boolean
}

export interface TaskEvaluationConfig {
  enabledMethods: string[]
  evalPoints?: {
    randomDraw?: TaskEvalPoint[]
    review?: TaskEvalPoint[]
    paper?: TaskEvalPoint[]
    questionBank?: TaskEvalPoint[]
    outcome?: TaskEvalPoint[]
    homework?: TaskEvalPoint[]
    quiz?: TaskEvalPoint[]
  }
  reviewSteps?: TaskReviewStep[]
  randomDrawQuestions?: {
    id: string
    name: string
    description: string
    answer: string
    major: string
  }[]
  paperConfig?: TaskPaperConfig
  questionBankConfig?: TaskQuestionBankConfig
  quizConfig?: TaskQuizConfig
  outcomeMaterial?: TaskMaterialConfig
  homeworkMaterial?: TaskMaterialConfig
}
