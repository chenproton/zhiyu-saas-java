package service

import (
	"context"
	"math"
	"strings"

	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/store"
)

// EvaluationService 评测域业务编排（题库/题目/试卷）。
type EvaluationService struct {
	*Service
	st *store.Store
}

// NewEvaluationService 创建评测服务。
func NewEvaluationService(s *Service) *EvaluationService {
	return &EvaluationService{Service: s, st: s.Store()}
}

// ListQuestionBanks 查询题库列表。
func (s *EvaluationService) ListQuestionBanks(ctx context.Context, p store.ListParams, cfg store.ListQueryConfig[domain.QuestionBank]) ([]domain.QuestionBank, int, error) {
	return s.st.QuestionBanks().List(ctx, p, cfg)
}

// GetQuestionBank 查询单个题库。
func (s *EvaluationService) GetQuestionBank(ctx context.Context, id string) (*domain.QuestionBank, error) {
	return s.st.QuestionBanks().Get(ctx, id)
}

// CreateQuestionBank 创建题库。
func (s *EvaluationService) CreateQuestionBank(ctx context.Context, tenantID string, p *store.QuestionBankCreateParams) (*domain.QuestionBank, error) {
	return s.st.QuestionBanks().Create(ctx, tenantID, p)
}

// UpdateQuestionBank 更新题库。
func (s *EvaluationService) UpdateQuestionBank(ctx context.Context, id string, p *store.QuestionBankUpdateParams) (*domain.QuestionBank, error) {
	return s.st.QuestionBanks().Update(ctx, id, p)
}

// DeleteQuestionBank 删除题库。
func (s *EvaluationService) DeleteQuestionBank(ctx context.Context, id string) error {
	return s.st.QuestionBanks().Delete(ctx, id)
}

// EnsureDraftPool 确保用户草稿池存在。
func (s *EvaluationService) EnsureDraftPool(ctx context.Context, tenantID, userID string) {
	s.st.QuestionBanks().EnsureDraftPool(ctx, tenantID, userID)
}

// IsDraftPool 查询是否草稿池。
func (s *EvaluationService) IsDraftPool(ctx context.Context, id string) (bool, error) {
	return s.st.QuestionBanks().IsDraftPool(ctx, id)
}

// Queryer 暴露底层查询器（contentActions 用）。
func (s *EvaluationService) Queryer() store.Queryer {
	return s.st.Q()
}

// ListQuestions 查询题目列表。
func (s *EvaluationService) ListQuestions(ctx context.Context, p store.ListParams, cfg store.ListQueryConfig[domain.Question]) ([]domain.Question, int, error) {
	return s.st.Questions().List(ctx, p, cfg)
}

// GetQuestion 查询单个题目。
func (s *EvaluationService) GetQuestion(ctx context.Context, id string) (*domain.Question, error) {
	return s.st.Questions().Get(ctx, id)
}

// CreateQuestion 创建题目。
func (s *EvaluationService) CreateQuestion(ctx context.Context, tenantID string, p *store.QuestionCreateParams) (*domain.Question, error) {
	return s.st.Questions().Create(ctx, tenantID, p)
}

// UpdateQuestion 更新题目。
func (s *EvaluationService) UpdateQuestion(ctx context.Context, id string, p *store.QuestionUpdateParams) (*domain.Question, error) {
	return s.st.Questions().Update(ctx, id, p)
}

// DeleteQuestion 删除题目。
func (s *EvaluationService) DeleteQuestion(ctx context.Context, id string) error {
	return s.st.Questions().Delete(ctx, id)
}

// BatchCreateQuestions 批量创建题目（事务内）。
func (s *EvaluationService) BatchCreateQuestions(ctx context.Context, tenantID, bankID, creatorID string, items []store.QuestionCreateParams) (int, error) {
	var count int
	err := s.WithTx(ctx, func(txStore *store.Store) error {
		c, err := txStore.Questions().BatchCreate(ctx, txStore.Q(), tenantID, bankID, creatorID, items)
		if err != nil {
			return err
		}
		count = c
		return nil
	})
	return count, err
}

// ListExams 查询试卷列表（批量填充题目）。
func (s *EvaluationService) ListExams(ctx context.Context, p store.ListParams, cfg store.ListQueryConfig[domain.Exam]) ([]domain.Exam, int, error) {
	items, total, err := s.st.Exams().List(ctx, p, cfg)
	if err != nil {
		return nil, 0, err
	}
	if len(items) > 0 {
		examIDs := make([]string, len(items))
		for i := range items {
			examIDs[i] = items[i].ID
			items[i].Questions = []domain.ExamQuestion{}
		}
		qMap, qErr := s.st.Exams().BatchFetchExamQuestions(ctx, examIDs)
		if qErr == nil {
			for i := range items {
				items[i].Questions = qMap[items[i].ID]
			}
		}
	}
	return items, total, nil
}

