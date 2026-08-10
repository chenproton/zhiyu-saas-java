package crypto

import (
	"errors"
	"testing"
)

func TestEncryptDecryptRoundtrip(t *testing.T) {
	secret := "test-ai-config-secret"
	plain := "sk-test-1234567890abcdef"

	token, err := Encrypt(secret, plain)
	if err != nil {
		t.Fatalf("Encrypt: %v", err)
	}
	if token == plain {
		t.Fatal("密文不应等于明文")
	}

	got, err := Decrypt(secret, token)
	if err != nil {
		t.Fatalf("Decrypt: %v", err)
	}
	if got != plain {
		t.Fatalf("roundtrip 失败: got %q, want %q", got, plain)
	}
}

func TestEncryptRandomNonce(t *testing.T) {
	secret, plain := "s", "same-plaintext"
	t1, err := Encrypt(secret, plain)
	if err != nil {
		t.Fatalf("Encrypt: %v", err)
	}
	t2, err := Encrypt(secret, plain)
	if err != nil {
		t.Fatalf("Encrypt: %v", err)
	}
	if t1 == t2 {
		t.Fatal("相同明文两次加密应产生不同密文（随机 nonce）")
	}
}

func TestDecryptWithWrongSecret(t *testing.T) {
	token, err := Encrypt("secret-a", "sk-xxx")
	if err != nil {
		t.Fatalf("Encrypt: %v", err)
	}
	if _, err := Decrypt("secret-b", token); !errors.Is(err, ErrInvalidToken) {
		t.Fatalf("错误密钥解密应返回 ErrInvalidToken, got: %v", err)
	}
}

func TestDecryptInvalidToken(t *testing.T) {
	if _, err := Decrypt("s", "not-base64!!!"); !errors.Is(err, ErrInvalidToken) {
		t.Fatalf("非法密文应返回 ErrInvalidToken, got: %v", err)
	}
	// 合法 base64 但长度过短
	if _, err := Decrypt("s", "aGVsbG8="); !errors.Is(err, ErrInvalidToken) {
		t.Fatalf("过短密文应返回 ErrInvalidToken, got: %v", err)
	}
}
