package service

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"

	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/store"
)

// TaskEvaluationService 任务测评业务编排（保存方法含临时考试联动）。
type TaskEvaluationService struct {
	*Service
	st *store.Store
}

// NewTaskEvaluationService 创建任务测评服务。
func NewTaskEvaluationService(s *Service) *TaskEvaluationService {
	return &TaskEvaluationService{Service: s, st: s.Store()}
}

// ListMethods 查询任务测评方式。
func (s *TaskEvaluationService) ListMethods(ctx context.Context, taskID, tenantID string) ([]domain.TaskEvaluationMethod, error) {
	return s.st.TaskEval().FetchTaskMethods(ctx, taskID, tenantID)
}

// TaskTenantID 查询任务所属租户（归属校验用）。
func (s *TaskEvaluationService) TaskTenantID(ctx context.Context, taskID string) (string, error) {
	return s.st.ScenarioTasks().TaskTenantID(ctx, taskID)
}

// SaveMethods 保存任务测评方式（乐观锁 + 事务内软删/重写/临时考试联动）。
func (s *TaskEvaluationService) SaveMethods(ctx context.Context, tenantID, taskID, creatorID string, version int, inputs []*MethodSaveInput) ([]domain.TaskEvaluationMethod, error) {
	if version > 0 {
		currentVersion, err := s.st.TaskEval().MaxMethodVersion(ctx, taskID, tenantID)
		if err != nil {
			return nil, err
		}
		if currentVersion > version {
			return nil, ErrMethodVersionConflict
		}
	}

	taskName := "未命名任务"
	if name, err := s.st.TaskEval().TaskName(ctx, taskID); err == nil && name != "" {
		taskName = name
	}
	newVersion := version + 1

	err := s.WithTx(ctx, func(txStore *store.Store) error {
		for _, m := range inputs {
			evalSubjects := JSONRawToJSONSlice(m.EvalSubjects)
			resourceConfig := JSONRawToJSONMap(m.ResourceConfig)

			if m.IsEnabled && (m.MethodKey == "paper" || m.MethodKey == "question_bank" || m.MethodKey == "quiz") {
				updatedConfig, err := txStore.TaskEval().EnsureExamUsageForMethod(ctx, txStore.Q(), tenantID, taskID, taskName, creatorID, m.MethodKey, resourceConfig)
				if err != nil {
					slog.Info("failed to ensure exam usage", "task", taskID, "method", m.MethodKey, "error", err)
				} else {
					resourceConfig = updatedConfig
				}
			}

			if err := txStore.TaskEval().SaveTaskMethod(ctx, txStore.Q(), tenantID, taskID, newVersion, &store.TaskMethodInput{
				MethodKey:        m.MethodKey,
				Weight:           m.Weight,
				EvalObject:       m.EvalObject,
				ScoreType:        m.ScoreType,
				EvalSubjects:     evalSubjects,
				RubricTemplateID: m.RubricTemplateID,
				ResourceConfig:   resourceConfig,
				IsEnabled:        m.IsEnabled,
				EvalPoints:       convertEvalPoints(m.EvalPoints),
				ReviewSteps:      convertReviewSteps(m.ReviewSteps),
			}); err != nil {
				return err
			}
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return s.st.TaskEval().FetchTaskMethods(ctx, taskID, tenantID)
}

// ListTemplates 查询评分模板列表。
func (s *TaskEvaluationService) ListTemplates(ctx context.Context, p store.ListParams, cfg store.ListQueryConfig[domain.RubricTemplate]) ([]domain.RubricTemplate, int, error) {
	return s.st.TaskEval().ListRubricTemplates(ctx, p, cfg)
}

// GetTemplate 查询单个评分模板。
func (s *TaskEvaluationService) GetTemplate(ctx context.Context, id string) (*domain.RubricTemplate, error) {
	return s.st.TaskEval().GetRubricTemplate(ctx, id)
}

// CreateTemplate 创建评分模板。
func (s *TaskEvaluationService) CreateTemplate(ctx context.Context, tenantID string, p *store.RubricTemplateParams) (*domain.RubricTemplate, error) {
	return s.st.TaskEval().CreateRubricTemplate(ctx, tenantID, p)
}

// UpdateTemplate 更新评分模板。
func (s *TaskEvaluationService) UpdateTemplate(ctx context.Context, id string, p *store.RubricTemplateParams) (*domain.RubricTemplate, error) {
	return s.st.TaskEval().UpdateRubricTemplate(ctx, id, p)
}

// DeleteTemplate 软删除评分模板。
func (s *TaskEvaluationService) DeleteTemplate(ctx context.Context, id string) error {
	return s.st.TaskEval().DeleteRubricTemplate(ctx, id)
}

// MethodSaveInput 保存方法输入。
type MethodSaveInput struct {
	MethodKey        string
	Weight           float64
	EvalObject       string
	ScoreType        *string
	EvalSubjects     json.RawMessage
	RubricTemplateID *string
	ResourceConfig   json.RawMessage
	IsEnabled        bool
	EvalPoints       []EvalPointSaveInput
	ReviewSteps      []ReviewStepSaveInput
}

// EvalPointSaveInput 评估点输入。
type EvalPointSaveInput struct {
	Name              string
	Description       *string
	SubType           *string
	Types             []string
	Weight            float64
	ScoringMethod     string
	GradeMapping      json.RawMessage
	KnowledgePointIDs []string
	AbilityPointIDs   []string
	SortOrder         int
}

// ReviewStepSaveInput 评审步骤输入。
type ReviewStepSaveInput struct {
	Label       string
	Description *string
	Enabled     bool
	SubjectType *string
	Weight      float64
	SortOrder   int
}

func JSONRawToJSONSlice(raw json.RawMessage) domain.JSONSlice {
	if len(raw) == 0 || string(raw) == "null" {
		return domain.JSONSlice{}
	}
	var s domain.JSONSlice
	_ = json.Unmarshal(raw, &s)
	if s == nil {
		return domain.JSONSlice{}
	}
	return s
}

func JSONRawToJSONMap(raw json.RawMessage) domain.JSONMap {
	if len(raw) == 0 || string(raw) == "null" {
		return domain.JSONMap{}
	}
	var m domain.JSONMap
	_ = json.Unmarshal(raw, &m)
	if m == nil {
		return domain.JSONMap{}
	}
	return m
}

func convertEvalPoints(pts []EvalPointSaveInput) []store.TaskEvalPointInput {
	out := make([]store.TaskEvalPointInput, 0, len(pts))
	for _, p := range pts {
		out = append(out, store.TaskEvalPointInput{
			Name:              p.Name,
			Description:       p.Description,
			SubType:           p.SubType,
			Types:             p.Types,
			Weight:            p.Weight,
			ScoringMethod:     p.ScoringMethod,
			GradeMapping:      JSONRawToJSONSlice(p.GradeMapping),
			KnowledgePointIDs: p.KnowledgePointIDs,
			AbilityPointIDs:   p.AbilityPointIDs,
			SortOrder:         p.SortOrder,
		})
	}
	return out
}

func convertReviewSteps(steps []ReviewStepSaveInput) []store.TaskReviewStepInput {
	out := make([]store.TaskReviewStepInput, 0, len(steps))
	for _, rs := range steps {
		out = append(out, store.TaskReviewStepInput{
			Label:       rs.Label,
			Description: rs.Description,
			Enabled:     rs.Enabled,
			SubjectType: rs.SubjectType,
			Weight:      rs.Weight,
			SortOrder:   rs.SortOrder,
		})
	}
	return out
}

// ErrMethodVersionConflict 版本冲突（其他会话已修改）。
var ErrMethodVersionConflict = errors.New("method version conflict")
