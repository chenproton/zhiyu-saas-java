package store

import (
	"time"

	"github.com/jackc/pgx/v5"
)

// CitationBucket 引用次数分桶（Label 为展示文案）。
type CitationBucket struct {
	Label string `json:"label"`
	Count int    `json:"count"`
}

// CitationStats 引用次数分布统计（顶部指标卡片用）。
type CitationStats struct {
	Buckets   []CitationBucket `json:"buckets"`
	ZeroCount int              `json:"zeroCount"`
	Total     int              `json:"total"`
}

// UncitedItem 零引用条目（弹窗列表：名称 + 上传时间）。
type UncitedItem struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	CreatedAt time.Time `json:"createdAt"`
}

// citationBucketCase 引用次数分桶 SQL 片段（ref_count 为子查询别名）。
const citationBucketCase = `
	CASE
		WHEN ref_count = 0 THEN '0次'
		WHEN ref_count <= 5 THEN '1-5次'
		WHEN ref_count <= 10 THEN '6-10次'
		WHEN ref_count <= 100 THEN '11-100次'
		ELSE '100次以上'
	END AS bucket`

// citationBucketLabels 固定分桶顺序（前端柱状图从左到右）。
var citationBucketLabels = []string{"0次", "1-5次", "6-10次", "11-100次", "100次以上"}

// scanCitationStats 将 (bucket, count) 行组装为固定顺序分桶统计。
func scanCitationStats(rows pgx.Rows) (CitationStats, error) {
	counts := make(map[string]int, len(citationBucketLabels))
	total := 0
	for rows.Next() {
		var label string
		var count int
		if err := rows.Scan(&label, &count); err != nil {
			return CitationStats{}, err
		}
		counts[label] = count
		total += count
	}
	if err := rows.Err(); err != nil {
		return CitationStats{}, err
	}
	stats := CitationStats{Buckets: make([]CitationBucket, 0, len(citationBucketLabels)), Total: total}
	for _, label := range citationBucketLabels {
		stats.Buckets = append(stats.Buckets, CitationBucket{Label: label, Count: counts[label]})
	}
	stats.ZeroCount = counts["0次"]
	return stats, nil
}
