package store

import (
	"context"
	"errors"
	"fmt"
	"os"
	"testing"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

// fakeQueryer 非连接池/非事务的查询器，用于验证 Begin 的嵌套事务防护。
type fakeQueryer struct{}

func (fakeQueryer) Query(ctx context.Context, sql string, args ...any) (pgx.Rows, error) {
	return nil, fmt.Errorf("not implemented")
}

func (fakeQueryer) QueryRow(ctx context.Context, sql string, args ...any) pgx.Row {
	return nil
}

func (fakeQueryer) Exec(ctx context.Context, sql string, args ...any) (pgconn.CommandTag, error) {
	return pgconn.CommandTag{}, fmt.Errorf("not implemented")
}

// TestStoreBeginNestedRejected 非连接池/单连接的查询器（如事务内 pgx.Tx）
// 调 Begin 必须返回 ErrNestedTransaction（嵌套事务防护不回归）。
func TestStoreBeginNestedRejected(t *testing.T) {
	st := newStore(fakeQueryer{})
	if _, err := st.Begin(context.Background()); !errors.Is(err, ErrNestedTransaction) {
		t.Fatalf("应为 ErrNestedTransaction, got: %v", err)
	}
}

// TestStoreWithTxOnConn 调度任务单连接模式（NewConn）下 WithTx 应能开启事务。
// 回归：Begin 曾仅识别 *pgxpool.Pool，scheduler 的 NewConn(conn) 汇聚任务
// 每天报 ErrNestedTransaction 静默失败。
// 需要 TEST_DATABASE_URL（真实库才能 Acquire 单连接）。
func TestStoreWithTxOnConn(t *testing.T) {
	dbURL := os.Getenv("TEST_DATABASE_URL")
	if dbURL == "" {
		fmt.Println("[store] TEST_DATABASE_URL not set — integration test SKIPPED")
		t.Skip("TEST_DATABASE_URL not set, skipping integration test")
	}
	ctx := context.Background()
	pool, err := pgxpool.New(ctx, dbURL)
	if err != nil {
		t.Fatalf("create pool: %v", err)
	}
	defer pool.Close()

	conn, err := pool.Acquire(ctx)
	if err != nil {
		t.Fatalf("acquire conn: %v", err)
	}
	defer conn.Release()

	st := NewConn(conn)
	var n int
	if err := st.WithTx(ctx, func(txStore *Store) error {
		return txStore.Q().QueryRow(ctx, `SELECT 1`).Scan(&n)
	}); err != nil {
		t.Fatalf("NewConn 模式 WithTx 应成功, got: %v", err)
	}
	if n != 1 {
		t.Fatalf("事务内查询异常: %d", n)
	}
}
