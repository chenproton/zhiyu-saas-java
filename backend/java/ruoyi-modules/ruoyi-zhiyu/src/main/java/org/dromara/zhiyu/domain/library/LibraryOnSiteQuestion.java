package org.dromara.zhiyu.domain.library;

import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableName;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Data;
import lombok.EqualsAndHashCode;
import org.dromara.zhiyu.core.domain.BaseZhiyuEntity;
import org.dromara.zhiyu.core.mybatis.PgArrayTypeHandler;
import org.dromara.zhiyu.core.mybatis.PgUuidArrayTypeHandler;

import java.util.List;

/**
 * 现场题库题目（on_site_question_library 表）。
 *
 * <p>knowledge_point_ids 为 uuid[]、tags 为 text[]，均经 {@link PgArrayTypeHandler}
 * 与 List&lt;String&gt; 互转（读写一致，对齐 Go 版 JSONSliceToStrings 语义）。</p>
 *
 * @author zhiyu
 */
@Data
@EqualsAndHashCode(callSuper = true)
@JsonInclude(JsonInclude.Include.NON_NULL)
@TableName("on_site_question_library")
public class LibraryOnSiteQuestion extends BaseZhiyuEntity {

    /** 租户 ID */
    private String tenantId;

    /** 题干 */
    private String questionText;

    /** 参考答案 */
    private String answer;

    /** 题型（如 short_answer） */
    private String questionType;

    /** 分值 */
    private Double score;

    /** 难度 */
    private String difficulty;

    /** 关联知识点 ID（uuid[]） */
    @TableField(typeHandler = PgUuidArrayTypeHandler.class)
    private List<String> knowledgePointIds;

    /** 标签（text[]） */
    @TableField(typeHandler = PgArrayTypeHandler.class)
    private List<String> tags;

    /** 创建人用户 ID */
    private String creatorId;
}
