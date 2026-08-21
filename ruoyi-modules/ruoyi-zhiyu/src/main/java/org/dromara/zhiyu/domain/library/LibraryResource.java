package org.dromara.zhiyu.domain.library;

import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableName;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Data;
import lombok.EqualsAndHashCode;
import org.dromara.zhiyu.core.domain.BaseZhiyuEntity;

/**
 * 资源库资源（resource_library 表）。
 *
 * <p>uploaderName/uploaderOrgName/uploaderMajorName 为关联 users/organizations/majors
 * 的 JOIN 结果列（非本表列），由自定义 SQL 填充，标注 exist=false 防止 MyBatis-Plus
 * 自动 CRUD 将其当作表列。</p>
 *
 * @author zhiyu
 */
@Data
@EqualsAndHashCode(callSuper = true)
@JsonInclude(JsonInclude.Include.NON_NULL)
@TableName("resource_library")
public class LibraryResource extends BaseZhiyuEntity {

    /** 租户 ID */
    private String tenantId;

    /** 资源名称 */
    private String name;

    /** 资源类型（resource_type 枚举：document/spreadsheet/image/...） */
    private String resourceType;

    /** 资源 URL */
    private String url;

    /** 资源描述 */
    private String description;

    /** 缩略图 URL */
    private String thumbnail;

    /** 文件大小（字节） */
    private Long fileSize;

    /** 元数据（jsonb 原始 JSON 文本，由 service 负责与 Map 互转） */
    private String metadata;

    /** 上传人用户 ID */
    private String uploadedBy;

    /** 上传人姓名（JOIN users，非表列） */
    @TableField(exist = false)
    private String uploaderName;

    /** 上传人所属机构名（JOIN organizations，非表列） */
    @TableField(exist = false)
    private String uploaderOrgName;

    /** 上传人所属专业名（JOIN majors，非表列） */
    @TableField(exist = false)
    private String uploaderMajorName;
}
