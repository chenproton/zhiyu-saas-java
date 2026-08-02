package main

import (
	"context"
	"fmt"
	"os"

	"github.com/google/uuid"
	"github.com/zhiyu-saas/backend/internal/config"
	"github.com/zhiyu-saas/backend/internal/db"
	"golang.org/x/crypto/bcrypt"
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

	ctx := context.Background()

	operatorTenantID := uuid.MustParse("00000000-0000-0000-0000-000000000001")
	platformAdminRoleID := uuid.MustParse("00000000-0000-0000-0000-000000000002")
	platformAdminUserID := uuid.MustParse("00000000-0000-0000-0000-000000000003")

	var count int
	_ = database.Pool.QueryRow(ctx, `SELECT COUNT(*) FROM tenants`).Scan(&count)
	seeded := count > 0

	adminPassword := os.Getenv("SEED_ADMIN_PASSWORD")
	if adminPassword == "" {
		fmt.Println("SEED_ADMIN_PASSWORD 未设置，跳过种子数据")
		return
	}

	// 已有种子数据时，仅重置 admin 密码（支持密码变更后重跑 deploy.sh）
	if seeded {
		hashedPassword, err := bcrypt.GenerateFromPassword([]byte(adminPassword), bcrypt.DefaultCost)
		if err != nil {
			fmt.Println("bcrypt error:", err)
			os.Exit(1)
		}
		_, err = database.Pool.Exec(ctx, `
			UPDATE users SET password_hash = $1 WHERE login_name = 'admin' AND platform = 'saas'
		`, string(hashedPassword))
		if err != nil {
			fmt.Println("update admin password error:", err)
			os.Exit(1)
		}
		fmt.Println("数据库已有数据，已重置 admin 密码（密码通过 SEED_ADMIN_PASSWORD 提供）")
		return
	}

	tx, err := database.Pool.Begin(ctx)
	if err != nil {
		fmt.Println("begin tx error:", err)
		os.Exit(1)
	}
	defer tx.Rollback(ctx)

	_, err = tx.Exec(ctx, `
		INSERT INTO tenants (id, name, code, status, created_at, updated_at)
		VALUES ($1, '运营管理平台', 'platform', 'active', NOW(), NOW())
		ON CONFLICT (id) DO NOTHING
	`, operatorTenantID)
	if err != nil {
		fmt.Println("insert tenant error:", err)
		os.Exit(1)
	}

	_, err = tx.Exec(ctx, `
		INSERT INTO roles (id, tenant_id, code, name, permissions, user_count, status, created_at)
		VALUES ($1, $2, 'platform_admin', '平台管理员', '{}'::jsonb, 0, 'active', NOW())
		ON CONFLICT (id) DO NOTHING
	`, platformAdminRoleID, operatorTenantID)
	if err != nil {
		fmt.Println("insert role error:", err)
		os.Exit(1)
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(adminPassword), bcrypt.DefaultCost)
	if err != nil {
		fmt.Println("bcrypt error:", err)
		os.Exit(1)
	}

	_, err = tx.Exec(ctx, `
		INSERT INTO users (id, tenant_id, login_name, username, name, role, platform, password_hash, status, created_at, updated_at)
		VALUES ($1, $2, 'admin', 'admin', '平台管理员', 'school', 'saas', $3, 'active', NOW(), NOW())
		ON CONFLICT (id) DO NOTHING
	`, platformAdminUserID, operatorTenantID, string(hashedPassword))
	if err != nil {
		fmt.Println("insert user error:", err)
		os.Exit(1)
	}

	_, err = tx.Exec(ctx, `
		INSERT INTO user_roles (user_id, role_id)
		VALUES ($1, $2)
		ON CONFLICT DO NOTHING
	`, platformAdminUserID, platformAdminRoleID)
	if err != nil {
		fmt.Println("insert user_roles error:", err)
		os.Exit(1)
	}

	_, err = tx.Exec(ctx, `UPDATE roles SET user_count = user_count + 1 WHERE id = $1`, platformAdminRoleID)
	if err != nil {
		fmt.Println("update role count error:", err)
		os.Exit(1)
	}

	if err := tx.Commit(ctx); err != nil {
		fmt.Println("commit error:", err)
		os.Exit(1)
	}

	fmt.Println("种子数据初始化完成")
	fmt.Println("  运营方租户: platform (ID: 00000000-0000-0000-0000-000000000001)")
	fmt.Println("  平台管理员: admin（密码通过 SEED_ADMIN_PASSWORD 提供）")
}
