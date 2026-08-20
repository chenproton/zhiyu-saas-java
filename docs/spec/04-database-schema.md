# 数据库 Schema 设计 — 知与 SaaS

> 基于 `db/migrations/`（001_baseline + 091~168 增量）回溯整理。
> 当前共 **153 张表**（156 定义 − 3 处删除：迁移 110 删除 app_modules/platform_links、154 删除 alliance_expert_mentor_links）。
> 124~168 增量由「数据模型变更流程」约束回写（见 spec-standards.md），由 spec-check.sh 第 7 项机械校验。
> 约定：主键统一 `uuid DEFAULT gen_random_uuid()`；`created_at/updated_at timestamptz DEFAULT now()`；业务枚举用 `varchar + CHECK`，仅 7 个原生 PG ENUM。

---

## 1. 实体关系图（ER）

### 1.1 核心主线

```
tenants(租户) ── 行级隔离一切业务数据
├─ 组织体系: organizations(树) → org_types ; users → user_roles → roles
│
├─ 【岗课证主线】岗位 → 职责 → 能力点绑定(权重+达标等级)
│   career_positions ─→ certification_rules(每岗唯一) → items → points → related_tasks
│   ability_points(能力字典 NL 编码) ←── course/node/scene 评价结果 ──→ job_ability_results
│   certificate_library → position_certificates ; micro_cert_templates → cert_issuance_records
│
├─ 【课程链】courses → system_course_nodes(树)
│       ├─→ node_homeworks → node_homework_submissions
│       ├─→ node_quizzes → node_quiz_questions
│       ├─→ node_resources / hybrid_node_modules
│       └─→ node_evaluation_results（节点级评价）
│   courses → course_homeworks → course_homework_submissions
│   courses → course_evaluation_results（课程级评价）
│
├─ 【场景链】scenarios → scenario_tasks
│       ├─→ task_evaluation_methods → task_eval_points / task_review_steps / task_eval_score_rules
│       ├─→ task_deliverables / task_resources / task_ability|knowledge_bindings
│       └─→ scene_evaluation_results（任务级评价）
│   scenario_weight_configs / scenario_grade_mappings
│
├─ 【考试链】question_banks → questions → exam_questions ; exams → exam_usages → exam_results
│
├─ 【教务链】terms ← teaching_plans ← training_programs → training_program_courses
│   teaching_plans → teaching_plan_entries → schedule_entries(课表) → venues/period_slots
│
├─ 【联盟链】partner_enterprises ↔ alliance_enterprise_links ↔ projects(→milestones) ↔ agreements ↔ experts
│   → achievements / brands / permissions / dictionaries / school_info
│   → employment_projects ← employment_jobs（enterprise_id→partner_enterprises）← employment_applications（→users）
│
└─ 【支撑】workflows → approval_records ; 五套同构 batches(岗位/课程/测评/场景/教务)
    evaluation_methods(评价方法字典) ; subscription_packages(订阅)
```

### 1.2 关系标注

| 关系 | 类型 | 说明 |
|------|------|------|
| tenants → 各业务表 | 1:N | `tenant_id` 可空列 + 索引 + ON DELETE CASCADE |
| organizations → organizations | 自引用 1:N | parent_id 组织树 |
| users → organizations/majors | N:1 | SET NULL（可空业务引用）|
| users → 学生归属记录 | 1:N | CASCADE（NOT NULL 引用）|
| courses → system_course_nodes | 1:N | CASCADE |
| system_course_nodes → 自身 | 自引用 | parent_id，删除 SET NULL |
| career_positions → certification_rules | 1:1 | (position_id) 唯一 |
| courses/exams/scenarios/positions → batches | N:1 | batch_id 可空 |
| training_programs → teaching_plans → schedule_entries | 1:N:1 | 层级下钻 |
| evaluation_results → 主体(课程/节点/任务) | N:1 | 三表同构 |

---

## 2. 核心表定义（字段级）

### 2.1 `tenants` — 租户

| 字段 | 类型 | 默认 | 空 | 说明 |
|------|------|------|----|------|
| id | uuid | gen_random_uuid() | 否 | PK |
| name | varchar(128) | — | 否 | 租户名称 |
| code | varchar(64) | — | 否 | 唯一 code |
| domain | varchar(256) | — | 可 | 域名 |
| enterprise_code | varchar(64) | — | 可 | 企业编码 |
| admin_ids | uuid[] | '{}' | 否 | 管理员 id 列表 |
| type | varchar(16) | school | 否 | 租户类型 school/enterprise（142） |
| status | varchar(16) | active | 否 | active/inactive |
| school_type / province / city / scale_data / secondary_colleges / education_level / education_nature | — | — | 可 | 迁移 104/105 增补教育属性（jsonb 等） |
| created_at / updated_at | timestamptz | now() | 否 | — |

