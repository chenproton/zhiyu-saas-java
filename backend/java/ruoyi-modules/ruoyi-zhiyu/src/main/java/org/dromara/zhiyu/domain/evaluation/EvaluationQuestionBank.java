package org.dromara.zhiyu.domain.evaluation;

import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableName;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Data;
import lombok.EqualsAndHashCode;
import org.dromara.zhiyu.core.domain.BaseZhiyuEntity;
import org.dromara.zhiyu.core.mybatis.PgArrayTypeHandler;

import java.util.List;

/**
 * 题库（question_banks 表，评价域完整实体）。
 *
 * <p>creatorName/collaboratorNames/knowledgePointIds/questionCount 为关联组装结果，
 * 由 Service 组装到 DTO，不在此声明。</p>
 *
 * @author zhiyu
 */
@Data
@EqualsAndHashCode(callSuper = true)
@JsonInclude(JsonInclude.Include.NON_NULL)
@TableName("question_banks")
public class EvaluationQuestionBank extends BaseZhiyuEntity {

    /** 编码（TK-XXXXXXXX，租户内唯一） */
    private String code;

    /** 名称（租户内唯一） */
    private String name;

    /** 描述 */
    private String description;

    /** 封面图 */
    private String coverImage;

    /** 状态（draft/pending/approved/rejected/published/archived） */
    private String status;

    /** 题目数（冗余计数列） */
    private Integer questionCount;

    /** 创建人 */
    private String creatorId;

    /** 协作者 ID 数组 */
    @TableField(typeHandler = PgArrayTypeHandler.class)
    private List<String> collaboratorIds;

    /** 协作部门 ID 数组 */
    @TableField(typeHandler = PgArrayTypeHandler.class)
    private List<String> collaboratorDeptIds;

    /** 批次 ID */
    private String batchId;

    /** 版本（V1.0 起） */
    private String version;

    /** 归属类型（mine/collaborate/public） */
    private String ownerType;

    /** 是否草稿池 */
    private Boolean isDraftPool;

    /** 租户 ID */
    private String tenantId;
}
