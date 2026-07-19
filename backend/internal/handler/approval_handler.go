package handler

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/middleware"
)

type ApprovalHandler struct {
	DB *pgxpool.Pool
}

type ApprovalListResponse struct {
	Items []domain.ApprovalRecord `json:"items"`
	Total int                     `json:"total"`
}

type CreateApprovalRequest struct {
	TargetType string  `json:"targetType"`
	TargetID   string  `json:"targetId"`
	WorkflowID *string `json:"workflowId"`
}

type ReviewApprovalRequest struct {
	Action string `json:"action"`
	Remark string `json:"remark"`
}

func (h *ApprovalHandler) List(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "permission denied")
		return
	}

	targetType := r.URL.Query().Get("targetType")
	targetID := r.URL.Query().Get("targetId")
	status := r.URL.Query().Get("status")
	submitterID := r.URL.Query().Get("submitterId")
	limitStr := r.URL.Query().Get("limit")
	offsetStr := r.URL.Query().Get("offset")

	limit := 50
	offset := 0
	if v, err := parseInt(limitStr, 50); err == nil && v > 0 {
		limit = v
	}
	if v, err := parseInt(offsetStr, 0); err == nil && v >= 0 {
		offset = v
	}

	where := []string{"1=1"}
	args := []interface{}{}
	argIdx := 1
	tenantClaims := middleware.CurrentUser(r)
	effectiveTenantID, ok := tenantFilter(tenantClaims)
	if !ok {
		respondError(w, http.StatusForbidden, "missing tenant")
		return
	}
	if effectiveTenantID != "" {
		where = append(where, "tenant_id = $"+itoa(argIdx))
		args = append(args, effectiveTenantID)
		argIdx++
	}

	if targetType != "" {
		where = append(where, "target_type = $"+itoa(argIdx))
		args = append(args, targetType)
		argIdx++
	}
	if targetID != "" {
		where = append(where, "target_id = $"+itoa(argIdx))
		args = append(args, targetID)
		argIdx++
	}
	if status != "" {
		where = append(where, "status = $"+itoa(argIdx))
		args = append(args, status)
		argIdx++
	}
	if submitterID != "" {
		where = append(where, "submitter_id = $"+itoa(argIdx))
		args = append(args, submitterID)
		argIdx++
	}

	countQuery := "SELECT COUNT(*) FROM approval_records WHERE " + strings.Join(where, " AND ")
	var total int
	_ = h.DB.QueryRow(r.Context(), countQuery, args...).Scan(&total)

	query := `
		SELECT id, tenant_id, target_type, target_id, workflow_id, current_step_idx, status,
			submitter_id, history, created_at, updated_at
		FROM approval_records
		WHERE ` + strings.Join(where, " AND ") + `
		ORDER BY created_at DESC
		LIMIT $` + itoa(argIdx) + ` OFFSET $` + itoa(argIdx+1)
	args = append(args, limit, offset)

	rows, err := h.DB.Query(r.Context(), query, args...)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to list approval records")
		return
	}
	defer rows.Close()

	items, err := h.scanApprovalRows(rows)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to scan approval records")
		return
	}

	respondJSON(w, http.StatusOK, ApprovalListResponse{Items: items, Total: total})
}

func (h *ApprovalHandler) Get(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "permission denied")
		return
	}

	id := chi.URLParam(r, "id")
	record, err := h.fetchApproval(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusNotFound, "approval record not found")
		return
	}
	respondJSON(w, http.StatusOK, record)
}

func (h *ApprovalHandler) Create(w http.ResponseWriter, r *http.Request) {
	user := middleware.CurrentUser(r)
	if user == nil {
		respondError(w, http.StatusForbidden, "permission denied")
		return
	}

	var req CreateApprovalRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.TargetType == "" || req.TargetID == "" {
		respondError(w, http.StatusBadRequest, "missing required fields")
		return
	}

	id := uuid.NewString()
	status := string(domain.ApprovalStatusPending)
	history := domain.JSONSlice{}

	_, err := h.DB.Exec(r.Context(), `
		INSERT INTO approval_records (id, tenant_id, target_type, target_id, workflow_id,
			current_step_idx, status, submitter_id, history)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
	`, id, user.TenantID, req.TargetType, req.TargetID, req.WorkflowID, 0, status, user.UserID, history)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to create approval record")
		return
	}

	record, _ := h.fetchApproval(r.Context(), id)
	respondJSON(w, http.StatusCreated, record)
}

