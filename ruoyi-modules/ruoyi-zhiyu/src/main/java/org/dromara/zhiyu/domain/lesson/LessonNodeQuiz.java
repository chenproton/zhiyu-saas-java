package org.dromara.zhiyu.domain.lesson;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Data;

/**
 * 节点测验（node_quizzes 表，Go→Java 迁移）。
 *
 * <p>表无 created_at/updated_at 列，故不继承 BaseZhiyuEntity。</p>
 *
 * @author zhiyu
 */
@Data
@JsonInclude(JsonInclude.Include.NON_NULL)
@TableName("node_quizzes")
public class LessonNodeQuiz {

    /** 主键（UUID） */
    @TableId(value = "id", type = IdType.ASSIGN_UUID)
    private String id;

    /** 课程节点 ID */
    private String nodeId;

    /** 测验标题 */
    private String title;

    /** 测验类型 */
    private String type;

    /** 限时（秒，可空） */
    private Integer timeLimit;

    /** 租户 ID */
    private String tenantId;
}
