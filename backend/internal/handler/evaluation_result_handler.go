package handler

import (
	"errors"
	"context"
	"encoding/json"
	"log"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/middleware"
)

type EvaluationResultHandler struct {
	DB *pgxpool.Pool
}

type EvaluationResultListResponse struct {
	Items []domain.SceneEvaluationResult `json:"items"`
	Total int                            `json:"total"`
}

type SubmitResultRequest struct {
	TaskID             string          `json:"taskId"`
	SceneID            *string         `json:"sceneId,omitempty"`
	MethodKey          string          `json:"methodKey"`
	EvaluateeID        string          `json:"evaluateeId"`
	EvaluatorID        *string         `json:"evaluatorId,omitempty"`
	EvaluatorType      *string         `json:"evaluatorType,omitempty"`
	MaxScore           float64         `json:"maxScore"`
	ObjectiveAnswers   json.RawMessage `json:"objectiveAnswers,omitempty"`
	SubjectiveContent  json.RawMessage `json:"subjectiveContent,omitempty"`
	DrawnQuestions     json.RawMessage `json:"drawnQuestions,omitempty"`
	EvalPointScores    json.RawMessage `json:"evalPointScores,omitempty"`
}

type GradeResultRequest struct {
	Score             float64         `json:"score"`
	Comment           *string         `json:"comment"`
	EvalPointScores   json.RawMessage `json:"evalPointScores,omitempty"`
	DrawnQuestions    json.RawMessage `json:"drawnQuestions,omitempty"`
	SubjectiveContent json.RawMessage `json:"subjectiveContent,omitempty"`
}

type BatchGradeItem struct {
	ID              string          `json:"id"`
	Score           float64         `json:"score"`
	Comment         *string         `json:"comment"`
	EvalPointScores json.RawMessage `json:"evalPointScores,omitempty"`
}

type BatchGradeRequest struct {
	Items []BatchGradeItem `json:"items"`
}

func (h *EvaluationResultHandler) List(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	items, total, err := executeListQuery[domain.SceneEvaluationResult](r.Context(), h.DB, r, listQueryConfig[domain.SceneEvaluationResult]{
		Table:         "scene_evaluation_results",
		SelectColumns: "id, task_id, scene_id, method_key, evaluatee_id, evaluator_id, evaluator_type, status, total_score, max_score, eval_point_scores, objective_answers, subjective_content, drawn_questions, comment, graded_at, graded_by",
		TenantScoped:  true,
		OrderBy:       "id DESC",
		ExtraFilter: func(r *http.Request, qb *listQueryBuilder) {
			if taskID := r.URL.Query().Get("taskId"); taskID != "" {
				qb.addCondition("task_id = " + qb.nextArg(taskID))
			}
			if sceneID := r.URL.Query().Get("sceneId"); sceneID != "" {
				qb.addCondition("scene_id = " + qb.nextArg(sceneID))
			}
			if methodKey := r.URL.Query().Get("methodKey"); methodKey != "" {
				qb.addCondition("method_key = " + qb.nextArg(methodKey))
			}
			if evaluateeID := r.URL.Query().Get("evaluateeId"); evaluateeID != "" {
				qb.addCondition("evaluatee_id = " + qb.nextArg(evaluateeID))
			}
			if status := r.URL.Query().Get("status"); status != "" {
				qb.addCondition("status = " + qb.nextArg(status))
			}
		},
	}, h.scanResultRows)
	if err != nil {
		if errors.Is(err, ErrMissingTenant) {
			respondError(w, http.StatusForbidden, "缺少租户信息")
			return
		}
		log.Printf("List evaluation results error: %v", err)
		respondError(w, http.StatusInternalServerError, "查询评价结果失败")
		return
	}

	respondJSON(w, http.StatusOK, EvaluationResultListResponse{Items: items, Total: total})
}

func (h *EvaluationResultHandler) Get(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	id := chi.URLParam(r, "id")
	res, err := h.fetchResult(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusNotFound, "评价结果不存在")
		return
	}
	respondJSON(w, http.StatusOK, res)
}

