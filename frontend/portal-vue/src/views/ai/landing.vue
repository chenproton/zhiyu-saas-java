<template>
  <div class="ai-landing">
    <!-- Hero -->
    <section class="hero">
      <div class="hero-inner">
        <div class="hero-flex">
          <div class="hero-left">
            <div class="hero-badge"><el-icon><MagicStick /></el-icon>AI 智能服务平台</div>
            <h1 class="hero-title">
              AI 赋能场景化数智教学
              <span class="hero-sub">培养适应复合型岗位新需求人才</span>
            </h1>
            <p class="hero-desc">融合场景化数智教学模式，为职业教育提供智能化教学辅助、岗位能力评估、个性化学习路径规划等全方位AI服务，助力培养适应产业需求的高素质技术技能人才。</p>
            <el-button class="hero-cta" round @click="scrollToSquare">逛逛 AI 广场</el-button>
          </div>
          <div class="hero-right">
            <div class="hero-card">
              <div class="hero-brand"><el-icon><MagicStick /></el-icon>YI KNOW</div>
              <div class="hero-card-title">职业教育场景化教学智能助理</div>
              <div class="hero-card-slogan">You Ask · I Know · 你问，我懂</div>
              <p class="hero-card-desc">集成多元大模型能力，以知识库与智能体全面赋能职业教育场景化教学</p>
              <el-button class="hero-card-btn" round @click="ykOpen = true">立即体验 <span>→</span></el-button>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- 统计条 -->
    <div class="stats-wrap">
      <div class="stats-bar">
        <div class="stat-item">
          <div class="stat-icon" style="background: #409eff"><el-icon><Cpu /></el-icon></div>
          <div class="stat-text">
            <div class="stat-value">{{ stats.agentTotal ?? '-' }}</div>
            <div class="stat-label">已发布智能体</div>
          </div>
        </div>
        <div class="stat-item">
          <div class="stat-icon" style="background: #10b981"><el-icon><Collection /></el-icon></div>
          <div class="stat-text">
            <div class="stat-value">{{ stats.kbTotal ?? '-' }}</div>
            <div class="stat-label">已发布知识库</div>
          </div>
        </div>
        <div class="stat-item">
          <div class="stat-icon" style="background: #8b5cf6"><el-icon><Link /></el-icon></div>
          <div class="stat-text">
            <div class="stat-value">{{ integrations.length }}</div>
            <div class="stat-label">第三方服务</div>
          </div>
        </div>
      </div>
    </div>

    <main class="landing-main">
      <!-- 我的工坊 -->
      <section id="studio" class="scroll-anchor">
        <StudioSection />
      </section>

      <!-- AI 广场 -->
      <section id="square" class="scroll-anchor square-section">
        <div class="section-title">
          <span class="title-bar" />
          <h2>AI 广场</h2>
          <p>全校师生共建共享的智能体、知识库与第三方服务</p>
        </div>

        <FlatBlock
          title="智能体"
          desc="点开即聊的 AI 助手"
          icon="🤖"
          :count="stats.agentTotal"
          more-href="/portal/apps/ai/hall/agents"
          more-label="查看更多"
          empty-label="暂无已发布智能体"
          :has-items="agents.length > 0"
        >
          <AgentHallCard v-for="a in agents" :key="a.id" :agent="a" />
        </FlatBlock>

        <FlatBlock
          title="知识库"
          desc="可提问的资料库"
          icon="📚"
          :count="stats.kbTotal"
          more-href="/portal/apps/ai/hall/kbs"
          more-label="查看更多"
          empty-label="暂无已发布知识库"
          :has-items="kbs.length > 0"
        >
          <KbHallCard v-for="kb in kbs" :key="kb.id" :kb="kb" />
        </FlatBlock>

        <FlatBlock
          title="第三方服务"
          desc="管理员精选挂接的外部智能体与应用"
          icon="🔗"
          :count="integrations.length"
          empty-label="暂无第三方服务"
          :has-items="integrations.length > 0"
        >
          <IntegrationLinkCard v-for="it in integrations" :key="it.id" :item="it" />
        </FlatBlock>
      </section>

      <!-- 底部行动卡 -->
      <section class="cta-card">
        <div class="cta-icon"><el-icon><MagicStick /></el-icon></div>
        <div class="cta-text">
          <h2>把你的知识变成全校可用的 AI 服务</h2>
          <p>上传资料建成知识库，或配置一个专属智能体，审核通过后即可发布到广场。</p>
        </div>
        <el-button class="cta-btn" round @click="scrollToStudio">去工坊创作</el-button>
      </section>
    </main>

    <!-- YIKnow 聊天弹窗 -->
    <el-dialog
      v-model="ykOpen"
      class="yk-dialog"
      width="min(1240px, 94vw)"
      :close-on-click-modal="false"
      destroy-on-close
    >
      <div class="yk-dialog-body">
        <YiKnowChat v-if="ykOpen" />
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { Collection, Cpu, Link, MagicStick } from '@element-plus/icons-vue';
import { aiCenterSquareApi } from '@/api/ai';
import type { AIAgent, AIKnowledgeBase, AIIntegration } from '@/types/ai';
import { aiSquareExt } from './ai-api';
import StudioSection from './studio-section.vue';
import AgentHallCard from './components/AgentHallCard.vue';
import KbHallCard from './components/KbHallCard.vue';
import IntegrationLinkCard from './components/IntegrationLinkCard.vue';
import FlatBlock from './components/FlatBlock.vue';
import YiKnowChat from './yi-know-chat.vue';

