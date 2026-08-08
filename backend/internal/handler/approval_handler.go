package handler

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/redis/go-redis/v9"
	"github.com/zhiyu-saas/backend/internal/cache"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/middleware"
	"github.com/zhiyu-saas/backend/internal/service"
	"github.com/zhiyu-saas/backend/internal/store"
)

// approvalCachePrefix 审批目标类型 → 列表缓存键前缀；无列表缓存的类型不配置。
var approvalCachePrefix = map[string]string{
	"career_position": "zhiyu:%s:public:positions",
	"scenario":        "zhiyu:%s:public:scenarios",
	"exam":            "zhiyu:%s:landing:exams",
}

// invalidateApprovalCache 审批改变实体状态后按目标类型失效对应列表缓存。
func (h *ApprovalHandler) invalidateApprovalCache(r *http.Request, targetType, tenantID string) {
	pattern, ok := approvalCachePrefix[targetType]
	if !ok {
		return
	}
	cache.InvalidatePrefix(r.Context(), h.RedisClient, fmt.Sprintf(pattern, tenantID))
}

type ApprovalHandler struct {
	Service     *service.ApprovalService
	RedisClient *redis.Client
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

func (h *ApprovalHandler) List(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	cfg := h.Service.Store().Approvals().ListConfig()
	params, ok := listParamsFromRequest(r, true)
	if !ok {
		respondError(w, http.StatusForbidden, "缺少租户信息")
		return
	}
	items, total, err := h.Service.ListApprovals(r.Context(), params, cfg)
	if err != nil {
		respondServerError(w, r, err, "查询审批记录失败")
		return
	}
	respondJSON(w, http.StatusOK, ListResponse[domain.ApprovalRecord]{Items: items, Total: total})
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
		if errors.Is(err, store.ErrApprovalExists) {
			respondError(w, http.StatusConflict, "该内容已有待审批记录")
			return
		}
		respondServerError(w, r, err, "创建审批记录失败")
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
		err := h.Service.ReviewApproval(r.Context(), id, req.Action, record.Status, record.CurrentStepIdx, record.CurrentStepIdx,
			record.History, record.TargetType, record.TargetID, record.TenantID, true)
		if err != nil {
			if errors.Is(err, store.ErrNotFound) {
				respondError(w, http.StatusBadRequest, "审批记录不在待处理状态")
				return
			}
			respondServerError(w, r, err, "评审审批记录失败")
			return
		}
		h.invalidateApprovalCache(r, record.TargetType, *record.TenantID)
		record, err = h.Service.GetApproval(r.Context(), id)
		if err != nil {
			respondServerError(w, r, err, "查询审批记录失败")
			return
		}
		respondJSON(w, http.StatusOK, record)
		return
	}

	var workflow *domain.Workflow
	if record.WorkflowID != nil {
		wf, wfErr := h.Service.GetWorkflow(r.Context(), *record.WorkflowID, *record.TenantID)
		if wfErr == nil {
			workflow = wf
		}
	}

	stepIdx := record.CurrentStepIdx
	stepComplete := h.isStepComplete(workflow, record, stepIdx)
	if !stepComplete {
		ok, err := h.Service.UpdateApprovalHistory(r.Context(), id, entry)
		if err != nil || !ok {
			respondServerError(w, r, err, "更新审批记录失败")
			return
		}
		record, err = h.Service.GetApproval(r.Context(), id)
		if err != nil {
			respondServerError(w, r, err, "查询审批记录失败")
			return
		}
		respondJSON(w, http.StatusOK, record)
		return
	}

	newStatus := record.Status
	if h.isLastStep(workflow, stepIdx) {
		newStatus = string(domain.ApprovalStatusApproved)
	}
	newStepIdx := stepIdx + 1
	syncStatus := newStatus == string(domain.ApprovalStatusApproved)

	err = h.Service.ReviewApproval(r.Context(), id, req.Action, newStatus, newStepIdx, record.CurrentStepIdx,
		record.History, record.TargetType, record.TargetID, record.TenantID, syncStatus)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			respondError(w, http.StatusBadRequest, "审批记录不在待处理状态")
			return
		}
		respondServerError(w, r, err, "评审审批记录失败")
		return
	}
	if syncStatus {
		h.invalidateApprovalCache(r, record.TargetType, *record.TenantID)
	}
	record, err = h.Service.GetApproval(r.Context(), id)
	if err != nil {
		respondServerError(w, r, err, "查询审批记录失败")
		return
	}
	respondJSON(w, http.StatusOK, record)
}

func (h *ApprovalHandler) isUserApproverForStep(ctx context.Context, record *domain.ApprovalRecord, userID string) bool {
	if record.WorkflowID == nil {
		return true
	}
	wf, err := h.Service.GetWorkflow(ctx, *record.WorkflowID, *record.TenantID)
	if err != nil || len(wf.Steps) == 0 || record.CurrentStepIdx >= len(wf.Steps) {
		// fail-closed：工作流加载失败/步骤缺失时拒绝审批，避免绕过审批链
		return false
	}
	stepMap, ok := wf.Steps[record.CurrentStepIdx].(map[string]interface{})
	if !ok {
		return false
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
	if record.WorkflowID == nil {
		// 无工作流配置视为单步审批，审核人通过即完成
		return true
	}
	if workflow == nil || len(workflow.Steps) == 0 || stepIdx >= len(workflow.Steps) {
		// fail-closed：流程加载失败/步骤缺失时不视为完成，避免一步直达通过并发布
		return false
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
		stepFlt := 0
		switch v := entryMap["stepIdx"].(type) {
		case float64:
			stepFlt = int(v)
		case int:
			stepFlt = v
		}
		if stepFlt != stepIdx {
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
		// 无工作流配置视为最后一步（单步审批直接通过）；有工作流但加载失败由 isStepComplete 拦截
		return true
	}
	return stepIdx >= len(workflow.Steps)-1
}
