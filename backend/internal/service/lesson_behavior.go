package service

import (
	"context"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/store"
)

// ListLessonBehaviorRecords 查询课堂行为记录（限定租户）。
func (s *LessonContentService) ListLessonBehaviorRecords(ctx context.Context, tenantID, courseID, startDate, endDate string) ([]domain.LessonBehaviorRecord, error) {
	return s.st.LessonBehaviors().ListRecords(ctx, tenantID, courseID, startDate, endDate)
}

// UpsertLessonBehavior 保存课堂行为记录。
func (s *LessonContentService) UpsertLessonBehavior(ctx context.Context, tenantID string, p *store.LessonBehaviorUpsertParams) (*domain.LessonBehaviorRecord, error) {
	return s.st.LessonBehaviors().Upsert(ctx, tenantID, p)
}
