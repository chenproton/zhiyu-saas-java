package org.dromara.zhiyu.domain.ai;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Data;

import java.time.OffsetDateTime;

/**
 * 知识库文档分块（ai_kb_chunks 表，Go→Java 迁移）。
 *
 * <p>检索单元：content 仅在召回结果中经溯源片段输出；无 updated_at 列，
 * 不继承 {@link org.dromara.zhiyu.core.domain.BaseZhiyuEntity}（对齐 AiKbDocument）。</p>
 *
 * @author zhiyu
 */
@Data
@JsonInclude(JsonInclude.Include.NON_NULL)
@TableName("ai_kb_chunks")
public class AiKbChunk {

    /** 主键（UUID） */
    @TableId(value = "id", type = IdType.ASSIGN_UUID)
    private String id;

    /** 租户 ID */
    private String tenantId;

    /** 文档 ID */
    private String docId;

    /** 知识库 ID（冗余，召回免 JOIN 文档表） */
    private String kbId;

    /** 文档内序号（溯源「第 N 段」） */
    private Integer seq;

    /** 分块内容 */
    private String content;

    /** 创建时间 */
    private OffsetDateTime createdAt;

    /** 文档名（召回时 JOIN 填充，非表列） */
    @TableField(exist = false)
    private String docName;
}