func (h *EvaluationResultHandler) Submit(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	var req SubmitResultRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "无效请求体")
		return
	}
	if req.TaskID == "" || req.MethodKey == "" || req.EvaluateeID == "" {
		respondError(w, http.StatusBadRequest, "缺少必填字段（taskId、methodKey、evaluateeId）")
		return
	}

	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}

	if req.MaxScore == 0 {
		req.MaxScore = 100
	}

	evalPointScores := jsonRawMessageToJSONMap(req.EvalPointScores)
	objectiveAnswers := jsonRawMessageToJSONMap(req.ObjectiveAnswers)
	subjectiveContent := jsonRawMessageToJSONMap(req.SubjectiveContent)
	drawnQuestions := jsonRawMessageToJSONMap(req.DrawnQuestions)

	var id string
	now := time.Now()
	err := h.DB.QueryRow(r.Context(), `
		INSERT INTO scene_evaluation_results (tenant_id, task_id, scene_id, method_key, evaluatee_id, evaluator_id, evaluator_type, status, max_score, eval_point_scores, objective_answers, subjective_content, drawn_questions, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', $8, $9, $10, $11, $12, $13, $14)
		ON CONFLICT (task_id, evaluatee_id, method_key) DO UPDATE SET
			scene_id = EXCLUDED.scene_id,
			objective_answers = EXCLUDED.objective_answers,
			subjective_content = EXCLUDED.subjective_content,
			drawn_questions = EXCLUDED.drawn_questions,
			eval_point_scores = EXCLUDED.eval_point_scores,
			updated_at = EXCLUDED.updated_at
		RETURNING id
	`, tenantID, req.TaskID, req.SceneID, req.MethodKey, req.EvaluateeID,
		req.EvaluatorID, req.EvaluatorType, req.MaxScore,
		evalPointScores, objectiveAnswers, subjectiveContent, drawnQuestions, now, now).Scan(&id)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "提交评价结果失败")
		return
	}

	res, _ := h.fetchResult(r.Context(), id)
	respondJSON(w, http.StatusCreated, res)
}

func (h *EvaluationResultHandler) Grade(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	id := chi.URLParam(r, "id")
	var req GradeResultRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "无效请求体")
		return
	}

	res, err := h.fetchResult(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusNotFound, "评价结果不存在")
		return
	}

	evalPointScores := jsonRawMessageToJSONMap(req.EvalPointScores)
	drawnQuestions := jsonRawMessageToJSONMap(req.DrawnQuestions)
	subjectiveContent := jsonRawMessageToJSONMap(req.SubjectiveContent)
	_, err = h.DB.Exec(r.Context(), `
		UPDATE scene_evaluation_results SET total_score = $1, comment = $2, eval_point_scores = $3, drawn_questions = $4, subjective_content = $5, status = 'evaluated', graded_at = NOW(), graded_by = $6, updated_at = NOW()
		WHERE id = $7
	`, req.Score, req.Comment, evalPointScores, drawnQuestions, subjectiveContent, claims.UserID, id)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "评分失败")
		return
	}

	h.syncExamResultScore(r.Context(), res.TaskID, res.MethodKey, res.EvaluateeID, req.Score)

	res, _ = h.fetchResult(r.Context(), id)
	respondJSON(w, http.StatusOK, res)
}

func (h *EvaluationResultHandler) BatchGrade(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	var req BatchGradeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "无效请求体")
		return
	}

	tx, err := h.DB.Begin(r.Context())
	if err != nil {
		respondError(w, http.StatusInternalServerError, "开启事务失败")
		return
	}
	defer tx.Rollback(r.Context())

	type gradeTarget struct {
		taskID      string
		methodKey   string
		evaluateeID string
		score       float64
	}
	var targets []gradeTarget

	count := 0
	for _, item := range req.Items {
		res, err := h.fetchResult(r.Context(), item.ID)
		if err != nil {
			respondError(w, http.StatusNotFound, "评价结果不存在")
			return
		}

		evalPointScores := jsonRawMessageToJSONMap(item.EvalPointScores)
		_, err = tx.Exec(r.Context(), `
			UPDATE scene_evaluation_results SET total_score = $1, comment = $2, eval_point_scores = $3, status = 'evaluated', graded_at = NOW(), graded_by = $4, updated_at = NOW()
			WHERE id = $5
		`, item.Score, item.Comment, evalPointScores, claims.UserID, item.ID)
		if err != nil {
			respondError(w, http.StatusInternalServerError, "批量评分失败")
			return
		}

		targets = append(targets, gradeTarget{res.TaskID, res.MethodKey, res.EvaluateeID, item.Score})
		count++
	}

	if err := tx.Commit(r.Context()); err != nil {
		respondError(w, http.StatusInternalServerError, "提交事务失败")
		return
	}

	for _, t := range targets {
		h.syncExamResultScore(r.Context(), t.taskID, t.methodKey, t.evaluateeID, t.score)
	}

	respondJSON(w, http.StatusOK, map[string]int{"count": count})
}

