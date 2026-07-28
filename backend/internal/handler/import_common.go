package handler

import (
	"net/http"
	"strconv"
	"strings"
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
