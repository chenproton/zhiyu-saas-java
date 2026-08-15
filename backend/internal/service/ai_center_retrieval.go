// AI 智能服务中心：检索召回 + 提示词装配（纯函数，可单测；spec §2.2/§3.2）。
package service

import (
	"context"
	"sort"
	"strconv"
	"strings"
	"unicode"

	"github.com/zhiyu-saas/backend/internal/ai"
	"github.com/zhiyu-saas/backend/internal/domain"
)

// 召回参数（spec §9.2 风险缓解）。
const (
	aiRetrievalTopN       = 6   // 召回分块数
	aiRetrievalMaxQueries = 3   // 查询子句数
	aiRetrievalClauseLen  = 32  // 子句最大长度（rune）
	aiRetrievalMinClause  = 4   // 子句最小长度（过短无区分度）
	aiContextHistoryLimit = 10  // 上下文记忆最近 10 条（5 轮）
	aiSourceSnippetRunes  = 120 // 溯源片段长度
)

// buildRetrievalQueries 查询预处理：按标点切分取 Top3 长句（pg_trgm 整句相似度对长短差异敏感，
// 切短句召回更稳）；无有效子句时退化为消息前 32 字。
func buildRetrievalQueries(message string) []string {
	segments := strings.FieldsFunc(message, func(r rune) bool {
		return unicode.IsPunct(r) || unicode.IsSpace(r)
	})
	var candidates []string
	for _, s := range segments {
		s = strings.TrimSpace(s)
		if len([]rune(s)) >= aiRetrievalMinClause {
			candidates = append(candidates, truncateRunes(s, aiRetrievalClauseLen))
		}
	}
	sort.SliceStable(candidates, func(i, j int) bool {
		return len([]rune(candidates[i])) > len([]rune(candidates[j]))
	})
	seen := map[string]bool{}
	out := make([]string, 0, aiRetrievalMaxQueries)
	for _, c := range candidates {
		if seen[c] {
			continue
		}
		seen[c] = true
		out = append(out, c)
		if len(out) >= aiRetrievalMaxQueries {
			break
		}
	}
	if len(out) == 0 {
		// 退化整串兜底：消息需含有效字符（纯标点/空白不召回，避免无意义全库扫描）
		if strings.IndexFunc(message, func(r rune) bool {
			return !unicode.IsPunct(r) && !unicode.IsSpace(r)
		}) >= 0 {
			if q := strings.TrimSpace(truncateRunes(message, aiRetrievalClauseLen)); q != "" {
				out = append(out, q)
			}
		}
	}
	return out
}

// buildChatMessages 装配对话消息（纯函数）：system_prompt + 召回资料段 + 引用规则 + 历史 + 用户问题。
func buildChatMessages(systemPrompt string, chunks []domain.AIKBChunk, history []domain.AIMessage, question string) []ai.Message {
	var sys strings.Builder
	sys.WriteString(strings.TrimSpace(systemPrompt))
	if len(chunks) > 0 {
		sys.WriteString("\n\n以下是与用户问题相关的知识库资料（回答时优先依据这些资料，并在引用处标注【资料N】）：\n")
		for i, c := range chunks {
			sys.WriteString("\n【资料")
			sys.WriteString(strconv.Itoa(i + 1))
			sys.WriteString("】《")
			sys.WriteString(c.DocName)
			sys.WriteString("》第")
			sys.WriteString(strconv.Itoa(c.Seq))
			sys.WriteString("段：")
			sys.WriteString(c.Content)
			sys.WriteString("\n")
		}
		sys.WriteString("\n回答规则：资料不足以回答时明确说明「知识库中未找到完全匹配的资料」，不要编造来源。")
	} else {
		sys.WriteString("\n\n（本次未从知识库检索到相关资料。若问题明显依赖知识库内容，请告知用户「知识库中未找到相关资料」；通用知识问题可正常回答，但不得虚构引用来源。）")
	}
	msgs := []ai.Message{{Role: "system", Content: sys.String()}}
	for _, m := range history {
		msgs = append(msgs, ai.Message{Role: m.Role, Content: m.Content})
	}
	msgs = append(msgs, ai.Message{Role: "user", Content: question})
	return msgs
}

// chunksToSources 召回分块 → 溯源片段（截断）。
func chunksToSources(chunks []domain.AIKBChunk) []domain.AIMessageSource {
	if len(chunks) == 0 {
		return nil
	}
	out := make([]domain.AIMessageSource, len(chunks))
	for i, c := range chunks {
		out[i] = domain.AIMessageSource{
			DocID:   c.DocID,
			DocName: c.DocName,
			Seq:     c.Seq,
			Snippet: truncateRunes(strings.TrimSpace(c.Content), aiSourceSnippetRunes),
		}
	}
	return out
}

// retrieveChunks 召回：查询预处理 + store 检索（可见性过滤在 SQL 层）。
func (svc *AICenterService) retrieveChunks(ctx context.Context, tenantID, userID string, kbIDs []string, message string) ([]domain.AIKBChunk, error) {
	queries := buildRetrievalQueries(message)
	if len(queries) == 0 || len(kbIDs) == 0 {
		return nil, nil
	}
	return svc.s.Store().AICenter().SearchChunks(ctx, tenantID, userID, kbIDs, queries, aiRetrievalTopN)
}
