-- Baseline migration: schema snapshot from 2026-07-29
-- Contains all tables, types, indexes, and constraints from migrations 001-091

CREATE TYPE public.institution_status AS ENUM (
    'pending',
    'approved',
    'disabled'
);
CREATE TYPE public.institution_type AS ENUM (
    'school',
    'enterprise'
);
CREATE TYPE public.order_status AS ENUM (
    'pending',
    'paid',
    'cancelled',
    'refunded'
);
CREATE TYPE public.resource_status AS ENUM (
    'draft',
    'reviewing',
    'rejected',
    'pending_publish',
    'published',
    'offlined'
);
CREATE TYPE public.resource_type AS ENUM (
    'document',
    'spreadsheet',
    'image',
    'link',
    'audio',
    'video',
    'archive',
    'venue',
    'facility',
    'software',
    'other'
);
CREATE TYPE public.user_role AS ENUM (
    'school',
    'enterprise',
    'operator'
);
CREATE TYPE public.withdrawal_status AS ENUM (
    'pending',
    'approved',
    'paid',
    'rejected'
);
CREATE TABLE public.ability_domains (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    career_position_id uuid NOT NULL,
    name character varying(128) NOT NULL,
    description text,
    binding_ids uuid[] DEFAULT '{}'::uuid[] NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    tenant_id uuid
);
CREATE TABLE public.ability_points (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(256) NOT NULL,
    description text,
    category character varying(16) NOT NULL,
    is_public boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    tenant_id uuid,
    code character varying(64),
    attributes text[] DEFAULT '{}'::text[] NOT NULL,
    creator_id uuid
);
CREATE TABLE public.announcements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title character varying(256) NOT NULL,
    type character varying(16) DEFAULT '通知'::character varying NOT NULL,
    target_roles character varying(16)[] DEFAULT '{}'::character varying[] NOT NULL,
    is_new boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    tenant_id uuid
);
CREATE TABLE public.app_modules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    platform character varying(64) NOT NULL,
    title character varying(128) NOT NULL,
    description text,
    href text,
    sort_order integer DEFAULT 0 NOT NULL,
    tenant_id uuid
);
CREATE TABLE public.appeal_records (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    type character varying(16) NOT NULL,
    reason text NOT NULL,
    status character varying(16) DEFAULT 'pending'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    tenant_id uuid,
    remark text,
    updated_at timestamp with time zone
);
CREATE TABLE public.approval_records (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid,
    target_type character varying(32) NOT NULL,
    target_id uuid NOT NULL,
    workflow_id uuid,
    current_step_idx integer DEFAULT 0 NOT NULL,
    status character varying(16) DEFAULT 'pending'::character varying NOT NULL,
    submitter_id uuid NOT NULL,
    history jsonb DEFAULT '[]'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.authorizations (
    auth_code character varying(100) NOT NULL,
    status integer DEFAULT 1 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    tenant_id uuid,
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid,
    buyer_id uuid,
    resource_id uuid
);
CREATE TABLE public.banner_configs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title character varying(256) NOT NULL,
    image_url text NOT NULL,
    link_url text,
    sort_order integer DEFAULT 0 NOT NULL,
    is_enabled boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    tenant_id uuid
);
CREATE TABLE public.banners (
    title character varying(255) NOT NULL,
    image character varying(500) NOT NULL,
    link character varying(500),
    sort integer DEFAULT 0 NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    tenant_id uuid,
    id uuid DEFAULT gen_random_uuid() NOT NULL
);
CREATE TABLE public.batches (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(128) NOT NULL,
    code character varying(64),
    org_node_id uuid,
    workflow_id uuid,
    status character varying(16) DEFAULT 'open'::character varying NOT NULL,
    position_count integer DEFAULT 0 NOT NULL,
    published_count integer DEFAULT 0 NOT NULL,
    pending_count integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    tenant_id uuid,
    major_id uuid
);
CREATE TABLE public.career_position_majors (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    career_position_id uuid NOT NULL,
    major_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.career_positions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    batch_id uuid,
    name character varying(128) NOT NULL,
    short_name character varying(64),
    industry_id uuid,
    position_type character varying(16) NOT NULL,
    salary_min integer,
    salary_max integer,
    cover_image text,
    description text,
    requirements text[] DEFAULT '{}'::text[] NOT NULL,
    career_path text,
    version character varying(32) NOT NULL,
    status character varying(16) NOT NULL,
    created_by uuid NOT NULL,
    collaborators uuid[] DEFAULT '{}'::uuid[] NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    tenant_id uuid,
    view_count integer DEFAULT 0 NOT NULL,
    code character varying(64) NOT NULL,
    CONSTRAINT chk_career_positions_status CHECK (((status)::text = ANY ((ARRAY['draft'::character varying, 'pending'::character varying, 'approved'::character varying, 'rejected'::character varying, 'published'::character varying, 'archived'::character varying])::text[])))
);
CREATE TABLE public.cert_issuance_records (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    template_id uuid NOT NULL,
    user_id uuid NOT NULL,
    cert_number character varying(128) NOT NULL,
    issue_date date NOT NULL,
    expire_date date,
    status character varying(16) DEFAULT 'issued'::character varying NOT NULL,
    revoked_at timestamp with time zone,
    revoke_reason text,
    tenant_id uuid
);
CREATE TABLE public.certificate_library (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    name character varying(128) NOT NULL,
    url text,
    description text,
    image_url text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    creator_id uuid
);
CREATE TABLE public.certification_ability_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    rule_id uuid NOT NULL,
    name character varying(256) NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    tenant_id uuid
);
CREATE TABLE public.certification_ability_points (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    item_id uuid NOT NULL,
    ability_point_id uuid NOT NULL,
    mapping_type character varying(16) DEFAULT 'inherit'::character varying NOT NULL,
    custom_level_mapping jsonb DEFAULT '[]'::jsonb,
    required_level character varying(16) NOT NULL,
    weight numeric(5,2) DEFAULT 0 NOT NULL,
    tenant_id uuid
);
CREATE TABLE public.certification_competency_requirements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    grade_data_id uuid NOT NULL,
    duty_name character varying(256) NOT NULL,
    item_name character varying(256) NOT NULL,
    target_level integer NOT NULL,
    current_level integer DEFAULT 1 NOT NULL,
    description text,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.certification_grade_data (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    position_id uuid NOT NULL,
    grade_year integer NOT NULL,
    total_ability_points integer DEFAULT 0 NOT NULL,
    avg_achievement_rate numeric(5,2),
    last_updated timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.certification_grade_leaderboard (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    grade_data_id uuid NOT NULL,
    user_id uuid NOT NULL,
    student_name character varying(128) NOT NULL,
    class_name character varying(128),
    achievement_rate numeric(5,2),
    grade_label character varying(4),
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    major_id uuid
);
CREATE TABLE public.certification_related_tasks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    cert_point_id uuid NOT NULL,
    task_id uuid NOT NULL,
    max_score numeric(7,2) DEFAULT 100 NOT NULL,
    weight numeric(5,2) DEFAULT 0 NOT NULL,
    tenant_id uuid
);
CREATE TABLE public.certification_rules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    career_position_id uuid NOT NULL,
    status character varying(16) NOT NULL,
    rule_source character varying(16) DEFAULT 'custom'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    tenant_id uuid,
    level_mapping jsonb DEFAULT '[]'::jsonb NOT NULL
);
CREATE TABLE public.course_knowledge_bindings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    course_id uuid NOT NULL,
    knowledge_point_id uuid NOT NULL,
    bind_type character varying(16) NOT NULL,
    source_id uuid,
    tenant_id uuid
);
CREATE TABLE public.course_resource_bindings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    course_id uuid NOT NULL,
    resource_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.courses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code character varying(64) NOT NULL,
    name character varying(256) NOT NULL,
    type character varying(16) NOT NULL,
    category character varying(32) NOT NULL,
    teacher_id uuid,
    version character varying(32),
    online_hours numeric(5,1),
    offline_hours numeric(5,1),
    online_weight numeric(5,2),
    offline_weight numeric(5,2),
    semester character varying(32),
    class_name character varying(128),
    status character varying(16) NOT NULL,
    cover_color character varying(16),
    cover_image text,
    course_tag character varying(64),
    creator_id uuid NOT NULL,
    co_creator_ids uuid[] DEFAULT '{}'::uuid[] NOT NULL,
    node_count integer DEFAULT 0 NOT NULL,
    resource_count integer DEFAULT 0 NOT NULL,
    study_count integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    tenant_id uuid,
    major_id uuid,
    industry_id uuid,
    batch_id uuid,
    difficulty integer,
    description text,
    knowledge_point_ids uuid[] DEFAULT '{}'::uuid[] NOT NULL,
    resource_ids uuid[] DEFAULT '{}'::uuid[] NOT NULL,
    CONSTRAINT chk_courses_status CHECK (((status)::text = ANY ((ARRAY['draft'::character varying, 'pending'::character varying, 'approved'::character varying, 'rejected'::character varying, 'published'::character varying, 'archived'::character varying])::text[])))
);
CREATE TABLE public.credit_conversion_rules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    material_type character varying(16) NOT NULL,
    level character varying(32) NOT NULL,
    credit numeric(5,1) NOT NULL,
    tenant_id uuid
);
CREATE TABLE public.evaluation_batches (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(128) NOT NULL,
    code character varying(64),
    org_node_id uuid,
    workflow_id uuid,
    status character varying(16) DEFAULT 'open'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    tenant_id uuid,
    major_id uuid
);
CREATE TABLE public.evaluation_method_categories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(64) NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    tenant_id uuid
);
CREATE TABLE public.evaluation_method_targets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    evaluation_method_id uuid NOT NULL,
    target_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.evaluation_methods (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    category_id uuid NOT NULL,
    name character varying(128) NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    sub_category_name character varying(128),
    description text,
    doc_link text,
    tenant_id uuid
);
CREATE TABLE public.exam_questions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    exam_id uuid NOT NULL,
    question_id uuid NOT NULL,
    type character varying(16) NOT NULL,
    content text NOT NULL,
    options jsonb,
    answer text NOT NULL,
    analysis text,
    score numeric(5,2) NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    tenant_id uuid
);
CREATE TABLE public.exam_results (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    exam_usage_id uuid NOT NULL,
    user_id uuid NOT NULL,
    student_name character varying(128),
    class_name character varying(128),
    grade character varying(64),
    score numeric(7,2) DEFAULT 0 NOT NULL,
    total_score numeric(7,2) DEFAULT 0 NOT NULL,
    is_pass boolean DEFAULT false NOT NULL,
    answers jsonb DEFAULT '{}'::jsonb NOT NULL,
    submit_time timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    tenant_id uuid,
    major_id uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.exam_usages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    exam_id uuid NOT NULL,
    name character varying(256) NOT NULL,
    description text,
    start_time timestamp with time zone,
    end_time timestamp with time zone,
    duration integer,
    target_type character varying(16),
    target_ids uuid[] DEFAULT '{}'::uuid[] NOT NULL,
    status character varying(16) DEFAULT 'draft'::character varying NOT NULL,
    creator_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    tenant_id uuid,
    major_id uuid
);
CREATE TABLE public.exams (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(256) NOT NULL,
    description text,
    status character varying(16) NOT NULL,
    total_score numeric(7,2) DEFAULT 0 NOT NULL,
    duration integer NOT NULL,
    cover_image text,
    creator_id uuid,
    collaborator_ids uuid[] DEFAULT '{}'::uuid[] NOT NULL,
    batch_id uuid,
    version character varying(32),
    owner_type character varying(16) DEFAULT 'mine'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    collaborator_dept_ids uuid[] DEFAULT '{}'::uuid[] NOT NULL,
    tenant_id uuid,
    is_temp boolean DEFAULT false NOT NULL,
    code character varying(64) NOT NULL,
    CONSTRAINT chk_exams_status CHECK (((status)::text = ANY ((ARRAY['draft'::character varying, 'pending'::character varying, 'approved'::character varying, 'rejected'::character varying, 'published'::character varying, 'archived'::character varying])::text[])))
);
CREATE TABLE public.favorite_counters (
    target_type character varying(64) DEFAULT 'career_position'::character varying NOT NULL,
    target_id uuid NOT NULL,
    cnt bigint DEFAULT 0 NOT NULL,
    updated_at timestamp with time zone DEFAULT now()
);
CREATE TABLE public.graduation_project_archives (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    topic_id uuid NOT NULL,
    user_id uuid NOT NULL,
    phase character varying(16) NOT NULL,
    doc_status character varying(16) NOT NULL,
    doc_count integer DEFAULT 0 NOT NULL,
    has_rectification boolean DEFAULT false NOT NULL,
    last_updated timestamp with time zone DEFAULT now() NOT NULL,
    tenant_id uuid
);
CREATE TABLE public.graduation_project_evaluations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    topic_id uuid NOT NULL,
    user_id uuid NOT NULL,
    advisor_score numeric(5,2),
    enterprise_score numeric(5,2),
    defense_score numeric(5,2),
    comprehensive_grade character varying(4),
    is_excellent boolean DEFAULT false NOT NULL,
    status character varying(16) DEFAULT 'pending'::character varying NOT NULL,
    evaluated_at timestamp with time zone DEFAULT now() NOT NULL,
    tenant_id uuid
);
CREATE TABLE public.graduation_project_topics (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(256) NOT NULL,
    career_position_id uuid NOT NULL,
    college character varying(128),
    source character varying(16) NOT NULL,
    status character varying(16) NOT NULL,
    capacity integer DEFAULT 0 NOT NULL,
    applied_count integer DEFAULT 0 NOT NULL,
    advisor_id uuid,
    enterprise_mentor_id uuid,
    start_date date,
    end_date date,
    description text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    tenant_id uuid
);
CREATE TABLE public.graduation_query_results (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    class_name character varying(128),
    credit_completed numeric(6,1) DEFAULT 0 NOT NULL,
    credit_required numeric(6,1) DEFAULT 0 NOT NULL,
    scene_passed integer DEFAULT 0 NOT NULL,
    scene_required integer DEFAULT 0 NOT NULL,
    project_grade character varying(4),
    graduation_status character varying(16) NOT NULL,
    ability_cert_status character varying(16) NOT NULL,
    rectification_count integer DEFAULT 0 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    tenant_id uuid,
    major_id uuid
);
CREATE TABLE public.hybrid_node_modules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    node_id uuid NOT NULL,
    module_key character varying(32) NOT NULL,
    mode character varying(8) DEFAULT 'online'::character varying NOT NULL,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    tenant_id uuid
);
CREATE TABLE public.industries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    code character varying(64) NOT NULL,
    name character varying(128) NOT NULL,
    parent_id uuid,
    enabled boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.institution_expertise_tags (
    id character varying(50) NOT NULL,
    tag_value character varying(100) NOT NULL,
    tenant_id uuid,
    institution_id uuid
);
CREATE TABLE public.institutions (
    type public.institution_type NOT NULL,
    name character varying(255) NOT NULL,
    credit_code character varying(50) NOT NULL,
    logo character varying(500),
    intro text,
    contact_name character varying(100) NOT NULL,
    contact_phone character varying(50) NOT NULL,
    contact_email character varying(255) NOT NULL,
    qualification_file character varying(500),
    status public.institution_status DEFAULT 'pending'::public.institution_status NOT NULL,
    org_code character varying(50) NOT NULL,
    balance numeric(15,2) DEFAULT 0 NOT NULL,
    total_spent numeric(15,2) DEFAULT 0 NOT NULL,
    total_income numeric(15,2) DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    tenant_id uuid,
    id uuid DEFAULT gen_random_uuid() NOT NULL
);
CREATE TABLE public.job_ability_aggregate_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid,
    career_position_id uuid,
    status character varying(16) DEFAULT 'running'::character varying NOT NULL,
    student_count integer DEFAULT 0 NOT NULL,
    updated_count integer DEFAULT 0 NOT NULL,
    error_message text,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    finished_at timestamp with time zone
);
CREATE TABLE public.job_ability_results (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    career_position_id uuid NOT NULL,
    user_id uuid NOT NULL,
    class_name character varying(128),
    total_ability_points integer DEFAULT 0 NOT NULL,
    achieved_ability_points integer DEFAULT 0 NOT NULL,
    achievement_rate numeric(5,2),
    grade character varying(16),
    evaluated_at timestamp with time zone DEFAULT now() NOT NULL,
    tenant_id uuid,
    major_id uuid,
    major_name character varying(128),
    ability_point_details jsonb DEFAULT '[]'::jsonb NOT NULL,
    grade_history jsonb DEFAULT '[]'::jsonb NOT NULL
);
CREATE TABLE public.knowledge_points (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(256) NOT NULL,
    code character varying(64),
    description text,
    linked boolean DEFAULT false NOT NULL,
    granular_lesson_ids uuid[] DEFAULT '{}'::uuid[] NOT NULL,
    creator_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    tenant_id uuid,
    category character varying(64)
);
CREATE TABLE public.learn_roads (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(256) NOT NULL,
    description text,
    position_ids uuid[] DEFAULT '{}'::uuid[] NOT NULL,
    steps jsonb DEFAULT '[]'::jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    tenant_id uuid
);
CREATE TABLE public.lesson_batches (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(128) NOT NULL,
    code character varying(64),
    org_node_id uuid,
    workflow_id uuid,
    status character varying(16) DEFAULT 'active'::character varying NOT NULL,
    course_count integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    tenant_id uuid,
    major_id uuid
);
CREATE TABLE public.lesson_behavior_records (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    course_id uuid NOT NULL,
    student_user_id uuid NOT NULL,
    record_date date DEFAULT CURRENT_DATE NOT NULL,
    attendance character varying(16) DEFAULT 'present'::character varying NOT NULL,
    quiz_score numeric(5,2),
    interaction_count integer DEFAULT 0 NOT NULL,
    praise_count integer DEFAULT 0 NOT NULL,
    rush_correct_count integer DEFAULT 0 NOT NULL,
    rush_avg_time_sec integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    tenant_id uuid
);
CREATE TABLE public.login_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    user_id uuid,
    user_name character varying(64),
    ip character varying(45),
    location character varying(128),
    device character varying(256),
    status character varying(16),
    created_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.majors (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    code character varying(64) NOT NULL,
    name character varying(128) NOT NULL,
    alias character varying(128),
    enabled boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.micro_cert_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title character varying(256) NOT NULL,
    cert_type_id uuid NOT NULL,
    cert_type_name character varying(128),
    content text,
    cover_image text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    tenant_id uuid
);
CREATE TABLE public.node_ability_point_bindings (
    node_id uuid NOT NULL,
    ability_point_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.node_homeworks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    node_id uuid NOT NULL,
    title character varying(256) NOT NULL,
    requirement text,
    need_attachment boolean DEFAULT false NOT NULL,
    deadline timestamp with time zone,
    tenant_id uuid
);
CREATE TABLE public.node_knowledge_point_bindings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    node_id uuid NOT NULL,
    knowledge_point_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.node_quiz_questions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    quiz_id uuid NOT NULL,
    type character varying(16) NOT NULL,
    question text NOT NULL,
    options jsonb,
    answer text,
    score numeric(5,2) DEFAULT 0 NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    tenant_id uuid
);
CREATE TABLE public.node_quizzes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    node_id uuid NOT NULL,
    title character varying(256) NOT NULL,
    type character varying(16) NOT NULL,
    time_limit integer,
    tenant_id uuid
);
CREATE TABLE public.node_resource_bindings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    node_id uuid NOT NULL,
    resource_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    tenant_id uuid
);
CREATE TABLE public.node_resources (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    node_id uuid NOT NULL,
    name character varying(256) NOT NULL,
    type character varying(32) NOT NULL,
    url text NOT NULL,
    size integer,
    tenant_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.on_site_question_library (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    question_text text NOT NULL,
    answer text,
    question_type character varying(32) DEFAULT 'short_answer'::character varying NOT NULL,
    score double precision DEFAULT 0,
    difficulty character varying(16),
    knowledge_point_ids uuid[],
    tags text[],
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    creator_id uuid
);
CREATE TABLE public.operation_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    user_id uuid,
    user_name character varying(64),
    module character varying(64),
    action character varying(64) NOT NULL,
    target_type character varying(64),
    target_id uuid,
    detail text,
    ip character varying(45),
    status character varying(16),
    created_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.orders (
    order_no character varying(100) NOT NULL,
    price numeric(15,2) NOT NULL,
    platform_fee numeric(15,2) DEFAULT 0 NOT NULL,
    seller_income numeric(15,2) DEFAULT 0 NOT NULL,
    status public.order_status DEFAULT 'pending'::public.order_status NOT NULL,
    paid_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    tenant_id uuid,
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    resource_id uuid,
    buyer_id uuid,
    seller_id uuid
);
CREATE TABLE public.org_types (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    name character varying(64) NOT NULL,
    category character varying(16) NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    is_default boolean DEFAULT false NOT NULL
);
CREATE TABLE public.organizations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    name character varying(128) NOT NULL,
    type_id uuid NOT NULL,
    parent_id uuid,
    sort_order integer DEFAULT 0 NOT NULL,
    member_count integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.platform_configs (
    key character varying(100) NOT NULL,
    value text NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.platform_links (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    platform character varying(64) NOT NULL,
    url text,
    enabled boolean DEFAULT true NOT NULL,
    tenant_id uuid
);
CREATE TABLE public.position_ability_bindings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    career_position_id uuid NOT NULL,
    responsibility_id uuid NOT NULL,
    ability_point_id uuid NOT NULL,
    source character varying(16) DEFAULT 'custom'::character varying NOT NULL,
    domain character varying(128),
    required_level character varying(32) NOT NULL,
    rubric_description text,
    attributes text[] DEFAULT '{}'::text[] NOT NULL,
    weight numeric(5,2) DEFAULT 0 NOT NULL,
    tenant_id uuid,
    CONSTRAINT chk_position_ability_bindings_weight CHECK (((weight >= (0)::numeric) AND (weight <= (100)::numeric)))
);
CREATE TABLE public.position_certificates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    career_position_id uuid NOT NULL,
    tenant_id uuid,
    certificate_library_id uuid NOT NULL
);
CREATE TABLE public.position_favorites (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    career_position_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.position_recommendations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    career_position_id uuid NOT NULL,
    position_type character varying(16) NOT NULL,
    reason text,
    sort_order integer DEFAULT 0 NOT NULL,
    is_enabled boolean DEFAULT true NOT NULL,
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    tenant_id uuid,
    major_id uuid
);
CREATE TABLE public.position_responsibilities (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    career_position_id uuid NOT NULL,
    name character varying(256) NOT NULL,
    description text,
    sort_order integer DEFAULT 0 NOT NULL,
    tenant_id uuid
);
CREATE TABLE public.question_bank_knowledge_points (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    question_bank_id uuid NOT NULL,
    knowledge_point_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.question_banks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(256) NOT NULL,
    description text,
    cover_image text,
    status character varying(16) NOT NULL,
    question_count integer DEFAULT 0 NOT NULL,
    creator_id uuid NOT NULL,
    collaborator_ids uuid[] DEFAULT '{}'::uuid[] NOT NULL,
    batch_id uuid,
    version character varying(32),
    owner_type character varying(16) NOT NULL,
    is_draft_pool boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    collaborator_dept_ids uuid[] DEFAULT '{}'::uuid[] NOT NULL,
    tenant_id uuid,
    code character varying(64) NOT NULL,
    CONSTRAINT chk_question_banks_status CHECK (((status)::text = ANY ((ARRAY['draft'::character varying, 'pending'::character varying, 'approved'::character varying, 'rejected'::character varying, 'published'::character varying, 'archived'::character varying])::text[])))
);
CREATE TABLE public.questions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bank_id uuid NOT NULL,
    type character varying(16) NOT NULL,
    content text NOT NULL,
    options jsonb,
    answer text NOT NULL,
    analysis text,
    score numeric(5,2) DEFAULT 0 NOT NULL,
    difficulty character varying(8),
    knowledge_point_ids uuid[] DEFAULT '{}'::uuid[] NOT NULL,
    creator_id uuid,
    source character varying(64),
    status character varying(16) DEFAULT 'draft'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    tenant_id uuid,
    code character varying(64) NOT NULL,
    CONSTRAINT chk_questions_status CHECK (((status)::text = ANY ((ARRAY['draft'::character varying, 'pending'::character varying, 'approved'::character varying, 'rejected'::character varying, 'published'::character varying, 'archived'::character varying])::text[])))
);
CREATE TABLE public.random_draw_questions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    name character varying(256) NOT NULL,
    description text,
    answer text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    major_id uuid
);
CREATE TABLE public.resource_codes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    code character varying(64) NOT NULL,
    name character varying(128) NOT NULL,
    description text,
    type character varying(16) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.resource_library (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    name character varying(256) NOT NULL,
    resource_type public.resource_type NOT NULL,
    url text,
    description text,
    thumbnail text,
    file_size bigint,
    metadata jsonb DEFAULT '{}'::jsonb,
    uploaded_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.resource_tags (
    id character varying(50) NOT NULL,
    tag_type character varying(50) NOT NULL,
    tag_value character varying(100) NOT NULL,
    tenant_id uuid,
    resource_id uuid
);
CREATE TABLE public.resources (
    name character varying(255) NOT NULL,
    intro text,
    category character varying(50) NOT NULL,
    cover_image character varying(500),
    attachment character varying(500),
    attachment_name character varying(255),
    price numeric(15,2) DEFAULT 0 NOT NULL,
    version character varying(50) DEFAULT 'v1.0'::character varying NOT NULL,
    status public.resource_status DEFAULT 'draft'::public.resource_status NOT NULL,
    reject_reason text,
    sales_count integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    tenant_id uuid,
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    institution_id uuid
);
CREATE TABLE public.roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    code character varying(64) NOT NULL,
    name character varying(64) NOT NULL,
    description text,
    permissions jsonb DEFAULT '{}'::jsonb NOT NULL,
    user_count integer DEFAULT 0 NOT NULL,
    status character varying(16) DEFAULT 'active'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.rubric_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    name character varying(256) NOT NULL,
    mode character varying(16) NOT NULL,
    types character varying(32)[] DEFAULT '{}'::character varying[] NOT NULL,
    description text,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    is_deleted boolean DEFAULT false NOT NULL,
    CONSTRAINT rubric_templates_mode_check CHECK (((mode)::text = ANY ((ARRAY['rubric'::character varying, 'score_rule'::character varying])::text[])))
);
CREATE TABLE public.scenario_grade_mappings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    scenario_id uuid NOT NULL,
    task_id uuid,
    level character varying(4) NOT NULL,
    min_score numeric(7,2) NOT NULL,
    max_score numeric(7,2) NOT NULL,
    description text,
    color character varying(16),
    tenant_id uuid
);
CREATE TABLE public.scenario_tasks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    scenario_id uuid NOT NULL,
    name character varying(256) NOT NULL,
    code character varying(64) NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    description text,
    detailed_description text,
    estimated_hours numeric(5,1) DEFAULT 0 NOT NULL,
    task_type character varying(16) NOT NULL,
    difficulty smallint,
    background text,
    dependency_ids uuid[] DEFAULT '{}'::uuid[] NOT NULL,
    is_referenced boolean DEFAULT false NOT NULL,
    source_scenario_id uuid,
    tenant_id uuid,
    knowledge_point_ids uuid[] DEFAULT '{}'::uuid[] NOT NULL,
    ability_point_ids uuid[] DEFAULT '{}'::uuid[] NOT NULL,
    resource_ids uuid[] DEFAULT '{}'::uuid[] NOT NULL,
    eval_data jsonb DEFAULT '{}'::jsonb NOT NULL,
    description_pdf text,
    CONSTRAINT scenario_tasks_difficulty_check CHECK (((difficulty >= 1) AND (difficulty <= 5)))
);
CREATE TABLE public.scenario_weight_configs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    scenario_id uuid NOT NULL,
    task_id uuid NOT NULL,
    weight numeric(5,2) NOT NULL,
    tenant_id uuid,
    CONSTRAINT chk_scenario_weight_configs_weight CHECK (((weight >= (0)::numeric) AND (weight <= (100)::numeric)))
);
CREATE TABLE public.scenarios (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(256) NOT NULL,
    code character varying(64) NOT NULL,
    cover_image text,
    career_position_id uuid,
    profession_id uuid,
    profession_name character varying(128),
    batch_id uuid,
    difficulty smallint,
    version character varying(32) NOT NULL,
    status character varying(16) NOT NULL,
    background text,
    delivery_goal text,
    creator_id uuid NOT NULL,
    co_builder_ids uuid[] DEFAULT '{}'::uuid[] NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    publish_time timestamp with time zone,
    tenant_id uuid,
    industry_id uuid,
    industry_ids character varying(64)[] DEFAULT '{}'::character varying[] NOT NULL,
    profession_ids uuid[] DEFAULT '{}'::uuid[] NOT NULL,
    CONSTRAINT chk_scenarios_status CHECK (((status)::text = ANY ((ARRAY['draft'::character varying, 'pending'::character varying, 'approved'::character varying, 'rejected'::character varying, 'published'::character varying, 'archived'::character varying])::text[]))),
    CONSTRAINT scenarios_difficulty_check CHECK (((difficulty >= 1) AND (difficulty <= 5)))
);
CREATE TABLE public.scene_archives (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    scenario_id uuid NOT NULL,
    version character varying(32) NOT NULL,
    snapshot_data jsonb NOT NULL,
    archived_at timestamp with time zone DEFAULT now() NOT NULL,
    tenant_id uuid
);
CREATE TABLE public.scene_batches (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(128) NOT NULL,
    code character varying(64),
    org_node_id uuid,
    workflow_id uuid,
    status character varying(16) DEFAULT 'open'::character varying NOT NULL,
    scenario_count integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    tenant_id uuid,
    major_id uuid
);
CREATE TABLE public.scene_evaluation_results (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    task_id uuid NOT NULL,
    scene_id uuid,
    method_key character varying(32) NOT NULL,
    evaluatee_id uuid NOT NULL,
    evaluator_id uuid,
    evaluator_type character varying(16),
    status character varying(16) NOT NULL,
    total_score numeric(7,2),
    max_score numeric(7,2) DEFAULT 100 NOT NULL,
    eval_point_scores jsonb DEFAULT '{}'::jsonb,
    objective_answers jsonb DEFAULT '{}'::jsonb,
    subjective_content jsonb DEFAULT '{}'::jsonb,
    drawn_questions jsonb DEFAULT '{}'::jsonb,
    comment text,
    graded_at timestamp with time zone,
    graded_by uuid,
    tenant_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);
    version character varying(255) NOT NULL,
    applied_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.staff_titles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    code character varying(64) NOT NULL,
    name character varying(64) NOT NULL,
    description text,
    user_count integer DEFAULT 0 NOT NULL,
    status character varying(16) DEFAULT 'active'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.student_ability_archives (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    material_type character varying(16) NOT NULL,
    material_name character varying(256) NOT NULL,
    issuing_org character varying(256),
    obtain_date date,
    level character varying(32),
    audit_status character varying(16) DEFAULT 'pending'::character varying NOT NULL,
    audit_remark text,
    converted_credit numeric(5,1) DEFAULT 0 NOT NULL,
    direction character varying(16) DEFAULT 'positive'::character varying NOT NULL,
    is_enabled boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    tenant_id uuid
);
CREATE TABLE public.student_ability_portraits (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    career_position_id uuid NOT NULL,
    overall_grade character varying(16),
    domain_scores jsonb DEFAULT '[]'::jsonb,
    class_rank integer,
    class_total integer,
    major_rank integer,
    major_total integer,
    completed_courses integer DEFAULT 0 NOT NULL,
    completed_scenes integer DEFAULT 0 NOT NULL,
    total_credits numeric(6,1) DEFAULT 0 NOT NULL,
    course_records jsonb DEFAULT '[]'::jsonb,
    graduation_qualified boolean DEFAULT false NOT NULL,
    attendance_rate numeric(5,2),
    diploma_badge character varying(64),
    dual_badge character varying(64),
    archive_count integer DEFAULT 0 NOT NULL,
    recommend_positions jsonb DEFAULT '[]'::jsonb,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    tenant_id uuid,
    major_id uuid
);
CREATE TABLE public.subscription_packages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    name character varying(128) NOT NULL,
    valid_until date,
    modules jsonb DEFAULT '{}'::jsonb NOT NULL,
    status character varying(16) DEFAULT 'active'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.system_course_nodes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    course_id uuid NOT NULL,
    parent_id uuid,
    name character varying(256) NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    ref_type character varying(16) DEFAULT 'normal'::character varying NOT NULL,
    source_id uuid,
    source_name character varying(256),
    teaching_goals text,
    duration integer,
    status character varying(16) DEFAULT 'draft'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    tenant_id uuid,
    knowledge_point_ids uuid[] DEFAULT '{}'::uuid[] NOT NULL,
    resource_ids uuid[] DEFAULT '{}'::uuid[] NOT NULL,
    difficulty integer,
    ability_point_ids uuid[] DEFAULT '{}'::uuid[] NOT NULL,
    code character varying(64),
    detailed_description text,
    description_pdf character varying(512),
    background text,
    estimated_hours numeric(5,1),
    eval_data jsonb DEFAULT '{}'::jsonb NOT NULL
);
CREATE TABLE public.task_ability_bindings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    task_id uuid NOT NULL,
    ability_point_id uuid NOT NULL,
    tenant_id uuid
);
CREATE TABLE public.task_deliverables (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    task_id uuid NOT NULL,
    type character varying(32) NOT NULL,
    name character varying(256) NOT NULL,
    description text,
    evaluation_points jsonb DEFAULT '{}'::jsonb,
    sort_order integer DEFAULT 0 NOT NULL,
    tenant_id uuid
);
CREATE TABLE public.task_eval_points (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    config_id uuid NOT NULL,
    name character varying(256) NOT NULL,
    description text,
    sub_type character varying(32),
    types character varying(32)[] DEFAULT '{}'::character varying[] NOT NULL,
    weight numeric(5,2) DEFAULT 0 NOT NULL,
    scoring_method character varying(16) DEFAULT 'level'::character varying NOT NULL,
    grade_mapping jsonb DEFAULT '[]'::jsonb NOT NULL,
    knowledge_point_ids uuid[] DEFAULT '{}'::uuid[] NOT NULL,
    ability_point_ids uuid[] DEFAULT '{}'::uuid[] NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.task_evaluation_methods (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    task_id uuid NOT NULL,
    method_key character varying(32) NOT NULL,
    weight numeric(5,2) DEFAULT 0 NOT NULL,
    eval_object character varying(16) DEFAULT 'individual'::character varying NOT NULL,
    score_type character varying(32),
    eval_subjects jsonb DEFAULT '[]'::jsonb NOT NULL,
    rubric_template_id uuid,
    resource_config jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    is_enabled boolean DEFAULT true NOT NULL
);
CREATE TABLE public.task_knowledge_bindings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    task_id uuid NOT NULL,
    knowledge_point_id uuid NOT NULL,
    tenant_id uuid
);
CREATE TABLE public.task_resource_bindings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    task_id uuid NOT NULL,
    resource_id uuid NOT NULL,
    tenant_id uuid
);
CREATE TABLE public.task_resources (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(256) NOT NULL,
    type character varying(32) NOT NULL,
    url text,
    description text,
    thumbnail text,
    uploaded_by uuid,
    uploaded_at timestamp with time zone DEFAULT now() NOT NULL,
    tenant_id uuid,
    size character varying(16),
    knowledge_point_ids uuid[] DEFAULT '{}'::uuid[] NOT NULL,
    extra_data jsonb DEFAULT '{}'::jsonb NOT NULL
);
CREATE TABLE public.task_review_steps (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    config_id uuid NOT NULL,
    label character varying(64) NOT NULL,
    description text,
    enabled boolean DEFAULT true NOT NULL,
    subject_type character varying(32),
    weight numeric(5,2) DEFAULT 0 NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.tenants (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(128) NOT NULL,
    code character varying(64) NOT NULL,
    logo_url text,
    domain character varying(256),
    enterprise_code character varying(64),
    contact character varying(128),
    phone character varying(32),
    address text,
    description text,
    admin_ids uuid[] DEFAULT '{}'::uuid[] NOT NULL,
    status character varying(16) DEFAULT 'active'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.user_extension_fields (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    field_key character varying(64) NOT NULL,
    field_name character varying(64) NOT NULL,
    field_type character varying(16) NOT NULL,
    is_enabled boolean DEFAULT true NOT NULL,
    is_required boolean DEFAULT false NOT NULL,
    slot_number integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    applicable_role_codes text[] DEFAULT '{}'::text[] NOT NULL,
    CONSTRAINT user_extension_fields_slot_number_check CHECK (((slot_number >= 1) AND (slot_number <= 20)))
);
CREATE TABLE public.user_relations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    initiator_id uuid NOT NULL,
    initiator_org_node_id uuid,
    target_id uuid NOT NULL,
    target_org_node_id uuid,
    relation_type character varying(16) NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.user_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    role_id uuid NOT NULL
);
CREATE TABLE public.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid,
    org_node_id uuid,
    major_id uuid,
    role public.user_role DEFAULT 'operator'::public.user_role NOT NULL,
    login_name character varying(255),
    username character varying(100),
    password_hash character varying(255) NOT NULL,
    name character varying(100) NOT NULL,
    email character varying(255),
    phone character varying(32),
    avatar_url text,
    student_no character varying(64),
    work_id character varying(64),
    id_card character varying(32),
    title_ids uuid[] DEFAULT '{}'::uuid[] NOT NULL,
    oauth jsonb DEFAULT '{}'::jsonb,
    status character varying(20) DEFAULT 'active'::character varying NOT NULL,
    last_login_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    platform character varying(16) DEFAULT 'saas'::character varying NOT NULL,
    institution_id uuid,
    graduate_year integer
);
CREATE TABLE public.view_counters (
    target_type character varying(64) NOT NULL,
    target_id uuid NOT NULL,
    cnt bigint DEFAULT 0 NOT NULL,
    updated_at timestamp with time zone DEFAULT now()
);
CREATE TABLE public.view_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    target_type character varying(32) NOT NULL,
    target_id uuid NOT NULL,
    user_id uuid,
    tenant_id uuid,
    viewed_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.withdrawals (
    amount numeric(15,2) NOT NULL,
    account_type character varying(20) NOT NULL,
    account_info character varying(500) NOT NULL,
    status public.withdrawal_status DEFAULT 'pending'::public.withdrawal_status NOT NULL,
    handled_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    tenant_id uuid,
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    institution_id uuid
);
CREATE TABLE public.workflows (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid,
    name character varying(128) NOT NULL,
    scene character varying(64),
    description text,
    steps jsonb DEFAULT '[]'::jsonb NOT NULL,
    usage_count integer DEFAULT 0 NOT NULL,
    status character varying(16) DEFAULT 'active'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    major_ids jsonb DEFAULT '[]'::jsonb NOT NULL
);
ALTER TABLE ONLY public.ability_domains
    ADD CONSTRAINT ability_domains_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.ability_points
    ADD CONSTRAINT ability_points_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.announcements
    ADD CONSTRAINT announcements_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.app_modules
    ADD CONSTRAINT app_modules_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.appeal_records
    ADD CONSTRAINT appeal_records_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.approval_records
    ADD CONSTRAINT approval_records_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.authorizations
    ADD CONSTRAINT authorizations_auth_code_key UNIQUE (auth_code);
