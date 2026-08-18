export interface Exam {
  id: string;
  code?: string;
  name: string;
  description?: string;
  status: string;
  totalScore: number;
  duration: number; // 分钟
  questionCount?: number;
  questions?: ExamQuestion[];
  coverImage?: string;
  collaboratorIds?: string[];
  batchId?: string;
  version?: string;
  ownerType: 'mine' | 'collaborate' | 'public';
  creatorId?: string;
  creatorName?: string;
  collaboratorNames?: string[];
  createdAt: string;
  updatedAt: string;
  isTemp?: boolean;
  rejectReason?: string;
}

export interface ExamQuestion {
  id: string;
  questionId: string;
  type: QuestionType;
  content: string;
  options?: string[];
  answer: string | string[];
  analysis?: string;
  score: number;
  order: number;
}

export interface QuestionBank {
  id: string;
  code?: string;
  name: string;
  description?: string;
  coverImage?: string;
  status: string;
  questionCount: number;
  creatorId?: string;
  creatorName?: string;
  collaboratorIds?: string[];
  batchId?: string;
  version?: string;
  ownerType: 'mine' | 'collaborate' | 'public';
  isDraftPool?: boolean;
  rejectReason?: string;
  createdAt: string;
  updatedAt: string;
}

export type QuestionType = 'single' | 'multiple' | 'judge' | 'fill' | 'essay' | 'short_answer';

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  single: '单选题',
  multiple: '多选题',
  judge: '判断题',
  fill: '填空题',
  essay: '简答题',
  short_answer: '问答题'
};

export interface Question {
  id: string;
  code?: string;
  bankId: string;
  type: QuestionType;
  content: string;
  options?: string[];
  answer: string | string[];
  analysis?: string;
  score: number;
  difficulty?: string;
  knowledgePoints?: string[];
  shuffleOptions?: boolean;
  creatorId?: string;
  source?: string;
  status: string;
  createdAt: string;
}

// ==================== 岗位能力认定规则 ====================

export type RuleStatus =
  | 'draft'
  | 'not_submitted'
  | 'reviewing'
  | 'rejected'
  | 'ready'
  | 'published'
  | 'none';

export interface LevelMapping {
  level: string;
  min: number;
  max: number;
}

export interface CertificationRule {
  id: string;
  careerPositionId: string;
  status: RuleStatus;
  ruleSource: 'inherit' | 'custom';
  levelMapping?: LevelMapping[];
  createdAt?: string;
  updatedAt?: string;
}

export interface CertificationModelTask {
  taskId: string;
  taskName: string;
  scenarioName: string;
  taskType?: 'scene' | 'course';
  weight: number;
}

export interface CertificationModelPoint {
  abilityPointId: string;
  name: string;
  description: string;
  requiredLevel: string;
  rubricDescription: string;
  weight: number;
  tasks: CertificationModelTask[];
  levelMapping?: LevelMapping[];
}

export interface CertificationModelDomain {
  name: string;
  points: CertificationModelPoint[];
}

export interface CertificationPositionModel {
  rule: { id: string; status: RuleStatus } | null;
  positionId: string;
  domains: CertificationModelDomain[];
}

// ==================== 岗位能力认定结果 ====================

export interface JobAbilityPointDetail {
  abilityPointId?: string;
  abilityPointName: string;
  score: number;
  maxScore?: number;
  weight?: number;
  achieved: boolean;
  requiredLevel?: string;
  requiredLevelLabel?: string;
  levelLabel?: string;
  competencyV2?: number;
}

export interface JobAbilityResult {
  id: string;
  positionId: string;
  positionName: string;
  userId?: string;
  studentName: string;
  studentId: string;
  className?: string;
  majorId?: string;
  majorName?: string;
  department?: string;
  totalAbilityPoints: number;
  achievedAbilityPoints: number;
  achievementRate: number;
  grade?: string;
  positionCompetency?: number;
  positionCompetencyV2?: number;
  abilityCognitionScore?: number;
  evaluationTime: string | Date;
  abilityPointDetails?: JobAbilityPointDetail[];
  createdAt?: string;
  updatedAt?: string;
}

export interface JobAbilitySummaryItem {
  positionId: string;
  positionName: string;
  studentCount: number;
  avgRate: number;
}

export interface JobAbilityAggregateStatus {
  id?: string;
  careerPositionId?: string;
  status: string;
  message?: string;
  studentCount?: number;
  updatedCount?: number;
  errorMessage?: string;
  startedAt?: string;
  finishedAt?: string;
}

// ==================== 考试使用 / 考试结果 ====================

export interface ExamUsage {
  id: string;
  examId: string;
  name: string;
  description?: string;
  startTime?: string;
  endTime?: string;
  duration?: number;
  targetType?: 'class' | 'major' | 'department' | 'public' | 'task' | 'node' | 'course';
  targetIds: string[];
  status: 'draft' | 'pending' | 'published' | 'scheduled' | 'in_progress' | 'finished';
  activationMode?: 'manual' | 'scheduled' | 'always';
  creatorId?: string;
  examVersion?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ExamResult {
  id: string;
  examUsageId: string;
  userId: string;
  studentName: string;
  className: string;
  grade: string;
  majorId?: string;
  majorName?: string;
  score: number;
  totalScore: number;
  isPass: boolean;
  answers?: Record<string, unknown>;
  gradingStatus?: 'pending' | 'evaluated';
  gradingScores?: Record<string, unknown>;
  gradingComment?: string;
  graderId?: string;
  gradedAt?: string;
  version?: string;
  submitTime: string;
  createdAt: string;
}

export interface SceneEvaluationResult {
  id: string;
  taskId: string;
  sceneId?: string;
  methodKey: string;
  evaluateeId: string;
  evaluatorId?: string;
  evaluatorType?: string;
  status: 'pending' | 'evaluated';
  totalScore?: number;
  maxScore: number;
  evalPointScores: Record<string, unknown>;
  objectiveAnswers: Record<string, unknown>;
  subjectiveContent: Record<string, unknown>;
  drawnQuestions: Record<string, unknown>;
  comment?: string;
  gradedAt?: string;
  gradedBy?: string;
  version?: string;
  createdAt?: string;
  updatedAt?: string;
}

/** 测评中心条目（landing 考试中心，GET /evaluation/exam-center，对齐 shared-types ExamCenterItem） */
export interface ExamCenterItem {
  id: string;
  examId: string;
  usageName: string;
  examName: string;
  description?: string;
  startTime?: string;
  endTime?: string;
  duration?: number;
  status: 'published' | 'in_progress' | 'finished';
  questionCount: number;
  totalScore: number;
  participatable: boolean;
  submitted: boolean;
  score?: number;
  studentView: boolean;
}

/** 试卷快照（对齐 React lib/exam-snapshot.ts 与 shared-types snapshot.ts） */
export interface ExamSnapshotQuestion {
  id: string;
  exam_id: string;
  question_id?: string;
  type?: string;
  content: string;
  options?: string[];
  answer?: string | string[];
  analysis?: string;
  score?: number;
  sort_order?: number;
}

export interface ExamSnapshot {
  exam: {
    id: string;
    name: string;
    description?: string;
    status?: string;
    total_score?: number;
    duration?: number;
    version?: string;
  };
  exam_questions: ExamSnapshotQuestion[];
}
