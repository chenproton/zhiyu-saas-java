-- 学生荣誉记录（个人中心-我的荣誉奖励配置，画像页展示）
CREATE TABLE public.student_honors (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL,
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name varchar(128) NOT NULL,
    issuer varchar(128) NOT NULL DEFAULT '',
    honor_date varchar(32) NOT NULL DEFAULT '',
    file_name varchar(256) NOT NULL DEFAULT '',
    file_url varchar(512) NOT NULL DEFAULT '',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_student_honors_user ON public.student_honors (user_id);
CREATE INDEX idx_student_honors_tenant ON public.student_honors (tenant_id);
