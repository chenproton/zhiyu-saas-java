export interface AiSubjectivePreScore {
  suggestedScore: number
  maxScore: number
  reasoning: string
  hitPoints: string[]
  missedPoints: string[]
  highlights: string[]
  confidence: 'high' | 'medium' | 'low'
}

export interface AiInitialReview {
  evalPointId: string
  evalPointName: string
  suggestedGrade: string
  suggestedScore: number
  maxScore: number
  basis: string[]
  doubts: string[]
  confidence: 'high' | 'medium' | 'low'
}

export interface AiGeneratedComment {
  overallSummary: string
  highlights: string[]
  improvements: string[]
  fullComment: string
}
