package handler

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/middleware"
	"github.com/zhiyu-saas/backend/internal/store"
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
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	items, total, err := executeListQuery[domain.ApprovalRecord](r.Context(), h.DB, r, store.ListQueryConfig[domain.ApprovalRecord]{
		Table:         "approval_records",
		SelectColumns: "id, tenant_id, target_type, target_id, workflow_id, current_step_idx, status, submitter_id, history, created_at, updated_at",
		TenantScoped:  true,
		ExtraFilter: func(p store.ListParams, qb *store.ListQueryBuilder) {
			if targetType := p.Values["targetType"]; targetType != "" {
				qb.AddCondition("target_type = " + qb.NextArg(targetType))
			}
			if targetID := p.Values["targetId"]; targetID != "" {
				qb.AddCondition("target_id = " + qb.NextArg(targetID))
			}
			if status := p.Values["status"]; status != "" {
				qb.AddCondition("status = " + qb.NextArg(status))
			}
			if submitterID := p.Values["submitterId"]; submitterID != "" {
				qb.AddCondition("submitter_id = " + qb.NextArg(submitterID))
			}
		},
	}, h.scanApprovalRows)
	if err != nil {
		if errors.Is(err, store.ErrMissingTenant) {
			respondError(w, http.StatusForbidden, "缺少租户信息")
			return
		}
		respondError(w, http.StatusInternalServerError, "查询审批记录失败")
		return
	}

	respondJSON(w, http.StatusOK, ApprovalListResponse{Items: items, Total: total})
}

func (h *ApprovalHandler) Get(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	id := chi.URLParam(r, "id")
	record, err := h.fetchApproval(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusNotFound, "审批记录不存在")
		return
	}
	if record.TenantID != nil && !verifyTenantOwnership(w, r, *record.TenantID) {
		return
	}
	respondJSON(w, http.StatusOK, record)
}

func (h *ApprovalHandler) Create(w http.ResponseWriter, r *http.Request) {
	user := middleware.CurrentUser(r)
	if user == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	var req CreateApprovalRequest
	if !decodeBody(w, r, &req) {
		return
	}

	if req.TargetType == "" || req.TargetID == "" {
		respondError(w, http.StatusBadRequest, "缺少必填字段")
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
		respondError(w, http.StatusInternalServerError, "创建审批记录失败")
		return
	}

	record, _ := h.fetchApproval(r.Context(), id)
	respondJSON(w, http.StatusCreated, record)
}

