package handler

import (
	"context"
	"log/slog"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/middleware"
	"github.com/zhiyu-saas/backend/internal/service"
	"github.com/zhiyu-saas/backend/internal/store"
)

type QuestionBankHandler struct {
	Service *service.EvaluationService
}
type CreateQuestionBankRequest struct {
	Name                string   `json:"name"`
	Description         *string  `json:"description"`
	CoverImage          *string  `json:"coverImage"`
	CollaboratorIDs     []string `json:"collaboratorIds"`
	CollaboratorDeptIDs []string `json:"collaboratorDeptIds"`
	BatchID             *string  `json:"batchId"`
	KnowledgePointIds   []string `json:"knowledgePointIds"`
}

func (h *QuestionBankHandler) List(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	tenantClaims := middleware.CurrentUser(r)
	effectiveTenantID, ok := tenantFilter(tenantClaims)
	if !ok {
		respondError(w, http.StatusForbidden, "缺少租户信息")
		return
	}
	if err := h.Service.EnsureDraftPool(r.Context(), effectiveTenantID, claims.UserID); err != nil {
		slog.Warn("确保草稿池失败", "error", err)
	}

	cfg := h.Service.Store().QuestionBanks().ListConfig()
	params, ok := listParamsFromRequest(r, true)
	if !ok {
		respondError(w, http.StatusForbidden, "缺少租户信息")
		return
	}
	items, total, err := h.Service.ListQuestionBanks(r.Context(), params, cfg)
	if err != nil {
		respondServerError(w, r, err, "查询题库失败")
		return
	}
	respondJSON(w, http.StatusOK, ListResponse[domain.QuestionBank]{Items: items, Total: total})
}

func (h *QuestionBankHandler) Get(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	tenantID, ok := tenantFilter(claims)
	if !ok {
		respondError(w, http.StatusForbidden, "缺少租户信息")
		return
	}

	id := chi.URLParam(r, "id")
	bank, err := h.Service.GetQuestionBankInTenant(r.Context(), id, tenantID)
	if err != nil {
		respondError(w, http.StatusNotFound, "题库不存在")
		return
	}
	respondJSON(w, http.StatusOK, bank)
}

func (h *QuestionBankHandler) Create(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	var req CreateQuestionBankRequest
	if !decodeBody(w, r, &req) {
		return
	}
	if req.Name == "" {
		respondError(w, http.StatusBadRequest, "缺少必填字段")
		return
	}
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}

	code, err := h.Service.GenerateEntityCode(r.Context(), "TK", "question_banks", tenantID)
	if err != nil {
		respondServerError(w, r, err, "生成question bank code失败")
		return
	}

	bank, err := h.Service.CreateQuestionBank(r.Context(), tenantID, &store.QuestionBankCreateParams{
		Code:                code,
		Name:                req.Name,
		Description:         req.Description,
		CoverImage:          req.CoverImage,
		CreatorID:           claims.UserID,
		CollaboratorIDs:     coalesceStringSlice(req.CollaboratorIDs),
		CollaboratorDeptIDs: coalesceStringSlice(req.CollaboratorDeptIDs),
		BatchID:             emptyStrToNil(req.BatchID),
		KnowledgePointIDs:   req.KnowledgePointIds,
	})
	if err != nil {
		if isUniqueViolation(err) {
			respondError(w, http.StatusConflict, "题库名称已存在，请使用其他名称")
			return
		}
		respondServerError(w, r, err, "创建题库失败")
		return
	}
	respondJSON(w, http.StatusCreated, bank)
}

