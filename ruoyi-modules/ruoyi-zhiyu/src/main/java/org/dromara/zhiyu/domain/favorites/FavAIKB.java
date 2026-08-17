package org.dromara.zhiyu.domain.favorites;

import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableName;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Data;
import lombok.EqualsAndHashCode;
import org.dromara.zhiyu.core.domain.BaseZhiyuEntity;
import org.dromara.zhiyu.core.mybatis.JsonStringListTypeHandler;

import java.util.List;

/**
 * AI 知识库（ai_knowledge_bases 表，收藏列表子集字段）。
 *
 * @author zhiyu
 */
@Data
@EqualsAndHashCode(callSuper = true)
@JsonInclude(JsonInclude.Include.NON_NULL)
@TableName("ai_knowledge_bases")
public class FavAIKB extends BaseZhiyuEntity {

    /** 租户 ID */
    private String tenantId;

    /** 创建人 ID */
    private String ownerId;

    /** 名称 */
    private String name;

    /** 描述 */
    private String description;

    /** 标签（jsonb 字符串数组） */
    @TableField(typeHandler = JsonStringListTypeHandler.class)
    private List<String> tags;

    /** 封面图 */
    private String coverImage;

    /** 状态（private/pending/published/rejected） */
    private String status;

    /** 审核意见 */
    private String reviewComment;

    /** 文档数 */
    private Integer docCount;

    /** 问答数 */
    private Long askCount;

    /** 专业 ID */
    private String majorId;

    /** 部门 ID */
    private String departmentId;

    /** 分类（大厅筛选） */
    private String kbType;
}