ALTER TABLE ONLY public.authorizations
    ADD CONSTRAINT authorizations_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.banner_configs
    ADD CONSTRAINT banner_configs_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.banners
    ADD CONSTRAINT banners_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.batches
    ADD CONSTRAINT batches_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.career_position_majors
    ADD CONSTRAINT career_position_majors_career_position_id_major_id_key UNIQUE (career_position_id, major_id);
ALTER TABLE ONLY public.career_position_majors
    ADD CONSTRAINT career_position_majors_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.career_positions
    ADD CONSTRAINT career_positions_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.cert_issuance_records
    ADD CONSTRAINT cert_issuance_records_cert_number_key UNIQUE (cert_number);
ALTER TABLE ONLY public.cert_issuance_records
    ADD CONSTRAINT cert_issuance_records_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.certificate_library
    ADD CONSTRAINT certificate_library_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.certification_ability_items
    ADD CONSTRAINT certification_ability_items_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.certification_ability_points
    ADD CONSTRAINT certification_ability_points_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.certification_competency_requirements
    ADD CONSTRAINT certification_competency_requirements_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.certification_grade_data
    ADD CONSTRAINT certification_grade_data_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.certification_grade_data
    ADD CONSTRAINT certification_grade_data_position_id_grade_year_key UNIQUE (position_id, grade_year);
