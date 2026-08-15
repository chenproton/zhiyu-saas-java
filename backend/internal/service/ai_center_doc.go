// AI 智能服务中心：文档上传 + 异步解析 + 分块（docs/spec/ai-service-center.md §3.3）。
// 解析流水线：extractText（纯函数，PDF/DOCX/TXT/MD）→ chunkText（纯函数）→ 落库。
// goroutine 带超时 + panic recover + 状态守卫（FinishDocumentParse WHERE status='parsing'）。
package service

import (
	"archive/zip"
	"context"
	"encoding/xml"
	"fmt"
	"io"
	"log/slog"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/ledongthuc/pdf"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/store"
)

// 解析流水线护栏（docs/spec/ai-service-center.md §9.2）。
const (
	aiDocMaxTextRunes   = 200000 // 单文档文本截断
	aiDocMaxChunks      = 800    // 单文档分块上限
	aiChunkTargetRunes  = 500    // 分块目标长度
	aiChunkOverlapRunes = 50     // 相邻分块重叠
	aiParseTimeout      = 5 * time.Minute
)

// aiSupportedExts 文档扩展名白名单（D2：不含 .doc，OCR/音视频/URL 不做）。
var aiSupportedExts = map[string]bool{
	".pdf": true, ".docx": true, ".txt": true, ".md": true,
}

// AISupportedDocExt 供 handler 校验扩展名。
func AISupportedDocExt(ext string) bool { return aiSupportedExts[strings.ToLower(ext)] }

// RegisterDocument 文档落库并触发异步解析（文件已由 handler 落盘）。
func (svc *AICenterService) RegisterDocument(ctx context.Context, tenantID, kbID, userID, filename, savedPath string, fileSize int64, mime string) (*domain.AIKBDocument, error) {
	_, role, err := svc.getKBWithRole(ctx, tenantID, kbID, userID)
	if err != nil {
		return nil, err
	}
	if role != "owner" && role != domain.AICollaboratorEditor {
		return nil, store.ErrForbidden
	}
	doc := &domain.AIKBDocument{
		TenantID: tenantID, KbID: kbID, UploaderID: userID,
		Name: filename, FilePath: savedPath, FileSize: fileSize, Mime: mime,
	}
	if err := svc.s.Store().AICenter().CreateDocument(ctx, doc); err != nil {
		return nil, err
	}
	svc.triggerParse(doc.ID, tenantID, kbID, savedPath)
	return doc, nil
}

// DeleteDocument 删除文档（owner/editor；返回文件路径供清理）。
func (svc *AICenterService) DeleteDocument(ctx context.Context, tenantID, kbID, docID, userID string) (string, error) {
	_, role, err := svc.getKBWithRole(ctx, tenantID, kbID, userID)
	if err != nil {
		return "", err
	}
	if role != "owner" && role != domain.AICollaboratorEditor {
		return "", store.ErrForbidden
	}
	doc, err := svc.s.Store().AICenter().GetDocument(ctx, tenantID, kbID, docID)
	if err != nil {
		return "", err
	}
	if err := svc.s.Store().AICenter().DeleteDocument(ctx, tenantID, kbID, docID); err != nil {
		return "", err
	}
	svc.s.Store().AICenter().RefreshKBDocCount(ctx, tenantID, kbID)
	return doc.FilePath, nil
}

// GetDocument 文档状态（轮询用，可见者）。
func (svc *AICenterService) GetDocument(ctx context.Context, tenantID, kbID, docID, userID string) (*domain.AIKBDocument, error) {
	if _, _, err := svc.getKBWithRole(ctx, tenantID, kbID, userID); err != nil {
		return nil, err
	}
	return svc.s.Store().AICenter().GetDocument(ctx, tenantID, kbID, docID)
}

// triggerParse 异步解析：脱离请求生命周期，独立超时；panic 兜底标记 failed。
func (svc *AICenterService) triggerParse(docID, tenantID, kbID, path string) {
	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), aiParseTimeout)
		defer cancel()
		defer func() {
			if rec := recover(); rec != nil {
				slog.Error("ai doc parse panic", "docId", docID, "panic", rec)
				_ = svc.s.Store().AICenter().FinishDocumentParse(ctx, tenantID, docID, domain.AIDocStatusFailed, "解析内部错误", 0, 0)
			}
		}()
		text, err := extractDocText(path)
		if err != nil {
			slog.Warn("ai doc parse failed", "docId", docID, "error", err)
			_ = svc.s.Store().AICenter().FinishDocumentParse(ctx, tenantID, docID, domain.AIDocStatusFailed, err.Error(), 0, 0)
			return
		}
		chunks := chunkText(text)
		if len(chunks) == 0 {
			_ = svc.s.Store().AICenter().FinishDocumentParse(ctx, tenantID, docID, domain.AIDocStatusFailed, "未提取到文本内容（可能为扫描件，暂不支持 OCR）", 0, 0)
			return
		}
		rows := make([]domain.AIKBChunk, len(chunks))
		for i, c := range chunks {
			rows[i] = domain.AIKBChunk{TenantID: tenantID, DocID: docID, KbID: kbID, Seq: i + 1, Content: c}
		}
		if err := svc.s.Store().AICenter().InsertChunks(ctx, rows); err != nil {
			slog.Error("ai doc chunks insert failed", "docId", docID, "error", err)
			_ = svc.s.Store().AICenter().FinishDocumentParse(ctx, tenantID, docID, domain.AIDocStatusFailed, "分块写入失败", 0, 0)
			return
		}
		charCount := len([]rune(text))
		_ = svc.s.Store().AICenter().FinishDocumentParse(ctx, tenantID, docID, domain.AIDocStatusReady, "", len(chunks), charCount)
		svc.s.Store().AICenter().RefreshKBDocCount(ctx, tenantID, kbID)
	}()
}

