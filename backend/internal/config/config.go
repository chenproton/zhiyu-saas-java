package config

import (
	"fmt"
	"os"

	"github.com/joho/godotenv"
)

type Config struct {
	DatabaseURL  string
	RedisURL     string
	JWTSecret    string
	AISecret     string
	Port         string
	IP2RegionXDB string
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

	return &Config{
		DatabaseURL: dbURL,
		RedisURL:    redisURL,
		JWTSecret:   jwtSecret,
		// AI_CONFIG_SECRET 用于加密租户 AI API Key，缺省时回落 JWT_SECRET
		AISecret:     getEnv("AI_CONFIG_SECRET", jwtSecret),
		Port:         getEnv("PORT", "8080"),
		IP2RegionXDB: getEnv("IP2REGION_XDB", "/app/data/ip2region_v4.xdb"),
	}, nil
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
