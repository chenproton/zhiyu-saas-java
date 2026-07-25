package handler

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"strings"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/xuri/excelize/v2"
	"github.com/zhiyu-saas/backend/internal/middleware"
)

type QuestionBankImportHandler struct {
	DB *pgxpool.Pool
}

func (h *QuestionBankImportHandler) ImportExcel(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "permission denied")
		return
	}
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}
	userID := claims.UserID

	if err := r.ParseMultipartForm(50 << 20); err != nil {
		respondError(w, http.StatusBadRequest, "invalid form")
		return
	}
	file, _, err := r.FormFile("file")
	if err != nil {
		respondError(w, http.StatusBadRequest, "missing file")
		return
	}
	defer file.Close()

	xlsx, err := excelize.OpenReader(file)
	if err != nil {
		respondError(w, http.StatusBadRequest, "failed to parse Excel file")
		return
	}
	defer xlsx.Close()

	result := &questionBankImportResult{}
	h.importBanks(r.Context(), xlsx, tenantID, userID, result)

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"created": result.Created,
		"failed":  result.Failed,
		"entity":  "题库",
		"errors":  result.Errors,
	})
}

type questionBankImportResult struct {
	Created int
	Failed  int
	Errors  []string
}

func (h *QuestionBankImportHandler) importBanks(ctx context.Context, xlsx *excelize.File, tenantID, userID string, result *questionBankImportResult) {
	rows, err := xlsx.GetRows("题库基本信息")
	if err != nil {
		log.Printf("[import/question-banks] sheet '题库基本信息' not found: %v", err)
		return
	}

	for i, row := range rows {
		if i < 2 {
			continue
		}
		if len(row) < 1 || strings.TrimSpace(row[0]) == "" {
			continue
		}

		name := strings.TrimSpace(row[0])
		description := nullableStr(col(row, 1))
		coverImage := nullableStr(col(row, 2))
		collaboratorIDs := parseUUIDSlice(splitTrim(col(row, 3), ","))
		collaboratorDeptIDs := parseUUIDSlice(splitTrim(col(row, 4), ","))
		batchName := col(row, 5)
		knowledgeNames := splitTrim(col(row, 6), ",")

		batchID := h.lookupEvaluationBatch(ctx, tenantID, batchName)
		knowledgeIDs := h.findOrCreateKnowledgePoints(ctx, tenantID, knowledgeNames)

		bankID := uuid.NewString()
		_, err := h.DB.Exec(ctx, `
			INSERT INTO question_banks (id, tenant_id, name, description, cover_image, status, question_count, creator_id,
				collaborator_ids, collaborator_dept_ids, batch_id, version, owner_type, is_draft_pool)
			VALUES ($1,$2,$3,$4,$5,'draft',0,$6,$7,$8,$9,'v1.0','mine',false)
		`, bankID, tenantID, name, description, coverImage, userID, collaboratorIDs, collaboratorDeptIDs, batchID)
		if err != nil {
			result.Failed++
			msg := fmt.Sprintf("题库[%s]创建失败: %v", name, err)
			result.Errors = append(result.Errors, msg)
			log.Printf("[import/question-banks] %s", msg)
			continue
		}

		for _, kpID := range knowledgeIDs {
			if kpID == "" {
				continue
			}
			_, err := h.DB.Exec(ctx, `
				INSERT INTO question_bank_knowledge_points (id, question_bank_id, knowledge_point_id)
				VALUES ($1,$2,$3)
				ON CONFLICT (question_bank_id, knowledge_point_id) DO NOTHING
			`, uuid.NewString(), bankID, kpID)
			if err != nil {
				log.Printf("[import/question-banks] 题库[%s]知识点关联失败: %v", name, err)
			}
		}

		result.Created++
		log.Printf("[import/question-banks] created bank %s (id=%s)", name, bankID)
	}
}

func (h *QuestionBankImportHandler) lookupEvaluationBatch(ctx context.Context, tenantID, name string) *string {
	if name == "" {
		return nil
	}
	var id string
	err := h.DB.QueryRow(ctx, `SELECT id FROM evaluation_batches WHERE tenant_id=$1 AND name=$2 LIMIT 1`, tenantID, name).Scan(&id)
	if err != nil {
		return nil
	}
	return &id
}

func (h *QuestionBankImportHandler) findOrCreateKnowledgePoints(ctx context.Context, tenantID string, names []string) []string {
	ids := []string{}
	for _, name := range names {
		name = strings.TrimSpace(name)
		if name == "" {
			continue
		}
		var id string
		err := h.DB.QueryRow(ctx, `SELECT id FROM knowledge_points WHERE tenant_id=$1 AND name=$2 LIMIT 1`, tenantID, name).Scan(&id)
		if err == nil {
			ids = append(ids, id)
			continue
		}
		id = uuid.NewString()
		_, err = h.DB.Exec(ctx, `INSERT INTO knowledge_points (id, tenant_id, name) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`, id, tenantID, name)
		if err != nil {
			log.Printf("[import/question-banks] create knowledge point %s failed: %v", name, err)
		}
		var existing string
		err = h.DB.QueryRow(ctx, `SELECT id FROM knowledge_points WHERE tenant_id=$1 AND name=$2 LIMIT 1`, tenantID, name).Scan(&existing)
		if existing != "" {
			ids = append(ids, existing)
		} else if id != "" {
			ids = append(ids, id)
		}
	}
	return ids
}

func parseUUIDSlice(values []string) []string {
	result := []string{}
	for _, v := range values {
		v = strings.TrimSpace(v)
		if v == "" {
			continue
		}
		if _, err := uuid.Parse(v); err != nil {
			continue
		}
		result = append(result, v)
	}
	return result
}
