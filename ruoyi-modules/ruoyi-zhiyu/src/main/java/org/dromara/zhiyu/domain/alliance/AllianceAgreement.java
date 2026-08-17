package org.dromara.zhiyu.domain.alliance;

import com.baomidou.mybatisplus.annotation.TableName;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Data;
import lombok.EqualsAndHashCode;
import org.dromara.zhiyu.core.domain.BaseZhiyuEntity;

import java.time.LocalDate;

/**
 * 合作协议（alliance_agreements 表，Go→Java 迁移）。
 *
 * @author zhiyu
 */
@Data
@EqualsAndHashCode(callSuper = true)
@JsonInclude(JsonInclude.Include.NON_NULL)
@TableName("alliance_agreements")
public class AllianceAgreement extends BaseZhiyuEntity {

    private String tenantId;
    private String name;
    private String type;
    private String content;
    private LocalDate startDate;
    private LocalDate endDate;
    private String status;
    /** jsonb 字符串数组（enterprise_ids） */
    private String enterpriseIds;
    /** jsonb 字符串数组（project_ids） */
    private String projectIds;
    /** jsonb 字符串数组（attachments） */
    private String attachments;
    private Boolean isPublic;
    private String createdBy;
}
