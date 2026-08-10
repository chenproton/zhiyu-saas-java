// Package mask 提供敏感字段统一脱敏工具。
// 策略：手机号保留前 3 后 4、身份证保留前 3 后 3、邮箱保留首字符+域名、
// 学号/工号保留前 2 后 2；短字符串整体掩码。脱敏仅在输出侧（handler 响应前）执行，
// store/service 层始终保留原始数据。
package mask

import (
	"strings"

	"github.com/zhiyu-saas/backend/internal/domain"
)

// Phone 手机号：138****5678
func Phone(s string) string {
	r := []rune(s)
	if len(r) < 7 {
		return "******"
	}
	return string(r[:3]) + "****" + string(r[len(r)-4:])
}

// IDCard 身份证号：保留前 3 后 3，短号整体掩码
func IDCard(s string) string {
	r := []rune(s)
	if len(r) <= 6 {
		return "******"
	}
	return string(r[:3]) + "********" + string(r[len(r)-3:])
}

// Email 邮箱：首字符 + *** + @域名
func Email(s string) string {
	at := strings.Index(s, "@")
	if at <= 1 {
		return "***"
	}
	return s[:1] + "***" + s[at:]
}

// Code 学号/工号等编号：保留前 2 后 2
func Code(s string) string {
	r := []rune(s)
	if len(r) <= 4 {
		return "****"
	}
	return string(r[:2]) + "****" + string(r[len(r)-2:])
}

// User 按调用方权限对用户敏感字段脱敏（原地修改指针字段）。
// manageUsers 为 true（系统管理角色）时不脱敏，完整字段下发展示/编辑回显。
func User(manageUsers bool, u *domain.User) {
	if u == nil || manageUsers {
		return
	}
	u.Phone = maskPtr(u.Phone, Phone)
	u.Email = maskPtr(u.Email, Email)
	u.IDCard = maskPtr(u.IDCard, IDCard)
	u.StudentNo = maskPtr(u.StudentNo, Code)
	u.WorkID = maskPtr(u.WorkID, Code)
}

func maskPtr(p *string, fn func(string) string) *string {
	if p == nil || *p == "" {
		return p
	}
	v := fn(*p)
	return &v
}
