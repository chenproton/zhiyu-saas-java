package handler

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/zhiyu-saas/backend/internal/middleware"
)

const MaxUploadSize = 100 << 20 // 100MB
const maxFormMemory = 32 << 20  // 32MB in-memory, rest to temp files

// signURLTTL 签名 URL 有效期：kkFileView 大文件（Office 转 PDF）转换耗时较长，取 15 分钟。
const signURLTTL = 15 * time.Minute

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
	JWTSecret string
	// CrossTenantAccess 跨租户文件访问判定（可选）：当请求租户与文件归属租户不一致时调用。
	// 当前实现为联盟公开企业文件放行——文件租户存在对本请求租户公开可见的企业
	// （enable_public + 学校侧 is_public 未终止链接）时返回 true。
	CrossTenantAccess func(ctx context.Context, fileTenantID, viewerTenantID string) (bool, error)
	// IsPublicAllianceFile 联盟公开前台文件判定（可选）：文件被公开联盟数据
	// （enable_public 企业 / is_public 成果/项目/品牌/专家）引用时对任意访问者放行，
	// 与公开接口（enable_public/is_public 即对外可见）语义对齐，修复"接口返回数据但图片 403"。
	IsPublicAllianceFile func(ctx context.Context, fileTenantID, fileURL string) (bool, error)
}

type UploadResponse struct {
	URL      string `json:"url"`
	Name     string `json:"name"`
	Size     int64  `json:"size"`
	MimeType string `json:"mimeType"`
}

