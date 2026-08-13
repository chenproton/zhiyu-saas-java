package store

import (
	"context"
	"strings"

	"github.com/google/uuid"
	"github.com/zhiyu-saas/backend/internal/domain"
)

// 课程导入/导出支撑：course_import / course_export / program_course_import handler 的
// 查询与写入操作，SQL 唯一所在地。全部方法接受 Queryer（*pgxpool.Pool / pgx.Tx），
// 供导入事务复用（风格与 imports.go 一致）。

// CourseImportCourseAbilityPointNames 查询课程关联能力点名称，逗号分隔（导出用）。
// 先取 courses.ability_point_ids，再批量查名称，避免逐 id 单条 QueryRow（N+1）。
func CourseImportCourseAbilityPointNames(ctx context.Context, q Queryer, courseID string) string {
	var abilityPointIDs []string
	err := q.QueryRow(ctx, `
		SELECT ARRAY(SELECT unnest(ability_point_ids)::text)
		FROM courses WHERE id=$1
	`, courseID).Scan(&abilityPointIDs)
	if err != nil || len(abilityPointIDs) == 0 {
		return ""
	}
	var names []string
	rows, err := q.Query(ctx, `
		SELECT name FROM ability_points WHERE id = ANY($1::uuid[]) ORDER BY name
	`, abilityPointIDs)
	if err != nil {
		return ""
	}
	defer rows.Close()
	for rows.Next() {
		var n string
		if err := rows.Scan(&n); err != nil {
			return strings.Join(names, ",")
		}
		if n != "" {
			names = append(names, n)
		}
	}
	return strings.Join(names, ",")
}

// CourseImportSystemCourseIdentity 体系课查重所需的身份信息。
type CourseImportSystemCourseIdentity struct {
	ID           string
	CreatorID    string
	CoCreatorIDs []string
}

// CourseImportFindSystemCourseIdentity 按租户+名称查找同名体系课（type='system'），
// 返回创建者与协作者信息供覆盖权限判断；未命中返回 pgx.ErrNoRows。
func CourseImportFindSystemCourseIdentity(ctx context.Context, q Queryer, tenantID, name string) (CourseImportSystemCourseIdentity, error) {
	var out CourseImportSystemCourseIdentity
	err := q.QueryRow(ctx, `
		SELECT id, COALESCE(creator_id::text, '') AS creator_id, co_creator_ids
		FROM courses WHERE tenant_id=$1 AND name=$2 AND type='system' LIMIT 1
	`, tenantID, name).Scan(&out.ID, &out.CreatorID, &out.CoCreatorIDs)
	return out, err
}

// CourseImportSystemCourseIDByName 按租户+名称查找体系课 ID，未命中返回空串（rename 去重用）。
func CourseImportSystemCourseIDByName(ctx context.Context, q Queryer, tenantID, name string) string {
	var eid string
	_ = q.QueryRow(ctx, `
		SELECT id FROM courses WHERE tenant_id=$1 AND name=$2 AND type='system' LIMIT 1
	`, tenantID, name).Scan(&eid)
	return eid
}

// CourseImportUpdateSystemCourseOverwrite 覆盖模式更新体系课基本信息。
func CourseImportUpdateSystemCourseOverwrite(ctx context.Context, q Queryer, id, tenantID string, majorID, batchID *string, description *string, abilityPointIDs []string) error {
	_, err := q.Exec(ctx, `
		UPDATE courses
		SET major_id=$3, batch_id=$4, description=$5, ability_point_ids=$6, updated_at=NOW()
		WHERE id=$1 AND tenant_id=$2
	`, id, tenantID, majorID, batchID, description, abilityPointIDs)
	return err
}

// CourseImportCourseParams 体系课导入创建参数。
type CourseImportCourseParams struct {
	TenantID        string
	Name            string
	MajorID         *string
	BatchID         *string
	Description     *string
	AbilityPointIDs []string
	CreatorID       string
}

