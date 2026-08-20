import { createCrudApi, request, portalRequest, buildQuery } from './http';
import type { ListResponse } from './http';
import type { User, StaffTitle } from '@/types/user';
import type { CommunityTopic, CommunityReply, CommunityTopicSort } from '@/types/portal';
import type { Scenario } from '@/types/scene';
import type { Course } from '@/types/lesson';
import type { QuestionBank, Exam } from '@/types/evaluation';

export type FavoriteTargetType = 'scene' | 'course' | 'question_bank' | 'exam';

export interface FavoriteListResponse {
  scene: Scenario[];
  course: Course[];
  question_bank: QuestionBank[];
  exam: Exam[];
}

export const favoriteApi = {
  get: (targetType: FavoriteTargetType, id: string) =>
    request<{ isFavorite: boolean; favoriteCount: number }>(`/favorites/${targetType}/${id}`),
  toggle: (targetType: FavoriteTargetType, id: string) =>
    request<{ isFavorite: boolean; favoriteCount: number }>(`/favorites/${targetType}/${id}`, { method: 'POST' }),
  list: () => request<FavoriteListResponse>('/favorites')
};

export type UserCreate = Partial<Omit<User, 'id' | 'createdAt' | 'updatedAt'>> & {
  password?: string;
  loginName?: string;
  roleId?: string;
};
type UserUpdate = Partial<Omit<User, 'id' | 'createdAt' | 'updatedAt'>>;

export const userManagementApi = {
  ...createCrudApi<User, UserCreate, UserUpdate>('/users'),
  updateStatus: (id: string, status: string) =>
    request<User>(`/users/${id}/status`, { method: 'POST', body: JSON.stringify({ status }) }),
  resetPassword: (id: string, password: string) =>
    request<User>(`/users/${id}/reset-password`, { method: 'POST', body: JSON.stringify({ password }) }),
  bindRoles: (id: string, roleIds: string[]) =>
    request<User>(`/users/${id}/roles`, { method: 'POST', body: JSON.stringify({ roleIds }) }),
  batchCreate: (reqs: UserCreate[]) =>
    request<ListResponse<User>>('/users/batch', { method: 'POST', body: JSON.stringify({ users: reqs }) }),
  batchGraduate: (req: { userIds: string[]; graduateYear?: number }) =>
    request<{ count: number }>('/users/batch-graduate', { method: 'POST', body: JSON.stringify(req) }),
  batchDelete: (userIds: string[]) =>
    request<{ count: number }>('/users/batch-delete', { method: 'POST', body: JSON.stringify({ userIds }) }),
  batchUpdateOrgNode: (req: { userIds: string[]; orgNodeId?: string }) =>
    request<{ count: number }>('/users/batch-org-node', { method: 'POST', body: JSON.stringify(req) })
};

export const portalCommunityApi = {
  listTopics: (params?: { sort?: CommunityTopicSort; limit?: number; offset?: number }) =>
    request<ListResponse<CommunityTopic>>(`/portal/community/topics${buildQuery(params || {})}`),
  createTopic: (req: { title: string; content: string; tag?: string }) =>
    request<{ id: string }>('/portal/community/topics', {
      method: 'POST',
      body: JSON.stringify(req)
    }),
  getTopic: (id: string) => request<CommunityTopic>(`/portal/community/topics/${id}`),
  listReplies: (id: string) =>
    request<ListResponse<CommunityReply>>(`/portal/community/topics/${id}/replies`),
  createReply: (id: string, req: { content: string; parentId?: string }) =>
    request<{ id: string }>(`/portal/community/topics/${id}/replies`, {
      method: 'POST',
      body: JSON.stringify(req)
    })
};

export const staffTitleApi = {
  list: (params?: { tenantId?: string; search?: string; limit?: number; offset?: number }) =>
    portalRequest<ListResponse<StaffTitle>>(`/staff-titles${buildQuery(params || {})}`),
  get: (id: string) => portalRequest<StaffTitle>(`/staff-titles/${id}`),
  create: (req: Omit<StaffTitle, 'id' | 'userCount' | 'createdAt'>) =>
    portalRequest<StaffTitle>('/staff-titles', { method: 'POST', body: JSON.stringify(req) }),
  update: (id: string, req: Partial<Omit<StaffTitle, 'id' | 'userCount' | 'createdAt'>>) =>
    portalRequest<StaffTitle>(`/staff-titles/${id}`, { method: 'PUT', body: JSON.stringify(req) }),
  delete: (id: string) =>
    portalRequest<{ id: string }>(`/staff-titles/${id}`, { method: 'DELETE' })
};