func (h *FileHandler) Upload(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil || claims.TenantID == nil || *claims.TenantID == "" {
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

	ext := strings.ToLower(filepath.Ext(header.Filename))
	if ext == "" {
		ext = ".bin"
	}
	if !allowedUploadExts[ext] {
		respondError(w, http.StatusBadRequest, "不支持的文件类型")
		return
	}

	// 服务端 sniff 校验：内容与扩展名明显不符（如伪装成图片的 HTML/脚本）一律拒绝，
	// 防止存储型 XSS 通过扩展名混淆上传成功
	sniffBuf := make([]byte, 512)
	n, _ := io.ReadFull(file, sniffBuf)
	if isRiskySniff(http.DetectContentType(sniffBuf[:n])) && !textFileExts[ext] {
		respondError(w, http.StatusBadRequest, "文件内容与类型不符")
		return
	}

	tenantDir := filepath.Join(h.UploadDir, filepath.Clean(*claims.TenantID))
	if err := os.MkdirAll(tenantDir, 0o755); err != nil {
		respondServerError(w, r, err, "准备上传目录失败")
		return
	}

	filename := uuid.NewString() + ext
	destPath := filepath.Join(tenantDir, filename)
	destFile, err := os.Create(destPath)
	if err != nil {
		respondServerError(w, r, err, "创建文件失败")
		return
	}
	defer destFile.Close()

	size, err := io.Copy(destFile, io.MultiReader(strings.NewReader(string(sniffBuf[:n])), file))
	if err != nil {
		respondServerError(w, r, err, "保存文件失败")
		return
	}

	publicURL := "/uploads/" + *claims.TenantID + "/" + filename
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

// allowedUploadExts 上传扩展名白名单：与下载侧 allowedServeExts 完全对齐，
// 保证上传的文件都能被预览/直出，杜绝"能传不能看"或"能传不能查"的类型。
var allowedUploadExts = allowedServeExts

// textFileExts 文本/代码类扩展名：sniff 出 HTML/JS 内容时这些扩展名属于正常形态
// （如 .txt 内容恰为 HTML 片段），不做拒绝
var textFileExts = map[string]bool{
	".txt": true, ".md": true, ".log": true, ".json": true, ".properties": true,
	".yaml": true, ".yml": true, ".gitignore": true,
	".java": true, ".py": true, ".c": true, ".cpp": true, ".h": true, ".php": true,
	".go": true, ".js": true, ".css": true, ".lua": true, ".sh": true, ".rb": true,
	".sql": true, ".bat": true, ".m": true, ".bas": true, ".prg": true, ".cmd": true,
	".cs": true, ".ftl": true, ".asp": true, ".jsp": true, ".aspx": true,
	".html": true, ".htm": true, ".svg": true, ".xml": true, ".xbrl": true,
	".csv": true, ".tsv": true, ".rtf": true, ".m3u8": true, ".mpd": true,
	".drawio": true, ".bpmn": true, ".eml": true,
}

// riskySniffTypes 内容嗅探出的可执行类型：扩展名不在文本/代码白名单内即拒绝
var riskySniffTypes = map[string]bool{
	"text/html":                     true,
	"text/javascript":               true,
	"application/javascript":        true,
	"application/x-javascript":      true,
	"application/x-msdownload":      true,
	"application/x-dosexec":         true,
	"application/x-shockwave-flash": true,
}

func isRiskySniff(sniff string) bool {
	sniff = strings.ToLower(sniff)
	for t := range riskySniffTypes {
		if strings.HasPrefix(sniff, t) {
			return true
		}
	}
	return false
}

// signURL 为上传路径生成短时签名 URL（kkFileView 等无 cookie/无 Authorization
// 的服务端抓取方使用）；签名绑定完整路径与过期时间，防篡改与防永久 URL。
func (h *FileHandler) signURL(path string) string {
	exp := strconv.FormatInt(time.Now().Add(signURLTTL).Unix(), 10)
	mac := hmac.New(sha256.New, []byte(h.JWTSecret))
	mac.Write([]byte(path + "|" + exp))
	sig := hex.EncodeToString(mac.Sum(nil))
	return path + "?exp=" + exp + "&sig=" + sig
}

// verifySignURL 校验签名 URL 的签名与有效期。
func (h *FileHandler) verifySignURL(r *http.Request) bool {
	exp := r.URL.Query().Get("exp")
	sig := r.URL.Query().Get("sig")
	if exp == "" || sig == "" {
		return false
	}
	expUnix, err := strconv.ParseInt(exp, 10, 64)
	if err != nil || time.Now().Unix() >= expUnix {
		return false
	}
	mac := hmac.New(sha256.New, []byte(h.JWTSecret))
	mac.Write([]byte(r.URL.Path + "|" + exp))
	expected := hex.EncodeToString(mac.Sum(nil))
	return hmac.Equal([]byte(expected), []byte(sig))
}

// resolveTenant 解析请求所属租户：签名 URL（公开可验证）直接取路径段；
// 否则要求登录态且租户匹配，未登录 401、跨租户 403。
// 双端登录（portal+partner cookie 共存）时，按 URL 租户在候选 claims 中匹配取用。
// 租户仍不匹配时，若配置了 CrossTenantAccess 且判定放行（联盟公开企业文件），
// 允许跨租户访问；判定失败/未配置一律 403。
func (h *FileHandler) resolveTenant(w http.ResponseWriter, r *http.Request) (string, bool) {
	tenantID := chi.URLParam(r, "tenantID")
	if h.verifySignURL(r) {
		return tenantID, true
	}
	// 联盟公开前台文件：数据公开（enable_public/is_public）且文件被其引用时，
	// 任意访问者（含未登录访客）可访问，与公开接口的可见性语义保持一致
	if h.IsPublicAllianceFile != nil {
		if ok, err := h.IsPublicAllianceFile(r.Context(), tenantID, r.URL.Path); err == nil && ok {
			return tenantID, true
		}
	}
	claims := middleware.CurrentUser(r)
	if claims != nil {
		if claims.TenantID != nil && *claims.TenantID == tenantID {
			return tenantID, true
		}
		// 当前 claims 租户不匹配：尝试其它候选（另一平台的登录态）
		for _, c := range middleware.UserCandidates(r) {
			if c.TenantID != nil && *c.TenantID == tenantID {
				return tenantID, true
			}
		}
		// 跨租户联盟公开文件：请求方租户对该文件租户的企业公开可见
		if claims.TenantID != nil && h.CrossTenantAccess != nil {
			if ok, err := h.CrossTenantAccess(r.Context(), tenantID, *claims.TenantID); err == nil && ok {
				return tenantID, true
			}
		}
	}
	if claims == nil {
		respondError(w, http.StatusUnauthorized, "需要登录")
		return "", false
	}
	respondError(w, http.StatusForbidden, "无权访问该文件")
	return "", false
}

// SignURL 为 /uploads/{tenantID}/{filename} 生成短时签名 URL，供 kkFileView
// 等无登录态的第三方服务端抓取文件；仅限本租户文件。
func (h *FileHandler) SignURL(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil || claims.TenantID == nil || *claims.TenantID == "" {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	name := r.URL.Query().Get("name")
	segments := strings.Split(name, "/")
	if len(segments) != 4 || segments[0] != "" || segments[1] != "uploads" || segments[2] != *claims.TenantID || segments[3] == "" || filepath.Ext(segments[3]) == "" {
		respondError(w, http.StatusBadRequest, "无效文件路径")
		return
	}
	if !allowedServeExts[strings.ToLower(filepath.Ext(segments[3]))] {
		respondError(w, http.StatusForbidden, "文件类型不允许访问")
		return
	}
	path := filepath.Join(h.UploadDir, filepath.Clean(segments[2]), filepath.Clean(segments[3]))
	if _, err := os.Stat(path); err != nil {
		respondError(w, http.StatusNotFound, "文件不存在")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"url": h.signURL("/uploads/" + segments[2] + "/" + segments[3])})
}

func (h *FileHandler) Serve(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := h.resolveTenant(w, r)
	if !ok {
		return
	}
	name := chi.URLParam(r, "filename")
	if name == "" || strings.Contains(name, "..") || strings.Contains(name, "/") {
		respondError(w, http.StatusBadRequest, "无效文件名")
		return
	}
	if !allowedServeExts[strings.ToLower(filepath.Ext(name))] {
		respondError(w, http.StatusForbidden, "文件类型不允许直接访问")
		return
	}
	// 租户目录隔离：文件必须落在当前租户子目录内
	tenantDir := filepath.Join(h.UploadDir, filepath.Clean(tenantID))
	path := filepath.Join(tenantDir, filepath.Clean(name))
	if !strings.HasPrefix(path, filepath.Clean(tenantDir)) {
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
	claims := middleware.CurrentUser(r)
	if claims == nil || claims.TenantID == nil || *claims.TenantID == "" {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	name := r.URL.Query().Get("name")
	// name 形如 /uploads/{tenantID}/{filename}，必须属于当前租户
	segments := strings.Split(name, "/")
	if len(segments) != 4 || segments[0] != "" || segments[1] != "uploads" || segments[3] == "" {
		respondError(w, http.StatusBadRequest, "无效文件名")
		return
	}
	if segments[2] != *claims.TenantID {
		respondError(w, http.StatusForbidden, "无权访问该文件")
		return
	}
	filename := segments[3]
	if strings.Contains(filename, "..") {
		respondError(w, http.StatusBadRequest, "无效文件名")
		return
	}
	format := r.URL.Query().Get("format")
	if format == "" {
		format = "html"
	}

	path := filepath.Join(h.UploadDir, filepath.Clean(segments[2]), filepath.Clean(filename))
	if !strings.HasPrefix(path, filepath.Clean(filepath.Join(h.UploadDir, filepath.Clean(segments[2])))) {
		respondError(w, http.StatusForbidden, "无效文件路径")
		return
	}
	info, err := os.Stat(path)
	if err != nil || info.IsDir() {
		respondError(w, http.StatusNotFound, "文件不存在")
		return
	}

	ext := strings.ToLower(filepath.Ext(filename))
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

	base := strings.TrimSuffix(filename, ext)

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
