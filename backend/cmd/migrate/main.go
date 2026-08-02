package main

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/zhiyu-saas/backend/internal/config"
	"github.com/zhiyu-saas/backend/internal/db"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		fmt.Println("config error:", err)
		os.Exit(1)
	}

	database, err := db.New(cfg.DatabaseURL)
	if err != nil {
		fmt.Println("db error:", err)
		os.Exit(1)
	}
	defer database.Close()

	conn, err := database.Pool.Acquire(ctx())
	if err != nil {
		fmt.Println("acquire error:", err)
		os.Exit(1)
	}
	defer conn.Release()

	if _, err := conn.Exec(ctx(), `
		CREATE TABLE IF NOT EXISTS schema_migrations (
			version VARCHAR(255) PRIMARY KEY,
			applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)
	`); err != nil {
		fmt.Println("migration table error:", err)
		os.Exit(1)
	}

	dir := "migrations"
	if len(os.Args) > 2 && os.Args[1] == "-dir" {
		dir = os.Args[2]
	}

	command := "up"
	for _, arg := range os.Args[1:] {
		if arg == "up" || arg == "down" {
			command = arg
		}
	}

	if command == "up" {
		if err := migrateUp(conn.Conn(), dir); err != nil {
			fmt.Println("migrate up error:", err)
			os.Exit(1)
		}
	} else {
		if err := migrateDown(conn.Conn(), dir); err != nil {
			fmt.Println("migrate down error:", err)
			os.Exit(1)
		}
	}
}

func migrateUp(conn *pgx.Conn, dir string) error {
	files, err := os.ReadDir(dir)
	if err != nil {
		return err
	}

	var migrations []string
	for _, f := range files {
		if strings.HasSuffix(f.Name(), ".up.sql") {
			migrations = append(migrations, f.Name())
		}
	}
	sort.Slice(migrations, func(i, j int) bool {
		vi, _ := strconv.Atoi(strings.Split(migrations[i], "_")[0])
		vj, _ := strconv.Atoi(strings.Split(migrations[j], "_")[0])
		if vi != vj {
			return vi < vj
		}
		// 同号迁移（历史遗留编号）按文件名稳定排序，保证 up/down 顺序确定
		return migrations[i] < migrations[j]
	})

	for _, name := range migrations {
		version := strings.TrimSuffix(name, ".up.sql")
		var exists bool
		err := conn.QueryRow(ctx(), `SELECT EXISTS(SELECT 1 FROM schema_migrations WHERE version = $1)`, version).Scan(&exists)
		if err != nil {
			return fmt.Errorf("check migration %s: %w", version, err)
		}
		if exists {
			fmt.Println("skip:", name)
			continue
		}

		sql, err := os.ReadFile(filepath.Join(dir, name))
		if err != nil {
			return fmt.Errorf("read migration %s: %w", name, err)
		}

		sqlStr := string(sql)

		if isMultiStatement(sqlStr) {
			if err := execMultiSQL(conn, sqlStr); err != nil {
				return fmt.Errorf("execute migration %s: %w", name, err)
			}
			if _, err := conn.Exec(ctx(), `INSERT INTO schema_migrations (version) VALUES ($1)`, version); err != nil {
				return fmt.Errorf("record migration %s: %w", name, err)
			}
		} else {
			tx, err := conn.Begin(ctx())
			if err != nil {
				return fmt.Errorf("begin migration %s: %w", name, err)
			}
			if _, err := tx.Exec(ctx(), sqlStr); err != nil {
				tx.Rollback(ctx())
				return fmt.Errorf("execute migration %s: %w", name, err)
			}
			if _, err := tx.Exec(ctx(), `INSERT INTO schema_migrations (version) VALUES ($1)`, version); err != nil {
				tx.Rollback(ctx())
				return fmt.Errorf("record migration %s: %w", name, err)
			}
			if err := tx.Commit(ctx()); err != nil {
				return fmt.Errorf("commit migration %s: %w", name, err)
			}
		}
		fmt.Println("applied:", name)
	}
	return nil
}

