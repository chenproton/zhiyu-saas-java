package org.dromara.zhiyu.domain.evaluation;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Data;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

/**
 * 学生能力画像（student_ability_portraits 表；无 created_at 列，不继承 BaseZhiyuEntity）。
 *
 * @author zhiyu
 */
@Data
@JsonInclude(JsonInclude.Include.NON_NULL)
@TableName("student_ability_portraits")
public class EvaluationStudentPortrait {

    /** 主键 */
    @TableId(value = "id", type = IdType.ASSIGN_UUID)
    private String id;

    /** 学生用户 ID */
    private String userId;

    /** 岗位 ID */
    private String careerPositionId;

    /** 总评等级 */
    private String overallGrade;

    /** 能力域得分（jsonb 数组 JSON 文本） */
    private String domainScores;

    /** 班级排名 */
    private Integer classRank;

    /** 班级人数 */
    private Integer classTotal;

    /** 专业排名 */
    private Integer majorRank;

    /** 专业人数 */
    private Integer majorTotal;

    /** 已完成课程数 */
    private Integer completedCourses;

    /** 已完成场景数 */
    private Integer completedScenes;

    /** 总学分 */
    private BigDecimal totalCredits;

    /** 课程记录（jsonb 数组 JSON 文本） */
    private String courseRecords;

    /** 是否满足毕业条件 */
    private Boolean graduationQualified;

    /** 出勤率（%） */
    private BigDecimal attendanceRate;

    /** 毕业徽章 */
    private String diplomaBadge;

    /** 双证徽章 */
    private String dualBadge;

    /** 档案数 */
    private Integer archiveCount;

    /** 推荐岗位（jsonb 数组 JSON 文本） */
    private String recommendPositions;

    /** 更新时间 */
    private OffsetDateTime updatedAt;

    /** 租户 ID */
    private String tenantId;

    /** 专业 ID */
    private String majorId;
}
