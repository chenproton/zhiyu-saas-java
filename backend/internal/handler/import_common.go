package handler

import (
	"fmt"
	"log/slog"
	"net/http"
	"strconv"
	"strings"

	"github.com/xuri/excelize/v2"
	"github.com/zhiyu-saas/backend/internal/middleware"
)

// ImportPreviewItem 单条重复记录预览信息。
type ImportPreviewItem struct {
	RowNum int    `json:"rowNum"`
	Key    string `json:"key"`  // 业务主键值
	Name   string `json:"name"` // 显示名称
}

// ImportPreviewResult 导入 preview 接口统一返回结构。
type ImportPreviewResult struct {
	Created        int                 `json:"created"`
	Duplicates     int                 `json:"duplicates"`
	Failed         int                 `json:"failed"`
	DuplicateItems []ImportPreviewItem `json:"duplicateItems"`
	Errors         []string            `json:"errors"`
}

// ImportExecuteResult 导入执行接口的基础返回结构，各 handler 可在此基础上扩展。
type ImportExecuteResult struct {
	Created int      `json:"created"`
	Failed  int      `json:"failed"`
	Skipped int      `json:"skipped"`
	Entity  string   `json:"entity"`
	Errors  []string `json:"errors"`
}

// importOverwriteParam 从请求中获取是否覆盖已存在数据的标识。
func importOverwriteParam(r *http.Request) bool {
	return r.URL.Query().Get("overwrite") == "true"
}

// col 安全读取 Excel 行中的列值，越界时返回空字符串。
func col(row []string, idx int) string {
	if idx < len(row) {
		return strings.TrimSpace(row[idx])
	}
	return ""
}

// splitTrim 按分隔符拆分字符串并去除空白，空项被忽略。
func splitTrim(s, sep string) []string {
	if s == "" {
		return nil
	}
	parts := strings.Split(s, sep)
	var result []string
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if p != "" {
			result = append(result, p)
		}
	}
	return result
}

// parseNullableInt 将字符串解析为整数，空或无效时返回 nil。
func parseNullableInt(s string) *int {
	s = strings.TrimSpace(s)
	if s == "" {
		return nil
	}
	v, err := strconv.Atoi(s)
	if err != nil {
		return nil
	}
	return &v
}

// parseNullableFloat 将字符串解析为浮点数，空或无效时返回 nil。
func parseNullableFloat(s string) *float64 {
	s = strings.TrimSpace(s)
	if s == "" {
		return nil
	}
	v, err := strconv.ParseFloat(s, 64)
	if err != nil {
		return nil
	}
	return &v
}

// nullableStr 去除空白后，空字符串返回 nil。
func nullableStr(s string) *string {
	s = strings.TrimSpace(s)
	if s == "" {
		return nil
	}
	return &s
}

// parseIntDefault 将字符串解析为整数，空或无效时返回默认值。
func parseIntDefault(s string, defaultVal int) int {
	s = strings.TrimSpace(s)
	if s == "" {
		return defaultVal
	}
	v, err := strconv.Atoi(s)
	if err != nil {
		return defaultVal
	}
	return v
}

// parseUploadedExcel parses the multipart form and opens the uploaded Excel file.
func parseUploadedExcel(r *http.Request) (*excelize.File, []string, error) {
	if err := r.ParseMultipartForm(50 << 20); err != nil {
		return nil, nil, fmt.Errorf("表单数据无效")
	}
	file, _, err := r.FormFile("file")
	if err != nil {
		return nil, nil, fmt.Errorf("缺少上传文件")
	}
	defer file.Close()

	xlsx, err := excelize.OpenReader(file)
	if err != nil {
		return nil, nil, fmt.Errorf("解析 Excel 文件失败")
	}
	sheets := xlsx.GetSheetList()
	return xlsx, sheets, nil
}

// parseUploadedExcels parses the multipart form and opens all uploaded Excel files.
func parseUploadedExcels(r *http.Request) ([]*excelize.File, [][]string, error) {
	if err := r.ParseMultipartForm(200 << 20); err != nil {
		return nil, nil, fmt.Errorf("表单数据无效")
	}
	fhs := r.MultipartForm.File["file"]
	if len(fhs) == 0 {
		return nil, nil, fmt.Errorf("缺少上传文件")
	}
	xlsxs := make([]*excelize.File, 0, len(fhs))
	sheetsList := make([][]string, 0, len(fhs))
	for _, fh := range fhs {
		f, err := fh.Open()
		if err != nil {
			return nil, nil, fmt.Errorf("打开文件 %s 失败", fh.Filename)
		}
		xlsx, err := excelize.OpenReader(f)
		f.Close()
		if err != nil {
			return nil, nil, fmt.Errorf("解析 Excel 文件 %s 失败", fh.Filename)
		}
		xlsxs = append(xlsxs, xlsx)
		sheetsList = append(sheetsList, xlsx.GetSheetList())
	}
	return xlsxs, sheetsList, nil
}

// MultiFileUpload 封装多文件上传的通用处理：解析、遍历、关闭、Sheet 列表。
type MultiFileUpload struct {
	Files  []*excelize.File
	sheets [][]string
}

// ParseMultiFileUpload 解析请求中的所有上传 Excel 文件。
func ParseMultiFileUpload(r *http.Request) (*MultiFileUpload, error) {
	xlsxs, sheetsList, err := parseUploadedExcels(r)
	if err != nil {
		return nil, err
	}
	return &MultiFileUpload{Files: xlsxs, sheets: sheetsList}, nil
}

// ForEach 遍历所有文件，依次调用 fn，并在每次调用后关闭文件。
func (m *MultiFileUpload) ForEach(fn func(*excelize.File)) {
	for _, f := range m.Files {
		fn(f)
		f.Close()
	}
}

// FirstSheets 返回第一个文件的 Sheet 名称列表，无文件时返回 nil。
func (m *MultiFileUpload) FirstSheets() []string {
	if len(m.sheets) > 0 {
		return m.sheets[0]
	}
	return nil
}

// importRequestContext bundles parsed auth and multi-file data from an import request.
type importRequestContext struct {
	Claims    *middleware.Claims
	TenantID  string
	UserID    string
	Overwrite bool
	MFU       *MultiFileUpload
}

// parseMultiImportRequest handles auth, tenant, and multi-file form parsing.
// Writes error response and returns nil on any failure.
func parseMultiImportRequest(w http.ResponseWriter, r *http.Request, requirePortalAdmin bool) *importRequestContext {
	claims := middleware.CurrentUser(r)
	if claims == nil || (requirePortalAdmin && !canManagePortal(claims)) {
		respondError(w, http.StatusForbidden, "权限不足")
		return nil
	}
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return nil
	}
	mfu, err := ParseMultiFileUpload(r)
	if err != nil {
		slog.Error("导入文件解析失败", "error", err)
		respondError(w, http.StatusBadRequest, "导入文件解析失败")
		return nil
	}
	return &importRequestContext{
		Claims:    claims,
		TenantID:  tenantID,
		UserID:    claims.UserID,
		Overwrite: importOverwriteParam(r),
		MFU:       mfu,
	}
}