// CourseImportCreateImportedSystemCourse 创建体系课（type='system'），返回新课程 ID。
func CourseImportCreateImportedSystemCourse(ctx context.Context, q Queryer, p CourseImportCourseParams) (string, error) {
	courseID := uuid.NewString()
	code := GenerateEntityCode("XT")
	_, err := q.Exec(ctx, `
		INSERT INTO courses (id, tenant_id, code, name, type, category, major_id, teacher_id, industry_id, version,
			online_hours, offline_hours, online_weight, offline_weight, semester, class_name,
			status, cover_color, cover_image, course_tag, difficulty, description, creator_id, co_creator_ids, batch_id,
			ability_point_ids, node_count, resource_count, study_count)
		VALUES ($1,$2,$3,$4,'system','system',$5,NULL,NULL,'V1.0',0,0,0,0,NULL,NULL,
			'draft',NULL,NULL,NULL,NULL,$8,$6,'{}',$7,$9,0,0,0)
	`, courseID, p.TenantID, code, p.Name, p.MajorID, p.CreatorID, p.BatchID, p.Description, p.AbilityPointIDs)
	if err != nil {
		return "", err
	}
	return courseID, nil
}

// CourseImportCourseNodeParams 体系课节点导入创建参数。
type CourseImportCourseNodeParams struct {
	TenantID      string
	CourseID      string
	ParentID      *string
	Name          string
	SortOrder     int
	RefType       string
	SourceID      *string
	SourceName    *string
	TeachingGoals *string
	Duration      int
	Difficulty    int
}

// CourseImportCreateImportedCourseNode 创建体系课节点（导入用），返回新节点 ID。
func CourseImportCreateImportedCourseNode(ctx context.Context, q Queryer, p CourseImportCourseNodeParams) (string, error) {
	nodeID := uuid.NewString()
	_, err := q.Exec(ctx, `
		INSERT INTO system_course_nodes (id, tenant_id, course_id, parent_id, name, sort_order, ref_type, source_id, source_name,
			teaching_goals, duration, difficulty, knowledge_point_ids, resource_ids, status)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
	`, nodeID, p.TenantID, p.CourseID, p.ParentID, p.Name, p.SortOrder, p.RefType, p.SourceID, p.SourceName,
		p.TeachingGoals, p.Duration, p.Difficulty, []string{}, []string{}, "draft")
	if err != nil {
		return "", err
	}
	return nodeID, nil
}

// CourseImportInsertNodeKnowledgeBinding 写入节点知识点绑定（幂等，错误忽略，与导入语义一致）。
func CourseImportInsertNodeKnowledgeBinding(ctx context.Context, q Queryer, nodeID, kpID string) {
	_, _ = q.Exec(ctx, `
		INSERT INTO node_knowledge_point_bindings (id, node_id, knowledge_point_id, created_at)
		VALUES ($1,$2,$3,NOW())
		ON CONFLICT (node_id, knowledge_point_id) DO NOTHING
	`, uuid.NewString(), nodeID, kpID)
}

// CourseImportInsertNodeResourceBinding 写入节点资源绑定（幂等，错误忽略，与导入语义一致）。
func CourseImportInsertNodeResourceBinding(ctx context.Context, q Queryer, tenantID, nodeID, resID string) {
	_, _ = q.Exec(ctx, `
		INSERT INTO node_resource_bindings (id, tenant_id, node_id, resource_id, created_at)
		VALUES ($1,$2,$3,$4,NOW())
		ON CONFLICT (node_id, resource_id) DO NOTHING
	`, uuid.NewString(), tenantID, nodeID, resID)
}

// CourseImportUpdateNodeBindingArrays 回写节点字段 knowledge_point_ids/resource_ids（与 scenario_tasks 保持一致）。
func CourseImportUpdateNodeBindingArrays(ctx context.Context, q Queryer, nodeID string, kpIDs, resIDs []string) {
	_, _ = q.Exec(ctx, `
		UPDATE system_course_nodes
		SET knowledge_point_ids = $2, resource_ids = $3
		WHERE id = $1
	`, nodeID, kpIDs, resIDs)
}

// CourseImportInsertNodeQuiz 写入节点测评（导入用）。
func CourseImportInsertNodeQuiz(ctx context.Context, q Queryer, tenantID, nodeID, title, methodKey string) error {
	_, err := q.Exec(ctx, `
		INSERT INTO node_quizzes (id, tenant_id, node_id, title, type)
		VALUES ($1,$2,$3,$4,$5)
	`, uuid.NewString(), tenantID, nodeID, title, methodKey)
	return err
}