// ==================== 文本提取（纯函数，可单测）====================

// extractDocText 按扩展名提取纯文本。
func extractDocText(path string) (string, error) {
	ext := strings.ToLower(filepath.Ext(path))
	switch ext {
	case ".txt", ".md":
		raw, err := os.ReadFile(path)
		if err != nil {
			return "", fmt.Errorf("读取文件失败: %w", err)
		}
		return truncateRunes(strings.TrimPrefix(string(raw), "\uFEFF"), aiDocMaxTextRunes), nil
	case ".pdf":
		return extractPDFText(path)
	case ".docx":
		return extractDocxText(path)
	default:
		return "", fmt.Errorf("不支持的格式 %s（支持 PDF/DOCX/TXT/MD）", ext)
	}
}

// extractPDFText PDF 文本提取（ledongthuc/pdf，纯 Go）。
func extractPDFText(path string) (string, error) {
	f, r, err := pdf.Open(path)
	if err != nil {
		return "", fmt.Errorf("PDF 打开失败（文件可能加密或损坏）")
	}
	defer f.Close()
	var sb strings.Builder
	for i := 1; i <= r.NumPage(); i++ {
		p := r.Page(i)
		if p.V.IsNull() {
			continue
		}
		content, err := p.GetPlainText(nil)
		if err != nil {
			continue // 单页失败不阻断整篇（容忍坏页）
		}
		sb.WriteString(content)
		sb.WriteByte('\n')
		if sb.Len() > aiDocMaxTextRunes*4 { // 粗截断（字节级），精确截断在出口
			break
		}
	}
	return truncateRunes(sb.String(), aiDocMaxTextRunes), nil
}

// extractDocxText DOCX = zip 内 word/document.xml，提取 w:t 文本、w:p 分段。
func extractDocxText(path string) (string, error) {
	zr, err := zip.OpenReader(path)
	if err != nil {
		return "", fmt.Errorf("DOCX 打开失败（文件损坏）")
	}
	defer zr.Close()
	var docFile io.ReadCloser
	for _, f := range zr.File {
		if f.Name == "word/document.xml" {
			rc, err := f.Open()
			if err != nil {
				return "", fmt.Errorf("DOCX 内容读取失败")
			}
			docFile = rc
			break
		}
	}
	if docFile == nil {
		return "", fmt.Errorf("不是合法的 DOCX（缺少 document.xml）")
	}
	defer docFile.Close()

	var sb strings.Builder
	decoder := xml.NewDecoder(docFile)
	for {
		tok, err := decoder.Token()
		if err == io.EOF {
			break
		}
		if err != nil {
			return "", fmt.Errorf("DOCX 解析失败")
		}
		switch t := tok.(type) {
		case xml.StartElement:
			if t.Name.Local == "p" && sb.Len() > 0 {
				sb.WriteByte('\n')
			}
		case xml.CharData:
			sb.Write(t)
		}
		if sb.Len() > aiDocMaxTextRunes*4 {
			break
		}
	}
	return truncateRunes(sb.String(), aiDocMaxTextRunes), nil
}

// ==================== 分块（纯函数，可单测）====================

// chunkText 按段落聚合分块：目标 500 字、重叠 50 字、上限 800 块。
func chunkText(text string) []string {
	text = strings.ReplaceAll(text, "\r\n", "\n")
	paras := strings.Split(text, "\n")
	var chunks []string
	var cur []rune
	flush := func() {
		s := strings.TrimSpace(string(cur))
		if s != "" {
			chunks = append(chunks, s)
		}
	}
	for _, p := range paras {
		pr := []rune(strings.TrimSpace(p))
		if len(pr) == 0 {
			continue
		}
		// 单段落超长：按目标长度硬切
		for len(pr) > aiChunkTargetRunes {
			if len(cur) > 0 {
				flush()
				cur = nil
			}
			chunks = append(chunks, string(pr[:aiChunkTargetRunes]))
			pr = pr[aiChunkTargetRunes-aiChunkOverlapRunes:]
			if len(chunks) >= aiDocMaxChunks {
				return chunks
			}
		}
		if len(cur)+len(pr)+1 > aiChunkTargetRunes {
			prev := cur
			flush()
			cur = nil
			// 重叠：携带上一块尾部
			if len(prev) > aiChunkOverlapRunes {
				cur = append(cur, prev[len(prev)-aiChunkOverlapRunes:]...)
			}
		}
		if len(cur) > 0 {
			cur = append(cur, '\n')
		}
		cur = append(cur, pr...)
	}
	if len(chunks) < aiDocMaxChunks {
		flush()
	}
	if len(chunks) > aiDocMaxChunks {
		chunks = chunks[:aiDocMaxChunks]
	}
	return chunks
}

// truncateRunes 按字符数截断。
func truncateRunes(s string, max int) string {
	r := []rune(s)
	if len(r) <= max {
		return s
	}
	return string(r[:max])
}
