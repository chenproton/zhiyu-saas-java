import { request } from '../api-helpers'
import type { Scenario } from '../types/scene'
import type { Course } from '../types/lesson'
import type { QuestionBank, Exam } from '../types/evaluation'
import type { CareerPosition } from '../types/job'

// 通用收藏目标类型（岗位收藏沿用 positionApi 的独立接口）
export type FavoriteTargetType = 'scene' | 'course' | 'question_bank' | 'exam'

export interface FavoriteStatus {
  isFavorite: boolean
  favoriteCount: number
}

export interface FavoriteListResponse {
  scene: Scenario[]
  course: Course[]
  question_bank: QuestionBank[]
  exam: Exam[]
}

export const favoriteApi = {
  get: (targetType: FavoriteTargetType, id: string) =>
    request<FavoriteStatus>(`/favorites/${targetType}/${id}`),
  toggle: (targetType: FavoriteTargetType, id: string) =>
    request<FavoriteStatus>(`/favorites/${targetType}/${id}`, { method: 'POST' }),
  list: () => request<FavoriteListResponse>('/favorites'),
}
