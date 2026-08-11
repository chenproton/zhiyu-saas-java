package store

import (
	"context"
	"errors"
	"testing"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

// noRowsRow 是恒返回 pgx.ErrNoRows 的假 Row。
type noRowsRow struct{}

func (noRowsRow) Scan(dest ...any) error { return pgx.ErrNoRows }

// noRowsQueryer 是恒返回空结果集的假 Queryer。
type noRowsQueryer struct{}

func (noRowsQueryer) Query(ctx context.Context, sql string, args ...any) (pgx.Rows, error) {
	return nil, pgx.ErrNoRows
}

func (noRowsQueryer) QueryRow(ctx context.Context, sql string, args ...any) pgx.Row {
	return noRowsRow{}
}

func (noRowsQueryer) Exec(ctx context.Context, sql string, args ...any) (pgconn.CommandTag, error) {
	return pgconn.CommandTag{}, nil
}

// TestSubscriptionGetByTenantNoRows 无订阅租户应返回 ErrNotFound，
// 保证超管控制台"套餐配置"对未订阅租户返回空订阅而非 500。
func TestSubscriptionGetByTenantNoRows(t *testing.T) {
	s := NewSubscriptionStore(noRowsQueryer{})
	_, err := s.GetByTenant(context.Background(), "tenant-without-subscription")
	if !errors.Is(err, ErrNotFound) {
		t.Fatalf("GetByTenant 应返回 ErrNotFound，实际: %v", err)
	}
}

// TestSubscriptionGetNoRows 单条查询无记录同样映射 ErrNotFound。
func TestSubscriptionGetNoRows(t *testing.T) {
	s := NewSubscriptionStore(noRowsQueryer{})
	_, err := s.Get(context.Background(), "missing-id")
	if !errors.Is(err, ErrNotFound) {
		t.Fatalf("Get 应返回 ErrNotFound，实际: %v", err)
	}
}
