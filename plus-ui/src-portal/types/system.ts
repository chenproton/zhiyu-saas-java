export interface Organization {
  id: string;
  tenantId: string;
  name: string;
  typeId: string;
  parentId?: string;
  sortOrder: number;
  memberCount: number;
  children?: Organization[];
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowStep {
  name: string;
  order: number;
  approverIds: string[];
  approvalMode: 'any' | 'all';
}

export interface Workflow {
  id: string;
  tenantId?: string;
  name: string;
  scene?: string;
  description?: string;
  steps: WorkflowStep[];
  majorIds: string[];
  usageCount: number;
  status: 'active' | 'inactive';
  createdAt: string;
}

export interface Role {
  id: string;
  tenantId: string;
  code: string;
  name: string;
  description?: string;
  permissions: Record<string, unknown>;
  userCount: number;
  status: string;
  createdAt: string;
}

export interface Major {
  id: string;
  tenantId: string;
  code: string;
  name: string;
  alias?: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Industry {
  id: string;
  tenantId: string;
  code: string;
  name: string;
  parentId?: string;
  enabled: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface OrgType {
  id: string;
  tenantId: string;
  name: string;
  category: 'internal' | 'business' | 'external';
  description?: string;
  isDefault?: boolean;
  createdAt: string;
}
