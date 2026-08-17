package org.dromara.zhiyu.domain.dto.library;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Data;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;

/**
 * 资源库 library 域 DTO（对齐 Go resource_library_handler.go / on_site_question_library_handler.go /
 * tag_handler.go 与 shared-types library.ts）。
 *
 * @author zhiyu
 */
public class LibraryDtos {

    // ---------- 资源库 resources ----------

    /** 创建资源请求（CreateResourceLibraryRequest） */
    @Data
    public static class CreateResourceRequest {
        private String name;
        private String resourceType;
        private String url;
        private String description;
        private String thumbnail;
        private Long fileSize;
        private Map<String, Object> metadata;
    }

    /** 更新资源请求（部分更新：null 字段保留原值，对齐 Go 指针字段语义） */
    @Data
    public static class UpdateResourceRequest {
        private String name;
        private String resourceType;
        private String url;
        private String description;
        private String thumbnail;
        private Long fileSize;
        private Map<String, Object> metadata;
    }

    /** 批量导入重名校验请求（PreviewImportRequest） */
    @Data
    public static class PreviewImportRequest {
        private List<String> names;
        private String resourceType;
    }

    /** 资源条目（ResourceLibraryItem） */
    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class ResourceLibraryItemDto {
        private String id;
        private String tenantId;
        private String name;
        private String resourceType;
        private String url;
        private String description;
        private String thumbnail;
        private Long fileSize;
        private Map<String, Object> metadata;
        private String uploadedBy;
        private String uploaderName;
        private String uploaderOrgName;
        private String uploaderMajorName;
        private OffsetDateTime createdAt;
        private OffsetDateTime updatedAt;
    }

    /** 按类型统计（列表总览统计卡片） */
    @Data
    public static class ResourceTypeCountDto {
        private String resourceType;
        private Integer count;
    }

    /** 引用次数分桶（CitationBucket） */
    @Data
    public static class CitationBucketDto {
        private String label;
        private Integer count;
    }

    /** 引用次数分布统计（CitationStats） */
    @Data
    public static class CitationStatsDto {
        private List<CitationBucketDto> buckets;
        private Integer zeroCount;
        private Integer total;
    }

    /** 零引用资源条目（UncitedItem，弹窗列表：名称 + 上传时间） */
    @Data
    public static class UncitedItemDto {
        private String id;
        private String name;
        private OffsetDateTime createdAt;
    }

    // ---------- 现场题库 on-site-questions ----------

    /** 现场题库题目创建/更新请求（部分更新：null 字段保留原值） */
    @Data
    public static class OnSiteQuestionRequest {
        private String questionText;
        private String answer;
        private String questionType;
        private Double score;
        private String difficulty;
        private List<String> knowledgePointIds;
        private List<String> tags;
    }

    /** 现场题库题目条目（OnSiteQuestionLibraryItem） */
    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class OnSiteQuestionItemDto {
        private String id;
        private String tenantId;
        private String questionText;
        private String answer;
        private String questionType;
        private Double score;
        private String difficulty;
        private List<String> knowledgePointIds;
        private List<String> tags;
        private String creatorId;
        private OffsetDateTime createdAt;
        private OffsetDateTime updatedAt;
    }

    // ---------- 标签 tags / resource-tags ----------

    /** 创建标签请求（CreateTagRequest） */
    @Data
    public static class CreateTagRequest {
        private String name;
        private String color;
    }

    /** 更新标签请求（UpdateTagRequest） */
    @Data
    public static class UpdateTagRequest {
        private String name;
        private String color;
    }

    /** 标签条目（TagItem） */
    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class TagDto {
        private String id;
        private String tenantId;
        private String name;
        private String color;
        private Integer resourceCount;
        private OffsetDateTime createdAt;
        private OffsetDateTime updatedAt;
    }

    /** 设置资源标签绑定请求（SetResourceTagsRequest，全量替换） */
    @Data
    public static class SetResourceTagsRequest {
        private String resourceType;
        private String resourceId;
        private List<String> tagIds;
    }

    /** 批量查询资源标签绑定请求（QueryBindingsRequest） */
    @Data
    public static class QueryBindingsRequest {
        private String resourceType;
        private List<String> resourceIds;
    }

    /** 资源-标签绑定（ResourceTagRelation） */
    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class ResourceTagRelationDto {
        private String resourceId;
        private List<TagDto> tags;
    }

    /** 标签绑定查询行（resource_tag_relations JOIN tags，Mapper 结果映射用） */
    @Data
    public static class TagRelationRow {
        private String resourceId;
        private String tagId;
        private String tenantId;
        private String name;
        private String color;
        private OffsetDateTime createdAt;
        private OffsetDateTime updatedAt;
    }
}
