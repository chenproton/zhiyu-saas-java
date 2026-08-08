package service

import (
	"context"

	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/store"
)

// FavoritesService 通用收藏（场景/课程/题库/试卷）业务编排。
type FavoritesService struct {
	*Service
	st *store.Store
}

// NewFavoritesService 创建通用收藏 service。
func NewFavoritesService(s *Service) *FavoritesService {
	return &FavoritesService{Service: s, st: s.Store()}
}

// GetFavorite 查询收藏状态。
func (s *FavoritesService) GetFavorite(ctx context.Context, userID, targetType, targetID string) (bool, error) {
	return s.st.Favorites().GetFavorite(ctx, userID, targetType, targetID)
}

// FavoriteTargetTenant 查询收藏目标的所属租户。
func (s *FavoritesService) FavoriteTargetTenant(ctx context.Context, targetType, targetID string) (string, error) {
	return s.st.Favorites().FavoriteTargetTenant(ctx, targetType, targetID)
}

// FavoriteCount 查询收藏数。
func (s *FavoritesService) FavoriteCount(ctx context.Context, targetType, targetID string) (int, error) {
	return s.st.Favorites().FavoriteCount(ctx, targetType, targetID)
}

// ToggleFavorite 切换收藏，返回新状态。
func (s *FavoritesService) ToggleFavorite(ctx context.Context, userID, targetType, targetID string) (bool, error) {
	return s.st.Favorites().ToggleFavorite(ctx, userID, targetType, targetID)
}

// ListScenes 查询用户收藏的场景。
func (s *FavoritesService) ListScenes(ctx context.Context, userID, tenantID string) ([]domain.Scenario, error) {
	return s.st.Favorites().ListScenes(ctx, userID, tenantID)
}

// ListCourses 查询用户收藏的课程。
func (s *FavoritesService) ListCourses(ctx context.Context, userID, tenantID string) ([]domain.Course, error) {
	return s.st.Favorites().ListCourses(ctx, userID, tenantID)
}

// ListQuestionBanks 查询用户收藏的题库。
func (s *FavoritesService) ListQuestionBanks(ctx context.Context, userID, tenantID string) ([]domain.QuestionBank, error) {
	return s.st.Favorites().ListQuestionBanks(ctx, userID, tenantID)
}

// ListExams 查询用户收藏的试卷。
func (s *FavoritesService) ListExams(ctx context.Context, userID, tenantID string) ([]domain.Exam, error) {
	return s.st.Favorites().ListExams(ctx, userID, tenantID)
}
