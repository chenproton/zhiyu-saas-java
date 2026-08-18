package service

import (
	"archive/zip"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/zhiyu-saas/backend/internal/ai"
	"github.com/zhiyu-saas/backend/internal/domain"
)

// TestChunkText 分块纯函数：空文本无块；短文本单块；长文本多块且不超上限；重叠生效。
func TestChunkText(t *testing.T) {
	if got := chunkText("   \n\n  "); len(got) != 0 {
		t.Fatalf("empty text: expected 0 chunks, got %d", len(got))
	}

	short := "第一段内容。\n第二段内容。"
	got := chunkText(short)
	if len(got) != 1 {
		t.Fatalf("short text: expected 1 chunk, got %d", len(got))
	}

	// 构造超长文本：100 段 × 100 字
	var sb strings.Builder
	for i := 0; i < 100; i++ {
		sb.WriteString(strings.Repeat("知", 100))
		sb.WriteString("\n")
	}
	got = chunkText(sb.String())
	if len(got) < 10 {
		t.Fatalf("long text: expected many chunks, got %d", len(got))
	}
	for _, c := range got {
		if len([]rune(c)) > aiChunkTargetRunes+aiChunkOverlapRunes+2 {
			t.Fatalf("chunk too long: %d runes", len([]rune(c)))
		}
	}

	// 分块上限
	var huge strings.Builder
	for i := 0; i < 5000; i++ {
		huge.WriteString(strings.Repeat("块", 100))
		huge.WriteString("\n")
	}
	if got := chunkText(huge.String()); len(got) > aiDocMaxChunks {
		t.Fatalf("chunk cap: expected ≤ %d, got %d", aiDocMaxChunks, len(got))
	}
}

// TestBuildRetrievalQueries 查询预处理：长句切分取 Top3、短消息整串退化、空消息无查询。
func TestBuildRetrievalQueries(t *testing.T) {
	qs := buildRetrievalQueries("请假流程是什么？另外想知道奖学金申请条件，还有实习证明怎么开？")
	if len(qs) == 0 || len(qs) > aiRetrievalMaxQueries {
		t.Fatalf("expected 1-%d queries, got %d: %v", aiRetrievalMaxQueries, len(qs), qs)
	}
	for _, q := range qs {
		if len([]rune(q)) > aiRetrievalClauseLen {
			t.Fatalf("clause too long: %q", q)
		}
	}

	if qs := buildRetrievalQueries("你好"); len(qs) != 1 {
		t.Fatalf("short message fallback: expected 1 query, got %v", qs)
	}
	if qs := buildRetrievalQueries("，。！？"); len(qs) != 0 {
		t.Fatalf("punctuation only: expected 0 queries, got %v", qs)
	}
}

// TestBuildChatMessages 提示词装配：有资料含引用规则；无资料含「未找到资料」话术；历史与用户消息顺序正确。
func TestBuildChatMessages(t *testing.T) {
	chunks := []domain.AIKBChunk{{DocName: "学生手册", Seq: 3, Content: "请假需提前三天申请"}}
	history := []domain.AIMessage{{Role: "user", Content: "之前的问题"}, {Role: "assistant", Content: "之前的回答"}}

	msgs := buildChatMessages("你是课程助教", chunks, history, "怎么请假？")
	if len(msgs) != 4 {
		t.Fatalf("expected 4 messages, got %d", len(msgs))
	}
	if msgs[0].Role != "system" || !strings.Contains(msgs[0].Content, "课程助教") || !strings.Contains(msgs[0].Content, "学生手册") || !strings.Contains(msgs[0].Content, "【资料1】") {
		t.Fatalf("system prompt missing context: %s", msgs[0].Content)
	}
	if msgs[3].Role != "user" || msgs[3].Content != "怎么请假？" {
		t.Fatalf("last message should be user question, got %+v", msgs[3])
	}

	msgs = buildChatMessages("你是助教", nil, nil, "问题")
	if !strings.Contains(msgs[0].Content, "未找到相关资料") {
		t.Fatalf("no-chunk system prompt should contain fallback notice: %s", msgs[0].Content)
	}
	if strings.Contains(msgs[0].Content, "【资料") {
		t.Fatalf("no-chunk prompt must not contain source labels")
	}
}

// TestChunksToSources 溯源片段截断。
func TestChunksToSources(t *testing.T) {
	if got := chunksToSources(nil); got != nil {
		t.Fatalf("nil chunks → nil sources, got %v", got)
	}
	long := strings.Repeat("长", 300)
	got := chunksToSources([]domain.AIKBChunk{{DocID: "d1", DocName: "文档", Seq: 1, Content: long}})
	if len(got) != 1 || len([]rune(got[0].Snippet)) != aiSourceSnippetRunes {
		t.Fatalf("snippet truncation failed: %+v", got)
	}
}

// TestExtractDocxText DOCX 解析：构造最小 zip + document.xml。
func TestExtractDocxText(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "t.docx")
	f, err := os.Create(path)
	if err != nil {
		t.Fatal(err)
	}
	zw := zip.NewWriter(f)
	w, err := zw.Create("word/document.xml")
	if err != nil {
		t.Fatal(err)
	}
	_, _ = w.Write([]byte(`<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>第一段文字</w:t></w:r></w:p><w:p><w:r><w:t>第二段文字</w:t></w:r></w:p></w:body></w:document>`))
	if err := zw.Close(); err != nil {
		t.Fatal(err)
	}
	f.Close()

	text, err := extractDocText(path)
	if err != nil {
		t.Fatalf("extract docx: %v", err)
	}
	if !strings.Contains(text, "第一段文字") || !strings.Contains(text, "第二段文字") {
		t.Fatalf("docx text missing paragraphs: %q", text)
	}
}

// TestExtractDocTextUnsupported 不支持格式报错（含 .doc）。
func TestExtractDocTextUnsupported(t *testing.T) {
	if _, err := extractDocText("/tmp/x.doc"); err == nil || !strings.Contains(err.Error(), "不支持") {
		t.Fatalf("expected unsupported error, got %v", err)
	}
}

// TestValidateIntegration URL 白名单（XSS 防线）：javascript: 拒绝、http/https 放行。
func TestValidateIntegration(t *testing.T) {
	bad := IntegrationInput{Kind: "app", Name: "x", URL: "javascript:alert(1)"}
	if err := validateIntegration(&bad); err == nil {
		t.Fatal("javascript: URL must be rejected")
	}
	good := IntegrationInput{Kind: "agent", Name: "x", URL: "https://example.com/agent"}
	if err := validateIntegration(&good); err != nil {
		t.Fatalf("https URL should pass: %v", err)
	}
}

// 防止 ai 包 import 被误删（buildChatMessages 返回值类型锚点）。
var _ = ai.Message{}