func (h *ApprovalHandler) Review(w http.ResponseWriter, r *http.Request) {
	user := middleware.CurrentUser(r)
	if user == nil {
		respondError(w, http.StatusForbidden, "permission denied")
		return
	}

	id := chi.URLParam(r, "id")
	record, err := h.fetchApproval(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusNotFound, "approval record not found")
		return
	}

	if record.Status != string(domain.ApprovalStatusPending) {
		respondError(w, http.StatusBadRequest, "approval record is not pending")
		return
	}

	var req ReviewApprovalRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.Action != string(domain.ApprovalStatusApproved) && req.Action != string(domain.ApprovalStatusRejected) {
		respondError(w, http.StatusBadRequest, "invalid action")
		return
	}

	entry := domain.JSONMap{
		"action":       req.Action,
		"remark":       req.Remark,
		"stepIdx":      record.CurrentStepIdx,
		"reviewerId":   user.UserID,
		"reviewerName": user.Username,
		"createdAt":    time.Now().UTC(),
	}
	record.History = append(record.History, entry)

	if req.Action == string(domain.ApprovalStatusRejected) {
		record.Status = string(domain.ApprovalStatusRejected)
		_, err = h.DB.Exec(r.Context(), `
			UPDATE approval_records SET status = $1, history = $2, updated_at = NOW() WHERE id = $3
		`, record.Status, record.History, id)
		if err != nil {
			respondError(w, http.StatusInternalServerError, "failed to review approval record")
			return
		}
		h.syncEntityStatusQuiet(r.Context(), record.TargetType, record.TargetID, string(domain.ApprovalStatusRejected))
		record, _ = h.fetchApproval(r.Context(), id)
		respondJSON(w, http.StatusOK, record)
		return
	}

	var workflow *domain.Workflow
	if record.WorkflowID != nil {
		wf, wfErr := h.fetchWorkflow(r.Context(), *record.WorkflowID)
		if wfErr == nil {
			workflow = &wf
		}
	}

	stepIdx := record.CurrentStepIdx
	stepComplete := h.isStepComplete(workflow, &record, stepIdx)
	if !stepComplete {
		_, err = h.DB.Exec(r.Context(), `
			UPDATE approval_records SET history = $1, updated_at = NOW() WHERE id = $2
		`, record.History, id)
		if err != nil {
			respondError(w, http.StatusInternalServerError, "failed to update approval record")
			return
		}
		record, _ = h.fetchApproval(r.Context(), id)
		respondJSON(w, http.StatusOK, record)
		return
	}

	if h.isLastStep(workflow, stepIdx) {
		record.Status = string(domain.ApprovalStatusApproved)
		record.CurrentStepIdx = stepIdx + 1
		h.syncEntityStatusQuiet(r.Context(), record.TargetType, record.TargetID, string(domain.ApprovalStatusApproved))
	} else {
		record.CurrentStepIdx = stepIdx + 1
	}

	_, err = h.DB.Exec(r.Context(), `
		UPDATE approval_records SET status = $1, current_step_idx = $2, history = $3, updated_at = NOW() WHERE id = $4
	`, record.Status, record.CurrentStepIdx, record.History, id)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to review approval record")
		return
	}

	record, _ = h.fetchApproval(r.Context(), id)
	respondJSON(w, http.StatusOK, record)
}

func (h *ApprovalHandler) isStepComplete(workflow *domain.Workflow, record *domain.ApprovalRecord, stepIdx int) bool {
	if workflow == nil || len(workflow.Steps) == 0 || stepIdx >= len(workflow.Steps) {
		return true
	}
	stepMap, ok := workflow.Steps[stepIdx].(map[string]interface{})
	if !ok {
		return true
	}
	mode, _ := stepMap["approvalMode"].(string)
	if mode == "" {
		mode = "any"
	}
	if mode == "any" {
		return true
	}

	approverIdsRaw, _ := stepMap["approverIds"].([]interface{})
	approvedSet := make(map[string]bool)
	for _, hEntry := range record.History {
		entryMap, ok := hEntry.(map[string]interface{})
		if !ok {
			continue
		}
		action, _ := entryMap["action"].(string)
		if action != string(domain.ApprovalStatusApproved) {
			continue
		}
		stepFlt, _ := entryMap["stepIdx"].(float64)
		if int(stepFlt) != stepIdx {
			continue
		}
		rid, _ := entryMap["reviewerId"].(string)
		approvedSet[rid] = true
	}
	for _, a := range approverIdsRaw {
		id, _ := a.(string)
		if !approvedSet[id] {
			return false
		}
	}
	return true
}

