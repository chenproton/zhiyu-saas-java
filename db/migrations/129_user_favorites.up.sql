-- 通用收藏表：场景/课程/题库/试卷收藏（岗位收藏沿用 position_favorites）
CREATE TABLE public.user_favorites (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    target_type character varying(64) NOT NULL,
    target_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.user_favorites
    ADD CONSTRAINT user_favorites_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.user_favorites
    ADD CONSTRAINT user_favorites_user_type_target_key UNIQUE (user_id, target_type, target_id);

CREATE INDEX idx_user_favorites_user_id ON public.user_favorites USING btree (user_id);
CREATE INDEX idx_user_favorites_target ON public.user_favorites USING btree (target_type, target_id);
