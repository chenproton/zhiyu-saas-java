package org.dromara.zhiyu.mapper.partner;

import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;
import org.dromara.common.mybatis.core.mapper.BaseMapperPlus;
import org.dromara.zhiyu.domain.scene.SceneScenario;

import java.util.List;

/**
 * 企业共建场景 Mapper（scenarios 表，Go→Java 迁移）。
 *
 * @author zhiyu
 */
public interface PartnerScenarioMapper extends BaseMapperPlus<SceneScenario, SceneScenario> {

    @Select("<script>SELECT sc.id FROM scenarios sc"
        + " WHERE (sc.source_enterprise_id = #{enterpriseId}"
        + "   OR EXISTS (SELECT 1 FROM alliance_resource_grants g WHERE g.enterprise_id = #{enterpriseId} AND g.resource_type = 'scenario' AND sc.id = ANY(g.resource_ids)))"
        + " <if test=\"schoolTenantId != null and schoolTenantId != ''\"> AND sc.tenant_id = #{schoolTenantId}</if>"
        + " <if test=\"search != null and search != ''\"> AND sc.name LIKE CONCAT('%', #{search}, '%')</if>"
        + " ORDER BY sc.updated_at DESC LIMIT #{limit} OFFSET #{offset}</script>")
    List<String> selectScenarioIds(@Param("enterpriseId") String enterpriseId,
                                   @Param("schoolTenantId") String schoolTenantId,
                                   @Param("search") String search, @Param("limit") int limit,
                                   @Param("offset") int offset);

    @Select("<script>SELECT COUNT(*) FROM scenarios sc"
        + " WHERE (sc.source_enterprise_id = #{enterpriseId}"
        + "   OR EXISTS (SELECT 1 FROM alliance_resource_grants g WHERE g.enterprise_id = #{enterpriseId} AND g.resource_type = 'scenario' AND sc.id = ANY(g.resource_ids)))"
        + " <if test=\"schoolTenantId != null and schoolTenantId != ''\"> AND sc.tenant_id = #{schoolTenantId}</if>"
        + " <if test=\"search != null and search != ''\"> AND sc.name LIKE CONCAT('%', #{search}, '%')</if></script>")
    long countScenarios(@Param("enterpriseId") String enterpriseId, @Param("schoolTenantId") String schoolTenantId,
                        @Param("search") String search);

    @Select("<script>SELECT sc.id, t.name FROM scenarios sc JOIN tenants t ON t.id = sc.tenant_id WHERE sc.id IN"
        + " <foreach collection=\"ids\" item=\"id\" open=\"(\" separator=\",\" close=\")\">#{id}</foreach></script>")
    List<IdNameRow> selectSchoolNames(@Param("ids") List<String> ids);

    @Insert("INSERT INTO scenarios (id, name, code, cover_image, career_position_id, industry_ids, profession_ids,"
        + " batch_id, difficulty, version, status, background, delivery_goal, creator_id, co_builder_ids, tenant_id,"
        + " source_type, source_enterprise_id, source_resource_id)"
        + " VALUES (#{id}, #{name}, #{code}, #{coverImage}, #{careerPositionId},"
        + " #{industryIds, typeHandler=org.dromara.zhiyu.core.mybatis.PgArrayTypeHandler},"
        + " #{professionIds, typeHandler=org.dromara.zhiyu.core.mybatis.PgArrayTypeHandler},"
        + " #{batchId}, #{difficulty}, #{version}, #{status}, #{background}, #{deliveryGoal}, #{creatorId},"
        + " #{coBuilderIds, typeHandler=org.dromara.zhiyu.core.mybatis.PgArrayTypeHandler},"
        + " #{tenantId}, #{sourceType}, #{sourceEnterpriseId}, #{sourceResourceId})")
    int insertCoBuildScenario(@Param("id") String id, @Param("name") String name, @Param("code") String code,
                              @Param("coverImage") String coverImage, @Param("careerPositionId") String careerPositionId,
                              @Param("industryIds") List<String> industryIds,
                              @Param("professionIds") List<String> professionIds, @Param("batchId") String batchId,
                              @Param("difficulty") Integer difficulty, @Param("version") String version,
                              @Param("status") String status, @Param("background") String background,
                              @Param("deliveryGoal") String deliveryGoal, @Param("creatorId") String creatorId,
                              @Param("coBuilderIds") List<String> coBuilderIds, @Param("tenantId") String tenantId,
                              @Param("sourceType") String sourceType,
                              @Param("sourceEnterpriseId") String sourceEnterpriseId,
                              @Param("sourceResourceId") String sourceResourceId);

