package service

import (
	"context"

	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/store"
)

// LessonContentService 课程内容配置业务编排（知识点/节点作业）。
type LessonContentService struct {
	*Service
	st *store.Store
}

// NewLessonContentService 创建课程内容服务。
func NewLessonContentService(s *Service) *LessonContentService {
	return &LessonContentService{Service: s, st: s.Store()}
}

// ListKnowledgePoints 查询知识点列表。
func (s *LessonContentService) ListKnowledgePoints(ctx context.Context, p store.ListParams, cfg store.ListQueryConfig[domain.KnowledgePoint]) ([]domain.KnowledgePoint, int, error) {
	return s.st.KnowledgePoints().List(ctx, p, cfg)
}

// GetKnowledgePoint 查询单个知识点。
func (s *LessonContentService) GetKnowledgePoint(ctx context.Context, id string) (*domain.KnowledgePoint, error) {
	return s.st.KnowledgePoints().Get(ctx, id)
}

// CreateKnowledgePoint 创建知识点（事务内同步颗粒课引用）。
func (s *LessonContentService) CreateKnowledgePoint(ctx context.Context, tenantID string, p *store.KnowledgePointCreateParams) (*domain.KnowledgePoint, error) {
	var kp *domain.KnowledgePoint
	err := s.WithTx(ctx, func(txStore *store.Store) error {
		k, err := txStore.KnowledgePoints().Create(ctx, txStore.Q(), tenantID, p)
		if err != nil {
			return err
		}
		kp = k
		return nil
	})
	return kp, err
}

// UpdateKnowledgePoint 更新知识点（事务内同步颗粒课引用）。
func (s *LessonContentService) UpdateKnowledgePoint(ctx context.Context, tenantID, id string, p *store.KnowledgePointUpdateParams) (*domain.KnowledgePoint, error) {
	var kp *domain.KnowledgePoint
	err := s.WithTx(ctx, func(txStore *store.Store) error {
		k, err := txStore.KnowledgePoints().Update(ctx, txStore.Q(), tenantID, id, p)
		if err != nil {
			return err
		}
		kp = k
		return nil
	})
	return kp, err
}

// DeleteKnowledgePoint 删除知识点。
func (s *LessonContentService) DeleteKnowledgePoint(ctx context.Context, id string) error {
	return s.st.KnowledgePoints().Delete(ctx, id)
}

// ListNodeHomeworks 查询作业列表。
func (s *LessonContentService) ListNodeHomeworks(ctx context.Context, p store.ListParams, cfg store.ListQueryConfig[domain.NodeHomework]) ([]domain.NodeHomework, int, error) {
	return s.st.NodeHomeworks().List(ctx, p, cfg)
}

// GetNodeHomework 查询单个作业。
func (s *LessonContentService) GetNodeHomework(ctx context.Context, id string) (*domain.NodeHomework, error) {
	return s.st.NodeHomeworks().Get(ctx, id)
}

// CreateNodeHomework 创建作业。
func (s *LessonContentService) CreateNodeHomework(ctx context.Context, tenantID string, p *store.NodeHomeworkCreateParams) (*domain.NodeHomework, error) {
	return s.st.NodeHomeworks().Create(ctx, tenantID, p)
}

// UpdateNodeHomework 更新作业。
func (s *LessonContentService) UpdateNodeHomework(ctx context.Context, id string, p *store.NodeHomeworkUpdateParams) (*domain.NodeHomework, error) {
	return s.st.NodeHomeworks().Update(ctx, id, p)
}

// DeleteNodeHomework 删除作业。
func (s *LessonContentService) DeleteNodeHomework(ctx context.Context, id string) error {
	return s.st.NodeHomeworks().Delete(ctx, id)
}
