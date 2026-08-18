package org.dromara.zhiyu.service.impl.files;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.dromara.zhiyu.core.security.TenantContext;
import org.dromara.zhiyu.core.web.ApiException;
import org.dromara.zhiyu.domain.dto.files.FileDtos.SignUrlResponse;
import org.dromara.zhiyu.domain.dto.files.FileDtos.UploadResponse;
import org.dromara.zhiyu.service.files.IFileService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.Set;
import java.util.UUID;

/**
 * zhiyu 文件通道服务实现（对齐 Go file_handler.go：本地目录 + 租户隔离 + HMAC 签名）。
 *
 * <p>安全红线落实：</p>
 * <ul>
 *   <li>上传扩展名白名单 + 单文件大小限制（照搬 Go 端规则）；</li>
 *   <li>预览仅限本租户，带有效签名才允许跨租户读取；</li>
 *   <li>文件名路径穿越防护（禁止 .. / 反斜杠），且解析路径强制落在租户子目录内；</li>
 *   <li>html/svg/xml 等可执行类型输出时附加 CSP sandbox + nosniff 防存储型 XSS。</li>
 * </ul>
 *
 * @author zhiyu
 */
@Slf4j
@RequiredArgsConstructor
@Service
public class FileServiceImpl implements IFileService {

    /** 上传目录（环境变量 ZHIYU_UPLOAD_DIR 可配，默认仓库 data/uploads） */
    @Value("${ZHIYU_UPLOAD_DIR:/root/projects/saas-framework6-java-vue/data/uploads}")
    private String uploadDir;

    /** 签名密钥（对齐 Go JWTSecret；默认取 Sa-Token jwt-secret-key） */
    @Value("${sa-token.jwt-secret-key:zhiyu-file-sign-secret}")
    private String signSecret;

    /** 单文件上限 10MB（对齐 Go MaxUploadSize） */
    private static final long MAX_UPLOAD_SIZE = 10L * 1024 * 1024;

    /** 签名 URL 有效期 15 分钟（对齐 Go signURLTTL） */
    private static final long SIGN_TTL_SECONDS = 15 * 60;

    /** 浏览器可直接执行/渲染的类型：输出时附加 CSP sandbox */
    private static final Set<String> XSS_RISKY_EXTS = Set.of(".html", ".htm", ".svg", ".xml", ".xbrl");

    /** 上传扩展名白名单（照搬 Go allowedServeExts，与 kkFileView 支持格式对齐） */
    private static final Set<String> ALLOWED_EXTS = Set.of(
        // 图片
        ".png", ".jpg", ".jpeg", ".gif", ".bmp", ".webp", ".avif", ".ico", ".jfif",
        // PDF / OFD / TIFF / SVG
        ".pdf", ".ofd", ".tif", ".tiff", ".svg",
        // SIMTEXT/XML
        ".html", ".htm", ".xml", ".xbrl",
        // Office（Word）
        ".doc", ".docx", ".docm", ".dot", ".dotx", ".dotm", ".wps", ".wpt",
        // Office（Excel）
        ".xls", ".xlsx", ".xlsm", ".xlt", ".xltx", ".xltm", ".xlam", ".xla", ".et", ".ett", ".ods", ".ots",
        ".csv", ".tsv",
        // Office（PPT / 其它）
        ".ppt", ".pptx", ".dps", ".odp", ".otp", ".sxi", ".rtf", ".odt", ".ott", ".vsd", ".vsdx",
        ".fodt", ".fods", ".pages", ".wmf", ".emf", ".tga", ".psd", ".eps",
        // 压缩
        ".zip", ".rar", ".7z", ".jar", ".tar", ".gzip",
        // CAD
        ".dwg", ".dxf", ".dwf", ".dwfx", ".dwt", ".dng", ".cf2", ".plt",
        // 3D
        ".stl", ".obj", ".3ds", ".ply", ".off", ".3dm", ".fbx", ".dae", ".wrl", ".3mf", ".glb", ".gltf",
        ".o3dv", ".stp", ".step", ".iges", ".igs", ".brep", ".bim", ".fcstd", ".ifc",
        // 媒体
        ".mp3", ".wav", ".m4a", ".mp4", ".webm", ".flv", ".mpeg", ".mpd", ".m3u8", ".ts",
        ".avi", ".mov", ".wmv", ".mkv", ".3gp", ".rm",
        // 文本 / 代码
        ".txt", ".md", ".log", ".json", ".properties", ".yaml", ".yml", ".gitignore",
        ".java", ".py", ".c", ".cpp", ".h", ".php", ".go", ".js", ".css", ".lua", ".sh", ".rb",
        ".sql", ".bat", ".m", ".bas", ".prg", ".cmd", ".cs", ".ftl", ".asp", ".jsp", ".aspx",
        // 其它
        ".eml", ".xmind", ".epub", ".dcm", ".drawio", ".bpmn"
    );