索引：`tenants_code_key UNIQUE (code)`（code 唯一）；**无 domain 唯一约束**（domain 可重复）。

### 2.2 `users` — 用户

| 字段 | 类型 | 默认 | 空 | 说明 |
|------|------|------|----|------|
| id | uuid | — | 否 | PK |
| tenant_id | uuid | — | 可 | FK → tenants CASCADE |
| org_node_id | uuid | — | 可 | 组织节点（教师→院系，学生→班级），SET NULL |
| major_id | uuid | — | 可 | 专业，SET NULL |
| role | user_role ENUM | — | 否 | school/enterprise/operator |
| login_name | varchar(255) | — | 可 | 复合唯一 `uq_users_tenant_platform_login (tenant_id, platform, login_name)`（同一租户同一平台内唯一） |
| password_hash | varchar(255) | — | 否 | bcrypt |
| student_no / work_id | varchar(64) | — | 可 | 学号/工号 |
| title_ids | uuid[] | '{}' | 否 | 职称 |
| status | varchar(20) | — | 否 | active/inactive |
| password_changed_at | timestamptz | now() | 否 | 改密时间戳（160）；改密/重置时刷新，鉴权中间件据此判定旧 token 失效 |

### 2.3 `organizations` / `org_types` — 组织树

organizations：`id, tenant_id(CASCADE), type_id(FK org_types CASCADE，116 治理), parent_id(自引用), name, member_count, created_at/updated_at`。
org_types：`id, tenant_id, name, category, is_default`。组织树创建递归防环（循环引用 409）。

### 2.4 `roles` / `user_roles` — RBAC

roles：`id, tenant_id(CASCADE), name, code(tenant 内唯一), permissions jsonb(菜单+按钮权限图), status(active), created_at/updated_at`。
user_roles：`id, user_id(FK CASCADE), role_id(FK CASCADE)`（无 tenant_id，随用户/角色隔离）。

### 2.5 `career_positions` — 岗位（核心）

| 字段 | 类型 | 默认 | 空 | 说明 |
|------|------|------|----|------|
| id | uuid | — | 否 | PK |
| tenant_id | uuid | — | 可 | CASCADE |
| batch_id | uuid | — | 可 | 岗位批次 |
| code | varchar(64) | — | 否 | (tenant_id, code) 唯一 |
| name | varchar(128) | — | 否 | 岗位名 |
| short_name | varchar(64) | — | 可 | 简称 |
| industry_id | uuid | — | 可 | 行业 |
| position_type | varchar(16) | — | 否 | 类型 |
| salary_min / salary_max | integer | — | 可 | 薪资区间 |
| cover_image / description / career_path | text | — | 可 | 封面/描述/发展路径 |
| requirements | text[] | '{}' | 否 | 任职要求 |
| version | varchar(32) | — | 否 | 版本号 |
| status | varchar(16) | — | 否 | CHECK: draft/pending/approved/rejected/published/archived |
| created_by | uuid | — | 否 | 创建人 |
| collaborators | uuid[] | '{}' | 否 | 协作者 |
| view_count | integer | 0 | 否 | 浏览量 |

子表：`position_responsibilities`（岗位职责，sort_order）、`position_ability_bindings`（能力点绑定：required_level/weight 0-100 CHECK/rubric_description）、`position_certificates`、`position_favorites`（无 tenant_id）、`career_position_majors`（无 tenant_id）、`position_recommendations`。

### 2.6 `ability_domains` / `ability_points` — 能力字典

ability_domains：`id, tenant_id, name, description, sort_order`。
ability_points：`id, tenant_id, name, code(varchar(64), 迁移 120 回填 'NL-xxxx'), attributes text[], is_public, description, created_by`（无 domain_id 列；category 列已于迁移 130 DROP）。

### 2.7 认证链（certification_*）

| 表 | 关键字段 | 说明 |
|----|---------|------|
| certification_rules | career_position_id（**每岗唯一**）、status、rule_source(custom)、level_mapping jsonb | 认证规则 |
| certification_ability_items | rule_id CASCADE、name、sort_order | 能力项 |
| certification_ability_points | item_id CASCADE、ability_point_id、mapping_type(inherit/custom)、custom_level_mapping jsonb、required_level、weight | 能力点映射 |
| certification_related_tasks | cert_point_id CASCADE、task_id、max_score、weight | 关联任务 |
| certification_weights | rule_id、ability_point_id、task_id（可空=能力点占岗位分）、weight | 两级权重（091） |
| certification_grade_data | position_id + grade_year 唯一、total_ability_points、avg_achievement_rate | 年级数据（无 tenant_id） |
| certification_competency_requirements | grade_data_id、duty_name、target_level、current_level | 达标要求 |
| certification_grade_leaderboard | grade_data_id、user_id、achievement_rate、grade_label | 排行榜 |

