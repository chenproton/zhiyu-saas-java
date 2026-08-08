package handler

import (
	"encoding/base64"
	"encoding/json"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"sort"
	"strconv"
	"strings"

	"github.com/google/uuid"
	"github.com/zhiyu-saas/backend/internal/middleware"
)

const MaxUploadSize = 100 << 20 // 100MB
const maxFormMemory = 32 << 20  // 32MB in-memory, rest to temp files

// pageNum 从文件名中提取页码数字（幻灯片1.png → 1），无数字时按字典序兜底。
func pageNum(name string) int {
	digits := strings.Builder{}
	started := false
	for _, r := range name {
		if r >= '0' && r <= '9' {
			digits.WriteRune(r)
			started = true
		} else if started {
			break
		}
	}
	if digits.Len() == 0 {
		return 0
	}
	n, err := strconv.Atoi(digits.String())
	if err != nil {
		return 0
	}
	return n
}

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
	if r.MultipartForm != nil {
		defer r.MultipartForm.RemoveAll()
	}

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

// 允许直接输出的文件扩展名白名单，与 kkFileView 4.4.0 支持的全部格式对齐
// （来源：kkFileView FileType.java 及 application.properties 的 simText/media 配置）
// 其中 html/htm/svg/xml/xbrl 等可执行类型由 Serve 附加 CSP sandbox + nosniff 头防存储型 XSS
var allowedServeExts = map[string]bool{
	// kkFileView PICTURE
	".png": true, ".jpg": true, ".jpeg": true, ".gif": true, ".bmp": true, ".webp": true,
	".avif": true, ".ico": true, ".jfif": true,
	// kkFileView PDF / OFD / TIFF / SVG
	".pdf": true, ".ofd": true, ".tif": true, ".tiff": true, ".svg": true,
	// kkFileView SIMTEXT/XML：直开有 XSS 风险，Serve 时附加 CSP sandbox 头
	".html": true, ".htm": true, ".xml": true, ".xbrl": true,
	// kkFileView OFFICE（LibreOffice 转换）
	".doc": true, ".docx": true, ".docm": true, ".dot": true, ".dotx": true, ".dotm": true,
	".wps": true, ".wpt": true,
	".xls": true, ".xlsx": true, ".xlsm": true, ".xlt": true, ".xltx": true, ".xltm": true,
	".xlam": true, ".xla": true, ".et": true, ".ett": true, ".ods": true, ".ots": true,
	".csv": true, ".tsv": true,
	".ppt": true, ".pptx": true, ".dps": true, ".odp": true, ".otp": true, ".sxi": true,
	".rtf": true, ".odt": true, ".ott": true, ".vsd": true, ".vsdx": true, ".fodt": true,
	".fods": true, ".pages": true,
	".wmf": true, ".emf": true, ".tga": true, ".psd": true, ".eps": true,
	// kkFileView COMPRESS
	".zip": true, ".rar": true, ".7z": true, ".jar": true, ".tar": true, ".gzip": true,
	// kkFileView CAD（aspose-cad 转 svg）
	".dwg": true, ".dxf": true, ".dwf": true, ".dwfx": true, ".dwt": true, ".dng": true,
	".cf2": true, ".plt": true,
	// kkFileView ONLINE3D（three.js 在线渲染）
	".stl": true, ".obj": true, ".3ds": true, ".ply": true, ".off": true, ".3dm": true,
	".fbx": true, ".dae": true, ".wrl": true, ".3mf": true, ".glb": true, ".gltf": true,
	".o3dv": true, ".stp": true, ".step": true, ".iges": true, ".igs": true, ".brep": true,
	".bim": true, ".fcstd": true, ".ifc": true,
	// kkFileView MEDIA / MEDIACONVERT（ffmpeg 转码）
	".mp3": true, ".wav": true, ".m4a": true, ".mp4": true, ".webm": true, ".flv": true,
	".mpeg": true, ".mpd": true, ".m3u8": true, ".ts": true,
	".avi": true, ".mov": true, ".wmv": true, ".mkv": true, ".3gp": true, ".rm": true,
	// kkFileView 文本 / 代码（simText / code 高亮预览）
	".txt": true, ".md": true, ".log": true, ".json": true, ".properties": true,
	".yaml": true, ".yml": true, ".gitignore": true,
	".java": true, ".py": true, ".c": true, ".cpp": true, ".h": true, ".php": true,
	".go": true, ".js": true, ".css": true, ".lua": true, ".sh": true, ".rb": true,
	".sql": true, ".bat": true, ".m": true, ".bas": true, ".prg": true, ".cmd": true,
	".cs": true, ".ftl": true, ".asp": true, ".jsp": true, ".aspx": true,
	// kkFileView 其他（EML / XMIND / EPUB / DCM / DRAWIO / XML / BPMN）
	".eml": true, ".xmind": true, ".epub": true, ".dcm": true, ".drawio": true,
	".bpmn": true,
}

// 浏览器可直接执行/渲染的文件类型：直开存在存储型 XSS 风险，
// 通过 CSP sandbox 禁止脚本执行，nosniff 阻止类型混淆
var xssRiskyExts = map[string]bool{
	".html": true, ".htm": true, ".svg": true, ".xml": true, ".xbrl": true,
}

func (h *FileHandler) Serve(w http.ResponseWriter, r *http.Request) {
	name := strings.TrimPrefix(r.URL.Path, "/uploads/")
	if name == "" || strings.Contains(name, "..") {
		respondError(w, http.StatusBadRequest, "无效文件名")
		return
	}
	if !allowedServeExts[strings.ToLower(filepath.Ext(name))] {
		respondError(w, http.StatusForbidden, "文件类型不允许直接访问")
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
	if xssRiskyExts[strings.ToLower(filepath.Ext(name))] {
		w.Header().Set("Content-Security-Policy", "sandbox")
		w.Header().Set("X-Content-Type-Options", "nosniff")
	}
	http.ServeFile(w, r, path)
}

func (h *FileHandler) Preview(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
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
		// 按文件名中的页码数字排序（如 1.png、2.png … 或 幻灯片1.png），
		// 保证多页 PPT 转换后的翻页顺序与页码一致
		sort.Slice(entries, func(i, j int) bool {
			return pageNum(entries[i].Name()) < pageNum(entries[j].Name())
		})
		var images []string
		for _, e := range entries {
			if strings.HasSuffix(strings.ToLower(e.Name()), ".png") {
				data, err := os.ReadFile(filepath.Join(tmpDir, e.Name()))
				if err == nil {
					images = append(images, base64.StdEncoding.EncodeToString(data))
				}
			}
		}
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
