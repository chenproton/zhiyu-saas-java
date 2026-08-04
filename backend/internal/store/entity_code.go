package store

import (
	"context"
	"crypto/rand"
	"fmt"
)

const entityCodeAlphabet = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"

// allowedUniqueCodeTables lists the tables that may be passed to GenerateUniqueEntityCode.
var allowedUniqueCodeTables = []string{
	"ability_points",
	"career_positions",
	"courses",
	"exams",
	"question_banks",
	"questions",
	"scenarios",
	"training_programs",
}

// GenerateEntityCode returns a human-readable code like "GW-A3B7C9D1".
func GenerateEntityCode(prefix string) string {
	b := make([]byte, 8)
	if _, err := rand.Read(b); err != nil {
		return fmt.Sprintf("%s-%08d", prefix, 0)
	}
	for i := range b {
		b[i] = entityCodeAlphabet[int(b[i])%len(entityCodeAlphabet)]
	}
	return fmt.Sprintf("%s-%s", prefix, string(b))
}

// GenerateUniqueEntityCode generates a code and ensures it does not already exist
// in the given tenant-scoped table. It retries a few times on collision.
func GenerateUniqueEntityCode(ctx context.Context, q Queryer, prefix, table, tenantID string) (string, error) {
	if _, err := SanitizeIdentifier(table, allowedUniqueCodeTables); err != nil {
		return "", err
	}
	for i := 0; i < 10; i++ {
		code := GenerateEntityCode(prefix)
		var exists bool
		err := q.QueryRow(ctx, fmt.Sprintf("SELECT EXISTS(SELECT 1 FROM %s WHERE tenant_id=$1 AND code=$2)", table), tenantID, code).Scan(&exists)
		if err != nil {
			return "", err
		}
		if !exists {
			return code, nil
		}
	}
	return "", fmt.Errorf("生成唯一%s编码失败", prefix)
}
