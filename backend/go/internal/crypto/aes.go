// Package crypto 提供租户敏感配置（如 AI API Key）的对称加解密。
// 仅使用标准库：AES-256-GCM，密钥由配置 secret 经 sha256 派生。
package crypto

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"fmt"
	"io"
)

// ErrInvalidToken 密文格式非法或被篡改。
var ErrInvalidToken = errors.New("crypto: invalid token")

// deriveKey 将任意长度 secret 派生为 32 字节 AES-256 密钥。
func deriveKey(secret string) []byte {
	sum := sha256.Sum256([]byte(secret))
	return sum[:]
}

// Encrypt 用 secret 加密 plaintext，输出 base64(nonce|ciphertext)。
// nonce 每次随机生成并随密文一起输出，保证同一明文每次密文不同。
func Encrypt(secret, plaintext string) (string, error) {
	block, err := aes.NewCipher(deriveKey(secret))
	if err != nil {
		return "", err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}
	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return "", err
	}
	sealed := gcm.Seal(nonce, nonce, []byte(plaintext), nil)
	return base64.StdEncoding.EncodeToString(sealed), nil
}

// Decrypt 解密 Encrypt 产出的 token；secret 不匹配或密文被篡改时返回错误。
func Decrypt(secret, token string) (string, error) {
	raw, err := base64.StdEncoding.DecodeString(token)
	if err != nil {
		return "", fmt.Errorf("%w: base64 decode: %v", ErrInvalidToken, err)
	}
	block, err := aes.NewCipher(deriveKey(secret))
	if err != nil {
		return "", err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}
	if len(raw) < gcm.NonceSize()+gcm.Overhead() {
		return "", ErrInvalidToken
	}
	nonce, ciphertext := raw[:gcm.NonceSize()], raw[gcm.NonceSize():]
	plain, err := gcm.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return "", ErrInvalidToken
	}
	return string(plain), nil
}

// DecryptWithFallback 依次尝试 primary、legacy 等密钥解密，用于密钥轮换：
// 新密文用 primary 加密，历史密文用 legacy 加密，轮换窗口内两者都可读。
// 空密钥跳过；全部失败返回最后一次错误。
func DecryptWithFallback(token string, secrets ...string) (string, error) {
	var lastErr error = ErrInvalidToken
	for _, secret := range secrets {
		if secret == "" {
			continue
		}
		plain, err := Decrypt(secret, token)
		if err == nil {
			return plain, nil
		}
		lastErr = err
	}
	return "", lastErr
}