### 2.8 `courses` / `system_course_nodes` — 课程链

**courses**：`id, tenant_id, code((tenant,code) 唯一), name, type, category, teacher_id, version, online_hours/offline_hours/online_weight, semester, status(CHECK 六态), knowledge_point_ids uuid[], resource_ids uuid[], ability_point_ids uuid[](095), eval_data jsonb(093), batch_id, description, cover_image, creator_id`。

**system_course_nodes**（树形）：`id, course_id(CASCADE), parent_id(自引用 SET NULL), name, ref_type(normal), source_id, teaching_goals, estimated_hours, eval_data jsonb, sort_order, created_at/updated_at, tenant_id`。

节点子表：`node_homeworks`（need_attachment/deadline/status）、`node_homework_submissions`（**098**：(homework,student) 唯一、attachment_urls[]、score/total_score）、`node_quizzes`/`node_quiz_questions`（time_limit、type/options/answer jsonb）、`node_resources`/`node_resource_bindings`、`node_knowledge_point_bindings`/`node_ability_point_bindings`（无 tenant_id）、`hybrid_node_modules`（module_key/mode/data jsonb）。

课程级：`course_homeworks`/`course_homework_submissions`（**094/096**）、`course_evaluation_results`（**095**）、`course_knowledge_bindings`/`course_resource_bindings`。

### 2.9 评价结果三兄弟（同构）

`course_evaluation_results` / `node_evaluation_results` / `scene_evaluation_results` 共用字段：

| 字段 | 类型 | 说明 |
|------|------|------|
| tenant_id + 主体(course_id/node_id/task_id) + evaluatee_id | uuid | 唯一约束 (tenant,主体,evaluatee,method_key) |
| method_key | varchar | 评价方式（考试/作业/评审/答辩等） |
| evaluator_type | varchar | 评分人类型 |
| status | varchar | pending 等 |
| total_score / max_score | numeric | 得分/满分 |
| eval_point_scores / objective_answers / subjective_content / drawn_questions | jsonb | 各评价点分数/客观题答案/主观内容/抽题记录 |
| completed_at | timestamptz | 完成时间 |

### 2.10 `scenarios` / `scenario_tasks` — 场景链

**scenarios**：`id, tenant_id, code((tenant,code) 唯一), name, status(CHECK 六态), difficulty(1-5 CHECK), profession_name, industry_ids varchar(64)[], career_position_id, batch_id, delivery_goal, background, cover_image, version, creator_id`。

**scenario_tasks**：`id, scenario_id(CASCADE), name, task_type, difficulty(1-5), dependency_ids uuid[], is_referenced, knowledge_ids/ability_ids/resource_ids uuid[], eval_data jsonb, sort_order`。

任务子表：`task_deliverables`（evaluation_points jsonb）、`task_resources`、`task_ability_bindings`/`task_knowledge_bindings`/`task_resource_bindings`、`task_evaluation_methods`（method_key、eval_object(individual)、eval_subjects[]、score_type、rubric_template_id(123 后 SET NULL)、version、is_enabled、(task,method) 唯一）、`task_eval_points`（量规评分点：sub_type/types[]/weight/scoring_method(level)/grade_mapping jsonb）、`task_review_steps`（subject_type/weight）、`task_eval_score_rules`（**123** 评分规则，纯复制语义）。

配置表：`scenario_weight_configs`（(scenario,task) 唯一、weight 0-100）、`scenario_grade_mappings`（level/min_score/max_score）。

### 2.11 考试链

**question_banks**：`id, tenant_id, code((tenant,code) 唯一), name, description, status(CHECK 六态), is_draft_pool, owner_type, batch_id, creator_id`。
**questions**：`id, bank_id(CASCADE), tenant_id, type, content, options jsonb, answer text, difficulty, knowledge_point_ids uuid[], analysis, status`。
**exams**：`id, tenant_id, code((tenant,code) 唯一), name, description, total_score, duration, owner_type(mine), is_temp, collaborator_ids uuid[], status(CHECK 六态), batch_id, creator_id`。
**exam_questions**：`exam_id CASCADE + question_id SET NULL（158 删题保护，question_id 可空）`，**(exam,question) 唯一（113）**、score、sort_order。
**exam_usages**：`id, tenant_id, exam_id, target_type(mine/course/node), target_ids uuid[], status(draft/published/finished，133 归一), start_time/end_time, duration, creator_id`。
**exam_results**：`id, tenant_id, exam_usage_id CASCADE, user_id, score/total_score, is_pass, answers jsonb`，**(exam_usage_id, user_id) 唯一**。
**random_draw_questions**：随机抽题（answer 字段，按专业范围）。
**question_bank_knowledge_points**：关联（无 tenant_id）。

### 2.12 批次五套（同构）