func (h *ApprovalHandler) isLastStep(workflow *domain.Workflow, stepIdx int) bool {
	if workflow == nil || len(workflow.Steps) == 0 {
		return true
	}
	return stepIdx >= len(workflow.Steps)-1
}

func (h *ApprovalHandler) syncEntityStatusQuiet(ctx context.Context, targetType, targetID, status string) {
	if err := h.syncEntityStatus(ctx, targetType, targetID, status); err != nil {
		fmt.Printf("warn: sync entity status failed targetType=%s targetId=%s status=%s err=%v\n",
			targetType, targetID, status, err)
	}
}

func (h *ApprovalHandler) fetchWorkflow(ctx context.Context, id string) (domain.Workflow, error) {
	var w domain.Workflow
	var tenantID, scene, description *string
	var steps domain.JSONSlice
	var majorIds domain.StringSlice

	err := h.DB.QueryRow(ctx, `
		SELECT id, tenant_id, name, scene, description, steps, major_ids, usage_count, status, created_at
		FROM workflows WHERE id = $1
	`, id).Scan(
		&w.ID, &tenantID, &w.Name, &scene, &description, &steps, &majorIds, &w.UsageCount, &w.Status, &w.CreatedAt,
	)
	if err != nil {
		return w, err
	}
	w.TenantID = tenantID
	w.Scene = scene
	w.Description = description
	w.Steps = steps
	w.MajorIds = majorIds
	return w, nil
}

var entityTableMap = map[string]string{
	"career_position": "career_positions",
	"scenario":        "scenarios",
	"course":          "courses",
	"question_bank":   "question_banks",
	"exam":            "exams",
}

func (h *ApprovalHandler) syncEntityStatus(ctx context.Context, targetType, targetID, status string) error {
	tableName, ok := entityTableMap[targetType]
	if !ok {
		return nil
	}
	_, err := h.DB.Exec(ctx,
		fmt.Sprintf("UPDATE %s SET status = $1, updated_at = NOW() WHERE id = $2", tableName),
		status, targetID,
	)
	return err
}

func (h *ApprovalHandler) fetchApproval(ctx context.Context, id string) (domain.ApprovalRecord, error) {
	var ar domain.ApprovalRecord
	var tenantID, workflowID *string
	var history domain.JSONSlice

	err := h.DB.QueryRow(ctx, `
		SELECT id, tenant_id, target_type, target_id, workflow_id, current_step_idx, status,
			submitter_id, history, created_at, updated_at
		FROM approval_records WHERE id = $1
	`, id).Scan(
		&ar.ID, &tenantID, &ar.TargetType, &ar.TargetID, &workflowID, &ar.CurrentStepIdx,
		&ar.Status, &ar.SubmitterID, &history, &ar.CreatedAt, &ar.UpdatedAt,
	)
	if err != nil {
		return ar, err
	}
	ar.TenantID = tenantID
	ar.WorkflowID = workflowID
	ar.History = history
	return ar, nil
}

func (h *ApprovalHandler) scanApprovalRows(rows pgx.Rows) ([]domain.ApprovalRecord, error) {
	items := make([]domain.ApprovalRecord, 0)
	for rows.Next() {
		var ar domain.ApprovalRecord
		var tenantID, workflowID *string
		var history domain.JSONSlice
		if err := rows.Scan(
			&ar.ID, &tenantID, &ar.TargetType, &ar.TargetID, &workflowID, &ar.CurrentStepIdx,
			&ar.Status, &ar.SubmitterID, &history, &ar.CreatedAt, &ar.UpdatedAt,
		); err != nil {
			return nil, err
		}
		ar.TenantID = tenantID
		ar.WorkflowID = workflowID
		ar.History = history
		items = append(items, ar)
	}
	return items, nil
}
