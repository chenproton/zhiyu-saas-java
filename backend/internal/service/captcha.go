package service

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"sync"
	"time"

	"github.com/redis/go-redis/v9"
	"github.com/wenlng/go-captcha-assets/resources/imagesv2"
	"github.com/wenlng/go-captcha-assets/resources/tiles"
	"github.com/wenlng/go-captcha/v2/slide"
)

// 滑块验证码业务参数。
const (
	// CaptchaSlidePadding 滑块拼图容差（像素），前端拖动误差在此范围内视为成功。
	CaptchaSlidePadding = 8
	// CaptchaFailThreshold 同一 IP 登录失败达到该次数后，登录必须附带滑块验证码。
	CaptchaFailThreshold = 3
	// CaptchaImageWidth/Height 与 slide 默认图尺寸一致，前端按此换算拖动位移。
	CaptchaImageWidth  = 300
	CaptchaImageHeight = 220

	captchaAnswerTTL = 3 * time.Minute
	captchaFailTTL   = 10 * time.Minute
)

var (
	// ErrCaptchaWrong 验证码已校验但答案不匹配（前端应刷新验证码重试）。
	ErrCaptchaWrong = errors.New("captcha wrong")
	// ErrCaptchaExpired 验证码不存在/已过期/已被使用（前端应重新获取验证码）。
	ErrCaptchaExpired = errors.New("captcha expired")
)

// CaptchaOut 验证码前端展示数据。答案（缺口坐标）不随响应下发，仅存服务端。
type CaptchaOut struct {
	CaptchaID   string `json:"captchaId"`
	Image       string `json:"image"` // data:image/jpeg;base64, 主图
	Thumb       string `json:"thumb"` // data:image/png;base64, 拼图块
	ThumbX      int    `json:"thumbX"`
	ThumbY      int    `json:"thumbY"`
	ThumbWidth  int    `json:"thumbWidth"`
	ThumbHeight int    `json:"thumbHeight"`
	ImageWidth  int    `json:"imageWidth"`
	ImageHeight int    `json:"imageHeight"`
}

// CaptchaService 滑块验证码：生成（go-captcha 引擎）、答案存储（Redis 优先，
// 不可用时内存降级）、登录失败计数。不依赖数据库与外部服务，纯离线可用。
type CaptchaService struct {
	engine slide.Captcha
	redis  *redis.Client

	mu      sync.Mutex
	answers map[string]captchaMemEntry // redis 为 nil 时的降级存储：验证码答案
	fails   map[string]captchaMemEntry // redis 为 nil 时的降级存储：IP 失败计数
}

type captchaMemEntry struct {
	value  int // 答案 X 坐标，或失败计数
	value2 int // 答案 Y 坐标（失败计数不用）
	expire time.Time
}

// NewCaptchaService 构建验证码服务。素材（背景图/拼图块）由 go-captcha-assets
// 内嵌进二进制，运行时零文件依赖；redis 为 nil 时验证码与失败计数走内存降级。
func NewCaptchaService(redisClient *redis.Client) *CaptchaService {
	svc := &CaptchaService{
		redis:   redisClient,
		answers: map[string]captchaMemEntry{},
		fails:   map[string]captchaMemEntry{},
	}
	builder := slide.NewBuilder()
	if images, err := imagesv2.GetImages(); err == nil && len(images) > 0 {
		builder.SetResources(slide.WithBackgrounds(images))
	}
	if graphImages, err := tiles.GetTiles(); err == nil && len(graphImages) > 0 {
		graphs := make([]*slide.GraphImage, len(graphImages))
		for i, g := range graphImages {
			graphs[i] = &slide.GraphImage{
				OverlayImage: g.OverlayImage,
				ShadowImage:  g.ShadowImage,
				MaskImage:    g.MaskImage,
			}
		}
		builder.SetResources(slide.WithGraphImages(graphs))
	}
	svc.engine = builder.Make()
	return svc
}

// Generate 生成滑块验证码：图片本地合成，答案（缺口坐标）写入存储，3 分钟有效。
func (s *CaptchaService) Generate(ctx context.Context) (*CaptchaOut, error) {
	data, err := s.engine.Generate()
	if err != nil {
		return nil, err
	}
	block := data.GetData()
	if block == nil {
		return nil, errors.New("captcha generate: empty block data")
	}
	masterBase64, err := data.GetMasterImage().ToBase64()
	if err != nil {
		return nil, fmt.Errorf("captcha encode master: %w", err)
	}
	thumbBase64, err := data.GetTileImage().ToBase64()
	if err != nil {
		return nil, fmt.Errorf("captcha encode thumb: %w", err)
	}

	id := newCaptchaID()
	s.storeAnswer(ctx, id, block.X, block.Y)
	return &CaptchaOut{
		CaptchaID:   id,
		Image:       "data:image/jpeg;base64," + masterBase64,
		Thumb:       "data:image/png;base64," + thumbBase64,
		ThumbX:      block.DX,
		ThumbY:      block.DY,
		ThumbWidth:  block.Width,
		ThumbHeight: block.Height,
		ImageWidth:  CaptchaImageWidth,
		ImageHeight: CaptchaImageHeight,
	}, nil
}

// Verify 校验验证码。无论成败答案均一次性消耗（防重放）；
// 答案不存在/已过期返回 ErrCaptchaExpired，坐标不匹配返回 ErrCaptchaWrong。
func (s *CaptchaService) Verify(ctx context.Context, captchaID string, x, y int) error {
	if captchaID == "" {
		return ErrCaptchaExpired
	}
	answerX, answerY, err := s.takeAnswer(ctx, captchaID)
	if err != nil {
		return err
	}
	if !slide.Validate(x, y, answerX, answerY, CaptchaSlidePadding) {
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
	return int64(e.value), nil
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
		e = captchaMemEntry{value: 1, expire: time.Now().Add(captchaFailTTL)}
	} else {
		e.value++
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

func (s *CaptchaService) storeAnswer(ctx context.Context, id string, x, y int) {
	if s.redis != nil {
		_ = s.redis.Set(ctx, captchaAnswerKey(id), fmt.Sprintf("%d,%d", x, y), captchaAnswerTTL).Err()
		return
	}

	s.mu.Lock()
	defer s.mu.Unlock()
	s.pruneLocked()
	s.answers[captchaAnswerKey(id)] = captchaMemEntry{value: x, value2: y, expire: time.Now().Add(captchaAnswerTTL)}
}

// takeAnswer 取出并删除答案（一次性消耗）。
func (s *CaptchaService) takeAnswer(ctx context.Context, id string) (int, int, error) {
	if s.redis != nil {
		v, err := s.redis.GetDel(ctx, captchaAnswerKey(id)).Result()
		if err == redis.Nil || v == "" {
			return 0, 0, ErrCaptchaExpired
		}
		if err != nil {
			return 0, 0, ErrCaptchaExpired
		}
		var x, y int
		if _, err := fmt.Sscanf(v, "%d,%d", &x, &y); err != nil {
			return 0, 0, ErrCaptchaExpired
		}
		return x, y, nil
	}

	s.mu.Lock()
	defer s.mu.Unlock()
	s.pruneLocked()
	key := captchaAnswerKey(id)
	e, ok := s.answers[key]
	if !ok {
		return 0, 0, ErrCaptchaExpired
	}
	delete(s.answers, key)
	return e.value, e.value2, nil
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

func newCaptchaID() string {
	b := make([]byte, 16)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}

func captchaAnswerKey(id string) string {
	return "zhiyu:captcha:answer:" + id
}

func captchaFailKey(ip string) string {
	return "zhiyu:captcha:fail:" + ip
}
