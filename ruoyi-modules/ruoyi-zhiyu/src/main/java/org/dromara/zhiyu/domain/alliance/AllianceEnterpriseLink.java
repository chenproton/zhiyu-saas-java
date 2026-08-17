package org.dromara.zhiyu.domain.alliance;

import com.baomidou.mybatisplus.annotation.TableName;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Data;
import lombok.EqualsAndHashCode;
import org.dromara.zhiyu.core.domain.BaseZhiyuEntity;

/**
 * 学校-企业合作关联（alliance_enterprise_links 表，tenant_id = 学校租户）。
 *
 * @author zhiyu
 */
@Data
@EqualsAndHashCode(callSuper = true)
@JsonInclude(JsonInclude.Include.NON_NULL)
@TableName("alliance_enterprise_links")
public class AllianceEnterpriseLink extends BaseZhiyuEntity {

    private String tenantId;
    private String enterpriseId;
    private String relationType;
    private String status;
    private String rating;
    private String enterpriseType;
    private Boolean isPublic;
    /** jsonb 字符串数组（secondary_colleges），JSON 原文 */
    private String secondaryColleges;
    private String createdBy;
}
