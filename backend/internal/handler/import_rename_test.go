package handler_test

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/google/uuid"
	"github.com/zhiyu-saas/backend/internal/handler"
	"github.com/zhiyu-saas/backend/internal/handler/testhelper"
	"github.com/zhiyu-saas/backend/internal/middleware"
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
	hBank := &handler.QuestionBankImportHandler{DB: env.DB}

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
	hExam := &handler.ExamImportHandler{DB: env.DB}

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
