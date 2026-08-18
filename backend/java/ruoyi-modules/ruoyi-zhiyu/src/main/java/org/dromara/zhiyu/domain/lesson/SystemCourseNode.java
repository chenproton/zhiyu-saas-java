package org.dromara.zhiyu.domain.lesson;

import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableName;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Data;
import lombok.EqualsAndHashCode;
import org.dromara.zhiyu.core.domain.BaseZhiyuEntity;
import org.dromara.zhiyu.core.mybatis.PgArrayTypeHandler;

import java.math.BigDecimal;
import java.util.List;

/**
 * 体系课节点（system_course_nodes 表，Go→Java 迁移）。
 *
 * @author zhiyu
 */
@Data
@EqualsAndHashCode(callSuper = true)
@JsonInclude(JsonInclude.Include.NON_NULL)
@TableName("system_course_nodes")
public class SystemCourseNode extends BaseZhiyuEntity {

    /** 课程 ID */
    private String courseId;

    /** 父节点 ID */
    private String parentId;

    /** 节点名称 */
    private String name;

    /** 节点编码 */
    private String code;

    /** 排序 */
    private Integer sortOrder;

    /** 引用类型（normal/original） */
    private String refType;

    /** 来源 ID */
    private String sourceId;

    /** 来源名称 */
    private String sourceName;

    /** 教学目标 */
    private String teachingGoals;

    /** 详细描述 */
    private String detailedDescription;

    /** 描述 PDF */
    private String descriptionPdf;

    /** 背景 */
    private String background;

    /** 预计学时 */
    private BigDecimal estimatedHours;

    /** 时长 */
    private Integer duration;

    /** 难度 */
    private Integer difficulty;

    /** 知识点 ID 数组 */
    @TableField(typeHandler = PgArrayTypeHandler.class)
    private List<String> knowledgePointIds;

    /** 资源 ID 数组 */
    @TableField(typeHandler = PgArrayTypeHandler.class)
    private List<String> resourceIds;

    /** 能力点 ID 数组 */
    @TableField(typeHandler = PgArrayTypeHandler.class)
    private List<String> abilityPointIds;

    /** 评估数据（jsonb 列，存 JSON 文本） */
    private String evalData;

    /** 状态 */
    private String status;

    /** 租户 ID */
    private String tenantId;
}
