package handler

import (
	"context"
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

type QuestionBankListResponse struct {
	Items []domain.QuestionBank `json:"items"`
	Total int                   `json:"total"`
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
	h.Service.EnsureDraftPool(r.Context(), effectiveTenantID, claims.UserID)

	cfg := store.ListQueryConfig[domain.QuestionBank]{
		Table: "question_banks qb LEFT JOIN LATERAL (SELECT COUNT(*) AS cnt FROM questions q WHERE q.bank_id = qb.id) qcnt ON true LEFT JOIN users cr_u ON cr_u.id = qb.creator_id LEFT JOIN LATERAL (SELECT COALESCE(array_agg(kp.knowledge_point_id), '{}') AS ids FROM question_bank_knowledge_points kp WHERE kp.question_bank_id = qb.id) kparr ON true",
		SelectColumns: "qb.id, qb.code, qb.name, qb.description, qb.cover_image, qb.status, COALESCE(qcnt.cnt, 0) AS question_count, qb.creator_id, COALESCE(cr_u.name, qb.creator_id::text) AS creator_name, qb.collaborator_ids, COALESCE((SELECT array_agg(u.name ORDER BY ord) FROM unnest(qb.collaborator_ids) WITH ORDINALITY AS c(id, ord) JOIN users u ON u.id = c.id), '{}') AS collaborator_names, qb.collaborator_dept_ids, qb.batch_id, qb.version, qb.owner_type, qb.is_draft_pool, COALESCE(kparr.ids, '{}') AS knowledge_point_ids, qb.created_at, qb.updated_at",
		TenantScoped:  true,
		TenantColumn:  "qb.tenant_id",
		SearchColumns: []string{"qb.name", "qb.description"},
		OrderBy:       "qb.is_draft_pool DESC, qb.created_at DESC",
		DefaultLimit:  50,
		ScanRows:      store.ScanQuestionBankRows,
		ExtraFilter: func(p store.ListParams, qb *store.ListQueryBuilder) {
			if status := p.Values["status"]; status != "" {
				qb.AddCondition("qb.status = " + qb.NextArg(status))
			}
		},
	}
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
	respondJSON(w, http.StatusOK, QuestionBankListResponse{Items: items, Total: total})
}

func (h *QuestionBankHandler) Get(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	id := chi.URLParam(r, "id")
	bank, err := h.Service.GetQuestionBank(r.Context(), id)
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

	code, err := store.GenerateUniqueEntityCode(r.Context(), h.Service.Queryer(), "TK", "question_banks", tenantID)
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
		respondError(w, http.StatusInternalServerError, "创建题库失败")
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

	id := chi.URLParam(r, "id")
	existing, err := h.Service.GetQuestionBank(r.Context(), id)
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
		existingDesc := existing.Description
		req.Description = &existingDesc
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

	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}

	bank, err := h.Service.UpdateQuestionBank(r.Context(), id, &store.QuestionBankUpdateParams{
		TenantID:            tenantID,
		Name:                req.Name,
		Description:         req.Description,
		CoverImage:          req.CoverImage,
		CollaboratorIDs:     collaboratorIDs,
		CollaboratorDeptIDs: collaboratorDeptIDs,
		BatchID:             emptyStrToNil(req.BatchID),
		KnowledgePointIDs:   req.KnowledgePointIds,
	})
	if err != nil {
		if isUniqueViolation(err) {
			respondError(w, http.StatusConflict, "题库名称已存在，请使用其他名称")
			return
		}
		respondError(w, http.StatusInternalServerError, "更新题库失败")
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

	id := chi.URLParam(r, "id")
	bank, err := h.Service.GetQuestionBank(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusNotFound, "题库不存在")
		return
	}
	if bank.IsDraftPool {
		respondError(w, http.StatusForbidden, "草稿库不允许删除")
		return
	}
	if err := h.Service.DeleteQuestionBank(r.Context(), id); err != nil {
		respondError(w, http.StatusInternalServerError, "删除题库失败")
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
			return h.Service.GetQuestionBank(ctx, id)
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