ALTER TABLE ONLY public.certification_grade_leaderboard
    ADD CONSTRAINT certification_grade_leaderboard_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.certification_related_tasks
    ADD CONSTRAINT certification_related_tasks_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.certification_rules
    ADD CONSTRAINT certification_rules_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.course_knowledge_bindings
    ADD CONSTRAINT course_knowledge_bindings_course_id_knowledge_point_id_bind_key UNIQUE (course_id, knowledge_point_id, bind_type, source_id);
ALTER TABLE ONLY public.course_knowledge_bindings
    ADD CONSTRAINT course_knowledge_bindings_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.course_resource_bindings
    ADD CONSTRAINT course_resource_bindings_course_id_resource_id_key UNIQUE (course_id, resource_id);
ALTER TABLE ONLY public.course_resource_bindings
    ADD CONSTRAINT course_resource_bindings_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.courses
    ADD CONSTRAINT courses_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.credit_conversion_rules
    ADD CONSTRAINT credit_conversion_rules_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.evaluation_batches
    ADD CONSTRAINT evaluation_batches_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.evaluation_method_categories
    ADD CONSTRAINT evaluation_method_categories_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.evaluation_method_targets
    ADD CONSTRAINT evaluation_method_targets_evaluation_method_id_target_id_key UNIQUE (evaluation_method_id, target_id);
