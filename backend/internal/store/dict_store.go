package store

import (
	"context"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

// DictCreateParams 字典型实体的创建参数契约：
// Tenant 返回租户归属，Args 返回列值（SQL 参数自 $3 起，$1=id、$2=tenant_id）。
type DictCreateParams interface {
	Tenant() string
	Args() []any
}

// DictUpdateParams 字典型实体的更新参数契约：Args 返回列值，末位追加 id。
type DictUpdateParams interface {
	Args() []any
}

// DictConfig 是字典型实体的 CRUD 配置，SQL 片段沉淀在 store 层（唯一 SQL 所在）。
// 注意：GetByIDSQL/SelectColumns 的列序必须与 T 的字段序一致，
// 泛型扫描依赖 pgx.RowToStructByPos 的位置映射。
type DictConfig[T any] struct {
	Table         string
	SelectColumns string
	CreateSQL     string // 参数序：$1=id, $2=tenant_id, $3...=CreateParams.Args()
	UpdateSQL     string // 参数序：$1...=UpdateParams.Args(), 末位=id
	GetByIDSQL    string
	DeleteSQL     string
	TenantScoped  bool
	SearchColumns []string
	OrderBy       string
	ExtraFilter   ListQueryFilter
	// ScanRows 自定义行扫描（字段序与 T 不一致或含自定义类型时提供），空则用 pgx.RowToStructByPos。
	ScanRows func(pgx.Rows) ([]T, error)
}

// DictStore 是字典型实体的通用 CRUD 基类（GetByID/Create/Update/Delete/ListConfig）。
// 各领域 store（MajorsStore 等）以嵌入方式复用，额外方法经 s.Q() 直取查询器。
type DictStore[T any] struct {
	q   Queryer
	cfg DictConfig[T]
}

func NewDictStore[T any](q Queryer, cfg DictConfig[T]) *DictStore[T] {
	return &DictStore[T]{q: q, cfg: cfg}
}

// Q 返回底层查询器（供嵌入方实现额外查询方法）。
func (s *DictStore[T]) Q() Queryer {
	return s.q
}

func (s *DictStore[T]) GetByID(ctx context.Context, id string) (T, error) {
	rows, err := s.q.Query(ctx, s.cfg.GetByIDSQL, id)
	if err != nil {
		var zero T
		return zero, err
	}
	defer rows.Close()
	return pgx.CollectOneRow(rows, pgx.RowToStructByPos[T])
}

func (s *DictStore[T]) Create(ctx context.Context, p DictCreateParams) (string, error) {
	id := uuid.NewString()
	args := make([]any, 0, len(p.Args())+2)
	args = append(args, id, p.Tenant())
	args = append(args, p.Args()...)
	if _, err := s.q.Exec(ctx, s.cfg.CreateSQL, args...); err != nil {
		return "", err
	}
	return id, nil
}

func (s *DictStore[T]) Update(ctx context.Context, id string, p DictUpdateParams) error {
	_, err := s.q.Exec(ctx, s.cfg.UpdateSQL, append(p.Args(), id)...)
	return err
}

func (s *DictStore[T]) Delete(ctx context.Context, id string) error {
	_, err := s.q.Exec(ctx, s.cfg.DeleteSQL, id)
	return err
}

func (s *DictStore[T]) ListConfig() ListQueryConfig[T] {
	scanRows := s.cfg.ScanRows
	if scanRows == nil {
		scanRows = func(rows pgx.Rows) ([]T, error) {
			return pgx.CollectRows(rows, pgx.RowToStructByPos[T])
		}
	}
	return ListQueryConfig[T]{
		Table:         s.cfg.Table,
		SelectColumns: s.cfg.SelectColumns,
		TenantScoped:  s.cfg.TenantScoped,
		SearchColumns: s.cfg.SearchColumns,
		OrderBy:       s.cfg.OrderBy,
		ExtraFilter:   s.cfg.ExtraFilter,
		ScanRows:      scanRows,
	}
}
