package org.dromara.zhiyu.domain.dto.favorites;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * 通用收藏 DTO（对齐 Go favorites_handler.go 与 api-client favorites.ts）。
 *
 * <p>列表响应字段 key 为 snake_case（scene/course/question_bank/exam/ai_kb/ai_agent），
 * 与前端契约严格一致。</p>
 *
 * @author zhiyu
 */
public class FavoritesDtos {

    /** 收藏状态响应（FavoriteStatus） */
    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class FavoriteStatus {
        private Boolean isFavorite;
        private Integer favoriteCount;
    }

    /** 收藏列表响应（FavoriteListResponse） */
    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class FavoriteListResponse {
        private List<FavoriteScenarioDto> scene = new ArrayList<>();
        private List<FavoriteCourseDto> course = new ArrayList<>();
        @JsonProperty("question_bank")
        private List<FavoriteQuestionBankDto> questionBank = new ArrayList<>();
        private List<FavoriteExamDto> exam = new ArrayList<>();
        @JsonProperty("ai_kb")
        private List<FavoriteAIKBDto> aiKb = new ArrayList<>();
        @JsonProperty("ai_agent")
        private List<FavoriteAIAgentDto> aiAgent = new ArrayList<>();
    }

    /** 场景（Scenario，仅已发布） */
    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class FavoriteScenarioDto {
        private String id;
        private String name;
        private String code;
        private String coverImage;
        private String careerPositionId;
        private List<String> industryIds;
        private List<String> industryNames;
        private List<String> professionIds;
        private List<String> professionNames;
        private String batchId;
        private Integer difficulty;
        private String version;
        private Integer viewCount;
        private String status;
        private String sourceType;
        private String sourceEnterpriseId;
        private String background;
        private String deliveryGoal;
        private String creatorId;
        private String creatorName;
        private List<String> coBuilderIds;
        private OffsetDateTime createdAt;
        private OffsetDateTime updatedAt;
        private OffsetDateTime publishTime;
        private Integer taskCount;
    }

    /** 课程（Course，仅已发布） */
    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class FavoriteCourseDto {
        private String id;
        private String code;
        private String name;
        private String type;
        private String category;
        private String majorId;
        private String majorName;
        private String description;
        private String teacherId;
        private String industryId;
        private String industryName;
        private String version;
        private BigDecimal onlineHours;
        private BigDecimal offlineHours;
        private BigDecimal onlineWeight;
        private BigDecimal offlineWeight;
        private String semester;
        private String className;
        private String status;
        private String coverColor;
        private String coverImage;
        private String courseTag;
        private Integer difficulty;
        private List<String> knowledgePointIds;
        private List<String> abilityPointIds;
        private List<String> resourceIds;
        private String creatorId;
        private String creatorName;
        private List<String> coCreatorIds;
        private String batchId;
        private String batchName;
        private Integer nodeCount;
        private Integer resourceCount;
        private Integer studyCount;
        private Integer viewCount;
        private OffsetDateTime createdAt;
        private OffsetDateTime updatedAt;
    }

    /** 题库（QuestionBank，仅已发布） */
    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class FavoriteQuestionBankDto {
        private String id;
        private String code;
        private String name;
        private String description;
        private String coverImage;
        private String status;
        private Integer questionCount;
        private String creatorId;
        private String creatorName;
        private List<String> collaboratorIds;
        private List<String> collaboratorNames;
        private List<String> collaboratorDeptIds;
        private String batchId;
        private String version;
        private String ownerType;
        private Boolean isDraftPool;
        private OffsetDateTime createdAt;
        private OffsetDateTime updatedAt;
    }

    /** 试卷（Exam，仅已发布、非临时） */
    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class FavoriteExamDto {
        private String id;
        private String code;
        private String name;
        private String description;
        private String status;
        private BigDecimal totalScore;
        private Integer duration;
        private Integer questionCount;
        private String coverImage;
        private List<String> collaboratorIds;
        private List<String> collaboratorDeptIds;
        private List<String> collaboratorNames;
        private String batchId;
        private String version;
        private String ownerType;
        private String creatorId;
        private String creatorName;
        private Boolean isTemp;
        private OffsetDateTime createdAt;
        private OffsetDateTime updatedAt;
    }

    /** AI 知识库（AIKnowledgeBase，仅已发布） */
    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class FavoriteAIKBDto {
        private String id;
        private String name;
        private String description;
        private List<String> tags;
        private String coverImage;
        private String status;
        private String reviewComment;
        private Integer docCount;
        private Long askCount;
        private Integer viewCount;
        private String ownerId;
        private String majorId;
        private String departmentId;
        private String majorName;
        private String departmentName;
        private String kbType;
        private String ownerName;
        private OffsetDateTime createdAt;
        private OffsetDateTime updatedAt;
    }

    /** AI 智能体（AIAgent，仅已发布） */
    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class FavoriteAIAgentDto {
        private String id;
        private String name;
        private String avatar;
        private String description;
        private String coverImage;
        private String greeting;
        private String systemPrompt;
        private String status;
        private String reviewComment;
        private Long chatCount;
        private Integer viewCount;
        private String majorId;
        private String departmentId;
        private String majorName;
        private String departmentName;
        private String ownerId;
        private String ownerName;
        private List<String> kbIds;
        private List<String> kbNames;
        private OffsetDateTime createdAt;
        private OffsetDateTime updatedAt;
    }
}
