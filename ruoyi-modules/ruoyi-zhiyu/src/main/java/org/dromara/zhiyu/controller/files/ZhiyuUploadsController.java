package org.dromara.zhiyu.controller.files;

import cn.dev33.satoken.stp.StpUtil;
import cn.hutool.core.util.StrUtil;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.dromara.zhiyu.core.security.TenantContext;
import org.dromara.zhiyu.core.web.ApiException;
import org.dromara.zhiyu.service.files.IFileService;
import org.dromara.zhiyu.service.files.IFileService.ResolvedFile;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;

/**
 * 上传文件静态直出端点（对齐 Go FileHandler.Serve + OptionalJWT 混合鉴权）。
 *
 * <p>供 {@code <img>}、kkFileView 等无法携带 Authorization 头的场景直出文件：
 * 有效 HMAC 签名（exp+sig）或登录用户同租户（Bearer token）均可放行；
 * 无凭据返回 401、跨租户无签名返回 403。</p>
 *
 * @author zhiyu
 */
@RequiredArgsConstructor
@RestController
public class ZhiyuUploadsController {

    private final IFileService fileService;

    /**
     * 直出上传文件（/uploads/{tenantId}/{filename}）。
     *
     * <p>有效 HMAC 签名、同租户登录态、联盟公开文件（Go IsPublicAllianceFile，仅限
     * 公开展示引用的文件）三种方式均可放行；无凭据返回 401、跨租户无签名返回 403。</p>
     */
    @GetMapping("/uploads/{tenantId}/{filename}")
    public void serve(@PathVariable String tenantId,
                      @PathVariable String filename,
                      @RequestParam(value = "exp", required = false) String exp,
                      @RequestParam(value = "sig", required = false) String sig,
                      HttpServletRequest request,
                      HttpServletResponse response) throws IOException {
        // 可选登录态：解析 Bearer token 写入上下文（无 token 时仅签名可放行）
        String token = extractBearer(request);
        if (StrUtil.isNotBlank(token)) {
            try {
                Object loginId = StpUtil.getLoginIdByToken(token);
                if (loginId != null) {
                    Object t = StpUtil.getSessionByLoginId(loginId).get("tenantId");
                    Object u = StpUtil.getSessionByLoginId(loginId).get("userId");
                    TenantContext.set(
                        u == null ? loginId.toString() : u.toString(),
                        t == null ? null : t.toString(),
                        null, null);
                }
            } catch (Exception ignored) {
                // token 无效按未登录处理
            }
        }
        try {
            ResolvedFile f = fileService.resolvePreview("/uploads/" + tenantId + "/" + filename, exp, sig);
            response.setContentType(f.contentType());
            response.setHeader("X-Content-Type-Options", "nosniff");
            if (f.sandbox()) {
                response.setHeader("Content-Security-Policy", "sandbox");
            }
            try (InputStream in = Files.newInputStream(f.path())) {
                in.transferTo(response.getOutputStream());
            }
        } catch (ApiException e) {
            if (e.getStatus() == 403 && StrUtil.isBlank(token) && StrUtil.isBlank(sig)) {
                throw new ApiException(401, "unauthorized", "未登录或登录已过期");
            }
            throw e;
        } finally {
            TenantContext.clear();
        }
    }

    private String extractBearer(HttpServletRequest request) {
        String auth = request.getHeader("Authorization");
        if (StrUtil.isBlank(auth)) {
            return null;
        }
        if (auth.startsWith("Bearer ")) {
            return auth.substring(7).trim();
        }
        return auth.trim();
    }
}
