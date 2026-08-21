package org.dromara.zhiyu.domain.scene;

import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableName;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Data;
import lombok.EqualsAndHashCode;
import org.dromara.zhiyu.core.domain.BaseZhiyuEntity;
import org.dromara.zhiyu.core.mybatis.PgArrayTypeHandler;
import org.dromara.zhiyu.core.mybatis.PgUuidArrayTypeHandler;

import java.time.OffsetDateTime;
import java.util.List;

/**
 * 实践场景（scenarios 表，Go→Java 迁移）。
 *
 * <p>列表/详情中的 industryNames/professionNames/creatorName/viewCount/taskCount
 * 为关联查询结果列（非本表列），由 Service 单独组装，不在此声明。</p>
 *
 * @author zhiyu
 */
@Data
@EqualsAndHashCode(callSuper = true)
@JsonInclude(JsonInclude.Include.NON_NULL)
@TableName("scenarios")
public class SceneScenario extends BaseZhiyuEntity {

    /** 场景名称 */
    private String name;

    /** 场景编码（租户内唯一） */
    private String code;

    /** 封面图 */
    private String coverImage;

    /** 关联岗位 ID */
    private String careerPositionId;

    /** 关联行业 ID 数组（varchar[]） */
    @TableField(typeHandler = PgUuidArrayTypeHandler.class)
    private List<String> industryIds;

    /** 关联专业 ID 数组（uuid[]） */
    @TableField(typeHandler = PgUuidArrayTypeHandler.class)
    private List<String> professionIds;

    /** 批次 ID */
    private String batchId;

    /** 难度（1-5） */
    private Integer difficulty;

    /** 版本号（如 V1.0，发布时自动 +0.1） */
    private String version;

    /** 状态（draft/pending/approved/rejected/published/archived） */
    private String status;

    /** 场景背景 */
    private String background;

    /** 交付目标 */
    private String deliveryGoal;

    /** 创建人 ID */
    private String creatorId;

    /** 共建人 ID 数组（uuid[]） */
    @TableField(typeHandler = PgUuidArrayTypeHandler.class)
    private List<String> coBuilderIds;

    /** 租户 ID */
    private String tenantId;

    /** 发布时间 */
    private OffsetDateTime publishTime;

    /** 来源类型（school=学校自建默认，enterprise=企业共建写入） */
    private String sourceType;

    /** 来源企业 ID（sourceType=enterprise 时） */
    private String sourceEnterpriseId;

    /** 来源资源 ID（企业共建基于某源资源编辑时） */
    private String sourceResourceId;
}
