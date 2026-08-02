package store

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/zhiyu-saas/backend/internal/domain"
)

// txBeginner 事务启动器（*pgxpool.Pool 与已开启的 pgx.Tx 均满足 Begin 语义）。
type txBeginner interface {
	Begin(ctx context.Context) (pgx.Tx, error)
}

// AllowedContentTables 内容动作允许操作的表白名单（handler 侧校验共用，单一真相）。
var AllowedContentTables = []string{"career_positions", "courses", "exams", "question_banks", "scenarios", "training_programs"}

// AllowedInviteColumns 内容动作允许更新的协作者列白名单（handler 侧校验共用，单一真相）。
var AllowedInviteColumns = []string{"collaborator_ids", "co_builder_ids", "co_creator_ids", "collaborators"}

// sanitizeIdentifier 校验标识符必须在白名单内，防止 SQL 注入。
func sanitizeIdentifier(identifier string, allowed []string) (string, error) {
	for _, a := range allowed {
		if identifier == a {
			return identifier, nil
		}
	}
	return "", fmt.Errorf("invalid identifier: %s", identifier)
}

// allowedStatusTransitions 定义内容实体允许的状态流转。
// key 为当前状态，value 为可进入的目标状态集合。
var allowedStatusTransitions = map[domain.ContentStatus][]domain.ContentStatus{
	domain.StatusDraft:     {domain.StatusPending, domain.StatusArchived},
	domain.StatusRejected:  {domain.StatusDraft, domain.StatusPending, domain.StatusArchived},
	domain.StatusPending:   {domain.StatusDraft, domain.StatusApproved, domain.StatusRejected},
	domain.StatusApproved:  {domain.StatusDraft, domain.StatusPublished, domain.StatusArchived},
	domain.StatusPublished: {domain.StatusDraft, domain.StatusArchived},
	domain.StatusArchived:  {domain.StatusDraft},
}

// ContentActionStore 封装内容型实体（岗位/场景/课程/题库/试卷/人培方案）共享的
// 状态流转、审核、协作邀请逻辑，供 service/handler 层复用。
type ContentActionStore struct {
	q        Queryer
	beginner txBeginner
}

// NewContentActionStore 创建内容动作 store。
func NewContentActionStore(q Queryer, beginner txBeginner) *ContentActionStore {
	return &ContentActionStore{q: q, beginner: beginner}
}

// tableFor returns the sanitized table name.
func (s *ContentActionStore) tableFor(table string) (string, error) {
	return sanitizeIdentifier(table, AllowedContentTables)
}

// inviteColFor returns the sanitized invite column name.
func (s *ContentActionStore) inviteColFor(inviteCol string) (string, error) {
	return sanitizeIdentifier(inviteCol, AllowedInviteColumns)
}

func canTransition(from, to domain.ContentStatus) bool {
	for _, s := range allowedStatusTransitions[from] {
		if s == to {
			return true
		}
	}
	return false
}

// GetTenantID 查询内容实体的租户 ID。
func (s *ContentActionStore) GetTenantID(ctx context.Context, table, id string) (string, error) {
	tbl, err := s.tableFor(table)
	if err != nil {
		return "", err
	}
	var tenantID string
	err = s.q.QueryRow(ctx, `SELECT tenant_id FROM `+tbl+` WHERE id = $1`, id).Scan(&tenantID)
	if err == pgx.ErrNoRows {
		return "", ErrNotFound
	}
	return tenantID, err
}

// GetStatus 查询内容实体当前状态。
func (s *ContentActionStore) GetStatus(ctx context.Context, table, id string) (domain.ContentStatus, error) {
	tbl, err := s.tableFor(table)
	if err != nil {
		return "", err
	}
	var status domain.ContentStatus
	err = s.q.QueryRow(ctx, `SELECT status FROM `+tbl+` WHERE id = $1`, id).Scan(&status)
	if err == pgx.ErrNoRows {
		return "", ErrNotFound
	}
	return status, err
}

// Transition 执行状态流转，包含事务与审批记录清理。
// hook 在事务提交前调用，可用于同时更新关联资源。
func (s *ContentActionStore) Transition(ctx context.Context, table, id string, to domain.ContentStatus, targetType string, hook func(tx pgx.Tx, id string) error) error {
	tbl, err := s.tableFor(table)
	if err != nil {
		return err
	}

	current, err := s.GetStatus(ctx, table, id)
	if err != nil {
		return err
	}
	if !canTransition(current, to) {
		return fmt.Errorf("invalid transition: %s -> %s", current, to)
	}

	if s.beginner == nil {
		return fmt.Errorf("content action store requires a transaction beginner")
	}
	tx, err := s.beginner.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback(ctx)

	if _, err := tx.Exec(ctx, `UPDATE `+tbl+` SET status = $1, updated_at = NOW() WHERE id = $2`, to, id); err != nil {
		return fmt.Errorf("update status: %w", err)
	}

	// 从审批中撤回时，同步删除审批中心对应的待审批记录
	if current == domain.StatusPending && to == domain.StatusDraft && targetType != "" {
		if _, err := tx.Exec(ctx, `
			DELETE FROM approval_records
			WHERE target_type = $1 AND target_id = $2 AND status = $3
		`, targetType, id, string(domain.ApprovalStatusPending)); err != nil {
			return fmt.Errorf("delete approval records: %w", err)
		}
	}

	if hook != nil {
		if err := hook(tx, id); err != nil {
			return err
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("commit tx: %w", err)
	}
	return nil
}

// Review 审核内容实体（仅允许 pending -> approved/rejected）。
func (s *ContentActionStore) Review(ctx context.Context, table, id string, status domain.ContentStatus) error {
	tbl, err := s.tableFor(table)
	if err != nil {
		return err
	}
	if status != domain.StatusApproved && status != domain.StatusRejected {
		return fmt.Errorf("invalid review status: %s", status)
	}
	tag, err := s.q.Exec(ctx, `UPDATE `+tbl+` SET status = $1, updated_at = NOW() WHERE id = $2 AND status = $3`, status, id, domain.StatusPending)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// Invite 邀请协作者。
func (s *ContentActionStore) Invite(ctx context.Context, table, id, inviteCol, userID string) error {
	tbl, err := s.tableFor(table)
	if err != nil {
		return err
	}
	col, err := s.inviteColFor(inviteCol)
	if err != nil {
		return err
	}
	if _, err := s.q.Exec(ctx, `
		UPDATE `+tbl+` SET `+col+` = array_append(`+col+`, $1), updated_at = NOW()
		WHERE id = $2 AND NOT (`+col+` @> ARRAY[$1]::uuid[])
	`, userID, id); err != nil {
		return err
	}
	return nil
}
