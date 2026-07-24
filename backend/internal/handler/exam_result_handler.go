package handler

import (
	"context"
	"encoding/json"
	"net/http"
	"sort"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/middleware"
)

type ExamResultHandler struct {
	DB *pgxpool.Pool
}

type ExamResultListResponse struct {
	Items []domain.ExamResult `json:"items"`
	Total int                 `json:"total"`
}

type SubmitExamResultRequest struct {
	ExamUsageID string                 `json:"examUsageId"`
	Answers     map[string]interface{} `json:"answers"`
}

func (h *ExamResultHandler) List(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "permission denied")
		return
	}

	usageID := r.URL.Query().Get("usageId")
	if usageID == "" {
		respondError(w, http.StatusBadRequest, "usageId is required")
		return
	}

	items, err := h.listByUsage(r.Context(), usageID)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to list exam results")
		return
	}

	// compute rank by score desc
	sort.SliceStable(items, func(i, j int) bool { return items[i].Score > items[j].Score })
	for i := range items {
		items[i].Score = roundScore(items[i].Score)
	}

	respondJSON(w, http.StatusOK, ExamResultListResponse{Items: items, Total: len(items)})
}

func (h *ExamResultHandler) Create(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "permission denied")
		return
	}

	var req SubmitExamResultRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.ExamUsageID == "" {
		respondError(w, http.StatusBadRequest, "examUsageId is required")
		return
	}

	tenantID, ok := requireTenant(w, r); if !ok { return }

	result, err := h.submit(r.Context(), tenantID, claims.UserID, req.ExamUsageID, req.Answers)
	if err != nil {
		if err == pgx.ErrNoRows {
			respondError(w, http.StatusNotFound, "exam usage not found")
			return
		}
		respondError(w, http.StatusInternalServerError, "failed to submit exam result")
		return
	}

	respondJSON(w, http.StatusCreated, result)
}

