-- 171: 知识库问答记录（spec §2.1 v2.2 B6）：ask 落库，详情页展示我的提问历史
CREATE TABLE IF NOT EXISTS ai_kb_asks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    kb_id UUID NOT NULL REFERENCES ai_knowledge_bases(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id),
    question TEXT NOT NULL,
    answer TEXT NOT NULL DEFAULT '',
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ai_kb_asks_user ON ai_kb_asks(tenant_id, kb_id, user_id, created_at DESC);
