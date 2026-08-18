package handler

import (
	"net/http"

	"github.com/zhiyu-saas/backend/internal/middleware"
	"github.com/zhiyu-saas/backend/internal/service"
	"github.com/zhiyu-saas/backend/internal/store"
)

type PositionExportHandler struct {
	Store *store.Store
	Svc   *service.PositionExportService
}

func (h *PositionExportHandler) ExportExcel(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}

	ids, ok := decodeIDList(w, r, "缺少岗位ID")
	if !ok {
		return
	}

	ctx := r.Context()
	th := &TemplateHandler{Store: h.Store}
	f := th.generatePositionTemplate(ctx, tenantID)

	if err := h.Svc.FillPositionsData(ctx, f, tenantID, ids); err != nil {
		respondServerError(w, r, err, "填充export data失败")
		return
	}

	writeExcel(w, r, f, "岗位导出.xlsx")
}
