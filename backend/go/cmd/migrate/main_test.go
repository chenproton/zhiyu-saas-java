package main

import (
	"strings"
	"testing"
)

// 回归：dollar-quote 关闭标签后索引必须正确前进，函数/DO 块之后的语句要能继续切分。
// 此前关闭分支先清空 openTag 再用 len(openTag)-1 回退，导致整个文件被并作一条语句。
func TestSplitSQLStatementsDollarQuoteThenMore(t *testing.T) {
	sql := `CREATE OR REPLACE FUNCTION f() RETURNS void AS $$
BEGIN
	PERFORM 1;
END;
$$ LANGUAGE plpgsql;

UPDATE users SET status = 'active' WHERE id = 'u1';

DROP FUNCTION f();
`
	got := splitSQLStatements(strings.TrimSpace(sql))
	// 期望：函数定义 1 条 + UPDATE 1 条 + DROP 1 条 = 3 条（TrimSpace 去除尾随换行）
	if len(got) != 3 {
		t.Fatalf("splitSQLStatements 切分数 = %d, want 3；got=%#v", len(got), got)
	}
	// 关键回归点：UPDATE 必须被独立切出（未被并进函数块）
	foundUpdate := false
	for _, s := range got {
		if strings.Contains(s, "UPDATE users SET status = 'active'") {
			foundUpdate = true
		}
	}
	if !foundUpdate {
		t.Fatalf("UPDATE 语句未被独立切出：%#v", got)
	}
}

func TestSplitSQLStatementsNamedDollarTag(t *testing.T) {
	sql := `DO $body$
BEGIN
	RAISE NOTICE 'x';
END
$body$;

INSERT INTO t VALUES (1);
`
	got := splitSQLStatements(strings.TrimSpace(sql))
	if len(got) != 2 {
		t.Fatalf("named dollar-tag 切分数 = %d, want 2；got=%#v", len(got), got)
	}
}

func TestSplitSQLStatementsNoDollar(t *testing.T) {
	sql := "UPDATE a SET x=1;\nUPDATE b SET y=2;\n"
	got := splitSQLStatements(strings.TrimSpace(sql))
	if len(got) != 2 {
		t.Fatalf("无 dollar 块切分数 = %d, want 2；got=%#v", len(got), got)
	}
}
