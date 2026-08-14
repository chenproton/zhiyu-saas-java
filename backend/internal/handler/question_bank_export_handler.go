package handler

import (
	"net/http"

	"github.com/zhiyu-saas/backend/internal/middleware"
	"github.com/zhiyu-saas/backend/internal/service"
	"github.com/zhiyu-saas/backend/internal/store"
)

type QuestionBankExportHandler struct {
	Store *store.Store
	Svc   *service.QuestionBankExportService
}

func (h *QuestionBankExportHandler) ExportExcel(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}

	ids, ok := decodeIDList(w, r, "缺少题库ID")
	if !ok {
		return
	}

	ctx := r.Context()
	th := &TemplateHandler{Store: h.Store}
	f := th.generateQuestionBankTemplate(ctx, tenantID)

	if err := h.Svc.FillBanksData(ctx, f, tenantID, ids); err != nil {
		respondServerError(w, r, err, "填充export data失败")
		return
	}

	writeExcel(w, r, f, "题库导出.xlsx")
}