func (h *ApprovalHandler) Review(w http.ResponseWriter, r *http.Request) {
	user := middleware.CurrentUser(r)
	if user == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	id := chi.URLParam(r, "id")
	record, err := h.fetchApproval(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusNotFound, "审批记录不存在")
		return
	}

	if record.TenantID == nil {
		respondError(w, http.StatusForbidden, "缺少租户信息")
		return
	}
	if !verifyTenantOwnership(w, r, *record.TenantID) {
		return
	}

	if record.Status != string(domain.ApprovalStatusPending) {
		respondError(w, http.StatusBadRequest, "审批记录不在待处理状态")
		return
	}

	var req ReviewApprovalRequest
	if !decodeBody(w, r, &req) {
		return
	}

	if req.Action != string(domain.ApprovalStatusApproved) && req.Action != string(domain.ApprovalStatusRejected) {
		respondError(w, http.StatusBadRequest, "无效操作")
		return
	}

	if !h.isUserApproverForStep(r.Context(), &record, user.UserID) {
		respondError(w, http.StatusForbidden, "无权评审此步骤")
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

		tx, err := h.DB.Begin(r.Context())
		if err != nil {
			respondError(w, http.StatusInternalServerError, "开启事务失败")
			return
		}
		defer tx.Rollback(r.Context())

		tag, err := tx.Exec(r.Context(), `
			UPDATE approval_records SET status = $1, history = $2, updated_at = NOW()
			WHERE id = $3 AND status = $4
		`, record.Status, record.History, id, string(domain.ApprovalStatusPending))
		if err != nil {
			respondError(w, http.StatusInternalServerError, "评审审批记录失败")
			return
		}
		if tag.RowsAffected() == 0 {
			respondError(w, http.StatusBadRequest, "审批记录不在待处理状态")
			return
		}

		if tableName, ok := entityTableMap[record.TargetType]; ok {
			if _, err := tx.Exec(r.Context(),
				fmt.Sprintf("UPDATE %s SET status = $1, updated_at = NOW() WHERE id = $2 AND tenant_id = $3", tableName),
				string(domain.ApprovalStatusRejected), record.TargetID, *record.TenantID,
			); err != nil {
				respondError(w, http.StatusInternalServerError, "同步实体状态失败")
				return
			}
		}

		if err := tx.Commit(r.Context()); err != nil {
			respondError(w, http.StatusInternalServerError, "提交事务失败")
			return
		}

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
			UPDATE approval_records SET history = $1, updated_at = NOW()
			WHERE id = $2 AND status = $3
		`, record.History, id, string(domain.ApprovalStatusPending))
		if err != nil {
			respondError(w, http.StatusInternalServerError, "更新审批记录失败")
			return
		}
		record, _ = h.fetchApproval(r.Context(), id)
		respondJSON(w, http.StatusOK, record)
		return
	}

	newStatus := record.Status
	if h.isLastStep(workflow, stepIdx) {
		newStatus = string(domain.ApprovalStatusApproved)
	}
	newStepIdx := stepIdx + 1

	tx, err := h.DB.Begin(r.Context())
	if err != nil {
		respondError(w, http.StatusInternalServerError, "开启事务失败")
		return
	}
	defer tx.Rollback(r.Context())

	tag, err := tx.Exec(r.Context(), `
		UPDATE approval_records SET status = $1, current_step_idx = $2, history = $3, updated_at = NOW()
		WHERE id = $4 AND status = $5
	`, newStatus, newStepIdx, record.History, id, string(domain.ApprovalStatusPending))
	if err != nil {
		respondError(w, http.StatusInternalServerError, "评审审批记录失败")
		return
	}
	if tag.RowsAffected() == 0 {
		respondError(w, http.StatusBadRequest, "审批记录不在待处理状态")
		return
	}

	if newStatus == string(domain.ApprovalStatusApproved) {
		if tableName, ok := entityTableMap[record.TargetType]; ok {
			if _, err := tx.Exec(r.Context(),
				fmt.Sprintf("UPDATE %s SET status = $1, updated_at = NOW() WHERE id = $2 AND tenant_id = $3", tableName),
				string(domain.ApprovalStatusApproved), record.TargetID, *record.TenantID,
			); err != nil {
				respondError(w, http.StatusInternalServerError, "同步实体状态失败")
				return
			}
		}
	}

	if err := tx.Commit(r.Context()); err != nil {
		respondError(w, http.StatusInternalServerError, "提交事务失败")
		return
	}

	record, _ = h.fetchApproval(r.Context(), id)
	respondJSON(w, http.StatusOK, record)
}

func (h *ApprovalHandler) isUserApproverForStep(ctx context.Context, record *domain.ApprovalRecord, userID string) bool {
	if record.WorkflowID == nil {
		return true
	}
	wf, err := h.fetchWorkflow(ctx, *record.WorkflowID)
	if err != nil || len(wf.Steps) == 0 || record.CurrentStepIdx >= len(wf.Steps) {
		return true
	}
	stepMap, ok := wf.Steps[record.CurrentStepIdx].(map[string]interface{})
	if !ok {
		return true
	}
	approverIdsRaw, _ := stepMap["approverIds"].([]interface{})
	for _, a := range approverIdsRaw {
		if id, _ := a.(string); id == userID {
			return true
		}
	}
	return false
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
	"career_position":  "career_positions",
	"scenario":         "scenarios",
	"course":           "courses",
	"question_bank":    "question_banks",
	"exam":             "exams",
	"training_program": "training_programs",
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
