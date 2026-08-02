package store

import (
	"testing"
)

// TestListQueryBuilderSequential 验证多个 ExtraFilter 条件经 NextArg 连续编号。
func TestListQueryBuilderSequential(t *testing.T) {
	qb := NewListQueryBuilder()
	qb.AddCondition("tenant_id = " + qb.NextArg("t1"))
	qb.AddCondition("status = " + qb.NextArg("active"))
	where := qb.WhereClause()
	if where != "tenant_id = $1 AND status = $2" {
		t.Fatalf("条件装配错误: %s", where)
	}
	args := qb.Args()
	if len(args) != 2 || args[0] != "t1" || args[1] != "active" {
		t.Fatalf("参数错误: %v", args)
	}
}

// TestListQueryBuilderMixed 验证条件与搜索混合场景下参数编号连续（搜索在 ExecuteListQuery 内先于 ExtraFilter 展开）。
func TestListQueryBuilderMixed(t *testing.T) {
	qb := NewListQueryBuilder()
	// 模拟 ExecuteListQuery 的搜索参数展开：两个搜索列各占一个参数位
	qb.AddCondition("(name ILIKE " + qb.NextArg("%abc%") + " OR code ILIKE " + qb.NextArg("%abc%") + ")")
	qb.AddCondition("status = " + qb.NextArg("open"))
	if qb.WhereClause() != "(name ILIKE $1 OR code ILIKE $2) AND status = $3" {
		t.Fatalf("混合装配错误: %s", qb.WhereClause())
	}
	if len(qb.Args()) != 3 {
		t.Fatalf("参数数量错误: %v", qb.Args())
	}
}

// TestBatchTableConfigs 校验 5 类批次配置完整性（表/列/状态/扫描函数）。
func TestBatchTableConfigs(t *testing.T) {
	configs := map[string]BatchTableConfig{
		"job":        NewJobBatchTableConfig(),
		"scene":      NewSceneBatchTableConfig(),
		"course":     NewCourseBatchTableConfig(),
		"evaluation": NewEvaluationBatchTableConfig(),
		"affairs":    NewAffairsBatchTableConfig(),
	}
	for name, c := range configs {
		if c.TableName == "" || c.WriteTableName == "" || c.SelectColumns == "" {
			t.Errorf("%s 配置缺表名/列", name)
		}
		if c.StatusOpen == "" || c.StatusClosed == "" {
			t.Errorf("%s 配置缺状态值", name)
		}
		if c.ScanRow == nil || c.ScanRows == nil {
			t.Errorf("%s 配置缺扫描函数", name)
		}
		if c.EntityName == "" {
			t.Errorf("%s 配置缺实体名", name)
		}
	}
}