func (h *ExamResultHandler) submit(ctx context.Context, tenantID, userID, usageID string, answers map[string]interface{}) (*domain.ExamResult, error) {
	// fetch usage -> exam_id and total_score
	var examID string
	var totalScore float64
	err := h.DB.QueryRow(ctx, `
		SELECT exam_id, COALESCE((SELECT total_score FROM exams WHERE id = exam_usages.exam_id), 0)
		FROM exam_usages WHERE id = $1
	`, usageID).Scan(&examID, &totalScore)
	if err != nil {
		return nil, err
	}

	// fetch exam questions
	rows, err := h.DB.Query(ctx, `
		SELECT id, type, answer, score FROM exam_questions WHERE exam_id = $1 ORDER BY sort_order
	`, examID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	type q struct {
		id     string
		qType  string
		answer []string
		score  float64
	}
	var questions []q
	for rows.Next() {
		var id string
		var qt string
		var ans domain.JSONSlice
		var score float64
		if err := rows.Scan(&id, &qt, &ans, &score); err != nil {
			return nil, err
		}
		questions = append(questions, q{id: id, qType: qt, answer: toStringSlice(ans), score: score})
	}

	score := 0.0
	passScore := totalScore * 0.6
	for _, qq := range questions {
		raw, ok := answers[qq.id]
		if !ok {
			continue
		}
		if isCorrect(qq.qType, qq.answer, raw) {
			score += qq.score
		}
	}
	isPass := score >= passScore

	// user profile
	var studentName string
	var className, grade, majorName string
	var majorID *string
	_ = h.DB.QueryRow(ctx, `SELECT name FROM users WHERE id = $1`, userID).Scan(&studentName)
	_ = h.DB.QueryRow(ctx, `
		SELECT COALESCE(o.name, '') AS class_name, COALESCE(m.name, '') AS major_name, u.major_id
		FROM users u
		LEFT JOIN organizations o ON o.id = u.org_node_id
		LEFT JOIN majors m ON m.id = u.major_id
		WHERE u.id = $1
	`, userID).Scan(&className, &majorName, &majorID)

	var majorNamePtr *string
	if majorName != "" {
		majorNamePtr = &majorName
	}

	answersJSON := domain.JSONMap(answers)
	var resultID string
	var submitTime, createdAt interface{}
	err = h.DB.QueryRow(ctx, `
		INSERT INTO exam_results (tenant_id, exam_usage_id, user_id, student_name, class_name, grade, major_id, score, total_score, is_pass, answers)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
		ON CONFLICT (exam_usage_id, user_id)
		DO UPDATE SET score = EXCLUDED.score, total_score = EXCLUDED.total_score, is_pass = EXCLUDED.is_pass, answers = EXCLUDED.answers, submit_time = NOW()
		RETURNING id, submit_time, created_at
	`, tenantID, usageID, userID, studentName, className, grade, majorID, score, totalScore, isPass, answersJSON).Scan(&resultID, &submitTime, &createdAt)
	if err != nil {
		return nil, err
	}

	// Bridge: auto-create scene_evaluation_result if exam targets a task
	h.syncSceneEvaluationResult(ctx, tenantID, usageID, userID, score, totalScore, answersJSON)

	return &domain.ExamResult{
		ID:          resultID,
		ExamUsageID: usageID,
		UserID:      userID,
		StudentName: studentName,
		ClassName:   className,
		Grade:       grade,
		MajorID:     majorID,
		MajorName:   majorNamePtr,
		Score:       roundScore(score),
		TotalScore:  roundScore(totalScore),
		IsPass:      isPass,
		Answers:     answersJSON,
	}, nil
}

func (h *ExamResultHandler) listByUsage(ctx context.Context, usageID string) ([]domain.ExamResult, error) {
	rows, err := h.DB.Query(ctx, `
		SELECT er.id, er.exam_usage_id, er.user_id, er.student_name, er.class_name, er.grade, er.major_id, COALESCE(m.name, '') AS major_name, er.score, er.total_score, er.is_pass, er.answers, er.submit_time, er.created_at
		FROM exam_results er
		LEFT JOIN majors m ON m.id = er.major_id
		WHERE er.exam_usage_id = $1
		ORDER BY er.score DESC, er.submit_time ASC
	`, usageID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []domain.ExamResult
	for rows.Next() {
		var r domain.ExamResult
		var answers domain.JSONMap
		if err := rows.Scan(&r.ID, &r.ExamUsageID, &r.UserID, &r.StudentName, &r.ClassName, &r.Grade, &r.MajorID, &r.MajorName, &r.Score, &r.TotalScore, &r.IsPass, &answers, &r.SubmitTime, &r.CreatedAt); err != nil {
			return nil, err
		}
		r.Answers = answers
		items = append(items, r)
	}
	return items, nil
}

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
			m[strings.ToLower(c)]++
		}
		for _, g := range given {
			m[strings.ToLower(g)]--
			if m[strings.ToLower(g)] < 0 {
				return false
			}
		}
		return true
	default:
		// fill / essay / short_answer need manual grading
		return false
	}
}

func toStringSlice(v []interface{}) []string {
	var out []string
	for _, x := range v {
		if s, ok := x.(string); ok {
			out = append(out, s)
		}
	}
	return out
}

func roundScore(s float64) float64 {
	return float64(int64(s*100+0.5)) / 100
}

func (h *ExamResultHandler) syncSceneEvaluationResult(ctx context.Context, tenantID, usageID, userID string, score, maxScore float64, objectiveAnswers domain.JSONMap) {
	rows, err := h.DB.Query(ctx, `
		SELECT tem.method_key, tem.task_id
		FROM exam_usages eu
		JOIN task_evaluation_methods tem ON tem.task_id = ANY(eu.target_ids)
		WHERE eu.id = $1 AND tem.method_key IN ('paper', 'question_bank', 'quiz') AND tem.tenant_id = $2
	`, usageID, tenantID)
	if err != nil {
		return
	}
	defer rows.Close()

	for rows.Next() {
		var methodKey, taskID string
		if err := rows.Scan(&methodKey, &taskID); err != nil {
			continue
		}
		_, _ = h.DB.Exec(ctx, `
			INSERT INTO scene_evaluation_results (tenant_id, task_id, method_key, evaluatee_id, status, total_score, max_score, objective_answers)
			VALUES ($1, $2, $3, $4, 'evaluated', $5, $6, $7)
			ON CONFLICT (task_id, evaluatee_id, method_key)
			DO UPDATE SET total_score = EXCLUDED.total_score, max_score = EXCLUDED.max_score, status = 'evaluated', objective_answers = EXCLUDED.objective_answers, graded_at = NOW()
		`, tenantID, taskID, methodKey, userID, score, maxScore, objectiveAnswers)
	}
}
