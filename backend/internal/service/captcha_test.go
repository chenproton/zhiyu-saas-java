package service

import (
	"context"
	"errors"
	"strings"
	"testing"
)

// TestCaptchaService_GenerateAndVerify 生成→正确字符校验通过（redis nil 走内存降级）。
func TestCaptchaService_GenerateAndVerify(t *testing.T) {
	svc := NewCaptchaService(nil)
	ctx := context.Background()

	out, err := svc.Generate(ctx)
	if err != nil {
		t.Fatalf("generate: %v", err)
	}
	if out.CaptchaID == "" {
		t.Fatal("captchaId empty")
	}
	if !strings.HasPrefix(out.Image, "data:image/png;base64,") {
		t.Fatalf("image data url invalid: %s", out.Image[:40])
	}

	// 答案从内存降级存储读取（redis nil 场景），模拟用户输入
	svc.mu.Lock()
	entry, ok := svc.answers[captchaAnswerKey(out.CaptchaID)]
	svc.mu.Unlock()
	if !ok {
		t.Fatal("answer not stored")
	}

	// 正确字符 → 通过（大小写不敏感）
	if err := svc.Verify(ctx, out.CaptchaID, strings.ToUpper(entry.answer)); err != nil {
		t.Fatalf("verify correct answer: %v", err)
	}
	// 一次性消费：再次校验同一 id → 已失效
	if err := svc.Verify(ctx, out.CaptchaID, entry.answer); !errors.Is(err, ErrCaptchaExpired) {
		t.Fatalf("expected expired after consume, got %v", err)
	}
}

func TestCaptchaService_VerifyWrong(t *testing.T) {
	svc := NewCaptchaService(nil)
	ctx := context.Background()

	out, err := svc.Generate(ctx)
	if err != nil {
		t.Fatalf("generate: %v", err)
	}
	// 错误字符 → 答案不匹配
	err = svc.Verify(ctx, out.CaptchaID, "xxxx")
	if !errors.Is(err, ErrCaptchaWrong) {
		t.Fatalf("expected ErrCaptchaWrong, got %v", err)
	}
	// 空 id → 视为已失效
	if err := svc.Verify(ctx, "", "abc"); !errors.Is(err, ErrCaptchaExpired) {
		t.Fatalf("expected expired for empty id, got %v", err)
	}
	// 不存在的 id → 已失效
	if err := svc.Verify(ctx, "no-such-id", "abc"); !errors.Is(err, ErrCaptchaExpired) {
		t.Fatalf("expected expired for unknown id, got %v", err)
	}
}

// TestCaptchaService_FailCountThreshold 失败计数达到阈值后 FailCount 生效，成功后清零。
func TestCaptchaService_FailCountThreshold(t *testing.T) {
	svc := NewCaptchaService(nil)
	ctx := context.Background()
	ip := "10.0.0.1"

	for i := 0; i < CaptchaFailThreshold; i++ {
		svc.RecordFailure(ctx, ip)
	}
	n, err := svc.FailCount(ctx, ip)
	if err != nil {
		t.Fatalf("fail count: %v", err)
	}
	if n != CaptchaFailThreshold {
		t.Fatalf("expected %d failures, got %d", CaptchaFailThreshold, n)
	}

	svc.ResetFailure(ctx, ip)
	n, err = svc.FailCount(ctx, ip)
	if err != nil {
		t.Fatalf("fail count after reset: %v", err)
	}
	if n != 0 {
		t.Fatalf("expected 0 failures after reset, got %d", n)
	}
}

// TestCaptchaService_IPIsolation 不同 IP 计数互不影响。
func TestCaptchaService_IPIsolation(t *testing.T) {
	svc := NewCaptchaService(nil)
	ctx := context.Background()

	svc.RecordFailure(ctx, "10.0.0.1")
	svc.RecordFailure(ctx, "10.0.0.1")
	n, _ := svc.FailCount(ctx, "10.0.0.2")
	if n != 0 {
		t.Fatalf("other ip should be 0, got %d", n)
	}
}
