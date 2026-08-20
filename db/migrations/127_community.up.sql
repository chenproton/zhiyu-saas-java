-- 学习社区：帖子
CREATE TABLE public.community_topics (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    author_id uuid NOT NULL,
    title character varying(128) NOT NULL,
    content text NOT NULL,
    tag character varying(32),
    reply_count integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- 学习社区：回复（parent_id 为空为直接回复，非空为回复某条评论）
CREATE TABLE public.community_replies (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    topic_id uuid NOT NULL,
    author_id uuid NOT NULL,
    parent_id uuid,
    content text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.community_topics
    ADD CONSTRAINT community_topics_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.community_replies
    ADD CONSTRAINT community_replies_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.community_topics
    ADD CONSTRAINT community_topics_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.community_replies
    ADD CONSTRAINT community_replies_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.community_replies
    ADD CONSTRAINT community_replies_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.community_replies(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.community_replies
    ADD CONSTRAINT community_replies_topic_id_fkey FOREIGN KEY (topic_id) REFERENCES public.community_topics(id) ON DELETE CASCADE;

CREATE INDEX idx_community_topics_tenant_created ON public.community_topics USING btree (tenant_id, created_at DESC);
CREATE INDEX idx_community_topics_tenant_author ON public.community_topics USING btree (tenant_id, author_id);
CREATE INDEX idx_community_replies_topic_created ON public.community_replies USING btree (topic_id, created_at);