const FLAT_SIZE = 6;

const stats = ref<{ agentTotal?: number; kbTotal?: number }>({});
const agents = ref<AIAgent[]>([]);
const kbs = ref<AIKnowledgeBase[]>([]);
const integrations = ref<AIIntegration[]>([]);
const ykOpen = ref(false);

async function load() {
  try {
    const [agentRes, kbRes, intRes] = await Promise.all([
      aiCenterSquareApi.agents({ sort: 'hot', pageSize: FLAT_SIZE }),
      aiCenterSquareApi.kbs({ sort: 'hot', pageSize: FLAT_SIZE }),
      aiSquareExt.integrations()
    ]);
    agents.value = agentRes.items;
    stats.value = { ...stats.value, agentTotal: agentRes.total };
    kbs.value = kbRes.items;
    stats.value = { ...stats.value, kbTotal: kbRes.total };
    integrations.value = intRes.items;
  } catch {
    /* 加载失败静默降级，保留空态 */
  }
}

function scrollToSquare() {
  document.getElementById('square')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
function scrollToStudio() {
  document.getElementById('studio')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

onMounted(() => {
  load();
  // 锚点定位：/square、/studio 旧路由重定向到本页 #square/#studio
  const hash = window.location.hash.slice(1);
  if (hash) {
    setTimeout(() => {
      document.getElementById(hash)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  }
});
</script>

<style scoped>
.ai-landing {
  max-width: 1400px;
  margin: 0 auto;
}
.hero {
  background: linear-gradient(135deg, #409eff, #79bbff);
  border-radius: 0 0 16px 16px;
  padding: 48px 32px;
}
.hero-inner {
  max-width: 1200px;
  margin: 0 auto;
}
.hero-flex {
  display: flex;
  align-items: center;
  gap: 40px;
}
.hero-left {
  flex: 1;
  min-width: 0;
}
.hero-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: #fff;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 2px;
  border: 1px solid rgba(255, 255, 255, 0.35);
  background: rgba(255, 255, 255, 0.12);
  padding: 6px 14px;
  border-radius: 999px;
  margin-bottom: 20px;
}
.hero-title {
  font-size: 32px;
  font-weight: 700;
  color: #fff;
  margin: 0;
  line-height: 1.3;
}
.hero-sub {
  display: block;
  font-size: 22px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.85);
  margin-top: 8px;
}
.hero-desc {
  color: rgba(255, 255, 255, 0.85);
  font-size: 14px;
  line-height: 1.7;
  max-width: 560px;
  margin: 16px 0 24px;
}
.hero-cta {
  --el-button-bg-color: #fff;
  --el-button-text-color: #409eff;
  --el-button-hover-bg-color: #fde047;
  --el-button-hover-text-color: #334155;
  border: none;
  height: 40px;
  padding: 0 24px;
  font-weight: 600;
}
.hero-right {
  flex-shrink: 0;
}
.hero-card {
  width: 340px;
  border: 1px solid rgba(255, 255, 255, 0.25);
  background: rgba(255, 255, 255, 0.12);
  backdrop-filter: blur(12px);
  border-radius: 16px;
  padding: 32px;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.15);
  color: #fff;
}
.hero-brand {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 2px;
  border: 1px solid rgba(255, 255, 255, 0.3);
  background: rgba(255, 255, 255, 0.1);
  padding: 4px 12px;
  border-radius: 999px;
  margin-bottom: 20px;
}
.hero-card-title {
  font-size: 24px;
  font-weight: 700;
  line-height: 1.3;
}
.hero-card-slogan {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.75);
  margin-top: 8px;
}
.hero-card-desc {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.6);
  line-height: 1.6;
  margin: 16px 0 24px;
}
.hero-card-btn {
  --el-button-bg-color: #fff;
  --el-button-text-color: #409eff;
  --el-button-hover-bg-color: #fde047;
  --el-button-hover-text-color: #334155;
  border: none;
  height: 40px;
  padding: 0 24px;
  font-weight: 600;
}
.stats-wrap {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 32px;
}
.stats-bar {
  display: flex;
  gap: 16px;
  margin-top: -20px;
  position: relative;
  z-index: 2;
}
.stat-item {
  flex: 1;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
  padding: 16px 20px;
  display: flex;
  align-items: center;
  gap: 14px;
}
.stat-icon {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 22px;
}
.stat-value {
  font-size: 20px;
  font-weight: 700;
  color: #0f172a;
}
.stat-label {
  color: #64748b;
  font-size: 12px;
  margin-top: 2px;
}
.landing-main {
  max-width: 1200px;
  margin: 0 auto;
  padding: 32px;
  display: flex;
  flex-direction: column;
  gap: 40px;
}
.scroll-anchor {
  scroll-margin-top: 20px;
}
.section-title {
  margin-bottom: 16px;
}
.section-title h2 {
  font-size: 20px;
  font-weight: 700;
  color: #0f172a;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 8px;
}
.title-bar {
  display: inline-block;
  width: 4px;
  height: 20px;
  border-radius: 2px;
  background: linear-gradient(180deg, #409eff, #79bbff);
  margin-right: 4px;
}
.section-title p {
  color: #909399;
  font-size: 14px;
  margin: 6px 0 0 12px;
}
.flat-block {
  background: #fff;
  border: 1px solid #e7e5e4;
  border-radius: 16px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.04);
  overflow: hidden;
  margin-bottom: 16px;
}
.flat-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 20px 24px;
  border-bottom: 1px solid #f0f0f0;
}
.flat-head-left {
  display: flex;
  align-items: center;
  gap: 12px;
}
.flat-icon {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  background: var(--el-color-primary-light-9);
  border: 1px solid var(--el-color-primary-light-7);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  flex-shrink: 0;
}
.flat-title {
  font-size: 16px;
  font-weight: 700;
  color: #0f172a;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 8px;
}
.flat-count {
  color: #64748b;
  font-size: 13px;
  font-weight: 400;
}
.flat-desc {
  color: #94a3b8;
  font-size: 12px;
  margin: 2px 0 0;
}
.flat-more {
  color: var(--el-color-primary);
  font-size: 14px;
  text-decoration: none;
  flex-shrink: 0;
}
.flat-more:hover {
  text-decoration: underline;
}
.flat-body {
  padding: 20px;
}
.flat-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 20px;
}
.flat-empty {
  border: 1px dashed #e4e7ed;
  border-radius: 12px;
  padding: 40px;
  text-align: center;
}
.flat-empty p {
  color: #909399;
  font-size: 14px;
  margin: 0;
}
.cta-card {
  background: linear-gradient(90deg, #409eff, #409eff);
  border-radius: 16px;
  padding: 24px 32px;
  box-shadow: 0 8px 24px rgba(22, 119, 255, 0.25);
  display: flex;
  align-items: center;
  gap: 16px;
  position: relative;
  overflow: hidden;
}
.cta-icon {
  width: 56px;
  height: 56px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.15);
  border: 1px solid rgba(255, 255, 255, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 28px;
  flex-shrink: 0;
}
.cta-text {
  flex: 1;
  min-width: 0;
}
.cta-text h2 {
  color: #fff;
  font-size: 18px;
  font-weight: 700;
  margin: 0;
}
.cta-text p {
  color: rgba(255, 255, 255, 0.8);
  font-size: 14px;
  margin: 6px 0 0;
  max-width: 640px;
}
.cta-btn {
  --el-button-bg-color: #fff;
  --el-button-text-color: #409eff;
  border: none;
  height: 40px;
  padding: 0 24px;
  font-weight: 600;
  flex-shrink: 0;
}
.yk-dialog-body {
  height: 80vh;
}
</style>
