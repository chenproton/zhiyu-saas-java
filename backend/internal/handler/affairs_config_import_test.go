package handler_test

import (
	"bytes"
	"context"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/google/uuid"
	"github.com/xuri/excelize/v2"
	"github.com/zhiyu-saas/backend/internal/handler"
	"github.com/zhiyu-saas/backend/internal/handler/testhelper"
	"github.com/zhiyu-saas/backend/internal/middleware"
	"github.com/zhiyu-saas/backend/internal/service"
)

// TestAffairsConfigImportPeriodSlotType 验证教务配置导入时节次时段类型解析：
// 优先读「时段类型」列（早自习/上午/下午/晚自习），为空时按排序位置推断（0-3 上午、4-7 下午、8+ 晚自习），
// 保证导入后新节次配置页分组与课表标签正确。
func TestAffairsConfigImportPeriodSlotType(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()

	tenantID := testhelper.TestTenantID
	claims := &middleware.Claims{UserID: testhelper.TestOperatorID, TenantID: &tenantID}
	ctx := context.Background()

	suffix := uuid.NewString()[:8]
	names := []string{
		"上午1-" + suffix,
		"上午2-" + suffix,
		"下午1-" + suffix,
		"下午2-" + suffix,
		"晚自习1-" + suffix,
		"早自习1-" + suffix,
	}
	for _, n := range names {
		env.DB.Exec(ctx, `DELETE FROM period_slots WHERE tenant_id=$1 AND name=$2`, tenantID, n)
	}
	defer func() {
		for _, n := range names {
			env.DB.Exec(ctx, `DELETE FROM period_slots WHERE tenant_id=$1 AND name=$2`, tenantID, n)
		}
	}()

	f := excelize.NewFile()
	f.DeleteSheet("Sheet1")
	f.NewSheet("学期")
	f.NewSheet("场地")
	f.NewSheet("节次")
	headers := []interface{}{"名称 *", "开始时间", "结束时间", "排序", "时段类型"}
	for ci, v := range headers {
		cell, _ := excelize.CoordinatesToCellName(ci+1, 2)
		f.SetCellValue("节次", cell, v)
	}
	// 排序 0/1 → 未填时段类型按位置推断 morning；4/5 → 未填按位置推断 afternoon
	// 排序 8 → 未填按位置推断 evening；早自习1 显式填「早自习」（排序 2 也应为 morning_self）
	f.SetCellValue("节次", "A3", names[0])
	f.SetCellValue("节次", "D3", 0)
	f.SetCellValue("节次", "A4", names[1])
	f.SetCellValue("节次", "D4", 1)
	f.SetCellValue("节次", "A5", names[2])
	f.SetCellValue("节次", "D5", 4)
	f.SetCellValue("节次", "A6", names[3])
	f.SetCellValue("节次", "D6", 5)
	f.SetCellValue("节次", "A7", names[4])
	f.SetCellValue("节次", "D7", 8)
	f.SetCellValue("节次", "A8", names[5])
	f.SetCellValue("节次", "D8", 2)
	f.SetCellValue("节次", "E8", "早自习")

	var buf bytes.Buffer
	if err := f.Write(&buf); err != nil {
		t.Fatalf("write excel: %v", err)
	}
	var body bytes.Buffer
	mw := multipart.NewWriter(&body)
	fw, _ := mw.CreateFormFile("file", uuid.NewString()+".xlsx")
	fw.Write(buf.Bytes())
	mw.Close()
	req := httptest.NewRequest("POST", "/api/v1/import/affairs-config/excel", &body)
	req.Header.Set("Content-Type", mw.FormDataContentType())
	req = req.WithContext(context.WithValue(req.Context(), middleware.ContextKeyUser, claims))

	h := &handler.AffairsConfigImportHandler{Store: env.Store, Svc: service.NewAffairsConfigImportService(service.New(env.Store))}
	w := httptest.NewRecorder()
	h.ImportExcel(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("import failed: %d %s", w.Code, w.Body.String())
	}

	rows, err := env.DB.Query(ctx, `
		SELECT name, slot_type FROM period_slots
		WHERE tenant_id=$1 AND name IN ($2,$3,$4,$5,$6,$7) ORDER BY sort_order
	`, tenantID, names[0], names[1], names[2], names[3], names[4], names[5])
	if err != nil {
		t.Fatalf("query slots: %v", err)
	}
	defer rows.Close()
	got := map[string]string{}
	for rows.Next() {
		var n, slotType string
		if err := rows.Scan(&n, &slotType); err != nil {
			t.Fatalf("scan: %v", err)
		}
		got[n] = slotType
	}
	want := map[string]string{
		names[0]: "morning",
		names[1]: "morning",
		names[2]: "afternoon",
		names[3]: "afternoon",
		names[4]: "evening",
		names[5]: "morning_self",
	}
	for n, wantType := range want {
		if got[n] != wantType {
			t.Fatalf("slot %s type = %s, want %s", n, got[n], wantType)
		}
	}
}
