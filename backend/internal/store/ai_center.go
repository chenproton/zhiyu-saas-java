// AI 智能服务中心持久化（docs/spec/ai-service-center.md §4）。
// 全部方法带 tenant_id 过滤（行级隔离）；召回可见性过滤在 SQL 层完成（§2.2 安全锚点）。
package store

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/zhiyu-saas/backend/internal/domain"
)

// AICenterStore AI 智能服务中心统一 store。
type AICenterStore struct {
	q Queryer
}

// NewAICenterStore 创建 store。
func NewAICenterStore(q Queryer) *AICenterStore {
	return &AICenterStore{q: q}
}

var kbColumns = `id, tenant_id, owner_id, name, description, tags, cover_image, status, review_comment,
	reviewed_by, reviewed_at, doc_count, ask_count, created_at, updated_at`

// kbViewExpr/agentViewExpr：浏览量联查全局 view_counters（v2.2.1，与岗位/场景同一机制，见 RecordView）
func kbViewExpr(alias string) string {
	return fmt.Sprintf(`COALESCE((SELECT cnt FROM view_counters WHERE target_type='ai_kb' AND target_id=%s.id),0)`, alias)
}
func agentViewExpr(alias string) string {
	return fmt.Sprintf(`COALESCE((SELECT cnt FROM view_counters WHERE target_type='ai_agent' AND target_id=%s.id),0)`, alias)
}

// kbCols 生成带表前缀的列清单（JOIN users 时避免 id 等列歧义）。
func kbCols(prefix string) string {
	cols := strings.Split(kbColumns, ",")
	for i, c := range cols {
		cols[i] = prefix + "." + strings.TrimSpace(c)
	}
	return strings.Join(cols, ", ")
}

