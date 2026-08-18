package handler_test

import (
	"bytes"
	"context"
	"net/http/httptest"
	"testing"

	"github.com/xuri/excelize/v2"
	"github.com/zhiyu-saas/backend/internal/handler"
	"github.com/zhiyu-saas/backend/internal/handler/testhelper"
	"github.com/zhiyu-saas/backend/internal/middleware"
	"github.com/zhiyu-saas/backend/internal/service"
)

// buildExcel2 构造多 Sheet 的 Excel 字节。
func buildExcel2(t *testing.T, sheets map[string][][]interface{}) []byte {
	t.Helper()
	f := excelize.NewFile()
	f.DeleteSheet("Sheet1")
	for name, rows := range sheets {
		f.NewSheet(name)
		for ri, row := range rows {
			for ci, v := range row {
				cell, _ := excelize.CoordinatesToCellName(ci+1, ri+1)
				f.SetCellValue(name, cell, v)
			}
		}
	}
	var buf bytes.Buffer
	if err := f.Write(&buf); err != nil {
		t.Fatalf("write excel: %v", err)
	}
	return buf.Bytes()
}

// TestCourseImportExcel 覆盖 service 下沉后的体系课导入主链路：
// 预览（不落库）→ 导入（落库 + 节点树创建），验证 HTTP 适配与业务编排分工正确。
func TestCourseImportExcel(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()

	tenantID := testhelper.TestTenantID
	claims := &middleware.Claims{UserID: testhelper.TestOperatorID, TenantID: &tenantID}
	ctx := context.Background()

	courseFile := buildExcel(t, "课程基本信息", [][]interface{}{
		{"填写说明"},
		{"课程名称 *", "所属专业", "课程简介", "所属批次", "能力点"},
		{"体系课导入验证", "", "自动化测试课程", "", ""},
	})

	h := &handler.CourseImportHandler{Svc: service.NewCourseImportService(service.New(env.Store))}

	// 1. 预览不落库
	req := makeRequest(t, "/api/v1/import/courses/excel/preview", courseFile, claims)
	w := httptest.NewRecorder()
	h.PreviewExcel(w, req)
	if w.Code != 200 {
		t.Fatalf("preview failed: %d %s", w.Code, w.Body.String())
	}
	var previewCount int
	env.DB.QueryRow(ctx, `SELECT COUNT(*) FROM courses WHERE tenant_id=$1 AND name=$2`, tenantID, "体系课导入验证").Scan(&previewCount)
	if previewCount != 0 {
		t.Fatalf("预览不应写库，实际 %d 条", previewCount)
	}

	// 2. 导入落库
	req = makeRequest(t, "/api/v1/import/courses/excel", courseFile, claims)
	w = httptest.NewRecorder()
	h.ImportExcel(w, req)
	if w.Code != 200 {
		t.Fatalf("import failed: %d %s", w.Code, w.Body.String())
	}

	var courseCount int
	env.DB.QueryRow(ctx, `SELECT COUNT(*) FROM courses WHERE tenant_id=$1 AND name=$2`, tenantID, "体系课导入验证").Scan(&courseCount)
	if courseCount != 1 {
		t.Fatalf("expected 1 course, got %d", courseCount)
	}

	// 3. 重复导入默认跳过（不改名不覆盖）
	req = makeRequest(t, "/api/v1/import/courses/excel", courseFile, claims)
	w = httptest.NewRecorder()
	h.ImportExcel(w, req)
	if w.Code != 200 {
		t.Fatalf("second import failed: %d %s", w.Code, w.Body.String())
	}
	var afterCount int
	env.DB.QueryRow(ctx, `SELECT COUNT(*) FROM courses WHERE tenant_id=$1 AND name=$2`, tenantID, "体系课导入验证").Scan(&afterCount)
	if afterCount != 1 {
		t.Fatalf("重复导入应跳过，实际 %d 条", afterCount)
	}
}

// TestCourseImportExcelWithNodes 覆盖「课程基本信息 + 节点配置」两级导入
// （课程创建后按课程名映射创建节点）。
func TestCourseImportExcelWithNodes(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()

	tenantID := testhelper.TestTenantID
	claims := &middleware.Claims{UserID: testhelper.TestOperatorID, TenantID: &tenantID}
	ctx := context.Background()

	file := buildExcel2(t, map[string][][]interface{}{
		"课程基本信息": {
			{"填写说明"},
			{"课程名称 *", "所属专业", "课程简介", "所属批次", "能力点"},
			{"体系课节点验证", "", "", "", ""},
		},
		"节点配置": {
			{"填写说明"},
			{"课程名称 *", "节点名称 *", "父节点", "类型", "排序", "学习目标", "课时", "难度", "知识点", "资源", "测评方式"},
			{"体系课节点验证", "第一章", "", "普通", "1", "", "2", "简单", "", "", ""},
			{"体系课节点验证", "第一章第一节", "第一章", "普通", "1", "", "1", "简单", "", "", ""},
		},
	})

	h := &handler.CourseImportHandler{Svc: service.NewCourseImportService(service.New(env.Store))}
	req := makeRequest(t, "/api/v1/import/courses/excel", file, claims)
	w := httptest.NewRecorder()
	h.ImportExcel(w, req)
	if w.Code != 200 {
		t.Fatalf("import failed: %d %s", w.Code, w.Body.String())
	}

	var nodeCount int
	env.DB.QueryRow(ctx, `SELECT COUNT(*) FROM system_course_nodes n
		JOIN courses c ON c.id = n.course_id
		WHERE c.tenant_id=$1 AND c.name=$2`, tenantID, "体系课节点验证").Scan(&nodeCount)
	if nodeCount != 2 {
		t.Fatalf("expected 2 nodes, got %d", nodeCount)
	}
}
