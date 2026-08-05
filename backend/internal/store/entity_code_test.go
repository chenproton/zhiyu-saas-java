package store

import "testing"

// TestAllowedUniqueCodeTables verifies tables allowed to generate codes pass
// SanitizeIdentifier, and that the knowledge point table is included.
func TestAllowedUniqueCodeTables(t *testing.T) {
	expected := []string{
		"ability_points",
		"career_positions",
		"courses",
		"exams",
		"knowledge_points",
		"question_banks",
		"questions",
		"scenarios",
		"training_programs",
	}
	for _, table := range expected {
		if _, err := SanitizeIdentifier(table, allowedUniqueCodeTables); err != nil {
			t.Errorf("表 %s 应允许生成编码: %v", table, err)
		}
	}
	if _, err := SanitizeIdentifier("knowledge_points", allowedUniqueCodeTables); err != nil {
		t.Fatalf("knowledge_points 应允许生成编码: %v", err)
	}
}

// TestGenerateEntityCodeFormat verifies the generated code matches "prefix-XXXXXXXX".
func TestGenerateEntityCodeFormat(t *testing.T) {
	code := GenerateEntityCode("KP")
	if len(code) != len("KP-")+8 || code[:3] != "KP-" {
		t.Fatalf("编码格式不正确: %s", code)
	}
}
