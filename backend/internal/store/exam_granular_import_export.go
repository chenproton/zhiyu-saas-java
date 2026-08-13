package store

import (
	"context"
	"fmt"
	"log/slog"
	"strings"
)

// 试卷/颗粒课导入导出与通用导入导出支撑：handler 层 SQL 下沉的唯一所在地。
// 全部方法接受 Queryer（*pgxpool.Pool / pgx.Tx / 事务内 Store），供导入事务复用；
// 标识符/表名动态拼接处保留原有白名单校验（SanitizeIdentifier）。

// ===== 试卷导出 =====

// GranularImportExamQuestionExportItem 试卷导出题目行。
type GranularImportExamQuestionExportItem struct {
	Content string
	Score   float64
}

// GranularImportListExamQuestionsForExport 查询试卷题目（导出用，限定租户，按 sort_order 排序）。
// 与原 handler 语义一致：单行扫描失败跳过该行，迭代尾部错误不阻断导出。
func GranularImportListExamQuestionsForExport(ctx context.Context, q Queryer, examID, tenantID string) ([]GranularImportExamQuestionExportItem, error) {
	rows, err := q.Query(ctx, `
		SELECT content, score
		FROM exam_questions
		WHERE exam_id=$1 AND tenant_id=$2
		ORDER BY sort_order
	`, examID, tenantID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := make([]GranularImportExamQuestionExportItem, 0)
	for rows.Next() {
		var it GranularImportExamQuestionExportItem
		if err := rows.Scan(&it.Content, &it.Score); err != nil {
			slog.Warn("导出试卷题目行扫描失败", "examId", examID, "error", err)
			continue
		}
		items = append(items, it)
	}
	return items, nil
}

// ===== 试卷导入 =====

// GranularImportFindExamByName 按租户+名称查找试卷（导入查重用），返回 id、创建者
// （NULL 归一为空串）与协作者列表；未命中或查询出错时 found=false。
func GranularImportFindExamByName(ctx context.Context, q Queryer, tenantID, name string) (id, creator string, collaborators []string, found bool) {
	err := q.QueryRow(ctx, `
		SELECT id, COALESCE(creator_id::text, '') AS creator_id, collaborator_ids
		FROM exams WHERE tenant_id=$1 AND name=$2 LIMIT 1
	`, tenantID, name).Scan(&id, &creator, &collaborators)
	return id, creator, collaborators, err == nil && id != ""
}

// GranularImportFindExamIDByName 按租户+名称查找试卷 ID（rename 候选名校验用）。
func GranularImportFindExamIDByName(ctx context.Context, q Queryer, tenantID, name string) (string, bool) {
	var id string
	err := q.QueryRow(ctx, `SELECT id FROM exams WHERE tenant_id=$1 AND name=$2 LIMIT 1`, tenantID, name).Scan(&id)
	return id, err == nil && id != ""
}

// GranularImportUpdateExamByImport 覆盖导入更新试卷名称/描述/批次（限定租户）。
func GranularImportUpdateExamByImport(ctx context.Context, q Queryer, name string, description, batchID *string, id, tenantID string) error {
	_, err := q.Exec(ctx, `
		UPDATE exams SET name=$1, description=$2, batch_id=$3, updated_at=NOW()
		WHERE id=$4 AND tenant_id=$5
	`, name, description, batchID, id, tenantID)
	return err
}

// GranularImportDeleteExamQuestions 清空试卷题目（覆盖导入重建前）。
func GranularImportDeleteExamQuestions(ctx context.Context, q Queryer, examID string) error {
	_, err := q.Exec(ctx, `DELETE FROM exam_questions WHERE exam_id=$1`, examID)
	return err
}

// GranularImportInsertExamByImport 导入创建试卷（draft/60 分钟/mine 归属）。
func GranularImportInsertExamByImport(ctx context.Context, q Queryer, id, tenantID, code, name string, description, batchID *string, userID string) error {
	_, err := q.Exec(ctx, `
		INSERT INTO exams (id, tenant_id, code, name, description, status, total_score, duration,
			batch_id, version, owner_type, creator_id, is_temp)
		VALUES ($1,$2,$3,$4,$5,'draft',0,60,$6,'V1.0','mine',$7,false)
	`, id, tenantID, code, name, description, batchID, userID)
	return err
}

// GranularImportImportQuestion 导入题目匹配结果。
type GranularImportImportQuestion struct {
	ID       string
	Type     string
	Content  string
	Options  []byte
	Answer   string
	Analysis string
}

// GranularImportFindQuestionByContent 按租户+题干查找题目（导入题目关联用）。
func GranularImportFindQuestionByContent(ctx context.Context, q Queryer, tenantID, content string) (*GranularImportImportQuestion, error) {
	var it GranularImportImportQuestion
	err := q.QueryRow(ctx, `
		SELECT id, type, content, options, answer, analysis
		FROM questions WHERE tenant_id=$1 AND content=$2 LIMIT 1
	`, tenantID, content).Scan(&it.ID, &it.Type, &it.Content, &it.Options, &it.Answer, &it.Analysis)
	if err != nil {
		return nil, err
	}
	return &it, nil
}

// GranularImportInsertExamQuestionByImport 导入写入试卷题目关联。
func GranularImportInsertExamQuestionByImport(ctx context.Context, q Queryer, id, examID, questionID, qtype, content string, options []byte, answer, analysis string, score float64, sortOrder int) error {
	_, err := q.Exec(ctx, `
		INSERT INTO exam_questions (id, exam_id, question_id, type, content, options, answer, analysis, score, sort_order)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
	`, id, examID, questionID, qtype, content, options, answer, analysis, score, sortOrder)
	return err
}

// ===== 颗粒课导出 =====

// GranularImportListCourseKnowledgePointNamesForExport 查询课程关联知识点名称（导出用，限定租户）。
// 单行扫描失败跳过该行，与原有导出容错语义一致。
func GranularImportListCourseKnowledgePointNamesForExport(ctx context.Context, q Queryer, courseID, tenantID string) ([]string, error) {
	rows, err := q.Query(ctx, `
		SELECT kp.name FROM knowledge_points kp
		JOIN course_knowledge_bindings cb ON cb.knowledge_point_id = kp.id
		WHERE cb.course_id=$1 AND cb.bind_type='course' AND cb.tenant_id=$2
		ORDER BY kp.name
	`, courseID, tenantID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	names := make([]string, 0)
	for rows.Next() {
		var n string
		if err := rows.Scan(&n); err != nil {
			slog.Warn("导出颗粒课知识点行扫描失败", "courseId", courseID, "error", err)
			continue
		}
		if n != "" {
			names = append(names, n)
		}
	}
	return names, nil
}

// GranularImportListCourseResourceNamesForExport 查询课程关联资源名称（导出用，限定租户）。
// 单行扫描失败跳过该行，与原有导出容错语义一致。
func GranularImportListCourseResourceNamesForExport(ctx context.Context, q Queryer, courseID, tenantID string) ([]string, error) {
	rows, err := q.Query(ctx, `
		SELECT r.name FROM resource_library r
		JOIN course_resource_bindings cb ON cb.resource_id = r.id
		WHERE cb.course_id=$1 AND cb.tenant_id=$2
		ORDER BY r.name
	`, courseID, tenantID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	names := make([]string, 0)
	for rows.Next() {
		var n string
		if err := rows.Scan(&n); err != nil {
			slog.Warn("导出颗粒课资源行扫描失败", "courseId", courseID, "error", err)
			continue
		}
		if n != "" {
			names = append(names, n)
		}
	}
	return names, nil
}

// ===== 颗粒课导入 =====

// GranularImportFindGranularCourseIdentity 按租户+名称查找颗粒课（type='granular'，导入查重用），
// 返回 id、创建者（NULL 归一为空串）与共建人列表；未命中或查询出错时 found=false。
func GranularImportFindGranularCourseIdentity(ctx context.Context, q Queryer, tenantID, name string) (id, creator string, coCreators []string, found bool) {
	err := q.QueryRow(ctx, `
		SELECT id, COALESCE(creator_id::text, '') AS creator_id, co_creator_ids
		FROM courses WHERE tenant_id=$1 AND name=$2 AND type='granular' LIMIT 1
	`, tenantID, name).Scan(&id, &creator, &coCreators)
	return id, creator, coCreators, err == nil && id != ""
}

// GranularImportFindGranularCourseIDByName 按租户+名称查找颗粒课 ID（rename 候选名校验用）。
func GranularImportFindGranularCourseIDByName(ctx context.Context, q Queryer, tenantID, name string) (string, bool) {
	var id string
	err := q.QueryRow(ctx, `SELECT id FROM courses WHERE tenant_id=$1 AND name=$2 AND type='granular' LIMIT 1`, tenantID, name).Scan(&id)
	return id, err == nil && id != ""
}

// GranularImportUpdateGranularCourseByImport 覆盖导入更新颗粒课（限定租户）。
func GranularImportUpdateGranularCourseByImport(ctx context.Context, q Queryer, id, tenantID string, majorID, batchID *string, difficulty *int, description *string, onlineHours *float64, knowledgePointIDs, resourceIDs []string) error {
	_, err := q.Exec(ctx, `
		UPDATE courses
		SET major_id=$3, batch_id=$4, difficulty=$5, description=$6, online_hours=$7,
			knowledge_point_ids=$8, resource_ids=$9, resource_count=COALESCE(array_length($9::uuid[], 1), 0), updated_at=NOW()
		WHERE id=$1 AND tenant_id=$2
	`, id, tenantID, majorID, batchID, difficulty, description, onlineHours, knowledgePointIDs, resourceIDs)
	return err
}

// GranularImportInsertGranularCourseByImport 导入创建颗粒课（draft/颗粒课分类/资源数按数组长度）。
func GranularImportInsertGranularCourseByImport(ctx context.Context, q Queryer, id, tenantID, code, name string, majorID *string, onlineHours *float64, difficulty *int, description *string, userID string, batchID *string, knowledgePointIDs, resourceIDs []string) error {
	_, err := q.Exec(ctx, `
		INSERT INTO courses (id, tenant_id, code, name, type, category, major_id, teacher_id, industry_id, version,
			online_hours, offline_hours, online_weight, offline_weight, semester, class_name,
			status, cover_color, cover_image, course_tag, difficulty, description, creator_id, co_creator_ids, batch_id,
			knowledge_point_ids, resource_ids, node_count, resource_count, study_count)
		VALUES ($1,$2,$3,$4,'granular','granular',$5,NULL,NULL,'V1.0',$6,0,0,0,NULL,NULL,
			'draft',NULL,NULL,NULL,$7,$8,$9,'{}',$10,$11,$12,0,COALESCE(array_length($12::uuid[], 1), 0),0)
	`, id, tenantID, code, name, majorID, onlineHours, difficulty, description, userID, batchID, knowledgePointIDs, resourceIDs)
	return err
}

// GranularImportDeleteCourseKnowledgeBindings 清空课程知识点绑定（覆盖导入重建前）。
func GranularImportDeleteCourseKnowledgeBindings(ctx context.Context, q Queryer, courseID string) error {
	_, err := q.Exec(ctx, `DELETE FROM course_knowledge_bindings WHERE course_id=$1 AND bind_type='course'`, courseID)
	return err
}

// GranularImportDeleteCourseResourceBindings 清空课程资源绑定（覆盖导入重建前）。
func GranularImportDeleteCourseResourceBindings(ctx context.Context, q Queryer, courseID string) error {
	_, err := q.Exec(ctx, `DELETE FROM course_resource_bindings WHERE course_id=$1`, courseID)
	return err
}

// GranularImportInsertCourseKnowledgeBinding 写入课程知识点绑定（冲突忽略）。
func GranularImportInsertCourseKnowledgeBinding(ctx context.Context, q Queryer, id, tenantID, courseID, knowledgePointID string) error {
	_, err := q.Exec(ctx, `
		INSERT INTO course_knowledge_bindings (id, tenant_id, course_id, knowledge_point_id, bind_type, source_id)
		VALUES ($1,$2,$3,$4,'course',NULL)
		ON CONFLICT (course_id, knowledge_point_id, bind_type, source_id) DO NOTHING
	`, id, tenantID, courseID, knowledgePointID)
	return err
}

// GranularImportInsertCourseResourceBinding 写入课程资源绑定（冲突忽略）。
func GranularImportInsertCourseResourceBinding(ctx context.Context, q Queryer, id, tenantID, courseID, resourceID string) error {
	_, err := q.Exec(ctx, `
		INSERT INTO course_resource_bindings (id, tenant_id, course_id, resource_id)
		VALUES ($1,$2,$3,$4)
		ON CONFLICT (course_id, resource_id) DO NOTHING
	`, id, tenantID, courseID, resourceID)
	return err
}

// GranularImportMaxGranularCourseCodeNum 查询租户指定年度颗粒课编号最大值（无记录/出错返回 0）。
func GranularImportMaxGranularCourseCodeNum(ctx context.Context, q Queryer, tenantID, year string) int {
	var maxNum int
	err := q.QueryRow(ctx, `
		SELECT COALESCE(MAX(substring(code from '^GRA-[0-9]{4}-([0-9]+)')::int), 0)
		FROM courses WHERE tenant_id=$1 AND code LIKE 'GRA-'||$2||'-%'
	`, tenantID, year).Scan(&maxNum)
	if err != nil {
		return 0
	}
	return maxNum
}

// ===== 通用导入导出（import_export_handler 支撑）=====

// GranularImportImportExportEntityConfig 通用导入导出实体元数据，SQL 字符串唯一所在地。
type GranularImportImportExportEntityConfig struct {
	displayName string
	keyCol      string
	insertSQL   string
	updateSQL   string
	// ownerCheckSQL 覆盖时归属检查（返回 creator_id/created_by + 共建人数组列）
	ownerCheckSQL string
	defaultCols   []string
}

var GranularImportImportExportEntities = map[string]GranularImportImportExportEntityConfig{
	"question_banks": {
		displayName: "题库",
		keyCol:      "name",
		insertSQL: `
			INSERT INTO question_banks (id, tenant_id, name, description, status, question_count, creator_id, version, owner_type, is_draft_pool)
			VALUES ($1, $2, $3, $4, 'draft', 0, $5, 'V1.0', 'tenant', FALSE)
		`,
		updateSQL:     `UPDATE question_banks SET name=$1, updated_at=NOW() WHERE id=$2`,
		ownerCheckSQL: `SELECT creator_id, '{}'::uuid[] FROM question_banks WHERE id=$1`,
		defaultCols:   []string{"id", "name", "description", "status", "created_at"},
	},
	"exams": {
		displayName: "试卷",
		keyCol:      "name",
		insertSQL: `
			INSERT INTO exams (id, tenant_id, name, description, status, total_score, duration, creator_id, version, owner_type)
			VALUES ($1, $2, $3, $4, 'draft', 0, 60, $5, 'V1.0', 'tenant')
		`,
		updateSQL:     `UPDATE exams SET name=$1, updated_at=NOW() WHERE id=$2`,
		ownerCheckSQL: `SELECT creator_id, '{}'::uuid[] FROM exams WHERE id=$1`,
		defaultCols:   []string{"id", "name", "description", "status", "created_at"},
	},
	"courses": {
		displayName: "课程",
		keyCol:      "code",
		insertSQL: `
			INSERT INTO courses (id, tenant_id, code, name, type, category, status, creator_id, co_creator_ids, node_count, resource_count, study_count)
			VALUES ($1, $2, $3, $4, 'system', '导入', 'draft', $5, '{}', 0, 0, 0)
		`,
		updateSQL:     `UPDATE courses SET name=$1, code=$2, updated_at=NOW() WHERE id=$3`,
		ownerCheckSQL: `SELECT creator_id, co_creator_ids FROM courses WHERE id=$1`,
		defaultCols:   []string{"id", "code", "name", "status", "created_at"},
	},
	"career_positions": {
		displayName: "岗位",
		keyCol:      "name",
		insertSQL: `
			INSERT INTO career_positions (id, tenant_id, name, short_name, position_type, status, created_by)
			VALUES ($1, $2, $3, $4, 'other', 'draft', $5)
		`,
		updateSQL:     `UPDATE career_positions SET name=$1, updated_at=NOW() WHERE id=$2`,
		ownerCheckSQL: `SELECT created_by, collaborators FROM career_positions WHERE id=$1`,
		defaultCols:   []string{"id", "name", "short_name", "status", "created_at"},
	},
	"scenarios": {
		displayName: "场景",
		keyCol:      "name",
		insertSQL: `
			INSERT INTO scenarios (id, tenant_id, name, code, status, created_by, collaborators, version)
			VALUES ($1, $2, $3, $4, 'draft', $5, '{}', 'V1.0')
		`,
		updateSQL:     `UPDATE scenarios SET name=$1, code=$2, updated_at=NOW() WHERE id=$3`,
		ownerCheckSQL: `SELECT created_by, collaborators FROM scenarios WHERE id=$1`,
		defaultCols:   []string{"id", "name", "code", "status", "created_at"},
	},
}

// GranularImportImportExportEntityMeta 通用导入导出实体业务元数据（不含 SQL，handler 只读）。
type GranularImportImportExportEntityMeta struct {
	DisplayName string
	KeyCol      string
	DefaultCols []string
}

// GranularImportImportExportEntity 返回实体业务元数据。
func GranularImportImportExportEntity(entity string) (GranularImportImportExportEntityMeta, bool) {
	e, ok := GranularImportImportExportEntities[entity]
	if !ok {
		return GranularImportImportExportEntityMeta{}, false
	}
	return GranularImportImportExportEntityMeta{DisplayName: e.displayName, KeyCol: e.keyCol, DefaultCols: e.defaultCols}, true
}

// GranularImportImportExportEntityNames 返回全部实体名（表名白名单）。
func GranularImportImportExportEntityNames() []string {
	names := make([]string, 0, len(GranularImportImportExportEntities))
	for k := range GranularImportImportExportEntities {
		names = append(names, k)
	}
	return names
}

// GranularImportImportExportEntityKeyColumns 返回去重后的业务主键列（列名白名单）。
func GranularImportImportExportEntityKeyColumns() []string {
	cols := make([]string, 0, len(GranularImportImportExportEntities))
	seen := make(map[string]bool)
	for _, meta := range GranularImportImportExportEntities {
		if !seen[meta.keyCol] {
			seen[meta.keyCol] = true
			cols = append(cols, meta.keyCol)
		}
	}
	return cols
}

// GranularImportExportImportExportRows 导出实体数据行：列集来自实体 defaultCols 白名单，
// 表名经白名单校验后拼接，查询结果按列序返回 [][]any（单行扫描失败跳过该行）。
func GranularImportExportImportExportRows(ctx context.Context, q Queryer, entity, tenantID string) ([][]any, error) {
	entity, err := SanitizeIdentifier(entity, GranularImportImportExportEntityNames())
	if err != nil {
		return nil, err
	}
	meta := GranularImportImportExportEntities[entity]
	cols := strings.Join(meta.defaultCols, ", ")
	rows, err := q.Query(ctx, fmt.Sprintf(`SELECT %s FROM %s WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 1000`, cols, entity), tenantID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	values := make([]any, len(meta.defaultCols))
	scanArgs := make([]any, len(meta.defaultCols))
	for i := range values {
		scanArgs[i] = &values[i]
	}
	out := make([][]any, 0)
	for rows.Next() {
		if err := rows.Scan(scanArgs...); err != nil {
			continue
		}
		record := make([]any, len(values))
		copy(record, values)
		out = append(out, record)
	}
	return out, nil
}

// GranularImportFindImportExportByKey 按实体+业务主键列查找记录 ID（表名与列名均经白名单校验）。
func GranularImportFindImportExportByKey(ctx context.Context, q Queryer, entity, tenantID, keyCol, key string) (string, bool) {
	entity, err := SanitizeIdentifier(entity, GranularImportImportExportEntityNames())
	if err != nil {
		return "", false
	}
	keyCol, err = SanitizeIdentifier(keyCol, GranularImportImportExportEntityKeyColumns())
	if err != nil {
		return "", false
	}
	var id string
	query := fmt.Sprintf("SELECT id FROM %s WHERE tenant_id=$1 AND %s=$2 LIMIT 1", entity, keyCol)
	err = q.QueryRow(ctx, query, tenantID, key).Scan(&id)
	return id, err == nil && id != ""
}

// GranularImportImportExportOwnerCheck 覆盖前归属检查：返回创建者与共建人数组。
// found=false 表示查询未命中/出错（与既有导入语义一致：查询失败不阻断覆盖流程）。
func GranularImportImportExportOwnerCheck(ctx context.Context, q Queryer, entity, id string) (creator string, coCreators []string, found bool) {
	meta, ok := GranularImportImportExportEntities[entity]
	if !ok || meta.ownerCheckSQL == "" {
		return "", nil, false
	}
	var creatorID *string
	var coCreatorIDs []string
	if err := q.QueryRow(ctx, meta.ownerCheckSQL, id).Scan(&creatorID, &coCreatorIDs); err != nil {
		return "", nil, false
	}
	if creatorID != nil {
		creator = *creatorID
	}
	return creator, coCreatorIDs, true
}

// GranularImportImportExportUpdate 覆盖更新实体（占位符数由各实体 updateSQL 决定：2 参仅 name / 3 参 name+code）。
func GranularImportImportExportUpdate(ctx context.Context, q Queryer, entity, name, code, id string) error {
	meta, ok := GranularImportImportExportEntities[entity]
	if !ok {
		return fmt.Errorf("不支持的实体: %s", entity)
	}
	args := []any{name}
	if strings.Count(meta.updateSQL, "$") == 3 {
		args = append(args, code)
	}
	args = append(args, id)
	_, err := q.Exec(ctx, meta.updateSQL, args...)
	return err
}

// GranularImportImportExportInsert 插入实体（固定 5 参：id, tenant_id, name, code, 创建者）。
func GranularImportImportExportInsert(ctx context.Context, q Queryer, entity, id, tenantID, name, code, userID string) error {
	meta, ok := GranularImportImportExportEntities[entity]
	if !ok {
		return fmt.Errorf("不支持的实体: %s", entity)
	}
	_, err := q.Exec(ctx, meta.insertSQL, id, tenantID, name, code, userID)
	return err
}
