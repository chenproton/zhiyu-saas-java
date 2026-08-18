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

// TestScenarioImportEvalWeight 验证场景导入时测评方式按等分写入权重（如 4 种各 25），
// 而非恒为 0，避免评分后均分/综合分恒为 0。
func TestScenarioImportEvalWeight(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()

	tenantID := testhelper.TestTenantID
	claims := &middleware.Claims{UserID: testhelper.TestOperatorID, TenantID: &tenantID}
	ctx := context.Background()

	sceneName := "权重导入场景-" + uuid.NewString()[:8]
	env.DB.Exec(ctx, `DELETE FROM scenarios WHERE tenant_id=$1 AND name=$2`, tenantID, sceneName)

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
	f.SetCellValue("任务配置", "B3", "权重任务一")
	f.SetCellValue("任务配置", "K3", "现场问答,现场评审,成果评价,作业")

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

	h := &handler.ScenarioImportHandler{Store: env.Store, Svc: service.NewScenarioImportService(service.New(env.Store))}
	w := httptest.NewRecorder()
	h.ImportExcel(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("scenario import failed: %d %s", w.Code, w.Body.String())
	}

	var scenarioID string
	if err := env.DB.QueryRow(ctx, `SELECT id FROM scenarios WHERE tenant_id=$1 AND name=$2`, tenantID, sceneName).Scan(&scenarioID); err != nil {
		t.Fatalf("scene not imported: %v", err)
	}

	rows, err := env.DB.Query(ctx, `
		SELECT method_key, weight FROM task_evaluation_methods
		WHERE task_id IN (SELECT id FROM scenario_tasks WHERE scenario_id=$1)
		ORDER BY method_key
	`, scenarioID)
	if err != nil {
		t.Fatalf("query weights: %v", err)
	}
	defer rows.Close()
	weights := map[string]float64{}
	for rows.Next() {
		var mk string
		var w float64
		if err := rows.Scan(&mk, &w); err != nil {
			t.Fatalf("scan: %v", err)
		}
		weights[mk] = w
	}
	wantKeys := []string{"homework", "outcome", "random_draw", "review"}
	if len(weights) != len(wantKeys) {
		t.Fatalf("测评方式数量 = %d, want %d (%v)", len(weights), len(wantKeys), weights)
	}
	for _, mk := range wantKeys {
		w, ok := weights[mk]
		if !ok {
			t.Errorf("缺少测评方式 %s", mk)
			continue
		}
		if w != 25 {
			t.Errorf("测评方式 %s 权重 = %v, want 25（等分）", mk, w)
		}
	}
}
