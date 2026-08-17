package org.dromara.zhiyu.domain.dto.portal;

import com.fasterxml.jackson.annotation.JsonInclude;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;

/**
 * 学生荣誉 DTO（对齐 Go student_honor_handler.go 与 shared-types portal.ts StudentHonor）。
 *
 * @author zhiyu
 */
public class HonorDtos {

    /** 荣誉响应项（StudentHonorItem） */
    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class HonorItem {
        private String id;
        private String name;
        private String issuer;
        private String honorDate;
        private String fileName;
        private String fileUrl;
    }

    /** 荣誉创建/更新请求（StudentHonorPayload） */
    @Data
    public static class HonorUpsertRequest {
        @NotBlank(message = "荣誉名称不能为空")
        private String name;
        private String issuer;
        private String honorDate;
        private String fileName;
        private String fileUrl;
    }
}
