package middleware

import (
	"testing"
	"time"
)

// TestSessionInvalidatedByPasswordChange 覆盖改密 token 失效判定的精度语义：
// 回归背景——partner 注册/密码重置后同一秒内签发的 token 曾因 JWT iat 截断亚秒
// 早于 DB 微秒级 password_changed_at 被误判 401「密码已修改，请重新登录」。
func TestSessionInvalidatedByPasswordChange(t *testing.T) {
	base := time.Date(2026, 8, 14, 17, 50, 8, 0, time.UTC)

	cases := []struct {
		name             string
		passwordChangedAt time.Time
		issuedAt         time.Time
		wantInvalidated  bool
	}{
		{
			name:             "同秒内注册（改密 08.72s，签发 08.00s 截断）",
			passwordChangedAt: base.Add(721 * time.Millisecond),
			issuedAt:         base,
			wantInvalidated:  false,
		},
		{
			name:             "改密晚于签发秒（旧 token）",
			passwordChangedAt: base.Add(2 * time.Second),
			issuedAt:         base,
			wantInvalidated:  true,
		},
		{
			name:             "改密早于签发（正常新 token）",
			passwordChangedAt: base.Add(-time.Hour),
			issuedAt:         base,
			wantInvalidated:  false,
		},
		{
			name:             "改密与签发同一秒（临界相等）",
			passwordChangedAt: base.Add(500 * time.Millisecond),
			issuedAt:         base.Add(900 * time.Millisecond),
			wantInvalidated:  false,
		},
		{
			name:             "跨秒：改密 09.1s，签发 08.9s（旧 token 失效）",
			passwordChangedAt: base.Add(1100 * time.Millisecond),
			issuedAt:         base.Add(900 * time.Millisecond),
			wantInvalidated:  true,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := sessionInvalidatedByPasswordChange(tc.passwordChangedAt, tc.issuedAt); got != tc.wantInvalidated {
				t.Fatalf("sessionInvalidatedByPasswordChange(%v, %v) = %v, want %v",
					tc.passwordChangedAt, tc.issuedAt, got, tc.wantInvalidated)
			}
		})
	}
}
