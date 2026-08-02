package service

import (
	"context"
	"math"
	"strings"

	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/store"
)

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
func (s *EvaluationService) BatchGradeEvaluationResults(ctx context.Context, graderID string, items []store.EvaluationResultGradeItem) error {
	ids := make([]string, 0, len(items))
	scoreByID := make(map[string]float64, len(items))
	for _, item := range items {
		ids = append(ids, item.ID)
		scoreByID[item.ID] = item.Score
	}
	var targets []store.EvaluationResultGradeTarget
	err := s.WithTx(ctx, func(txStore *store.Store) error {
		if err := txStore.EvaluationResults().BatchGrade(ctx, txStore.Q(), graderID, items); err != nil {
			return err
		}
		var err2 error
		targets, err2 = txStore.EvaluationResults().BatchGetGradeTargets(ctx, txStore.Q(), ids)
		return err2
	})
	if err != nil {
		return err
	}
	for _, t := range targets {
		s.syncExamResultScore(ctx, t.TaskID, t.MethodKey, t.EvaluateeID, scoreByID[t.ID])
	}
	return nil
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