    @Update("UPDATE scenarios SET name = #{name}, cover_image = #{coverImage}, career_position_id = #{careerPositionId},"
        + " industry_ids = #{industryIds, typeHandler=org.dromara.zhiyu.core.mybatis.PgArrayTypeHandler},"
        + " profession_ids = #{professionIds, typeHandler=org.dromara.zhiyu.core.mybatis.PgArrayTypeHandler},"
        + " batch_id = #{batchId}, difficulty = #{difficulty}, version = #{version}, background = #{background},"
        + " delivery_goal = #{deliveryGoal},"
        + " co_builder_ids = #{coBuilderIds, typeHandler=org.dromara.zhiyu.core.mybatis.PgArrayTypeHandler},"
        + " updated_at = NOW() WHERE id = #{id}")
    int updateCoBuildScenario(@Param("id") String id, @Param("name") String name, @Param("coverImage") String coverImage,
                              @Param("careerPositionId") String careerPositionId,
                              @Param("industryIds") List<String> industryIds,
                              @Param("professionIds") List<String> professionIds, @Param("batchId") String batchId,
                              @Param("difficulty") Integer difficulty, @Param("version") String version,
                              @Param("background") String background, @Param("deliveryGoal") String deliveryGoal,
                              @Param("coBuilderIds") List<String> coBuilderIds);

    @Update("UPDATE scenarios SET status = #{to}, updated_at = NOW()"
        + " WHERE id = #{id} AND tenant_id = #{tenantId} AND status = #{current}")
    int casTransition(@Param("id") String id, @Param("tenantId") String tenantId, @Param("current") String current,
                      @Param("to") String to);

    @Select("SELECT status FROM scenarios WHERE id = #{id}")
    String selectStatus(@Param("id") String id);

    @Select("SELECT EXISTS(SELECT 1 FROM scenarios WHERE tenant_id = #{tenantId} AND code = #{code})")
    boolean existsCode(@Param("tenantId") String tenantId, @Param("code") String code);

    @Select("SELECT tenant_id FROM scenarios WHERE id = #{id}")
    String selectTenantId(@Param("id") String id);

    @Select("SELECT id FROM scenarios WHERE source_enterprise_id = #{enterpriseId}"
        + " AND source_resource_id = #{sourceResourceId} AND status IN ('draft','pending','rejected') LIMIT 1")
    String selectDraftIdBySource(@Param("enterpriseId") String enterpriseId,
                                 @Param("sourceResourceId") String sourceResourceId);

    @Select("SELECT EXISTS(SELECT 1 FROM scene_evaluation_results ser WHERE ser.scene_id = #{id}"
        + " OR ser.task_id IN (SELECT id FROM scenario_tasks WHERE scenario_id = #{id}))")
    boolean existsEvaluationResults(@Param("id") String id);

    @Update("UPDATE teaching_plan_entries SET scenario_id = NULL WHERE scenario_id = #{id}")
    int unbindTeachingPlanEntries(@Param("id") String id);

    @Update("UPDATE schedule_entries SET scenario_id = NULL WHERE scenario_id = #{id}")
    int unbindScheduleEntries(@Param("id") String id);

    @Delete("DELETE FROM scenarios WHERE id = #{id}")
    int deleteScenarioById(@Param("id") String id);

    class IdNameRow {
        private String id;
        private String name;

        public String getId() {
            return id;
        }

        public void setId(String id) {
            this.id = id;
        }

        public String getName() {
            return name;
        }

        public void setName(String name) {
            this.name = name;
        }
    }
}
