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
 * 课程（courses 表，工作台/收藏列表子集字段）。
 *
 * @author zhiyu
 */
@Data
@EqualsAndHashCode(callSuper = true)
@JsonInclude(JsonInclude.Include.NON_NULL)
@TableName("courses")
public class LessonCourse extends BaseZhiyuEntity {

    /** 课程编码 */
    private String code;

    /** 课程名称 */
    private String name;

    /** 类型（system/granular/hybrid） */
    private String type;

    /** 分类 */
    private String category;

    /** 专业 ID */
    private String majorId;

    /** 行业 ID */
    private String industryId;

    /** 描述 */
    private String description;

    /** 授课教师 ID */
    private String teacherId;

    /** 线上学时 */
    private BigDecimal onlineHours;

    /** 线下学时 */
    private BigDecimal offlineHours;

    /** 线上权重 */
    private BigDecimal onlineWeight;

    /** 线下权重 */
    private BigDecimal offlineWeight;

    /** 学期 */
    private String semester;

    /** 班级名称 */
    private String className;

    /** 状态（draft/pending/approved/rejected/published/archived） */
    private String status;

    /** 封面色 */
    private String coverColor;

    /** 封面图 */
    private String coverImage;

    /** 课程标签 */
    private String courseTag;

    /** 难度 */
    private Integer difficulty;

    /** 知识点 ID 数组 */
    @TableField(typeHandler = PgArrayTypeHandler.class)
    private List<String> knowledgePointIds;

    /** 能力点 ID 数组 */
    @TableField(typeHandler = PgArrayTypeHandler.class)
    private List<String> abilityPointIds;

    /** 资源 ID 数组 */
    @TableField(typeHandler = PgArrayTypeHandler.class)
    private List<String> resourceIds;

    /** 评估数据（jsonb 列，存 JSON 文本；lesson 域课程工作流用） */
    private String evalData;

    /** 版本号 */
    private String version;

    /** 创建人 */
    @TableField("creator_id")
    private String creatorId;

    /** 共建人 ID 数组 */
    @TableField(typeHandler = PgArrayTypeHandler.class)
    private List<String> coCreatorIds;

    /** 批次 ID */
    private String batchId;

    /** 节点数 */
    private Integer nodeCount;

    /** 资源数 */
    private Integer resourceCount;

    /** 学习人数 */
    private Integer studyCount;

    /** 租户 ID */
    private String tenantId;
}