`batches`(岗位) / `lesson_batches`(课程) / `evaluation_batches`(测评) / `scene_batches`(场景) / `affairs_batches`(教务)：

| 字段 | 类型 | 说明 |
|------|------|------|
| id / tenant_id(CASCADE) | uuid | PK / 租户 |
| name / code | varchar | 批次名/编码 |
| org_node_id | uuid | 组织节点（岗位/课程/测评/场景批次） |
| major_id | uuid | 专业关联（迁移 106 后去掉院系仅关联专业） |
| workflow_id | uuid | 关联审批流 |
| status | varchar(16) | open/closed |
| 各自 count 字段 | integer | position_count/course_count/program_count 等 |
| created_at / updated_at | timestamptz | — |

### 2.13 `workflows` / `approval_records` — 审批

**workflows**：`id, tenant_id, name, scene, steps jsonb(步骤/角色/any-all), usage_count, major_ids uuid[], status(active/inactive)`。
**approval_records**：`id, tenant_id, workflow_id, target_type/target_id, current_step_idx, status(pending/approved/rejected), history jsonb, created_by, reviewed_by`；**112**：`(target_type, target_id) partial unique WHERE status='pending'` 防重复提交。

### 2.14 教务链（092/094/097/101/106 增量）

| 表 | 关键字段 |
|----|---------|
| terms | name("2025-2026-1")、weeks_count、is_current（无 (tenant,name) 唯一约束，仅 tenant 索引） |
| training_programs | code、entry_year、level(中专/大专/本科)、total_credits、status(draft/published)、collaborators[]、batch_id |
| training_program_courses | program_id CASCADE、course_id SET NULL、credits、hours、semester、nature(必修/选修/实践/场景)、assessment、position_id(102)（无 tenant_id） |
| teaching_plans | status(draft/confirmed)、(program_id,term_id) 唯一 |
| teaching_plan_entries | plan_id、type(theory/practice/scene)、week_pattern(all/odd/even)、teacher_type、venue_type、course_id/scenario_id、teacher_id、class_node_id（无 tenant_id） |
| teaching_plan_entry_classes | (entry_id,class_id) 复合主键（101，多班级） |
| venues | name、capacity、tenant_id |
| period_slots | start_time/end_time、tenant_id |
| schedule_entries | term_id、type(traditional/scene)、day_of_week 1-7、periods jsonb、week_pattern、source(manual/imported)、status(draft/published)、version、class_node_ids[]（107）、course_id(094)、teacher_id、venue_id、scenario_id |

### 2.15 联盟链（101/103/107/108/109/122）

| 表 | 关键字段 |
|----|---------|
| alliance_school_info | (tenant_id) 唯一、name、school_type、scale_data jsonb、secondary_colleges jsonb |
| partner_enterprises | 企业主体（142 由 alliance_enterprises 重命名，全局唯一 name）、enable_public、cooperation_types jsonb、证照照片 jsonb |
| alliance_enterprise_links | 学校-企业合作关联（142 新建）：tenant_id + enterprise_id CASCADE 唯一、relation_type、status(negotiating/active/paused/terminated)、rating(general)、enterprise_type(cooperation/third-party)、is_public、secondary_colleges jsonb |
| alliance_enterprise_agreements | enterprise_id CASCADE、status(draft) |
| alliance_projects | phase(initiation)、publish_status(draft)、enterprise_ids jsonb、industry_ids[] |
| alliance_project_milestones | project_id CASCADE、is_completed |
| alliance_achievements | type(job/scene/course/custom)、related_positions/scenes/courses jsonb |
| alliance_experts | expert_type、rating(copper/silver/gold)、enterprise_id SET NULL、partner_source |
| alliance_agreements | status(draft/active/expired/renewed/terminated)、project_ids[](109)、enterprise_id |
| alliance_permissions | account_type、resource/platform_permissions jsonb、enterprise_id/experts CASCADE |
| alliance_dictionaries | dict_type、code、name、(tenant,dict_type,code) 唯一（108 种子 8 类 40 条，122 英文码） |
| alliance_brands | brand_type(talent/employer/job/major/teacher/culture)、data jsonb、is_featured |
| alliance_brand_topics | layout(grid)、content_blocks jsonb |
| alliance_employment_projects | 就业项目（162 新建）：tenant_id(学校)、type(spring/autumn/directed/order/custom:文本)、organizer、cover_image（165 新增，landing/大厅封面大卡）、start/end_date、publish_status(draft/published；展示状态由日期派生不落库)、enterprise_ids jsonb、target_groups jsonb（[{orgNodeId?,majorId?,graduateYear?}] 组内 AND 组间 OR，空=全校；仅控制投递资格不控制浏览可见性） |
| alliance_employment_jobs | 企业岗位（162 新建）：tenant_id(学校)、enterprise_id→partner_enterprises CASCADE、project_id→employment_projects SET NULL（空=独立岗位不上大厅）、job_type(full-time/part-time/internship/apprentice)、salary_min/max(千元/月)、suitable_majors jsonb、status(draft/published/closed) |
| alliance_employment_applications | 学生投递（162 新建）：job_id CASCADE、enterprise_id 冗余、student_id→users CASCADE、档案快照列(name/student_no/major/class/phone/email)、cover_letter、status 固定 pending、(job_id,student_id) 唯一防重复 |

