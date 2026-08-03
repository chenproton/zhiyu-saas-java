package store

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/zhiyu-saas/backend/internal/domain"
)

// ResourceRow 资源库通用行（List 查询结果）。
type ResourceRow struct {
	ID                string
	Name              string
	Type              string
	URL               *string
	Description       *string
	Thumbnail         *string
	Size              string
	KnowledgePointRaw string
	UploadedBy        *string
	UploadedAt        time.Time
}

// ResourceBindingStore 提供资源库与节点/任务/课程的绑定持久化。
// 三种绑定表（node/task/course_resource_bindings）共用资源库实体。
type ResourceBindingStore struct {
	q Queryer
}

// NewResourceBindingStore 创建资源绑定 store。
func NewResourceBindingStore(q Queryer) *ResourceBindingStore {
	return &ResourceBindingStore{q: q}
}

// BindingTable 绑定表元信息。
type BindingTable struct {
	Table  string // 绑定表名（如 node_resource_bindings）
	IDCol  string // 绑定表外键列（如 node_id）
	JoinID string // 绑定表资源外键列，固定 resource_id
}

// List 查询资源库列表（可按绑定过滤），返回通用行。
func (s *ResourceBindingStore) List(ctx context.Context, tenantID, search string, bind *BindingTable, bindID string, limit, offset int) ([]ResourceRow, int, error) {
	where := []string{"1=1"}
	args := []any{}
	argIdx := 1
	if tenantID != "" {
		where = append(where, "rl.tenant_id = $"+Itoa(argIdx))
		args = append(args, tenantID)
		argIdx++
	} else {
		// 纵深防御：无租户时不返回全库资源
		where = append(where, "1=0")
	}
	join := ""
	if bind != nil && bindID != "" {
		join = "JOIN " + bind.Table + " tb ON tb.resource_id = rl.id AND tb." + bind.IDCol + " = $" + Itoa(argIdx)
		args = append(args, bindID)
		argIdx++
	}
	if search != "" {
		where = append(where, "(rl.name ILIKE $"+Itoa(argIdx)+" OR rl.description ILIKE $"+Itoa(argIdx)+")")
		args = append(args, "%"+search+"%")
		argIdx++
	}
	cond := joinSQL(where, " AND ")

	countQuery := "SELECT COUNT(*) FROM resource_library rl " + join + " WHERE " + cond
	var total int
	if err := s.q.QueryRow(ctx, countQuery, args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	if limit <= 0 {
		limit = 50
	}
	if limit > maxPageSize {
		limit = maxPageSize
	}
	if offset < 0 {
		offset = 0
	}
	args = append(args, limit, offset)
	query := `
		SELECT rl.id, rl.name, rl.resource_type, rl.url, rl.description, rl.thumbnail,
			COALESCE(rl.file_size::text, '') AS size,
			COALESCE(rl.metadata->>'knowledgePointIds', '[]')::text AS knowledge_point_ids,
			rl.uploaded_by, rl.created_at
		FROM resource_library rl
		` + join + `
		WHERE ` + cond + `
		ORDER BY rl.created_at DESC
		LIMIT $` + Itoa(argIdx) + ` OFFSET $` + Itoa(argIdx+1)

	rows, err := s.q.Query(ctx, query, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	items, err := scanResourceBindingRows(rows)
	return items, total, err
}

// CreateResource 创建资源库条目并绑定到目标。
// 可选 afterBind 回调（如课程资源同步 courses.resource_ids），在绑定后执行。
func (s *ResourceBindingStore) CreateResource(ctx context.Context, tenantID, bindTable, bindCol, bindID string, p *ResourceCreateSimpleParams, afterBind func(ctx context.Context, q Queryer, bindID, resourceID string) error) (*ResourceRow, error) {
	id := uuid.NewString()
	if _, err := s.q.Exec(ctx, `
		INSERT INTO resource_library (id, tenant_id, name, resource_type, url, description, thumbnail, file_size, metadata, uploaded_by)
		VALUES ($1, $2, $3, $4::resource_type, $5, $6, $7, $8, $9, $10)
	`, id, tenantID, p.Name, p.Type, p.URL, p.Description, p.Thumbnail, p.FileSize, p.Metadata, p.UploadedBy); err != nil {
		return nil, err
	}
	if bindTable != "" && bindID != "" {
		_, _ = s.q.Exec(ctx, `
			INSERT INTO `+bindTable+` (id, tenant_id, `+bindCol+`, resource_id)
			VALUES ($1, $2, $3, $4)
			ON CONFLICT (`+bindCol+`, resource_id) DO NOTHING
		`, uuid.NewString(), tenantID, bindID, id)
		if afterBind != nil {
			_ = afterBind(ctx, s.q, bindID, id)
		}
	}

	return s.fetchResource(ctx, id)
}

// Bind 绑定已有资源到目标。
// 可选 afterBind 回调（如课程资源同步 courses.resource_ids），在绑定后执行。
func (s *ResourceBindingStore) Bind(ctx context.Context, tenantID, bindTable, bindCol, bindID, resourceID string, afterBind func(ctx context.Context, q Queryer, bindID, resourceID string) error) (string, error) {
	var id string
	err := s.q.QueryRow(ctx, `
		INSERT INTO `+bindTable+` (tenant_id, `+bindCol+`, resource_id)
		VALUES ($1, $2, $3)
		ON CONFLICT (`+bindCol+`, resource_id) DO UPDATE SET `+bindCol+` = EXCLUDED.`+bindCol+`
		RETURNING id
	`, tenantID, bindID, resourceID).Scan(&id)
	if err != nil {
		return "", err
	}
	if afterBind != nil {
		_ = afterBind(ctx, s.q, bindID, resourceID)
	}
	return id, nil
}

// Unbind 解绑。绑定不存在时静默成功（保持原有 node/task 行为）。
// afterUnbind 收到 (bindID, resourceID)。
func (s *ResourceBindingStore) Unbind(ctx context.Context, bindTable, id string, afterUnbind func(ctx context.Context, q Queryer, bindID, resourceID string) error) error {
	var bindID, resourceID string
	err := s.q.QueryRow(ctx, `SELECT `+bindColOf(bindTable)+`, resource_id FROM `+bindTable+` WHERE id = $1`, id).Scan(&bindID, &resourceID)
	if err != nil {
		return nil
	}
	if _, err := s.q.Exec(ctx, `DELETE FROM `+bindTable+` WHERE id = $1`, id); err != nil {
		return err
	}
	if afterUnbind != nil {
		_ = afterUnbind(ctx, s.q, bindID, resourceID)
	}
	return nil
}

// BindTargetID 查询绑定行关联的主实体 ID（租户归属校验用）。
func (s *ResourceBindingStore) BindTargetID(ctx context.Context, bindTable, id string) (string, error) {
	var bindID string
	err := s.q.QueryRow(ctx, `SELECT `+bindColOf(bindTable)+` FROM `+bindTable+` WHERE id = $1`, id).Scan(&bindID)
	return bindID, err
}

// bindColOf 绑定表的目标列名。
func bindColOf(table string) string {
	switch table {
	case "node_resource_bindings":
		return "node_id"
	case "task_resource_bindings":
		return "task_id"
	default:
		return "course_id"
	}
}

// ResourceCreateSimpleParams 创建资源参数。
type ResourceCreateSimpleParams struct {
	Name        string
	Type        string
	URL         *string
	Description *string
	Thumbnail   *string
	FileSize    *int64
	Metadata    []byte
	UploadedBy  *string
}

func (s *ResourceBindingStore) fetchResource(ctx context.Context, id string) (*ResourceRow, error) {
	var res ResourceRow
	var kpRaw string
	err := s.q.QueryRow(ctx, `
		SELECT id, name, resource_type, url, COALESCE(description,''), COALESCE(thumbnail,''),
			COALESCE(file_size::text, '') AS size,
			COALESCE(metadata->>'knowledgePointIds', '[]')::text AS kp_ids,
			uploaded_by, created_at
		FROM resource_library WHERE id = $1
	`, id).Scan(
		&res.ID, &res.Name, &res.Type, &res.URL, &res.Description, &res.Thumbnail,
		&res.Size, &kpRaw, &res.UploadedBy, &res.UploadedAt,
	)
	if err != nil {
		return nil, err
	}
	res.KnowledgePointRaw = kpRaw
	return &res, nil
}

func scanResourceBindingRows(rows pgx.Rows) ([]ResourceRow, error) {
	items := make([]ResourceRow, 0)
	for rows.Next() {
		var res ResourceRow
		if err := rows.Scan(&res.ID, &res.Name, &res.Type, &res.URL, &res.Description, &res.Thumbnail,
			&res.Size, &res.KnowledgePointRaw, &res.UploadedBy, &res.UploadedAt); err != nil {
			return nil, err
		}
		items = append(items, res)
	}
	return items, rows.Err()
}

// ListCourseResources 课程资源列表（列顺序与原 course_resource_handler 一致）。
func (s *ResourceBindingStore) ListCourseResources(ctx context.Context, tenantID, courseID, search string, limit, offset int) ([]domain.NodeResource, int, error) {
	where := []string{"1=1"}
	args := []any{}
	argIdx := 1
	where = append(where, "rl.tenant_id = $"+Itoa(argIdx))
	args = append(args, tenantID)
	argIdx++

	join := ""
	if courseID != "" {
		join = `JOIN course_resource_bindings crb ON crb.resource_id = rl.id AND crb.course_id = $` + Itoa(argIdx)
		args = append(args, courseID)
		argIdx++
	} else {
		join = `LEFT JOIN course_resource_bindings crb ON crb.resource_id = rl.id`
	}
	if search != "" {
		where = append(where, "(rl.name ILIKE $"+Itoa(argIdx)+" OR rl.url ILIKE $"+Itoa(argIdx)+")")
		args = append(args, "%"+search+"%")
		argIdx++
	}
	cond := joinSQL(where, " AND ")

	countQuery := "SELECT COUNT(*) FROM resource_library rl " + join + " WHERE " + cond
	var total int
	if err := s.q.QueryRow(ctx, countQuery, args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	if limit <= 0 {
		limit = 200
	}
	if offset < 0 {
		offset = 0
	}
	args = append(args, limit, offset)
	query := `
		SELECT rl.id,
			COALESCE(crb.course_id::text, '') AS node_id,
			rl.name,
			rl.resource_type AS type,
			rl.url,
			rl.file_size::int AS size,
			rl.tenant_id,
			rl.created_at AS uploaded_at,
			rl.uploaded_by
		FROM resource_library rl
		` + join + `
		WHERE ` + cond + `
		ORDER BY rl.created_at DESC
		LIMIT $` + Itoa(argIdx) + ` OFFSET $` + Itoa(argIdx+1)

	rows, err := s.q.Query(ctx, query, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	items := make([]domain.NodeResource, 0)
	for rows.Next() {
		var res domain.NodeResource
		var tenantID *string
		var uploadedBy *string
		var fileSize *int64
		if err := rows.Scan(&res.ID, &res.NodeID, &res.Name, &res.Type, &res.URL, &fileSize, &tenantID, &res.UploadedAt, &uploadedBy); err != nil {
			return nil, 0, err
		}
		res.UploadedBy = uploadedBy
		if fileSize != nil {
			s := int(*fileSize)
			res.Size = &s
		}
		items = append(items, res)
	}
	return items, total, nil
}

// CourseSyncBind 课程绑定/解绑后同步 courses.resource_ids 聚合字段。
func CourseSyncBind(ctx context.Context, q Queryer, courseID, resourceID string) error {
	_, err := q.Exec(ctx, `
		UPDATE courses
		SET resource_ids = array_append(resource_ids, $2::uuid),
		    resource_count = COALESCE(array_length(array_append(resource_ids, $2::uuid), 1), 0)
		WHERE id = $1 AND NOT ($2::uuid = ANY(resource_ids))
	`, courseID, resourceID)
	return err
}

// CourseSyncUnbind 课程解绑后移除 courses.resource_ids 聚合字段。
func CourseSyncUnbind(ctx context.Context, q Queryer, courseID, resourceID string) error {
	_, err := q.Exec(ctx, `
		UPDATE courses
		SET resource_ids = array_remove(resource_ids, $2::uuid),
		    resource_count = COALESCE(array_length(array_remove(resource_ids, $2::uuid), 1), 0)
		WHERE id = $1
	`, courseID, resourceID)
	return err
}