ALTER TABLE ONLY public.evaluation_method_targets
    ADD CONSTRAINT evaluation_method_targets_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.evaluation_methods
    ADD CONSTRAINT evaluation_methods_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.exam_questions
    ADD CONSTRAINT exam_questions_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.exam_results
    ADD CONSTRAINT exam_results_exam_usage_id_user_id_key UNIQUE (exam_usage_id, user_id);
ALTER TABLE ONLY public.exam_results
    ADD CONSTRAINT exam_results_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.exam_usages
    ADD CONSTRAINT exam_usages_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.exams
    ADD CONSTRAINT exams_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.favorite_counters
    ADD CONSTRAINT favorite_counters_pkey PRIMARY KEY (target_type, target_id);
ALTER TABLE ONLY public.graduation_project_archives
    ADD CONSTRAINT graduation_project_archives_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.graduation_project_evaluations
    ADD CONSTRAINT graduation_project_evaluations_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.graduation_project_topics
    ADD CONSTRAINT graduation_project_topics_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.graduation_query_results
    ADD CONSTRAINT graduation_query_results_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.hybrid_node_modules
    ADD CONSTRAINT hybrid_node_modules_node_id_module_key_key UNIQUE (node_id, module_key);
ALTER TABLE ONLY public.hybrid_node_modules
    ADD CONSTRAINT hybrid_node_modules_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.industries
    ADD CONSTRAINT industries_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.institution_expertise_tags
    ADD CONSTRAINT institution_expertise_tags_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.institutions
    ADD CONSTRAINT institutions_credit_code_key UNIQUE (credit_code);
ALTER TABLE ONLY public.institutions
    ADD CONSTRAINT institutions_org_code_key UNIQUE (org_code);
ALTER TABLE ONLY public.institutions
    ADD CONSTRAINT institutions_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.job_ability_aggregate_logs
    ADD CONSTRAINT job_ability_aggregate_logs_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.job_ability_results
    ADD CONSTRAINT job_ability_results_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.knowledge_points
    ADD CONSTRAINT knowledge_points_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.learn_roads
    ADD CONSTRAINT learn_roads_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.lesson_batches
    ADD CONSTRAINT lesson_batches_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.lesson_behavior_records
    ADD CONSTRAINT lesson_behavior_records_course_id_student_user_id_record_da_key UNIQUE (course_id, student_user_id, record_date);
ALTER TABLE ONLY public.lesson_behavior_records
    ADD CONSTRAINT lesson_behavior_records_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.login_logs
    ADD CONSTRAINT login_logs_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.majors
    ADD CONSTRAINT majors_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.micro_cert_templates
    ADD CONSTRAINT micro_cert_templates_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.node_ability_point_bindings
    ADD CONSTRAINT node_ability_point_bindings_pkey PRIMARY KEY (node_id, ability_point_id);
ALTER TABLE ONLY public.node_homeworks
    ADD CONSTRAINT node_homeworks_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.node_knowledge_point_bindings
    ADD CONSTRAINT node_knowledge_point_bindings_node_id_knowledge_point_id_key UNIQUE (node_id, knowledge_point_id);
ALTER TABLE ONLY public.node_knowledge_point_bindings
    ADD CONSTRAINT node_knowledge_point_bindings_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.node_quiz_questions
    ADD CONSTRAINT node_quiz_questions_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.node_quizzes
    ADD CONSTRAINT node_quizzes_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.node_resource_bindings
    ADD CONSTRAINT node_resource_bindings_node_id_resource_id_key UNIQUE (node_id, resource_id);
ALTER TABLE ONLY public.node_resource_bindings
    ADD CONSTRAINT node_resource_bindings_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.node_resources
    ADD CONSTRAINT node_resources_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.on_site_question_library
    ADD CONSTRAINT on_site_question_library_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.operation_logs
    ADD CONSTRAINT operation_logs_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_order_no_key UNIQUE (order_no);
ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.org_types
    ADD CONSTRAINT org_types_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.platform_configs
    ADD CONSTRAINT platform_configs_pkey PRIMARY KEY (key);
ALTER TABLE ONLY public.platform_links
    ADD CONSTRAINT platform_links_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.platform_links
    ADD CONSTRAINT platform_links_platform_key UNIQUE (platform);
ALTER TABLE ONLY public.position_ability_bindings
    ADD CONSTRAINT position_ability_bindings_career_position_id_responsibility_key UNIQUE (career_position_id, responsibility_id, ability_point_id);
ALTER TABLE ONLY public.position_ability_bindings
    ADD CONSTRAINT position_ability_bindings_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.position_certificates
    ADD CONSTRAINT position_certificates_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.position_favorites
    ADD CONSTRAINT position_favorites_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.position_favorites
    ADD CONSTRAINT position_favorites_user_id_career_position_id_key UNIQUE (user_id, career_position_id);
