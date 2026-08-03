package store

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/zhiyu-saas/backend/internal/domain"
)

// ApprovalStore 审批记录持久化。
type ApprovalStore struct {
	q Queryer
}

// ErrApprovalExists 目标已有待审批记录。
var ErrApprovalExists = errors.New("approval already pending")

// NewApprovalStore 创建审批 store。
func NewApprovalStore(q Queryer) *ApprovalStore {
	return &ApprovalStore{q: q}
}

// allowedApprovalTables 审批同步实体表白名单。
var allowedApprovalTables = []string{
	"career_positions",
	"scenarios",
	"courses",
	"question_banks",
	"exams",
	"training_programs",
}

// approvalTargetTypeToTable 审批目标类型（记录中存储的单数形式）→ 实体表名映射。
var approvalTargetTypeToTable = map[string]string{
	"career_position":  "career_positions",
	"scenario":         "scenarios",
	"course":           "courses",
	"question_bank":    "question_banks",
	"exam":             "exams",
	"training_program": "training_programs",
}

// List 查询审批记录列表。
func (s *ApprovalStore) List(ctx context.Context, p ListParams, cfg ListQueryConfig[domain.ApprovalRecord]) ([]domain.ApprovalRecord, int, error) {
	return ExecuteListQuery(ctx, s.q, p, cfg, ScanApprovalRows)
}

// ListConfig 返回审批记录列表查询配置，SQL 片段沉淀在 store 层。
func (s *ApprovalStore) ListConfig() ListQueryConfig[domain.ApprovalRecord] {
	return ListQueryConfig[domain.ApprovalRecord]{
		Table:         "approval_records",
		SelectColumns: "id, tenant_id, target_type, target_id, workflow_id, current_step_idx, status, submitter_id, history, created_at, updated_at",
		TenantScoped:  true,
		OrderBy:       "created_at DESC",
		ScanRows:      ScanApprovalRows,
		ExtraFilter: func(p ListParams, qb *ListQueryBuilder) {
			if status := p.Values["status"]; status != "" {
				qb.AddCondition("status = " + qb.NextArg(status))
			}
			if targetType := p.Values["targetType"]; targetType != "" {
				qb.AddCondition("target_type = " + qb.NextArg(targetType))
			}
			if submitterID := p.Values["submitterId"]; submitterID != "" {
				qb.AddCondition("submitter_id = " + qb.NextArg(submitterID))
			}
		},
	}
}

// Get 查询单个审批记录。
func (s *ApprovalStore) Get(ctx context.Context, id string) (*domain.ApprovalRecord, error) {
	ar, err := s.fetchApproval(ctx, id)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return ar, nil
}

// Create 创建审批记录（同一目标仅允许一条 pending 记录，唯一索引兜底）。
func (s *ApprovalStore) Create(ctx context.Context, tenantID *string, p *ApprovalCreateParams) (*domain.ApprovalRecord, error) {
	if p.Status == string(domain.ApprovalStatusPending) {
		exists, err := s.ExistsPending(ctx, p.TargetType, p.TargetID)
		if err != nil {
			return nil, err
		}
		if exists {
			return nil, ErrApprovalExists
		}
	}
	var id string
	err := s.q.QueryRow(ctx, `
		INSERT INTO approval_records (id, tenant_id, target_type, target_id, workflow_id,
			current_step_idx, status, submitter_id, history)
		VALUES (gen_random_uuid(), $1, $2, $3, $4, 0, $5, $6, $7)
		RETURNING id
	`, tenantID, p.TargetType, p.TargetID, p.WorkflowID, p.Status, p.SubmitterID, p.History).Scan(&id)
	if err != nil {
		return nil, err
	}
	return s.Get(ctx, id)
}

// ExistsPending 判断目标是否已有待审批记录。
func (s *ApprovalStore) ExistsPending(ctx context.Context, targetType, targetID string) (bool, error) {
	var exists bool
	err := s.q.QueryRow(ctx, `
		SELECT EXISTS (
			SELECT 1 FROM approval_records
			WHERE target_type = $1 AND target_id = $2 AND status = $3
		)
	`, targetType, targetID, string(domain.ApprovalStatusPending)).Scan(&exists)
	return exists, err
}

