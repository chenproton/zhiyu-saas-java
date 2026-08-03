package store

import (
	"context"
	"strings"
	"testing"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

// fakeApprovalTx 记录 Exec 的 SQL（白名单校验通过后才触达 Exec）。
type fakeApprovalTx struct {
	execSQL string
}

func (f *fakeApprovalTx) Query(ctx context.Context, sql string, args ...any) (pgx.Rows, error) {
	return nil, nil
}

func (f *fakeApprovalTx) QueryRow(ctx context.Context, sql string, args ...any) pgx.Row {
	return nil
}

func (f *fakeApprovalTx) Exec(ctx context.Context, sql string, args ...any) (pgconn.CommandTag, error) {
	f.execSQL = sql
	return pgconn.CommandTag{}, nil
}

// TestApprovalTargetTypeMapping 目标类型映射与实体表白名单一一对应（防止再次出现
// "目标类型未映射→白名单校验失败→评审 500"回归）。
func TestApprovalTargetTypeMapping(t *testing.T) {
	for targetType, table := range approvalTargetTypeToTable {
		if _, err := SanitizeIdentifier(table, allowedApprovalTables); err != nil {
			t.Errorf("目标类型 %q 映射的表 %q 未入白名单: %v", targetType, table, err)
		}
	}
	if len(approvalTargetTypeToTable) != len(allowedApprovalTables) {
		t.Errorf("映射数 %d 与白名单数 %d 不一致", len(approvalTargetTypeToTable), len(allowedApprovalTables))
	}
}

// TestSyncEntityStatusMapsTargetType 评审通过时按目标类型映射到实体表执行 UPDATE。
func TestSyncEntityStatusMapsTargetType(t *testing.T) {
	tx := &fakeApprovalTx{}
	s := NewApprovalStore(tx)
	for targetType, table := range approvalTargetTypeToTable {
		t.Run(targetType, func(t *testing.T) {
			tx.execSQL = ""
			if err := s.SyncEntityStatus(context.Background(), tx, targetType, "approved", "id-1", "tenant-1"); err != nil {
				t.Fatalf("SyncEntityStatus(%q) 报错: %v", targetType, err)
			}
			if !strings.Contains(tx.execSQL, "UPDATE "+table+" SET status") {
				t.Fatalf("期望 UPDATE %s，实际: %s", table, tx.execSQL)
			}
		})
	}
}

// TestSyncEntityStatusRejectsUnknownType 未映射/注入的目标类型直接拒绝，不触达 Exec。
func TestSyncEntityStatusRejectsUnknownType(t *testing.T) {
	tx := &fakeApprovalTx{}
	s := NewApprovalStore(tx)
	for _, tt := range []string{"users", "career_position; DROP TABLE users", "", "任意类型"} {
		tx.execSQL = ""
		if err := s.SyncEntityStatus(context.Background(), tx, tt, "approved", "id-1", "tenant-1"); err == nil {
			t.Errorf("SyncEntityStatus(%q) 应被拒绝", tt)
		}
		if tx.execSQL != "" {
			t.Errorf("SyncEntityStatus(%q) 不应触达 Exec: %s", tt, tx.execSQL)
		}
	}
}
