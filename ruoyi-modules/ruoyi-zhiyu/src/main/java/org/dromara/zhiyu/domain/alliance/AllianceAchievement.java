package org.dromara.zhiyu.domain.alliance;

import com.baomidou.mybatisplus.annotation.TableName;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Data;
import lombok.EqualsAndHashCode;
import org.dromara.zhiyu.core.domain.BaseZhiyuEntity;

import java.time.LocalDate;

/**
 * 合作成果（alliance_achievements 表，Go→Java 迁移）。
 *
 * @author zhiyu
 */
@Data
@EqualsAndHashCode(callSuper = true)
@JsonInclude(JsonInclude.Include.NON_NULL)
@TableName("alliance_achievements")
public class AllianceAchievement extends BaseZhiyuEntity {

    private String tenantId;
    private String title;
    private String type;
    private String description;
    private LocalDate achievementDate;
    private String coverImage;
    /** jsonb 字符串数组（attachments） */
    private String attachments;
    private String citationReason;
    /** jsonb 字符串数组（images） */
    private String images;
    /** jsonb 字符串数组（owner_persons） */
    private String ownerPersons;
    /** jsonb 字符串数组（co_builders） */
    private String coBuilders;
    /** jsonb 字符串数组（enterprise_ids） */
    private String enterpriseIds;
    /** jsonb 字符串数组（project_ids） */
    private String projectIds;
    /** jsonb 对象数组（related_positions） */
    private String relatedPositions;
    /** jsonb 对象数组（related_scenes） */
    private String relatedScenes;
    /** jsonb 对象数组（related_courses） */
    private String relatedCourses;
    private String status;
    private Integer viewCount;
    /** jsonb 字符串数组（secondary_colleges） */
    private String secondaryColleges;
    private Boolean isPublic;
    private String createdBy;
}
