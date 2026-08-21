package org.dromara.zhiyu.domain.job;

import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableName;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Data;
import lombok.EqualsAndHashCode;
import org.dromara.zhiyu.core.domain.BaseZhiyuEntity;
import org.dromara.zhiyu.core.mybatis.JsonStringArrayTypeHandler;
import org.dromara.zhiyu.core.mybatis.JsonStringArrayTypeHandler;

import java.util.List;

/**
 * 岗位（career_positions 表，Go→Java 迁移）。
 *
 * <p>majorIds/majorNames/createdByName/collaboratorNames/favoriteCount/viewCount/abilityCount
 * 为关联查询组装结果（非本表列），由 Service 单独组装，不在此声明。</p>
 *
 * @author zhiyu
 */
@Data
@EqualsAndHashCode(callSuper = true)
@JsonInclude(JsonInclude.Include.NON_NULL)
@TableName("career_positions")
public class JobCareerPosition extends BaseZhiyuEntity {

    /** 租户 ID */
    private String tenantId;

    /** 批次 ID */
    private String batchId;

    /** 岗位编码（租户内唯一，GW-XXXX 格式） */
    private String code;

    /** 岗位名称 */
    private String name;

    /** 岗位简称 */
    private String shortName;

    /** 行业 ID */
    private String industryId;

    /** 岗位类型（enterprise=企业岗位 / teaching=教学岗位） */
    private String positionType;

    /** 最低薪资 */
    private Integer salaryMin;

    /** 最高薪资 */
    private Integer salaryMax;

    /** 封面图 */
    private String coverImage;

    /** 岗位描述 */
    private String description;

    /** 任职要求（JSON 数组列，原 PG text[]） */
    @TableField(typeHandler = JsonStringArrayTypeHandler.class)
    private List<String> requirements;

    /** 职业发展路径 */
    private String careerPath;

    /** 版本号（如 V1.0，发布时自动 +0.1） */
    private String version;

    /** 状态（draft/pending/approved/rejected/published/archived） */
    private String status;

    /** 创建人 ID */
    private String createdBy;

    /** 协作者 ID 数组（JSON 数组列，原 PG uuid[]） */
    @TableField(typeHandler = JsonStringArrayTypeHandler.class)
    private List<String> collaborators;

    /** 浏览量（表列冗余计数） */
    private Integer viewCount;

    /** 来源类型（school=学校自建默认，enterprise=企业共建写入） */
    private String sourceType;

    /** 来源企业 ID（sourceType=enterprise 时） */
    private String sourceEnterpriseId;

    /** 来源资源 ID（企业共建基于某源资源编辑时） */
    private String sourceResourceId;
}
