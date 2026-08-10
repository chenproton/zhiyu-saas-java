package mask

import (
	"strings"
	"testing"

	"github.com/zhiyu-saas/backend/internal/domain"
)

func ptr(s string) *string { return &s }

func TestMaskFunctions(t *testing.T) {
	cases := []struct {
		name string
		fn   func(string) string
		in   string
		want string
	}{
		{"Phone", Phone, "13812345678", "138****5678"},
		{"Phone短号", Phone, "12345", "******"},
		{"IDCard", IDCard, "110101199003071234", "110********234"},
		{"IDCard短号", IDCard, "123456", "******"},
		{"Email", Email, "zhangsan@example.com", "z***@example.com"},
		{"Email短名", Email, "ab@x.com", "a***@x.com"},
		{"Code", Code, "2024010101", "20****01"},
		{"Code短号", Code, "1234", "****"},
	}
	for _, c := range cases {
		if got := c.fn(c.in); got != c.want {
			t.Errorf("%s(%q) = %q, want %q", c.name, c.in, got, c.want)
		}
	}
}

func TestUserMasking(t *testing.T) {
	u := &domain.User{
		Phone:     ptr("13812345678"),
		Email:     ptr("a@b.com"),
		IDCard:    ptr("110101199003071234"),
		StudentNo: ptr("2024010101"),
		WorkID:    ptr("T1001"),
	}
	User(false, u)
	if *u.Phone != "138****5678" || *u.IDCard != "110********234" {
		t.Fatalf("非管理员应全字段脱敏: %+v", u)
	}
	if !strings.Contains(*u.Email, "***") || *u.Email == "a@b.com" {
		t.Fatalf("邮箱应脱敏: %q", *u.Email)
	}
	if *u.StudentNo == "2024010101" || *u.WorkID == "T1001" {
		t.Fatalf("学号/工号应脱敏")
	}

	u2 := &domain.User{Phone: ptr("13812345678")}
	User(true, u2)
	if *u2.Phone != "13812345678" {
		t.Fatalf("管理员不应脱敏")
	}
}