// GetExam 查询单个试卷（含题目）。
func (s *EvaluationService) GetExam(ctx context.Context, id string) (*domain.Exam, error) {
	return s.st.Exams().Get(ctx, id)
}

// ExamTenantID 查询试卷租户。
func (s *EvaluationService) ExamTenantID(ctx context.Context, id string) (string, error) {
	return s.st.Exams().TenantID(ctx, id)
}

// CreateExam 创建试卷。
func (s *EvaluationService) CreateExam(ctx context.Context, tenantID string, p *store.ExamCreateParams) (*domain.Exam, error) {
	return s.st.Exams().Create(ctx, tenantID, p)
}

// UpdateExam 更新试卷。
func (s *EvaluationService) UpdateExam(ctx context.Context, id string, p *store.ExamUpdateParams) (*domain.Exam, error) {
	return s.st.Exams().Update(ctx, id, p)
}

// DeleteExam 删除试卷。
func (s *EvaluationService) DeleteExam(ctx context.Context, id string) error {
	return s.st.Exams().Delete(ctx, id)
}

// FetchExamQuestion 查询题目快照。
func (s *EvaluationService) FetchExamQuestion(ctx context.Context, questionID string) (*store.QuestionSnapshot, error) {
	return s.st.Exams().FetchQuestion(ctx, questionID)
}

// AddExamQuestion 添加题目到试卷。
func (s *EvaluationService) AddExamQuestion(ctx context.Context, tenantID, examID string, q *store.QuestionSnapshot, score float64) error {
	if err := s.st.Exams().AddQuestion(ctx, tenantID, examID, q, score); err != nil {
		return err
	}
	return s.st.Exams().RecalcExamTotal(ctx, examID)
}

// RemoveExamQuestion 移除试卷题目。
func (s *EvaluationService) RemoveExamQuestion(ctx context.Context, examID, questionID string) error {
	if err := s.st.Exams().RemoveQuestion(ctx, examID, questionID); err != nil {
		return err
	}
	return s.st.Exams().RecalcExamTotal(ctx, examID)
}

// UpdateExamQuestionScore 更新题目分数。
func (s *EvaluationService) UpdateExamQuestionScore(ctx context.Context, examID, questionID string, score float64) error {
	hit, err := s.st.Exams().UpdateQuestionScore(ctx, examID, questionID, score)
	if err != nil {
		return err
	}
	if !hit {
		return store.ErrNotFound
	}
	return s.st.Exams().RecalcExamTotal(ctx, examID)
}

// BulkUpdateExamScores 批量更新分数（事务内）。
func (s *EvaluationService) BulkUpdateExamScores(ctx context.Context, examID string, scores map[string]float64) error {
	return s.WithTx(ctx, func(txStore *store.Store) error {
		return txStore.Exams().BulkUpdateScores(ctx, txStore.Q(), examID, scores)
	})
}

// ListExamResults 查询考试结果列表。
func (s *EvaluationService) ListExamResults(ctx context.Context, p store.ListParams, cfg store.ListQueryConfig[domain.ExamResult]) ([]domain.ExamResult, int, error) {
	return s.st.ExamResults().List(ctx, p, cfg)
}

// SubmitExamResult 提交考试结果（评分编排：拉取题目→判分→写结果→同步 3 类评价）。
func (s *EvaluationService) SubmitExamResult(ctx context.Context, tenantID, userID, usageID string, answers map[string]interface{}, methodKey string) (*domain.ExamResult, error) {
	examID, totalScore, err := s.st.ExamResults().UsageExamInfo(ctx, usageID)
	if err != nil {
		return nil, err
	}
	questions, err := s.st.ExamResults().FetchExamQuestions(ctx, examID)
	if err != nil {
		return nil, err
	}

	score := 0.0
	hasSubjective := false
	passScore := totalScore * 0.6
	for _, qq := range questions {
		if qq.Type == string(domain.QuestionTypeFill) || qq.Type == string(domain.QuestionTypeEssay) || qq.Type == string(domain.QuestionTypeShortAnswer) {
			hasSubjective = true
			continue
		}
		raw, ok := answers[qq.ID]
		if !ok {
			continue
		}
		if isCorrect(qq.Type, qq.Answer, raw) {
			score += qq.Score
		}
	}
	isPass := false
	if !hasSubjective {
		isPass = score >= passScore
	}

	profile, err := s.st.ExamResults().FetchUserProfile(ctx, userID)
	if err != nil {
		return nil, err
	}
	var majorNamePtr *string
	if profile.MajorName != "" {
		majorNamePtr = &profile.MajorName
	}

	answersJSON := domain.JSONMap(answers)
	result, err := s.st.ExamResults().SaveResult(ctx, tenantID, usageID, userID, &store.SaveExamResultParams{
		StudentName: profile.Name,
		ClassName:   profile.ClassName,
		Grade:       profile.Grade,
		MajorID:     profile.MajorID,
		Score:       score,
		TotalScore:  totalScore,
		IsPass:      isPass,
		Answers:     answersJSON,
	})
	if err != nil {
		return nil, err
	}
	result.MajorName = majorNamePtr

	s.st.ExamResults().SyncSceneEvaluation(ctx, tenantID, usageID, userID, score, totalScore, answersJSON, hasSubjective, methodKey)
	s.st.ExamResults().SyncCourseEvaluation(ctx, tenantID, usageID, userID, score, totalScore, answersJSON, hasSubjective, methodKey)
	s.st.ExamResults().SyncNodeEvaluation(ctx, tenantID, usageID, userID, score, totalScore, answersJSON, hasSubjective, methodKey)
	return result, nil
}

