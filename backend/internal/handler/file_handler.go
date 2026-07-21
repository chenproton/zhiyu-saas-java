package handler

import (
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/google/uuid"
	"github.com/zhiyu-saas/backend/internal/middleware"
)

const MaxUploadSize = 100 << 20 // 100MB
const maxFormMemory = 32 << 20  // 32MB in-memory, rest to temp files

type FileHandler struct {
	UploadDir string
}

type UploadResponse struct {
	URL      string `json:"url"`
	Name     string `json:"name"`
	Size     int64  `json:"size"`
	MimeType string `json:"mimeType"`
}

func (h *FileHandler) Upload(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "permission denied")
		return
	}

	r.Body = http.MaxBytesReader(w, r.Body, MaxUploadSize)
	if err := r.ParseMultipartForm(maxFormMemory); err != nil {
		respondError(w, http.StatusBadRequest, "file too large or invalid form")
		return
	}

	file, header, err := r.FormFile("file")
	if err != nil {
		respondError(w, http.StatusBadRequest, "missing file field")
		return
	}
	defer file.Close()

	if err := os.MkdirAll(h.UploadDir, 0o755); err != nil {
		respondError(w, http.StatusInternalServerError, "failed to prepare upload directory")
		return
	}

	ext := strings.ToLower(filepath.Ext(header.Filename))
	if ext == "" {
		ext = ".bin"
	}
	allowed := map[string]bool{
		".pdf": true, ".doc": true, ".docx": true, ".ppt": true, ".pptx": true,
		".xls": true, ".xlsx": true, ".txt": true,
		".mp4": true, ".mov": true, ".avi": true, ".mkv": true, ".webm": true,
		".mp3": true, ".wav": true, ".ogg": true,
		".jpg": true, ".jpeg": true, ".png": true, ".gif": true, ".webp": true,
		".zip": true, ".rar": true, ".7z": true,
	}
	if !allowed[ext] {
		respondError(w, http.StatusBadRequest, "file type not allowed")
		return
	}

	filename := uuid.NewString() + ext
	destPath := filepath.Join(h.UploadDir, filename)
	destFile, err := os.Create(destPath)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to create file")
		return
	}
	defer destFile.Close()

	size, err := io.Copy(destFile, file)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to save file")
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
		respondError(w, http.StatusBadRequest, "invalid file name")
		return
	}
	path := filepath.Join(h.UploadDir, filepath.Clean(name))
	if !strings.HasPrefix(path, filepath.Clean(h.UploadDir)) {
		respondError(w, http.StatusForbidden, "invalid file path")
		return
	}
	info, err := os.Stat(path)
	if err != nil || info.IsDir() {
		respondError(w, http.StatusNotFound, "file not found")
		return
	}
	http.ServeFile(w, r, path)
}

func (h *FileHandler) absUploadDir(projectRoot string) string {
	if h.UploadDir != "" {
		return h.UploadDir
	}
	return filepath.Join(projectRoot, "public", "uploads")
}

// FormatSize returns a human readable size string.
func FormatSize(size int64) string {
	const unit = 1024
	if size < unit {
		return fmt.Sprintf("%d B", size)
	}
	div, exp := int64(unit), 0
	for n := size / unit; n >= unit; n /= unit {
		div *= unit
		exp++
	}
	return fmt.Sprintf("%.1f %cB", float64(size)/float64(div), "KMGTPE"[exp])
}
