package org.dromara.zhiyu.domain.favorites;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Data;

import java.time.OffsetDateTime;

/**
 * 用户收藏（user_favorites 表，仅 created_at 列，故不继承 BaseZhiyuEntity）。
 * 通用收藏：场景/课程/题库/试卷/AI 知识库/AI 智能体。
 *
 * @author zhiyu
 */
@Data
@JsonInclude(JsonInclude.Include.NON_NULL)
@TableName("user_favorites")
public class ZhiyuUserFavorite {

    /** 主键 */
    @TableId(value = "id", type = IdType.ASSIGN_UUID)
    private String id;

    /** 用户 ID */
    private String userId;

    /** 收藏目标类型（scene/course/question_bank/exam/ai_kb/ai_agent） */
    private String targetType;

    /** 收藏目标 ID */
    private String targetId;

    /** 创建时间 */
    @TableField("created_at")
    private OffsetDateTime createdAt;
}
