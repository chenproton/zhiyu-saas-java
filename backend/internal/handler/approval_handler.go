package handler

import (
	"context"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/middleware"
	"github.com/zhiyu-saas/backend/internal/service"
	"github.com/zhiyu-saas/backend/internal/store"
)

type ApprovalHandler struct {
	Service *service.PositionService
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
	Action string  `json:"action"`
	Remark *string `json:"remark"`
}

var entityTableMap = map[string]string{
	"career_position":  "career_positions",
	"scenario":         "scenarios",
	"course":           "courses",
	"question_bank":    "question_banks",
	"exam":             "exams",
	"training_program": "training_programs",
}

func (h *ApprovalHandler) List(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	status := r.URL.Query().Get("status")
	submitterID := r.URL.Query().Get("submitterId")
	targetType := r.URL.Query().Get("targetType")

	cfg := store.ListQueryConfig[domain.ApprovalRecord]{
		Table:         "approval_records",
		SelectColumns: "id, tenant_id, target_type, target_id, workflow_id, current_step_idx, status, submitter_id, history, created_at, updated_at",
		TenantScoped:  true,
		OrderBy:       "created_at DESC",
		ScanRows:      store.ScanApprovalRows,
		ExtraFilter: func(p store.ListParams, qb *store.ListQueryBuilder) {
			if status != "" {
				qb.AddCondition("status = " + qb.NextArg(status))
			}
			if targetType != "" {
				qb.AddCondition("target_type = " + qb.NextArg(targetType))
			}
			if submitterID != "" {
				qb.AddCondition("submitter_id = " + qb.NextArg(submitterID))
			}
		},
	}
	params, ok := listParamsFromRequest(r, true)
	if !ok {
		respondError(w, http.StatusForbidden, "缺少租户信息")
		return
	}
	items, total, err := h.Service.ListApprovals(r.Context(), params, cfg)
	if err != nil {
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
	record, err := h.Service.GetApproval(r.Context(), id)
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
	record, err := h.Service.CreateApproval(r.Context(), user.TenantID, &store.ApprovalCreateParams{
		TargetType: req.TargetType, TargetID: req.TargetID, WorkflowID: req.WorkflowID,
		Status: string(domain.ApprovalStatusPending), SubmitterID: user.UserID, History: domain.JSONSlice{},
	})
	if err != nil {
		respondError(w, http.StatusInternalServerError, "创建审批记录失败")
		return
	}
	respondJSON(w, http.StatusCreated, record)
}

func (h *ApprovalHandler) Review(w http.ResponseWriter, r *http.Request) {
	user := middleware.CurrentUser(r)
	if user == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	id := chi.URLParam(r, "id")
	record, err := h.Service.GetApproval(r.Context(), id)
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
	if !h.isUserApproverForStep(r.Context(), record, user.UserID) {
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
		err := h.Service.ReviewApproval(r.Context(), id, req.Action, record.Status, record.CurrentStepIdx,
			record.History, record.TargetType, record.TargetID, record.TenantID, true)
		if err != nil {
			if err == store.ErrNotFound {
				respondError(w, http.StatusBadRequest, "审批记录不在待处理状态")
				return
			}
			respondError(w, http.StatusInternalServerError, "评审审批记录失败")
			return
		}
		record, _ = h.Service.GetApproval(r.Context(), id)
		respondJSON(w, http.StatusOK, record)
		return
	}

	var workflow *domain.Workflow
	if record.WorkflowID != nil {
		wf, wfErr := h.Service.GetWorkflow(r.Context(), *record.WorkflowID)
		if wfErr == nil {
			workflow = wf
		}
	}

	stepIdx := record.CurrentStepIdx
	stepComplete := h.isStepComplete(workflow, record, stepIdx)
	if !stepComplete {
		ok, err := h.Service.UpdateApprovalHistory(r.Context(), id, record.History)
		if err != nil || !ok {
			respondError(w, http.StatusInternalServerError, "更新审批记录失败")
			return
		}
		record, _ = h.Service.GetApproval(r.Context(), id)
		respondJSON(w, http.StatusOK, record)
		return
	}

	newStatus := record.Status
	if h.isLastStep(workflow, stepIdx) {
		newStatus = string(domain.ApprovalStatusApproved)
	}
	newStepIdx := stepIdx + 1
	syncStatus := newStatus == string(domain.ApprovalStatusApproved)

	err = h.Service.ReviewApproval(r.Context(), id, req.Action, newStatus, newStepIdx,
		record.History, record.TargetType, record.TargetID, record.TenantID, syncStatus)
	if err != nil {
		if err == store.ErrNotFound {
			respondError(w, http.StatusBadRequest, "审批记录不在待处理状态")
			return
		}
		respondError(w, http.StatusInternalServerError, "评审审批记录失败")
		return
	}
	record, _ = h.Service.GetApproval(r.Context(), id)
	respondJSON(w, http.StatusOK, record)
}

func (h *ApprovalHandler) isUserApproverForStep(ctx context.Context, record *domain.ApprovalRecord, userID string) bool {
	if record.WorkflowID == nil {
		return true
	}
	wf, err := h.Service.GetWorkflow(ctx, *record.WorkflowID)
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