// escapeLike 转义 ILIKE 通配符（%/_,反斜杠），与 query.go 既有惯例一致（ESCAPE '\'）。
func escapeLike(s string) string {
	return strings.NewReplacer(`\`, `\\`, `%`, `\%`, `_`, `\_`).Replace(s)
}

func scanKB(row pgx.Row) (*domain.AIKnowledgeBase, error) {
	return scanKBCols(row, nil)
}

// scanKBWithOwner 扫描带 owner_name 尾列的行（列表查询 LEFT JOIN users）。
func scanKBWithOwner(row pgx.Row) (*domain.AIKnowledgeBase, error) {
	var ownerName string
	return scanKBCols(row, &ownerName)
}

func scanKBCols(row pgx.Row, ownerName *string) (*domain.AIKnowledgeBase, error) {
	var kb domain.AIKnowledgeBase
	var tags []byte
	var reviewedBy *string
	dest := []any{&kb.ID, &kb.TenantID, &kb.OwnerID, &kb.Name, &kb.Description, &tags, &kb.CoverImage,
		&kb.Status, &kb.ReviewComment, &reviewedBy, &kb.ReviewedAt, &kb.DocCount, &kb.AskCount, &kb.CreatedAt, &kb.UpdatedAt,
		&kb.ViewCount}
	if ownerName != nil {
		dest = append(dest, ownerName)
	}
	if err := row.Scan(dest...); err != nil {
		return nil, err
	}
	if reviewedBy != nil {
		kb.ReviewedBy = *reviewedBy
	}
	if ownerName != nil {
		kb.OwnerName = *ownerName
	}
	kb.Tags = []string{}
	if len(tags) > 0 {
		_ = json.Unmarshal(tags, &kb.Tags)
	}
	return &kb, nil
}

// ==================== 知识库 ====================

// CreateKB 新建知识库（默认 private）。
func (s *AICenterStore) CreateKB(ctx context.Context, kb *domain.AIKnowledgeBase) error {
	tags, _ := json.Marshal(kb.Tags)
	return s.q.QueryRow(ctx, `
		INSERT INTO ai_knowledge_bases (tenant_id, owner_id, name, description, tags, cover_image)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id, status, doc_count, ask_count, created_at, updated_at
	`, kb.TenantID, kb.OwnerID, kb.Name, kb.Description, tags, kb.CoverImage).
		Scan(&kb.ID, &kb.Status, &kb.DocCount, &kb.AskCount, &kb.CreatedAt, &kb.UpdatedAt)
}

// GetKB 按租户取知识库；不存在返回 ErrNotFound。
func (s *AICenterStore) GetKB(ctx context.Context, tenantID, id string) (*domain.AIKnowledgeBase, error) {
	kb, err := scanKB(s.q.QueryRow(ctx, `SELECT `+kbColumns+`, `+kbViewExpr("ai_knowledge_bases")+` FROM ai_knowledge_bases WHERE tenant_id = $1 AND id = $2`, tenantID, id))
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	return kb, err
}

// ListMyKBs 我相关的知识库：scope=owned（我创建的）/ collaborating（我协作的）/ all（两者并集）。
func (s *AICenterStore) ListMyKBs(ctx context.Context, tenantID, userID, scope, q string, page, pageSize int) ([]domain.AIKnowledgeBase, int, error) {
	var cond string
	switch scope {
	case "owned":
		cond = `kb.owner_id = $2`
	case "collaborating":
		cond = `EXISTS (SELECT 1 FROM ai_kb_collaborators c WHERE c.kb_id = kb.id AND c.user_id = $2)`
	default:
		cond = `(kb.owner_id = $2 OR EXISTS (SELECT 1 FROM ai_kb_collaborators c WHERE c.kb_id = kb.id AND c.user_id = $2))`
	}
	args := []any{tenantID, userID}
	where := `kb.tenant_id = $1 AND ` + cond
	if q != "" {
		args = append(args, "%"+escapeLike(q)+"%")
		where += fmt.Sprintf(` AND kb.name ILIKE $%d ESCAPE '\'`, len(args))
	}
	var total int
	if err := s.q.QueryRow(ctx, `SELECT COUNT(*) FROM ai_knowledge_bases kb WHERE `+where, args...).Scan(&total); err != nil {
		return nil, 0, err
	}
	args = append(args, pageSize, (page-1)*pageSize)
	rows, err := s.q.Query(ctx, `
		SELECT `+kbCols("kb")+`, `+kbViewExpr("kb")+`, COALESCE(u.name, '') FROM ai_knowledge_bases kb
		LEFT JOIN users u ON u.id = kb.owner_id
		WHERE `+where+` ORDER BY kb.updated_at DESC
		LIMIT $`+fmt.Sprint(len(args)-1)+` OFFSET $`+fmt.Sprint(len(args)), args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	out := make([]domain.AIKnowledgeBase, 0)
	for rows.Next() {
		kb, err := scanKBWithOwner(rows)
		if err != nil {
			return nil, 0, err
		}
		out = append(out, *kb)
	}
	return out, total, rows.Err()
}

// ListSquareKBs 广场列表：仅 published，hot=ask_count 降序 / new=created_at 降序。
func (s *AICenterStore) ListSquareKBs(ctx context.Context, tenantID, q, tag, sort string, page, pageSize int) ([]domain.AIKnowledgeBase, int, error) {
	args := []any{tenantID}
	where := `kb.tenant_id = $1 AND kb.status = 'published'`
	if q != "" {
		args = append(args, "%"+escapeLike(q)+"%")
		where += fmt.Sprintf(` AND (kb.name ILIKE $%[1]d ESCAPE '\' OR kb.description ILIKE $%[1]d ESCAPE '\')`, len(args))
	}
	if tag != "" {
		args = append(args, tag)
		where += fmt.Sprintf(` AND kb.tags @> to_jsonb($%d::text)`, len(args))
	}
	// hot=提问数（默认）/ new=最新创建 / docs=资源最多 / updated=最近更新（知识库大厅排序，spec §5.3）
	order := `kb.created_at DESC`
	switch sort {
	case "hot":
		order = `kb.ask_count DESC, kb.created_at DESC`
	case "docs":
		order = `kb.doc_count DESC, kb.created_at DESC`
	case "views":
		order = kbViewExpr("kb") + ` DESC, kb.created_at DESC`
	case "updated":
		order = `kb.updated_at DESC`
	}
	var total int
	if err := s.q.QueryRow(ctx, `SELECT COUNT(*) FROM ai_knowledge_bases kb WHERE `+where, args...).Scan(&total); err != nil {
		return nil, 0, err
	}
	args = append(args, pageSize, (page-1)*pageSize)
	rows, err := s.q.Query(ctx, `
		SELECT `+kbCols("kb")+`, `+kbViewExpr("kb")+`, COALESCE(u.name, '') FROM ai_knowledge_bases kb
		LEFT JOIN users u ON u.id = kb.owner_id
		WHERE `+where+` ORDER BY `+order+`
		LIMIT $`+fmt.Sprint(len(args)-1)+` OFFSET $`+fmt.Sprint(len(args)), args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	out := make([]domain.AIKnowledgeBase, 0)
	for rows.Next() {
		kb, err := scanKBWithOwner(rows)
		if err != nil {
			return nil, 0, err
		}
		out = append(out, *kb)
	}
	return out, total, rows.Err()
}

// UpdateKB 更新基础信息（owner 语义由 service 保证；SQL 层 tenant+owner 双条件纵深防御）。
func (s *AICenterStore) UpdateKB(ctx context.Context, kb *domain.AIKnowledgeBase) error {
	tags, _ := json.Marshal(kb.Tags)
	ct, err := s.q.Exec(ctx, `
		UPDATE ai_knowledge_bases SET name = $3, description = $4, tags = $5, cover_image = $6, updated_at = now()
		WHERE tenant_id = $1 AND id = $2 AND owner_id = $7
	`, kb.TenantID, kb.ID, kb.Name, kb.Description, tags, kb.CoverImage, kb.OwnerID)
	if err != nil {
		return err
	}
	if ct.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// DeleteKB 删除知识库（级联文档/分块/协作者/关联）。
func (s *AICenterStore) DeleteKB(ctx context.Context, tenantID, id string) error {
	ct, err := s.q.Exec(ctx, `DELETE FROM ai_knowledge_bases WHERE tenant_id = $1 AND id = $2`, tenantID, id)
	if err != nil {
		return err
	}
	if ct.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// SetKBStatus 状态流转 + 审核信息；fromStatuses 非空时要求当前状态在集合内（非法转移返回 ErrNotFound，service 映射 409）。
func (s *AICenterStore) SetKBStatus(ctx context.Context, tenantID, id, status, comment, reviewerID string, fromStatuses ...string) error {
	query := `UPDATE ai_knowledge_bases SET status = $3, review_comment = $4, reviewed_by = NULLIF($5, '')::uuid,
		reviewed_at = CASE WHEN $5 = '' THEN reviewed_at ELSE now() END, updated_at = now()
		WHERE tenant_id = $1 AND id = $2`
	args := []any{tenantID, id, status, comment, reviewerID}
	if len(fromStatuses) > 0 {
		query += ` AND status = ANY($6)`
		args = append(args, fromStatuses)
	}
	ct, err := s.q.Exec(ctx, query, args...)
	if err != nil {
		return err
	}
	if ct.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// IncrementKBAskCount 检索计数（best-effort，调用方忽略错误）。
func (s *AICenterStore) IncrementKBAskCount(ctx context.Context, tenantID string, kbIDs []string) {
	if len(kbIDs) == 0 {
		return
	}
	_, _ = s.q.Exec(ctx, `UPDATE ai_knowledge_bases SET ask_count = ask_count + 1 WHERE tenant_id = $1 AND id = ANY($2)`, tenantID, kbIDs)
}

// ==================== 文档 ====================

// CreateDocument 插入文档行（status=parsing）。
func (s *AICenterStore) CreateDocument(ctx context.Context, doc *domain.AIKBDocument) error {
	return s.q.QueryRow(ctx, `
		INSERT INTO ai_kb_documents (tenant_id, kb_id, uploader_id, name, file_path, file_size, mime)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING id, status, created_at
	`, doc.TenantID, doc.KbID, doc.UploaderID, doc.Name, doc.FilePath, doc.FileSize, doc.Mime).
		Scan(&doc.ID, &doc.Status, &doc.CreatedAt)
}

// GetDocument 取文档（kb 归属校验在查询条件内）。
func (s *AICenterStore) GetDocument(ctx context.Context, tenantID, kbID, docID string) (*domain.AIKBDocument, error) {
	var d domain.AIKBDocument
	err := s.q.QueryRow(ctx, `
		SELECT id, tenant_id, kb_id, uploader_id, name, file_path, file_size, mime, status, error, chunk_count, char_count, created_at
		FROM ai_kb_documents WHERE tenant_id = $1 AND kb_id = $2 AND id = $3
	`, tenantID, kbID, docID).Scan(&d.ID, &d.TenantID, &d.KbID, &d.UploaderID, &d.Name, &d.FilePath,
		&d.FileSize, &d.Mime, &d.Status, &d.Error, &d.ChunkCount, &d.CharCount, &d.CreatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	return &d, err
}

// ListDocuments 知识库文档列表（含上传者姓名），按创建时间倒序。
func (s *AICenterStore) ListDocuments(ctx context.Context, tenantID, kbID string) ([]domain.AIKBDocument, error) {
	rows, err := s.q.Query(ctx, `
		SELECT d.id, d.tenant_id, d.kb_id, d.uploader_id, d.name, d.file_path, d.file_size, d.mime,
		       d.status, d.error, d.chunk_count, d.char_count, d.created_at, COALESCE(u.name, '')
		FROM ai_kb_documents d LEFT JOIN users u ON u.id = d.uploader_id
		WHERE d.tenant_id = $1 AND d.kb_id = $2
		ORDER BY d.created_at DESC
		LIMIT 500
	`, tenantID, kbID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]domain.AIKBDocument, 0)
	for rows.Next() {
		var d domain.AIKBDocument
		if err := rows.Scan(&d.ID, &d.TenantID, &d.KbID, &d.UploaderID, &d.Name, &d.FilePath, &d.FileSize,
			&d.Mime, &d.Status, &d.Error, &d.ChunkCount, &d.CharCount, &d.CreatedAt, &d.UploaderName); err != nil {
			return nil, err
		}
		out = append(out, d)
	}
	return out, rows.Err()
}

// DeleteDocument 删除文档（chunks 级联）。
func (s *AICenterStore) DeleteDocument(ctx context.Context, tenantID, kbID, docID string) error {
	ct, err := s.q.Exec(ctx, `DELETE FROM ai_kb_documents WHERE tenant_id = $1 AND kb_id = $2 AND id = $3`, tenantID, kbID, docID)
	if err != nil {
		return err
	}
	if ct.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// FinishDocumentParse 解析流水线收口：parsing → ready/failed（状态守卫防重入，已收口则 RowsAffected=0）。
func (s *AICenterStore) FinishDocumentParse(ctx context.Context, tenantID, docID, status, errMsg string, chunkCount, charCount int) error {
	_, err := s.q.Exec(ctx, `
		UPDATE ai_kb_documents SET status = $3, error = $4, chunk_count = $5, char_count = $6
		WHERE tenant_id = $1 AND id = $2 AND status = 'parsing'
	`, tenantID, docID, status, errMsg, chunkCount, charCount)
	return err
}

// InsertChunks 批量插入分块。
func (s *AICenterStore) InsertChunks(ctx context.Context, chunks []domain.AIKBChunk) error {
	if len(chunks) == 0 {
		return nil
	}
	var sb strings.Builder
	sb.WriteString(`INSERT INTO ai_kb_chunks (tenant_id, doc_id, kb_id, seq, content) VALUES `)
	args := make([]any, 0, len(chunks)*5)
	for i, c := range chunks {
		if i > 0 {
			sb.WriteByte(',')
		}
		fmt.Fprintf(&sb, `($%d,$%d,$%d,$%d,$%d)`, len(args)+1, len(args)+2, len(args)+3, len(args)+4, len(args)+5)
		args = append(args, c.TenantID, c.DocID, c.KbID, c.Seq, c.Content)
	}
	_, err := s.q.Exec(ctx, sb.String(), args...)
	return err
}

// RefreshKBDocCount 重算 ready 文档数冗余列。
func (s *AICenterStore) RefreshKBDocCount(ctx context.Context, tenantID, kbID string) {
	_, _ = s.q.Exec(ctx, `
		UPDATE ai_knowledge_bases kb SET doc_count = (
			SELECT COUNT(*) FROM ai_kb_documents d WHERE d.tenant_id = kb.tenant_id AND d.kb_id = kb.id AND d.status = 'ready'
		) WHERE kb.tenant_id = $1 AND kb.id = $2
	`, tenantID, kbID)
}

// ==================== 协作者 ====================

// AddCollaborator 添加协作者（重复则更新角色）。
func (s *AICenterStore) AddCollaborator(ctx context.Context, c *domain.AIKBCollaborator) error {
	return s.q.QueryRow(ctx, `
		INSERT INTO ai_kb_collaborators (tenant_id, kb_id, user_id, role)
		VALUES ($1, $2, $3, $4)
		ON CONFLICT (kb_id, user_id) DO UPDATE SET role = EXCLUDED.role
		RETURNING id, created_at
	`, c.TenantID, c.KbID, c.UserID, c.Role).Scan(&c.ID, &c.CreatedAt)
}

// RemoveCollaborator 移除协作者。
func (s *AICenterStore) RemoveCollaborator(ctx context.Context, tenantID, kbID, userID string) error {
	ct, err := s.q.Exec(ctx, `DELETE FROM ai_kb_collaborators WHERE tenant_id = $1 AND kb_id = $2 AND user_id = $3`, tenantID, kbID, userID)
	if err != nil {
		return err
	}
	if ct.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// ListCollaborators 协作者列表（含姓名）。
func (s *AICenterStore) ListCollaborators(ctx context.Context, tenantID, kbID string) ([]domain.AIKBCollaborator, error) {
	rows, err := s.q.Query(ctx, `
		SELECT c.id, c.tenant_id, c.kb_id, c.user_id, c.role, c.created_at, COALESCE(u.name, '')
		FROM ai_kb_collaborators c LEFT JOIN users u ON u.id = c.user_id
		WHERE c.tenant_id = $1 AND c.kb_id = $2
		ORDER BY c.created_at ASC LIMIT 200
	`, tenantID, kbID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]domain.AIKBCollaborator, 0)
	for rows.Next() {
		var c domain.AIKBCollaborator
		if err := rows.Scan(&c.ID, &c.TenantID, &c.KbID, &c.UserID, &c.Role, &c.CreatedAt, &c.UserName); err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	return out, rows.Err()
}

// GetCollaboratorRole 取用户在知识库的协作角色；无记录返回 ErrNotFound。
func (s *AICenterStore) GetCollaboratorRole(ctx context.Context, tenantID, kbID, userID string) (string, error) {
	var role string
	err := s.q.QueryRow(ctx, `SELECT role FROM ai_kb_collaborators WHERE tenant_id = $1 AND kb_id = $2 AND user_id = $3`,
		tenantID, kbID, userID).Scan(&role)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", ErrNotFound
	}
	return role, err
}

// GetCollaboratorRoles 批量取用户在多个知识库的协作角色（列表填充 MyRole 用，避免 N+1）。
func (s *AICenterStore) GetCollaboratorRoles(ctx context.Context, tenantID, userID string, kbIDs []string) (map[string]string, error) {
	out := map[string]string{}
	if len(kbIDs) == 0 {
		return out, nil
	}
	rows, err := s.q.Query(ctx, `SELECT kb_id, role FROM ai_kb_collaborators WHERE tenant_id = $1 AND user_id = $2 AND kb_id = ANY($3)`,
		tenantID, userID, kbIDs)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var kbID, role string
		if err := rows.Scan(&kbID, &role); err != nil {
			return nil, err
		}
		out[kbID] = role
	}
	return out, rows.Err()
}

// ==================== 智能体 ====================

var agentColumns = `id, tenant_id, owner_id, name, avatar, description, cover_image, greeting, system_prompt, status,
	review_comment, reviewed_by, reviewed_at, chat_count, created_at, updated_at`

func scanAgent(row pgx.Row) (*domain.AIAgent, error) {
	var a domain.AIAgent
	var reviewedBy *string
	err := row.Scan(&a.ID, &a.TenantID, &a.OwnerID, &a.Name, &a.Avatar, &a.Description, &a.CoverImage,
		&a.Greeting, &a.SystemPrompt, &a.Status, &a.ReviewComment, &reviewedBy, &a.ReviewedAt, &a.ChatCount, &a.CreatedAt, &a.UpdatedAt,
		&a.ViewCount)
	if err != nil {
		return nil, err
	}
	if reviewedBy != nil {
		a.ReviewedBy = *reviewedBy
	}
	return &a, nil
}

// CreateAgent 新建智能体（默认 private）。
func (s *AICenterStore) CreateAgent(ctx context.Context, a *domain.AIAgent) error {
	return s.q.QueryRow(ctx, `
		INSERT INTO ai_agents (tenant_id, owner_id, name, avatar, description, cover_image, greeting, system_prompt)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		RETURNING id, status, chat_count, created_at, updated_at
	`, a.TenantID, a.OwnerID, a.Name, a.Avatar, a.Description, a.CoverImage, a.Greeting, a.SystemPrompt).
		Scan(&a.ID, &a.Status, &a.ChatCount, &a.CreatedAt, &a.UpdatedAt)
}

// GetAgent 按租户取智能体。
func (s *AICenterStore) GetAgent(ctx context.Context, tenantID, id string) (*domain.AIAgent, error) {
	a, err := scanAgent(s.q.QueryRow(ctx, `SELECT `+agentColumns+`, `+agentViewExpr("ai_agents")+` FROM ai_agents WHERE tenant_id = $1 AND id = $2`, tenantID, id))
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	return a, err
}

// ListMyAgents 我创建的智能体。
func (s *AICenterStore) ListMyAgents(ctx context.Context, tenantID, userID string) ([]domain.AIAgent, error) {
	rows, err := s.q.Query(ctx, `
		SELECT `+agentColumns+`, `+agentViewExpr("ai_agents")+` FROM ai_agents WHERE tenant_id = $1 AND owner_id = $2
		ORDER BY updated_at DESC LIMIT 200
	`, tenantID, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]domain.AIAgent, 0)
	for rows.Next() {
		a, err := scanAgent(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, *a)
	}
	return out, rows.Err()
}

// ListSquareAgents 广场已发布智能体。
func (s *AICenterStore) ListSquareAgents(ctx context.Context, tenantID, q, sort string, page, pageSize int) ([]domain.AIAgent, int, error) {
	args := []any{tenantID}
	where := `a.tenant_id = $1 AND a.status = 'published'`
	if q != "" {
		args = append(args, "%"+escapeLike(q)+"%")
		where += fmt.Sprintf(` AND (a.name ILIKE $%[1]d ESCAPE '\' OR a.description ILIKE $%[1]d ESCAPE '\')`, len(args))
	}
	order := `a.created_at DESC`
	switch sort {
	case "hot":
		order = `a.chat_count DESC, a.created_at DESC`
	case "views":
		order = agentViewExpr("a") + ` DESC, a.created_at DESC`
	}
	var total int
	if err := s.q.QueryRow(ctx, `SELECT COUNT(*) FROM ai_agents a WHERE `+where, args...).Scan(&total); err != nil {
		return nil, 0, err
	}
	args = append(args, pageSize, (page-1)*pageSize)
	rows, err := s.q.Query(ctx, `
		SELECT a.`+strings.ReplaceAll(agentColumns, `, `, `, a.`)+`, `+agentViewExpr("a")+`, COALESCE(u.name, '')
		FROM ai_agents a LEFT JOIN users u ON u.id = a.owner_id
		WHERE `+where+` ORDER BY `+order+`
		LIMIT $`+fmt.Sprint(len(args)-1)+` OFFSET $`+fmt.Sprint(len(args)), args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	out := make([]domain.AIAgent, 0)
	for rows.Next() {
		var a domain.AIAgent
		var reviewedBy *string
		if err := rows.Scan(&a.ID, &a.TenantID, &a.OwnerID, &a.Name, &a.Avatar, &a.Description, &a.CoverImage,
			&a.Greeting, &a.SystemPrompt, &a.Status, &a.ReviewComment, &reviewedBy, &a.ReviewedAt, &a.ChatCount,
			&a.CreatedAt, &a.UpdatedAt, &a.ViewCount, &a.OwnerName); err != nil {
			return nil, 0, err
		}
		if reviewedBy != nil {
			a.ReviewedBy = *reviewedBy
		}
		out = append(out, a)
	}
	return out, total, rows.Err()
}

// UpdateAgent 编辑智能体（tenant+owner 双条件纵深防御）。
func (s *AICenterStore) UpdateAgent(ctx context.Context, a *domain.AIAgent) error {
	ct, err := s.q.Exec(ctx, `
		UPDATE ai_agents SET name = $3, avatar = $4, description = $5, cover_image = $6, greeting = $7, system_prompt = $8, updated_at = now()
		WHERE tenant_id = $1 AND id = $2 AND owner_id = $9
	`, a.TenantID, a.ID, a.Name, a.Avatar, a.Description, a.CoverImage, a.Greeting, a.SystemPrompt, a.OwnerID)
	if err != nil {
		return err
	}
	if ct.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// DeleteAgent 删除智能体（级联关联/会话/消息）。
func (s *AICenterStore) DeleteAgent(ctx context.Context, tenantID, id string) error {
	ct, err := s.q.Exec(ctx, `DELETE FROM ai_agents WHERE tenant_id = $1 AND id = $2`, tenantID, id)
	if err != nil {
		return err
	}
	if ct.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// SetAgentStatus 状态流转（同 SetKBStatus 语义）。
func (s *AICenterStore) SetAgentStatus(ctx context.Context, tenantID, id, status, comment, reviewerID string, fromStatuses ...string) error {
	query := `UPDATE ai_agents SET status = $3, review_comment = $4, reviewed_by = NULLIF($5, '')::uuid,
		reviewed_at = CASE WHEN $5 = '' THEN reviewed_at ELSE now() END, updated_at = now()
		WHERE tenant_id = $1 AND id = $2`
	args := []any{tenantID, id, status, comment, reviewerID}
	if len(fromStatuses) > 0 {
		query += ` AND status = ANY($6)`
		args = append(args, fromStatuses)
	}
	ct, err := s.q.Exec(ctx, query, args...)
	if err != nil {
		return err
	}
	if ct.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// ReplaceAgentKBs 重置智能体关联知识库（先删后插）。
func (s *AICenterStore) ReplaceAgentKBs(ctx context.Context, tenantID, agentID string, kbIDs []string) error {
	if _, err := s.q.Exec(ctx, `DELETE FROM ai_agent_kbs WHERE tenant_id = $1 AND agent_id = $2`, tenantID, agentID); err != nil {
		return err
	}
	for _, kbID := range kbIDs {
		if _, err := s.q.Exec(ctx, `
			INSERT INTO ai_agent_kbs (tenant_id, agent_id, kb_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING
		`, tenantID, agentID, kbID); err != nil {
			return err
		}
	}
	return nil
}

// ListAgentKBs 智能体关联的知识库（含状态，供可见性判定与前端展示）。
func (s *AICenterStore) ListAgentKBs(ctx context.Context, tenantID, agentID string) ([]domain.AIKnowledgeBase, error) {
	rows, err := s.q.Query(ctx, `
		SELECT kb.id, kb.tenant_id, kb.owner_id, kb.name, kb.description, kb.tags, kb.cover_image, kb.status, kb.review_comment,
		       kb.reviewed_by, kb.reviewed_at, kb.doc_count, kb.ask_count, kb.created_at, kb.updated_at, `+kbViewExpr("kb")+`
		FROM ai_agent_kbs ak JOIN ai_knowledge_bases kb ON kb.id = ak.kb_id
		WHERE ak.tenant_id = $1 AND ak.agent_id = $2
		ORDER BY kb.created_at ASC LIMIT 50
	`, tenantID, agentID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]domain.AIKnowledgeBase, 0)
	for rows.Next() {
		kb, err := scanKB(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, *kb)
	}
	return out, rows.Err()
}

// IncrementAgentChatCount 对话轮数计数（best-effort）。
func (s *AICenterStore) IncrementAgentChatCount(ctx context.Context, tenantID, agentID string) {
	_, _ = s.q.Exec(ctx, `UPDATE ai_agents SET chat_count = chat_count + 1 WHERE tenant_id = $1 AND id = $2`, tenantID, agentID)
}

// ==================== 召回检索（§2.2 安全锚点：SQL 层可见性过滤）====================

// SearchChunks 在指定知识库集合内按 pg_trgm 相似度召回分块。
// 只召回请求者可见的库：published / owner / 协作者；这是检索越权的唯一防线，不得绕过。
func (s *AICenterStore) SearchChunks(ctx context.Context, tenantID, userID string, kbIDs []string, queries []string, limit int) ([]domain.AIKBChunk, error) {
	if len(kbIDs) == 0 || len(queries) == 0 {
		return nil, nil
	}
	// 对每个查询子句取相似度（$4 起），跨子句取最大值排序
	args := []any{tenantID, userID, kbIDs}
	parts := make([]string, len(queries))
	for i, q := range queries {
		args = append(args, q)
		parts[i] = fmt.Sprintf(`similarity(c.content, $%d)`, 4+i)
	}
	sim := "greatest(" + strings.Join(parts, ", ") + ")"
	args = append(args, limit)
	rows, err := s.q.Query(ctx, `
		SELECT c.id, c.tenant_id, c.doc_id, c.kb_id, c.seq, c.content, d.name
		FROM ai_kb_chunks c
		JOIN ai_kb_documents d ON d.id = c.doc_id AND d.status = 'ready'
		JOIN ai_knowledge_bases kb ON kb.id = c.kb_id
		WHERE c.tenant_id = $1
		  AND c.kb_id = ANY($3)
		  AND (kb.status = 'published'
		       OR kb.owner_id = $2
		       OR EXISTS (SELECT 1 FROM ai_kb_collaborators col WHERE col.kb_id = kb.id AND col.user_id = $2))
		  AND `+sim+` > 0.05
		ORDER BY `+sim+` DESC
		LIMIT $`+fmt.Sprint(len(args)), args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]domain.AIKBChunk, 0)
	for rows.Next() {
		var c domain.AIKBChunk
		if err := rows.Scan(&c.ID, &c.TenantID, &c.DocID, &c.KbID, &c.Seq, &c.Content, &c.DocName); err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	return out, rows.Err()
}

// ==================== 会话与消息 ====================

// CreateConversation 新建会话。
func (s *AICenterStore) CreateConversation(ctx context.Context, cv *domain.AIConversation) error {
	return s.q.QueryRow(ctx, `
		INSERT INTO ai_conversations (tenant_id, agent_id, user_id, title)
		VALUES ($1, NULLIF($2, '')::uuid, $3, $4)
		RETURNING id, created_at, updated_at
	`, cv.TenantID, cv.AgentID, cv.UserID, cv.Title).Scan(&cv.ID, &cv.CreatedAt, &cv.UpdatedAt)
}

// GetConversation 取会话。
func (s *AICenterStore) GetConversation(ctx context.Context, tenantID, id string) (*domain.AIConversation, error) {
	var cv domain.AIConversation
	var agentID *string
	err := s.q.QueryRow(ctx, `
		SELECT id, tenant_id, agent_id, user_id, title, created_at, updated_at
		FROM ai_conversations WHERE tenant_id = $1 AND id = $2
	`, tenantID, id).Scan(&cv.ID, &cv.TenantID, &agentID, &cv.UserID, &cv.Title, &cv.CreatedAt, &cv.UpdatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if agentID != nil {
		cv.AgentID = *agentID
	}
	return &cv, err
}

// ListConversations 我在某智能体下的会话（最近更新在前）。
func (s *AICenterStore) ListConversations(ctx context.Context, tenantID, agentID, userID string) ([]domain.AIConversation, error) {
	rows, err := s.q.Query(ctx, `
		SELECT id, tenant_id, agent_id, user_id, title, created_at, updated_at
		FROM ai_conversations WHERE tenant_id = $1 AND agent_id = $2 AND user_id = $3
		ORDER BY updated_at DESC LIMIT 100
	`, tenantID, agentID, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]domain.AIConversation, 0)
	for rows.Next() {
		var cv domain.AIConversation
		var agentID *string
		if err := rows.Scan(&cv.ID, &cv.TenantID, &agentID, &cv.UserID, &cv.Title, &cv.CreatedAt, &cv.UpdatedAt); err != nil {
			return nil, err
		}
		if agentID != nil {
			cv.AgentID = *agentID
		}
		out = append(out, cv)
	}
	return out, rows.Err()
}

// ListGeneralConversations 我的通用（YIKnow）会话（agent_id IS NULL，最近更新在前）。
func (s *AICenterStore) ListGeneralConversations(ctx context.Context, tenantID, userID string) ([]domain.AIConversation, error) {
	rows, err := s.q.Query(ctx, `
		SELECT id, tenant_id, agent_id, user_id, title, created_at, updated_at
		FROM ai_conversations WHERE tenant_id = $1 AND agent_id IS NULL AND user_id = $2
		ORDER BY updated_at DESC LIMIT 100
	`, tenantID, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]domain.AIConversation, 0)
	for rows.Next() {
		var cv domain.AIConversation
		var agentID *string // 通用会话恒 NULL
		if err := rows.Scan(&cv.ID, &cv.TenantID, &agentID, &cv.UserID, &cv.Title, &cv.CreatedAt, &cv.UpdatedAt); err != nil {
			return nil, err
		}
		if agentID != nil {
			cv.AgentID = *agentID
		}
		out = append(out, cv)
	}
	return out, rows.Err()
}

// TouchConversation 会话活跃时间 + 标题（仅首条消息时设置标题）。
func (s *AICenterStore) TouchConversation(ctx context.Context, tenantID, id, titleIfEmpty string) {
	_, _ = s.q.Exec(ctx, `
		UPDATE ai_conversations SET updated_at = now(),
			title = CASE WHEN title = '' THEN $3 ELSE title END
		WHERE tenant_id = $1 AND id = $2
	`, tenantID, id, titleIfEmpty)
}

// DeleteConversation 删除会话（仅本人；级联消息）。
func (s *AICenterStore) DeleteConversation(ctx context.Context, tenantID, id, userID string) error {
	ct, err := s.q.Exec(ctx, `DELETE FROM ai_conversations WHERE tenant_id = $1 AND id = $2 AND user_id = $3`, tenantID, id, userID)
	if err != nil {
		return err
	}
	if ct.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// InsertMessage 写入消息。
func (s *AICenterStore) InsertMessage(ctx context.Context, m *domain.AIMessage) error {
	sources, _ := json.Marshal(m.Sources)
	if m.Sources == nil {
		sources = []byte("[]")
	}
	return s.q.QueryRow(ctx, `
		INSERT INTO ai_messages (tenant_id, conversation_id, role, content, sources)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id, created_at
	`, m.TenantID, m.ConversationID, m.Role, m.Content, sources).Scan(&m.ID, &m.CreatedAt)
}

// ListMessages 会话消息列表（时间升序）。
func (s *AICenterStore) ListMessages(ctx context.Context, tenantID, conversationID string, limit int) ([]domain.AIMessage, error) {
	rows, err := s.q.Query(ctx, `
		SELECT id, tenant_id, conversation_id, role, content, sources, created_at
		FROM ai_messages WHERE tenant_id = $1 AND conversation_id = $2
		ORDER BY created_at ASC, id ASC LIMIT $3
	`, tenantID, conversationID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]domain.AIMessage, 0)
	for rows.Next() {
		var m domain.AIMessage
		var sources []byte
		if err := rows.Scan(&m.ID, &m.TenantID, &m.ConversationID, &m.Role, &m.Content, &sources, &m.CreatedAt); err != nil {
			return nil, err
		}
		m.Sources = []domain.AIMessageSource{}
		if len(sources) > 0 {
			_ = json.Unmarshal(sources, &m.Sources)
		}
		out = append(out, m)
	}
	return out, rows.Err()
}

// ListRecentMessages 最近 N 条（上下文记忆用；返回时间升序）。
func (s *AICenterStore) ListRecentMessages(ctx context.Context, tenantID, conversationID string, limit int) ([]domain.AIMessage, error) {
	rows, err := s.q.Query(ctx, `
		SELECT id, tenant_id, conversation_id, role, content, sources, created_at
		FROM (
			SELECT * FROM ai_messages WHERE tenant_id = $1 AND conversation_id = $2
			ORDER BY created_at DESC, id DESC LIMIT $3
		) t ORDER BY created_at ASC, id ASC
	`, tenantID, conversationID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]domain.AIMessage, 0)
	for rows.Next() {
		var m domain.AIMessage
		var sources []byte
		if err := rows.Scan(&m.ID, &m.TenantID, &m.ConversationID, &m.Role, &m.Content, &sources, &m.CreatedAt); err != nil {
			return nil, err
		}
		m.Sources = []domain.AIMessageSource{}
		if len(sources) > 0 {
			_ = json.Unmarshal(sources, &m.Sources)
		}
		out = append(out, m)
	}
	return out, rows.Err()
}

// ==================== 第三方挂接 ====================

// ListIntegrations 挂接列表（admin 全量 / 广场仅 active）。
func (s *AICenterStore) ListIntegrations(ctx context.Context, tenantID, kind string, onlyActive bool) ([]domain.AIIntegration, error) {
	where := `tenant_id = $1`
	args := []any{tenantID}
	if kind != "" {
		args = append(args, kind)
		where += fmt.Sprintf(` AND kind = $%d`, len(args))
	}
	if onlyActive {
		where += ` AND status = 'active'`
	}
	rows, err := s.q.Query(ctx, `
		SELECT id, tenant_id, kind, name, description, url, icon, category, sort, status, created_by, created_at, updated_at
		FROM ai_integrations WHERE `+where+` ORDER BY sort ASC, created_at DESC LIMIT 200
	`, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]domain.AIIntegration, 0)
	for rows.Next() {
		var it domain.AIIntegration
		var createdBy *string
		if err := rows.Scan(&it.ID, &it.TenantID, &it.Kind, &it.Name, &it.Description, &it.URL, &it.Icon,
			&it.Category, &it.Sort, &it.Status, &createdBy, &it.CreatedAt, &it.UpdatedAt); err != nil {
			return nil, err
		}
		if createdBy != nil {
			it.CreatedBy = *createdBy
		}
		out = append(out, it)
	}
	return out, rows.Err()
}

// CreateIntegration 新建挂接。
func (s *AICenterStore) CreateIntegration(ctx context.Context, it *domain.AIIntegration) error {
	return s.q.QueryRow(ctx, `
		INSERT INTO ai_integrations (tenant_id, kind, name, description, url, icon, category, sort, created_by)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NULLIF($9, '')::uuid)
		RETURNING id, status, created_at, updated_at
	`, it.TenantID, it.Kind, it.Name, it.Description, it.URL, it.Icon, it.Category, it.Sort, it.CreatedBy).
		Scan(&it.ID, &it.Status, &it.CreatedAt, &it.UpdatedAt)
}

// UpdateIntegration 编辑挂接。
func (s *AICenterStore) UpdateIntegration(ctx context.Context, it *domain.AIIntegration) error {
	ct, err := s.q.Exec(ctx, `
		UPDATE ai_integrations SET kind = $3, name = $4, description = $5, url = $6, icon = $7, category = $8, sort = $9, updated_at = now()
		WHERE tenant_id = $1 AND id = $2
	`, it.TenantID, it.ID, it.Kind, it.Name, it.Description, it.URL, it.Icon, it.Category, it.Sort)
	if err != nil {
		return err
	}
	if ct.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// SetIntegrationStatus 上下架切换。
func (s *AICenterStore) SetIntegrationStatus(ctx context.Context, tenantID, id, status string) error {
	ct, err := s.q.Exec(ctx, `UPDATE ai_integrations SET status = $3, updated_at = now() WHERE tenant_id = $1 AND id = $2`, tenantID, id, status)
	if err != nil {
		return err
	}
	if ct.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// DeleteIntegration 删除挂接。
func (s *AICenterStore) DeleteIntegration(ctx context.Context, tenantID, id string) error {
	ct, err := s.q.Exec(ctx, `DELETE FROM ai_integrations WHERE tenant_id = $1 AND id = $2`, tenantID, id)
	if err != nil {
		return err
	}
	if ct.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// ==================== 审核 ====================

// InsertReviewLog 审核留痕。
func (s *AICenterStore) InsertReviewLog(ctx context.Context, log *domain.AIReviewLog) error {
	return s.q.QueryRow(ctx, `
		INSERT INTO ai_review_logs (tenant_id, target_type, target_id, action, actor_id, comment)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id, created_at
	`, log.TenantID, log.TargetType, log.TargetID, log.Action, log.ActorID, log.Comment).Scan(&log.ID, &log.CreatedAt)
}

// ListReviewKBs 审核列表（知识库，含提交人姓名）。
func (s *AICenterStore) ListReviewKBs(ctx context.Context, tenantID, status string, page, pageSize int) ([]domain.AIKnowledgeBase, int, error) {
	args := []any{tenantID}
	where := `kb.tenant_id = $1`
	if status != "" {
		args = append(args, status)
		where += fmt.Sprintf(` AND kb.status = $%d`, len(args))
	} else {
		where += ` AND kb.status IN ('pending','published','rejected')`
	}
	var total int
	if err := s.q.QueryRow(ctx, `SELECT COUNT(*) FROM ai_knowledge_bases kb WHERE `+where, args...).Scan(&total); err != nil {
		return nil, 0, err
	}
	args = append(args, pageSize, (page-1)*pageSize)
	rows, err := s.q.Query(ctx, `
		SELECT `+kbCols("kb")+`, `+kbViewExpr("kb")+`, COALESCE(u.name, '') FROM ai_knowledge_bases kb
		LEFT JOIN users u ON u.id = kb.owner_id
		WHERE `+where+` ORDER BY CASE kb.status WHEN 'pending' THEN 0 ELSE 1 END, kb.updated_at DESC
		LIMIT $`+fmt.Sprint(len(args)-1)+` OFFSET $`+fmt.Sprint(len(args)), args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	out := make([]domain.AIKnowledgeBase, 0)
	for rows.Next() {
		kb, err := scanKBWithOwner(rows)
		if err != nil {
			return nil, 0, err
		}
		out = append(out, *kb)
	}
	return out, total, rows.Err()
}

// ListReviewAgents 审核列表（智能体）。
func (s *AICenterStore) ListReviewAgents(ctx context.Context, tenantID, status string, page, pageSize int) ([]domain.AIAgent, int, error) {
	args := []any{tenantID}
	where := `a.tenant_id = $1`
	if status != "" {
		args = append(args, status)
		where += fmt.Sprintf(` AND a.status = $%d`, len(args))
	} else {
		where += ` AND a.status IN ('pending','published','rejected')`
	}
	var total int
	if err := s.q.QueryRow(ctx, `SELECT COUNT(*) FROM ai_agents a WHERE `+where, args...).Scan(&total); err != nil {
		return nil, 0, err
	}
	args = append(args, pageSize, (page-1)*pageSize)
	rows, err := s.q.Query(ctx, `
		SELECT a.`+strings.ReplaceAll(agentColumns, `, `, `, a.`)+`, `+agentViewExpr("a")+`, COALESCE(u.name, '')
		FROM ai_agents a LEFT JOIN users u ON u.id = a.owner_id
		WHERE `+where+` ORDER BY CASE a.status WHEN 'pending' THEN 0 ELSE 1 END, a.updated_at DESC
		LIMIT $`+fmt.Sprint(len(args)-1)+` OFFSET $`+fmt.Sprint(len(args)), args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	out := make([]domain.AIAgent, 0)
	for rows.Next() {
		var a domain.AIAgent
		var reviewedBy *string
		if err := rows.Scan(&a.ID, &a.TenantID, &a.OwnerID, &a.Name, &a.Avatar, &a.Description, &a.CoverImage,
			&a.Greeting, &a.SystemPrompt, &a.Status, &a.ReviewComment, &reviewedBy, &a.ReviewedAt, &a.ChatCount,
			&a.CreatedAt, &a.UpdatedAt, &a.ViewCount, &a.OwnerName); err != nil {
			return nil, 0, err
		}
		if reviewedBy != nil {
			a.ReviewedBy = *reviewedBy
		}
		out = append(out, a)
	}
	return out, total, rows.Err()
}

// AdminOverview 管理端简统计。
func (s *AICenterStore) AdminOverview(ctx context.Context, tenantID string) (map[string]int64, error) {
	out := map[string]int64{}
	queries := map[string]string{
		"kbTotal":        `SELECT COUNT(*) FROM ai_knowledge_bases WHERE tenant_id = $1`,
		"kbPending":      `SELECT COUNT(*) FROM ai_knowledge_bases WHERE tenant_id = $1 AND status = 'pending'`,
		"kbPublished":    `SELECT COUNT(*) FROM ai_knowledge_bases WHERE tenant_id = $1 AND status = 'published'`,
		"agentTotal":     `SELECT COUNT(*) FROM ai_agents WHERE tenant_id = $1`,
		"agentPending":   `SELECT COUNT(*) FROM ai_agents WHERE tenant_id = $1 AND status = 'pending'`,
		"agentPublished": `SELECT COUNT(*) FROM ai_agents WHERE tenant_id = $1 AND status = 'published'`,
		"integrations":   `SELECT COUNT(*) FROM ai_integrations WHERE tenant_id = $1 AND status = 'active'`,
	}
	for k, q := range queries {
		var n int64
		if err := s.q.QueryRow(ctx, q, tenantID).Scan(&n); err != nil {
			return nil, err
		}
		out[k] = n
	}
	return out, nil
}

// ==================== 浏览量（v2.2 B5） ====================

// IncrementKBView 浏览计数：并入全局 view_logs + view_counters（v2.2.1，与岗位/场景统一，浏览即 +1 不排 owner）。
func (s *AICenterStore) IncrementKBView(ctx context.Context, tenantID, id string) {
	_ = RecordView(ctx, s.q, "ai_kb", id, nil, tenantID)
}

// IncrementAgentView 浏览计数：并入全局 view_logs + view_counters。
func (s *AICenterStore) IncrementAgentView(ctx context.Context, tenantID, id string) {
	_ = RecordView(ctx, s.q, "ai_agent", id, nil, tenantID)
}

// ==================== 知识库问答记录（v2.2 B6） ====================

// InsertKBAsk 记录一次问答。
func (s *AICenterStore) InsertKBAsk(ctx context.Context, a *domain.AIKBAsk) error {
	return s.q.QueryRow(ctx, `
		INSERT INTO ai_kb_asks (tenant_id, kb_id, user_id, question, answer)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id, created_at
	`, a.TenantID, a.KbID, a.UserID, a.Question, a.Answer).Scan(&a.ID, &a.CreatedAt)
}

// ListMyKBAsks 我在某知识库下的提问历史（最近在前，≤50）。
func (s *AICenterStore) ListMyKBAsks(ctx context.Context, tenantID, kbID, userID string) ([]domain.AIKBAsk, error) {
	rows, err := s.q.Query(ctx, `
		SELECT id, tenant_id, kb_id, user_id, question, answer, created_at
		FROM ai_kb_asks WHERE tenant_id = $1 AND kb_id = $2 AND user_id = $3
		ORDER BY created_at DESC LIMIT 50
	`, tenantID, kbID, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]domain.AIKBAsk, 0)
	for rows.Next() {
		var a domain.AIKBAsk
		if err := rows.Scan(&a.ID, &a.TenantID, &a.KbID, &a.UserID, &a.Question, &a.Answer, &a.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, a)
	}
	return out, rows.Err()
}
