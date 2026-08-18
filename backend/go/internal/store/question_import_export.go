package store

import (
	"context"
)

// ===== 题库/题目 导入导出 store 方法（SQL 唯一所在地，handler 层不拼 SQL） =====
// 全部方法接受 Queryer（*pgxpool.Pool / pgx.Tx / 事务内 Store），SQL 原样自
// question_bank_export_handler / question_bank_import_handler / question_export_handler /
// question_import_handler 下沉，参数化、租户条件与错误语义保持不变。

// GetQuestionBankForExport 导出题库行：名称、描述（空串兜底）、批次 ID（限定租户）。
func GetQuestionBankForExport(ctx context.Context, q Queryer, bankID, tenantID string) (name, desc string, batchID *string, err error) {
	err = q.QueryRow(ctx, `
		SELECT name, COALESCE(description,''), batch_id
		FROM question_banks WHERE id=$1 AND tenant_id=$2
	`, bankID, tenantID).Scan(&name, &desc, &batchID)
	return
}

// GetEvaluationBatchNameByID 按批次 ID 查询批次名称，未命中返回空字符串。
func GetEvaluationBatchNameByID(ctx context.Context, q Queryer, batchID string) (string, error) {
	var name string
	err := q.QueryRow(ctx, `SELECT name FROM evaluation_batches WHERE id=$1`, batchID).Scan(&name)
	return name, err
}

// FindQuestionBankByTenantName 导入查重：按租户+名称查询题库 ID/创建者/协作者
// （未命中返回 pgx.ErrNoRows，错误语义与 handler 原判断一致）。
func FindQuestionBankByTenantName(ctx context.Context, q Queryer, tenantID, name string) (id, creatorID string, collaborators []string, err error) {
	err = q.QueryRow(ctx, `
		SELECT id, COALESCE(creator_id::text, '') AS creator_id, collaborator_ids
		FROM question_banks WHERE tenant_id=$1 AND name=$2 LIMIT 1
	`, tenantID, name).Scan(&id, &creatorID, &collaborators)
	return
}

// UpdateQuestionBankImport 覆盖导入：更新题库名称/描述/批次（限定租户，纵深防御）。
func UpdateQuestionBankImport(ctx context.Context, q Queryer, tenantID, name string, description, batchID *string, id string) error {
	_, err := q.Exec(ctx, `
		UPDATE question_banks SET name=$1, description=$2, batch_id=$3 WHERE id=$4 AND tenant_id=$5
	`, name, description, batchID, id, tenantID)
	return err
}

// GetQuestionBankIDByTenantName 按租户+名称查询题库 ID（导入重名加后缀时判重）。
func GetQuestionBankIDByTenantName(ctx context.Context, q Queryer, tenantID, name string) (string, error) {
	var id string
	err := q.QueryRow(ctx, `SELECT id FROM question_banks WHERE tenant_id=$1 AND name=$2 LIMIT 1`, tenantID, name).Scan(&id)
	return id, err
}

// InsertQuestionBankImport 导入创建题库（草稿状态，题目数 0，版本 V1.0，非草稿池）。
func InsertQuestionBankImport(ctx context.Context, q Queryer, bankID, tenantID, code, name string, description *string, userID string, batchID *string) error {
	_, err := q.Exec(ctx, `
		INSERT INTO question_banks (id, tenant_id, code, name, description, status, question_count, creator_id,
			batch_id, version, owner_type, is_draft_pool)
		VALUES ($1,$2,$3,$4,$5,'draft',0,$6,$7,'V1.0','mine',false)
	`, bankID, tenantID, code, name, description, userID, batchID)
	return err
}

// GetQuestionBankIDScoped 校验题库存在性（限定租户），返回题库 ID。
func GetQuestionBankIDScoped(ctx context.Context, q Queryer, bankID, tenantID string) (string, error) {
	var id string
	err := q.QueryRow(ctx, `SELECT id FROM question_banks WHERE id=$1 AND tenant_id=$2`, bankID, tenantID).Scan(&id)
	return id, err
}

// GetKnowledgePointNameByID 按知识点 ID+租户查询名称（题目导出用）。
func GetKnowledgePointNameByID(ctx context.Context, q Queryer, id, tenantID string) (string, error) {
	var name string
	err := q.QueryRow(ctx, `SELECT name FROM knowledge_points WHERE id=$1 AND tenant_id=$2`, id, tenantID).Scan(&name)
	return name, err
}

// FindQuestionByTenantBankContent 导入查重：按租户+题库+题干查询题目 ID/创建者
// （未命中返回 pgx.ErrNoRows，错误语义与 handler 原判断一致）。
func FindQuestionByTenantBankContent(ctx context.Context, q Queryer, tenantID, bankID, content string) (id, creatorID string, err error) {
	err = q.QueryRow(ctx, `
		SELECT id, COALESCE(creator_id::text, '') AS creator_id
		FROM questions WHERE tenant_id=$1 AND bank_id=$2 AND content=$3 LIMIT 1
	`, tenantID, bankID, content).Scan(&id, &creatorID)
	return
}

// UpdateQuestionImport 覆盖导入：更新题目类型/选项/答案/解析/分值/难度/知识点（不更新题干；限定租户，纵深防御）。
func UpdateQuestionImport(ctx context.Context, q Queryer, tenantID, qType, options, answer string, analysis *string, score float64, difficulty *string, knowledgePointIDs []string, id string) error {
	_, err := q.Exec(ctx, `
		UPDATE questions SET type=$1, options=$2, answer=$3, analysis=$4, score=$5, difficulty=$6, knowledge_point_ids=$7
		WHERE id=$8 AND tenant_id=$9
	`, qType, options, answer, analysis, score, difficulty, knowledgePointIDs, id, tenantID)
	return err
}

// GetQuestionIDByTenantBankContent 按租户+题库+题干查询题目 ID（导入重名加后缀时判重）。
func GetQuestionIDByTenantBankContent(ctx context.Context, q Queryer, tenantID, bankID, content string) (string, error) {
	var id string
	err := q.QueryRow(ctx, `SELECT id FROM questions WHERE tenant_id=$1 AND bank_id=$2 AND content=$3 LIMIT 1`, tenantID, bankID, content).Scan(&id)
	return id, err
}

// InsertQuestionImport 导入创建题目（草稿状态）。
func InsertQuestionImport(ctx context.Context, q Queryer, questionID, tenantID, code, bankID, qType, content, options, answer string, analysis *string, score float64, difficulty *string, knowledgePointIDs []string, userID, source string) error {
	_, err := q.Exec(ctx, `
		INSERT INTO questions (id, tenant_id, code, bank_id, type, content, options, answer, analysis, score, difficulty, knowledge_point_ids, creator_id, source, status)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'draft')
	`, questionID, tenantID, code, bankID, qType, content, options, answer, analysis, score, difficulty, knowledgePointIDs, userID, source)
	return err
}
