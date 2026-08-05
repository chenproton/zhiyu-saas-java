package service

import (
	"errors"
	"math"
	"testing"

	"github.com/zhiyu-saas/backend/internal/domain"
)

func validMapping() []domain.LevelMapping {
	return []domain.LevelMapping{
		{Level: "understand", Min: 56, Max: 68},
		{Level: "comprehend", Min: 69, Max: 78},
		{Level: "master", Min: 79, Max: 88},
		{Level: "proficient", Min: 89, Max: 95},
		{Level: "expert", Min: 96, Max: 100},
	}
}

func TestValidateLevelMapping(t *testing.T) {
	if err := validateLevelMapping(validMapping()); err != nil {
		t.Fatalf("合法分档应通过校验: %v", err)
	}

	cases := []struct {
		name string
		edit func(m []domain.LevelMapping) []domain.LevelMapping
		want string
	}{
		{"档数不足", func(m []domain.LevelMapping) []domain.LevelMapping { return m[:4] }, "5 档"},
		{"等级顺序错误", func(m []domain.LevelMapping) []domain.LevelMapping {
			m[0], m[1] = m[1], m[0]
			return m
		}, "顺序"},
		{"非整数分值", func(m []domain.LevelMapping) []domain.LevelMapping {
			m[0].Min = 55.5
			return m
		}, "整数"},
		{"下限不小于上限", func(m []domain.LevelMapping) []domain.LevelMapping {
			m[0].Min = 68
			return m
		}, "小于上限"},
		{"下限不递增", func(m []domain.LevelMapping) []domain.LevelMapping {
			m[1].Min = 56
			return m
		}, "递增"},
		{"区间不连续", func(m []domain.LevelMapping) []domain.LevelMapping {
			m[0].Max = 67
			return m
		}, "连续"},
		{"最低档下限为 0", func(m []domain.LevelMapping) []domain.LevelMapping {
			m[0].Min = 0
			return m
		}, "大于 0"},
		{"最高档上限不为 100", func(m []domain.LevelMapping) []domain.LevelMapping {
			m[4].Max = 99
			return m
		}, "100"},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			m := validMapping()
			err := validateLevelMapping(c.edit(m))
			if err == nil {
				t.Fatalf("期望校验失败")
			}
			if !errors.Is(err, ErrInvalidLevelMapping) {
				t.Fatalf("错误应包装 ErrInvalidLevelMapping: %v", err)
			}
		})
	}
}

func TestCustomLevelRank(t *testing.T) {
	levels := []levelMapping{
		{Level: "understand", Min: 56},
		{Level: "comprehend", Min: 69},
		{Level: "master", Min: 79},
		{Level: "proficient", Min: 89},
		{Level: "expert", Min: 96},
	}
	cases := []struct {
		score float64
		want  int
	}{
		{55, -1}, // 未达标
		{56, 0},  // 了解L1
		{68, 0},  // 了解L1
		{69, 1},  // 理解L2
		{88, 2},  // 掌握L3
		{89, 3},  // 熟练L4
		{95, 3},  // 熟练L4
		{96, 4},  // 精通L5
		{100, 4}, // 精通L5
	}
	for _, c := range cases {
		if got := customLevelRank(levels, c.score); got != c.want {
			t.Errorf("customLevelRank(%v) = %d, want %d", c.score, got, c.want)
		}
	}
}

func TestCustomLevelRankByCode(t *testing.T) {
	levels := []levelMapping{
		{Level: "understand", Min: 56},
		{Level: "comprehend", Min: 69},
		{Level: "master", Min: 79},
		{Level: "proficient", Min: 89},
		{Level: "expert", Min: 96},
	}
	if got := customLevelRankByCode(levels, "proficient"); got != 3 {
		t.Errorf("proficient rank = %d, want 3", got)
	}
	if got := customLevelRankByCode(levels, "unknown"); got != -1 {
		t.Errorf("unknown rank = %d, want -1", got)
	}
}

func TestPointCompetencyNeed(t *testing.T) {
	levels := []levelMapping{
		{Level: "understand", Min: 56},
		{Level: "comprehend", Min: 69},
		{Level: "master", Min: 79},
		{Level: "proficient", Min: 89},
		{Level: "expert", Min: 96},
	}
	cases := []struct {
		name     string
		levels   []levelMapping
		required string
		want     float64
	}{
		{"自定义分档取要求档位下限", levels, "master", 79},
		{"自定义分档精通档", levels, "expert", 96},
		{"自定义分档未命中回退系统档位", levels, "unknown", 0},
		{"无自定义档位用系统分数线", nil, "master", 70},
		{"无自定义档位理解档", nil, "comprehend", 60},
		{"无自定义档位未知代码", nil, "unknown", 0},
	}
	for _, c := range cases {
		if got := pointCompetencyNeed(c.levels, c.required); got != c.want {
			t.Errorf("%s: pointCompetencyNeed(%v, %s) = %v, want %v", c.name, c.levels, c.required, got, c.want)
		}
	}
}