// CourseImportClearImportedCourseNodes 清空课程旧节点及测评（覆盖导入前调用）。
func CourseImportClearImportedCourseNodes(ctx context.Context, q Queryer, courseID string) error {
	if _, err := q.Exec(ctx, `
		DELETE FROM node_quizzes WHERE node_id IN (SELECT id FROM system_course_nodes WHERE course_id=$1)
	`, courseID); err != nil {
		return err
	}
	if _, err := q.Exec(ctx, `DELETE FROM system_course_nodes WHERE course_id=$1`, courseID); err != nil {
		return err
	}
	return nil
}

// CourseImportFindAbilityPointIDByName 按租户+名称查找能力点 ID。
func CourseImportFindAbilityPointIDByName(ctx context.Context, q Queryer, tenantID, name string) (string, error) {
	var id string
	err := q.QueryRow(ctx, `SELECT id FROM ability_points WHERE tenant_id=$1 AND name=$2 LIMIT 1`, tenantID, name).Scan(&id)
	return id, err
}

// CourseImportFindGranularCourseByName 按租户+名称查找颗粒课（type='granular'）。
func CourseImportFindGranularCourseByName(ctx context.Context, q Queryer, tenantID, name string) (*domain.Course, error) {
	var c domain.Course
	err := q.QueryRow(ctx, `
		SELECT id, name, online_hours, description, difficulty
		FROM courses
		WHERE tenant_id=$1 AND name=$2 AND type='granular'
		LIMIT 1
	`, tenantID, name).Scan(&c.ID, &c.Name, &c.OnlineHours, &c.Description, &c.Difficulty)
	if err != nil {
		return nil, err
	}
	return &c, nil
}

// CourseImportCourseKnowledgePointIDs 查询颗粒课绑定知识点 ID（course 绑定表）。
func CourseImportCourseKnowledgePointIDs(ctx context.Context, q Queryer, courseID string) []string {
	rows, err := q.Query(ctx, `
		SELECT knowledge_point_id FROM course_knowledge_bindings
		WHERE course_id=$1 AND bind_type='course'
	`, courseID)
	if err != nil {
		return nil
	}
	defer rows.Close()
	var ids []string
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err == nil && id != "" {
			ids = append(ids, id)
		}
	}
	return ids
}

// CourseImportCourseResourceIDs 查询颗粒课绑定资源 ID。
func CourseImportCourseResourceIDs(ctx context.Context, q Queryer, courseID string) []string {
	rows, err := q.Query(ctx, `
		SELECT resource_id FROM course_resource_bindings
		WHERE course_id=$1
	`, courseID)
	if err != nil {
		return nil
	}
	defer rows.Close()
	var ids []string
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err == nil && id != "" {
			ids = append(ids, id)
		}
	}
	return ids
}

// CourseImportTrainingProgramTenantID 查询方案归属租户（跨租户校验用）。
func CourseImportTrainingProgramTenantID(ctx context.Context, q Queryer, programID string) (string, error) {
	var tenantOf string
	err := q.QueryRow(ctx, `SELECT tenant_id FROM training_programs WHERE id=$1`, programID).Scan(&tenantOf)
	return tenantOf, err
}

// CourseImportFindCareerPositionIDByName 按租户+名称查找岗位 ID。
func CourseImportFindCareerPositionIDByName(ctx context.Context, q Queryer, tenantID, name string) (string, error) {
	var pid string
	err := q.QueryRow(ctx, `SELECT id FROM career_positions WHERE name=$1 AND tenant_id=$2 LIMIT 1`, name, tenantID).Scan(&pid)
	return pid, err
}

// CourseImportFindSystemCourseIDAndName 按租户+名称查找体系课 ID 与名称。
func CourseImportFindSystemCourseIDAndName(ctx context.Context, q Queryer, tenantID, name string) (string, string, error) {
	var id, n string
	err := q.QueryRow(ctx, `SELECT id, name FROM courses WHERE name=$1 AND type='system' AND tenant_id=$2 LIMIT 1`, name, tenantID).Scan(&id, &n)
	return id, n, err
}
