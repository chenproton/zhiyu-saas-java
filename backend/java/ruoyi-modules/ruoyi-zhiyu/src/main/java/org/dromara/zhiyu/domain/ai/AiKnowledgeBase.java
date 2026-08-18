package org.dromara.zhiyu.domain.ai;

import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableName;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Data;
import lombok.EqualsAndHashCode;
import org.dromara.zhiyu.core.domain.BaseZhiyuEntity;
import org.dromara.zhiyu.core.mybatis.JsonStringListTypeHandler;

import java.time.OffsetDateTime;
import java.util.List;

/**
 * AI 知识库（ai_knowledge_bases 表，Go→Java 迁移）。
 *
 * <p>视图扩展字段（ownerName/myRole/majorName/departmentName/viewCount）非本表列，
 * 由 Service 组装后置入，声明为 {@code exist=false} 避免进入 SQL。</p>
 *
 * @author zhiyu
 */
@Data
@EqualsAndHashCode(callSuper = true)
@JsonInclude(JsonInclude.Include.NON_NULL)
@TableName("ai_knowledge_bases")
public class AiKnowledgeBase extends BaseZhiyuEntity {

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

    /** 封面图（/uploads 相对路径，空=前端渐变兜底） */
    private String coverImage;

    /** 状态（private/pending/published/rejected） */
    private String status;

    /** 审核意见 */
    private String reviewComment;

    /** 审核人 ID */
    private String reviewedBy;

    /** 审核时间 */
    private OffsetDateTime reviewedAt;

    /** 文档数 */
    private Integer docCount;

    /** 问答数 */
    private Long askCount;

    /** 专业 ID */
    private String majorId;

    /** 部门 ID */
    private String departmentId;

    /** 分类（course_resource/research/teaching_case/qa） */
    private String kbType;

    // ---------- 视图扩展字段（非表列） ----------

    /** 浏览量 */
    @TableField(exist = false)
    private Long viewCount;

    /** 专业名称 */
    @TableField(exist = false)
    private String majorName;

    /** 部门名称 */
    @TableField(exist = false)
    private String departmentName;

    /** 创建人姓名 */
    @TableField(exist = false)
    private String ownerName;

    /** 我在该库的角色（owner/editor/viewer/member） */
    @TableField(exist = false)
    private String myRole;
}
