export interface ApprovalHistoryItem {
  stepIdx: number;
  approverId?: string;
  approverName?: string;
  status: string;
  comment?: string;
  createdAt?: string;
}

export interface ApprovalRecord {
  id: string;
  tenantId?: string;
  targetType: string;
  targetId: string;
  workflowId?: string;
  currentStepIdx: number;
  status: 'pending' | 'approved' | 'rejected';
  submitterId: string;
  history: ApprovalHistoryItem[];
  createdAt: string;
  updatedAt: string;
}
