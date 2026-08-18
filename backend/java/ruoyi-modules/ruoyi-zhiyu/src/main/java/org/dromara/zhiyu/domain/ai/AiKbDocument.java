package org.dromara.zhiyu.domain.ai;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Data;

import java.time.OffsetDateTime;

/**
 * 知识库文档（ai_kb_documents 表，Go→Java 迁移）。
 *
 * <p>该表无 updated_at 列，不继承 {@link org.dromara.zhiyu.core.domain.BaseZhiyuEntity}。</p>
 *
 * @author zhiyu
 */
@Data
@JsonInclude(JsonInclude.Include.NON_NULL)
@TableName("ai_kb_documents")
public class AiKbDocument {

    /** 主键（UUID） */
    @TableId(value = "id", type = IdType.ASSIGN_UUID)
    private String id;

    /** 租户 ID */
    private String tenantId;

    /** 知识库 ID */
    private String kbId;

    /** 上传人 ID */
    private String uploaderId;

    /** 文件名 */
    private String name;

    /** 存储路径（不外泄） */
    @JsonIgnore
    private String filePath;

    /** 文件大小 */
    private Long fileSize;

    /** MIME 类型 */
    private String mime;

    /** 解析状态（parsing/ready/failed） */
    private String status;

    /** 解析错误信息 */
    private String error;

    /** 分块数 */
    private Integer chunkCount;

    /** 字符数 */
    private Integer charCount;

    /** 创建时间 */
    private OffsetDateTime createdAt;

    /** 上传人姓名（视图扩展字段，非表列） */
    @TableField(exist = false)
    private String uploaderName;
}