### 2.16 画像 / 汇聚 / 证书 / 毕业

| 表 | 关键字段 |
|----|---------|
| job_ability_results | (position_id,user_id) 唯一、achievement_rate（岗位能力加权平均分 0-100）、ability_cognition_score（认知得分 0-100）、position_competency（胜任度%，比值法，分母仅含 requiredLevel≠understand 的有门槛能力点）、position_competency_v2（胜任度新%，等级距离法）、grade、ability_point_details jsonb |
| job_ability_aggregate_logs | 聚合任务日志 running/finished |
| student_ability_portraits | user_id、content jsonb、version |
| student_ability_archives | user_id、material_type、audit_status、direction(positive/negative)、converted_credit（无 (user,position) 唯一约束） |
| micro_cert_templates | title、cert_type_id、cert_type_name、content、cover_image |
| cert_issuance_records | cert_number 唯一、(tenant,template,user) 唯一（114）、issue_date/expire_date、status(issued)、revoked_at |
| graduation_project_topics | source、status、capacity、advisor_id（enterprise_mentor_id 已于 154 删除） |
| graduation_project_archives | (topic_id,user_id) 唯一（111）、phase、doc_status、has_rectification |
| graduation_project_evaluations | advisor/enterprise/defense_score、comprehensive_grade、is_excellent |
| graduation_query_results | credit_completed/required、scene_passed/required、graduation_status、ability_cert_status |

### 2.17 资源 / 支撑 / 日志

| 表 | 关键字段 |
|----|---------|
| resource_library | resource_type ENUM(11 类)、url、metadata jsonb（无 (tenant,name) 唯一约束） |
| on_site_question_library | question_type(short_answer)、difficulty、knowledge_point_ids[] |
| resource_tags / resource_codes | tag_type/tag_value；code(tenant+code 唯一) |
| knowledge_points | code、linked、granular_lesson_ids[]、source_type/source_id(097) |
| learn_roads | position_ids[]、steps jsonb |
| evaluation_methods / evaluation_method_categories / evaluation_method_targets | category_id、enabled、doc_link；targets 无 tenant_id |
| appeal_records | type、reason、status(pending) |
| subscription_packages | tenant_id、valid_until、modules jsonb、status(active) |
| login_logs / operation_logs | tenant_id、user_id、ip、status、method/path(操作日志) |
| lesson_behavior_records | (course_id,student_id,date) 唯一、attendance(present)、quiz_score、interaction/praise/rush counts |
| announcements | target_roles[]、is_new |
| banner_configs / banners | title、image_url、is_enabled |
| favorite_counters / view_counters / view_logs | target_type+target_id 主键、cnt（无 tenant_id） |
| credit_conversion_rules | material_type、level、credit |
| platform_configs | key(unique)、value（**平台级，无 tenant_id**） |
| institutions / institution_expertise_tags | credit_code/org_code 唯一、status ENUM、balance |
| resources / orders / authorizations / withdrawals | 商城表（结构保留，无业务接口） |

---

### 2.18 124~160 增量新增表（补充登记，列名自迁移文件提取）