func (h *QuestionBankHandler) Update(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}

	id := chi.URLParam(r, "id")
	existing, err := h.Service.GetQuestionBankInTenant(r.Context(), id, tenantID)
	if err != nil {
		respondError(w, http.StatusNotFound, "题库不存在")
		return
	}
	if existing.IsDraftPool {
		respondError(w, http.StatusForbidden, "草稿库不允许编辑")
		return
	}

	var req CreateQuestionBankRequest
	if !decodeBody(w, r, &req) {
		return
	}
	if req.Name == "" {
		req.Name = existing.Name
	}
	if req.Description == nil || *req.Description == "" {
		req.Description = existing.Description
	}
	if req.CoverImage == nil {
		req.CoverImage = existing.CoverImage
	}
	collaboratorIDs := req.CollaboratorIDs
	if collaboratorIDs == nil {
		collaboratorIDs = existing.CollaboratorIDs
	}
	collaboratorDeptIDs := req.CollaboratorDeptIDs
	if collaboratorDeptIDs == nil {
		collaboratorDeptIDs = existing.CollaboratorDeptIDs
	}
	batchID := req.BatchID
	if batchID == nil {
		batchID = existing.BatchID
	}
	knowledgePointIDs := req.KnowledgePointIds
	if knowledgePointIDs == nil {
		knowledgePointIDs = existing.KnowledgePointIDs
	}

	bank, err := h.Service.UpdateQuestionBank(r.Context(), id, tenantID, &store.QuestionBankUpdateParams{
		TenantID:            tenantID,
		Name:                req.Name,
		Description:         req.Description,
		CoverImage:          req.CoverImage,
		CollaboratorIDs:     collaboratorIDs,
		CollaboratorDeptIDs: collaboratorDeptIDs,
		BatchID:             emptyStrToNil(batchID),
		KnowledgePointIDs:   knowledgePointIDs,
	})
	if err != nil {
		if isUniqueViolation(err) {
			respondError(w, http.StatusConflict, "题库名称已存在，请使用其他名称")
			return
		}
		respondServerError(w, r, err, "更新题库失败")
		return
	}
	respondJSON(w, http.StatusOK, bank)
}

func (h *QuestionBankHandler) Delete(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}

	id := chi.URLParam(r, "id")
	bank, err := h.Service.GetQuestionBankInTenant(r.Context(), id, tenantID)
	if err != nil {
		respondError(w, http.StatusNotFound, "题库不存在")
		return
	}
	if bank.IsDraftPool {
		respondError(w, http.StatusForbidden, "草稿库不允许删除")
		return
	}
	if err := h.Service.DeleteQuestionBank(r.Context(), id, tenantID); err != nil {
		respondServerError(w, r, err, "删除题库失败")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"id": id})
}

func (h *QuestionBankHandler) actions() contentActions {
	return contentActions{
		st:         h.Service.Store(),
		table:      "question_banks",
		entityName: "question_bank",
		targetType: "question_bank",
		inviteCol:  "collaborator_ids",
		fetch: func(ctx context.Context, id string) (interface{}, error) {
			// 状态流转前的 checkTenantAccess 已完成租户归属校验，回读时从上下文 claims 取租户
			claims, _ := ctx.Value(middleware.ContextKeyUser).(*middleware.Claims)
			return h.Service.GetQuestionBank(ctx, tenantIDOf(claims), id)
		},
	}
}

func (h *QuestionBankHandler) Submit(w http.ResponseWriter, r *http.Request) {
	if h.isDraftPool(r, w) {
		return
	}
	h.actions().transition(w, r, domain.StatusPending)
}

func (h *QuestionBankHandler) Review(w http.ResponseWriter, r *http.Request) {
	h.actions().review(w, r)
}

func (h *QuestionBankHandler) Publish(w http.ResponseWriter, r *http.Request) {
	if h.isDraftPool(r, w) {
		return
	}
	h.actions().transition(w, r, domain.StatusPublished)
}

func (h *QuestionBankHandler) Archive(w http.ResponseWriter, r *http.Request) {
	h.actions().transition(w, r, domain.StatusArchived)
}

func (h *QuestionBankHandler) Unpublish(w http.ResponseWriter, r *http.Request) {
	h.actions().transition(w, r, domain.StatusDraft)
}

func (h *QuestionBankHandler) Withdraw(w http.ResponseWriter, r *http.Request) {
	h.actions().transition(w, r, domain.StatusDraft)
}

func (h *QuestionBankHandler) SaveDraft(w http.ResponseWriter, r *http.Request) {
	h.actions().saveDraft(w, r)
}

func (h *QuestionBankHandler) Invite(w http.ResponseWriter, r *http.Request) {
	h.actions().invite(w, r)
}

// isDraftPool 草稿池禁止提交/发布，返回 true 并写入 400 响应。
func (h *QuestionBankHandler) isDraftPool(r *http.Request, w http.ResponseWriter) bool {
	id := chi.URLParam(r, "id")
	isDraftPool, err := h.Service.IsDraftPool(r.Context(), id)
	if err != nil {
		return false
	}
	if isDraftPool {
		respondError(w, http.StatusBadRequest, "不能对草稿池执行此操作")
		return true
	}
	return false
}
