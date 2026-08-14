package handler

import (
	"net/http"

	"github.com/zhiyu-saas/backend/internal/middleware"
	"github.com/zhiyu-saas/backend/internal/service"
	"github.com/zhiyu-saas/backend/internal/store"
)

type ScenarioExportHandler struct {
	Store *store.Store
	Svc   *service.ScenarioExportService
}

func (h *ScenarioExportHandler) ExportExcel(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}

	ids, ok := decodeIDList(w, r, "缺少场景方案ID")
	if !ok {
		return
	}

	ctx := r.Context()
	th := &TemplateHandler{Store: h.Store}
	f := th.generateScenarioTemplate(ctx, tenantID)

	if err := h.Svc.FillScenariosData(ctx, f, tenantID, ids); err != nil {
		respondServerError(w, r, err, "填充export data失败")
		return
	}

	writeExcel(w, r, f, "场景导出.xlsx")
}