| 表 | 字段级定义（列名/类型/NOT NULL/默认/FK/唯一，自迁移文件提取） |
|---|---|
| certification_point_levels(124) | `id PK, tenant_id NOT NULL, career_position_id NOT NULL, ability_point_id NOT NULL, level_mapping jsonb NOT NULL DEFAULT '[]', created_at, updated_at`；(tenant_id, career_position_id, ability_point_id) 唯一索引 |
| community_topics(127) | `id, tenant_id NOT NULL, author_id NOT NULL, title varchar(128) NOT NULL, content text NOT NULL, tag varchar(32), reply_count int DEFAULT 0, created_at, updated_at` |
| community_replies(127) | `id, topic_id NOT NULL, author_id NOT NULL, parent_id, content text NOT NULL, created_at` |
| student_honors(129) | `id PK, tenant_id NOT NULL, user_id NOT NULL FK→users CASCADE, name varchar(128) NOT NULL, issuer DEFAULT '', honor_date varchar(32) DEFAULT '', file_name varchar(256), file_url varchar(512), created_at, updated_at` |
| user_favorites(129) | `id, user_id NOT NULL, target_type varchar(64) NOT NULL, target_id NOT NULL, created_at` |
| platform_settings(135) | `key text PK, value text NOT NULL DEFAULT '', updated_at` |
| tenant_settings(136) | `tenant_id NOT NULL, key NOT NULL, value text NOT NULL DEFAULT '', updated_at`；(tenant_id, key) 主键 |
| tags(137) | `id PK, tenant_id NOT NULL, name varchar(64) NOT NULL, color varchar(16) DEFAULT '#6366f1', created_at, updated_at`（标签管理实体，与 baseline 遗留 resource_tags 是两张表） |
| resource_tag_relations(137) | `id PK, tenant_id NOT NULL, tag_id NOT NULL FK→tags, resource_type varchar(32) NOT NULL, resource_id NOT NULL, created_at` |
| alliance_enterprise_links(142) | `id PK, tenant_id NOT NULL, enterprise_id NOT NULL FK→partner_enterprises, relation_type DEFAULT 'alliance', status DEFAULT 'negotiating', rating DEFAULT 'general', enterprise_type DEFAULT 'cooperation', is_public boolean DEFAULT false, secondary_colleges jsonb DEFAULT '[]', created_by, created_at, updated_at`；(tenant_id, enterprise_id) 唯一 |
| alliance_resource_grants(146) | `id PK, tenant_id NOT NULL, enterprise_id NOT NULL FK→partner_enterprises, resource_type(position|scene) NOT NULL, resource_ids uuid[] DEFAULT '{}', created_by, created_at, updated_at`；(tenant_id, enterprise_id, resource_type) 唯一 |
| job_run_logs(147) | `id PK, job_name NOT NULL, started_at, finished_at, status DEFAULT 'running', rows_affected bigint DEFAULT 0, error` |
| brand_major_rank_configs(153) | `id PK, tenant_id NOT NULL, major_id NOT NULL, enabled DEFAULT true, rank_limit DEFAULT 10, created_at, updated_at` |
| resource_snapshots(158) | `id PK, tenant_id NOT NULL, resource_type NOT NULL, resource_id NOT NULL, version varchar(32) NOT NULL, snapshot_data jsonb NOT NULL, created_at`（无 FK，版本机制见 resource-snapshot-versioning.md） |

> 上述为 124~160 新增/结构性扩展的表；124~160 中仅加列/索引/回填的迁移见 §5 变更记录。partner_enterprises（142，全局企业主体）见 partner-enterprise-platform.md §4.2；alliance_expert_mentor_links（142）已于 154 废弃删除，不登记。

## 3. 租户隔离说明

- **绝大多数业务表带 `tenant_id`**（多为可空列 + 索引；FK 级联仅覆盖 140 治理后的增量表——001 baseline 的 46 张业务表 `tenant_id` 无 FK，隔离依赖 SQL 层 `tenant_id` 条件 + service 层归属校验，见 ADR-0003）：所有业务实体（岗位/课程/场景/题库/试卷/批次/联盟/教务/资源…）；全库表数以本文档头部（当前 153 张）为准。
- **少数表无 `tenant_id`**，分三类：
  1. **平台级公共表**：`platform_configs`（全局 KV）、`tenants`（本身）
  2. **计数器**：`favorite_counters`、`view_counters`（按 target_type+target_id 聚合，跨租户无妨）
  3. **依赖父表隔离的纯关联/派生表**：`career_position_majors`、`position_favorites`、`user_roles`、`evaluation_method_targets`、`question_bank_knowledge_points`、`node_ability_point_bindings`、`node_knowledge_point_bindings`、`teaching_plan_entries`(+`teaching_plan_entry_classes`)、`training_program_courses`、`certification_grade_data`(+`competency_requirements`+`grade_leaderboard`)
- **行级隔离**（非库级）：数据访问层 SQL 统一带 `tenant_id` 条件；写操作另做租户归属校验（ADR-0003）
- **唯一性**：`(tenant_id, code/name)` 复合唯一索引 20+ 个（courses/exams/scenarios/question_banks/career_positions/majors/industries/certificate_library 等）
- **级联治理**（115/116）：可空业务引用（教师/评分人）→ SET NULL；NOT NULL 学生归属 → CASCADE；增量表 tenant 引用 → CASCADE（保证删租户不阻塞）；001 baseline 表 `tenant_id` 多无 FK（显式 SQL 过滤隔离）

---

## 4. 数据字典

### 4.1 原生 PG ENUM（7 个）

| 类型 | 值 |
|------|-----|
| user_role | school / enterprise / operator |
| institution_status | pending / approved / disabled |
| institution_type | school / enterprise |
| order_status | pending / paid / cancelled / refunded |
| resource_status | draft / reviewing / rejected / pending_publish / published / offlined |
| resource_type | document / spreadsheet / image / link / audio / video / archive / venue / facility / software / other |
| withdrawal_status | pending / approved / paid / rejected |

### 4.2 内容统一状态机（CHECK 六态，岗位/场景/课程/题库/试卷）