ALTER TABLE ONLY public.position_recommendations
    ADD CONSTRAINT position_recommendations_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.position_responsibilities
    ADD CONSTRAINT position_responsibilities_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.question_bank_knowledge_points
    ADD CONSTRAINT question_bank_knowledge_point_question_bank_id_knowledge_po_key UNIQUE (question_bank_id, knowledge_point_id);
ALTER TABLE ONLY public.question_bank_knowledge_points
    ADD CONSTRAINT question_bank_knowledge_points_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.question_banks
    ADD CONSTRAINT question_banks_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.questions
    ADD CONSTRAINT questions_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.random_draw_questions
    ADD CONSTRAINT random_draw_questions_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.resource_codes
    ADD CONSTRAINT resource_codes_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.resource_library
    ADD CONSTRAINT resource_library_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.resource_tags
    ADD CONSTRAINT resource_tags_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.resources
    ADD CONSTRAINT resources_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.rubric_templates
    ADD CONSTRAINT rubric_templates_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.scenario_grade_mappings
    ADD CONSTRAINT scenario_grade_mappings_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.scenario_tasks
    ADD CONSTRAINT scenario_tasks_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.scenario_weight_configs
    ADD CONSTRAINT scenario_weight_configs_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.scenario_weight_configs
    ADD CONSTRAINT scenario_weight_configs_scenario_id_task_id_key UNIQUE (scenario_id, task_id);
ALTER TABLE ONLY public.scenarios
    ADD CONSTRAINT scenarios_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.scene_archives
    ADD CONSTRAINT scene_archives_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.scene_batches
    ADD CONSTRAINT scene_batches_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.scene_evaluation_results
    ADD CONSTRAINT scene_evaluation_results_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.scene_evaluation_results
    ADD CONSTRAINT scene_evaluation_results_task_id_evaluatee_id_method_key_key UNIQUE (task_id, evaluatee_id, method_key);
ALTER TABLE ONLY public.staff_titles
    ADD CONSTRAINT staff_titles_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.student_ability_archives
    ADD CONSTRAINT student_ability_archives_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.student_ability_portraits
    ADD CONSTRAINT student_ability_portraits_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.subscription_packages
    ADD CONSTRAINT subscription_packages_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.system_course_nodes
    ADD CONSTRAINT system_course_nodes_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.task_ability_bindings
    ADD CONSTRAINT task_ability_bindings_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.task_ability_bindings
    ADD CONSTRAINT task_ability_bindings_task_id_ability_point_id_key UNIQUE (task_id, ability_point_id);
ALTER TABLE ONLY public.task_deliverables
    ADD CONSTRAINT task_deliverables_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.task_eval_points
    ADD CONSTRAINT task_eval_points_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.task_evaluation_methods
    ADD CONSTRAINT task_evaluation_methods_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.task_evaluation_methods
    ADD CONSTRAINT task_evaluation_methods_task_id_method_key_key UNIQUE (task_id, method_key);
ALTER TABLE ONLY public.task_knowledge_bindings
    ADD CONSTRAINT task_knowledge_bindings_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.task_knowledge_bindings
    ADD CONSTRAINT task_knowledge_bindings_task_id_knowledge_point_id_key UNIQUE (task_id, knowledge_point_id);
ALTER TABLE ONLY public.task_resource_bindings
    ADD CONSTRAINT task_resource_bindings_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.task_resource_bindings
    ADD CONSTRAINT task_resource_bindings_task_id_resource_id_key UNIQUE (task_id, resource_id);
ALTER TABLE ONLY public.task_resources
    ADD CONSTRAINT task_resources_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.task_review_steps
    ADD CONSTRAINT task_review_steps_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.tenants
    ADD CONSTRAINT tenants_code_key UNIQUE (code);
ALTER TABLE ONLY public.tenants
    ADD CONSTRAINT tenants_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.certification_rules
    ADD CONSTRAINT uq_certification_rules_position UNIQUE (career_position_id);
ALTER TABLE ONLY public.user_extension_fields
    ADD CONSTRAINT user_extension_fields_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.user_relations
    ADD CONSTRAINT user_relations_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_role_id_key UNIQUE (user_id, role_id);
ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey1 PRIMARY KEY (id);
ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_tenant_platform_username UNIQUE (tenant_id, platform, username);
ALTER TABLE ONLY public.view_counters
    ADD CONSTRAINT view_counters_pkey PRIMARY KEY (target_type, target_id);
ALTER TABLE ONLY public.view_logs
    ADD CONSTRAINT view_logs_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.withdrawals
    ADD CONSTRAINT withdrawals_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.workflows
    ADD CONSTRAINT workflows_pkey PRIMARY KEY (id);