// UpdateHistory 更新历史（不改变状态）。
func (s *ApprovalStore) UpdateHistory(ctx context.Context, id string, history domain.JSONSlice) (bool, error) {
	tag, err := s.q.Exec(ctx, `
		UPDATE approval_records SET history = $1, updated_at = NOW()
		WHERE id = $2 AND status = $3
	`, history, id, string(domain.ApprovalStatusPending))
	if err != nil {
		return false, err
	}
	return tag.RowsAffected() > 0, nil
}

// RejectRecord 拒绝审批（更新状态+历史）。
func (s *ApprovalStore) RejectRecord(ctx context.Context, tx Queryer, id string, status string, history domain.JSONSlice) (bool, error) {
	tag, err := tx.Exec(ctx, `
		UPDATE approval_records SET status = $1, history = $2, updated_at = NOW()
		WHERE id = $3 AND status = $4
	`, status, history, id, string(domain.ApprovalStatusPending))
	if err != nil {
		return false, err
	}
	return tag.RowsAffected() > 0, nil
}

// AdvanceRecord 推进审批（状态+步骤+历史，CAS 防止并发重复推进）。
func (s *ApprovalStore) AdvanceRecord(ctx context.Context, tx Queryer, id, status string, stepIdx int, oldStepIdx int, history domain.JSONSlice) (bool, error) {
	tag, err := tx.Exec(ctx, `
		UPDATE approval_records SET status = $1, current_step_idx = $2, history = $3, updated_at = NOW()
		WHERE id = $4 AND status = $5 AND current_step_idx = $6
	`, status, stepIdx, history, id, string(domain.ApprovalStatusPending), oldStepIdx)
	if err != nil {
		return false, err
	}
	return tag.RowsAffected() > 0, nil
}

// SyncEntityStatus 同步实体状态（目标类型映射实体表，白名单表校验）。
func (s *ApprovalStore) SyncEntityStatus(ctx context.Context, tx Queryer, targetType, status, targetID, tenantID string) error {
	table, ok := approvalTargetTypeToTable[targetType]
	if !ok {
		return fmt.Errorf("invalid identifier: %s", targetType)
	}
	if _, err := SanitizeIdentifier(table, allowedApprovalTables); err != nil {
		return err
	}
	_, err := tx.Exec(ctx,
		"UPDATE "+table+" SET status = $1, updated_at = NOW() WHERE id = $2 AND tenant_id = $3",
		status, targetID, tenantID)
	return err
}

// ApprovalCreateParams 审批创建参数。
type ApprovalCreateParams struct {
	TargetType  string
	TargetID    string
	WorkflowID  *string
	Status      string
	SubmitterID string
	History     domain.JSONSlice
}

func (s *ApprovalStore) fetchApproval(ctx context.Context, id string) (*domain.ApprovalRecord, error) {
	var ar domain.ApprovalRecord
	var tenantID, workflowID *string
	var history domain.JSONSlice
	err := s.q.QueryRow(ctx, `
		SELECT id, tenant_id, target_type, target_id, workflow_id, current_step_idx, status,
			submitter_id, history, created_at, updated_at
		FROM approval_records WHERE id = $1
	`, id).Scan(&ar.ID, &tenantID, &ar.TargetType, &ar.TargetID, &workflowID, &ar.CurrentStepIdx,
		&ar.Status, &ar.SubmitterID, &history, &ar.CreatedAt, &ar.UpdatedAt)
	if err != nil {
		return nil, err
	}
	ar.TenantID = tenantID
	ar.WorkflowID = workflowID
	ar.History = history
	return &ar, nil
}

// ScanApprovalRows 扫描审批记录行。
func ScanApprovalRows(rows pgx.Rows) ([]domain.ApprovalRecord, error) {
	items := make([]domain.ApprovalRecord, 0)
	for rows.Next() {
		var ar domain.ApprovalRecord
		var tenantID, workflowID *string
		var history domain.JSONSlice
		if err := rows.Scan(&ar.ID, &tenantID, &ar.TargetType, &ar.TargetID, &workflowID, &ar.CurrentStepIdx,
			&ar.Status, &ar.SubmitterID, &history, &ar.CreatedAt, &ar.UpdatedAt); err != nil {
			return nil, err
		}
		ar.TenantID = tenantID
		ar.WorkflowID = workflowID
		ar.History = history
		items = append(items, ar)
	}
	return items, rows.Err()
}
