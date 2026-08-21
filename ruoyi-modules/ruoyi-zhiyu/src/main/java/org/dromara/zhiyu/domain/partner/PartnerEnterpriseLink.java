package org.dromara.zhiyu.domain.partner;

import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableName;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Data;
import lombok.EqualsAndHashCode;
import org.dromara.zhiyu.core.domain.BaseZhiyuEntity;
import org.dromara.zhiyu.core.mybatis.JsonStringListTypeHandler;

import java.util.List;

/**
 * 企业与学校合作关联（alliance_enterprise_links 表，Go→Java 迁移）。
 *
 * @author zhiyu
 */
@Data
@EqualsAndHashCode(callSuper = true)
@JsonInclude(JsonInclude.Include.NON_NULL)
@TableName("alliance_enterprise_links")
public class PartnerEnterpriseLink extends BaseZhiyuEntity {

    /** 学校租户 ID */
    private String tenantId;

    /** 企业主体 ID */
    private String enterpriseId;

    /** 关系类型 */
    private String relationType;

    /** 状态（negotiating/active/paused/terminated） */
    private String status;

    /** 评级 */
    private String rating;

    /** 企业类型 */
    private String enterpriseType;

    /** 是否公开 */
    private Boolean isPublic;

    /** 二级学院（jsonb） */
    @TableField(typeHandler = JsonStringListTypeHandler.class)
    private List<String> secondaryColleges;

    /** 创建人 ID */
    private String createdBy;
}
