package org.dromara.zhiyu.service.files;

import org.dromara.zhiyu.domain.dto.files.FileDtos.SignUrlResponse;
import org.dromara.zhiyu.domain.dto.files.FileDtos.UploadResponse;
import org.springframework.web.multipart.MultipartFile;

import java.nio.file.Path;

/**
 * zhiyu 文件通道服务（对齐 Go file_handler.go：本地目录上传/预览/签名 URL）。
 *
 * @author zhiyu
 */
public interface IFileService {

    /**
     * 上传文件到当前租户目录，返回相对访问路径与文件信息。
     *
     * @param file multipart 文件
     * @return 上传响应
     */
    UploadResponse upload(MultipartFile file);

    /**
     * 为当前租户文件生成短时签名 URL（供 kkFileView 等无登录态抓取）。
     *
     * @param name 形如 /uploads/{tenantId}/{filename} 的文件路径
     * @return 签名 URL 响应
     */
    SignUrlResponse signUrl(String name);

    /**
     * 解析预览请求，返回待输出文件（含内容类型与 XSS 沙箱标记）。
     *
     * <p>带有效签名时允许跨租户读取；否则仅允许本租户文件。</p>
     *
     * @param name 形如 /uploads/{tenantId}/{filename} 的文件路径
     * @param exp  签名过期时间（秒级时间戳，可空）
     * @param sig  HMAC 签名（可空）
     * @return 解析结果
     */
    ResolvedFile resolvePreview(String name, String exp, String sig);

    /**
     * 预览解析结果。
     *
     * @param path        文件绝对路径
     * @param filename    原始文件名
     * @param contentType 响应 Content-Type
     * @param sandbox     是否为 XSS 风险类型（html/svg/xml 等，需 CSP sandbox）
     */
    record ResolvedFile(Path path, String filename, String contentType, boolean sandbox) {
    }
}
