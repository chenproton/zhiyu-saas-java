-- Baseline migration: schema snapshot from 2026-07-29
-- Contains all tables, types, indexes, and constraints from migrations 001-091

-- ENUM 类型已转为列级 ENUM（MySQL）
-- ENUM 类型已转为列级 ENUM（MySQL）
-- ENUM 类型已转为列级 ENUM（MySQL）
-- ENUM 类型已转为列级 ENUM（MySQL）
-- ENUM 类型已转为列级 ENUM（MySQL）
-- ENUM 类型已转为列级 ENUM（MySQL）
-- ENUM 类型已转为列级 ENUM（MySQL）
CREATE TABLE ability_domains (
    id CHAR(36) DEFAULT (UUID()) NOT NULL,
    career_position_id CHAR(36) NOT NULL,
    name VARCHAR(128) NOT NULL,
    description LONGTEXT,
    binding_ids JSON DEFAULT (JSON_ARRAY()) NOT NULL,
    sort_order INT DEFAULT 0 NOT NULL,
    tenant_id CHAR(36)
);
CREATE TABLE ability_points (
    id CHAR(36) DEFAULT (UUID()) NOT NULL,
    name VARCHAR(256) NOT NULL,
    description LONGTEXT,
    category VARCHAR(16) NOT NULL,
    is_public TINYINT(1) DEFAULT 0 NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    tenant_id CHAR(36),
    code VARCHAR(64),
    attributes JSON DEFAULT (JSON_ARRAY()) NOT NULL,
    creator_id CHAR(36)
);
CREATE TABLE announcements (
    id CHAR(36) DEFAULT (UUID()) NOT NULL,
    title VARCHAR(256) NOT NULL,
    type VARCHAR(16) DEFAULT '通知' NOT NULL,
    target_roles JSON DEFAULT (JSON_ARRAY()) NOT NULL,
    is_new TINYINT(1) DEFAULT 0 NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    tenant_id CHAR(36)
);
CREATE TABLE app_modules (
    id CHAR(36) DEFAULT (UUID()) NOT NULL,
    platform VARCHAR(64) NOT NULL,
    title VARCHAR(128) NOT NULL,
    description LONGTEXT,
    href LONGTEXT,
    sort_order INT DEFAULT 0 NOT NULL,
    tenant_id CHAR(36)
);
CREATE TABLE appeal_records (
    id CHAR(36) DEFAULT (UUID()) NOT NULL,
    user_id CHAR(36) NOT NULL,
    type VARCHAR(16) NOT NULL,
    reason LONGTEXT NOT NULL,
    status VARCHAR(16) DEFAULT 'pending' NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    tenant_id CHAR(36),
    remark LONGTEXT,
    updated_at DATETIME
);
CREATE TABLE approval_records (
    id CHAR(36) DEFAULT (UUID()) NOT NULL,
    tenant_id CHAR(36),
    target_type VARCHAR(32) NOT NULL,
    target_id CHAR(36) NOT NULL,
    workflow_id CHAR(36),
    current_step_idx INT DEFAULT 0 NOT NULL,
    status VARCHAR(16) DEFAULT 'pending' NOT NULL,
    submitter_id CHAR(36) NOT NULL,
    history JSON DEFAULT (JSON_ARRAY()) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE TABLE authorizations (
    auth_code VARCHAR(100) NOT NULL,
    status INT DEFAULT 1 NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    tenant_id CHAR(36),
    id CHAR(36) DEFAULT (UUID()) NOT NULL,
    order_id CHAR(36),
    buyer_id CHAR(36),
    resource_id CHAR(36)
);
CREATE TABLE banner_configs (
    id CHAR(36) DEFAULT (UUID()) NOT NULL,
    title VARCHAR(256) NOT NULL,
    image_url LONGTEXT NOT NULL,
    link_url LONGTEXT,
    sort_order INT DEFAULT 0 NOT NULL,
    is_enabled TINYINT(1) DEFAULT 1 NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    tenant_id CHAR(36)
);
CREATE TABLE banners (
    title VARCHAR(255) NOT NULL,
    image VARCHAR(500) NOT NULL,
    link VARCHAR(500),
    sort INT DEFAULT 0 NOT NULL,
    enabled TINYINT(1) DEFAULT 1 NOT NULL,
    tenant_id CHAR(36),
    id CHAR(36) DEFAULT (UUID()) NOT NULL
);
CREATE TABLE batches (
    id CHAR(36) DEFAULT (UUID()) NOT NULL,
    name VARCHAR(128) NOT NULL,
    code VARCHAR(64),
    org_node_id CHAR(36),
    workflow_id CHAR(36),
    status VARCHAR(16) DEFAULT 'open' NOT NULL,
    position_count INT DEFAULT 0 NOT NULL,
    published_count INT DEFAULT 0 NOT NULL,
    pending_count INT DEFAULT 0 NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    tenant_id CHAR(36),
    major_id CHAR(36)
);
CREATE TABLE career_position_majors (
    id CHAR(36) DEFAULT (UUID()) NOT NULL,
    career_position_id CHAR(36) NOT NULL,
    major_id CHAR(36) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE TABLE career_positions (
    id CHAR(36) DEFAULT (UUID()) NOT NULL,
    batch_id CHAR(36),
    name VARCHAR(128) NOT NULL,
    short_name VARCHAR(64),
    industry_id CHAR(36),
    position_type VARCHAR(16) NOT NULL,
    salary_min INT,
    salary_max INT,
    cover_image LONGTEXT,
    description LONGTEXT,
    requirements JSON DEFAULT (JSON_ARRAY()) NOT NULL,
    career_path LONGTEXT,
    version VARCHAR(32) NOT NULL,
    status VARCHAR(16) NOT NULL,
    created_by CHAR(36) NOT NULL,
    collaborators JSON DEFAULT (JSON_ARRAY()) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    tenant_id CHAR(36),
    view_count INT DEFAULT 0 NOT NULL,
    code VARCHAR(64) NOT NULL,
    CONSTRAINT chk_career_positions_status CHECK (status IN ('draft', 'pending', 'approved', 'rejected', 'published', 'archived'))
);
CREATE TABLE cert_issuance_records (
    id CHAR(36) DEFAULT (UUID()) NOT NULL,
    template_id CHAR(36) NOT NULL,
    user_id CHAR(36) NOT NULL,
    cert_number VARCHAR(128) NOT NULL,
    issue_date date NOT NULL,
    expire_date date,
    status VARCHAR(16) DEFAULT 'issued' NOT NULL,
    revoked_at DATETIME,
    revoke_reason LONGTEXT,
    tenant_id CHAR(36)
);
CREATE TABLE certificate_library (
    id CHAR(36) DEFAULT (UUID()) NOT NULL,
    tenant_id CHAR(36) NOT NULL,
    name VARCHAR(128) NOT NULL,
    url LONGTEXT,
    description LONGTEXT,
    image_url LONGTEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    creator_id CHAR(36)
);
CREATE TABLE certification_ability_items (
    id CHAR(36) DEFAULT (UUID()) NOT NULL,
    rule_id CHAR(36) NOT NULL,
    name VARCHAR(256) NOT NULL,
    sort_order INT DEFAULT 0 NOT NULL,
    tenant_id CHAR(36)
);
CREATE TABLE certification_ability_points (
    id CHAR(36) DEFAULT (UUID()) NOT NULL,
    item_id CHAR(36) NOT NULL,
    ability_point_id CHAR(36) NOT NULL,
    mapping_type VARCHAR(16) DEFAULT 'inherit' NOT NULL,
    custom_level_mapping JSON DEFAULT (JSON_ARRAY()),
    required_level VARCHAR(16) NOT NULL,
    weight DECIMAL(5,2) DEFAULT 0 NOT NULL,
    tenant_id CHAR(36)
);
CREATE TABLE certification_competency_requirements (
    id CHAR(36) DEFAULT (UUID()) NOT NULL,
    grade_data_id CHAR(36) NOT NULL,
    duty_name VARCHAR(256) NOT NULL,
    item_name VARCHAR(256) NOT NULL,
    target_level INT NOT NULL,
    current_level INT DEFAULT 1 NOT NULL,
    description LONGTEXT,
    sort_order INT DEFAULT 0 NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE TABLE certification_grade_data (
    id CHAR(36) DEFAULT (UUID()) NOT NULL,
    position_id CHAR(36) NOT NULL,
    grade_year INT NOT NULL,
    total_ability_points INT DEFAULT 0 NOT NULL,
    avg_achievement_rate DECIMAL(5,2),
    last_updated DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE TABLE certification_grade_leaderboard (
    id CHAR(36) DEFAULT (UUID()) NOT NULL,
    grade_data_id CHAR(36) NOT NULL,
    user_id CHAR(36) NOT NULL,
    student_name VARCHAR(128) NOT NULL,
    class_name VARCHAR(128),
    achievement_rate DECIMAL(5,2),
    grade_label VARCHAR(4),
    sort_order INT DEFAULT 0 NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    major_id CHAR(36)
);
CREATE TABLE certification_related_tasks (
    id CHAR(36) DEFAULT (UUID()) NOT NULL,
    cert_point_id CHAR(36) NOT NULL,
    task_id CHAR(36) NOT NULL,
    max_score DECIMAL(7,2) DEFAULT 100 NOT NULL,
    weight DECIMAL(5,2) DEFAULT 0 NOT NULL,
    tenant_id CHAR(36)
);
CREATE TABLE certification_rules (
    id CHAR(36) DEFAULT (UUID()) NOT NULL,
    career_position_id CHAR(36) NOT NULL,
    status VARCHAR(16) NOT NULL,
    rule_source VARCHAR(16) DEFAULT 'custom' NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    tenant_id CHAR(36),
    level_mapping JSON DEFAULT (JSON_ARRAY()) NOT NULL
);
CREATE TABLE course_knowledge_bindings (
    id CHAR(36) DEFAULT (UUID()) NOT NULL,
    course_id CHAR(36) NOT NULL,
    knowledge_point_id CHAR(36) NOT NULL,
    bind_type VARCHAR(16) NOT NULL,
    source_id CHAR(36),
    tenant_id CHAR(36)
);
CREATE TABLE course_resource_bindings (
    id CHAR(36) DEFAULT (UUID()) NOT NULL,
    tenant_id CHAR(36) NOT NULL,
    course_id CHAR(36) NOT NULL,
    resource_id CHAR(36) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE TABLE courses (
    id CHAR(36) DEFAULT (UUID()) NOT NULL,
    code VARCHAR(64) NOT NULL,
    name VARCHAR(256) NOT NULL,
    type VARCHAR(16) NOT NULL,
    category VARCHAR(32) NOT NULL,
    teacher_id CHAR(36),
    version VARCHAR(32),
    online_hours DECIMAL(5,1),
    offline_hours DECIMAL(5,1),
    online_weight DECIMAL(5,2),
    offline_weight DECIMAL(5,2),
    semester VARCHAR(32),
    class_name VARCHAR(128),
    status VARCHAR(16) NOT NULL,
    cover_color VARCHAR(16),
    cover_image LONGTEXT,
    course_tag VARCHAR(64),
    creator_id CHAR(36) NOT NULL,
    co_creator_ids JSON DEFAULT (JSON_ARRAY()) NOT NULL,
    node_count INT DEFAULT 0 NOT NULL,
    resource_count INT DEFAULT 0 NOT NULL,
    study_count INT DEFAULT 0 NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    tenant_id CHAR(36),
    major_id CHAR(36),
    industry_id CHAR(36),
    batch_id CHAR(36),
    difficulty INT,
    description LONGTEXT,
    knowledge_point_ids JSON DEFAULT (JSON_ARRAY()) NOT NULL,
    resource_ids JSON DEFAULT (JSON_ARRAY()) NOT NULL,
    CONSTRAINT chk_courses_status CHECK (status IN ('draft', 'pending', 'approved', 'rejected', 'published', 'archived'))
);
CREATE TABLE credit_conversion_rules (
    id CHAR(36) DEFAULT (UUID()) NOT NULL,
    material_type VARCHAR(16) NOT NULL,
    level VARCHAR(32) NOT NULL,
    credit DECIMAL(5,1) NOT NULL,
    tenant_id CHAR(36)
);
CREATE TABLE evaluation_batches (
    id CHAR(36) DEFAULT (UUID()) NOT NULL,
    name VARCHAR(128) NOT NULL,
    code VARCHAR(64),
    org_node_id CHAR(36),
    workflow_id CHAR(36),
    status VARCHAR(16) DEFAULT 'open' NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    tenant_id CHAR(36),
    major_id CHAR(36)
);
CREATE TABLE evaluation_method_categories (
    id CHAR(36) DEFAULT (UUID()) NOT NULL,
    name VARCHAR(64) NOT NULL,
    sort_order INT DEFAULT 0 NOT NULL,
    tenant_id CHAR(36)
);
CREATE TABLE evaluation_method_targets (
    id CHAR(36) DEFAULT (UUID()) NOT NULL,
    evaluation_method_id CHAR(36) NOT NULL,
    target_id CHAR(36) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE TABLE evaluation_methods (
    id CHAR(36) DEFAULT (UUID()) NOT NULL,
    category_id CHAR(36) NOT NULL,
    name VARCHAR(128) NOT NULL,
    enabled TINYINT(1) DEFAULT 1 NOT NULL,
    sub_category_name VARCHAR(128),
    description LONGTEXT,
    doc_link LONGTEXT,
    tenant_id CHAR(36)
);
CREATE TABLE exam_questions (
    id CHAR(36) DEFAULT (UUID()) NOT NULL,
    exam_id CHAR(36) NOT NULL,
    question_id CHAR(36) NOT NULL,
    type VARCHAR(16) NOT NULL,
    content LONGTEXT NOT NULL,
    options JSON,
    answer LONGTEXT NOT NULL,
    analysis LONGTEXT,
    score DECIMAL(5,2) NOT NULL,
    sort_order INT DEFAULT 0 NOT NULL,
    tenant_id CHAR(36)
);
CREATE TABLE exam_results (
    id CHAR(36) DEFAULT (UUID()) NOT NULL,
    exam_usage_id CHAR(36) NOT NULL,
    user_id CHAR(36) NOT NULL,
    student_name VARCHAR(128),
    class_name VARCHAR(128),
    grade VARCHAR(64),
    score DECIMAL(7,2) DEFAULT 0 NOT NULL,
    total_score DECIMAL(7,2) DEFAULT 0 NOT NULL,
    is_pass TINYINT(1) DEFAULT 0 NOT NULL,
    answers JSON DEFAULT (JSON_OBJECT()) NOT NULL,
    submit_time DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    tenant_id CHAR(36),
    major_id CHAR(36),
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE TABLE exam_usages (
    id CHAR(36) DEFAULT (UUID()) NOT NULL,
    exam_id CHAR(36) NOT NULL,
    name VARCHAR(256) NOT NULL,
    description LONGTEXT,
    start_time DATETIME,
    end_time DATETIME,
    duration INT,
    target_type VARCHAR(16),
    target_ids JSON DEFAULT (JSON_ARRAY()) NOT NULL,
    status VARCHAR(16) DEFAULT 'draft' NOT NULL,
    creator_id CHAR(36),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    tenant_id CHAR(36),
    major_id CHAR(36)
);
CREATE TABLE exams (
    id CHAR(36) DEFAULT (UUID()) NOT NULL,
    name VARCHAR(256) NOT NULL,
    description LONGTEXT,
    status VARCHAR(16) NOT NULL,
    total_score DECIMAL(7,2) DEFAULT 0 NOT NULL,
    duration INT NOT NULL,
    cover_image LONGTEXT,
    creator_id CHAR(36),
    collaborator_ids JSON DEFAULT (JSON_ARRAY()) NOT NULL,
    batch_id CHAR(36),
    version VARCHAR(32),
    owner_type VARCHAR(16) DEFAULT 'mine' NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    collaborator_dept_ids JSON DEFAULT (JSON_ARRAY()) NOT NULL,
    tenant_id CHAR(36),
    is_temp TINYINT(1) DEFAULT 0 NOT NULL,
    code VARCHAR(64) NOT NULL,
    CONSTRAINT chk_exams_status CHECK (status IN ('draft', 'pending', 'approved', 'rejected', 'published', 'archived'))
);
CREATE TABLE favorite_counters (
    target_type VARCHAR(64) DEFAULT 'career_position' NOT NULL,
    target_id CHAR(36) NOT NULL,
    cnt bigint DEFAULT 0 NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE graduation_project_archives (
    id CHAR(36) DEFAULT (UUID()) NOT NULL,
    topic_id CHAR(36) NOT NULL,
    user_id CHAR(36) NOT NULL,
    phase VARCHAR(16) NOT NULL,
    doc_status VARCHAR(16) NOT NULL,
    doc_count INT DEFAULT 0 NOT NULL,
    has_rectification TINYINT(1) DEFAULT 0 NOT NULL,
    last_updated DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    tenant_id CHAR(36)
);
CREATE TABLE graduation_project_evaluations (
    id CHAR(36) DEFAULT (UUID()) NOT NULL,
    topic_id CHAR(36) NOT NULL,
    user_id CHAR(36) NOT NULL,
    advisor_score DECIMAL(5,2),
    enterprise_score DECIMAL(5,2),
    defense_score DECIMAL(5,2),
    comprehensive_grade VARCHAR(4),
    is_excellent TINYINT(1) DEFAULT 0 NOT NULL,
    status VARCHAR(16) DEFAULT 'pending' NOT NULL,
    evaluated_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    tenant_id CHAR(36)
);
CREATE TABLE graduation_project_topics (
    id CHAR(36) DEFAULT (UUID()) NOT NULL,
    name VARCHAR(256) NOT NULL,
    career_position_id CHAR(36) NOT NULL,
    college VARCHAR(128),
    source VARCHAR(16) NOT NULL,
    status VARCHAR(16) NOT NULL,
    capacity INT DEFAULT 0 NOT NULL,
    applied_count INT DEFAULT 0 NOT NULL,
    advisor_id CHAR(36),
    enterprise_mentor_id CHAR(36),
    start_date date,
    end_date date,
    description LONGTEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    tenant_id CHAR(36)
);
CREATE TABLE graduation_query_results (
    id CHAR(36) DEFAULT (UUID()) NOT NULL,
    user_id CHAR(36) NOT NULL,
    class_name VARCHAR(128),
    credit_completed DECIMAL(6,1) DEFAULT 0 NOT NULL,
    credit_required DECIMAL(6,1) DEFAULT 0 NOT NULL,
    scene_passed INT DEFAULT 0 NOT NULL,
    scene_required INT DEFAULT 0 NOT NULL,
    project_grade VARCHAR(4),
    graduation_status VARCHAR(16) NOT NULL,
    ability_cert_status VARCHAR(16) NOT NULL,
    rectification_count INT DEFAULT 0 NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    tenant_id CHAR(36),
    major_id CHAR(36)
);
CREATE TABLE hybrid_node_modules (
    id CHAR(36) DEFAULT (UUID()) NOT NULL,
    node_id CHAR(36) NOT NULL,
    module_key VARCHAR(32) NOT NULL,
    mode VARCHAR(8) DEFAULT 'online' NOT NULL,
    data JSON DEFAULT (JSON_OBJECT()) NOT NULL,
    tenant_id CHAR(36)
);
CREATE TABLE industries (
    id CHAR(36) DEFAULT (UUID()) NOT NULL,
    tenant_id CHAR(36) NOT NULL,
    code VARCHAR(64) NOT NULL,
    name VARCHAR(128) NOT NULL,
    parent_id CHAR(36),
    enabled TINYINT(1) DEFAULT 1 NOT NULL,
    sort_order INT DEFAULT 0 NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE TABLE institution_expertise_tags (
    id VARCHAR(50) NOT NULL,
    tag_value VARCHAR(100) NOT NULL,
    tenant_id CHAR(36),
    institution_id CHAR(36)
);
CREATE TABLE institutions (
    type ENUM('school','enterprise') NOT NULL,
    name VARCHAR(255) NOT NULL,
    credit_code VARCHAR(50) NOT NULL,
    logo VARCHAR(500),
    intro LONGTEXT,
    contact_name VARCHAR(100) NOT NULL,
    contact_phone VARCHAR(50) NOT NULL,
    contact_email VARCHAR(255) NOT NULL,
    qualification_file VARCHAR(500),
    status ENUM('pending','approved','disabled') DEFAULT 'pending' NOT NULL,
    org_code VARCHAR(50) NOT NULL,
    balance DECIMAL(15,2) DEFAULT 0 NOT NULL,
    total_spent DECIMAL(15,2) DEFAULT 0 NOT NULL,
    total_income DECIMAL(15,2) DEFAULT 0 NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    tenant_id CHAR(36),
    id CHAR(36) DEFAULT (UUID()) NOT NULL
);
CREATE TABLE job_ability_aggregate_logs (
    id CHAR(36) DEFAULT (UUID()) NOT NULL,
    tenant_id CHAR(36),
    career_position_id CHAR(36),
    status VARCHAR(16) DEFAULT 'running' NOT NULL,
    student_count INT DEFAULT 0 NOT NULL,
    updated_count INT DEFAULT 0 NOT NULL,
    error_message LONGTEXT,
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    finished_at DATETIME
);
CREATE TABLE job_ability_results (
    id CHAR(36) DEFAULT (UUID()) NOT NULL,
    career_position_id CHAR(36) NOT NULL,
    user_id CHAR(36) NOT NULL,
    class_name VARCHAR(128),
    total_ability_points INT DEFAULT 0 NOT NULL,
    achieved_ability_points INT DEFAULT 0 NOT NULL,
    achievement_rate DECIMAL(5,2),
    grade VARCHAR(16),
    evaluated_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    tenant_id CHAR(36),
    major_id CHAR(36),
    major_name VARCHAR(128),
    ability_point_details JSON DEFAULT (JSON_ARRAY()) NOT NULL,
    grade_history JSON DEFAULT (JSON_ARRAY()) NOT NULL
);
CREATE TABLE knowledge_points (
    id CHAR(36) DEFAULT (UUID()) NOT NULL,
    name VARCHAR(256) NOT NULL,
    code VARCHAR(64),
    description LONGTEXT,
    linked TINYINT(1) DEFAULT 0 NOT NULL,
    granular_lesson_ids JSON DEFAULT (JSON_ARRAY()) NOT NULL,
    creator_id CHAR(36),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    tenant_id CHAR(36),
    category VARCHAR(64)
);
CREATE TABLE learn_roads (
    id CHAR(36) DEFAULT (UUID()) NOT NULL,
    name VARCHAR(256) NOT NULL,
    description LONGTEXT,
    position_ids JSON DEFAULT (JSON_ARRAY()) NOT NULL,
    steps JSON DEFAULT (JSON_ARRAY()),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    tenant_id CHAR(36)
);
CREATE TABLE lesson_batches (
    id CHAR(36) DEFAULT (UUID()) NOT NULL,
    name VARCHAR(128) NOT NULL,
    code VARCHAR(64),
    org_node_id CHAR(36),
    workflow_id CHAR(36),
    status VARCHAR(16) DEFAULT 'active' NOT NULL,
    course_count INT DEFAULT 0 NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    tenant_id CHAR(36),
    major_id CHAR(36)
);
CREATE TABLE lesson_behavior_records (
    id CHAR(36) DEFAULT (UUID()) NOT NULL,
    course_id CHAR(36) NOT NULL,
    student_user_id CHAR(36) NOT NULL,
    record_date date DEFAULT (CURRENT_DATE) NOT NULL,
    attendance VARCHAR(16) DEFAULT 'present' NOT NULL,
    quiz_score DECIMAL(5,2),
    interaction_count INT DEFAULT 0 NOT NULL,
    praise_count INT DEFAULT 0 NOT NULL,
    rush_correct_count INT DEFAULT 0 NOT NULL,
    rush_avg_time_sec INT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    tenant_id CHAR(36)
);
CREATE TABLE login_logs (
    id CHAR(36) DEFAULT (UUID()) NOT NULL,
    tenant_id CHAR(36) NOT NULL,
    user_id CHAR(36),
    user_name VARCHAR(64),
    ip VARCHAR(45),
    location VARCHAR(128),
    device VARCHAR(256),
    status VARCHAR(16),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE TABLE majors (
    id CHAR(36) DEFAULT (UUID()) NOT NULL,
    tenant_id CHAR(36) NOT NULL,
    code VARCHAR(64) NOT NULL,
    name VARCHAR(128) NOT NULL,
    alias VARCHAR(128),
    enabled TINYINT(1) DEFAULT 1 NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE TABLE micro_cert_templates (
    id CHAR(36) DEFAULT (UUID()) NOT NULL,
    title VARCHAR(256) NOT NULL,
    cert_type_id CHAR(36) NOT NULL,
    cert_type_name VARCHAR(128),
    content LONGTEXT,
    cover_image LONGTEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    tenant_id CHAR(36)
);
CREATE TABLE node_ability_point_bindings (
    node_id CHAR(36) NOT NULL,
    ability_point_id CHAR(36) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE TABLE node_homeworks (
    id CHAR(36) DEFAULT (UUID()) NOT NULL,
    node_id CHAR(36) NOT NULL,
    title VARCHAR(256) NOT NULL,
    requirement LONGTEXT,
    need_attachment TINYINT(1) DEFAULT 0 NOT NULL,
    deadline DATETIME,
    tenant_id CHAR(36)
);
CREATE TABLE node_knowledge_point_bindings (
    id CHAR(36) DEFAULT (UUID()) NOT NULL,
    node_id CHAR(36) NOT NULL,
    knowledge_point_id CHAR(36) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE TABLE node_quiz_questions (
    id CHAR(36) DEFAULT (UUID()) NOT NULL,
    quiz_id CHAR(36) NOT NULL,
    type VARCHAR(16) NOT NULL,
    question LONGTEXT NOT NULL,
    options JSON,
    answer LONGTEXT,
    score DECIMAL(5,2) DEFAULT 0 NOT NULL,
    sort_order INT DEFAULT 0 NOT NULL,
    tenant_id CHAR(36)
);
CREATE TABLE node_quizzes (
    id CHAR(36) DEFAULT (UUID()) NOT NULL,
    node_id CHAR(36) NOT NULL,
    title VARCHAR(256) NOT NULL,
    type VARCHAR(16) NOT NULL,
    time_limit INT,
    tenant_id CHAR(36)
);
CREATE TABLE node_resource_bindings (
    id CHAR(36) DEFAULT (UUID()) NOT NULL,
    node_id CHAR(36) NOT NULL,
    resource_id CHAR(36) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    tenant_id CHAR(36)
);
CREATE TABLE node_resources (
    id CHAR(36) DEFAULT (UUID()) NOT NULL,
    node_id CHAR(36) NOT NULL,
    name VARCHAR(256) NOT NULL,
    type VARCHAR(32) NOT NULL,
    url LONGTEXT NOT NULL,
    size INT,
    tenant_id CHAR(36),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE TABLE on_site_question_library (
    id CHAR(36) DEFAULT (UUID()) NOT NULL,
    tenant_id CHAR(36) NOT NULL,
    question_text LONGTEXT NOT NULL,
    answer LONGTEXT,
    question_type VARCHAR(32) DEFAULT 'short_answer' NOT NULL,
    score DOUBLE DEFAULT 0,
    difficulty VARCHAR(16),
    knowledge_point_ids JSON,
    tags JSON,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    creator_id CHAR(36)
);
CREATE TABLE operation_logs (
    id CHAR(36) DEFAULT (UUID()) NOT NULL,
    tenant_id CHAR(36) NOT NULL,
    user_id CHAR(36),
    user_name VARCHAR(64),
    module VARCHAR(64),
    action VARCHAR(64) NOT NULL,
    target_type VARCHAR(64),
    target_id CHAR(36),
    detail LONGTEXT,
    ip VARCHAR(45),
    status VARCHAR(16),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE TABLE orders (
    order_no VARCHAR(100) NOT NULL,
    price DECIMAL(15,2) NOT NULL,
    platform_fee DECIMAL(15,2) DEFAULT 0 NOT NULL,
    seller_income DECIMAL(15,2) DEFAULT 0 NOT NULL,
    status ENUM('pending','paid','cancelled','refunded') DEFAULT 'pending' NOT NULL,
    paid_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    tenant_id CHAR(36),
    id CHAR(36) DEFAULT (UUID()) NOT NULL,
    resource_id CHAR(36),
    buyer_id CHAR(36),
    seller_id CHAR(36)
);
CREATE TABLE org_types (
    id CHAR(36) DEFAULT (UUID()) NOT NULL,
    tenant_id CHAR(36) NOT NULL,
    name VARCHAR(64) NOT NULL,
    category VARCHAR(16) NOT NULL,
    description LONGTEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    is_default TINYINT(1) DEFAULT 0 NOT NULL
);
CREATE TABLE organizations (
    id CHAR(36) DEFAULT (UUID()) NOT NULL,
    tenant_id CHAR(36) NOT NULL,
    name VARCHAR(128) NOT NULL,
    type_id CHAR(36) NOT NULL,
    parent_id CHAR(36),
    sort_order INT DEFAULT 0 NOT NULL,
    member_count INT DEFAULT 0 NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE TABLE platform_configs (
    `key` VARCHAR(100) NOT NULL,
    value LONGTEXT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE TABLE platform_links (
    id CHAR(36) DEFAULT (UUID()) NOT NULL,
    platform VARCHAR(64) NOT NULL,
    url LONGTEXT,
    enabled TINYINT(1) DEFAULT 1 NOT NULL,
    tenant_id CHAR(36)
);
CREATE TABLE position_ability_bindings (
    id CHAR(36) DEFAULT (UUID()) NOT NULL,
    career_position_id CHAR(36) NOT NULL,
    responsibility_id CHAR(36) NOT NULL,
    ability_point_id CHAR(36) NOT NULL,
    source VARCHAR(16) DEFAULT 'custom' NOT NULL,
    domain VARCHAR(128),
    required_level VARCHAR(32) NOT NULL,
    rubric_description LONGTEXT,
    attributes JSON DEFAULT (JSON_ARRAY()) NOT NULL,
    weight DECIMAL(5,2) DEFAULT 0 NOT NULL,
    tenant_id CHAR(36),
    CONSTRAINT chk_position_ability_bindings_weight CHECK (((weight >= (0)) AND (weight <= (100))))
);
CREATE TABLE position_certificates (
    id CHAR(36) DEFAULT (UUID()) NOT NULL,
    career_position_id CHAR(36) NOT NULL,
    tenant_id CHAR(36),
    certificate_library_id CHAR(36) NOT NULL
);
CREATE TABLE position_favorites (
    id CHAR(36) DEFAULT (UUID()) NOT NULL,
    user_id CHAR(36) NOT NULL,
    career_position_id CHAR(36) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE TABLE position_recommendations (
    id CHAR(36) DEFAULT (UUID()) NOT NULL,
    career_position_id CHAR(36) NOT NULL,
    position_type VARCHAR(16) NOT NULL,
    reason LONGTEXT,
    sort_order INT DEFAULT 0 NOT NULL,
    is_enabled TINYINT(1) DEFAULT 1 NOT NULL,
    created_by CHAR(36) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    tenant_id CHAR(36),
    major_id CHAR(36)
);
CREATE TABLE position_responsibilities (
    id CHAR(36) DEFAULT (UUID()) NOT NULL,
    career_position_id CHAR(36) NOT NULL,
    name VARCHAR(256) NOT NULL,
    description LONGTEXT,
    sort_order INT DEFAULT 0 NOT NULL,
    tenant_id CHAR(36)
);
CREATE TABLE question_bank_knowledge_points (
    id CHAR(36) DEFAULT (UUID()) NOT NULL,
    question_bank_id CHAR(36) NOT NULL,
    knowledge_point_id CHAR(36) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE TABLE question_banks (
    id CHAR(36) DEFAULT (UUID()) NOT NULL,
    name VARCHAR(256) NOT NULL,
    description LONGTEXT,
    cover_image LONGTEXT,
    status VARCHAR(16) NOT NULL,
    question_count INT DEFAULT 0 NOT NULL,
    creator_id CHAR(36) NOT NULL,
    collaborator_ids JSON DEFAULT (JSON_ARRAY()) NOT NULL,
    batch_id CHAR(36),
    version VARCHAR(32),
    owner_type VARCHAR(16) NOT NULL,
    is_draft_pool TINYINT(1) DEFAULT 0 NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    collaborator_dept_ids JSON DEFAULT (JSON_ARRAY()) NOT NULL,
    tenant_id CHAR(36),
    code VARCHAR(64) NOT NULL,
    CONSTRAINT chk_question_banks_status CHECK (status IN ('draft', 'pending', 'approved', 'rejected', 'published', 'archived'))
);
CREATE TABLE questions (
    id CHAR(36) DEFAULT (UUID()) NOT NULL,
    bank_id CHAR(36) NOT NULL,
    type VARCHAR(16) NOT NULL,
    content LONGTEXT NOT NULL,
    options JSON,
    answer LONGTEXT NOT NULL,
    analysis LONGTEXT,
    score DECIMAL(5,2) DEFAULT 0 NOT NULL,
    difficulty VARCHAR(8),
    knowledge_point_ids JSON DEFAULT (JSON_ARRAY()) NOT NULL,
    creator_id CHAR(36),
    source VARCHAR(64),
    status VARCHAR(16) DEFAULT 'draft' NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    tenant_id CHAR(36),
    code VARCHAR(64) NOT NULL,
    CONSTRAINT chk_questions_status CHECK (status IN ('draft', 'pending', 'approved', 'rejected', 'published', 'archived'))
);
CREATE TABLE random_draw_questions (
    id CHAR(36) DEFAULT (UUID()) NOT NULL,
    tenant_id CHAR(36) NOT NULL,
    name VARCHAR(256) NOT NULL,
    description LONGTEXT,
    answer LONGTEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    major_id CHAR(36)
);
CREATE TABLE resource_codes (
    id CHAR(36) DEFAULT (UUID()) NOT NULL,
    tenant_id CHAR(36) NOT NULL,
    code VARCHAR(64) NOT NULL,
    name VARCHAR(128) NOT NULL,
    description LONGTEXT,
    type VARCHAR(16) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE TABLE resource_library (
    id CHAR(36) DEFAULT (UUID()) NOT NULL,
    tenant_id CHAR(36) NOT NULL,
    name VARCHAR(256) NOT NULL,
    resource_type ENUM('document','spreadsheet','image','link','audio','video','archive','venue','facility','software','other') NOT NULL,
    url LONGTEXT,
    description LONGTEXT,
    thumbnail LONGTEXT,
    file_size bigint,
    metadata JSON DEFAULT (JSON_OBJECT()),
    uploaded_by CHAR(36),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE TABLE resource_tags (
    id VARCHAR(50) NOT NULL,
    tag_type VARCHAR(50) NOT NULL,
    tag_value VARCHAR(100) NOT NULL,
    tenant_id CHAR(36),
    resource_id CHAR(36)
);
CREATE TABLE resources (
    name VARCHAR(255) NOT NULL,
    intro LONGTEXT,
    category VARCHAR(50) NOT NULL,
    cover_image VARCHAR(500),
    attachment VARCHAR(500),
    attachment_name VARCHAR(255),
    price DECIMAL(15,2) DEFAULT 0 NOT NULL,
    version VARCHAR(50) DEFAULT 'v1.0' NOT NULL,
    status ENUM('draft','reviewing','rejected','pending_publish','published','offlined') DEFAULT 'draft' NOT NULL,
    reject_reason LONGTEXT,
    sales_count INT DEFAULT 0 NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    tenant_id CHAR(36),
    id CHAR(36) DEFAULT (UUID()) NOT NULL,
    institution_id CHAR(36)
);
CREATE TABLE roles (
    id CHAR(36) DEFAULT (UUID()) NOT NULL,
    tenant_id CHAR(36) NOT NULL,
    code VARCHAR(64) NOT NULL,
    name VARCHAR(64) NOT NULL,
    description LONGTEXT,
    permissions JSON DEFAULT (JSON_OBJECT()) NOT NULL,
    user_count INT DEFAULT 0 NOT NULL,
    status VARCHAR(16) DEFAULT 'active' NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE TABLE rubric_templates (
    id CHAR(36) DEFAULT (UUID()) NOT NULL,
    tenant_id CHAR(36) NOT NULL,
    name VARCHAR(256) NOT NULL,
    mode VARCHAR(16) NOT NULL,
    types JSON DEFAULT (JSON_ARRAY()) NOT NULL,
    description LONGTEXT,
    data JSON DEFAULT (JSON_OBJECT()) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    is_deleted TINYINT(1) DEFAULT 0 NOT NULL,
    CONSTRAINT rubric_templates_mode_check CHECK (mode IN ('rubric', 'score_rule'))
);
CREATE TABLE scenario_grade_mappings (
    id CHAR(36) DEFAULT (UUID()) NOT NULL,
    scenario_id CHAR(36) NOT NULL,
    task_id CHAR(36),
    level VARCHAR(4) NOT NULL,
    min_score DECIMAL(7,2) NOT NULL,
    max_score DECIMAL(7,2) NOT NULL,
    description LONGTEXT,
    color VARCHAR(16),
    tenant_id CHAR(36)
);
CREATE TABLE scenario_tasks (
    id CHAR(36) DEFAULT (UUID()) NOT NULL,
    scenario_id CHAR(36) NOT NULL,
    name VARCHAR(256) NOT NULL,
    code VARCHAR(64) NOT NULL,
    sort_order INT DEFAULT 0 NOT NULL,
    description LONGTEXT,
    detailed_description LONGTEXT,
    estimated_hours DECIMAL(5,1) DEFAULT 0 NOT NULL,
    task_type VARCHAR(16) NOT NULL,
    difficulty smallint,
    background LONGTEXT,
    dependency_ids JSON DEFAULT (JSON_ARRAY()) NOT NULL,
    is_referenced TINYINT(1) DEFAULT 0 NOT NULL,
    source_scenario_id CHAR(36),
    tenant_id CHAR(36),
    knowledge_point_ids JSON DEFAULT (JSON_ARRAY()) NOT NULL,
    ability_point_ids JSON DEFAULT (JSON_ARRAY()) NOT NULL,
    resource_ids JSON DEFAULT (JSON_ARRAY()) NOT NULL,
    eval_data JSON DEFAULT (JSON_OBJECT()) NOT NULL,
    description_pdf LONGTEXT,
    CONSTRAINT scenario_tasks_difficulty_check CHECK (((difficulty >= 1) AND (difficulty <= 5)))
);
CREATE TABLE scenario_weight_configs (
    id CHAR(36) DEFAULT (UUID()) NOT NULL,
    scenario_id CHAR(36) NOT NULL,
    task_id CHAR(36) NOT NULL,
    weight DECIMAL(5,2) NOT NULL,
    tenant_id CHAR(36),
    CONSTRAINT chk_scenario_weight_configs_weight CHECK (((weight >= (0)) AND (weight <= (100))))
);
CREATE TABLE scenarios (
    id CHAR(36) DEFAULT (UUID()) NOT NULL,
    name VARCHAR(256) NOT NULL,
    code VARCHAR(64) NOT NULL,
    cover_image LONGTEXT,
    career_position_id CHAR(36),
    profession_id CHAR(36),
    profession_name VARCHAR(128),
    batch_id CHAR(36),
    difficulty smallint,
    version VARCHAR(32) NOT NULL,
    status VARCHAR(16) NOT NULL,
    background LONGTEXT,
    delivery_goal LONGTEXT,
    creator_id CHAR(36) NOT NULL,
    co_builder_ids JSON DEFAULT (JSON_ARRAY()) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    publish_time DATETIME,
    tenant_id CHAR(36),
    industry_id CHAR(36),
    industry_ids JSON DEFAULT (JSON_ARRAY()) NOT NULL,
    profession_ids JSON DEFAULT (JSON_ARRAY()) NOT NULL,
    CONSTRAINT chk_scenarios_status CHECK (status IN ('draft', 'pending', 'approved', 'rejected', 'published', 'archived')),
    CONSTRAINT scenarios_difficulty_check CHECK (((difficulty >= 1) AND (difficulty <= 5)))
);
CREATE TABLE scene_archives (
    id CHAR(36) DEFAULT (UUID()) NOT NULL,
    scenario_id CHAR(36) NOT NULL,
    version VARCHAR(32) NOT NULL,
    snapshot_data JSON NOT NULL,
    archived_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    tenant_id CHAR(36)
);
CREATE TABLE scene_batches (
    id CHAR(36) DEFAULT (UUID()) NOT NULL,
    name VARCHAR(128) NOT NULL,
    code VARCHAR(64),
    org_node_id CHAR(36),
    workflow_id CHAR(36),
    status VARCHAR(16) DEFAULT 'open' NOT NULL,
    scenario_count INT DEFAULT 0 NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    tenant_id CHAR(36),
    major_id CHAR(36)
);
CREATE TABLE scene_evaluation_results (
    id CHAR(36) DEFAULT (UUID()) NOT NULL,
    task_id CHAR(36) NOT NULL,
    scene_id CHAR(36),
    method_key VARCHAR(32) NOT NULL,
    evaluatee_id CHAR(36) NOT NULL,
    evaluator_id CHAR(36),
    evaluator_type VARCHAR(16),
    status VARCHAR(16) NOT NULL,
    total_score DECIMAL(7,2),
    max_score DECIMAL(7,2) DEFAULT 100 NOT NULL,
    eval_point_scores JSON DEFAULT (JSON_OBJECT()),
    objective_answers JSON DEFAULT (JSON_OBJECT()),
    subjective_content JSON DEFAULT (JSON_OBJECT()),
    drawn_questions JSON DEFAULT (JSON_OBJECT()),
    comment LONGTEXT,
    graded_at DATETIME,
    graded_by CHAR(36),
    tenant_id CHAR(36),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE TABLE staff_titles (
    id CHAR(36) DEFAULT (UUID()) NOT NULL,
    tenant_id CHAR(36) NOT NULL,
    code VARCHAR(64) NOT NULL,
    name VARCHAR(64) NOT NULL,
    description LONGTEXT,
    user_count INT DEFAULT 0 NOT NULL,
    status VARCHAR(16) DEFAULT 'active' NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE TABLE student_ability_archives (
    id CHAR(36) DEFAULT (UUID()) NOT NULL,
    user_id CHAR(36) NOT NULL,
    material_type VARCHAR(16) NOT NULL,
    material_name VARCHAR(256) NOT NULL,
    issuing_org VARCHAR(256),
    obtain_date date,
    level VARCHAR(32),
    audit_status VARCHAR(16) DEFAULT 'pending' NOT NULL,
    audit_remark LONGTEXT,
    converted_credit DECIMAL(5,1) DEFAULT 0 NOT NULL,
    direction VARCHAR(16) DEFAULT 'positive' NOT NULL,
    is_enabled TINYINT(1) DEFAULT 1 NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    tenant_id CHAR(36)
);
CREATE TABLE student_ability_portraits (
    id CHAR(36) DEFAULT (UUID()) NOT NULL,
    user_id CHAR(36) NOT NULL,
    career_position_id CHAR(36) NOT NULL,
    overall_grade VARCHAR(16),
    domain_scores JSON DEFAULT (JSON_ARRAY()),
    class_rank INT,
    class_total INT,
    major_rank INT,
    major_total INT,
    completed_courses INT DEFAULT 0 NOT NULL,
    completed_scenes INT DEFAULT 0 NOT NULL,
    total_credits DECIMAL(6,1) DEFAULT 0 NOT NULL,
    course_records JSON DEFAULT (JSON_ARRAY()),
    graduation_qualified TINYINT(1) DEFAULT 0 NOT NULL,
    attendance_rate DECIMAL(5,2),
    diploma_badge VARCHAR(64),
    dual_badge VARCHAR(64),
    archive_count INT DEFAULT 0 NOT NULL,
    recommend_positions JSON DEFAULT (JSON_ARRAY()),
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    tenant_id CHAR(36),
    major_id CHAR(36)
);
CREATE TABLE subscription_packages (
    id CHAR(36) DEFAULT (UUID()) NOT NULL,
    tenant_id CHAR(36) NOT NULL,
    name VARCHAR(128) NOT NULL,
    valid_until date,
    modules JSON DEFAULT (JSON_OBJECT()) NOT NULL,
    status VARCHAR(16) DEFAULT 'active' NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE TABLE system_course_nodes (
    id CHAR(36) DEFAULT (UUID()) NOT NULL,
    course_id CHAR(36) NOT NULL,
    parent_id CHAR(36),
    name VARCHAR(256) NOT NULL,
    sort_order INT DEFAULT 0 NOT NULL,
    ref_type VARCHAR(16) DEFAULT 'normal' NOT NULL,
    source_id CHAR(36),
    source_name VARCHAR(256),
    teaching_goals LONGTEXT,
    duration INT,
    status VARCHAR(16) DEFAULT 'draft' NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    tenant_id CHAR(36),
    knowledge_point_ids JSON DEFAULT (JSON_ARRAY()) NOT NULL,
    resource_ids JSON DEFAULT (JSON_ARRAY()) NOT NULL,
    difficulty INT,
    ability_point_ids JSON DEFAULT (JSON_ARRAY()) NOT NULL,
    code VARCHAR(64),
    detailed_description LONGTEXT,
    description_pdf VARCHAR(512),
    background LONGTEXT,
    estimated_hours DECIMAL(5,1),
    eval_data JSON DEFAULT (JSON_OBJECT()) NOT NULL
);
CREATE TABLE task_ability_bindings (
    id CHAR(36) DEFAULT (UUID()) NOT NULL,
    task_id CHAR(36) NOT NULL,
    ability_point_id CHAR(36) NOT NULL,
    tenant_id CHAR(36)
);
CREATE TABLE task_deliverables (
    id CHAR(36) DEFAULT (UUID()) NOT NULL,
    task_id CHAR(36) NOT NULL,
    type VARCHAR(32) NOT NULL,
    name VARCHAR(256) NOT NULL,
    description LONGTEXT,
    evaluation_points JSON DEFAULT (JSON_OBJECT()),
    sort_order INT DEFAULT 0 NOT NULL,
    tenant_id CHAR(36)
);
CREATE TABLE task_eval_points (
    id CHAR(36) DEFAULT (UUID()) NOT NULL,
    tenant_id CHAR(36) NOT NULL,
    config_id CHAR(36) NOT NULL,
    name VARCHAR(256) NOT NULL,
    description LONGTEXT,
    sub_type VARCHAR(32),
    types JSON DEFAULT (JSON_ARRAY()) NOT NULL,
    weight DECIMAL(5,2) DEFAULT 0 NOT NULL,
    scoring_method VARCHAR(16) DEFAULT 'level' NOT NULL,
    grade_mapping JSON DEFAULT (JSON_ARRAY()) NOT NULL,
    knowledge_point_ids JSON DEFAULT (JSON_ARRAY()) NOT NULL,
    ability_point_ids JSON DEFAULT (JSON_ARRAY()) NOT NULL,
    sort_order INT DEFAULT 0 NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE TABLE task_evaluation_methods (
    id CHAR(36) DEFAULT (UUID()) NOT NULL,
    tenant_id CHAR(36) NOT NULL,
    task_id CHAR(36) NOT NULL,
    method_key VARCHAR(32) NOT NULL,
    weight DECIMAL(5,2) DEFAULT 0 NOT NULL,
    eval_object VARCHAR(16) DEFAULT 'individual' NOT NULL,
    score_type VARCHAR(32),
    eval_subjects JSON DEFAULT (JSON_ARRAY()) NOT NULL,
    rubric_template_id CHAR(36),
    resource_config JSON DEFAULT (JSON_OBJECT()) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    version INT DEFAULT 1 NOT NULL,
    is_enabled TINYINT(1) DEFAULT 1 NOT NULL
);
CREATE TABLE task_knowledge_bindings (
    id CHAR(36) DEFAULT (UUID()) NOT NULL,
    task_id CHAR(36) NOT NULL,
    knowledge_point_id CHAR(36) NOT NULL,
    tenant_id CHAR(36)
);
CREATE TABLE task_resource_bindings (
    id CHAR(36) DEFAULT (UUID()) NOT NULL,
    task_id CHAR(36) NOT NULL,
    resource_id CHAR(36) NOT NULL,
    tenant_id CHAR(36)
);
CREATE TABLE task_resources (
    id CHAR(36) DEFAULT (UUID()) NOT NULL,
    name VARCHAR(256) NOT NULL,
    type VARCHAR(32) NOT NULL,
    url LONGTEXT,
    description LONGTEXT,
    thumbnail LONGTEXT,
    uploaded_by CHAR(36),
    uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    tenant_id CHAR(36),
    size VARCHAR(16),
    knowledge_point_ids JSON DEFAULT (JSON_ARRAY()) NOT NULL,
    extra_data JSON DEFAULT (JSON_OBJECT()) NOT NULL
);
CREATE TABLE task_review_steps (
    id CHAR(36) DEFAULT (UUID()) NOT NULL,
    tenant_id CHAR(36) NOT NULL,
    config_id CHAR(36) NOT NULL,
    label VARCHAR(64) NOT NULL,
    description LONGTEXT,
    enabled TINYINT(1) DEFAULT 1 NOT NULL,
    subject_type VARCHAR(32),
    weight DECIMAL(5,2) DEFAULT 0 NOT NULL,
    sort_order INT DEFAULT 0 NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE TABLE tenants (
    id CHAR(36) DEFAULT (UUID()) NOT NULL,
    name VARCHAR(128) NOT NULL,
    code VARCHAR(64) NOT NULL,
    logo_url LONGTEXT,
    domain VARCHAR(256),
    enterprise_code VARCHAR(64),
    contact VARCHAR(128),
    phone VARCHAR(32),
    address LONGTEXT,
    description LONGTEXT,
    admin_ids JSON DEFAULT (JSON_ARRAY()) NOT NULL,
    status VARCHAR(16) DEFAULT 'active' NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE TABLE user_extension_fields (
    id CHAR(36) DEFAULT (UUID()) NOT NULL,
    tenant_id CHAR(36) NOT NULL,
    field_key VARCHAR(64) NOT NULL,
    field_name VARCHAR(64) NOT NULL,
    field_type VARCHAR(16) NOT NULL,
    is_enabled TINYINT(1) DEFAULT 1 NOT NULL,
    is_required TINYINT(1) DEFAULT 0 NOT NULL,
    slot_number INT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    applicable_role_codes JSON DEFAULT (JSON_ARRAY()) NOT NULL,
    CONSTRAINT user_extension_fields_slot_number_check CHECK (((slot_number >= 1) AND (slot_number <= 20)))
);
CREATE TABLE user_relations (
    id CHAR(36) DEFAULT (UUID()) NOT NULL,
    tenant_id CHAR(36) NOT NULL,
    initiator_id CHAR(36) NOT NULL,
    initiator_org_node_id CHAR(36),
    target_id CHAR(36) NOT NULL,
    target_org_node_id CHAR(36),
    relation_type VARCHAR(16) NOT NULL,
    description LONGTEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE TABLE user_roles (
    id CHAR(36) DEFAULT (UUID()) NOT NULL,
    user_id CHAR(36) NOT NULL,
    role_id CHAR(36) NOT NULL
);
CREATE TABLE users (
    id CHAR(36) DEFAULT (UUID()) NOT NULL,
    tenant_id CHAR(36),
    org_node_id CHAR(36),
    major_id CHAR(36),
    role ENUM('school','enterprise','operator') DEFAULT 'operator' NOT NULL,
    login_name VARCHAR(255),
    username VARCHAR(100),
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(32),
    avatar_url LONGTEXT,
    student_no VARCHAR(64),
    work_id VARCHAR(64),
    id_card VARCHAR(32),
    title_ids JSON DEFAULT (JSON_ARRAY()) NOT NULL,
    oauth JSON DEFAULT (JSON_OBJECT()),
    status VARCHAR(20) DEFAULT 'active' NOT NULL,
    last_login_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    platform VARCHAR(16) DEFAULT 'saas' NOT NULL,
    institution_id CHAR(36),
    graduate_year INT
);
CREATE TABLE view_counters (
    target_type VARCHAR(64) NOT NULL,
    target_id CHAR(36) NOT NULL,
    cnt bigint DEFAULT 0 NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE view_logs (
    id CHAR(36) DEFAULT (UUID()) NOT NULL,
    target_type VARCHAR(32) NOT NULL,
    target_id CHAR(36) NOT NULL,
    user_id CHAR(36),
    tenant_id CHAR(36),
    viewed_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE TABLE withdrawals (
    amount DECIMAL(15,2) NOT NULL,
    account_type VARCHAR(20) NOT NULL,
    account_info VARCHAR(500) NOT NULL,
    status ENUM('pending','approved','paid','rejected') DEFAULT 'pending' NOT NULL,
    handled_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    tenant_id CHAR(36),
    id CHAR(36) DEFAULT (UUID()) NOT NULL,
    institution_id CHAR(36)
);
CREATE TABLE workflows (
    id CHAR(36) DEFAULT (UUID()) NOT NULL,
    tenant_id CHAR(36),
    name VARCHAR(128) NOT NULL,
    scene VARCHAR(64),
    description LONGTEXT,
    steps JSON DEFAULT (JSON_ARRAY()) NOT NULL,
    usage_count INT DEFAULT 0 NOT NULL,
    status VARCHAR(16) DEFAULT 'active' NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    major_ids JSON DEFAULT (JSON_ARRAY()) NOT NULL
);
ALTER TABLE ability_domains
    ADD CONSTRAINT ability_domains_pkey PRIMARY KEY (id);
ALTER TABLE ability_points
    ADD CONSTRAINT ability_points_pkey PRIMARY KEY (id);
ALTER TABLE announcements
    ADD CONSTRAINT announcements_pkey PRIMARY KEY (id);
ALTER TABLE app_modules
    ADD CONSTRAINT app_modules_pkey PRIMARY KEY (id);
ALTER TABLE appeal_records
    ADD CONSTRAINT appeal_records_pkey PRIMARY KEY (id);
ALTER TABLE approval_records
    ADD CONSTRAINT approval_records_pkey PRIMARY KEY (id);
ALTER TABLE authorizations
    ADD CONSTRAINT authorizations_auth_code_key UNIQUE (auth_code);
ALTER TABLE authorizations
    ADD CONSTRAINT authorizations_pkey PRIMARY KEY (id);
ALTER TABLE banner_configs
    ADD CONSTRAINT banner_configs_pkey PRIMARY KEY (id);
ALTER TABLE banners
    ADD CONSTRAINT banners_pkey PRIMARY KEY (id);
ALTER TABLE batches
    ADD CONSTRAINT batches_pkey PRIMARY KEY (id);
ALTER TABLE career_position_majors
    ADD CONSTRAINT career_position_majors_career_position_id_major_id_key UNIQUE (career_position_id, major_id);
ALTER TABLE career_position_majors
    ADD CONSTRAINT career_position_majors_pkey PRIMARY KEY (id);
ALTER TABLE career_positions
    ADD CONSTRAINT career_positions_pkey PRIMARY KEY (id);
ALTER TABLE cert_issuance_records
    ADD CONSTRAINT cert_issuance_records_cert_number_key UNIQUE (cert_number);
ALTER TABLE cert_issuance_records
    ADD CONSTRAINT cert_issuance_records_pkey PRIMARY KEY (id);
ALTER TABLE certificate_library
    ADD CONSTRAINT certificate_library_pkey PRIMARY KEY (id);
ALTER TABLE certification_ability_items
    ADD CONSTRAINT certification_ability_items_pkey PRIMARY KEY (id);
ALTER TABLE certification_ability_points
    ADD CONSTRAINT certification_ability_points_pkey PRIMARY KEY (id);
ALTER TABLE certification_competency_requirements
    ADD CONSTRAINT certification_competency_requirements_pkey PRIMARY KEY (id);
ALTER TABLE certification_grade_data
    ADD CONSTRAINT certification_grade_data_pkey PRIMARY KEY (id);
ALTER TABLE certification_grade_data
    ADD CONSTRAINT certification_grade_data_position_id_grade_year_key UNIQUE (position_id, grade_year);
ALTER TABLE certification_grade_leaderboard
    ADD CONSTRAINT certification_grade_leaderboard_pkey PRIMARY KEY (id);
ALTER TABLE certification_related_tasks
    ADD CONSTRAINT certification_related_tasks_pkey PRIMARY KEY (id);
ALTER TABLE certification_rules
    ADD CONSTRAINT certification_rules_pkey PRIMARY KEY (id);
ALTER TABLE course_knowledge_bindings
    ADD CONSTRAINT course_knowledge_bindings_course_id_knowledge_point_id_bind_key UNIQUE (course_id, knowledge_point_id, bind_type, source_id);
ALTER TABLE course_knowledge_bindings
    ADD CONSTRAINT course_knowledge_bindings_pkey PRIMARY KEY (id);
ALTER TABLE course_resource_bindings
    ADD CONSTRAINT course_resource_bindings_course_id_resource_id_key UNIQUE (course_id, resource_id);
ALTER TABLE course_resource_bindings
    ADD CONSTRAINT course_resource_bindings_pkey PRIMARY KEY (id);
ALTER TABLE courses
    ADD CONSTRAINT courses_pkey PRIMARY KEY (id);
ALTER TABLE credit_conversion_rules
    ADD CONSTRAINT credit_conversion_rules_pkey PRIMARY KEY (id);
ALTER TABLE evaluation_batches
    ADD CONSTRAINT evaluation_batches_pkey PRIMARY KEY (id);
ALTER TABLE evaluation_method_categories
    ADD CONSTRAINT evaluation_method_categories_pkey PRIMARY KEY (id);
ALTER TABLE evaluation_method_targets
    ADD CONSTRAINT evaluation_method_targets_evaluation_method_id_target_id_key UNIQUE (evaluation_method_id, target_id);
ALTER TABLE evaluation_method_targets
    ADD CONSTRAINT evaluation_method_targets_pkey PRIMARY KEY (id);
ALTER TABLE evaluation_methods
    ADD CONSTRAINT evaluation_methods_pkey PRIMARY KEY (id);
ALTER TABLE exam_questions
    ADD CONSTRAINT exam_questions_pkey PRIMARY KEY (id);
ALTER TABLE exam_results
    ADD CONSTRAINT exam_results_exam_usage_id_user_id_key UNIQUE (exam_usage_id, user_id);
ALTER TABLE exam_results
    ADD CONSTRAINT exam_results_pkey PRIMARY KEY (id);
ALTER TABLE exam_usages
    ADD CONSTRAINT exam_usages_pkey PRIMARY KEY (id);
ALTER TABLE exams
    ADD CONSTRAINT exams_pkey PRIMARY KEY (id);
ALTER TABLE favorite_counters
    ADD CONSTRAINT favorite_counters_pkey PRIMARY KEY (target_type, target_id);
ALTER TABLE graduation_project_archives
    ADD CONSTRAINT graduation_project_archives_pkey PRIMARY KEY (id);
ALTER TABLE graduation_project_evaluations
    ADD CONSTRAINT graduation_project_evaluations_pkey PRIMARY KEY (id);
ALTER TABLE graduation_project_topics
    ADD CONSTRAINT graduation_project_topics_pkey PRIMARY KEY (id);
ALTER TABLE graduation_query_results
    ADD CONSTRAINT graduation_query_results_pkey PRIMARY KEY (id);
ALTER TABLE hybrid_node_modules
    ADD CONSTRAINT hybrid_node_modules_node_id_module_key_key UNIQUE (node_id, module_key);
ALTER TABLE hybrid_node_modules
    ADD CONSTRAINT hybrid_node_modules_pkey PRIMARY KEY (id);
ALTER TABLE industries
    ADD CONSTRAINT industries_pkey PRIMARY KEY (id);
ALTER TABLE institution_expertise_tags
    ADD CONSTRAINT institution_expertise_tags_pkey PRIMARY KEY (id);
ALTER TABLE institutions
    ADD CONSTRAINT institutions_credit_code_key UNIQUE (credit_code);
ALTER TABLE institutions
    ADD CONSTRAINT institutions_org_code_key UNIQUE (org_code);
ALTER TABLE institutions
    ADD CONSTRAINT institutions_pkey PRIMARY KEY (id);
ALTER TABLE job_ability_aggregate_logs
    ADD CONSTRAINT job_ability_aggregate_logs_pkey PRIMARY KEY (id);
ALTER TABLE job_ability_results
    ADD CONSTRAINT job_ability_results_pkey PRIMARY KEY (id);
ALTER TABLE knowledge_points
    ADD CONSTRAINT knowledge_points_pkey PRIMARY KEY (id);
ALTER TABLE learn_roads
    ADD CONSTRAINT learn_roads_pkey PRIMARY KEY (id);
ALTER TABLE lesson_batches
    ADD CONSTRAINT lesson_batches_pkey PRIMARY KEY (id);
ALTER TABLE lesson_behavior_records
    ADD CONSTRAINT lesson_behavior_records_course_id_student_user_id_record_da_key UNIQUE (course_id, student_user_id, record_date);
ALTER TABLE lesson_behavior_records
    ADD CONSTRAINT lesson_behavior_records_pkey PRIMARY KEY (id);
ALTER TABLE login_logs
    ADD CONSTRAINT login_logs_pkey PRIMARY KEY (id);
ALTER TABLE majors
    ADD CONSTRAINT majors_pkey PRIMARY KEY (id);
ALTER TABLE micro_cert_templates
    ADD CONSTRAINT micro_cert_templates_pkey PRIMARY KEY (id);
ALTER TABLE node_ability_point_bindings
    ADD CONSTRAINT node_ability_point_bindings_pkey PRIMARY KEY (node_id, ability_point_id);
ALTER TABLE node_homeworks
    ADD CONSTRAINT node_homeworks_pkey PRIMARY KEY (id);
ALTER TABLE node_knowledge_point_bindings
    ADD CONSTRAINT node_knowledge_point_bindings_node_id_knowledge_point_id_key UNIQUE (node_id, knowledge_point_id);
ALTER TABLE node_knowledge_point_bindings
    ADD CONSTRAINT node_knowledge_point_bindings_pkey PRIMARY KEY (id);
ALTER TABLE node_quiz_questions
    ADD CONSTRAINT node_quiz_questions_pkey PRIMARY KEY (id);
ALTER TABLE node_quizzes
    ADD CONSTRAINT node_quizzes_pkey PRIMARY KEY (id);
ALTER TABLE node_resource_bindings
    ADD CONSTRAINT node_resource_bindings_node_id_resource_id_key UNIQUE (node_id, resource_id);
ALTER TABLE node_resource_bindings
    ADD CONSTRAINT node_resource_bindings_pkey PRIMARY KEY (id);
ALTER TABLE node_resources
    ADD CONSTRAINT node_resources_pkey PRIMARY KEY (id);
ALTER TABLE on_site_question_library
    ADD CONSTRAINT on_site_question_library_pkey PRIMARY KEY (id);
ALTER TABLE operation_logs
    ADD CONSTRAINT operation_logs_pkey PRIMARY KEY (id);
ALTER TABLE orders
    ADD CONSTRAINT orders_order_no_key UNIQUE (order_no);
ALTER TABLE orders
    ADD CONSTRAINT orders_pkey PRIMARY KEY (id);
ALTER TABLE org_types
    ADD CONSTRAINT org_types_pkey PRIMARY KEY (id);
ALTER TABLE organizations
    ADD CONSTRAINT organizations_pkey PRIMARY KEY (id);
ALTER TABLE platform_configs
    ADD CONSTRAINT platform_configs_pkey PRIMARY KEY (`key`);
ALTER TABLE platform_links
    ADD CONSTRAINT platform_links_pkey PRIMARY KEY (id);
ALTER TABLE platform_links
    ADD CONSTRAINT platform_links_platform_key UNIQUE (platform);
ALTER TABLE position_ability_bindings
    ADD CONSTRAINT position_ability_bindings_career_position_id_responsibility_key UNIQUE (career_position_id, responsibility_id, ability_point_id);
ALTER TABLE position_ability_bindings
    ADD CONSTRAINT position_ability_bindings_pkey PRIMARY KEY (id);
ALTER TABLE position_certificates
    ADD CONSTRAINT position_certificates_pkey PRIMARY KEY (id);
ALTER TABLE position_favorites
    ADD CONSTRAINT position_favorites_pkey PRIMARY KEY (id);
ALTER TABLE position_favorites
    ADD CONSTRAINT position_favorites_user_id_career_position_id_key UNIQUE (user_id, career_position_id);
ALTER TABLE position_recommendations
    ADD CONSTRAINT position_recommendations_pkey PRIMARY KEY (id);
ALTER TABLE position_responsibilities
    ADD CONSTRAINT position_responsibilities_pkey PRIMARY KEY (id);
ALTER TABLE question_bank_knowledge_points
    ADD CONSTRAINT question_bank_knowledge_point_question_bank_id_knowledge_po_key UNIQUE (question_bank_id, knowledge_point_id);
ALTER TABLE question_bank_knowledge_points
    ADD CONSTRAINT question_bank_knowledge_points_pkey PRIMARY KEY (id);
ALTER TABLE question_banks
    ADD CONSTRAINT question_banks_pkey PRIMARY KEY (id);
ALTER TABLE questions
    ADD CONSTRAINT questions_pkey PRIMARY KEY (id);
ALTER TABLE random_draw_questions
    ADD CONSTRAINT random_draw_questions_pkey PRIMARY KEY (id);
ALTER TABLE resource_codes
    ADD CONSTRAINT resource_codes_pkey PRIMARY KEY (id);
ALTER TABLE resource_library
    ADD CONSTRAINT resource_library_pkey PRIMARY KEY (id);
ALTER TABLE resource_tags
    ADD CONSTRAINT resource_tags_pkey PRIMARY KEY (id);
ALTER TABLE resources
    ADD CONSTRAINT resources_pkey PRIMARY KEY (id);
ALTER TABLE roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (id);
ALTER TABLE rubric_templates
    ADD CONSTRAINT rubric_templates_pkey PRIMARY KEY (id);
ALTER TABLE scenario_grade_mappings
    ADD CONSTRAINT scenario_grade_mappings_pkey PRIMARY KEY (id);
ALTER TABLE scenario_tasks
    ADD CONSTRAINT scenario_tasks_pkey PRIMARY KEY (id);
ALTER TABLE scenario_weight_configs
    ADD CONSTRAINT scenario_weight_configs_pkey PRIMARY KEY (id);
ALTER TABLE scenario_weight_configs
    ADD CONSTRAINT scenario_weight_configs_scenario_id_task_id_key UNIQUE (scenario_id, task_id);
ALTER TABLE scenarios
    ADD CONSTRAINT scenarios_pkey PRIMARY KEY (id);
ALTER TABLE scene_archives
    ADD CONSTRAINT scene_archives_pkey PRIMARY KEY (id);
ALTER TABLE scene_batches
    ADD CONSTRAINT scene_batches_pkey PRIMARY KEY (id);
ALTER TABLE scene_evaluation_results
    ADD CONSTRAINT scene_evaluation_results_pkey PRIMARY KEY (id);
ALTER TABLE scene_evaluation_results
    ADD CONSTRAINT scene_evaluation_results_task_id_evaluatee_id_method_key_key UNIQUE (task_id, evaluatee_id, method_key);
ALTER TABLE staff_titles
    ADD CONSTRAINT staff_titles_pkey PRIMARY KEY (id);
ALTER TABLE student_ability_archives
    ADD CONSTRAINT student_ability_archives_pkey PRIMARY KEY (id);
ALTER TABLE student_ability_portraits
    ADD CONSTRAINT student_ability_portraits_pkey PRIMARY KEY (id);
ALTER TABLE subscription_packages
    ADD CONSTRAINT subscription_packages_pkey PRIMARY KEY (id);
ALTER TABLE system_course_nodes
    ADD CONSTRAINT system_course_nodes_pkey PRIMARY KEY (id);
ALTER TABLE task_ability_bindings
    ADD CONSTRAINT task_ability_bindings_pkey PRIMARY KEY (id);
ALTER TABLE task_ability_bindings
    ADD CONSTRAINT task_ability_bindings_task_id_ability_point_id_key UNIQUE (task_id, ability_point_id);
ALTER TABLE task_deliverables
    ADD CONSTRAINT task_deliverables_pkey PRIMARY KEY (id);
ALTER TABLE task_eval_points
    ADD CONSTRAINT task_eval_points_pkey PRIMARY KEY (id);
ALTER TABLE task_evaluation_methods
    ADD CONSTRAINT task_evaluation_methods_pkey PRIMARY KEY (id);
ALTER TABLE task_evaluation_methods
    ADD CONSTRAINT task_evaluation_methods_task_id_method_key_key UNIQUE (task_id, method_key);
ALTER TABLE task_knowledge_bindings
    ADD CONSTRAINT task_knowledge_bindings_pkey PRIMARY KEY (id);
ALTER TABLE task_knowledge_bindings
    ADD CONSTRAINT task_knowledge_bindings_task_id_knowledge_point_id_key UNIQUE (task_id, knowledge_point_id);
ALTER TABLE task_resource_bindings
    ADD CONSTRAINT task_resource_bindings_pkey PRIMARY KEY (id);
ALTER TABLE task_resource_bindings
    ADD CONSTRAINT task_resource_bindings_task_id_resource_id_key UNIQUE (task_id, resource_id);
ALTER TABLE task_resources
    ADD CONSTRAINT task_resources_pkey PRIMARY KEY (id);
ALTER TABLE task_review_steps
    ADD CONSTRAINT task_review_steps_pkey PRIMARY KEY (id);
ALTER TABLE tenants
    ADD CONSTRAINT tenants_code_key UNIQUE (code);
ALTER TABLE tenants
    ADD CONSTRAINT tenants_pkey PRIMARY KEY (id);
ALTER TABLE certification_rules
    ADD CONSTRAINT uq_certification_rules_position UNIQUE (career_position_id);
ALTER TABLE user_extension_fields
    ADD CONSTRAINT user_extension_fields_pkey PRIMARY KEY (id);
ALTER TABLE user_relations
    ADD CONSTRAINT user_relations_pkey PRIMARY KEY (id);
ALTER TABLE user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);
ALTER TABLE user_roles
    ADD CONSTRAINT user_roles_user_id_role_id_key UNIQUE (user_id, role_id);
ALTER TABLE users
    ADD CONSTRAINT users_pkey1 PRIMARY KEY (id);
ALTER TABLE users
    ADD CONSTRAINT users_tenant_platform_username UNIQUE (tenant_id, platform, username);
ALTER TABLE view_counters
    ADD CONSTRAINT view_counters_pkey PRIMARY KEY (target_type, target_id);
ALTER TABLE view_logs
    ADD CONSTRAINT view_logs_pkey PRIMARY KEY (id);
ALTER TABLE withdrawals
    ADD CONSTRAINT withdrawals_pkey PRIMARY KEY (id);
ALTER TABLE workflows
    ADD CONSTRAINT workflows_pkey PRIMARY KEY (id);
CREATE INDEX idx_ability_domains_position ON ability_domains (career_position_id);
CREATE INDEX idx_ability_points_category ON ability_points (category);
CREATE INDEX idx_ability_points_creator ON ability_points (creator_id);
CREATE INDEX idx_abilitydomains_tenant ON ability_domains (tenant_id);
CREATE INDEX idx_abilitypoints_tenant ON ability_points (tenant_id);
CREATE INDEX idx_announcements_created ON announcements (created_at DESC);
CREATE INDEX idx_announcements_roles ON announcements ((CAST(target_roles AS CHAR(64) ARRAY)));
CREATE INDEX idx_announcements_tenant ON announcements (tenant_id);
CREATE INDEX idx_app_modules_platform ON app_modules (platform);
CREATE INDEX idx_appeal_records_user ON appeal_records (user_id);
CREATE INDEX idx_appealrecords_tenant ON appeal_records (tenant_id);
CREATE INDEX idx_appmodules_tenant ON app_modules (tenant_id);
CREATE INDEX idx_approval_records_status ON approval_records (status);
CREATE INDEX idx_approval_records_submitter ON approval_records (submitter_id);
CREATE INDEX idx_approval_records_target ON approval_records (target_type, target_id);
CREATE INDEX idx_authorizations_buyer_resource ON authorizations (buyer_id, resource_id);
CREATE INDEX idx_authorizations_tenant ON authorizations (tenant_id);
CREATE INDEX idx_bannerconfigs_tenant ON banner_configs (tenant_id);
CREATE INDEX idx_banners_tenant ON banners (tenant_id);
CREATE INDEX idx_batches_org_node ON batches (org_node_id);
CREATE INDEX idx_batches_tenant ON batches (tenant_id);
CREATE INDEX idx_career_position_majors_major ON career_position_majors (major_id);
CREATE INDEX idx_career_position_majors_position ON career_position_majors (career_position_id);
CREATE INDEX idx_career_positions_batch ON career_positions (batch_id);
CREATE INDEX idx_career_positions_status ON career_positions (status);
CREATE INDEX idx_career_positions_view_count ON career_positions (view_count DESC);
CREATE INDEX idx_careerpositions_tenant ON career_positions (tenant_id);
CREATE INDEX idx_cert_grade_competencies_grade ON certification_competency_requirements (grade_data_id);
CREATE INDEX idx_cert_grade_data_position ON certification_grade_data (position_id);
CREATE INDEX idx_cert_grade_leaderboard_grade ON certification_grade_leaderboard (grade_data_id);
CREATE INDEX idx_cert_issuance_records_user ON cert_issuance_records (user_id);
CREATE INDEX idx_certificate_library_creator ON certificate_library (creator_id);
CREATE INDEX idx_certificate_library_tenant ON certificate_library (tenant_id);
CREATE INDEX idx_certification_ability_items_rule ON certification_ability_items (rule_id);
CREATE INDEX idx_certification_ability_points_item ON certification_ability_points (item_id);
CREATE INDEX idx_certification_related_tasks_cert_point ON certification_related_tasks (cert_point_id);
CREATE INDEX idx_certification_rules_position ON certification_rules (career_position_id);
CREATE INDEX idx_certificationabilityitems_tenant ON certification_ability_items (tenant_id);
CREATE INDEX idx_certificationabilitypoints_tenant ON certification_ability_points (tenant_id);
CREATE INDEX idx_certificationrelatedtasks_tenant ON certification_related_tasks (tenant_id);
CREATE INDEX idx_certificationrules_tenant ON certification_rules (tenant_id);
CREATE INDEX idx_certissuancerecords_tenant ON cert_issuance_records (tenant_id);
CREATE INDEX idx_course_knowledge_bindings_course ON course_knowledge_bindings (course_id);
CREATE INDEX idx_course_resource_bindings_course ON course_resource_bindings (course_id);
CREATE INDEX idx_course_resource_bindings_resource ON course_resource_bindings (resource_id);
CREATE INDEX idx_courseknowledgebindings_tenant ON course_knowledge_bindings (tenant_id);
CREATE INDEX idx_courses_batch_id ON courses (batch_id);
CREATE INDEX idx_courses_status ON courses (status);
CREATE INDEX idx_courses_tenant ON courses (tenant_id);
CREATE INDEX idx_courses_type ON courses (type);
CREATE INDEX idx_creditconversionrules_tenant ON credit_conversion_rules (tenant_id);
CREATE INDEX idx_emt_method ON evaluation_method_targets (evaluation_method_id);
CREATE INDEX idx_evaluation_batches_org_node ON evaluation_batches (org_node_id);
CREATE INDEX idx_evaluation_batches_status ON evaluation_batches (status);
CREATE INDEX idx_evaluation_batches_tenant ON evaluation_batches (tenant_id);
CREATE INDEX idx_evaluation_methods_category ON evaluation_methods (category_id);
CREATE INDEX idx_evaluationmethodcategories_tenant ON evaluation_method_categories (tenant_id);
CREATE INDEX idx_evaluationmethods_tenant ON evaluation_methods (tenant_id);
CREATE INDEX idx_exam_questions_exam ON exam_questions (exam_id);
CREATE INDEX idx_exam_results_usage ON exam_results (exam_usage_id);
CREATE INDEX idx_exam_results_usage_user ON exam_results (exam_usage_id, user_id);
CREATE INDEX idx_exam_results_user ON exam_results (user_id);
CREATE INDEX idx_exam_usages_exam ON exam_usages (exam_id);
CREATE INDEX idx_exam_usages_status_start ON exam_usages (status, start_time);
CREATE INDEX idx_examquestions_tenant ON exam_questions (tenant_id);
CREATE INDEX idx_examresults_tenant ON exam_results (tenant_id);
CREATE INDEX idx_exams_status ON exams (status);
CREATE INDEX idx_exams_tenant ON exams (tenant_id);
CREATE INDEX idx_examusages_tenant ON exam_usages (tenant_id);
CREATE INDEX idx_graduation_project_archives_topic ON graduation_project_archives (topic_id);
CREATE INDEX idx_graduation_project_evaluations_topic ON graduation_project_evaluations (topic_id);
CREATE INDEX idx_graduation_project_topics_position ON graduation_project_topics (career_position_id);
CREATE INDEX idx_graduation_query_results_user ON graduation_query_results (user_id);
CREATE INDEX idx_graduationprojectarchives_tenant ON graduation_project_archives (tenant_id);
CREATE INDEX idx_graduationprojectevaluations_tenant ON graduation_project_evaluations (tenant_id);
CREATE INDEX idx_graduationprojecttopics_tenant ON graduation_project_topics (tenant_id);
CREATE INDEX idx_graduationqueryresults_tenant ON graduation_query_results (tenant_id);
CREATE INDEX idx_hybrid_node_modules_node ON hybrid_node_modules (node_id);
CREATE INDEX idx_hybridnodemodules_tenant ON hybrid_node_modules (tenant_id);
CREATE INDEX idx_industries_parent ON industries (parent_id);
CREATE INDEX idx_industries_tenant ON industries (tenant_id);
CREATE INDEX idx_institutionexpertisetags_tenant ON institution_expertise_tags (tenant_id);
CREATE INDEX idx_institutions_tenant ON institutions (tenant_id);
CREATE INDEX idx_job_ability_aggregate_logs_position ON job_ability_aggregate_logs (tenant_id, career_position_id, started_at DESC);
CREATE INDEX idx_job_ability_results_user ON job_ability_results (user_id);
CREATE UNIQUE INDEX idx_job_ability_results_user_position ON job_ability_results (career_position_id, user_id);
CREATE INDEX idx_jobabilityresults_tenant ON job_ability_results (tenant_id);
CREATE INDEX idx_knowledge_points_creator ON knowledge_points (creator_id);
CREATE INDEX idx_knowledgepoints_tenant ON knowledge_points (tenant_id);
CREATE INDEX idx_lbr_course_date ON lesson_behavior_records (course_id, record_date);
CREATE INDEX idx_lbr_course_student ON lesson_behavior_records (course_id, student_user_id);
CREATE INDEX idx_lbr_student ON lesson_behavior_records (student_user_id);
CREATE INDEX idx_learnroads_tenant ON learn_roads (tenant_id);
CREATE INDEX idx_lesson_batches_org_node ON lesson_batches (org_node_id);
CREATE INDEX idx_lesson_batches_status ON lesson_batches (status);
CREATE INDEX idx_lesson_batches_tenant ON lesson_batches (tenant_id);
CREATE INDEX idx_lessonbehaviorrecords_tenant ON lesson_behavior_records (tenant_id);
CREATE INDEX idx_login_logs_tenant_created ON login_logs (tenant_id, created_at);
CREATE INDEX idx_login_logs_user ON login_logs (user_id);
CREATE INDEX idx_majors_tenant ON majors (tenant_id);
CREATE INDEX idx_microcerttemplates_tenant ON micro_cert_templates (tenant_id);
CREATE INDEX idx_nkpb_node ON node_knowledge_point_bindings (node_id);
CREATE INDEX idx_node_homeworks_node ON node_homeworks (node_id);
CREATE INDEX idx_node_quiz_questions_quiz ON node_quiz_questions (quiz_id);
CREATE INDEX idx_node_quizzes_node ON node_quizzes (node_id);
CREATE INDEX idx_node_resources_node ON node_resources (node_id);
CREATE INDEX idx_nodehomeworks_tenant ON node_homeworks (tenant_id);
CREATE INDEX idx_nodequizquestions_tenant ON node_quiz_questions (tenant_id);
CREATE INDEX idx_nodequizzes_tenant ON node_quizzes (tenant_id);
CREATE INDEX idx_noderesources_tenant ON node_resources (tenant_id);
CREATE INDEX idx_nrb_node ON node_resource_bindings (node_id);
CREATE INDEX idx_on_site_question_library_creator ON on_site_question_library (creator_id);
CREATE INDEX idx_on_site_question_library_tenant ON on_site_question_library (tenant_id);
CREATE INDEX idx_operation_logs_tenant_created ON operation_logs (tenant_id, created_at);
CREATE INDEX idx_operation_logs_user ON operation_logs (user_id);
CREATE INDEX idx_orders_buyer ON orders (buyer_id, status);
CREATE INDEX idx_orders_tenant ON orders (tenant_id);
CREATE INDEX idx_organizations_parent ON organizations (parent_id);
CREATE INDEX idx_organizations_tenant ON organizations (tenant_id);
CREATE INDEX idx_platformlinks_tenant ON platform_links (tenant_id);
CREATE INDEX idx_position_ability_bindings_position ON position_ability_bindings (career_position_id);
CREATE INDEX idx_position_certificates_library ON position_certificates (certificate_library_id);
CREATE INDEX idx_position_certificates_position ON position_certificates (career_position_id);
CREATE INDEX idx_position_favorites_position_id ON position_favorites (career_position_id);
CREATE INDEX idx_position_favorites_user_id ON position_favorites (user_id);
CREATE INDEX idx_position_responsibilities_position ON position_responsibilities (career_position_id);
CREATE INDEX idx_positionabilitybindings_tenant ON position_ability_bindings (tenant_id);
CREATE INDEX idx_positioncertificates_tenant ON position_certificates (tenant_id);
CREATE INDEX idx_positionrecommendations_tenant ON position_recommendations (tenant_id);
CREATE INDEX idx_positionresponsibilities_tenant ON position_responsibilities (tenant_id);
CREATE INDEX idx_qbkp_bank ON question_bank_knowledge_points (question_bank_id);
CREATE INDEX idx_question_banks_creator ON question_banks (creator_id);
CREATE INDEX idx_question_banks_status ON question_banks (status);
CREATE INDEX idx_questionbanks_tenant ON question_banks (tenant_id);
CREATE INDEX idx_questions_bank ON questions (bank_id);
CREATE INDEX idx_questions_tenant ON questions (tenant_id);
CREATE INDEX idx_rdq_major_id ON random_draw_questions (major_id);
CREATE INDEX idx_rdq_tenant ON random_draw_questions (tenant_id);
CREATE UNIQUE INDEX idx_resource_codes_tenant_code ON resource_codes (tenant_id, code);
CREATE INDEX idx_resource_library_tenant ON resource_library (tenant_id);
CREATE INDEX idx_resource_library_type ON resource_library (tenant_id, resource_type);
CREATE INDEX idx_resource_tags_lookup ON resource_tags (tag_type, tag_value);
CREATE INDEX idx_resources_institution_status ON resources (institution_id, status);
CREATE INDEX idx_resources_status_created ON resources (status, created_at);
CREATE INDEX idx_resources_tenant ON resources (tenant_id);
CREATE INDEX idx_resourcetags_tenant ON resource_tags (tenant_id);
CREATE UNIQUE INDEX idx_roles_tenant_code ON roles (tenant_id, code);
CREATE INDEX idx_rubric_templates_deleted ON rubric_templates (tenant_id, is_deleted);
CREATE INDEX idx_rubric_templates_tenant ON rubric_templates (tenant_id);
CREATE INDEX idx_scenario_grade_mappings_scenario ON scenario_grade_mappings (scenario_id);
CREATE INDEX idx_scenario_tasks_scenario ON scenario_tasks (scenario_id);
CREATE INDEX idx_scenario_tasks_tenant ON scenario_tasks (tenant_id);
CREATE INDEX idx_scenario_weight_configs_scenario ON scenario_weight_configs (scenario_id);
CREATE INDEX idx_scenariogrademappings_tenant ON scenario_grade_mappings (tenant_id);
CREATE INDEX idx_scenarios_batch ON scenarios (batch_id);
CREATE INDEX idx_scenarios_status ON scenarios (status);
CREATE INDEX idx_scenarios_tenant ON scenarios (tenant_id);
CREATE INDEX idx_scenarioweightconfigs_tenant ON scenario_weight_configs (tenant_id);
CREATE INDEX idx_scene_archives_scenario ON scene_archives (scenario_id);
CREATE INDEX idx_scene_batches_org_node ON scene_batches (org_node_id);
CREATE INDEX idx_scene_batches_status ON scene_batches (status);
CREATE INDEX idx_scene_batches_tenant ON scene_batches (tenant_id);
CREATE INDEX idx_scene_eval_task_evaluator_created ON scene_evaluation_results (task_id, evaluatee_id, created_at DESC);
CREATE INDEX idx_scene_evaluation_results_evaluatee ON scene_evaluation_results (evaluatee_id);
CREATE INDEX idx_scene_evaluation_results_task ON scene_evaluation_results (task_id);
CREATE INDEX idx_scenearchives_tenant ON scene_archives (tenant_id);
CREATE INDEX idx_sceneevaluationresults_tenant ON scene_evaluation_results (tenant_id);
CREATE INDEX idx_student_ability_archives_user ON student_ability_archives (user_id);
CREATE INDEX idx_student_ability_portraits_user ON student_ability_portraits (user_id);
CREATE UNIQUE INDEX idx_student_ability_portraits_user_position ON student_ability_portraits (user_id, career_position_id);
CREATE INDEX idx_studentabilityarchives_tenant ON student_ability_archives (tenant_id);
CREATE INDEX idx_studentabilityportraits_tenant ON student_ability_portraits (tenant_id);
CREATE INDEX idx_subscription_packages_tenant ON subscription_packages (tenant_id);
CREATE INDEX idx_system_course_nodes_code ON system_course_nodes (code);
CREATE INDEX idx_system_course_nodes_course ON system_course_nodes (course_id);
CREATE INDEX idx_system_course_nodes_parent ON system_course_nodes (parent_id);
CREATE INDEX idx_systemcoursenodes_tenant ON system_course_nodes (tenant_id);
CREATE INDEX idx_task_ability_bindings_task ON task_ability_bindings (task_id);
CREATE INDEX idx_task_deliverables_task ON task_deliverables (task_id);
CREATE INDEX idx_task_evaluation_methods_enabled ON task_evaluation_methods (task_id, tenant_id, is_enabled);
CREATE INDEX idx_task_knowledge_bindings_task ON task_knowledge_bindings (task_id);
CREATE INDEX idx_task_resource_bindings_task ON task_resource_bindings (task_id);
CREATE INDEX idx_taskabilitybindings_tenant ON task_ability_bindings (tenant_id);
CREATE INDEX idx_taskdeliverables_tenant ON task_deliverables (tenant_id);
CREATE INDEX idx_taskknowledgebindings_tenant ON task_knowledge_bindings (tenant_id);
CREATE INDEX idx_taskresourcebindings_tenant ON task_resource_bindings (tenant_id);
CREATE INDEX idx_taskresources_tenant ON task_resources (tenant_id);
CREATE UNIQUE INDEX idx_user_extension_fields_tenant_key ON user_extension_fields (tenant_id, field_key);
CREATE INDEX idx_user_relations_initiator ON user_relations (initiator_id);
CREATE INDEX idx_user_relations_target ON user_relations (target_id);
CREATE INDEX idx_user_roles_role ON user_roles (role_id);
CREATE INDEX idx_users_major ON users (major_id);
CREATE INDEX idx_users_org_node ON users (org_node_id);
CREATE INDEX idx_users_platform ON users (platform);
CREATE INDEX idx_users_platform_username ON users (platform, username);
CREATE INDEX idx_users_tenant ON users (tenant_id);
CREATE INDEX idx_view_logs_target ON view_logs (target_type, target_id);
CREATE INDEX idx_view_logs_viewed ON view_logs (viewed_at DESC);
CREATE INDEX idx_withdrawals_tenant ON withdrawals (tenant_id);
CREATE UNIQUE INDEX uq_ability_points_tenant_name ON ability_points (tenant_id, name);
CREATE UNIQUE INDEX uq_career_positions_tenant_code ON career_positions (tenant_id, code);
CREATE UNIQUE INDEX uq_career_positions_tenant_name ON career_positions (tenant_id, name);
CREATE UNIQUE INDEX uq_certificate_library_tenant_name ON certificate_library (tenant_id, name);
CREATE UNIQUE INDEX uq_courses_tenant_code ON courses (tenant_id, code);
CREATE UNIQUE INDEX uq_exams_tenant_code ON exams (tenant_id, code);
CREATE UNIQUE INDEX uq_exams_tenant_name ON exams (tenant_id, name);
CREATE UNIQUE INDEX uq_graduation_topics_tenant_name ON graduation_project_topics (tenant_id, name);
CREATE UNIQUE INDEX uq_industries_tenant_code ON industries (tenant_id, code);
CREATE UNIQUE INDEX uq_institution_expertise_tags ON institution_expertise_tags (institution_id, tag_value);
CREATE UNIQUE INDEX uq_knowledge_points_tenant_name ON knowledge_points (tenant_id, name);
CREATE UNIQUE INDEX uq_learn_roads_tenant_name ON learn_roads (tenant_id, name);
CREATE UNIQUE INDEX uq_majors_tenant_code ON majors (tenant_id, code);
CREATE UNIQUE INDEX uq_org_types_tenant_name ON org_types (tenant_id, name);
CREATE UNIQUE INDEX uq_question_banks_tenant_code ON question_banks (tenant_id, code);
CREATE UNIQUE INDEX uq_question_banks_tenant_name ON question_banks (tenant_id, name);
CREATE UNIQUE INDEX uq_questions_tenant_code ON questions (tenant_id, code);
CREATE UNIQUE INDEX uq_scenarios_tenant_code ON scenarios (tenant_id, code);
CREATE UNIQUE INDEX uq_staff_titles_tenant_code ON staff_titles (tenant_id, code);
CREATE UNIQUE INDEX uq_users_tenant_platform_login ON users (tenant_id, platform, login_name);
CREATE UNIQUE INDEX uq_workflows_tenant_name ON workflows (tenant_id, name);
ALTER TABLE ability_domains
    ADD CONSTRAINT ability_domains_career_position_id_fkey FOREIGN KEY (career_position_id) REFERENCES career_positions(id) ON DELETE CASCADE;
ALTER TABLE ability_points
    ADD CONSTRAINT ability_points_creator_id_fkey FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE appeal_records
    ADD CONSTRAINT appeal_records_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE approval_records
    ADD CONSTRAINT approval_records_workflow_id_fkey FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE SET NULL;
ALTER TABLE authorizations
    ADD CONSTRAINT authorizations_buyer_id_new_fkey FOREIGN KEY (buyer_id) REFERENCES institutions(id) ON DELETE CASCADE;
ALTER TABLE authorizations
    ADD CONSTRAINT authorizations_order_id_new_fkey FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE;
ALTER TABLE authorizations
    ADD CONSTRAINT authorizations_resource_id_new_fkey FOREIGN KEY (resource_id) REFERENCES resources(id) ON DELETE CASCADE;
ALTER TABLE career_position_majors
    ADD CONSTRAINT career_position_majors_career_position_id_fkey FOREIGN KEY (career_position_id) REFERENCES career_positions(id) ON DELETE CASCADE;
ALTER TABLE career_position_majors
    ADD CONSTRAINT career_position_majors_major_id_fkey FOREIGN KEY (major_id) REFERENCES majors(id) ON DELETE CASCADE;
ALTER TABLE cert_issuance_records
    ADD CONSTRAINT cert_issuance_records_template_id_fkey FOREIGN KEY (template_id) REFERENCES micro_cert_templates(id);
ALTER TABLE cert_issuance_records
    ADD CONSTRAINT cert_issuance_records_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE certificate_library
    ADD CONSTRAINT certificate_library_creator_id_fkey FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE certification_ability_items
    ADD CONSTRAINT certification_ability_items_rule_id_fkey FOREIGN KEY (rule_id) REFERENCES certification_rules(id) ON DELETE CASCADE;
ALTER TABLE certification_ability_points
    ADD CONSTRAINT certification_ability_points_item_id_fkey FOREIGN KEY (item_id) REFERENCES certification_ability_items(id) ON DELETE CASCADE;
ALTER TABLE certification_competency_requirements
    ADD CONSTRAINT certification_competency_requirements_grade_data_id_fkey FOREIGN KEY (grade_data_id) REFERENCES certification_grade_data(id) ON DELETE CASCADE;
ALTER TABLE certification_grade_leaderboard
    ADD CONSTRAINT certification_grade_leaderboard_grade_data_id_fkey FOREIGN KEY (grade_data_id) REFERENCES certification_grade_data(id) ON DELETE CASCADE;
ALTER TABLE certification_related_tasks
    ADD CONSTRAINT certification_related_tasks_cert_point_id_fkey FOREIGN KEY (cert_point_id) REFERENCES certification_ability_points(id) ON DELETE CASCADE;
ALTER TABLE course_knowledge_bindings
    ADD CONSTRAINT course_knowledge_bindings_course_id_fkey FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE;
ALTER TABLE course_knowledge_bindings
    ADD CONSTRAINT course_knowledge_bindings_knowledge_point_id_fkey FOREIGN KEY (knowledge_point_id) REFERENCES knowledge_points(id) ON DELETE CASCADE;
ALTER TABLE course_resource_bindings
    ADD CONSTRAINT course_resource_bindings_course_id_fkey FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE;
ALTER TABLE course_resource_bindings
    ADD CONSTRAINT course_resource_bindings_resource_id_fkey FOREIGN KEY (resource_id) REFERENCES resource_library(id) ON DELETE CASCADE;
ALTER TABLE evaluation_method_targets
    ADD CONSTRAINT evaluation_method_targets_evaluation_method_id_fkey FOREIGN KEY (evaluation_method_id) REFERENCES evaluation_methods(id) ON DELETE CASCADE;
ALTER TABLE evaluation_methods
    ADD CONSTRAINT evaluation_methods_category_id_fkey FOREIGN KEY (category_id) REFERENCES evaluation_method_categories(id) ON DELETE CASCADE;
ALTER TABLE exam_questions
    ADD CONSTRAINT exam_questions_exam_id_fkey FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE;
ALTER TABLE exam_questions
    ADD CONSTRAINT exam_questions_question_id_fkey FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE;
ALTER TABLE exam_results
    ADD CONSTRAINT exam_results_exam_usage_id_fkey FOREIGN KEY (exam_usage_id) REFERENCES exam_usages(id) ON DELETE CASCADE;
ALTER TABLE exam_results
    ADD CONSTRAINT exam_results_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE exam_usages
    ADD CONSTRAINT exam_usages_exam_id_fkey FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE;
ALTER TABLE ability_points
    ADD CONSTRAINT fk_ability_points_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE announcements
    ADD CONSTRAINT fk_announcements_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE app_modules
    ADD CONSTRAINT fk_app_modules_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE approval_records
    ADD CONSTRAINT fk_approval_records_submitter FOREIGN KEY (submitter_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE authorizations
    ADD CONSTRAINT fk_authorizations_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE banner_configs
    ADD CONSTRAINT fk_banner_configs_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE banners
    ADD CONSTRAINT fk_banners_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE batches
    ADD CONSTRAINT fk_batches_major FOREIGN KEY (major_id) REFERENCES majors(id) ON DELETE SET NULL;
ALTER TABLE career_positions
    ADD CONSTRAINT fk_career_positions_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE certification_ability_items
    ADD CONSTRAINT fk_certification_ability_items_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE certification_ability_points
    ADD CONSTRAINT fk_certification_ability_points_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE certification_grade_leaderboard
    ADD CONSTRAINT fk_certification_grade_leaderboard_major FOREIGN KEY (major_id) REFERENCES majors(id) ON DELETE SET NULL;
ALTER TABLE certification_related_tasks
    ADD CONSTRAINT fk_certification_related_tasks_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE certification_rules
    ADD CONSTRAINT fk_certification_rules_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE courses
    ADD CONSTRAINT fk_courses_batch FOREIGN KEY (batch_id) REFERENCES lesson_batches(id) ON DELETE SET NULL;
ALTER TABLE courses
    ADD CONSTRAINT fk_courses_creator FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE courses
    ADD CONSTRAINT fk_courses_industry FOREIGN KEY (industry_id) REFERENCES industries(id) ON DELETE SET NULL;
ALTER TABLE courses
    ADD CONSTRAINT fk_courses_major FOREIGN KEY (major_id) REFERENCES majors(id) ON DELETE SET NULL;
ALTER TABLE courses
    ADD CONSTRAINT fk_courses_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE credit_conversion_rules
    ADD CONSTRAINT fk_credit_conversion_rules_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE evaluation_batches
    ADD CONSTRAINT fk_evaluation_batches_major FOREIGN KEY (major_id) REFERENCES majors(id) ON DELETE SET NULL;
ALTER TABLE evaluation_method_categories
    ADD CONSTRAINT fk_evaluation_method_categories_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE evaluation_methods
    ADD CONSTRAINT fk_evaluation_methods_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE exam_results
    ADD CONSTRAINT fk_exam_results_major FOREIGN KEY (major_id) REFERENCES majors(id) ON DELETE SET NULL;
ALTER TABLE exam_usages
    ADD CONSTRAINT fk_exam_usages_creator FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE exam_usages
    ADD CONSTRAINT fk_exam_usages_major FOREIGN KEY (major_id) REFERENCES majors(id) ON DELETE SET NULL;
ALTER TABLE exams
    ADD CONSTRAINT fk_exams_creator FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE exams
    ADD CONSTRAINT fk_exams_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE graduation_project_topics
    ADD CONSTRAINT fk_graduation_project_topics_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE graduation_query_results
    ADD CONSTRAINT fk_graduation_query_results_major FOREIGN KEY (major_id) REFERENCES majors(id) ON DELETE SET NULL;
ALTER TABLE industries
    ADD CONSTRAINT fk_industries_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE institution_expertise_tags
    ADD CONSTRAINT fk_institution_expertise_tags_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE institutions
    ADD CONSTRAINT fk_institutions_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE knowledge_points
    ADD CONSTRAINT fk_knowledge_points_creator FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE knowledge_points
    ADD CONSTRAINT fk_knowledge_points_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE learn_roads
    ADD CONSTRAINT fk_learn_roads_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE lesson_batches
    ADD CONSTRAINT fk_lesson_batches_major FOREIGN KEY (major_id) REFERENCES majors(id) ON DELETE SET NULL;
ALTER TABLE login_logs
    ADD CONSTRAINT fk_login_logs_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE majors
    ADD CONSTRAINT fk_majors_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE micro_cert_templates
    ADD CONSTRAINT fk_micro_cert_templates_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE operation_logs
    ADD CONSTRAINT fk_operation_logs_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE orders
    ADD CONSTRAINT fk_orders_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE org_types
    ADD CONSTRAINT fk_org_types_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE organizations
    ADD CONSTRAINT fk_organizations_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE organizations
    ADD CONSTRAINT fk_organizations_type FOREIGN KEY (type_id) REFERENCES org_types(id) ON DELETE RESTRICT;
ALTER TABLE on_site_question_library
    ADD CONSTRAINT fk_osql_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE platform_links
    ADD CONSTRAINT fk_platform_links_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE position_certificates
    ADD CONSTRAINT fk_position_certificates_library FOREIGN KEY (certificate_library_id) REFERENCES certificate_library(id) ON DELETE CASCADE;
ALTER TABLE position_recommendations
    ADD CONSTRAINT fk_position_recommendations_major FOREIGN KEY (major_id) REFERENCES majors(id) ON DELETE SET NULL;
ALTER TABLE question_banks
    ADD CONSTRAINT fk_question_banks_creator FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE question_banks
    ADD CONSTRAINT fk_question_banks_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE questions
    ADD CONSTRAINT fk_questions_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE random_draw_questions
    ADD CONSTRAINT fk_rdq_major FOREIGN KEY (major_id) REFERENCES majors(id) ON DELETE SET NULL;
ALTER TABLE random_draw_questions
    ADD CONSTRAINT fk_rdq_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE resource_codes
    ADD CONSTRAINT fk_resource_codes_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE resource_library
    ADD CONSTRAINT fk_resource_library_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE resource_tags
    ADD CONSTRAINT fk_resource_tags_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE resources
    ADD CONSTRAINT fk_resources_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE roles
    ADD CONSTRAINT fk_roles_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE scenarios
    ADD CONSTRAINT fk_scenarios_creator FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE scenarios
    ADD CONSTRAINT fk_scenarios_industry FOREIGN KEY (industry_id) REFERENCES industries(id) ON DELETE SET NULL;
ALTER TABLE scenarios
    ADD CONSTRAINT fk_scenarios_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE scene_batches
    ADD CONSTRAINT fk_scene_batches_major FOREIGN KEY (major_id) REFERENCES majors(id) ON DELETE SET NULL;
ALTER TABLE staff_titles
    ADD CONSTRAINT fk_staff_titles_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE student_ability_portraits
    ADD CONSTRAINT fk_student_ability_portraits_major FOREIGN KEY (major_id) REFERENCES majors(id) ON DELETE SET NULL;
ALTER TABLE subscription_packages
    ADD CONSTRAINT fk_subscription_packages_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE task_resources
    ADD CONSTRAINT fk_task_resources_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE user_extension_fields
    ADD CONSTRAINT fk_user_extension_fields_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE user_relations
    ADD CONSTRAINT fk_user_relations_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE user_roles
    ADD CONSTRAINT fk_user_roles_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE users
    ADD CONSTRAINT fk_users_major FOREIGN KEY (major_id) REFERENCES majors(id) ON DELETE SET NULL;
ALTER TABLE users
    ADD CONSTRAINT fk_users_org_node FOREIGN KEY (org_node_id) REFERENCES organizations(id) ON DELETE SET NULL;
ALTER TABLE users
    ADD CONSTRAINT fk_users_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE view_logs
    ADD CONSTRAINT fk_view_logs_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE withdrawals
    ADD CONSTRAINT fk_withdrawals_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE workflows
    ADD CONSTRAINT fk_workflows_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE graduation_project_archives
    ADD CONSTRAINT graduation_project_archives_topic_id_fkey FOREIGN KEY (topic_id) REFERENCES graduation_project_topics(id);
ALTER TABLE graduation_project_archives
    ADD CONSTRAINT graduation_project_archives_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE graduation_project_evaluations
    ADD CONSTRAINT graduation_project_evaluations_topic_id_fkey FOREIGN KEY (topic_id) REFERENCES graduation_project_topics(id);
ALTER TABLE graduation_project_evaluations
    ADD CONSTRAINT graduation_project_evaluations_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE graduation_query_results
    ADD CONSTRAINT graduation_query_results_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE hybrid_node_modules
    ADD CONSTRAINT hybrid_node_modules_node_id_fkey FOREIGN KEY (node_id) REFERENCES system_course_nodes(id) ON DELETE CASCADE;
ALTER TABLE industries
    ADD CONSTRAINT industries_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES industries(id) ON DELETE SET NULL;
ALTER TABLE institution_expertise_tags
    ADD CONSTRAINT institution_expertise_tags_institution_id_new_fkey FOREIGN KEY (institution_id) REFERENCES institutions(id) ON DELETE CASCADE;
ALTER TABLE job_ability_results
    ADD CONSTRAINT job_ability_results_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE lesson_behavior_records
    ADD CONSTRAINT lesson_behavior_records_course_id_fkey FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE;
ALTER TABLE lesson_behavior_records
    ADD CONSTRAINT lesson_behavior_records_student_user_id_fkey FOREIGN KEY (student_user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE node_ability_point_bindings
    ADD CONSTRAINT node_ability_point_bindings_ability_point_id_fkey FOREIGN KEY (ability_point_id) REFERENCES ability_points(id) ON DELETE CASCADE;
ALTER TABLE node_ability_point_bindings
    ADD CONSTRAINT node_ability_point_bindings_node_id_fkey FOREIGN KEY (node_id) REFERENCES system_course_nodes(id) ON DELETE CASCADE;
ALTER TABLE node_homeworks
    ADD CONSTRAINT node_homeworks_node_id_fkey FOREIGN KEY (node_id) REFERENCES system_course_nodes(id) ON DELETE CASCADE;
ALTER TABLE node_knowledge_point_bindings
    ADD CONSTRAINT node_knowledge_point_bindings_knowledge_point_id_fkey FOREIGN KEY (knowledge_point_id) REFERENCES knowledge_points(id) ON DELETE CASCADE;
ALTER TABLE node_knowledge_point_bindings
    ADD CONSTRAINT node_knowledge_point_bindings_node_id_fkey FOREIGN KEY (node_id) REFERENCES system_course_nodes(id) ON DELETE CASCADE;
ALTER TABLE node_quiz_questions
    ADD CONSTRAINT node_quiz_questions_quiz_id_fkey FOREIGN KEY (quiz_id) REFERENCES node_quizzes(id) ON DELETE CASCADE;
ALTER TABLE node_quizzes
    ADD CONSTRAINT node_quizzes_node_id_fkey FOREIGN KEY (node_id) REFERENCES system_course_nodes(id) ON DELETE CASCADE;
ALTER TABLE node_resource_bindings
    ADD CONSTRAINT node_resource_bindings_node_id_fkey FOREIGN KEY (node_id) REFERENCES system_course_nodes(id) ON DELETE CASCADE;
ALTER TABLE node_resource_bindings
    ADD CONSTRAINT node_resource_bindings_resource_id_fkey FOREIGN KEY (resource_id) REFERENCES resource_library(id) ON DELETE CASCADE;
ALTER TABLE node_resources
    ADD CONSTRAINT node_resources_node_id_fkey FOREIGN KEY (node_id) REFERENCES system_course_nodes(id) ON DELETE CASCADE;
ALTER TABLE on_site_question_library
    ADD CONSTRAINT on_site_question_library_creator_id_fkey FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE orders
    ADD CONSTRAINT orders_buyer_id_new_fkey FOREIGN KEY (buyer_id) REFERENCES institutions(id) ON DELETE CASCADE;
ALTER TABLE orders
    ADD CONSTRAINT orders_resource_id_new_fkey FOREIGN KEY (resource_id) REFERENCES resources(id) ON DELETE CASCADE;
ALTER TABLE orders
    ADD CONSTRAINT orders_seller_id_new_fkey FOREIGN KEY (seller_id) REFERENCES institutions(id) ON DELETE CASCADE;
ALTER TABLE organizations
    ADD CONSTRAINT organizations_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES organizations(id) ON DELETE SET NULL;
ALTER TABLE position_ability_bindings
    ADD CONSTRAINT position_ability_bindings_ability_point_id_fkey FOREIGN KEY (ability_point_id) REFERENCES ability_points(id) ON DELETE CASCADE;
ALTER TABLE position_ability_bindings
    ADD CONSTRAINT position_ability_bindings_career_position_id_fkey FOREIGN KEY (career_position_id) REFERENCES career_positions(id) ON DELETE CASCADE;
ALTER TABLE position_ability_bindings
    ADD CONSTRAINT position_ability_bindings_responsibility_id_fkey FOREIGN KEY (responsibility_id) REFERENCES position_responsibilities(id) ON DELETE CASCADE;
ALTER TABLE position_certificates
    ADD CONSTRAINT position_certificates_career_position_id_fkey FOREIGN KEY (career_position_id) REFERENCES career_positions(id) ON DELETE CASCADE;
ALTER TABLE position_favorites
    ADD CONSTRAINT position_favorites_career_position_id_fkey FOREIGN KEY (career_position_id) REFERENCES career_positions(id) ON DELETE CASCADE;
ALTER TABLE position_recommendations
    ADD CONSTRAINT position_recommendations_career_position_id_fkey FOREIGN KEY (career_position_id) REFERENCES career_positions(id) ON DELETE CASCADE;
ALTER TABLE position_responsibilities
    ADD CONSTRAINT position_responsibilities_career_position_id_fkey FOREIGN KEY (career_position_id) REFERENCES career_positions(id) ON DELETE CASCADE;
ALTER TABLE question_bank_knowledge_points
    ADD CONSTRAINT question_bank_knowledge_points_knowledge_point_id_fkey FOREIGN KEY (knowledge_point_id) REFERENCES knowledge_points(id) ON DELETE CASCADE;
ALTER TABLE question_bank_knowledge_points
    ADD CONSTRAINT question_bank_knowledge_points_question_bank_id_fkey FOREIGN KEY (question_bank_id) REFERENCES question_banks(id) ON DELETE CASCADE;
ALTER TABLE questions
    ADD CONSTRAINT questions_bank_id_fkey FOREIGN KEY (bank_id) REFERENCES question_banks(id) ON DELETE CASCADE;
ALTER TABLE resource_tags
    ADD CONSTRAINT resource_tags_resource_id_new_fkey FOREIGN KEY (resource_id) REFERENCES resources(id) ON DELETE CASCADE;
ALTER TABLE resources
    ADD CONSTRAINT resources_institution_id_new_fkey FOREIGN KEY (institution_id) REFERENCES institutions(id) ON DELETE SET NULL;
ALTER TABLE scenario_grade_mappings
    ADD CONSTRAINT scenario_grade_mappings_scenario_id_fkey FOREIGN KEY (scenario_id) REFERENCES scenarios(id) ON DELETE CASCADE;
ALTER TABLE scenario_grade_mappings
    ADD CONSTRAINT scenario_grade_mappings_task_id_fkey FOREIGN KEY (task_id) REFERENCES scenario_tasks(id) ON DELETE CASCADE;
ALTER TABLE scenario_tasks
    ADD CONSTRAINT scenario_tasks_scenario_id_fkey FOREIGN KEY (scenario_id) REFERENCES scenarios(id) ON DELETE CASCADE;
ALTER TABLE scenario_weight_configs
    ADD CONSTRAINT scenario_weight_configs_scenario_id_fkey FOREIGN KEY (scenario_id) REFERENCES scenarios(id) ON DELETE CASCADE;
ALTER TABLE scenario_weight_configs
    ADD CONSTRAINT scenario_weight_configs_task_id_fkey FOREIGN KEY (task_id) REFERENCES scenario_tasks(id) ON DELETE CASCADE;
ALTER TABLE scene_archives
    ADD CONSTRAINT scene_archives_scenario_id_fkey FOREIGN KEY (scenario_id) REFERENCES scenarios(id) ON DELETE CASCADE;
ALTER TABLE scene_evaluation_results
    ADD CONSTRAINT scene_evaluation_results_evaluatee_id_fkey FOREIGN KEY (evaluatee_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE scene_evaluation_results
    ADD CONSTRAINT scene_evaluation_results_evaluator_id_fkey FOREIGN KEY (evaluator_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE scene_evaluation_results
    ADD CONSTRAINT scene_evaluation_results_graded_by_fkey FOREIGN KEY (graded_by) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE student_ability_archives
    ADD CONSTRAINT student_ability_archives_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE student_ability_portraits
    ADD CONSTRAINT student_ability_portraits_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE system_course_nodes
    ADD CONSTRAINT system_course_nodes_course_id_fkey FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE;
ALTER TABLE system_course_nodes
    ADD CONSTRAINT system_course_nodes_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES system_course_nodes(id) ON DELETE SET NULL;
ALTER TABLE task_ability_bindings
    ADD CONSTRAINT task_ability_bindings_task_id_fkey FOREIGN KEY (task_id) REFERENCES scenario_tasks(id) ON DELETE CASCADE;
ALTER TABLE task_deliverables
    ADD CONSTRAINT task_deliverables_task_id_fkey FOREIGN KEY (task_id) REFERENCES scenario_tasks(id) ON DELETE CASCADE;
ALTER TABLE task_eval_points
    ADD CONSTRAINT task_eval_points_config_id_fkey FOREIGN KEY (config_id) REFERENCES task_evaluation_methods(id) ON DELETE CASCADE;
ALTER TABLE task_evaluation_methods
    ADD CONSTRAINT task_evaluation_methods_rubric_template_id_fkey FOREIGN KEY (rubric_template_id) REFERENCES rubric_templates(id) ON DELETE SET NULL;
ALTER TABLE task_evaluation_methods
    ADD CONSTRAINT task_evaluation_methods_task_id_fkey FOREIGN KEY (task_id) REFERENCES scenario_tasks(id) ON DELETE CASCADE;
ALTER TABLE task_knowledge_bindings
    ADD CONSTRAINT task_knowledge_bindings_task_id_fkey FOREIGN KEY (task_id) REFERENCES scenario_tasks(id) ON DELETE CASCADE;
ALTER TABLE task_resource_bindings
    ADD CONSTRAINT task_resource_bindings_resource_id_fkey FOREIGN KEY (resource_id) REFERENCES resource_library(id) ON DELETE CASCADE;
ALTER TABLE task_resource_bindings
    ADD CONSTRAINT task_resource_bindings_task_id_fkey FOREIGN KEY (task_id) REFERENCES scenario_tasks(id) ON DELETE CASCADE;
ALTER TABLE task_review_steps
    ADD CONSTRAINT task_review_steps_config_id_fkey FOREIGN KEY (config_id) REFERENCES task_evaluation_methods(id) ON DELETE CASCADE;
ALTER TABLE user_roles
    ADD CONSTRAINT user_roles_role_id_fkey FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE;
ALTER TABLE users
    ADD CONSTRAINT users_institution_id_new_fkey FOREIGN KEY (institution_id) REFERENCES institutions(id) ON DELETE SET NULL;
ALTER TABLE withdrawals
    ADD CONSTRAINT withdrawals_institution_id_new_fkey FOREIGN KEY (institution_id) REFERENCES institutions(id) ON DELETE CASCADE;
