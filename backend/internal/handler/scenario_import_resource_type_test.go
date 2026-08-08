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
)

// TestScenarioImportResourceType 验证场景导入时，未命中的资源按文件后缀推断类型，
// 无后缀/未知后缀归入 other；已存在的资源按名称命中且不重复创建。
func TestScenarioImportResourceType(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()

	tenantID := testhelper.TestTenantID
	claims := &middleware.Claims{UserID: testhelper.TestOperatorID, TenantID: &tenantID}
	ctx := context.Background()

	// 预置一个已有资源，验证同名命中不重复创建
	env.DB.Exec(ctx, `DELETE FROM resource_library WHERE tenant_id=$1 AND name=$2`, tenantID, "已有资源.pdf")
	env.DB.Exec(ctx, `INSERT INTO resource_library (tenant_id, name, resource_type) VALUES ($1,$2,$3)`,
		tenantID, "已有资源.pdf", "document")
	var before int
	env.DB.QueryRow(ctx, `SELECT COUNT(*) FROM resource_library WHERE tenant_id=$1 AND name=$2`, tenantID, "已有资源.pdf").Scan(&before)
	if before != 1 {
		t.Fatalf("seed resource: count = %d, want 1", before)
	}

	sceneName := "设备检修场景-" + uuid.NewString()[:8]

	f := excelize.NewFile()
	f.DeleteSheet("Sheet1")
	f.NewSheet("场景基本信息")
	for ci, v := range []interface{}{"场景名称 *", "岗位名称", "行业", "专业", "难度", "背景说明", "所属批次"} {
		cell, _ := excelize.CoordinatesToCellName(ci+1, 2)
		f.SetCellValue("场景基本信息", cell, v)
	}
	f.SetCellValue("场景基本信息", "A3", sceneName)
	f.SetCellValue("场景基本信息", "E3", 2)

	f.NewSheet("任务配置")
	for ci, v := range []interface{}{"场景名称 *", "任务名称 *", "任务类型", "难度", "预计工时", "背景说明", "详细说明", "知识点", "能力点", "资源", "测评方式"} {
		cell, _ := excelize.CoordinatesToCellName(ci+1, 2)
		f.SetCellValue("任务配置", cell, v)
	}
	f.SetCellValue("任务配置", "A3", sceneName)
	f.SetCellValue("任务配置", "B3", "检修任务一")
	f.SetCellValue("任务配置", "C3", "训练")
	f.SetCellValue("任务配置", "D3", 1)
	f.SetCellValue("任务配置", "E3", 2)
	f.SetCellValue("任务配置", "J3", "方案.pdf,数据.xlsx,照片.png,录音.mp3,演示视频.mp4,资料.zip,工具.exe,无后缀名称,怪文件.xyz,已有资源.pdf")

	var buf bytes.Buffer
	if err := f.Write(&buf); err != nil {
		t.Fatalf("write excel: %v", err)
	}

	var body bytes.Buffer
	mw := multipart.NewWriter(&body)
	fw, _ := mw.CreateFormFile("file", uuid.NewString()+".xlsx")
	fw.Write(buf.Bytes())
	mw.Close()
	req := httptest.NewRequest("POST", "/api/v1/import/scenarios/excel", &body)
	req.Header.Set("Content-Type", mw.FormDataContentType())
	req = req.WithContext(context.WithValue(req.Context(), middleware.ContextKeyUser, claims))

	h := &handler.ScenarioImportHandler{Store: env.Store}
	w := httptest.NewRecorder()
	h.ImportExcel(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("scenario import failed: %d %s", w.Code, w.Body.String())
	}

	wantTypes := map[string]string{
		"方案.pdf":   "document",
		"数据.xlsx":  "spreadsheet",
		"照片.png":   "image",
		"录音.mp3":   "audio",
		"演示视频.mp4": "video",
		"资料.zip":   "archive",
		"工具.exe":   "software",
		"无后缀名称":    "other",
		"怪文件.xyz":  "other",
	}
	for name, want := range wantTypes {
		var got string
		err := env.DB.QueryRow(ctx, `SELECT resource_type FROM resource_library WHERE tenant_id=$1 AND name=$2`, tenantID, name).Scan(&got)
		if err != nil {
			t.Fatalf("resource %q not created: %v", name, err)
		}
		if got != want {
			t.Errorf("resource %q: type = %s, want %s", name, got, want)
		}
	}

	var after int
	env.DB.QueryRow(ctx, `SELECT COUNT(*) FROM resource_library WHERE tenant_id=$1 AND name=$2`, tenantID, "已有资源.pdf").Scan(&after)
	if after != before {
		t.Errorf("existing resource duplicated: count = %d, want %d", after, before)
	}
}
