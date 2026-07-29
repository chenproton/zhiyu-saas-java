package main

import (
	"context"
	"crypto/rand"
	"encoding/base64"
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
	_ = database.Pool.QueryRow(ctx, `SELECT COUNT(*) FROM users`).Scan(&count)
	if count > 0 {
		fmt.Println("数据库已有数据，跳过种子初始化")
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

	adminPassword := os.Getenv("SEED_ADMIN_PASSWORD")
	if adminPassword == "" {
		// 未显式指定时生成随机密码，避免硬编码弱口令
		buf := make([]byte, 18)
		if _, err := rand.Read(buf); err != nil {
			fmt.Println("generate random password error:", err)
			os.Exit(1)
		}
		adminPassword = base64.RawURLEncoding.EncodeToString(buf)
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

	appModules := []struct {
		ID          uuid.UUID
		Platform    string
		Title       string
		Description string
		Href        string
		SortOrder   int
	}{
		{uuid.New(), "course", "课程教学", "数字课程与混合式教学", "/lesson/landing", 1},
		{uuid.New(), "scene", "场景实训", "产业场景与任务实战", "/scene/landing", 2},
		{uuid.New(), "evaluation", "能力评价", "考核测评与能力认定", "/evaluation/landing", 3},
		{uuid.New(), "career", "产业岗位", "产业岗位与学习路径", "/job/landing", 4},
		{uuid.New(), "resource", "知识资源", "知识资源与素材库", "/library/landing", 5},
	}
	for _, m := range appModules {
		_, err = tx.Exec(ctx, `
			INSERT INTO app_modules (id, platform, title, description, href, sort_order, tenant_id)
			VALUES ($1, $2, $3, $4, $5, $6, $7)
			ON CONFLICT DO NOTHING
		`, m.ID, m.Platform, m.Title, m.Description, m.Href, m.SortOrder, nil)
		if err != nil {
			fmt.Println("insert app_module error:", err)
			os.Exit(1)
		}
	}

	platformLinks := []struct {
		ID       uuid.UUID
		Platform string
		URL      string
		Enabled  bool
	}{
		{uuid.New(), "course", "/lesson/landing", true},
		{uuid.New(), "scene", "/scene/landing", true},
		{uuid.New(), "evaluation", "/evaluation/landing", true},
		{uuid.New(), "career", "/job/landing", true},
		{uuid.New(), "resource", "/library/landing", true},
		{uuid.New(), "alliance", "/portal", true},
		{uuid.New(), "mall", "/", true},
		{uuid.New(), "affairs", "/portal", false},
		{uuid.New(), "ai", "/portal", false},
		{uuid.New(), "opc", "/portal", false},
		{uuid.New(), "research", "/portal", false},
		{uuid.New(), "decision", "/portal", false},
	}
	for _, l := range platformLinks {
		_, err = tx.Exec(ctx, `
			INSERT INTO platform_links (id, platform, url, enabled, tenant_id)
			VALUES ($1, $2, $3, $4, $5)
			ON CONFLICT DO NOTHING
		`, l.ID, l.Platform, l.URL, l.Enabled, nil)
		if err != nil {
			fmt.Println("insert platform_link error:", err)
			os.Exit(1)
		}
	}

	if err := tx.Commit(ctx); err != nil {
		fmt.Println("commit error:", err)
		os.Exit(1)
	}

	fmt.Println("种子数据初始化完成")
	fmt.Println("  运营方租户: platform (ID: 00000000-0000-0000-0000-000000000001)")
	fmt.Printf("  平台管理员: admin / %s （仅首次初始化时显示一次，请妥善保存）\n", adminPassword)
}
