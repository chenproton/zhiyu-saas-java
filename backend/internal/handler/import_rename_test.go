package handler_test

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/google/uuid"
	"github.com/zhiyu-saas/backend/internal/handler"
	"github.com/zhiyu-saas/backend/internal/handler/testhelper"
	"github.com/zhiyu-saas/backend/internal/middleware"
	"github.com/zhiyu-saas/backend/internal/service"
)

// TestImportRenameMode_Excel 验证 Excel 导入的 rename 模式（题库/试卷）：
// 重名记录追加 4 位随机数字后缀后按新对象导入，不覆盖、不跳过。
func TestImportRenameMode_Excel(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()

	tenantID := testhelper.TestTenantID
	claims := &middleware.Claims{UserID: testhelper.TestOperatorID, TenantID: &tenantID}
	ctx := context.Background()

	// ---- 题库：rename 模式 ----
	bankPrefix := fmt.Sprintf("重命名题库-%s", uuid.NewString()[:6])
	bankFile := buildExcel(t, "题库基本信息", [][]interface{}{
		{"填写说明"},
		{"题库名称 *", "题库简介", "所属批次"},
		{bankPrefix, "重名测试", ""},
	})
	hBank := &handler.QuestionBankImportHandler{Store: env.Store}

	req := makeRequest(t, "/api/v1/import/question-banks/excel", bankFile, claims)
	w := httptest.NewRecorder()
	hBank.ImportExcel(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("first import: %d %s", w.Code, w.Body.String())
	}

	req = makeRequest(t, "/api/v1/import/question-banks/excel?rename=true", bankFile, claims)
	w = httptest.NewRecorder()
	hBank.ImportExcel(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("rename import: %d %s", w.Code, w.Body.String())
	}

	var bankCount int
	env.DB.QueryRow(ctx, `SELECT COUNT(*) FROM question_banks WHERE tenant_id=$1 AND (name=$2 OR name LIKE $3)`, tenantID, bankPrefix, bankPrefix+"-%").Scan(&bankCount)
	if bankCount != 2 {
		t.Fatalf("rename mode: expected 2 banks, got %d", bankCount)
	}
	var renamedBank string
	if err := env.DB.QueryRow(ctx, `SELECT name FROM question_banks WHERE tenant_id=$1 AND name LIKE $2`, tenantID, bankPrefix+"-%").Scan(&renamedBank); err != nil {
		t.Fatalf("rename mode: suffixed bank not found: %v", err)
	}
	if !strings.HasPrefix(renamedBank, bankPrefix+"-") {
		t.Fatalf("rename mode: unexpected bank name %q", renamedBank)
	}

	// ---- 试卷：rename 模式 ----
	examPrefix := fmt.Sprintf("重命名试卷-%s", uuid.NewString()[:6])
	examFile := buildExcel(t, "试卷基本信息", [][]interface{}{
		{"填写说明"},
		{"试卷名称 *", "试卷简介", "所属批次"},
		{examPrefix, "重名测试", ""},
	})
	hExam := &handler.ExamImportHandler{Svc: service.NewExamImportService(service.New(env.Store))}

	req = makeRequest(t, "/api/v1/import/exams/excel", examFile, claims)
	w = httptest.NewRecorder()
	hExam.ImportExcel(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("exam first import: %d %s", w.Code, w.Body.String())
	}

	req = makeRequest(t, "/api/v1/import/exams/excel?rename=true", examFile, claims)
	w = httptest.NewRecorder()
	hExam.ImportExcel(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("exam rename import: %d %s", w.Code, w.Body.String())
	}

	var examCount int
	env.DB.QueryRow(ctx, `SELECT COUNT(*) FROM exams WHERE tenant_id=$1 AND (name=$2 OR name LIKE $3)`, tenantID, examPrefix, examPrefix+"-%").Scan(&examCount)
	if examCount != 2 {
		t.Fatalf("rename mode: expected 2 exams, got %d", examCount)
	}
}

// TestImportOverwritePermission 验证覆盖模式的权限校验：
// 非本人创建且未参与共建的对象跳过覆盖（permissionSkipped 计数），
// 本人创建的对象正常覆盖，互不影响。
func TestImportOverwritePermission(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()

	tenantID := testhelper.TestTenantID
	userA := &middleware.Claims{UserID: testhelper.TestOperatorID, TenantID: &tenantID}
	userB := &middleware.Claims{UserID: uuid.NewString(), TenantID: &tenantID}
	ctx := context.Background()
	bankName := fmt.Sprintf("权限覆盖测试-%s", uuid.NewString()[:6])

	fileData := buildExcel(t, "题库基本信息", [][]interface{}{
		{"填写说明"},
		{"题库名称 *", "题库简介", "所属批次"},
		{bankName, "权限测试", ""},
	})

	h := &handler.QuestionBankImportHandler{Store: env.Store}

	// 用户 A 创建题库
	req := makeRequest(t, "/api/v1/import/question-banks/excel", fileData, userA)
	w := httptest.NewRecorder()
	h.ImportExcel(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("create import: %d %s", w.Code, w.Body.String())
	}

	// 用户 B 覆盖导入同名题库：无权限 → permissionSkipped=1，题库不被更新
	req = makeRequest(t, "/api/v1/import/question-banks/excel?overwrite=true", fileData, userB)
	w = httptest.NewRecorder()
	h.ImportExcel(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("permission import: %d %s", w.Code, w.Body.String())
	}
	var resp struct {
		Created           int `json:"created"`
		PermissionSkipped int `json:"permissionSkipped"`
	}
	if err := json.NewDecoder(w.Body).Decode(&resp); err != nil {
		t.Fatalf("decode permission response: %v", err)
	}
	if resp.Created != 0 || resp.PermissionSkipped != 1 {
		t.Fatalf("permission skip: created=%d permissionSkipped=%d; want 0/1", resp.Created, resp.PermissionSkipped)
	}
	var desc string
	if err := env.DB.QueryRow(ctx, `SELECT COALESCE(description,'') FROM question_banks WHERE tenant_id=$1 AND name=$2`, tenantID, bankName).Scan(&desc); err != nil {
		t.Fatalf("query bank after skip: %v", err)
	}
	if desc != "权限测试" {
		t.Fatalf("bank should not be overwritten by user B, got description %q", desc)
	}

	// 用户 A 覆盖导入同名题库：本人创建 → 正常覆盖
	fileData2 := buildExcel(t, "题库基本信息", [][]interface{}{
		{"填写说明"},
		{"题库名称 *", "题库简介", "所属批次"},
		{bankName, "权限测试-已更新", ""},
	})
	req = makeRequest(t, "/api/v1/import/question-banks/excel?overwrite=true", fileData2, userA)
	w = httptest.NewRecorder()
	h.ImportExcel(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("owner overwrite import: %d %s", w.Code, w.Body.String())
	}
	if err := json.NewDecoder(w.Body).Decode(&resp); err != nil {
		t.Fatalf("decode owner response: %v", err)
	}
	if resp.PermissionSkipped != 0 || resp.Created != 1 {
		t.Fatalf("owner overwrite: created=%d permissionSkipped=%d; want 1/0", resp.Created, resp.PermissionSkipped)
	}
	if err := env.DB.QueryRow(ctx, `SELECT COALESCE(description,'') FROM question_banks WHERE tenant_id=$1 AND name=$2`, tenantID, bankName).Scan(&desc); err != nil {
		t.Fatalf("query bank after owner overwrite: %v", err)
	}
	if desc != "权限测试-已更新" {
		t.Fatalf("bank should be overwritten by owner, got description %q", desc)
	}
}
