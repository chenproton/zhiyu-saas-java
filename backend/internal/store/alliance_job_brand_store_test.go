package store

import (
	"encoding/json"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/zhiyu-saas/backend/internal/domain"
)

// jobBrandFakeRows 模拟岗位品牌查询行（覆盖 ScanJobBrandRows 全部扫描类型）。
type jobBrandFakeRows struct {
	rows [][]any
	idx  int
}

func (r *jobBrandFakeRows) Next() bool {
	r.idx++
	return r.idx <= len(r.rows)
}

func (r *jobBrandFakeRows) Scan(dest ...any) error {
	row := r.rows[r.idx-1]
	for i := range dest {
		switch d := dest[i].(type) {
		case *string:
			if v, ok := row[i].(string); ok {
				*d = v
			} else if row[i] != nil {
				*d = row[i].(string)
			}
		case **string:
			if row[i] == nil {
				*d = nil
			} else {
				s := row[i].(string)
				*d = &s
			}
		case *int:
			if row[i] == nil {
				*d = 0
			} else {
				*d = row[i].(int)
			}
		case **int:
			if row[i] == nil {
				*d = nil
			} else {
				v := row[i].(int)
				*d = &v
			}
		case *bool:
			*d = row[i].(bool)
		case *time.Time:
			*d = row[i].(time.Time)
		case *[]string:
			*d = row[i].([]string)
		case *json.RawMessage:
			*d = row[i].(json.RawMessage)
		}
	}
	return nil
}

func (r *jobBrandFakeRows) Values() ([]any, error)                       { return r.rows[r.idx-1], nil }
func (r *jobBrandFakeRows) RawValues() [][]byte                          { return nil }
func (r *jobBrandFakeRows) CommandTag() pgconn.CommandTag                { return pgconn.CommandTag{} }
func (r *jobBrandFakeRows) FieldDescriptions() []pgconn.FieldDescription { return nil }
func (r *jobBrandFakeRows) Err() error                                   { return nil }
func (r *jobBrandFakeRows) Close()                                       {}
func (r *jobBrandFakeRows) Conn() *pgx.Conn                              { return nil }

// TestScanJobBrandRows 岗位品牌视图扫描：品牌行 + LEFT JOIN 岗位资料（教学岗位/企业岗位均带出）。
func TestScanJobBrandRows(t *testing.T) {
	now := time.Now()
	rows := &jobBrandFakeRows{
		rows: [][]any{
			{
				"b1", "t1", "job", "岗位品牌A", "draft", true, false,
				"cover", "video", "desc",
				json.RawMessage(`{"tags":["x"]}`),
				"st1", "ent1", "pos1", "mj1", "te1", "ex1",
				0, 10, now, now,
				"教学岗位A", "teaching", 8, 12,
				[]string{"软件技术", "大数据"}, "published",
			},
			{
				"b2", "t1", "job", "企业岗位B", "draft", false, true,
				nil, nil, nil,
				json.RawMessage(`{}`),
				nil, nil, "pos2", nil, nil, nil,
				1, 0, now, now,
				"企业岗位B", "enterprise", 15, 25,
				[]string{"人工智能"}, "draft",
			},
		},
	}

	items, err := (&AllianceStore{}).ScanJobBrandRows(rows)
	if err != nil {
		t.Fatal(err)
	}
	if len(items) != 2 {
		t.Fatalf("expected 2 rows, got %d", len(items))
	}

	teaching := items[0]
	if teaching.PositionName != "教学岗位A" || teaching.PositionType != string(domain.PositionTypeTeaching) {
		t.Errorf("teaching position join mismatch: %+v", teaching.PositionName)
	}
	if teaching.SalaryMin == nil || *teaching.SalaryMin != 8 || teaching.SalaryMax == nil || *teaching.SalaryMax != 12 {
		t.Errorf("salary join mismatch: %+v", teaching.SalaryMin)
	}
	if len(teaching.MajorNames) != 2 || teaching.MajorNames[0] != "软件技术" {
		t.Errorf("major names join mismatch: %+v", teaching.MajorNames)
	}
	if teaching.PositionStatus != "published" {
		t.Errorf("position status join mismatch: %s", teaching.PositionStatus)
	}
	if teaching.StudentID == nil || *teaching.StudentID != "st1" {
		t.Errorf("brand relation columns lost: %+v", teaching.StudentID)
	}
	if teaching.Data == nil || string(teaching.Data) != `{"tags":["x"]}` {
		t.Errorf("data column lost: %s", teaching.Data)
	}

	enterprise := items[1]
	if enterprise.PositionType != string(domain.PositionTypeEnterprise) || enterprise.PositionName != "企业岗位B" {
		t.Errorf("enterprise position join mismatch: %+v", enterprise.PositionName)
	}
	if enterprise.PositionID == nil || *enterprise.PositionID != "pos2" {
		t.Errorf("positionId link lost: %+v", enterprise.PositionID)
	}
	if !enterprise.IsFeatured || enterprise.IsPublic {
		t.Errorf("brand flags mismatch: featured=%v public=%v", enterprise.IsFeatured, enterprise.IsPublic)
	}
	if enterprise.StudentID != nil {
		t.Errorf("nil relation should stay nil: %+v", enterprise.StudentID)
	}
}
