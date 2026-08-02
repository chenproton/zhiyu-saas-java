package service

import (
	"context"
	"math"
	"strings"

	"github.com/jackc/pgx/v5"
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

// AddExamQuestion 添加题目到试卷（事务内：添加 + 重算总分）。
func (s *EvaluationService) AddExamQuestion(ctx context.Context, tenantID, examID string, q *store.QuestionSnapshot, score float64) error {
	return s.WithTx(ctx, func(txStore *store.Store) error {
		if err := txStore.Exams().AddQuestion(ctx, tenantID, examID, q, score); err != nil {
			return err
		}
		return txStore.Exams().RecalcExamTotal(ctx, examID)
	})
}

// RemoveExamQuestion 移除试卷题目（事务内：移除 + 重算总分）。
func (s *EvaluationService) RemoveExamQuestion(ctx context.Context, examID, questionID string) error {
	return s.WithTx(ctx, func(txStore *store.Store) error {
		if err := txStore.Exams().RemoveQuestion(ctx, examID, questionID); err != nil {
			return err
		}
		return txStore.Exams().RecalcExamTotal(ctx, examID)
	})
}

// UpdateExamQuestionScore 更新题目分数（事务内：更新 + 重算总分）。
func (s *EvaluationService) UpdateExamQuestionScore(ctx context.Context, examID, questionID string, score float64) error {
	return s.WithTx(ctx, func(txStore *store.Store) error {
		hit, err := txStore.Exams().UpdateQuestionScore(ctx, examID, questionID, score)
		if err != nil {
			return err
		}
		if !hit {
			return store.ErrNotFound
		}
		return txStore.Exams().RecalcExamTotal(ctx, examID)
	})
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

// SubmitExamResult 提交考试结果（评分编排：拉取题目→判分→写结果→同步 3 类评价，全部写在同一事务）。
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
	var result *domain.ExamResult
	if err := s.WithTx(ctx, func(txStore *store.Store) error {
		r, err := txStore.ExamResults().SaveResult(ctx, tenantID, usageID, userID, &store.SaveExamResultParams{
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
			return err
		}
		result = r
		if err := txStore.ExamResults().SyncSceneEvaluation(ctx, tenantID, usageID, userID, score, totalScore, answersJSON, hasSubjective, methodKey); err != nil {
			return err
		}
		if err := txStore.ExamResults().SyncCourseEvaluation(ctx, tenantID, usageID, userID, score, totalScore, answersJSON, hasSubjective, methodKey); err != nil {
			return err
		}
		if err := txStore.ExamResults().SyncNodeEvaluation(ctx, tenantID, usageID, userID, score, totalScore, answersJSON, hasSubjective, methodKey); err != nil {
			return err
		}
		return nil
	}); err != nil {
		return nil, err
	}
	result.MajorName = majorNamePtr
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

// PositionTenantID 查询岗位租户。
func (s *EvaluationService) PositionTenantID(ctx context.Context, positionID string) (string, error) {
	return s.st.CertGrades().PositionTenantID(ctx, positionID)
}

// ListCertGrades 查询岗位认证等级聚合数据。
func (s *EvaluationService) ListCertGrades(ctx context.Context, positionID string) ([]store.CertGradeRow, []store.CompRequirement, []store.LeaderboardEntry, error) {
	grades, err := s.st.CertGrades().ListGrades(ctx, positionID)
	if err != nil {
		return nil, nil, nil, err
	}
	gradeIDs := make([]string, 0, len(grades))
	for _, g := range grades {
		gradeIDs = append(gradeIDs, g.ID)
	}
	if len(gradeIDs) == 0 {
		return grades, nil, nil, nil
	}
	comps, err := s.st.CertGrades().ListCompRequirements(ctx, gradeIDs)
	if err != nil {
		return nil, nil, nil, err
	}
	lb, err := s.st.CertGrades().ListLeaderboard(ctx, gradeIDs)
	if err != nil {
		return nil, nil, nil, err
	}
	return grades, comps, lb, nil
}

// ListCertificationRules 查询认证规则列表。
func (s *EvaluationService) ListCertificationRules(ctx context.Context, p store.ListParams, cfg store.ListQueryConfig[domain.CertificationRule]) ([]domain.CertificationRule, int, error) {
	return s.st.Certifications().ListRules(ctx, p, cfg)
}

// GetCertificationRule 查询单个规则。
func (s *EvaluationService) GetCertificationRule(ctx context.Context, id string) (*domain.CertificationRule, error) {
	return s.st.Certifications().GetRule(ctx, id)
}

// GetCertificationRuleByTenant 查询单个规则（租户限定）。
func (s *EvaluationService) GetCertificationRuleByTenant(ctx context.Context, id, tenantID string) (*domain.CertificationRule, error) {
	return s.st.Certifications().GetRuleByTenant(ctx, id, tenantID)
}

// FindRuleByPosition 按岗位查规则。
func (s *EvaluationService) FindRuleByPosition(ctx context.Context, tenantID, positionID string) (*domain.CertificationRule, error) {
	return s.st.Certifications().FindRuleByPosition(ctx, tenantID, positionID)
}

// CreateCertificationRule 创建规则。
func (s *EvaluationService) CreateCertificationRule(ctx context.Context, tenantID, positionID, ruleSource string) (*domain.CertificationRule, error) {
	return s.st.Certifications().CreateRule(ctx, tenantID, positionID, ruleSource)
}

// UpdateCertificationRuleStatus 更新规则状态。
func (s *EvaluationService) UpdateCertificationRuleStatus(ctx context.Context, id, tenantID, status string) (*domain.CertificationRule, error) {
	return s.st.Certifications().UpdateRuleStatus(ctx, id, tenantID, status)
}

// UpdateCertificationRule 更新规则。
func (s *EvaluationService) UpdateCertificationRule(ctx context.Context, id, positionID, ruleSource string) (*domain.CertificationRule, error) {
	return s.st.Certifications().UpdateRule(ctx, id, positionID, ruleSource)
}

// DeleteCertificationRule 删除规则。
func (s *EvaluationService) DeleteCertificationRule(ctx context.Context, id string) error {
	return s.st.Certifications().DeleteRule(ctx, id)
}

// ListCertificationItems 查询规则下能力项。
func (s *EvaluationService) ListCertificationItems(ctx context.Context, ruleID string) ([]domain.CertificationAbilityItem, error) {
	return s.st.Certifications().ListItems(ctx, ruleID)
}

// GetCertificationItem 查询单个能力项。
func (s *EvaluationService) GetCertificationItem(ctx context.Context, id string) (*domain.CertificationAbilityItem, error) {
	return s.st.Certifications().GetItem(ctx, id)
}

// CreateCertificationItem 创建能力项。
func (s *EvaluationService) CreateCertificationItem(ctx context.Context, tenantID, ruleID, name string, sortOrder int) (*domain.CertificationAbilityItem, error) {
	return s.st.Certifications().CreateItem(ctx, tenantID, ruleID, name, sortOrder)
}

// UpdateCertificationItem 更新能力项。
func (s *EvaluationService) UpdateCertificationItem(ctx context.Context, id, name string, sortOrder int) (*domain.CertificationAbilityItem, error) {
	return s.st.Certifications().UpdateItem(ctx, id, name, sortOrder)
}

// DeleteCertificationItem 删除能力项。
func (s *EvaluationService) DeleteCertificationItem(ctx context.Context, id string) error {
	return s.st.Certifications().DeleteItem(ctx, id)
}

// ListCertificationPoints 查询项下能力点。
func (s *EvaluationService) ListCertificationPoints(ctx context.Context, itemID string) ([]domain.CertificationAbilityPoint, error) {
	return s.st.Certifications().ListPoints(ctx, itemID)
}

// GetCertificationPoint 查询单个能力点。
func (s *EvaluationService) GetCertificationPoint(ctx context.Context, id string) (*domain.CertificationAbilityPoint, error) {
	return s.st.Certifications().GetPoint(ctx, id)
}

// CreateCertificationPoint 创建能力点。
func (s *EvaluationService) CreateCertificationPoint(ctx context.Context, p *store.CertificationPointParams) (*domain.CertificationAbilityPoint, error) {
	return s.st.Certifications().CreatePoint(ctx, p)
}

// UpdateCertificationPoint 更新能力点。
func (s *EvaluationService) UpdateCertificationPoint(ctx context.Context, id, tenantID string, p *store.CertificationPointParams) (*domain.CertificationAbilityPoint, error) {
	return s.st.Certifications().UpdatePoint(ctx, id, tenantID, p)
}

// DeleteCertificationPoint 删除能力点。
func (s *EvaluationService) DeleteCertificationPoint(ctx context.Context, id string) error {
	return s.st.Certifications().DeletePoint(ctx, id)
}

// GetCertificationTask 查询关联任务。
func (s *EvaluationService) GetCertificationTask(ctx context.Context, id string) (*domain.CertificationRelatedTask, error) {
	return s.st.Certifications().GetTask(ctx, id)
}

// CreateCertificationTask 创建关联任务。
func (s *EvaluationService) CreateCertificationTask(ctx context.Context, tenantID, certPointID, taskID string, maxScore, weight float64) (*domain.CertificationRelatedTask, error) {
	return s.st.Certifications().CreateTask(ctx, tenantID, certPointID, taskID, maxScore, weight)
}

// UpdateCertificationTask 更新关联任务。
func (s *EvaluationService) UpdateCertificationTask(ctx context.Context, id, tenantID, taskID string, maxScore, weight float64) (*domain.CertificationRelatedTask, error) {
	return s.st.Certifications().UpdateTask(ctx, id, tenantID, taskID, maxScore, weight)
}

// DeleteCertificationTask 删除关联任务。
func (s *EvaluationService) DeleteCertificationTask(ctx context.Context, id, tenantID string) error {
	return s.st.Certifications().DeleteTask(ctx, id, tenantID)
}

// GetCertificationFull 查询完整规则（items+points+tasks 聚合）。
func (s *EvaluationService) GetCertificationFull(ctx context.Context, ruleID string) ([]store.FullItem, []store.FullPoint, []domain.CertificationRelatedTask, error) {
	items, err := s.st.Certifications().ListFullItems(ctx, ruleID)
	if err != nil {
		return nil, nil, nil, err
	}
	itemIDs := make([]string, 0, len(items))
	for _, it := range items {
		itemIDs = append(itemIDs, it.ID)
	}
	if len(itemIDs) == 0 {
		return items, nil, nil, nil
	}
	points, err := s.st.Certifications().ListFullPoints(ctx, itemIDs)
	if err != nil {
		return nil, nil, nil, err
	}
	pointIDs := make([]string, 0, len(points))
	for _, p := range points {
		pointIDs = append(pointIDs, p.ID)
	}
	if len(pointIDs) == 0 {
		return items, points, nil, nil
	}
	tasks, err := s.st.Certifications().ListTasksByPointIDs(ctx, pointIDs)
	if err != nil {
		return nil, nil, nil, err
	}
	return items, points, tasks, nil
}

// PutCertificationFull 全量保存规则（事务）。
func (s *EvaluationService) PutCertificationFull(ctx context.Context, tenantID, ruleID, positionID, ruleSource string, levelMapping domain.JSONSlice, items []store.PutFullRuleItem) error {
	return s.WithTx(ctx, func(txStore *store.Store) error {
		return txStore.Certifications().PutFullRule(ctx, txStore.Q(), tenantID, ruleID, positionID, ruleSource, levelMapping, items)
	})
}

// ListEvaluationCategories 查询评价分类。
func (s *EvaluationService) ListEvaluationCategories(ctx context.Context) ([]domain.EvaluationMethodCategory, error) {
	return s.st.EvaluationMethods().ListCategories(ctx)
}

// ListEvaluationMethods 查询评价方法列表。
func (s *EvaluationService) ListEvaluationMethods(ctx context.Context, p store.ListParams, cfg store.ListQueryConfig[domain.EvaluationMethod]) ([]domain.EvaluationMethod, int, error) {
	return s.st.EvaluationMethods().List(ctx, p, cfg)
}

// GetEvaluationMethod 查询单个评价方法。
func (s *EvaluationService) GetEvaluationMethod(ctx context.Context, id string) (*domain.EvaluationMethod, error) {
	return s.st.EvaluationMethods().Get(ctx, id)
}

// ToggleEvaluationMethod 切换启用状态。
func (s *EvaluationService) ToggleEvaluationMethod(ctx context.Context, id string, enabled bool) (*domain.EvaluationMethod, error) {
	return s.st.EvaluationMethods().Toggle(ctx, id, enabled)
}

// ListAppeals 查询申诉列表。
func (s *EvaluationService) ListAppeals(ctx context.Context, p store.ListParams, cfg store.ListQueryConfig[domain.AppealRecord]) ([]domain.AppealRecord, int, error) {
	return s.st.Appeals().List(ctx, p, cfg)
}

// GetAppeal 查询单个申诉。
func (s *EvaluationService) GetAppeal(ctx context.Context, id string) (*domain.AppealRecord, error) {
	return s.st.Appeals().Get(ctx, id)
}

// CreateAppeal 创建申诉。
func (s *EvaluationService) CreateAppeal(ctx context.Context, tenantID, userID, appealType, reason string) (*domain.AppealRecord, error) {
	return s.st.Appeals().Create(ctx, tenantID, userID, appealType, reason)
}

// ProcessAppeal 处理申诉。
func (s *EvaluationService) ProcessAppeal(ctx context.Context, id, status string) (*domain.AppealRecord, error) {
	return s.st.Appeals().Process(ctx, id, status)
}

// ListEvaluationResults 查询评价结果列表。
func (s *EvaluationService) ListEvaluationResults(ctx context.Context, p store.ListParams, cfg store.ListQueryConfig[domain.SceneEvaluationResult]) ([]domain.SceneEvaluationResult, int, error) {
	return s.st.EvaluationResults().List(ctx, p, cfg)
}

// GetEvaluationResult 查询单个评价结果。
func (s *EvaluationService) GetEvaluationResult(ctx context.Context, id string) (*domain.SceneEvaluationResult, error) {
	return s.st.EvaluationResults().Get(ctx, id)
}

// SubmitEvaluationResult 提交评价结果。
func (s *EvaluationService) SubmitEvaluationResult(ctx context.Context, p *store.EvaluationResultSubmitParams) (*domain.SceneEvaluationResult, error) {
	return s.st.EvaluationResults().Submit(ctx, p)
}

// GradeEvaluationResult 评分并同步考试分数。
func (s *EvaluationService) GradeEvaluationResult(ctx context.Context, id, graderID string, p *store.EvaluationResultGradeParams, taskID, methodKey, evaluateeID string) error {
	if err := s.st.EvaluationResults().Grade(ctx, id, graderID, p); err != nil {
		return err
	}
	s.syncExamResultScore(ctx, taskID, methodKey, evaluateeID, p.Score)
	return nil
}

// BatchGradeEvaluationResults 批量评分（事务）并同步考试分数。
func (s *EvaluationService) BatchGradeEvaluationResults(ctx context.Context, graderID string, items []store.EvaluationResultGradeItem) ([]GradeTarget, error) {
	var targets []GradeTarget
	err := s.WithTx(ctx, func(txStore *store.Store) error {
		if err := txStore.EvaluationResults().BatchGrade(ctx, txStore.Q(), graderID, items); err != nil {
			return err
		}
		for _, item := range items {
			res, err := txStore.EvaluationResults().Get(ctx, item.ID)
			if err != nil {
				continue
			}
			targets = append(targets, GradeTarget{TaskID: res.TaskID, MethodKey: res.MethodKey, EvaluateeID: res.EvaluateeID, Score: item.Score})
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	for _, t := range targets {
		s.syncExamResultScore(ctx, t.TaskID, t.MethodKey, t.EvaluateeID, t.Score)
	}
	return targets, nil
}

// GradeTarget 评分目标。
type GradeTarget struct {
	TaskID      string
	MethodKey   string
	EvaluateeID string
	Score       float64
}

// syncExamResultScore 同步考试结果分数。
func (s *EvaluationService) syncExamResultScore(ctx context.Context, taskID, methodKey, evaluateeID string, score float64) {
	if methodKey != "paper" && methodKey != "question_bank" && methodKey != "quiz" {
		return
	}
	examResultID, err := s.st.EvaluationResults().FindLatestExamResult(ctx, taskID, methodKey, evaluateeID)
	if err != nil || examResultID == "" {
		return
	}
	s.st.EvaluationResults().UpdateExamResultScore(ctx, examResultID, score)
}

// ListStudentPortraits 查询学生画像列表。
func (s *EvaluationService) ListStudentPortraits(ctx context.Context, p store.ListParams, cfg store.ListQueryConfig[domain.StudentAbilityPortrait]) ([]domain.StudentAbilityPortrait, int, error) {
	return s.st.StudentPortraits().ListPortraits(ctx, p, cfg)
}

// GetStudentPortrait 查询单个画像。
func (s *EvaluationService) GetStudentPortrait(ctx context.Context, id, tenantID string) (*domain.StudentAbilityPortrait, error) {
	return s.st.StudentPortraits().GetPortrait(ctx, id, tenantID)
}

// GetStudentPortraitByUserPosition 查询用户岗位画像。
func (s *EvaluationService) GetStudentPortraitByUserPosition(ctx context.Context, userID, careerPositionID string) (*domain.StudentAbilityPortrait, error) {
	return s.st.StudentPortraits().GetPortraitByUserPosition(ctx, userID, careerPositionID)
}

// ListStudentArchives 查询学生档案列表。
func (s *EvaluationService) ListStudentArchives(ctx context.Context, p store.ListParams, cfg store.ListQueryConfig[domain.StudentAbilityArchive]) ([]domain.StudentAbilityArchive, int, error) {
	return s.st.StudentPortraits().ListArchives(ctx, p, cfg)
}

// CreateStudentArchive 创建学生档案。
func (s *EvaluationService) CreateStudentArchive(ctx context.Context, p *store.StudentArchiveCreateParams) (*domain.StudentAbilityArchive, error) {
	return s.st.StudentPortraits().CreateArchive(ctx, p)
}

// DeleteStudentArchive 删除学生档案。
func (s *EvaluationService) DeleteStudentArchive(ctx context.Context, id, tenantID string) (bool, error) {
	return s.st.StudentPortraits().DeleteArchive(ctx, id, tenantID)
}

// ListJobAbilityResults 查询岗位能力结果。
func (s *EvaluationService) ListJobAbilityResults(ctx context.Context, f store.JobAbilityResultFilter, limit, offset int) ([]store.JobAbilityResultRow, int, error) {
	return s.st.JobAbilityResults().ListJobAbilityResults(ctx, f, limit, offset)
}

// GetJobAbilityResult 查询单个岗位能力结果。
func (s *EvaluationService) GetJobAbilityResult(ctx context.Context, id, tenantID string) (*store.JobAbilityResultRow, *domain.JSONSlice, *domain.JSONSlice, error) {
	return s.st.JobAbilityResults().GetJobAbilityResult(ctx, id, tenantID)
}

// SummaryJobAbilityResults 岗位能力汇总。
func (s *EvaluationService) SummaryJobAbilityResults(ctx context.Context, tenantID string) ([]store.JobAbilitySummaryRow, error) {
	return s.st.JobAbilityResults().Summary(ctx, tenantID)
}

// GetAggregateLog 查询汇聚日志。
func (s *EvaluationService) GetAggregateLog(ctx context.Context, logID string) (*store.JobAbilityAggregateLog, error) {
	return s.st.JobAbilityResults().GetAggregateLogByID(ctx, logID)
}

// GetRecentAggregateLog 查询最近汇聚日志。
func (s *EvaluationService) GetRecentAggregateLog(ctx context.Context, tenantID, positionID string) (*store.JobAbilityAggregateLog, error) {
	return s.st.JobAbilityResults().GetRecentAggregateLog(ctx, tenantID, positionID)
}

// ListGraduationTopics 查询课题列表。
func (s *EvaluationService) ListGraduationTopics(ctx context.Context, p store.ListParams, cfg store.ListQueryConfig[domain.GraduationProjectTopic]) ([]domain.GraduationProjectTopic, int, error) {
	return s.st.Graduations().ListTopics(ctx, p, cfg)
}

// GetGraduationTopic 查询单个课题。
func (s *EvaluationService) GetGraduationTopic(ctx context.Context, id string) (*domain.GraduationProjectTopic, error) {
	return s.st.Graduations().GetTopic(ctx, id)
}

// CreateGraduationTopic 创建课题。
func (s *EvaluationService) CreateGraduationTopic(ctx context.Context, p *store.GraduationTopicParams) (*domain.GraduationProjectTopic, error) {
	return s.st.Graduations().CreateTopic(ctx, p)
}

// UpdateGraduationTopic 更新课题。
func (s *EvaluationService) UpdateGraduationTopic(ctx context.Context, id string, p *store.GraduationTopicParams) (*domain.GraduationProjectTopic, error) {
	return s.st.Graduations().UpdateTopic(ctx, id, p)
}

// DeleteGraduationTopic 删除课题（事务）。
func (s *EvaluationService) DeleteGraduationTopic(ctx context.Context, id string) error {
	return s.WithTx(ctx, func(txStore *store.Store) error {
		return txStore.Graduations().DeleteTopic(ctx, txStore.Q(), id)
	})
}

// ApplyGraduationTopic 申请课题。
func (s *EvaluationService) ApplyGraduationTopic(ctx context.Context, id string) (bool, error) {
	return s.st.Graduations().ApplyTopic(ctx, id)
}

// ListGraduationArchives 查询档案列表。
func (s *EvaluationService) ListGraduationArchives(ctx context.Context, p store.ListParams, cfg store.ListQueryConfig[domain.GraduationProjectArchive]) ([]domain.GraduationProjectArchive, int, error) {
	return s.st.Graduations().ListArchives(ctx, p, cfg)
}

// CreateGraduationArchive 创建档案。
func (s *EvaluationService) CreateGraduationArchive(ctx context.Context, tenantID, topicID, userID, phase string) (*domain.GraduationProjectArchive, error) {
	return s.st.Graduations().CreateArchive(ctx, tenantID, topicID, userID, phase)
}

// ListGraduationEvaluations 查询评价列表。
func (s *EvaluationService) ListGraduationEvaluations(ctx context.Context, p store.ListParams, cfg store.ListQueryConfig[domain.GraduationProjectEvaluation]) ([]domain.GraduationProjectEvaluation, int, error) {
	return s.st.Graduations().ListEvaluations(ctx, p, cfg)
}

// CreateGraduationEvaluation 创建评价。
func (s *EvaluationService) CreateGraduationEvaluation(ctx context.Context, p *store.GraduationEvaluationParams) (*domain.GraduationProjectEvaluation, error) {
	return s.st.Graduations().CreateEvaluation(ctx, p)
}

// QueryGraduationResults 查询毕业结果。
func (s *EvaluationService) QueryGraduationResults(ctx context.Context, tenantID string, limit, offset int) ([]domain.GraduationQueryResult, int, error) {
	return s.st.Graduations().QueryGraduationResults(ctx, tenantID, limit, offset)
}

// FindPositionRule 查询岗位最新认证规则。
func (s *EvaluationService) FindPositionRule(ctx context.Context, positionID, tenantID string) (*domain.CertificationRule, error) {
	return s.st.Certifications().FindPositionRule(ctx, s.st.Q(), positionID, tenantID)
}

// LoadCertificationModel 组装岗位能力认定模型。
func (s *EvaluationService) LoadCertificationModel(ctx context.Context, tenantID, positionID, ruleID string) ([]domain.CertificationModelDomain, error) {
	return s.st.Certifications().LoadModel(ctx, tenantID, positionID, ruleID)
}

// PutCertificationWeights 保存岗位权重（事务）。
func (s *EvaluationService) PutCertificationWeights(ctx context.Context, tenantID, positionID string, pointWeights, taskWeights []store.CertificationWeightItem) error {
	return s.WithTx(ctx, func(txStore *store.Store) error {
		_, err := txStore.Certifications().PutWeights(ctx, txStore.Q(), tenantID, positionID, pointWeights, taskWeights)
		return err
	})
}

// BatchQueryer 暴露批次查询器。
func (s *EvaluationService) BatchQueryer() store.Queryer { return s.st.Q() }

// BatchTenantOf 查询批次租户。
func (s *EvaluationService) BatchTenantOf(ctx context.Context, table, id string) (string, error) {
	return s.st.Batches().TenantOf(ctx, table, id)
}

// BatchCreate 创建批次。
func (s *EvaluationService) BatchCreate(ctx context.Context, table string, cols []string, vals []any) error {
	return s.st.Batches().Create(ctx, table, cols, vals)
}

// BatchUpdate 更新批次。
func (s *EvaluationService) BatchUpdate(ctx context.Context, table string, setClauses []string, args []any) error {
	return s.st.Batches().Update(ctx, table, setClauses, args)
}

// BatchDelete 删除批次。
func (s *EvaluationService) BatchDelete(ctx context.Context, table, id string) error {
	return s.st.Batches().Delete(ctx, table, id)
}

// BatchUpdateStatus 更新批次状态。
func (s *EvaluationService) BatchUpdateStatus(ctx context.Context, table, id, status string) error {
	return s.st.Batches().UpdateStatus(ctx, table, id, status)
}

// BatchGetByTable 按表查询批次单行。
func (s *EvaluationService) BatchGetByTable(ctx context.Context, table, selectColumns, id string) (pgx.Row, error) {
	return s.st.Batches().GetByTable(ctx, s.st.Q(), table, selectColumns, id)
}
