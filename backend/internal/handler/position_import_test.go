package handler_test

import (
	"context"
	"net/http/httptest"
	"testing"

	"github.com/zhiyu-saas/backend/internal/handler"
	"github.com/zhiyu-saas/backend/internal/handler/testhelper"
	"github.com/zhiyu-saas/backend/internal/middleware"
	"github.com/zhiyu-saas/backend/internal/service"
)

// TestPositionImportExcel 覆盖 service 下沉后的岗位导入主链路：
// 预览不落库 → 导入落库 + 职责/能力绑定写入。
func TestPositionImportExcel(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()

	tenantID := testhelper.TestTenantID
	claims := &middleware.Claims{UserID: testhelper.TestOperatorID, TenantID: &tenantID}
	ctx := context.Background()

	file := buildExcel2(t, map[string][][]interface{}{
		"岗位基本信息": {
			{"填写说明"},
			{"岗位名称 *", "简称", "岗位类型", "所属行业", "所属专业", "薪资下限", "薪资上限", "岗位简介", "任职要求", "职业发展", "证书", "所属批次"},
			{"岗位导入验证", "导岗", "", "", "", "", "", "自动化测试岗位", "", "", "", ""},
		},
		"工作职责与能力点": {
			{"填写说明"},
			{"岗位名称 *", "职责名称 *", "能力点", "能力属性", "能力域", "掌握程度", "量规描述"},
			{"岗位导入验证", "职责一", "", "", "", "掌握", ""},
		},
	})

	h := &handler.PositionImportHandler{Svc: service.NewPositionImportService(service.New(env.Store))}

	// 预览不落库
	req := makeRequest(t, "/api/v1/import/positions/excel/preview", file, claims)
	w := httptest.NewRecorder()
	h.PreviewExcel(w, req)
	if w.Code != 200 {
		t.Fatalf("preview failed: %d %s", w.Code, w.Body.String())
	}
	var previewCount int
	env.DB.QueryRow(ctx, `SELECT COUNT(*) FROM career_positions WHERE tenant_id=$1 AND name=$2`, tenantID, "岗位导入验证").Scan(&previewCount)
	if previewCount != 0 {
		t.Fatalf("预览不应写库，实际 %d 条", previewCount)
	}

	// 导入落库
	req = makeRequest(t, "/api/v1/import/positions/excel", file, claims)
	w = httptest.NewRecorder()
	h.ImportExcel(w, req)
	if w.Code != 200 {
		t.Fatalf("import failed: %d %s", w.Code, w.Body.String())
	}

	var positionID string
	env.DB.QueryRow(ctx, `SELECT id FROM career_positions WHERE tenant_id=$1 AND name=$2`, tenantID, "岗位导入验证").Scan(&positionID)
	if positionID == "" {
		t.Fatalf("岗位未落库")
	}
	var respCount int
	env.DB.QueryRow(ctx, `SELECT COUNT(*) FROM position_responsibilities WHERE career_position_id=$1`, positionID).Scan(&respCount)
	if respCount != 1 {
		t.Fatalf("expected 1 responsibility, got %d", respCount)
	}
}
