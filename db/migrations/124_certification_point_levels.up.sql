-- 能力点五档分数线配置（每能力点独立，岗位+能力点维度唯一）
CREATE TABLE public.certification_point_levels (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL,
    career_position_id uuid NOT NULL,
    ability_point_id uuid NOT NULL,
    level_mapping jsonb NOT NULL DEFAULT '[]'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_cert_point_levels_uniq ON public.certification_point_levels (tenant_id, career_position_id, ability_point_id);
CREATE INDEX idx_cert_point_levels_position ON public.certification_point_levels (career_position_id);
