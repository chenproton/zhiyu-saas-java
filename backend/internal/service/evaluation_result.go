package service

import (
	"context"
	"encoding/json"
	"fmt"
	"math"
	"strings"
	"time"

	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/store"
)

// ListExamResults 查询考试结果列表。
func (s *EvaluationService) ListExamResults(ctx context.Context, p store.ListParams, cfg store.ListQueryConfig[domain.ExamResult]) ([]domain.ExamResult, int, error) {
	return s.st.ExamResults().List(ctx, p, cfg)
}

// SubmitExamResult 提交考试结果（评分编排：拉取题目→判分→写结果→同步 3 类评价，全部写在同一事务）。
func (s *EvaluationService) SubmitExamResult(ctx context.Context, tenantID, userID, usageID string, answers map[string]interface{}, methodKey string) (*domain.ExamResult, error) {
	// 窗口校验：未到开始时间 / 已过结束时间禁止提交（重复作答同样受限）
	usage, err := s.st.ExamUsages().Get(ctx, usageID)
	if err != nil {
		return nil, err
	}
	now := time.Now()
	if usage.StartTime != nil {
		if t, perr := time.Parse(time.RFC3339, *usage.StartTime); perr == nil && now.Before(t) {
			return nil, store.ErrExamNotStarted
		}
	}
	if usage.EndTime != nil {
		if t, perr := time.Parse(time.RFC3339, *usage.EndTime); perr == nil && now.After(t) {
			return nil, store.ErrExamEnded
		}
	}
	// 重交保护：该方式的场景评价已由教师评分时拒绝覆盖教师成绩
	graded, err := s.st.ExamResults().UsageGradedByUser(ctx, usageID, userID, methodKey)
	if err != nil {
		return nil, err
	}
	if graded {
		return nil, store.ErrAlreadyGraded
	}
	// 重交保护：考试结果已被教师评分（手动/节点/场景回写均标记 graded_at）时拒绝覆盖
	teacherGraded, err := s.st.ExamResults().ResultTeacherGraded(ctx, usageID, userID)
	if err != nil {
		return nil, err
	}
	if teacherGraded {
		return nil, store.ErrAlreadyGraded
	}
	// 重复作答控制：已提交过且不允许重复作答时拒绝（默认不允许，测评方式配置 allowRetake 可开启）
	submitted, err := s.st.ExamResults().ResultSubmitted(ctx, usageID, userID)
	if err != nil {
		return nil, err
	}
	if submitted {
		allowRetake, rerr := s.st.ExamResults().UsageAllowRetake(ctx, usageID)
		if rerr != nil {
			return nil, rerr
		}
		if !allowRetake {
			return nil, store.ErrRetakeNotAllowed
		}
	}
	// 班级约束：班级类考试仅允许目标班级学生提交（防止绕过考试中心入口直接交卷）
	target, err := s.st.ExamResults().UsageTarget(ctx, usageID)
	if err != nil {
		return nil, err
	}
	if target.TargetType != nil && *target.TargetType == "class" {
		classNodeID := s.st.Portal().UserClassNodeID(ctx, userID, &tenantID)
		if classNodeID == "" || !containsString(target.TargetIDs, classNodeID) {
			return nil, store.ErrForbidden
		}
	}
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
	gradingStatus := "evaluated"
	if hasSubjective {
		gradingStatus = "pending"
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
			StudentName:   profile.Name,
			ClassName:     profile.ClassName,
			Grade:         profile.Grade,
			MajorID:       profile.MajorID,
			Score:         score,
			TotalScore:    totalScore,
			IsPass:        isPass,
			Answers:       answersJSON,
			GradingStatus: gradingStatus,
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

// GradeExamResult 教师评分日常考试结果：客观分按存储答案重算，加上教师主观题分数后落库。
func (s *EvaluationService) GradeExamResult(ctx context.Context, id, graderID string, scores map[string]interface{}, comment *string) (*domain.ExamResult, error) {
	result, err := s.st.ExamResults().Get(ctx, id)
	if err != nil {
		return nil, err
	}
	target, err := s.st.ExamResults().UsageTarget(ctx, result.ExamUsageID)
	if err != nil {
		return nil, err
	}
	if target.TargetType == nil || !isManualExamUsageTargetType(*target.TargetType) {
		return nil, store.ErrForbidden
	}
	examID, totalScore, err := s.st.ExamResults().UsageExamInfo(ctx, result.ExamUsageID)
	if err != nil {
		return nil, err
	}
	questions, err := s.st.ExamResults().FetchExamQuestions(ctx, examID)
	if err != nil {
		return nil, err
	}

	objective := 0.0
	for _, qq := range questions {
		if qq.Type == string(domain.QuestionTypeFill) || qq.Type == string(domain.QuestionTypeEssay) || qq.Type == string(domain.QuestionTypeShortAnswer) {
			continue
		}
		raw, ok := result.Answers[qq.ID]
		if !ok {
			continue
		}
		if isCorrect(qq.Type, qq.Answer, raw) {
			objective += qq.Score
		}
	}
	subjective := 0.0
	for _, v := range scores {
		switch val := v.(type) {
		case float64:
			subjective += val
		case json.Number:
			if f, err := val.Float64(); err == nil {
				subjective += f
			}
		case map[string]interface{}:
			if f, ok := val["score"].(float64); ok {
				subjective += f
			}
		}
	}
	score := RoundScore(objective + subjective)
	isPass := score >= totalScore*0.6
	if err := s.st.ExamResults().Grade(ctx, id, graderID, &store.GradeExamResultParams{
		Score:          score,
		IsPass:         isPass,
		GradingScores:  domain.JSONMap(scores),
		GradingComment: comment,
	}); err != nil {
		return nil, err
	}
	return s.st.ExamResults().Get(ctx, id)
}

// isManualExamUsageTargetType 手动创建的考试安排目标类型（与 store.manualExamUsageTargetTypesSQL 一致）。
func isManualExamUsageTargetType(t string) bool {
	switch t {
	case "class", "major", "department", "public":
		return true
	}
	return false
}

// containsString 判断字符串切片是否包含目标值。
func containsString(items []string, target string) bool {
	for _, it := range items {
		if it == target {
			return true
		}
	}
	return false
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

// GradeEvaluationResult 评分并同步考试分数（同一事务：评分与回写原子）。
func (s *EvaluationService) GradeEvaluationResult(ctx context.Context, id, graderID string, p *store.EvaluationResultGradeParams, taskID, methodKey, evaluateeID string) error {
	return s.WithTx(ctx, func(txStore *store.Store) error {
		if err := txStore.EvaluationResults().Grade(ctx, txStore.Q(), id, graderID, p); err != nil {
			return err
		}
		return s.syncExamResultScoreTx(ctx, txStore, taskID, methodKey, evaluateeID, p.Score)
	})
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
		if err2 != nil {
			return err2
		}
		// 回写与评分同一事务：任一失败整体回滚
		for _, t := range targets {
			if err := s.syncExamResultScoreTx(ctx, txStore, t.TaskID, t.MethodKey, t.EvaluateeID, scoreByID[t.ID]); err != nil {
				return err
			}
		}
		return nil
	})
	return err
}

// syncExamResultScore 同步考试结果分数（事务内版本）。
func (s *EvaluationService) syncExamResultScoreTx(ctx context.Context, txStore *store.Store, taskID, methodKey, evaluateeID string, score float64) error {
	if methodKey != "paper" && methodKey != "question_bank" && methodKey != "quiz" {
		return nil
	}
	examResultID, err := txStore.EvaluationResults().FindLatestExamResult(ctx, txStore.Q(), taskID, methodKey, evaluateeID)
	if err != nil || examResultID == "" {
		return nil
	}
	if err := txStore.EvaluationResults().UpdateExamResultScore(ctx, txStore.Q(), examResultID, score); err != nil {
		return fmt.Errorf("同步考试结果分数失败: %w", err)
	}
	return nil
}

// isCorrect 判断客观题答案是否正确。
func isCorrect(qType string, correct []string, raw interface{}) bool {
	switch qType {
	case string(domain.QuestionTypeSingle), string(domain.QuestionTypeJudge):
		s, _ := raw.(string)
		if len(correct) == 0 {
			return false
		}
		s = strings.TrimSpace(s)
		c := correct[0]
		if strings.EqualFold(s, c) {
			return true
		}
		// 与前端判分一致：判断题支持“正确/错误”与 true/false 互认
		if (s == "正确" && strings.EqualFold(c, "true")) || (s == "错误" && strings.EqualFold(c, "false")) {
			return true
		}
		return false
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
