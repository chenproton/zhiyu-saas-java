export interface AIAgent {
  id: string;
  name: string;
  avatar: string;
  description: string;
  coverImage?: string;
  greeting: string;
  systemPrompt: string;
  status: string;
  reviewComment?: string;
  chatCount: number;
  viewCount: number;
  majorId?: string;
  departmentId?: string;
  majorName?: string;
  departmentName?: string;
  ownerId: string;
  ownerName?: string;
  kbIds?: string[];
  kbNames?: string[];
  createdAt: string;
  updatedAt: string;
}

export type AIKBType = 'course_resource' | 'research' | 'teaching_case' | 'qa';

export const AI_KB_TYPE_LABELS: Record<AIKBType, string> = {
  course_resource: '课程资源',
  research: '教研',
  teaching_case: '教学案例',
  qa: '问答'
};

export interface AIKnowledgeBase {
  id: string;
  name: string;
  description: string;
  tags: string[];
  coverImage?: string;
  status: string;
  reviewComment?: string;
  docCount: number;
  askCount: number;
  viewCount: number;
  ownerId: string;
  majorId?: string;
  departmentId?: string;
  majorName?: string;
  departmentName?: string;
  kbType?: AIKBType;
  ownerName?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AIIntegration {
  id: string;
  kind: 'agent' | 'app';
  name: string;
  description: string;
  url: string;
  icon: string;
  category: string;
  sort: number;
  status: 'active' | 'inactive';
  createdAt: string;
}

export interface AIAdminOverview {
  kbTotal: number;
  kbPending: number;
  kbPublished: number;
  agentTotal: number;
  agentPending: number;
  agentPublished: number;
  integrations: number;
}
