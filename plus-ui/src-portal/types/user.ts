export interface User {
  id: string;
  tenantId?: string;
  institutionId?: string;
  orgNodeId?: string;
  majorId?: string;
  role: 'school' | 'enterprise' | 'operator';
  platform: 'saas' | 'portal' | 'partner';
  roleIds?: string[];
  roleCodes?: string[];
  roleNames?: string[];
  loginName?: string;
  username: string;
  name: string;
  email?: string;
  phone?: string;
  avatarUrl?: string;
  studentNo?: string;
  workId?: string;
  idCard?: string;
  titleIds?: string[];
  status: string;
  graduateYear?: number;
  lastLoginAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface StaffTitle {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  userCount?: number;
  createdAt: string;
}
