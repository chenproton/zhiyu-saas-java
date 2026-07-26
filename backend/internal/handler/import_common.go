package handler

import (
	"net/http"
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
