package store

import (
	"context"
	"fmt"
	"strconv"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/zhiyu-saas/backend/internal/domain"
)

// txBeginner 事务启动器（*pgxpool.Pool 与已开启的 pgx.Tx 均满足 Begin 语义）。
type txBeginner interface {
	Begin(ctx context.Context) (pgx.Tx, error)
}

// AllowedContentTables 内容动作允许操作的表白名单（handler 侧校验共用，单一真相）。
var AllowedContentTables = []string{"career_positions", "courses", "exams", "question_banks", "scenarios", "training_programs", "teaching_plans"}

// AllowedInviteColumns 内容动作允许更新的协作者列白名单（handler 侧校验共用，单一真相）。
var AllowedInviteColumns = []string{"collaborator_ids", "co_builder_ids", "co_creator_ids", "collaborators"}

// versionedContentTables 含 version 列的内容实体：每次发布（重新发布）时版本号自动 +0.1。
var versionedContentTables = map[string]bool{
	"career_positions": true,
	"courses":          true,
	"exams":            true,
	"question_banks":   true,
	"scenarios":        true,
}

// NextVersion 计算发布后的版本号：次版本 +0.1，满 10 进 1（1.9→2.0），保留 V 大写前缀。
// 解析规则：剥离首尾空白与 v/V 前缀，取前两段数字；无法解析或为空时按 V1.0 起算。
func NextVersion(v string) string {
	major, minor := 1, 0
	digits := strings.Trim(strings.TrimSpace(v), "vV")
	parts := strings.Split(digits, ".")
	if len(parts) > 0 {
		if n, err := strconv.Atoi(strings.TrimSpace(parts[0])); err == nil {
			major = n
		}
	}
	if len(parts) > 1 {
		if n, err := strconv.Atoi(strings.TrimSpace(parts[1])); err == nil {
			minor = n
		}
	}
	minor++
	if minor >= 10 {
		major++
		minor = 0
	}
	return fmt.Sprintf("V%d.%d", major, minor)
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
	return SanitizeIdentifier(table, AllowedContentTables)
}

// inviteColFor returns the sanitized invite column name.
func (s *ContentActionStore) inviteColFor(inviteCol string) (string, error) {
	return SanitizeIdentifier(inviteCol, AllowedInviteColumns)
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
// hook 在事务提交前调用，接收基于同一事务的 store 入口，可用于同时更新关联资源。
func (s *ContentActionStore) Transition(ctx context.Context, table, id string, to domain.ContentStatus, targetType string, hook func(txStore *Store, id string) error) error {
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
	return withTxStore(ctx, s.beginner, func(tx pgx.Tx) error {
		// CAS 更新：仅当状态仍为读取时的值才流转，防止并发双发重复触发 hook（如发布时生成测评资源）
		tag, err := tx.Exec(ctx, `UPDATE `+tbl+` SET status = $1, updated_at = NOW() WHERE id = $2 AND status = $3`, to, id, current)
		if err != nil {
			return fmt.Errorf("update status: %w", err)
		}
		if tag.RowsAffected() == 0 {
			return fmt.Errorf("status changed concurrently")
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

		// 发布时自动递增版本号：V1.0→V1.1，1.9→2.0（含 version 列的实体）
		if to == domain.StatusPublished && versionedContentTables[tbl] {
			var v string
			if err := tx.QueryRow(ctx, `SELECT COALESCE(version, '') FROM `+tbl+` WHERE id = $1`, id).Scan(&v); err != nil {
				return fmt.Errorf("read version: %w", err)
			}
			if _, err := tx.Exec(ctx, `UPDATE `+tbl+` SET version = $1, updated_at = NOW() WHERE id = $2`, NextVersion(v), id); err != nil {
				return fmt.Errorf("bump version: %w", err)
			}
		}

		if hook != nil {
			if err := hook(NewWithTx(tx), id); err != nil {
				return err
			}
		}
		return nil
	})
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