// isCorrect 判断客观题答案是否正确。
func isCorrect(qType string, correct []string, raw interface{}) bool {
	switch qType {
	case string(domain.QuestionTypeSingle), string(domain.QuestionTypeJudge):
		s, _ := raw.(string)
		return len(correct) > 0 && strings.EqualFold(s, correct[0])
	case string(domain.QuestionTypeMultiple):
		var given []string
		switch v := raw.(type) {
		case []string:
			given = v
		case []interface{}:
			for _, x := range v {
				if ss, ok := x.(string); ok {
					given = append(given, ss)
				}
			}
		}
		if len(given) != len(correct) {
			return false
		}
		m := make(map[string]int)
		for _, c := range correct {
			m[c]++
		}
		for _, g := range given {
			if m[g] == 0 {
				return false
			}
			m[g]--
		}
		return true
	}
	return false
}

// RoundScore 分数取整到 1 位小数。
func RoundScore(s float64) float64 {
	return math.Round(s*10) / 10
}

// ListExamUsages 查询考试安排列表。
func (s *EvaluationService) ListExamUsages(ctx context.Context, p store.ListParams, cfg store.ListQueryConfig[domain.ExamUsage]) ([]domain.ExamUsage, int, error) {
	return s.st.ExamUsages().List(ctx, p, cfg)
}

// GetExamUsage 查询单个考试安排。
func (s *EvaluationService) GetExamUsage(ctx context.Context, id string) (*domain.ExamUsage, error) {
	return s.st.ExamUsages().Get(ctx, id)
}

// CreateExamUsage 创建考试安排。
func (s *EvaluationService) CreateExamUsage(ctx context.Context, p *store.ExamUsageCreateParams) (*domain.ExamUsage, error) {
	return s.st.ExamUsages().Create(ctx, p)
}

// UpdateExamUsage 更新考试安排。
func (s *EvaluationService) UpdateExamUsage(ctx context.Context, id string, p *store.ExamUsageCreateParams) (*domain.ExamUsage, error) {
	return s.st.ExamUsages().Update(ctx, id, p)
}

// DeleteExamUsage 删除考试安排。
func (s *EvaluationService) DeleteExamUsage(ctx context.Context, id string) error {
	return s.st.ExamUsages().Delete(ctx, id)
}

// SetExamUsageStatus 更新考试安排状态。
func (s *EvaluationService) SetExamUsageStatus(ctx context.Context, id, status string) error {
	return s.st.ExamUsages().SetStatus(ctx, id, status)
}

// ListRandomDrawQuestions 查询随机抽题列表。
func (s *EvaluationService) ListRandomDrawQuestions(ctx context.Context, p store.ListParams, cfg store.ListQueryConfig[domain.RandomDrawQuestion]) ([]domain.RandomDrawQuestion, int, error) {
	return s.st.RandomDrawQuestions().List(ctx, p, cfg)
}

// GetRandomDrawQuestion 查询单个随机抽题。
func (s *EvaluationService) GetRandomDrawQuestion(ctx context.Context, id string) (*domain.RandomDrawQuestion, error) {
	return s.st.RandomDrawQuestions().Get(ctx, id)
}

// CreateRandomDrawQuestion 创建随机抽题。
func (s *EvaluationService) CreateRandomDrawQuestion(ctx context.Context, tenantID string, p *store.RandomDrawQuestionParams) (*domain.RandomDrawQuestion, error) {
	return s.st.RandomDrawQuestions().Create(ctx, tenantID, p)
}

// UpdateRandomDrawQuestion 更新随机抽题。
func (s *EvaluationService) UpdateRandomDrawQuestion(ctx context.Context, id string, p *store.RandomDrawQuestionParams) (*domain.RandomDrawQuestion, error) {
	return s.st.RandomDrawQuestions().Update(ctx, id, p)
}

// DeleteRandomDrawQuestion 删除随机抽题。
func (s *EvaluationService) DeleteRandomDrawQuestion(ctx context.Context, id string) error {
	return s.st.RandomDrawQuestions().Delete(ctx, id)
}
