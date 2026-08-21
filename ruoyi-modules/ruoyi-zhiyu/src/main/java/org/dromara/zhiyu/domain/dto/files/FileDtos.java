package org.dromara.zhiyu.domain.dto.files;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Data;

/**
 * 文件通道相关 DTO（对齐 Go file_handler.go 的响应结构）。
 *
 * @author zhiyu
 */
public class FileDtos {

    /** 上传响应（Go UploadResponse） */
    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class UploadResponse {
        private String url;
        private String name;
        private Long size;
        private String mimeType;
    }

    /** 签名 URL 响应（Go map[string]string{"url": ...}） */
    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class SignUrlResponse {
        private String url;
    }
}
