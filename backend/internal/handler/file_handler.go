package handler

import (
	"encoding/base64"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"sort"
	"strings"

	"github.com/google/uuid"
	"github.com/zhiyu-saas/backend/internal/middleware"
)

const MaxUploadSize = 100 << 20 // 100MB
const maxFormMemory = 32 << 20  // 32MB in-memory, rest to temp files

type FileHandler struct {
	UploadDir string
}

// logger 记录文件转换等内部错误（响应体不泄漏进程输出）。
var logger = slog.Default()

type UploadResponse struct {
	URL      string `json:"url"`
	Name     string `json:"name"`
	Size     int64  `json:"size"`
	MimeType string `json:"mimeType"`
}

func (h *FileHandler) Upload(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	r.Body = http.MaxBytesReader(w, r.Body, MaxUploadSize)
	if err := r.ParseMultipartForm(maxFormMemory); err != nil {
		respondError(w, http.StatusBadRequest, "文件过大或表单无效")
		return
	}

	file, header, err := r.FormFile("file")
	if err != nil {
		respondError(w, http.StatusBadRequest, "缺少文件字段")
		return
	}
	defer file.Close()

	if err := os.MkdirAll(h.UploadDir, 0o755); err != nil {
		respondServerError(w, r, err, "准备上传目录失败")
		return
	}

	ext := strings.ToLower(filepath.Ext(header.Filename))
	if ext == "" {
		ext = ".bin"
	}

	filename := uuid.NewString() + ext
	destPath := filepath.Join(h.UploadDir, filename)
	destFile, err := os.Create(destPath)
	if err != nil {
		respondServerError(w, r, err, "创建文件失败")
		return
	}
	defer destFile.Close()

	size, err := io.Copy(destFile, file)
	if err != nil {
		respondServerError(w, r, err, "保存文件失败")
		return
	}

	publicURL := "/uploads/" + filename
	respondJSON(w, http.StatusCreated, UploadResponse{
		URL:      publicURL,
		Name:     header.Filename,
		Size:     size,
		MimeType: header.Header.Get("Content-Type"),
	})
}

func (h *FileHandler) Serve(w http.ResponseWriter, r *http.Request) {
	name := strings.TrimPrefix(r.URL.Path, "/uploads/")
	if name == "" || strings.Contains(name, "..") {
		respondError(w, http.StatusBadRequest, "无效文件名")
		return
	}
	path := filepath.Join(h.UploadDir, filepath.Clean(name))
	if !strings.HasPrefix(path, filepath.Clean(h.UploadDir)) {
		respondError(w, http.StatusForbidden, "无效文件路径")
		return
	}
	info, err := os.Stat(path)
	if err != nil || info.IsDir() {
		respondError(w, http.StatusNotFound, "文件不存在")
		return
	}
	http.ServeFile(w, r, path)
}

func (h *FileHandler) Preview(w http.ResponseWriter, r *http.Request) {
	name := r.URL.Query().Get("name")
	if name == "" || strings.Contains(name, "..") {
		respondError(w, http.StatusBadRequest, "无效文件名")
		return
	}
	format := r.URL.Query().Get("format")
	if format == "" {
		format = "html"
	}

	path := filepath.Join(h.UploadDir, filepath.Clean(name))
	if !strings.HasPrefix(path, filepath.Clean(h.UploadDir)) {
		respondError(w, http.StatusForbidden, "无效文件路径")
		return
	}
	info, err := os.Stat(path)
	if err != nil || info.IsDir() {
		respondError(w, http.StatusNotFound, "文件不存在")
		return
	}

	ext := strings.ToLower(filepath.Ext(name))
	if ext != ".doc" && ext != ".docx" && ext != ".xls" && ext != ".xlsx" && ext != ".ppt" && ext != ".pptx" {
		respondError(w, http.StatusBadRequest, "不支持的预览文件类型")
		return
	}

	tmpDir, err := os.MkdirTemp("", "lo-preview-")
	if err != nil {
		respondServerError(w, r, err, "创建temp dir失败")
		return
	}
	defer os.RemoveAll(tmpDir)

	base := strings.TrimSuffix(name, ext)

	if format == "png" {
		cmd := exec.Command("libreoffice", "--headless", "--convert-to", "png", "--outdir", tmpDir, path)
		if _, err := cmd.CombinedOutput(); err != nil {
			respondServerError(w, r, err, "文件转换失败")
			return
		}
		entries, _ := os.ReadDir(tmpDir)
		var images []string
		for _, e := range entries {
			if strings.HasSuffix(strings.ToLower(e.Name()), ".png") {
				data, err := os.ReadFile(filepath.Join(tmpDir, e.Name()))
				if err == nil {
					images = append(images, base64.StdEncoding.EncodeToString(data))
				}
			}
		}
		sort.Slice(images, func(i, j int) bool { return i < j })
		if len(images) == 0 {
			respondServerError(w, r, err, "未生成幻灯片")
			return
		}
		respondJSON(w, http.StatusOK, map[string]any{"images": images})
		return
	}

	outExt := "html"
	if format == "pdf" {
		outExt = "pdf"
	}

	cmd := exec.Command("libreoffice", "--headless", "--convert-to", outExt, "--outdir", tmpDir, path)
	if _, err := cmd.CombinedOutput(); err != nil {
		respondServerError(w, r, err, "文件转换失败")
		return
	}

	outPath := filepath.Join(tmpDir, base+"."+outExt)
	outBytes, err := os.ReadFile(outPath)
	if err != nil {
		respondServerError(w, r, err, "读取converted file失败")
		return
	}

	if format == "pdf" {
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Content-Disposition", "inline; filename=\""+base+".pdf\"")
		enc := base64.StdEncoding.EncodeToString(outBytes)
		json.NewEncoder(w).Encode(map[string]string{"pdf": enc})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"html": string(outBytes)})
}
