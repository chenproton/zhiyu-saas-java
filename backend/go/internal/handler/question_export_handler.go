package handler

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/zhiyu-saas/backend/internal/middleware"
	"github.com/zhiyu-saas/backend/internal/service"
	"github.com/zhiyu-saas/backend/internal/store"
)

type QuestionExportHandler struct {
	Store *store.Store
	Svc   *service.QuestionExportService
}

func (h *QuestionExportHandler) ExportExcel(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}

	bankID := chi.URLParam(r, "bankId")
	if bankID == "" {
		respondError(w, http.StatusBadRequest, "缺少题库ID")
		return
	}

	ctx := r.Context()
	if _, err := h.Store.QuestionBanks().GetScoped(ctx, bankID, tenantID); err != nil {
		respondError(w, http.StatusBadRequest, "题库不存在")
		return
	}

	ids, ok := decodeIDList(w, r, "缺少题目ID")
	if !ok {
		return
	}

	th := &TemplateHandler{Store: h.Store}
	f := th.generateQuestionTemplate(ctx, tenantID, bankID)

	if err := h.Svc.FillQuestionsData(ctx, f, tenantID, bankID, ids); err != nil {
		respondServerError(w, r, err, "填充export data失败")
		return
	}

	writeExcel(w, r, f, "题目导出.xlsx")
}
