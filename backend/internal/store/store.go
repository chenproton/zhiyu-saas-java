package store

import (
	"context"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Queryer 是数据访问的最小查询接口，*pgxpool.Pool 与 pgx.Tx 均满足。
// 领域 store 方法以 Queryer 为参数，天然支持事务内组合。
type Queryer interface {
	Query(ctx context.Context, sql string, args ...any) (pgx.Rows, error)
	QueryRow(ctx context.Context, sql string, args ...any) pgx.Row
	Exec(ctx context.Context, sql string, args ...any) (pgconn.CommandTag, error)
}

// Store 是数据访问层统一入口：持有查询器，提供事务模板。
// 各领域 store 类型（AllianceStore、RolesStore 等）延续独立类型模式；
// service 层通过 NewWithTx 获得基于同一事务的 Store，保证跨 store 原子性。
type Store struct {
	q              Queryer
	resourceLib    *ResourceLibraryStore
}

// New 创建统一 store 入口（连接池模式）。
func New(db *pgxpool.Pool) *Store {
	return &Store{
		q:           db,
		resourceLib: NewResourceLibraryStore(db),
	}
}

// NewWithTx 创建基于既有事务的 store 入口（pgx.Tx 满足 Queryer）。
func NewWithTx(tx pgx.Tx) *Store {
	return &Store{
		q:           tx,
		resourceLib: NewResourceLibraryStore(tx),
	}
}

// Q 暴露查询器，供各领域 store 方法执行 SQL。
func (s *Store) Q() Queryer {
	return s.q
}

// ResourceLibrary 返回资源库 store。
func (s *Store) ResourceLibrary() *ResourceLibraryStore {
	return s.resourceLib
}

// Begin 开启事务，供 service 层 WithTx 使用。
func (s *Store) Begin(ctx context.Context) (pgx.Tx, error) {
	pool, ok := s.q.(*pgxpool.Pool)
	if !ok {
		return nil, pgx.ErrTxClosed
	}
	return pool.Begin(ctx)
}