func migrateDown(conn *pgx.Conn, dir string) error {
	// 按数字版本号降序回滚（字符串排序会把 100_ 排在 99_ 之前）
	rows, err := conn.Query(ctx(), `
		SELECT version FROM schema_migrations
		ORDER BY (regexp_replace(version, '^([0-9]+).*$', '\\1'))::bigint DESC, version DESC
	`)
	if err != nil {
		return fmt.Errorf("list applied migrations: %w", err)
	}
	var applied []string
	for rows.Next() {
		var version string
		if err := rows.Scan(&version); err != nil {
			rows.Close()
			return fmt.Errorf("scan applied migration: %w", err)
		}
		applied = append(applied, version)
	}
	rows.Close()

	for _, version := range applied {
		name := version + ".down.sql"
		path := filepath.Join(dir, name)
		if _, err := os.Stat(path); os.IsNotExist(err) {
			fmt.Println("skip (no down file):", name)
			continue
		}

		sql, err := os.ReadFile(path)
		if err != nil {
			return fmt.Errorf("read migration %s: %w", name, err)
		}

		sqlStr := string(sql)

		if isMultiStatement(sqlStr) {
			if err := execMultiSQL(conn, sqlStr); err != nil {
				return fmt.Errorf("execute rollback %s: %w", name, err)
			}
			if _, err := conn.Exec(ctx(), `DELETE FROM schema_migrations WHERE version = $1`, version); err != nil {
				return fmt.Errorf("record rollback %s: %w", name, err)
			}
		} else {
			tx, err := conn.Begin(ctx())
			if err != nil {
				return fmt.Errorf("begin rollback %s: %w", name, err)
			}
			if _, err := tx.Exec(ctx(), sqlStr); err != nil {
				tx.Rollback(ctx())
				return fmt.Errorf("execute rollback %s: %w", name, err)
			}
			if _, err := tx.Exec(ctx(), `DELETE FROM schema_migrations WHERE version = $1`, version); err != nil {
				tx.Rollback(ctx())
				return fmt.Errorf("record rollback %s: %w", name, err)
			}
			if err := tx.Commit(ctx()); err != nil {
				return fmt.Errorf("commit rollback %s: %w", name, err)
			}
		}
		fmt.Println("rolled back:", name)
	}
	return nil
}

func ctx() context.Context {
	return context.Background()
}

func isMultiStatement(sql string) bool {
	return strings.Count(sql, ";\n") > 1
}

func execMultiSQL(conn *pgx.Conn, sql string) error {
	sql = strings.TrimSpace(sql)
	if sql == "" {
		return nil
	}
	if !strings.HasSuffix(sql, ";") {
		sql += ";"
	}
	stmts := strings.Split(sql, ";\n")
	for j, stmt := range stmts {
		stmt = stripSQLComments(stmt)
		if stmt == "" {
			continue
		}
		if !strings.HasSuffix(stmt, ";") {
			stmt += ";"
		}
		if _, err := conn.Exec(ctx(), stmt); err != nil {
			preview := stmt
			if len(preview) > 120 {
				preview = preview[:120]
			}
			return fmt.Errorf("statement %d: %w\n  sql: %s", j, err, preview)
		}
	}
	return nil
}

// stripSQLComments 移除单行注释并trim，返回可执行的 SQL 主体。
// 仅处理 -- 行注释，保留 SQL 内容；空内容返回空字符串。
func stripSQLComments(stmt string) string {
	lines := strings.Split(stmt, "\n")
	var out []string
	for _, line := range lines {
		trimmed := strings.TrimSpace(line)
		if trimmed == "" || strings.HasPrefix(trimmed, "--") {
			continue
		}
		out = append(out, line)
	}
	return strings.TrimSpace(strings.Join(out, "\n"))
}