`draft`（草稿）→ `pending`（待审批）→ `approved`（已批准）→ `rejected`（已驳回）→ `published`（已发布）→ `archived`（已归档）

> 人培方案（training_programs）与教学计划（teaching_plans）**不适用六态**：前者 `draft/published`、后者 `draft/confirmed`（见 §2.14）；题目（exam_questions）随题库/试卷整体流转，不单独走状态机。三者与 5 类版本化实体同列 `AllowedContentTables` 白名单，共享提交/发布/归档等统一动作表名校验。

### 4.3 varchar 状态/枚举（代码层字典）

| 字段 | 值 |
|------|-----|
| tenants/roles/staff_titles/subscription_packages.status | active / inactive |
| batches 五套.status | open / closed |
| approval_records / appeal_records / 评价结果.status | pending / approved / rejected |
| course/node/scene_homework_submissions.status | submitted |
| exam_usages.status | draft / published / finished（133 归一，in_progress 并入 published） |
| rubric_templates.mode | rubric / score_rule |
| position_ability_bindings.weight / scenario_weight_configs.weight | 0-100 |
| scenarios/scenario_tasks.difficulty | 1-5 |
| user_extension_fields.slot_number | 1-20 |
| student_ability_archives.direction | positive / negative |
| lesson_behavior_records.attendance | present 等 |
| certification_ability_points.mapping_type | inherit / custom |
| training_program_courses.nature | 必修 / 选修 / 实践 / 场景 |
| teaching_plan_entries.type | theory / practice / scene |
| schedule_entries.type / source | traditional / scene；manual / imported |
| alliance_enterprise_links.status | negotiating / active / paused / terminated |
| alliance_agreements.status | draft / active / expired / renewed / terminated |
| alliance_experts.rating | copper / silver / gold |
| alliance_achievements.type | job / scene / course / custom |
| alliance_dictionaries（122 英文码） | cooperation_type: talent_training/internship/tech_rd/course_co_build/teacher_training/employment 等 8 类 |
| alliance_employment_projects.type / publish_status | spring / autumn / directed / order / custom:<文本>；draft / published |
| alliance_employment_jobs.job_type / status | full-time / part-time / internship / apprentice；draft / published / closed |
| alliance_employment_applications.status | pending（本期固定，预留 viewed/interview/offer/hired/rejected 流转） |

### 4.4 软删除策略

- **全库仅 1 张表软删除**：`rubric_templates.is_deleted boolean DEFAULT false`（量规模板可被任务引用，需保留数据；123 迁移后任务已独立复制标准数据，机制保留）
- **其余全部物理删除**，依赖外键 CASCADE 清理子表
- 无 `deleted_at` 时间戳模式

---

## 5. 变更记录

