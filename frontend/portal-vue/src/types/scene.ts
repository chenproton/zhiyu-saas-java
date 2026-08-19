import type { ContentStatus } from './content-status';

export interface Scenario {
  id: string;
  name: string;
  code?: string;
  coverImage?: string;
  careerPositionId?: string;
  industryIds?: string[];
  industryNames?: string[];
  professionIds?: string[];
  professionNames?: string[];
  batchId?: string;
  difficulty: number;
  version: string;
  viewCount?: number;
  status: ContentStatus;
  sourceType?: 'school' | 'enterprise';
  sourceEnterpriseId?: string;
  background?: string;
  deliveryGoal?: string;
  creatorId: string;
  creatorName?: string;
  coBuilderIds?: string[];
  createdAt: string;
  updatedAt: string;
  publishTime?: string;
  taskCount?: number;
}

export interface ScenarioTask {
  id: string;
  scenarioId: string;
  name: string;
  code: string;
  sortOrder: number;
  description?: string;
  detailedDescription?: string;
  descriptionPdf?: string;
  estimatedHours: number;
  taskType: 'assessment' | 'training';
  difficulty: number;
  background?: string;
  dependencyIds?: string[];
  isReferenced: boolean;
  sourceScenarioId?: string;
  knowledgePointIds?: string[];
  knowledgePointNames?: string[];
  abilityPointIds?: string[];
  abilityPointNames?: string[];
  resourceIds?: string[];
  evalData?: Record<string, unknown>;
}

// 场景任务资源（上传/引用的文档、附件等），对齐 React shared-types scene.ts TaskResource
export interface TaskResource {
  id: string;
  name: string;
  type: string;
  url?: string;
  description?: string;
  thumbnail?: string;
  size?: string;
  knowledgePointIds?: string[];
  extraData?: Record<string, unknown>;
  uploadedBy?: string;
  uploadedAt: string;
}

// 任务资源绑定（task-resources），对齐 React shared-types scene.ts TaskResourceBinding
export interface TaskResourceBinding {
  id: string;
  taskId: string;
  resourceId: string;
}