    @Override
    public UploadResponse upload(MultipartFile file) {
        String tenantId = TenantContext.getTenantId();
        if (tenantId == null || tenantId.isBlank()) {
            throw new ApiException(403, "forbidden", "权限不足");
        }
        if (file == null || file.isEmpty()) {
            throw new ApiException(400, "bad_request", "缺少文件字段");
        }
        if (file.getSize() > MAX_UPLOAD_SIZE) {
            throw new ApiException(400, "bad_request", "文件过大或表单无效");
        }

        String original = file.getOriginalFilename();
        String ext = extensionOf(original);
        if (!ALLOWED_EXTS.contains(ext)) {
            throw new ApiException(400, "bad_request", "不支持的文件类型");
        }

        String filename = UUID.randomUUID() + ext;
        Path dir = Paths.get(uploadDir, tenantId).normalize();
        try {
            Files.createDirectories(dir);
            Path dest = dir.resolve(filename).normalize();
            file.transferTo(dest);

            UploadResponse resp = new UploadResponse();
            resp.setUrl("/uploads/" + tenantId + "/" + filename);
            resp.setName(original);
            resp.setSize(file.getSize());
            resp.setMimeType(file.getContentType());
            return resp;
        } catch (IOException e) {
            log.error("文件保存失败 tenantId={} filename={} err={}", tenantId, filename, e.getMessage());
            throw new ApiException(500, "internal_error", "保存文件失败");
        }
    }

    @Override
    public SignUrlResponse signUrl(String name) {
        String[] seg = parseName(name);
        String tenantId = seg[0];
        String filename = seg[1];
        validateTenant(tenantId);
        validateFilename(filename);
        validateExt(filename);

        String cur = TenantContext.getTenantId();
        if (cur == null || !cur.equals(tenantId)) {
            throw new ApiException(403, "forbidden", "无权访问该文件");
        }
        Path path = Paths.get(uploadDir, tenantId, filename).normalize();
        if (!Files.exists(path) || Files.isDirectory(path)) {
            throw new ApiException(404, "not_found", "文件不存在");
        }

        long exp = System.currentTimeMillis() / 1000 + SIGN_TTL_SECONDS;
        String sig = hmac(name + "|" + exp);
        SignUrlResponse resp = new SignUrlResponse();
        resp.setUrl(name + "?exp=" + exp + "&sig=" + sig);
        return resp;
    }

    @Override
    public ResolvedFile resolvePreview(String name, String exp, String sig) {
        String[] seg = parseName(name);
        String tenantId = seg[0];
        String filename = seg[1];
        validateTenant(tenantId);
        validateFilename(filename);
        validateExt(filename);

        Path dir = Paths.get(uploadDir, tenantId).normalize();
        Path path = dir.resolve(filename).normalize();
        // 纵深防御：文件必须落在租户子目录内
        if (!path.startsWith(dir)) {
            throw new ApiException(403, "forbidden", "无效文件路径");
        }

        boolean signed = verifySig(name, exp, sig);
        if (!signed) {
            String cur = TenantContext.getTenantId();
            if (cur == null || !cur.equals(tenantId)) {
                throw new ApiException(403, "forbidden", "无权访问该文件");
            }
        }
        if (!Files.exists(path) || Files.isDirectory(path)) {
            throw new ApiException(404, "not_found", "文件不存在");
        }
        return new ResolvedFile(path, filename, contentTypeOf(filename), XSS_RISKY_EXTS.contains(extensionOf(filename)));
    }

