package config

import (
	"fmt"
	"os"

	"github.com/joho/godotenv"
)

type Config struct {
	DatabaseURL       string
	RedisURL          string
	JWTSecret         string
	JWTSecretPrevious string
	AISecret          string
	AISecretPrevious  string
	Port              string
	IP2RegionXDB      string
}

func Load() (*Config, error) {
	_ = godotenv.Load("../.env")
	_ = godotenv.Load("../../.env")
	_ = godotenv.Load(".env")

	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		return nil, fmt.Errorf("DATABASE_URL is required")
	}
	redisURL := os.Getenv("REDIS_URL")
	jwtSecret := os.Getenv("JWT_SECRET")
	if jwtSecret == "" {
		return nil, fmt.Errorf("JWT_SECRET is required")
	}
	aiSecret := os.Getenv("AI_CONFIG_SECRET")
	if aiSecret == "" {
		return nil, fmt.Errorf("AI_CONFIG_SECRET is required（独立于 JWT_SECRET，用于加密租户 AI API Key；禁止回落 JWT_SECRET）")
	}

	return &Config{
		DatabaseURL: dbURL,
		RedisURL:    redisURL,
		JWTSecret:   jwtSecret,
		// 轮换支持：旧密钥仅用于验签/解密，新签发/新加密一律用主密钥。
		// JWT_SECRET_PREVIOUS 为可选的上一次 JWT 密钥（旋转窗口内旧 token 仍可验签）。
		JWTSecretPrevious: getEnv("JWT_SECRET_PREVIOUS", ""),
		AISecret:          aiSecret,
		// 历史密文（租户 AI api_key）在 AI_CONFIG_SECRET 独立前用 JWT_SECRET 加密，
		// 解密时兜底尝试 JWT_SECRET，保证存量配置可读；新加密一律用 AI_CONFIG_SECRET。
		AISecretPrevious: jwtSecret,
		Port:             getEnv("PORT", "8080"),
		IP2RegionXDB:     getEnv("IP2REGION_XDB", "/app/data/ip2region_v4.xdb"),
	}, nil
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
