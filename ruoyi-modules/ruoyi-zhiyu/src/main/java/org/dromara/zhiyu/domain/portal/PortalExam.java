package org.dromara.zhiyu.domain.portal;

import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableName;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Data;
import lombok.EqualsAndHashCode;
import org.dromara.zhiyu.core.domain.BaseZhiyuEntity;
import org.dromara.zhiyu.core.mybatis.PgArrayTypeHandler;
import org.dromara.zhiyu.core.mybatis.PgUuidArrayTypeHandler;

import java.math.BigDecimal;
import java.util.List;

/**
 * 试卷（exams 表）。
 *
 * @author zhiyu
 */
@Data
@EqualsAndHashCode(callSuper = true)
@JsonInclude(JsonInclude.Include.NON_NULL)
@TableName("exams")
public class PortalExam extends BaseZhiyuEntity {

    /** 试卷编码 */
    private String code;

    /** 试卷名称 */
    private String name;

    /** 描述 */
    private String description;

    /** 状态 */
    private String status;

    /** 总分 */
    private BigDecimal totalScore;

    /** 时长（分钟） */
    private Integer duration;

    /** 封面图 */
    private String coverImage;

    /** 协作人 ID 数组 */
    @TableField(typeHandler = PgUuidArrayTypeHandler.class)
    private List<String> collaboratorIds;

    /** 协作部门 ID 数组 */
    @TableField(typeHandler = PgUuidArrayTypeHandler.class)
    private List<String> collaboratorDeptIds;

    /** 批次 ID */
    private String batchId;

    /** 版本 */
    private String version;

    /** 创建人 */
    @TableField("creator_id")
    private String creatorId;

    /** 归属类型（mine/collaborate/public） */
    private String ownerType;

    /** 租户 ID */
    private String tenantId;

    /** 是否临时卷 */
    private Boolean isTemp;
}
