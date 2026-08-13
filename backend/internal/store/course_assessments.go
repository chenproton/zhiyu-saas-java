package store

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/zhiyu-saas/backend/internal/domain"
)

// CourseAssessmentStore 课程评估生成持久化（发布时生成节点考试/作业）。
type CourseAssessmentStore struct {
	q Queryer
}

// NewCourseAssessmentStore 创建评估生成 store。
func NewCourseAssessmentStore(q Queryer) *CourseAssessmentStore {
	return &CourseAssessmentStore{q: q}
}

// CourseInfo 课程基础信息。
type CourseInfo struct {
	Type      string
	Name      string
	TenantID  string
	CreatorID string
}

// FetchCourseInfo 查询课程基础信息。
func (s *CourseAssessmentStore) FetchCourseInfo(ctx context.Context, q Queryer, courseID string) (*CourseInfo, error) {
	var info CourseInfo
	err := q.QueryRow(ctx, `
		SELECT c.type, c.name, c.tenant_id, COALESCE(c.creator_id::text, '') AS creator_id
		FROM courses c
		WHERE c.id = $1
	`, courseID).Scan(&info.Type, &info.Name, &info.TenantID, &info.CreatorID)
	if err != nil {
		return nil, err
	}
	return &info, nil
}

// ListNodeEvalData 查询课程全部节点及其评估配置。
func (s *CourseAssessmentStore) ListNodeEvalData(ctx context.Context, q Queryer, courseID string) ([]NodeEvalRow, error) {
	rows, err := q.Query(ctx, `
		SELECT id, name, eval_data
		FROM system_course_nodes
		WHERE course_id = $1
		ORDER BY sort_order ASC, id ASC
	`, courseID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var nodes []NodeEvalRow
	for rows.Next() {
		var n NodeEvalRow
		if err := rows.Scan(&n.ID, &n.Name, &n.EvalData); err != nil {
			return nil, err
		}
		nodes = append(nodes, n)
	}
	return nodes, rows.Err()
}

// NodeEvalRow 节点评估配置行。
type NodeEvalRow struct {
	ID       string
	Name     string
	EvalData domain.JSONMap
}

// UpdateNodeEvalData 更新节点评估配置。
func (s *CourseAssessmentStore) UpdateNodeEvalData(ctx context.Context, q Queryer, nodeID string, evalData domain.JSONMap) error {
	_, err := q.Exec(ctx, `UPDATE system_course_nodes SET eval_data = $1, updated_at = NOW() WHERE id = $2`, evalData, nodeID)
	return err
}

// FindNodeUsage 查询节点已有考试安排。
func (s *CourseAssessmentStore) FindNodeUsage(ctx context.Context, q Queryer, examID, nodeID string) (string, error) {
	var usageID string
	err := q.QueryRow(ctx, `
		SELECT id FROM exam_usages
		WHERE exam_id = $1 AND target_type = 'node' AND $2 = ANY(target_ids)
	`, examID, nodeID).Scan(&usageID)
	if err == pgx.ErrNoRows {
		return "", nil
	}
	return usageID, err
}

// CreateNodeUsage 创建节点考试安排，startTime/endTime/duration 为空时表示不限时。
// activationMode 决定初始状态：always → published，manual/scheduled → draft。
// 创建即 stamp exam_version（快照最新为准，缺档回退 live version，文档 5.3）。
func (s *CourseAssessmentStore) CreateNodeUsage(ctx context.Context, q Queryer, tenantID, examID, nodeID, name, creatorID string, startTime, endTime *string, duration *int, activationMode string) (string, error) {
	usageID := uuid.NewString()
	var creator any
	if creatorID != "" {
		creator = creatorID
	}
	status := "draft"
	if activationMode == "always" {
		status = "published"
	}
	examVersion, err := NewSnapshotStore(q).ResolveResourceVersion(ctx, tenantID, SnapshotResourceExam, examID)
	if err != nil {
		return "", err
	}
	var versionArg any
	if examVersion != "" {
		versionArg = examVersion
	}
	_, err = q.Exec(ctx, `
		INSERT INTO exam_usages (id, tenant_id, exam_id, name, description, start_time, end_time, duration, target_type, target_ids, status, activation_mode, creator_id, exam_version)
		VALUES ($1, $2, $3, $4, NULL, $5, $6, $7, 'node', $8, $9, $10, $11, $12)
	`, usageID, tenantID, examID, name, startTime, endTime, duration, []string{nodeID}, status, activationMode, creator, versionArg)
	if err != nil {
		return "", err
	}
	return usageID, nil
}

// CreateTempExam 创建临时考试（published）。
// 名称冲突（同租户同名临时考试已存在，如编辑测评规则后重新发布）时复用已有临时考试，
// 避免 INSERT 触发唯一键冲突导致事务中止（25P02）。
func (s *CourseAssessmentStore) CreateTempExam(ctx context.Context, q Queryer, tenantID, name string, duration int, creatorID string) (string, error) {
	var existingID string
	if err := q.QueryRow(ctx, `
		SELECT id FROM exams WHERE tenant_id = $1 AND name = $2 AND is_temp = TRUE
	`, tenantID, name).Scan(&existingID); err == nil && existingID != "" {
		return existingID, nil
	}

	id := uuid.NewString()
	code, err := GenerateUniqueEntityCode(ctx, q, "SJ", "exams", tenantID)
	if err != nil {
		return "", fmt.Errorf("生成考试编码失败: %w", err)
	}
	_, err = q.Exec(ctx, `
		INSERT INTO exams (id, tenant_id, code, name, description, status, total_score, duration, cover_image,
			collaborator_ids, collaborator_dept_ids, batch_id, version, owner_type, creator_id, is_temp)
		VALUES ($1, $2, $3, $4, '', 'published', 0, $5, NULL, '{}', '{}', NULL, 'V1.0', 'mine', $6, TRUE)
	`, id, tenantID, code, name, duration, creatorID)
	if err != nil {
		return "", fmt.Errorf("创建临时考试失败: %w", err)
	}
	return id, nil
}

// CreateExamUsage 创建通用考试安排，startTime/endTime/duration 为空时表示不限时。
// activationMode 决定初始状态：always → published，manual/scheduled → draft。
// 创建即 stamp exam_version（快照最新为准，缺档回退 live version，文档 5.3）。
func (s *CourseAssessmentStore) CreateExamUsage(ctx context.Context, q Queryer, tenantID, examID, targetType, targetID, name, creatorID string, startTime, endTime *string, duration *int, activationMode string) (string, error) {
	id := uuid.NewString()
	var creator any
	if creatorID != "" {
		creator = creatorID
	}
	status := "draft"
	if activationMode == "always" {
		status = "published"
	}
	examVersion, err := NewSnapshotStore(q).ResolveResourceVersion(ctx, tenantID, SnapshotResourceExam, examID)
	if err != nil {
		return "", fmt.Errorf("解析试卷版本失败: %w", err)
	}
	var versionArg any
	if examVersion != "" {
		versionArg = examVersion
	}
	_, err = q.Exec(ctx, `
		INSERT INTO exam_usages (id, tenant_id, exam_id, name, description, start_time, end_time, duration, target_type, target_ids, status, activation_mode, creator_id, exam_version)
		VALUES ($1, $2, $3, $4, NULL, $5, $6, $7, $8, $9, $10, $11, $12, $13)
	`, id, tenantID, examID, name, startTime, endTime, duration, targetType, []string{targetID}, status, activationMode, creator, versionArg)
	if err != nil {
		return "", fmt.Errorf("创建考试安排失败: %w", err)
	}
	return id, nil
}

// UpdateUsageWindow 更新考试安排开放时间窗、时长与启用条件（测评方式配置变更后同步）。
// 启用条件改为 always 时自动置为已发布。
func (s *CourseAssessmentStore) UpdateUsageWindow(ctx context.Context, q Queryer, usageID string, startTime, endTime *string, duration *int, activationMode string) error {
	_, err := q.Exec(ctx, `
		UPDATE exam_usages SET start_time = $1, end_time = $2, duration = $3, activation_mode = $4,
			status = CASE WHEN $4::varchar = 'always' THEN 'published' ELSE status END,
			updated_at = NOW()
		WHERE id = $5
	`, startTime, endTime, duration, activationMode, usageID)
	return err
}

// CleanupCourseLevelAssessments 清理课程级旧测评（兼容历史数据）。
func (s *CourseAssessmentStore) CleanupCourseLevelAssessments(ctx context.Context, q Queryer, courseID string) error {
	if _, err := q.Exec(ctx, `
		DELETE FROM exam_usages eu
		WHERE eu.target_type = 'course' AND $1 = ANY(eu.target_ids)
		  AND NOT EXISTS (SELECT 1 FROM exam_results er WHERE er.exam_usage_id = eu.id)
	`, courseID); err != nil {
		return fmt.Errorf("cleanup course exam usages: %w", err)
	}
	if _, err := q.Exec(ctx, `
		DELETE FROM course_homeworks ch
		WHERE ch.course_id = $1
		  AND NOT EXISTS (SELECT 1 FROM course_homework_submissions chs WHERE chs.homework_id = ch.id)
	`, courseID); err != nil {
		return fmt.Errorf("cleanup course homeworks: %w", err)
	}
	return nil
}
