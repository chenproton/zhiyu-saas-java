package handler

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/xuri/excelize/v2"
	"github.com/zhiyu-saas/backend/internal/middleware"
)

type ExamExportHandler struct {
	DB *pgxpool.Pool
}

func (h *ExamExportHandler) ExportExcel(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}

	ids, ok := decodeIDList(w, r, "缺少试卷ID")
	if !ok {
		return
	}

	ctx := r.Context()
	th := &TemplateHandler{DB: h.DB}
	f := th.generateExamTemplate(ctx, tenantID)

	if err := h.fillExamsData(ctx, f, tenantID, ids); err != nil {
		respondError(w, http.StatusInternalServerError, "填充export data失败")
		return
	}

	writeExcel(w, f, "试卷导出.xlsx")
}

func (h *ExamExportHandler) fillExamsData(ctx context.Context, f *excelize.File, tenantID string, examIDs []string) error {
	setCell := newSetCell(f)

	examNameMap := make(map[string]string)

	for ri, eid := range examIDs {
		var name, desc string
		var batchID *string
		err := h.DB.QueryRow(ctx, `
			SELECT name, COALESCE(description,''), batch_id
			FROM exams WHERE id=$1 AND tenant_id=$2
		`, eid, tenantID).Scan(&name, &desc, &batchID)
		if err != nil {
			slog.Warn("导出试卷行跳过", "examId", eid, "error", err)
			continue
		}
		examNameMap[eid] = name

		batchName := ""
		if batchID != nil && *batchID != "" {
			if err := h.DB.QueryRow(ctx, `SELECT name FROM evaluation_batches WHERE id=$1`, *batchID).Scan(&batchName); err != nil {
				slog.Warn("导出试卷批次名查询失败", "batchId", *batchID, "error", err)
			}
		}

		r := 3 + ri
		setCell("试卷基本信息", fmt.Sprintf("A%d", r), name)
		setCell("试卷基本信息", fmt.Sprintf("B%d", r), desc)
		setCell("试卷基本信息", fmt.Sprintf("C%d", r), batchName)
		f.SetRowHeight("试卷基本信息", r, 24)
	}

	questionRow := 3
	for _, eid := range examIDs {
		examName := examNameMap[eid]
		if examName == "" {
			continue
		}

		rows, err := h.DB.Query(ctx, `
			SELECT content, score
			FROM exam_questions
			WHERE exam_id=$1 AND tenant_id=$2
			ORDER BY sort_order
		`, eid, tenantID)
		if err != nil {
			slog.Warn("导出试卷题目查询失败", "examId", eid, "error", err)
			continue
		}
		for rows.Next() {
			var content string
			var score float64
			if err := rows.Scan(&content, &score); err != nil {
				slog.Warn("导出试卷题目行扫描失败", "examId", eid, "error", err)
				continue
			}

			setCell("试卷题目", fmt.Sprintf("A%d", questionRow), examName)
			setCell("试卷题目", fmt.Sprintf("B%d", questionRow), content)
			setCell("试卷题目", fmt.Sprintf("C%d", questionRow), fmt.Sprintf("%.2f", score))
			f.SetRowHeight("试卷题目", questionRow, 24)
			questionRow++
		}
		rows.Close()
	}

	return nil
}