| 迁移 | 内容 | 说明 |
|------|------|------|
| 001_baseline | 109 张表全量基线 | 含约束/索引/种子角色 |
| 091 | certification_weights | 认证两级权重 |
| 092 | affairs 基础表 | terms/training_programs/venues/period_slots |
| 093 | courses.eval_data | 课程评价数据 |
| 094 | course_homeworks + schedule_entries.course_id | 课程作业表/排课关联课程 |
| 095 | course_evaluation_results + courses.ability_point_ids | 课程级评价/能力点 |
| 096 | course_homework_submissions | 课程作业提交 |
| 097 | knowledge_points.source + node_evaluation_results + 教务课程 | 知识点来源/节点评价 |
| 098 | node_homework_submissions | 节点作业提交 |
| 099 | certificate_library.updated_at | 证书库时间戳 |
| 100 | scene_eval_unique_tenant | 场景评价唯一约束 |
| 101 | alliance_brand + teaching_plan_entry_classes | 品牌表/多班级 |
| 102 | program_course_position | 人培课程关联岗位 |
| 103 | alliance_enrich | 联盟表扩展 |
| 104 | program_content_mgmt + tenant_school_fields | 方案内容/租户字段 |
| 105 | tenant_education_fields | 租户教育属性 |
| 106 | affairs_batches | 教务批次 |
| 107 | alliance_relations + schedule_multi_class | 联盟关联/多班级排课 |
| 108 | alliance_dict_seed | 联盟字典种子 8 类 40 条 |
| 109 | alliance_agreement_project_ids | 协议关联项目 |
| 110 | remove_platform_links | **删除** app_modules/platform_links |
| 111 | graduation_archive_unique | 毕设归档唯一 |
| 112 | approval_pending_unique | 审批 pending 部分唯一 |
| 113 | exam_questions_unique | 试卷题目唯一 |
| 114 | cert_issuance_unique | 发证记录唯一 |
| 115/116 | tenant/user 外键级联治理 | CASCADE/SET NULL 系统化 |
| 117 | question_banks_permissions | 题库权限 |
| 118 | workspace_indexes | 工作台索引 |
| 119 | evaluation_config_indexes | 评价配置索引 |
| 120 | ability_point_codes | 能力点 NL 编码回填 |
| 121 | task_eval_exam_to_homework | exam→homework 评价归并 |
| 122 | alliance_dict_english_codes | 联盟字典英文码 |
| 123 | eval_standard_copy | 量规标准复制到任务侧 |
| 124 | certification_point_levels | 能力点五档分数线配置（每能力点独立） |
| 125 | job_ability_results 指标扩展 | ability_cognition_score（0-100）+ position_competency（胜任度） |
| 126 | job_ability_results 指标扩展 | 岗位胜任度等新指标 |
| 127 | community_topics/community_replies | 学习社区帖子与回复 |
| 128 | 知识点/能力点编码回填 | 存量无编码行生成 NL 编码 |
| 129 | student_honors + user_favorites | 学生荣誉记录 + 通用收藏（场景/课程/题库/试卷） |
| 130 | ability_points.category 并入 attributes | 能力点类别标签化 |
| 131 | 行业字典种子 | GB/T 4754 行业分类种子 |
| 132 | exam_results 评分字段扩展 | 日常考试教师评分字段 |
| 133 | exam_usages 启用条件列 | 考试统一生命周期与状态归一 |
| 134 | period_slots 时段类型 | 早自习/上午等时段类型 |
| 135 | platform_settings | 平台级键值配置（主题色等） |
| 136 | tenant_settings | 租户级键值配置（租户主题色等） |
| 137 | tags + resource_tag_relations | 标签管理 + 资源标签多对多绑定 |
| 138 | teaching_plans 通用内容架构 | 批次绑定等内容管理接入 |
| 139 | 引用统计/零引用查询支撑 | CitationStats/ListUncited |
| 140 | 增量迁移索引补齐 | 091~137 增量新表的索引补建 |
| 141 | lesson_batches.status 默认值 | DB 默认值从 'active' 改为 'open'（对齐后端 open/closed 两态） |
| 142 | alliance_enterprise_links + 专家企业外键 | 企业平台阶段一底座 |
| 143 | 任务级企业导入标记 | 企业平台阶段二 |
| 144 | alliance_agreements 前台显示开关 | 公开展示列 |
| 145 | 企业共建来源标记 | career_positions/scenarios 来源列 |
| 146 | alliance_resource_grants | 学校-企业资源授权 + 专家账号 |
| 147 | job_run_logs | 任务运行日志 |
| 148 | tenant_validity | 租户有效期治理 |
| 149 | 版本号格式统一 | 版本号归一 |
| 150 | 企业注册默认公开开关 | 服务端默认值调整 |
| 151 | 联盟字典补齐回填 | 108 之外的租户回填 |
| 152 | 订阅 AI token 额度 | 套餐配置增加 AI 额度 |
| 153 | brand_major_rank_configs + 菜单权限回填 | 人才品牌排名启用配置 |
| 154 | 删除 alliance_expert_mentor_links | 移除共建导师影子账号体系 |
| 155 | 清理影子账号遗留数据 | 旧导师账号数据清理（down 不可逆） |
| 156 | 岗位类型语义调整 | /job/positions 岗位库口径 |
| 157 | resource_creator_retain | 用户删除后保留其创建的资源 |
| 158 | resource_snapshots | 资源快照与版本固化（快照无 FK，见 resource-snapshot-versioning.md） |
| 159 | 临时考试状态统一 published | 统一临时考试状态 |
| 160 | users.password_changed_at | 改密时间戳（改密后旧 token 失效，鉴权中间件逐请求校验） |
| 161 | alliance_dict_code_unify | 联盟字典编码统一：删 151 回插的中文码重复行（cooperation/agreement/project 三类型），种子 SQL 改英文码 |
| 162 | alliance_employment | 就业服务三表：employment_projects/employment_jobs/employment_applications（down 不可逆：DROP 丢业务数据） |
| 163 | employment_menu_default | 存量租户 teacher 角色 menus 回填就业服务管理两路径（/portal/apps/alliance/employmentproject、/employmentjob） |
| 165 | alliance_employment_project_cover | 就业项目加 cover_image（landing 供需大厅封面大卡 + 管理端封面编辑） |
| 166 | ai_center_menu_perms | AI 中心菜单权限回填（历史迁移，随 AI 功能 2026-08 下线不再生效） |
| 167 | ai_landing_menu_default | AI 前台落地页菜单回填（历史迁移，随 AI 功能下线不再生效） |
| 168 | ai_menu_single_entry | AI 菜单收敛单一开关（历史迁移，随 AI 功能下线不再生效） |

> 每份迁移均配对 `.down.sql`（除 001 baseline 为全量重建）。变更脚本位于 `db/migrations/`。
