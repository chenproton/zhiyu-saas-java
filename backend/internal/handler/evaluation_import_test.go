package handler_test

import (
	"bytes"
	"context"
	"fmt"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/xuri/excelize/v2"
	"github.com/zhiyu-saas/backend/internal/handler"
	"github.com/zhiyu-saas/backend/internal/handler/testhelper"
	"github.com/zhiyu-saas/backend/internal/middleware"
)

func TestEvaluationImports(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()

	tenantID := testhelper.TestTenantID
	claims := &middleware.Claims{UserID: testhelper.TestOperatorID, TenantID: &tenantID}
	ctx := context.Background()

	// 1. import question bank
	bankFile := buildExcel(t, "题库基本信息", [][]interface{}{
		{"填写说明"},
		{"题库名称 *", "题库简介", "所属批次"},
		{"安全生产题库", "安全培训考核用", ""},
	})
	req := makeRequest(t, "/api/v1/import/question-banks/excel", bankFile, claims)
	hBank := &handler.QuestionBankImportHandler{Store: env.Store}
	w := httptest.NewRecorder()
	hBank.ImportExcel(w, req)
	if w.Code != 200 {
		t.Fatalf("bank import failed: %d %s", w.Code, w.Body.String())
	}

	var bankCount int
	env.DB.QueryRow(ctx, `SELECT COUNT(*) FROM question_banks WHERE tenant_id=$1`, tenantID).Scan(&bankCount)
	if bankCount != 1 {
		t.Fatalf("expected 1 bank, got %d", bankCount)
	}

	var bankID string
	env.DB.QueryRow(ctx, `SELECT id FROM question_banks WHERE tenant_id=$1 AND name=$2`, tenantID, "安全生产题库").Scan(&bankID)

	// 2. import questions
	questionFile := buildExcel(t, "题目明细", [][]interface{}{
		{"填写说明"},
		{"题型 *", "题目内容 *", "选项A", "选项B", "选项C", "选项D", "正确答案 *", "答案解析", "难度", "知识点", "分数", "来源"},
		{"单选题", "安全生产的第一责任人是？", "企业主要负责人", "安全员", "班组长", "员工", "A", "解析", "简单", "安全规范", "2", "Excel导入"},
	})
	req = makeRequest(t, fmt.Sprintf("/api/v1/import/question-banks/%s/questions/excel", bankID), questionFile, claims)
	rctx := chi.NewRouteContext()
	rctx.URLParams.Add("bankId", bankID)
	req = req.WithContext(context.WithValue(req.Context(), chi.RouteCtxKey, rctx))
	hQuestion := &handler.QuestionImportHandler{Store: env.Store}
	w = httptest.NewRecorder()
	hQuestion.ImportExcel(w, req)
	if w.Code != 200 {
		t.Fatalf("question import failed: %d %s", w.Code, w.Body.String())
	}

	var questionCount int
	env.DB.QueryRow(ctx, `SELECT COUNT(*) FROM questions WHERE tenant_id=$1 AND bank_id=$2`, tenantID, bankID).Scan(&questionCount)
	if questionCount != 1 {
		t.Fatalf("expected 1 question, got %d", questionCount)
	}

	// 3. import exam
	examFile := buildExcel(t, "试卷基本信息", [][]interface{}{
		{"填写说明"},
		{"试卷名称 *", "试卷简介", "所属批次"},
		{"安全知识期末考试", "期末考核", ""},
	})
	req = makeRequest(t, "/api/v1/import/exams/excel", examFile, claims)
	hExam := &handler.ExamImportHandler{Store: env.Store}
	w = httptest.NewRecorder()
	hExam.ImportExcel(w, req)
	if w.Code != 200 {
		t.Fatalf("exam import failed: %d %s", w.Code, w.Body.String())
	}

	var examCount int
	env.DB.QueryRow(ctx, `SELECT COUNT(*) FROM exams WHERE tenant_id=$1 AND name=$2`, tenantID, "安全知识期末考试").Scan(&examCount)
	if examCount != 1 {
		t.Fatalf("expected 1 exam, got %d", examCount)
	}
}

func buildExcel(t *testing.T, sheetName string, rows [][]interface{}) []byte {
	t.Helper()
	f := excelize.NewFile()
	f.DeleteSheet("Sheet1")
	f.NewSheet(sheetName)
	for ri, row := range rows {
		for ci, v := range row {
			cell, _ := excelize.CoordinatesToCellName(ci+1, ri+1)
			f.SetCellValue(sheetName, cell, v)
		}
	}
	var buf bytes.Buffer
	if err := f.Write(&buf); err != nil {
		t.Fatalf("write excel: %v", err)
	}
	return buf.Bytes()
}

func makeRequest(t *testing.T, path string, fileData []byte, claims *middleware.Claims) *http.Request {
	t.Helper()
	var body bytes.Buffer
	mw := multipart.NewWriter(&body)
	fw, _ := mw.CreateFormFile("file", uuid.NewString()+".xlsx")
	fw.Write(fileData)
	mw.Close()

	req := httptest.NewRequest("POST", path, &body)
	req.Header.Set("Content-Type", mw.FormDataContentType())
	return req.WithContext(context.WithValue(req.Context(), middleware.ContextKeyUser, claims))
}
