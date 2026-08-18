package service

import (
	"context"
	"errors"
	"log/slog"

	"github.com/jackc/pgx/v5"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/store"
)

// NodeEvaluationResultService 节点测评结果业务编排。
type NodeEvaluationResultService struct {
	*Service
	st *store.Store
}

// NewNodeEvaluationResultService 创建节点测评结果服务。
func NewNodeEvaluationResultService(s *Service) *NodeEvaluationResultService {
	return &NodeEvaluationResultService{Service: s, st: s.Store()}
}

// List 分页查询节点测评结果。
func (s *NodeEvaluationResultService) List(ctx context.Context, p store.ListParams, cfg store.ListQueryConfig[domain.NodeEvaluationResult]) ([]domain.NodeEvaluationResult, int, error) {
	return store.ExecuteListQuery(ctx, s.st.Q(), p, cfg)
}

// SubmitNodeEvaluationResult 提交节点测评结果。
func (s *NodeEvaluationResultService) SubmitNodeEvaluationResult(ctx context.Context, p *store.NodeEvaluationResultSubmitParams) (*domain.NodeEvaluationResult, error) {
	return s.st.NodeEvaluationResults().Submit(ctx, p)
}

// Grade 节点测评结果评分（pending→evaluated），并回写考试结果分数（保持考试对象数据一致）。
func (s *NodeEvaluationResultService) Grade(ctx context.Context, tenantID, id, graderID string, p *store.NodeEvaluationResultGradeParams) error {
	result, err := s.st.NodeEvaluationResults().GetByID(ctx, tenantID, id)
	if err != nil {
		return err
	}
	if err := s.st.NodeEvaluationResults().Grade(ctx, tenantID, id, graderID, p); err != nil {
		return err
	}
	// 回写考试结果：试卷/题库/随堂测方式的考试结果同步教师评分
	examResultID, err := s.st.EvaluationResults().FindNodeExamResult(ctx, result.NodeID, result.MethodKey, result.EvaluateeID)
	if err != nil {
		// 真实 DB 错误（如 eval_data 中非法 uuid 强转失败）不得静默吞掉：
		// 教师评分成功但考试结果分数回写永久失败且无痕迹
		if !errors.Is(err, pgx.ErrNoRows) {
			slog.Error("查询节点考试结果失败，评分分数可能未同步", "nodeResultID", id, "error", err)
		}
		return nil
	}
	if examResultID == "" {
		return nil
	}
	if err := s.st.EvaluationResults().UpdateExamResultScore(ctx, s.st.Q(), examResultID, p.Score); err != nil {
		slog.Warn("同步节点考试结果分数失败", "examResultID", examResultID, "nodeResultID", id, "error", err)
	}
	return nil
}

// ListByCourse 查询课程下全部节点的测评结果（教师评分列表用）。
func (s *NodeEvaluationResultService) ListByCourse(ctx context.Context, tenantID, courseID string) ([]domain.NodeEvaluationResult, error) {
	return s.st.NodeEvaluationResults().ListByCourse(ctx, tenantID, courseID)
}

// GetByID 查询单条节点测评结果（教师评分详情用）。
func (s *NodeEvaluationResultService) GetByID(ctx context.Context, tenantID, id string) (*domain.NodeEvaluationResult, error) {
	return s.st.NodeEvaluationResults().GetByID(ctx, tenantID, id)
}
