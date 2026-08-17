package org.dromara.zhiyu.domain.alliance;

import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableName;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Data;
import lombok.EqualsAndHashCode;
import org.dromara.zhiyu.core.domain.BaseZhiyuEntity;

import java.time.LocalDate;

/**
 * 合作项目（alliance_projects 表，Go→Java 迁移）。
 *
 * @author zhiyu
 */
@Data
@EqualsAndHashCode(callSuper = true)
@JsonInclude(JsonInclude.Include.NON_NULL)
@TableName("alliance_projects")
public class AllianceProject extends BaseZhiyuEntity {

    private String tenantId;
    private String name;
    private String type;
    private String description;
    private String phase;
    private String publishStatus;
    private LocalDate startDate;
    private LocalDate endDate;
    private String budget;
    private String coverImage;
    /** jsonb 字符串数组（enterprise_ids），JSON 原文 */
    private String enterpriseIds;
    /** jsonb 字符串数组（agreement_ids），JSON 原文 */
    private String agreementIds;
    /** jsonb 字符串数组（secondary_colleges），JSON 原文 */
    private String secondaryColleges;
    private Boolean isPublic;
    private String createdBy;

    /** 里程碑完成率（公开接口返回，非本表列） */
    @TableField(exist = false)
    private Integer progress;
}