    // ===== 工具 =====

    /** 解析 /uploads/{tenantId}/{filename} 路径段。 */
    private String[] parseName(String name) {
        if (name == null || name.isBlank()) {
            throw new ApiException(400, "bad_request", "无效文件名");
        }
        String[] segments = name.split("/");
        if (segments.length != 4 || !segments[0].isEmpty() || !"uploads".equals(segments[1])
            || segments[2].isEmpty() || segments[3].isEmpty()) {
            throw new ApiException(400, "bad_request", "无效文件路径");
        }
        return new String[]{segments[2], segments[3]};
    }

    /** 租户 ID 必须为 UUID，防止异常租户串逃逸上传目录。 */
    private void validateTenant(String tenantId) {
        try {
            UUID.fromString(tenantId);
        } catch (IllegalArgumentException e) {
            throw new ApiException(400, "bad_request", "无效文件路径");
        }
    }

    /** 文件名路径穿越防护。 */
    private void validateFilename(String filename) {
        if (filename.contains("..") || filename.contains("/") || filename.contains("\\")) {
            throw new ApiException(400, "bad_request", "无效文件名");
        }
    }

    private void validateExt(String filename) {
        if (!ALLOWED_EXTS.contains(extensionOf(filename))) {
            throw new ApiException(403, "forbidden", "文件类型不允许访问");
        }
    }

    private String extensionOf(String filename) {
        if (filename == null || filename.isBlank()) {
            return ".bin";
        }
        int idx = filename.lastIndexOf('.');
        if (idx < 0 || idx == filename.length() - 1) {
            return ".bin";
        }
        return filename.substring(idx).toLowerCase();
    }

    private String contentTypeOf(String filename) {
        return switch (extensionOf(filename)) {
            case ".png" -> "image/png";
            case ".jpg", ".jpeg" -> "image/jpeg";
            case ".gif" -> "image/gif";
            case ".webp" -> "image/webp";
            case ".svg" -> "image/svg+xml";
            case ".ico" -> "image/x-icon";
            case ".bmp" -> "image/bmp";
            case ".pdf" -> "application/pdf";
            case ".txt", ".md", ".log" -> "text/plain;charset=UTF-8";
            case ".html", ".htm" -> "text/html;charset=UTF-8";
            case ".json" -> "application/json";
            case ".xml", ".xbrl" -> "application/xml";
            case ".mp3" -> "audio/mpeg";
            case ".mp4" -> "video/mp4";
            case ".webm" -> "video/webm";
            case ".csv", ".tsv" -> "text/csv;charset=UTF-8";
            default -> "application/octet-stream";
        };
    }

    /** HMAC-SHA256（对齐 Go hmac.New(sha256.New, secret)）。 */
    private String hmac(String data) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(signSecret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            return HexFormat.of().formatHex(mac.doFinal(data.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) {
            throw new ApiException(500, "internal_error", "签名失败");
        }
    }

    private boolean verifySig(String name, String exp, String sig) {
        if (exp == null || sig == null || exp.isBlank() || sig.isBlank()) {
            return false;
        }
        long expUnix;
        try {
            expUnix = Long.parseLong(exp);
        } catch (NumberFormatException e) {
            return false;
        }
        if (System.currentTimeMillis() / 1000 >= expUnix) {
            return false;
        }
        String expected = hmac(name + "|" + exp);
        return MessageDigest.isEqual(
            expected.getBytes(StandardCharsets.UTF_8),
            sig.getBytes(StandardCharsets.UTF_8));
    }
}
