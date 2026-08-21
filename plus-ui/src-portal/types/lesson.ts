import type { ContentStatus } from './content-status';

export type CourseType = 'system' | 'granular' | 'hybrid';

export const COURSE_TYPE_LABELS: Record<CourseType, string> = {
  system: '体系课',
  granular: '颗粒课',
  hybrid: '混合课'
};

export interface Course {
  id: string;
  code?: string;
  name: string;
  type: CourseType;
  category: string;
  majorId?: string;
  majorName?: string;
  description?: string;
  teacherId?: string;
  industryId?: string;
  industryName?: string;
  version?: string;
  onlineHours?: number;
  offlineHours?: number;
  onlineWeight?: number;
  offlineWeight?: number;
  semester?: string;
  className?: string;
  status: ContentStatus;
  coverColor?: string;
  coverImage?: string;
  courseTag?: string;
  difficulty?: number;
  knowledgePointIds?: string[];
  knowledgePointNames?: string[];
  abilityPointIds?: string[];
  resourceIds?: string[];
  creatorId: string;
  creatorName?: string;
  coCreatorIds?: string[];
  batchId?: string;
  batchName?: string;
  evalData?: Record<string, unknown>;
  nodeCount: number;
  resourceCount: number;
  studyCount: number;
  viewCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface SystemCourseNode {
  id: string;
  courseId: string;
  parentId: string | null;
  name: string;
  code?: string;
  order: number;
  type: string;
  sourceId?: string;
  sourceName?: string;
  teachingGoals?: string;
  detailedDescription?: string;
  background?: string;
  estimatedHours?: number;
  duration?: number;
  difficulty?: number;
  status: string;
}

export interface KnowledgePoint {
  id: string;
  name: string;
  code?: string;
  description?: string;
  linked: boolean;
  granularLessonIds: string[];
  creatorId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface NodeEvaluationResult {
  id: string;
  nodeId: string;
  methodKey: string;
  evaluateeId: string;
  evaluatorId?: string;
  evaluatorType?: string;
  status: 'pending' | 'evaluated';
  totalScore?: number;
  maxScore: number;
  evalPointScores?: Record<string, unknown>;
  objectiveAnswers?: Record<string, unknown>;
  subjectiveContent?: Record<string, unknown>;
  drawnQuestions?: Record<string, unknown>;
  comment?: string;
  gradedAt?: string;
  gradedBy?: string;
  version?: string;
}

export const EVAL_METHOD_LABELS_GRADING: Record<string, string> = {
  random_draw: '现场问答',
  review: '现场评审',
  paper: '试卷',
  question_bank: '题库',
  outcome: '成果评价',
  homework: '作业',
  quiz: '随堂测'
};

const HYBRID_EVAL_MODULE_LABELS: Record<string, string> = {
  preQuiz: '课前测验',
  inClassQuiz: '随堂测验',
  homework: '课后作业'
};

export function getHybridMethodLabel(methodKey: string, fallback: (key: string) => string): string {
  const idx = methodKey.indexOf(':');
  if (idx <= 0) return fallback(methodKey);
  const moduleKey = methodKey.slice(0, idx);
  if (!HYBRID_EVAL_MODULE_LABELS[moduleKey]) return fallback(methodKey);
  return `${HYBRID_EVAL_MODULE_LABELS[moduleKey]} · ${fallback(methodKey.slice(idx + 1))}`;
}
