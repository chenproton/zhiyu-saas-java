package service

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/mojocn/base64Captcha"
	"github.com/redis/go-redis/v9"
)

// 字符验证码业务参数。
const (
	// CaptchaFailThreshold 同一 IP 登录失败达到该次数后，登录必须附带验证码。
	CaptchaFailThreshold = 3

	captchaAnswerTTL = 3 * time.Minute
	captchaFailTTL   = 10 * time.Minute
)

var (
	// ErrCaptchaWrong 验证码已校验但答案不匹配（前端应刷新验证码重试）。
	ErrCaptchaWrong = errors.New("captcha wrong")
	// ErrCaptchaExpired 验证码不存在/已过期/已被使用（前端应重新获取验证码）。
	ErrCaptchaExpired = errors.New("captcha expired")
)

// CaptchaOut 验证码前端展示数据。答案不随响应下发，仅存服务端。
type CaptchaOut struct {
	CaptchaID string `json:"captchaId"`
	Image     string `json:"image"` // data:image/png;base64, 验证码图片
}

// CaptchaService 字符验证码：生成（base64Captcha，纯本地渲染）、
// 答案存储（Redis 优先，不可用时内存降级）、登录失败计数。
// 不依赖数据库与外部服务，纯离线可用。
type CaptchaService struct {
	driver *base64Captcha.DriverDigit
	redis  *redis.Client

	mu      sync.Mutex
	answers map[string]captchaMemEntry // redis 为 nil 时的降级存储：验证码答案
	fails   map[string]captchaMemEntry // redis 为 nil 时的降级存储：IP 失败计数
}

type captchaMemEntry struct {
	answer string // 验证码答案（小写），或失败计数（复用 answer 字段存计数）
	expire time.Time
}

// NewCaptchaService 构建验证码服务。redis 为 nil 时验证码与失败计数走内存降级。
func NewCaptchaService(redisClient *redis.Client) *CaptchaService {
	svc := &CaptchaService{
		driver:  base64Captcha.NewDriverDigit(60, 180, 4, 0.6, 4),
		redis:   redisClient,
		answers: map[string]captchaMemEntry{},
		fails:   map[string]captchaMemEntry{},
	}
	return svc
}

// Generate 生成字符验证码：图片本地渲染，答案写入存储，3 分钟有效。
func (s *CaptchaService) Generate(ctx context.Context) (*CaptchaOut, error) {
	// store 仅用于占位（库要求传入）；答案由本服务自行管理（Redis/内存降级）
	capt := base64Captcha.NewCaptcha(s.driver, base64Captcha.NewMemoryStore(64, captchaAnswerTTL))
	id, image, answer, err := capt.Generate()
	if err != nil {
		return nil, err
	}
	// 答案全部转为小写存储，校验时大小写不敏感
	s.storeAnswer(ctx, id, answer)
	return &CaptchaOut{
		CaptchaID: id,
		Image:     image,
	}, nil
}

// Verify 校验验证码。无论成败答案均一次性消耗（防重放）；
// 答案不存在/已过期返回 ErrCaptchaExpired，字符不匹配返回 ErrCaptchaWrong。
func (s *CaptchaService) Verify(ctx context.Context, captchaID, code string) error {
	if captchaID == "" {
		return ErrCaptchaExpired
	}
	answer, err := s.takeAnswer(ctx, captchaID)
	if err != nil {
		return err
	}
	if !strings.EqualFold(strings.TrimSpace(answer), strings.TrimSpace(code)) {
		return ErrCaptchaWrong
	}
	return nil
}

// FailCount 返回该 IP 当前登录失败次数（TTL 窗口内）。
func (s *CaptchaService) FailCount(ctx context.Context, ip string) (int64, error) {
	if s.redis != nil {
		v, err := s.redis.Get(ctx, captchaFailKey(ip)).Int64()
		if err == redis.Nil {
			return 0, nil
		}
		return v, err
	}

	s.mu.Lock()
	defer s.mu.Unlock()
	s.pruneLocked()
	e, ok := s.fails[captchaFailKey(ip)]
	if !ok {
		return 0, nil
	}
	var n int64
	fmt.Sscanf(e.answer, "%d", &n)
	return n, nil
}

// RecordFailure 记录一次登录失败（首次失败时设置窗口 TTL）。
func (s *CaptchaService) RecordFailure(ctx context.Context, ip string) {
	if s.redis != nil {
		n, err := s.redis.Incr(ctx, captchaFailKey(ip)).Result()
		if err != nil {
			return
		}
		if n == 1 {
			_ = s.redis.Expire(ctx, captchaFailKey(ip), captchaFailTTL).Err()
		}
		return
	}

	s.mu.Lock()
	defer s.mu.Unlock()
	s.pruneLocked()
	key := captchaFailKey(ip)
	e, ok := s.fails[key]
	if !ok {
		e = captchaMemEntry{answer: "1", expire: time.Now().Add(captchaFailTTL)}
	} else {
		var n int
		fmt.Sscanf(e.answer, "%d", &n)
		e.answer = fmt.Sprintf("%d", n+1)
	}
	s.fails[key] = e
}

// ResetFailure 登录成功后清零失败计数。
func (s *CaptchaService) ResetFailure(ctx context.Context, ip string) {
	if s.redis != nil {
		_ = s.redis.Del(ctx, captchaFailKey(ip)).Err()
		return
	}

	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.fails, captchaFailKey(ip))
}

func (s *CaptchaService) storeAnswer(ctx context.Context, id, answer string) {
	if s.redis != nil {
		_ = s.redis.Set(ctx, captchaAnswerKey(id), strings.ToLower(answer), captchaAnswerTTL).Err()
		return
	}

	s.mu.Lock()
	defer s.mu.Unlock()
	s.pruneLocked()
	s.answers[captchaAnswerKey(id)] = captchaMemEntry{answer: strings.ToLower(answer), expire: time.Now().Add(captchaAnswerTTL)}
}

// takeAnswer 取出并删除答案（一次性消耗）。
func (s *CaptchaService) takeAnswer(ctx context.Context, id string) (string, error) {
	if s.redis != nil {
		v, err := s.redis.GetDel(ctx, captchaAnswerKey(id)).Result()
		if err == redis.Nil || v == "" {
			return "", ErrCaptchaExpired
		}
		if err != nil {
			return "", ErrCaptchaExpired
		}
		return v, nil
	}

	s.mu.Lock()
	defer s.mu.Unlock()
	s.pruneLocked()
	key := captchaAnswerKey(id)
	e, ok := s.answers[key]
	if !ok {
		return "", ErrCaptchaExpired
	}
	delete(s.answers, key)
	return e.answer, nil
}

func (s *CaptchaService) pruneLocked() {
	now := time.Now()
	for k, e := range s.answers {
		if now.After(e.expire) {
			delete(s.answers, k)
		}
	}
	for k, e := range s.fails {
		if now.After(e.expire) {
			delete(s.fails, k)
		}
	}
}

func captchaAnswerKey(id string) string {
	return "zhiyu:captcha:answer:" + id
}

func captchaFailKey(ip string) string {
	return "zhiyu:captcha:fail:" + ip
}
