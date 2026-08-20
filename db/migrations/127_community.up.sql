-- 学习社区：帖子
CREATE TABLE community_topics (
    id CHAR(36) DEFAULT (UUID()) NOT NULL,
    tenant_id CHAR(36) NOT NULL,
    author_id CHAR(36) NOT NULL,
    title VARCHAR(128) NOT NULL,
    content LONGTEXT NOT NULL,
    tag VARCHAR(32),
    reply_count INT DEFAULT 0 NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- 学习社区：回复（parent_id 为空为直接回复，非空为回复某条评论）
CREATE TABLE community_replies (
    id CHAR(36) DEFAULT (UUID()) NOT NULL,
    topic_id CHAR(36) NOT NULL,
    author_id CHAR(36) NOT NULL,
    parent_id CHAR(36),
    content LONGTEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL
);

ALTER TABLE community_topics
    ADD CONSTRAINT community_topics_pkey PRIMARY KEY (id);
ALTER TABLE community_replies
    ADD CONSTRAINT community_replies_pkey PRIMARY KEY (id);

ALTER TABLE community_topics
    ADD CONSTRAINT community_topics_author_id_fkey FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE community_replies
    ADD CONSTRAINT community_replies_author_id_fkey FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE community_replies
    ADD CONSTRAINT community_replies_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES community_replies(id) ON DELETE CASCADE;
ALTER TABLE community_replies
    ADD CONSTRAINT community_replies_topic_id_fkey FOREIGN KEY (topic_id) REFERENCES community_topics(id) ON DELETE CASCADE;

CREATE INDEX idx_community_topics_tenant_created ON community_topics (tenant_id, created_at DESC);
CREATE INDEX idx_community_topics_tenant_author ON community_topics (tenant_id, author_id);
CREATE INDEX idx_community_replies_topic_created ON community_replies (topic_id, created_at);