func (h *EvaluationResultHandler) syncExamResultScore(ctx context.Context, taskID, methodKey, evaluateeID string, score float64) {
	if methodKey != "paper" && methodKey != "question_bank" && methodKey != "quiz" {
		return
	}

	var examResultID string
	err := h.DB.QueryRow(ctx, `
		SELECT er.id
		FROM exam_results er
		JOIN exam_usages eu ON er.exam_usage_id = eu.id
		JOIN task_evaluation_methods tem ON tem.task_id = ANY(eu.target_ids)
		WHERE tem.task_id = $1 AND tem.method_key = $2 AND er.user_id = $3
		ORDER BY er.submit_time DESC NULLS LAST, er.created_at DESC
		LIMIT 1
	`, taskID, methodKey, evaluateeID).Scan(&examResultID)
	if err != nil || examResultID == "" {
		return
	}

	_, _ = h.DB.Exec(ctx, `UPDATE exam_results SET score = $1, updated_at = NOW() WHERE id = $2`, score, examResultID)
}

func (h *EvaluationResultHandler) fetchResult(ctx context.Context, id string) (domain.SceneEvaluationResult, error) {
	var res domain.SceneEvaluationResult
	var sceneID, comment, gradedBy, evaluatorID, evaluatorType pgtype.Text
	var totalScore *float64
	var gradedAt *time.Time
	var evalPointScores, objectiveAnswers, subjectiveContent, drawnQuestions domain.JSONMap
	err := h.DB.QueryRow(ctx, `
		SELECT id, task_id, scene_id, method_key, evaluatee_id, evaluator_id, evaluator_type, status,
			total_score, max_score, eval_point_scores, objective_answers, subjective_content,
			drawn_questions, comment, graded_at, graded_by
		FROM scene_evaluation_results WHERE id = $1
	`, id).Scan(
		&res.ID, &res.TaskID, &sceneID, &res.MethodKey, &res.EvaluateeID, &evaluatorID, &evaluatorType, &res.Status,
		&totalScore, &res.MaxScore, &evalPointScores, &objectiveAnswers, &subjectiveContent,
		&drawnQuestions, &comment, &gradedAt, &gradedBy,
	)
	if err != nil {
		return res, err
	}
	if sceneID.Valid { res.SceneID = &sceneID.String }
	res.EvaluatorID = evaluatorID.String
	res.EvaluatorType = evaluatorType.String
	if comment.Valid { res.Comment = &comment.String }
	if gradedBy.Valid { res.GradedBy = &gradedBy.String }
	res.TotalScore = totalScore
	res.GradedAt = gradedAt
	res.EvalPointScores = evalPointScores
	res.ObjectiveAnswers = objectiveAnswers
	res.SubjectiveContent = subjectiveContent
	res.DrawnQuestions = drawnQuestions
	return res, nil
}

func (h *EvaluationResultHandler) scanResultRows(rows pgx.Rows) ([]domain.SceneEvaluationResult, error) {
	items := make([]domain.SceneEvaluationResult, 0)
	for rows.Next() {
		var res domain.SceneEvaluationResult
		var sceneID, comment, gradedBy, evaluatorID, evaluatorType pgtype.Text
		var totalScore *float64
		var gradedAt *time.Time
		var evalPointScores, objectiveAnswers, subjectiveContent, drawnQuestions domain.JSONMap
		if err := rows.Scan(
			&res.ID, &res.TaskID, &sceneID, &res.MethodKey, &res.EvaluateeID, &evaluatorID, &evaluatorType, &res.Status,
			&totalScore, &res.MaxScore, &evalPointScores, &objectiveAnswers, &subjectiveContent,
			&drawnQuestions, &comment, &gradedAt, &gradedBy,
		); err != nil {
			return nil, err
		}
		if sceneID.Valid { res.SceneID = &sceneID.String }
		res.EvaluatorID = evaluatorID.String
		res.EvaluatorType = evaluatorType.String
		if comment.Valid { res.Comment = &comment.String }
		if gradedBy.Valid { res.GradedBy = &gradedBy.String }
		res.TotalScore = totalScore
		res.GradedAt = gradedAt
		res.EvalPointScores = evalPointScores
		res.ObjectiveAnswers = objectiveAnswers
		res.SubjectiveContent = subjectiveContent
		res.DrawnQuestions = drawnQuestions
		items = append(items, res)
	}
	return items, nil
}