CREATE INDEX idx_ability_domains_position ON public.ability_domains USING btree (career_position_id);
CREATE INDEX idx_ability_points_category ON public.ability_points USING btree (category);
CREATE INDEX idx_ability_points_creator ON public.ability_points USING btree (creator_id);
CREATE INDEX idx_abilitydomains_tenant ON public.ability_domains USING btree (tenant_id);
CREATE INDEX idx_abilitypoints_tenant ON public.ability_points USING btree (tenant_id);
CREATE INDEX idx_announcements_created ON public.announcements USING btree (created_at DESC);
CREATE INDEX idx_announcements_roles ON public.announcements USING gin (target_roles);
CREATE INDEX idx_announcements_tenant ON public.announcements USING btree (tenant_id);
CREATE INDEX idx_app_modules_platform ON public.app_modules USING btree (platform);
CREATE INDEX idx_appeal_records_user ON public.appeal_records USING btree (user_id);
CREATE INDEX idx_appealrecords_tenant ON public.appeal_records USING btree (tenant_id);
CREATE INDEX idx_appmodules_tenant ON public.app_modules USING btree (tenant_id);
CREATE INDEX idx_approval_records_status ON public.approval_records USING btree (status);
CREATE INDEX idx_approval_records_submitter ON public.approval_records USING btree (submitter_id);
CREATE INDEX idx_approval_records_target ON public.approval_records USING btree (target_type, target_id);
CREATE INDEX idx_authorizations_buyer_resource ON public.authorizations USING btree (buyer_id, resource_id);
CREATE INDEX idx_authorizations_tenant ON public.authorizations USING btree (tenant_id);
CREATE INDEX idx_bannerconfigs_tenant ON public.banner_configs USING btree (tenant_id);
CREATE INDEX idx_banners_tenant ON public.banners USING btree (tenant_id);
CREATE INDEX idx_batches_org_node ON public.batches USING btree (org_node_id);
CREATE INDEX idx_batches_tenant ON public.batches USING btree (tenant_id);
CREATE INDEX idx_career_position_majors_major ON public.career_position_majors USING btree (major_id);
CREATE INDEX idx_career_position_majors_position ON public.career_position_majors USING btree (career_position_id);
CREATE INDEX idx_career_positions_batch ON public.career_positions USING btree (batch_id);
CREATE INDEX idx_career_positions_status ON public.career_positions USING btree (status);
CREATE INDEX idx_career_positions_view_count ON public.career_positions USING btree (view_count DESC);
CREATE INDEX idx_careerpositions_tenant ON public.career_positions USING btree (tenant_id);
CREATE INDEX idx_cert_grade_competencies_grade ON public.certification_competency_requirements USING btree (grade_data_id);
CREATE INDEX idx_cert_grade_data_position ON public.certification_grade_data USING btree (position_id);
CREATE INDEX idx_cert_grade_leaderboard_grade ON public.certification_grade_leaderboard USING btree (grade_data_id);
CREATE INDEX idx_cert_issuance_records_user ON public.cert_issuance_records USING btree (user_id);
CREATE INDEX idx_certificate_library_creator ON public.certificate_library USING btree (creator_id);
CREATE INDEX idx_certificate_library_tenant ON public.certificate_library USING btree (tenant_id);
CREATE INDEX idx_certification_ability_items_rule ON public.certification_ability_items USING btree (rule_id);
CREATE INDEX idx_certification_ability_points_item ON public.certification_ability_points USING btree (item_id);
CREATE INDEX idx_certification_related_tasks_cert_point ON public.certification_related_tasks USING btree (cert_point_id);
CREATE INDEX idx_certification_rules_position ON public.certification_rules USING btree (career_position_id);
CREATE INDEX idx_certificationabilityitems_tenant ON public.certification_ability_items USING btree (tenant_id);
CREATE INDEX idx_certificationabilitypoints_tenant ON public.certification_ability_points USING btree (tenant_id);
CREATE INDEX idx_certificationrelatedtasks_tenant ON public.certification_related_tasks USING btree (tenant_id);
CREATE INDEX idx_certificationrules_tenant ON public.certification_rules USING btree (tenant_id);
CREATE INDEX idx_certissuancerecords_tenant ON public.cert_issuance_records USING btree (tenant_id);
CREATE INDEX idx_course_knowledge_bindings_course ON public.course_knowledge_bindings USING btree (course_id);
CREATE INDEX idx_course_resource_bindings_course ON public.course_resource_bindings USING btree (course_id);
CREATE INDEX idx_course_resource_bindings_resource ON public.course_resource_bindings USING btree (resource_id);
CREATE INDEX idx_courseknowledgebindings_tenant ON public.course_knowledge_bindings USING btree (tenant_id);
CREATE INDEX idx_courses_batch_id ON public.courses USING btree (batch_id);
CREATE INDEX idx_courses_status ON public.courses USING btree (status);
CREATE INDEX idx_courses_tenant ON public.courses USING btree (tenant_id);
CREATE INDEX idx_courses_type ON public.courses USING btree (type);
CREATE INDEX idx_creditconversionrules_tenant ON public.credit_conversion_rules USING btree (tenant_id);
CREATE INDEX idx_emt_method ON public.evaluation_method_targets USING btree (evaluation_method_id);
CREATE INDEX idx_evaluation_batches_org_node ON public.evaluation_batches USING btree (org_node_id);
CREATE INDEX idx_evaluation_batches_status ON public.evaluation_batches USING btree (status);
CREATE INDEX idx_evaluation_batches_tenant ON public.evaluation_batches USING btree (tenant_id);
CREATE INDEX idx_evaluation_methods_category ON public.evaluation_methods USING btree (category_id);
CREATE INDEX idx_evaluationmethodcategories_tenant ON public.evaluation_method_categories USING btree (tenant_id);
CREATE INDEX idx_evaluationmethods_tenant ON public.evaluation_methods USING btree (tenant_id);
CREATE INDEX idx_exam_questions_exam ON public.exam_questions USING btree (exam_id);
CREATE INDEX idx_exam_results_usage ON public.exam_results USING btree (exam_usage_id);
CREATE INDEX idx_exam_results_usage_user ON public.exam_results USING btree (exam_usage_id, user_id);
CREATE INDEX idx_exam_results_user ON public.exam_results USING btree (user_id);
CREATE INDEX idx_exam_usages_exam ON public.exam_usages USING btree (exam_id);
CREATE INDEX idx_exam_usages_status_start ON public.exam_usages USING btree (status, start_time);
CREATE INDEX idx_examquestions_tenant ON public.exam_questions USING btree (tenant_id);
CREATE INDEX idx_examresults_tenant ON public.exam_results USING btree (tenant_id);
CREATE INDEX idx_exams_status ON public.exams USING btree (status);
CREATE INDEX idx_exams_tenant ON public.exams USING btree (tenant_id);
CREATE INDEX idx_examusages_tenant ON public.exam_usages USING btree (tenant_id);
CREATE INDEX idx_graduation_project_archives_topic ON public.graduation_project_archives USING btree (topic_id);
CREATE INDEX idx_graduation_project_evaluations_topic ON public.graduation_project_evaluations USING btree (topic_id);
CREATE INDEX idx_graduation_project_topics_position ON public.graduation_project_topics USING btree (career_position_id);
CREATE INDEX idx_graduation_query_results_user ON public.graduation_query_results USING btree (user_id);
CREATE INDEX idx_graduationprojectarchives_tenant ON public.graduation_project_archives USING btree (tenant_id);
CREATE INDEX idx_graduationprojectevaluations_tenant ON public.graduation_project_evaluations USING btree (tenant_id);
CREATE INDEX idx_graduationprojecttopics_tenant ON public.graduation_project_topics USING btree (tenant_id);
CREATE INDEX idx_graduationqueryresults_tenant ON public.graduation_query_results USING btree (tenant_id);
CREATE INDEX idx_hybrid_node_modules_node ON public.hybrid_node_modules USING btree (node_id);
CREATE INDEX idx_hybridnodemodules_tenant ON public.hybrid_node_modules USING btree (tenant_id);
CREATE INDEX idx_industries_parent ON public.industries USING btree (parent_id);
CREATE INDEX idx_industries_tenant ON public.industries USING btree (tenant_id);
CREATE INDEX idx_institutionexpertisetags_tenant ON public.institution_expertise_tags USING btree (tenant_id);
CREATE INDEX idx_institutions_tenant ON public.institutions USING btree (tenant_id);
CREATE INDEX idx_job_ability_aggregate_logs_position ON public.job_ability_aggregate_logs USING btree (tenant_id, career_position_id, started_at DESC);
CREATE INDEX idx_job_ability_results_user ON public.job_ability_results USING btree (user_id);
CREATE UNIQUE INDEX idx_job_ability_results_user_position ON public.job_ability_results USING btree (career_position_id, user_id);
CREATE INDEX idx_jobabilityresults_tenant ON public.job_ability_results USING btree (tenant_id);
CREATE INDEX idx_knowledge_points_creator ON public.knowledge_points USING btree (creator_id);
CREATE INDEX idx_knowledgepoints_tenant ON public.knowledge_points USING btree (tenant_id);
CREATE INDEX idx_lbr_course_date ON public.lesson_behavior_records USING btree (course_id, record_date);
CREATE INDEX idx_lbr_course_student ON public.lesson_behavior_records USING btree (course_id, student_user_id);
CREATE INDEX idx_lbr_student ON public.lesson_behavior_records USING btree (student_user_id);
CREATE INDEX idx_learnroads_tenant ON public.learn_roads USING btree (tenant_id);
CREATE INDEX idx_lesson_batches_org_node ON public.lesson_batches USING btree (org_node_id);
CREATE INDEX idx_lesson_batches_status ON public.lesson_batches USING btree (status);
CREATE INDEX idx_lesson_batches_tenant ON public.lesson_batches USING btree (tenant_id);
CREATE INDEX idx_lessonbehaviorrecords_tenant ON public.lesson_behavior_records USING btree (tenant_id);
CREATE INDEX idx_login_logs_tenant_created ON public.login_logs USING btree (tenant_id, created_at);
CREATE INDEX idx_login_logs_user ON public.login_logs USING btree (user_id);
CREATE INDEX idx_majors_tenant ON public.majors USING btree (tenant_id);
CREATE INDEX idx_microcerttemplates_tenant ON public.micro_cert_templates USING btree (tenant_id);
CREATE INDEX idx_nkpb_node ON public.node_knowledge_point_bindings USING btree (node_id);
CREATE INDEX idx_node_homeworks_node ON public.node_homeworks USING btree (node_id);
CREATE INDEX idx_node_quiz_questions_quiz ON public.node_quiz_questions USING btree (quiz_id);
CREATE INDEX idx_node_quizzes_node ON public.node_quizzes USING btree (node_id);
CREATE INDEX idx_node_resources_node ON public.node_resources USING btree (node_id);
CREATE INDEX idx_nodehomeworks_tenant ON public.node_homeworks USING btree (tenant_id);
CREATE INDEX idx_nodequizquestions_tenant ON public.node_quiz_questions USING btree (tenant_id);
CREATE INDEX idx_nodequizzes_tenant ON public.node_quizzes USING btree (tenant_id);
CREATE INDEX idx_noderesources_tenant ON public.node_resources USING btree (tenant_id);
CREATE INDEX idx_nrb_node ON public.node_resource_bindings USING btree (node_id);
CREATE INDEX idx_on_site_question_library_creator ON public.on_site_question_library USING btree (creator_id);
CREATE INDEX idx_on_site_question_library_tenant ON public.on_site_question_library USING btree (tenant_id);
CREATE INDEX idx_operation_logs_tenant_created ON public.operation_logs USING btree (tenant_id, created_at);
CREATE INDEX idx_operation_logs_user ON public.operation_logs USING btree (user_id);
CREATE INDEX idx_orders_buyer ON public.orders USING btree (buyer_id, status);
CREATE INDEX idx_orders_tenant ON public.orders USING btree (tenant_id);
CREATE INDEX idx_organizations_parent ON public.organizations USING btree (parent_id);
CREATE INDEX idx_organizations_tenant ON public.organizations USING btree (tenant_id);
CREATE INDEX idx_platformlinks_tenant ON public.platform_links USING btree (tenant_id);
CREATE INDEX idx_position_ability_bindings_position ON public.position_ability_bindings USING btree (career_position_id);
CREATE INDEX idx_position_certificates_library ON public.position_certificates USING btree (certificate_library_id);
CREATE INDEX idx_position_certificates_position ON public.position_certificates USING btree (career_position_id);
CREATE INDEX idx_position_favorites_position_id ON public.position_favorites USING btree (career_position_id);
CREATE INDEX idx_position_favorites_user_id ON public.position_favorites USING btree (user_id);
CREATE INDEX idx_position_responsibilities_position ON public.position_responsibilities USING btree (career_position_id);
CREATE INDEX idx_positionabilitybindings_tenant ON public.position_ability_bindings USING btree (tenant_id);
CREATE INDEX idx_positioncertificates_tenant ON public.position_certificates USING btree (tenant_id);
CREATE INDEX idx_positionrecommendations_tenant ON public.position_recommendations USING btree (tenant_id);
CREATE INDEX idx_positionresponsibilities_tenant ON public.position_responsibilities USING btree (tenant_id);
CREATE INDEX idx_qbkp_bank ON public.question_bank_knowledge_points USING btree (question_bank_id);
CREATE INDEX idx_question_banks_creator ON public.question_banks USING btree (creator_id);
CREATE INDEX idx_question_banks_status ON public.question_banks USING btree (status);
CREATE INDEX idx_questionbanks_tenant ON public.question_banks USING btree (tenant_id);
CREATE INDEX idx_questions_bank ON public.questions USING btree (bank_id);
CREATE INDEX idx_questions_tenant ON public.questions USING btree (tenant_id);
CREATE INDEX idx_rdq_major_id ON public.random_draw_questions USING btree (major_id);
CREATE INDEX idx_rdq_tenant ON public.random_draw_questions USING btree (tenant_id);
CREATE UNIQUE INDEX idx_resource_codes_tenant_code ON public.resource_codes USING btree (tenant_id, code);
CREATE INDEX idx_resource_library_tenant ON public.resource_library USING btree (tenant_id);
CREATE INDEX idx_resource_library_type ON public.resource_library USING btree (tenant_id, resource_type);
CREATE INDEX idx_resource_tags_lookup ON public.resource_tags USING btree (tag_type, tag_value);
CREATE INDEX idx_resources_institution_status ON public.resources USING btree (institution_id, status);
CREATE INDEX idx_resources_status_created ON public.resources USING btree (status, created_at);
CREATE INDEX idx_resources_tenant ON public.resources USING btree (tenant_id);
CREATE INDEX idx_resourcetags_tenant ON public.resource_tags USING btree (tenant_id);
CREATE UNIQUE INDEX idx_roles_tenant_code ON public.roles USING btree (tenant_id, code);
CREATE INDEX idx_rubric_templates_deleted ON public.rubric_templates USING btree (tenant_id, is_deleted);
CREATE INDEX idx_rubric_templates_tenant ON public.rubric_templates USING btree (tenant_id);
CREATE INDEX idx_scenario_grade_mappings_scenario ON public.scenario_grade_mappings USING btree (scenario_id);
CREATE INDEX idx_scenario_tasks_scenario ON public.scenario_tasks USING btree (scenario_id);
CREATE INDEX idx_scenario_tasks_tenant ON public.scenario_tasks USING btree (tenant_id);
CREATE INDEX idx_scenario_weight_configs_scenario ON public.scenario_weight_configs USING btree (scenario_id);
CREATE INDEX idx_scenariogrademappings_tenant ON public.scenario_grade_mappings USING btree (tenant_id);
CREATE INDEX idx_scenarios_batch ON public.scenarios USING btree (batch_id);
CREATE INDEX idx_scenarios_status ON public.scenarios USING btree (status);
CREATE INDEX idx_scenarios_tenant ON public.scenarios USING btree (tenant_id);
CREATE INDEX idx_scenarioweightconfigs_tenant ON public.scenario_weight_configs USING btree (tenant_id);
CREATE INDEX idx_scene_archives_scenario ON public.scene_archives USING btree (scenario_id);
CREATE INDEX idx_scene_batches_org_node ON public.scene_batches USING btree (org_node_id);
CREATE INDEX idx_scene_batches_status ON public.scene_batches USING btree (status);
CREATE INDEX idx_scene_batches_tenant ON public.scene_batches USING btree (tenant_id);
CREATE INDEX idx_scene_eval_task_evaluator_created ON public.scene_evaluation_results USING btree (task_id, evaluatee_id, created_at DESC);
CREATE INDEX idx_scene_evaluation_results_evaluatee ON public.scene_evaluation_results USING btree (evaluatee_id);
CREATE INDEX idx_scene_evaluation_results_task ON public.scene_evaluation_results USING btree (task_id);
CREATE INDEX idx_scenearchives_tenant ON public.scene_archives USING btree (tenant_id);
CREATE INDEX idx_sceneevaluationresults_tenant ON public.scene_evaluation_results USING btree (tenant_id);
CREATE INDEX idx_student_ability_archives_user ON public.student_ability_archives USING btree (user_id);
CREATE INDEX idx_student_ability_portraits_user ON public.student_ability_portraits USING btree (user_id);
CREATE UNIQUE INDEX idx_student_ability_portraits_user_position ON public.student_ability_portraits USING btree (user_id, career_position_id);
CREATE INDEX idx_studentabilityarchives_tenant ON public.student_ability_archives USING btree (tenant_id);
CREATE INDEX idx_studentabilityportraits_tenant ON public.student_ability_portraits USING btree (tenant_id);
CREATE INDEX idx_subscription_packages_tenant ON public.subscription_packages USING btree (tenant_id);
CREATE INDEX idx_system_course_nodes_code ON public.system_course_nodes USING btree (code);
CREATE INDEX idx_system_course_nodes_course ON public.system_course_nodes USING btree (course_id);
CREATE INDEX idx_system_course_nodes_parent ON public.system_course_nodes USING btree (parent_id);
CREATE INDEX idx_systemcoursenodes_tenant ON public.system_course_nodes USING btree (tenant_id);
CREATE INDEX idx_task_ability_bindings_task ON public.task_ability_bindings USING btree (task_id);
CREATE INDEX idx_task_deliverables_task ON public.task_deliverables USING btree (task_id);
CREATE INDEX idx_task_evaluation_methods_enabled ON public.task_evaluation_methods USING btree (task_id, tenant_id, is_enabled);
CREATE INDEX idx_task_knowledge_bindings_task ON public.task_knowledge_bindings USING btree (task_id);
CREATE INDEX idx_task_resource_bindings_task ON public.task_resource_bindings USING btree (task_id);
CREATE INDEX idx_taskabilitybindings_tenant ON public.task_ability_bindings USING btree (tenant_id);
CREATE INDEX idx_taskdeliverables_tenant ON public.task_deliverables USING btree (tenant_id);
CREATE INDEX idx_taskknowledgebindings_tenant ON public.task_knowledge_bindings USING btree (tenant_id);
CREATE INDEX idx_taskresourcebindings_tenant ON public.task_resource_bindings USING btree (tenant_id);
CREATE INDEX idx_taskresources_tenant ON public.task_resources USING btree (tenant_id);
CREATE UNIQUE INDEX idx_user_extension_fields_tenant_key ON public.user_extension_fields USING btree (tenant_id, field_key);
CREATE INDEX idx_user_relations_initiator ON public.user_relations USING btree (initiator_id);
CREATE INDEX idx_user_relations_target ON public.user_relations USING btree (target_id);
CREATE INDEX idx_user_roles_role ON public.user_roles USING btree (role_id);
CREATE INDEX idx_users_major ON public.users USING btree (major_id);
CREATE INDEX idx_users_org_node ON public.users USING btree (org_node_id);
CREATE INDEX idx_users_platform ON public.users USING btree (platform);
CREATE INDEX idx_users_platform_username ON public.users USING btree (platform, username);
CREATE INDEX idx_users_tenant ON public.users USING btree (tenant_id);
CREATE INDEX idx_view_logs_target ON public.view_logs USING btree (target_type, target_id);
CREATE INDEX idx_view_logs_viewed ON public.view_logs USING btree (viewed_at DESC);
CREATE INDEX idx_withdrawals_tenant ON public.withdrawals USING btree (tenant_id);
CREATE UNIQUE INDEX uq_ability_points_tenant_name ON public.ability_points USING btree (tenant_id, name);
CREATE UNIQUE INDEX uq_career_positions_tenant_code ON public.career_positions USING btree (tenant_id, code);
CREATE UNIQUE INDEX uq_career_positions_tenant_name ON public.career_positions USING btree (tenant_id, name);
CREATE UNIQUE INDEX uq_certificate_library_tenant_name ON public.certificate_library USING btree (tenant_id, name);
CREATE UNIQUE INDEX uq_courses_tenant_code ON public.courses USING btree (tenant_id, code);
CREATE UNIQUE INDEX uq_exams_tenant_code ON public.exams USING btree (tenant_id, code);
CREATE UNIQUE INDEX uq_exams_tenant_name ON public.exams USING btree (tenant_id, name);
CREATE UNIQUE INDEX uq_graduation_topics_tenant_name ON public.graduation_project_topics USING btree (tenant_id, name);
CREATE UNIQUE INDEX uq_industries_tenant_code ON public.industries USING btree (tenant_id, code);
CREATE UNIQUE INDEX uq_institution_expertise_tags ON public.institution_expertise_tags USING btree (institution_id, tag_value);
CREATE UNIQUE INDEX uq_knowledge_points_tenant_name ON public.knowledge_points USING btree (tenant_id, name);
CREATE UNIQUE INDEX uq_learn_roads_tenant_name ON public.learn_roads USING btree (tenant_id, name);
CREATE UNIQUE INDEX uq_majors_tenant_code ON public.majors USING btree (tenant_id, code);
CREATE UNIQUE INDEX uq_org_types_tenant_name ON public.org_types USING btree (tenant_id, name);
CREATE UNIQUE INDEX uq_question_banks_tenant_code ON public.question_banks USING btree (tenant_id, code);
CREATE UNIQUE INDEX uq_question_banks_tenant_name ON public.question_banks USING btree (tenant_id, name);
CREATE UNIQUE INDEX uq_questions_tenant_code ON public.questions USING btree (tenant_id, code);
CREATE UNIQUE INDEX uq_scenarios_tenant_code ON public.scenarios USING btree (tenant_id, code);
CREATE UNIQUE INDEX uq_staff_titles_tenant_code ON public.staff_titles USING btree (tenant_id, code);
CREATE UNIQUE INDEX uq_users_tenant_platform_login ON public.users USING btree (tenant_id, platform, login_name);
CREATE UNIQUE INDEX uq_workflows_tenant_name ON public.workflows USING btree (tenant_id, name);
ALTER TABLE ONLY public.ability_domains
    ADD CONSTRAINT ability_domains_career_position_id_fkey FOREIGN KEY (career_position_id) REFERENCES public.career_positions(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.ability_points
    ADD CONSTRAINT ability_points_creator_id_fkey FOREIGN KEY (creator_id) REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.appeal_records
    ADD CONSTRAINT appeal_records_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.approval_records
    ADD CONSTRAINT approval_records_workflow_id_fkey FOREIGN KEY (workflow_id) REFERENCES public.workflows(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.authorizations
    ADD CONSTRAINT authorizations_buyer_id_new_fkey FOREIGN KEY (buyer_id) REFERENCES public.institutions(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.authorizations
    ADD CONSTRAINT authorizations_order_id_new_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.authorizations
    ADD CONSTRAINT authorizations_resource_id_new_fkey FOREIGN KEY (resource_id) REFERENCES public.resources(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.career_position_majors
    ADD CONSTRAINT career_position_majors_career_position_id_fkey FOREIGN KEY (career_position_id) REFERENCES public.career_positions(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.career_position_majors
    ADD CONSTRAINT career_position_majors_major_id_fkey FOREIGN KEY (major_id) REFERENCES public.majors(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.cert_issuance_records
    ADD CONSTRAINT cert_issuance_records_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.micro_cert_templates(id);
ALTER TABLE ONLY public.cert_issuance_records
    ADD CONSTRAINT cert_issuance_records_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.certificate_library
    ADD CONSTRAINT certificate_library_creator_id_fkey FOREIGN KEY (creator_id) REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.certification_ability_items
    ADD CONSTRAINT certification_ability_items_rule_id_fkey FOREIGN KEY (rule_id) REFERENCES public.certification_rules(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.certification_ability_points
    ADD CONSTRAINT certification_ability_points_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.certification_ability_items(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.certification_competency_requirements
    ADD CONSTRAINT certification_competency_requirements_grade_data_id_fkey FOREIGN KEY (grade_data_id) REFERENCES public.certification_grade_data(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.certification_grade_leaderboard
    ADD CONSTRAINT certification_grade_leaderboard_grade_data_id_fkey FOREIGN KEY (grade_data_id) REFERENCES public.certification_grade_data(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.certification_related_tasks
    ADD CONSTRAINT certification_related_tasks_cert_point_id_fkey FOREIGN KEY (cert_point_id) REFERENCES public.certification_ability_points(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.course_knowledge_bindings
    ADD CONSTRAINT course_knowledge_bindings_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.course_knowledge_bindings
    ADD CONSTRAINT course_knowledge_bindings_knowledge_point_id_fkey FOREIGN KEY (knowledge_point_id) REFERENCES public.knowledge_points(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.course_resource_bindings
    ADD CONSTRAINT course_resource_bindings_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.course_resource_bindings
    ADD CONSTRAINT course_resource_bindings_resource_id_fkey FOREIGN KEY (resource_id) REFERENCES public.resource_library(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.evaluation_method_targets
    ADD CONSTRAINT evaluation_method_targets_evaluation_method_id_fkey FOREIGN KEY (evaluation_method_id) REFERENCES public.evaluation_methods(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.evaluation_methods
    ADD CONSTRAINT evaluation_methods_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.evaluation_method_categories(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.exam_questions
    ADD CONSTRAINT exam_questions_exam_id_fkey FOREIGN KEY (exam_id) REFERENCES public.exams(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.exam_questions
    ADD CONSTRAINT exam_questions_question_id_fkey FOREIGN KEY (question_id) REFERENCES public.questions(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.exam_results
    ADD CONSTRAINT exam_results_exam_usage_id_fkey FOREIGN KEY (exam_usage_id) REFERENCES public.exam_usages(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.exam_results
    ADD CONSTRAINT exam_results_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.exam_usages
    ADD CONSTRAINT exam_usages_exam_id_fkey FOREIGN KEY (exam_id) REFERENCES public.exams(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.ability_points
    ADD CONSTRAINT fk_ability_points_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.announcements
    ADD CONSTRAINT fk_announcements_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.app_modules
    ADD CONSTRAINT fk_app_modules_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.approval_records
    ADD CONSTRAINT fk_approval_records_submitter FOREIGN KEY (submitter_id) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.authorizations
    ADD CONSTRAINT fk_authorizations_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.banner_configs
    ADD CONSTRAINT fk_banner_configs_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.banners
    ADD CONSTRAINT fk_banners_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.batches
    ADD CONSTRAINT fk_batches_major FOREIGN KEY (major_id) REFERENCES public.majors(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.career_positions
    ADD CONSTRAINT fk_career_positions_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.certification_ability_items
    ADD CONSTRAINT fk_certification_ability_items_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.certification_ability_points
    ADD CONSTRAINT fk_certification_ability_points_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.certification_grade_leaderboard
    ADD CONSTRAINT fk_certification_grade_leaderboard_major FOREIGN KEY (major_id) REFERENCES public.majors(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.certification_related_tasks
    ADD CONSTRAINT fk_certification_related_tasks_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.certification_rules
    ADD CONSTRAINT fk_certification_rules_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.courses
    ADD CONSTRAINT fk_courses_batch FOREIGN KEY (batch_id) REFERENCES public.lesson_batches(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.courses
    ADD CONSTRAINT fk_courses_creator FOREIGN KEY (creator_id) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.courses
    ADD CONSTRAINT fk_courses_industry FOREIGN KEY (industry_id) REFERENCES public.industries(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.courses
    ADD CONSTRAINT fk_courses_major FOREIGN KEY (major_id) REFERENCES public.majors(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.courses
    ADD CONSTRAINT fk_courses_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.credit_conversion_rules
    ADD CONSTRAINT fk_credit_conversion_rules_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.evaluation_batches
    ADD CONSTRAINT fk_evaluation_batches_major FOREIGN KEY (major_id) REFERENCES public.majors(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.evaluation_method_categories
    ADD CONSTRAINT fk_evaluation_method_categories_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.evaluation_methods
    ADD CONSTRAINT fk_evaluation_methods_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.exam_results
    ADD CONSTRAINT fk_exam_results_major FOREIGN KEY (major_id) REFERENCES public.majors(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.exam_usages
    ADD CONSTRAINT fk_exam_usages_creator FOREIGN KEY (creator_id) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.exam_usages
    ADD CONSTRAINT fk_exam_usages_major FOREIGN KEY (major_id) REFERENCES public.majors(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.exams
    ADD CONSTRAINT fk_exams_creator FOREIGN KEY (creator_id) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.exams
    ADD CONSTRAINT fk_exams_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.graduation_project_topics
    ADD CONSTRAINT fk_graduation_project_topics_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.graduation_query_results
    ADD CONSTRAINT fk_graduation_query_results_major FOREIGN KEY (major_id) REFERENCES public.majors(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.industries
    ADD CONSTRAINT fk_industries_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.institution_expertise_tags
    ADD CONSTRAINT fk_institution_expertise_tags_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.institutions
    ADD CONSTRAINT fk_institutions_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.knowledge_points
    ADD CONSTRAINT fk_knowledge_points_creator FOREIGN KEY (creator_id) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.knowledge_points
    ADD CONSTRAINT fk_knowledge_points_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.learn_roads
    ADD CONSTRAINT fk_learn_roads_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.lesson_batches
    ADD CONSTRAINT fk_lesson_batches_major FOREIGN KEY (major_id) REFERENCES public.majors(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.login_logs
    ADD CONSTRAINT fk_login_logs_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.majors
    ADD CONSTRAINT fk_majors_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.micro_cert_templates
    ADD CONSTRAINT fk_micro_cert_templates_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.operation_logs
    ADD CONSTRAINT fk_operation_logs_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.orders
    ADD CONSTRAINT fk_orders_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.org_types
    ADD CONSTRAINT fk_org_types_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT fk_organizations_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT fk_organizations_type FOREIGN KEY (type_id) REFERENCES public.org_types(id) ON DELETE RESTRICT;
ALTER TABLE ONLY public.on_site_question_library
    ADD CONSTRAINT fk_osql_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.platform_links
    ADD CONSTRAINT fk_platform_links_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.position_certificates
    ADD CONSTRAINT fk_position_certificates_library FOREIGN KEY (certificate_library_id) REFERENCES public.certificate_library(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.position_recommendations
    ADD CONSTRAINT fk_position_recommendations_major FOREIGN KEY (major_id) REFERENCES public.majors(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.question_banks
    ADD CONSTRAINT fk_question_banks_creator FOREIGN KEY (creator_id) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.question_banks
    ADD CONSTRAINT fk_question_banks_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.questions
    ADD CONSTRAINT fk_questions_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.random_draw_questions
    ADD CONSTRAINT fk_rdq_major FOREIGN KEY (major_id) REFERENCES public.majors(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.random_draw_questions
    ADD CONSTRAINT fk_rdq_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.resource_codes
    ADD CONSTRAINT fk_resource_codes_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.resource_library
    ADD CONSTRAINT fk_resource_library_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.resource_tags
    ADD CONSTRAINT fk_resource_tags_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.resources
    ADD CONSTRAINT fk_resources_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.roles
    ADD CONSTRAINT fk_roles_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.scenarios
    ADD CONSTRAINT fk_scenarios_creator FOREIGN KEY (creator_id) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.scenarios
    ADD CONSTRAINT fk_scenarios_industry FOREIGN KEY (industry_id) REFERENCES public.industries(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.scenarios
    ADD CONSTRAINT fk_scenarios_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.scene_batches
    ADD CONSTRAINT fk_scene_batches_major FOREIGN KEY (major_id) REFERENCES public.majors(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.staff_titles
    ADD CONSTRAINT fk_staff_titles_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.student_ability_portraits
    ADD CONSTRAINT fk_student_ability_portraits_major FOREIGN KEY (major_id) REFERENCES public.majors(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.subscription_packages
    ADD CONSTRAINT fk_subscription_packages_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.task_resources
    ADD CONSTRAINT fk_task_resources_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.user_extension_fields
    ADD CONSTRAINT fk_user_extension_fields_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.user_relations
    ADD CONSTRAINT fk_user_relations_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT fk_user_roles_user FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.users
    ADD CONSTRAINT fk_users_major FOREIGN KEY (major_id) REFERENCES public.majors(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.users
    ADD CONSTRAINT fk_users_org_node FOREIGN KEY (org_node_id) REFERENCES public.organizations(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.users
    ADD CONSTRAINT fk_users_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.view_logs
    ADD CONSTRAINT fk_view_logs_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.withdrawals
    ADD CONSTRAINT fk_withdrawals_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.workflows
    ADD CONSTRAINT fk_workflows_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.graduation_project_archives
    ADD CONSTRAINT graduation_project_archives_topic_id_fkey FOREIGN KEY (topic_id) REFERENCES public.graduation_project_topics(id);
ALTER TABLE ONLY public.graduation_project_archives
    ADD CONSTRAINT graduation_project_archives_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.graduation_project_evaluations
    ADD CONSTRAINT graduation_project_evaluations_topic_id_fkey FOREIGN KEY (topic_id) REFERENCES public.graduation_project_topics(id);
ALTER TABLE ONLY public.graduation_project_evaluations
    ADD CONSTRAINT graduation_project_evaluations_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.graduation_query_results
    ADD CONSTRAINT graduation_query_results_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.hybrid_node_modules
    ADD CONSTRAINT hybrid_node_modules_node_id_fkey FOREIGN KEY (node_id) REFERENCES public.system_course_nodes(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.industries
    ADD CONSTRAINT industries_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.industries(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.institution_expertise_tags
    ADD CONSTRAINT institution_expertise_tags_institution_id_new_fkey FOREIGN KEY (institution_id) REFERENCES public.institutions(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.job_ability_results
    ADD CONSTRAINT job_ability_results_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.lesson_behavior_records
    ADD CONSTRAINT lesson_behavior_records_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.lesson_behavior_records
    ADD CONSTRAINT lesson_behavior_records_student_user_id_fkey FOREIGN KEY (student_user_id) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.node_ability_point_bindings
    ADD CONSTRAINT node_ability_point_bindings_ability_point_id_fkey FOREIGN KEY (ability_point_id) REFERENCES public.ability_points(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.node_ability_point_bindings
    ADD CONSTRAINT node_ability_point_bindings_node_id_fkey FOREIGN KEY (node_id) REFERENCES public.system_course_nodes(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.node_homeworks
    ADD CONSTRAINT node_homeworks_node_id_fkey FOREIGN KEY (node_id) REFERENCES public.system_course_nodes(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.node_knowledge_point_bindings
    ADD CONSTRAINT node_knowledge_point_bindings_knowledge_point_id_fkey FOREIGN KEY (knowledge_point_id) REFERENCES public.knowledge_points(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.node_knowledge_point_bindings
    ADD CONSTRAINT node_knowledge_point_bindings_node_id_fkey FOREIGN KEY (node_id) REFERENCES public.system_course_nodes(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.node_quiz_questions
    ADD CONSTRAINT node_quiz_questions_quiz_id_fkey FOREIGN KEY (quiz_id) REFERENCES public.node_quizzes(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.node_quizzes
    ADD CONSTRAINT node_quizzes_node_id_fkey FOREIGN KEY (node_id) REFERENCES public.system_course_nodes(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.node_resource_bindings
    ADD CONSTRAINT node_resource_bindings_node_id_fkey FOREIGN KEY (node_id) REFERENCES public.system_course_nodes(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.node_resource_bindings
    ADD CONSTRAINT node_resource_bindings_resource_id_fkey FOREIGN KEY (resource_id) REFERENCES public.resource_library(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.node_resources
    ADD CONSTRAINT node_resources_node_id_fkey FOREIGN KEY (node_id) REFERENCES public.system_course_nodes(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.on_site_question_library
    ADD CONSTRAINT on_site_question_library_creator_id_fkey FOREIGN KEY (creator_id) REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_buyer_id_new_fkey FOREIGN KEY (buyer_id) REFERENCES public.institutions(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_resource_id_new_fkey FOREIGN KEY (resource_id) REFERENCES public.resources(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_seller_id_new_fkey FOREIGN KEY (seller_id) REFERENCES public.institutions(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.organizations(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.position_ability_bindings
    ADD CONSTRAINT position_ability_bindings_ability_point_id_fkey FOREIGN KEY (ability_point_id) REFERENCES public.ability_points(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.position_ability_bindings
    ADD CONSTRAINT position_ability_bindings_career_position_id_fkey FOREIGN KEY (career_position_id) REFERENCES public.career_positions(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.position_ability_bindings
    ADD CONSTRAINT position_ability_bindings_responsibility_id_fkey FOREIGN KEY (responsibility_id) REFERENCES public.position_responsibilities(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.position_certificates
    ADD CONSTRAINT position_certificates_career_position_id_fkey FOREIGN KEY (career_position_id) REFERENCES public.career_positions(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.position_favorites
    ADD CONSTRAINT position_favorites_career_position_id_fkey FOREIGN KEY (career_position_id) REFERENCES public.career_positions(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.position_recommendations
    ADD CONSTRAINT position_recommendations_career_position_id_fkey FOREIGN KEY (career_position_id) REFERENCES public.career_positions(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.position_responsibilities
    ADD CONSTRAINT position_responsibilities_career_position_id_fkey FOREIGN KEY (career_position_id) REFERENCES public.career_positions(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.question_bank_knowledge_points
    ADD CONSTRAINT question_bank_knowledge_points_knowledge_point_id_fkey FOREIGN KEY (knowledge_point_id) REFERENCES public.knowledge_points(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.question_bank_knowledge_points
    ADD CONSTRAINT question_bank_knowledge_points_question_bank_id_fkey FOREIGN KEY (question_bank_id) REFERENCES public.question_banks(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.questions
    ADD CONSTRAINT questions_bank_id_fkey FOREIGN KEY (bank_id) REFERENCES public.question_banks(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.resource_tags
    ADD CONSTRAINT resource_tags_resource_id_new_fkey FOREIGN KEY (resource_id) REFERENCES public.resources(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.resources
    ADD CONSTRAINT resources_institution_id_new_fkey FOREIGN KEY (institution_id) REFERENCES public.institutions(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.scenario_grade_mappings
    ADD CONSTRAINT scenario_grade_mappings_scenario_id_fkey FOREIGN KEY (scenario_id) REFERENCES public.scenarios(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.scenario_grade_mappings
    ADD CONSTRAINT scenario_grade_mappings_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.scenario_tasks(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.scenario_tasks
    ADD CONSTRAINT scenario_tasks_scenario_id_fkey FOREIGN KEY (scenario_id) REFERENCES public.scenarios(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.scenario_weight_configs
    ADD CONSTRAINT scenario_weight_configs_scenario_id_fkey FOREIGN KEY (scenario_id) REFERENCES public.scenarios(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.scenario_weight_configs
    ADD CONSTRAINT scenario_weight_configs_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.scenario_tasks(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.scene_archives
    ADD CONSTRAINT scene_archives_scenario_id_fkey FOREIGN KEY (scenario_id) REFERENCES public.scenarios(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.scene_evaluation_results
    ADD CONSTRAINT scene_evaluation_results_evaluatee_id_fkey FOREIGN KEY (evaluatee_id) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.scene_evaluation_results
    ADD CONSTRAINT scene_evaluation_results_evaluator_id_fkey FOREIGN KEY (evaluator_id) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.scene_evaluation_results
    ADD CONSTRAINT scene_evaluation_results_graded_by_fkey FOREIGN KEY (graded_by) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.student_ability_archives
    ADD CONSTRAINT student_ability_archives_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.student_ability_portraits
    ADD CONSTRAINT student_ability_portraits_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.system_course_nodes
    ADD CONSTRAINT system_course_nodes_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.system_course_nodes
    ADD CONSTRAINT system_course_nodes_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.system_course_nodes(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.task_ability_bindings
    ADD CONSTRAINT task_ability_bindings_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.scenario_tasks(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.task_deliverables
    ADD CONSTRAINT task_deliverables_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.scenario_tasks(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.task_eval_points
    ADD CONSTRAINT task_eval_points_config_id_fkey FOREIGN KEY (config_id) REFERENCES public.task_evaluation_methods(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.task_evaluation_methods
    ADD CONSTRAINT task_evaluation_methods_rubric_template_id_fkey FOREIGN KEY (rubric_template_id) REFERENCES public.rubric_templates(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.task_evaluation_methods
    ADD CONSTRAINT task_evaluation_methods_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.scenario_tasks(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.task_knowledge_bindings
    ADD CONSTRAINT task_knowledge_bindings_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.scenario_tasks(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.task_resource_bindings
    ADD CONSTRAINT task_resource_bindings_resource_id_fkey FOREIGN KEY (resource_id) REFERENCES public.resource_library(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.task_resource_bindings
    ADD CONSTRAINT task_resource_bindings_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.scenario_tasks(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.task_review_steps
    ADD CONSTRAINT task_review_steps_config_id_fkey FOREIGN KEY (config_id) REFERENCES public.task_evaluation_methods(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_institution_id_new_fkey FOREIGN KEY (institution_id) REFERENCES public.institutions(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.withdrawals
    ADD CONSTRAINT withdrawals_institution_id_new_fkey FOREIGN KEY (institution_id) REFERENCES public.institutions(id) ON DELETE CASCADE;
