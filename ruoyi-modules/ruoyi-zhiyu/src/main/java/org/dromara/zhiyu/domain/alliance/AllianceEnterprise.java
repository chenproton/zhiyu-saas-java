package org.dromara.zhiyu.domain.alliance;

import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableName;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Data;
import lombok.EqualsAndHashCode;
import org.dromara.zhiyu.core.domain.BaseZhiyuEntity;

/**
 * 企业主体（partner_enterprises 表，全局唯一，tenant_id = 企业租户）。
 *
 * <p>jsonb 数组列以 JSON 原文承载，Service 层负责与 DTO 互转。</p>
 *
 * @author zhiyu
 */
@Data
@EqualsAndHashCode(callSuper = true)
@JsonInclude(JsonInclude.Include.NON_NULL)
@TableName("partner_enterprises")
public class AllianceEnterprise extends BaseZhiyuEntity {

    private String tenantId;
    private String name;
    private String industry;
    private String region;
    private String description;
    private String logoUrl;
    private String coverImage;
    /** jsonb 字符串数组（cooperation_types），JSON 原文 */
    private String cooperationTypes;
    private String contactPerson;
    private String contactPhone;
    private String contactEmail;
    private String address;
    private String unifiedSocialCreditCode;
    private Integer establishedYear;
    private Integer employeeCount;
    private String businessLicensePhotos;
    private String qualificationPhotos;
    private String intellectualPropertyPhotos;
    private String coverPhotos;
    private Boolean enablePublic;

    /** 学校侧评级（link.rating，仅合并视图填充，非本表列） */
    @TableField(exist = false)
    private String rating;
    /** 门户公开列表返回：合作项目数（非本表列） */
    @TableField(exist = false)
    private Integer projectCount;
    /** 门户公开列表返回：合作协议数（非本表列） */
    @TableField(exist = false)
    private Integer agreementCount;
    /** 门户公开列表返回：合作成果数（非本表列） */
    @TableField(exist = false)
    private Integer achievementCount;
}