// v2CustomMapping 用户固定表等价的自定义分档（未达标0-40 / L1 41-60 / L2 61-70 / L3 71-80 / L4 81-90 / L5 91-100）。
func v2CustomMapping() []levelMapping {
	return []levelMapping{
		{Level: "understand", Min: 41, Max: 60},
		{Level: "comprehend", Min: 61, Max: 70},
		{Level: "master", Min: 71, Max: 80},
		{Level: "proficient", Min: 81, Max: 90},
		{Level: "expert", Min: 91, Max: 100},
	}
}

func TestLevelRankByCode(t *testing.T) {
	cases := []struct {
		code string
		want float64
	}{
		{"understand", 1},
		{"comprehend", 2},
		{"master", 3},
		{"proficient", 4},
		{"expert", 5},
		{"unknown", 2},
	}
	for _, c := range cases {
		if got := levelRankByCode(c.code); got != c.want {
			t.Errorf("levelRankByCode(%s) = %v, want %v", c.code, got, c.want)
		}
	}
}

func TestLevelValue(t *testing.T) {
	custom := v2CustomMapping()
	cases := []struct {
		name   string
		levels []levelMapping
		score  float64
		want   float64
	}{
		{"自定义-未达标带", custom, 0, 0},
		{"自定义-未达标带上限", custom, 40, 40.0 / 41},
		{"自定义-L1起点", custom, 41, 1},
		{"自定义-L1顶端", custom, 60, 1.95},
		{"自定义-L2起点", custom, 61, 2},
		{"自定义-L2顶端", custom, 70, 2.9},
		{"自定义-L5顶端", custom, 100, 5.9},
		{"默认-0分", nil, 0, 1},
		{"默认-理解起点", nil, 60, 2},
		{"默认-85分", nil, 85, 4.5},
		{"默认-100分", nil, 100, 5 + 10.0/11},
	}
	for _, c := range cases {
		if got := levelValue(c.levels, c.score); math.Abs(got-c.want) > 1e-9 {
			t.Errorf("%s: levelValue(score=%v) = %v, want %v", c.name, c.score, got, c.want)
		}
	}
}

// TestCompetencyV2Examples 用用户提供的示例表验证能力点胜任度（新）：
// 岗位要求 L2（基准等级 2.0），每跨越一个完整等级 = 50% 变化。
func TestCompetencyV2Examples(t *testing.T) {
	custom := v2CustomMapping()
	cases := []struct {
		score float64
		want  float64
	}{
		{61, 100},  // 刚好达标
		{60, 97.5}, // 差1分几乎达标
		{45, 60},   // 差0.8个等级
		{41, 50},   // 正好低1个等级
		{0, 0},     // 完全不胜任
		{70, 145},  // 在L2内接近精通
		{80, 195},  // 超额近2个等级
		{100, 295}, // 远超要求
	}
	for _, c := range cases {
		comp := 100 + (levelValue(custom, c.score)-levelRankByCode("comprehend"))*50
		if comp < 0 {
			comp = 0
		}
		if math.Abs(comp-c.want) > 1e-9 {
			t.Errorf("score=%v: compV2 = %v, want %v", c.score, comp, c.want)
		}
	}
	// 系统默认档位：85 分落在熟练带(4.5)，要求掌握(3.0) → 100+1.5×50 = 175
	comp := 100 + (levelValue(nil, 85)-levelRankByCode("master"))*50
	if math.Abs(comp-175) > 1e-9 {
		t.Errorf("默认档位 85 分/要求掌握: compV2 = %v, want 175", comp)
	}
}

func TestPointLevelLabel(t *testing.T) {
	levels := []levelMapping{
		{Level: "understand", Min: 56},
		{Level: "comprehend", Min: 69},
		{Level: "master", Min: 79},
		{Level: "proficient", Min: 89},
		{Level: "expert", Min: 96},
	}
	cases := []struct {
		score float64
		want  string
	}{
		{55, "未达标"},
		{56, "了解L1"},
		{69, "理解L2"},
		{79, "掌握L3"},
		{89, "熟练L4"},
		{96, "精通L5"},
	}
	for _, c := range cases {
		if got := pointLevelLabel(levels, c.score); got != c.want {
			t.Errorf("pointLevelLabel(%v) = %s, want %s", c.score, got, c.want)
		}
	}
	// 无自定义时回退默认档位标签
	if got := pointLevelLabel(nil, 95); got != "精通" {
		t.Errorf("默认档位 95 分 label = %s, want 精通", got)
	}
	if got := pointLevelLabel(nil, 85); got != "熟练" {
		t.Errorf("默认档位 85 分 label = %s, want 熟练", got)
	}
	if got := pointLevelLabel(nil, 50); got != "了解" {
		t.Errorf("默认档位 50 分 label = %s, want 了解", got)
	}
}
