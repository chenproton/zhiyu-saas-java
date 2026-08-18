<template>
  <div class="studio-panel">
    <div class="panel-head">
      <div class="head-left">
        <div class="head-icon"><el-icon><Tools /></el-icon></div>
        <div>
          <h2>我的工坊</h2>
          <p>创建并管理你的知识库与智能体，提交审核后发布到广场</p>
        </div>
      </div>
      <div class="head-actions">
        <el-button type="primary" round @click="router.push('/portal/apps/ai/studio/kb/new')">
          <el-icon><Plus /></el-icon>新建知识库
        </el-button>
        <el-button round @click="router.push('/portal/apps/ai/studio/agents/new')">
          <el-icon><Plus /></el-icon>新建智能体
        </el-button>
      </div>
    </div>

    <div class="panel-body">
      <div v-if="loading" class="loading-box">加载中...</div>
      <div v-else-if="totalAll === 0" class="empty-box">还没有产出，点击右上角新建知识库或智能体开始</div>
      <div v-else class="studio-grid">
        <div class="donut-col">
          <div class="donut-card">
            <div class="donut-title"><el-icon><DataLine /></el-icon>类型占比</div>
            <DonutChart :data="typePie" :size="140" :thickness="18">
              <div class="donut-center">
                <div class="donut-total">{{ totalAll }}</div>
                <div class="donut-label">全部</div>
              </div>
            </DonutChart>
            <div class="donut-legend">
              <div v-for="d in typePie" :key="d.name" class="legend-row">
                <span class="legend-dot" :style="{ background: d.color }" />
                <span class="legend-name">{{ d.name }}</span>
                <span class="legend-value">{{ d.value }}</span>
              </div>
            </div>
          </div>
        </div>

        <div class="cards-col">
          <div v-for="kb in myKbs" :key="kb.id" class="studio-card">
            <div class="card-cover" :style="coverStyle(kb.coverImage, kb.id)">
              <el-icon v-if="!kb.coverImage" class="cover-icon"><Collection /></el-icon>
              <div class="cover-status"><AiStatusBadge :status="kb.status" /></div>
            </div>
            <div class="card-body">
              <h3 class="card-title">{{ kb.name }}</h3>
              <p v-if="kb.description" class="card-desc">{{ kb.description }}</p>
              <div v-if="kb.tags.length" class="card-tags">
                <el-tag v-for="t in kb.tags" :key="t" size="small" type="info">{{ t }}</el-tag>
              </div>
              <p v-if="kb.status === 'rejected' && kb.reviewComment" class="reject-reason">驳回原因：{{ kb.reviewComment }}</p>
              <div class="card-stats">
                <span><el-icon><Document /></el-icon>{{ kb.docCount }} 个文档</span>
                <span><el-icon><QuestionFilled /></el-icon>{{ kb.askCount }} 次提问</span>
              </div>
              <div class="card-actions">
                <el-button v-if="kbCanEdit(kb)" size="small" text @click="router.push(`/portal/apps/ai/studio/kb/${kb.id}`)">编辑</el-button>
                <el-button v-if="kbIsOwner(kb) && (kb.status === 'private' || kb.status === 'rejected')" size="small" text @click="submitKb(kb.id)">提交审核</el-button>
                <el-button v-if="kbIsOwner(kb) && kb.status === 'published'" size="small" text @click="unpublishKb(kb.id)">下架</el-button>
                <el-button v-if="kbIsOwner(kb) && (kb.status === 'private' || kb.status === 'rejected')" size="small" text type="danger" @click="askDelete('kb', kb.id, kb.name)">删除</el-button>
              </div>
            </div>
          </div>

          <div v-for="a in agents" :key="a.id" class="studio-card">
            <div class="card-cover" :style="coverStyle(a.coverImage, a.id)">
              <span v-if="!a.coverImage" class="cover-emoji">{{ a.avatar || '🤖' }}</span>
              <div class="cover-status"><AiStatusBadge :status="a.status" /></div>
            </div>
            <div class="card-body">
              <h3 class="card-title">{{ a.name }}</h3>
              <p v-if="a.description" class="card-desc">{{ a.description }}</p>
              <p v-if="a.status === 'rejected' && a.reviewComment" class="reject-reason">驳回原因：{{ a.reviewComment }}</p>
              <div class="card-stats">
                <span><el-icon><ChatDotRound /></el-icon>{{ a.chatCount }} 次对话</span>
              </div>
              <div class="card-actions">
                <el-button size="small" text @click="router.push(`/portal/apps/ai/studio/agents/${a.id}`)">编辑</el-button>
                <el-button v-if="a.status === 'private' || a.status === 'rejected'" size="small" text @click="submitAgent(a.id)">提交审核</el-button>
                <template v-if="a.status === 'published'">
                  <el-button size="small" text @click="unpublishAgent(a.id)">下架</el-button>
                  <el-button size="small" text @click="router.push(`/portal/apps/ai/agents/${a.id}`)">对话</el-button>
                </template>
                <el-button v-if="a.status === 'private' || a.status === 'rejected'" size="small" text type="danger" @click="askDelete('agent', a.id, a.name)">删除</el-button>
              </div>
            </div>
          </div>

          <div v-for="kb in sharedKbs" :key="kb.id" class="studio-card">
            <div class="card-cover" :style="coverStyle(kb.coverImage, kb.id)">
              <el-icon v-if="!kb.coverImage" class="cover-icon"><Collection /></el-icon>
              <div class="cover-status"><AiStatusBadge :status="kb.status" /></div>
            </div>
            <div class="card-body">
              <h3 class="card-title">{{ kb.name }}</h3>
              <p v-if="kb.description" class="card-desc">{{ kb.description }}</p>
              <div class="card-stats">
                <span><el-icon><Document /></el-icon>{{ kb.docCount }} 个文档</span>
                <span><el-icon><QuestionFilled /></el-icon>{{ kb.askCount }} 次提问</span>
              </div>
              <div class="card-actions">
                <el-button v-if="kbCanEdit(kb)" size="small" text @click="router.push(`/portal/apps/ai/studio/kb/${kb.id}`)">编辑</el-button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 删除确认 -->
    <el-dialog v-model="deleteDialog" title="确认删除" width="440px">
      <p>删除后不可恢复，确定删除「{{ deleteTarget?.name }}」吗？</p>
      <template #footer>
        <el-button @click="deleteDialog = false">取消</el-button>
        <el-button type="danger" :loading="acting" @click="doDelete">删除</el-button>
      </template>
    </el-dialog>

    <!-- 提交审核 warnings -->
    <el-dialog v-model="warningsDialog" title="已提交，等待管理员审核" width="480px">
      <p class="warn-sub">提交成功，但请注意以下事项</p>
      <ul class="warn-list">
        <li v-for="(w, i) in warnings" :key="i">{{ w }}</li>
      </ul>
      <template #footer>
        <el-button type="primary" @click="warningsDialog = false">确认</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { ChatDotRound, Collection, DataLine, Document, Plus, QuestionFilled, Tools } from '@element-plus/icons-vue';
import { aiCenterAgentApi, aiCenterKbApi } from '@/api/ai';
import type { AIAgent, AIKnowledgeBase } from '@/types/ai';
import { aiAgentExt, aiKbExt, coverGradientFor } from './ai-api';
import AiStatusBadge from './components/AiStatusBadge.vue';
import DonutChart from '../landing/DonutChart.vue';

const router = useRouter();

const myKbs = ref<AIKnowledgeBase[]>([]);
const sharedKbs = ref<AIKnowledgeBase[]>([]);
const agents = ref<AIAgent[]>([]);
const loading = ref(true);
const acting = ref(false);
const deleteDialog = ref(false);
const deleteTarget = ref<{ kind: 'kb' | 'agent'; id: string; name: string } | null>(null);
const warningsDialog = ref(false);
const warnings = ref<string[]>([]);

const totalMine = computed(() => myKbs.value.length + agents.value.length);
const totalAll = computed(() => totalMine.value + sharedKbs.value.length);

const typePie = computed(() =>
  [
    { name: '知识库', value: myKbs.value.length, color: '#409eff' },
    { name: '智能体', value: agents.value.length, color: '#10b981' },
    { name: '共享给我的', value: sharedKbs.value.length, color: '#f59e0b' }
  ].filter((d) => d.value > 0)
);

function coverStyle(cover?: string, seed?: string) {
  return cover
    ? { backgroundImage: `url('${cover}')`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : { background: coverGradientFor(seed || '') };
}

function kbCanEdit(kb: AIKnowledgeBase) {
  const role = (kb as AIKnowledgeBase & { myRole?: string }).myRole ?? 'owner';
  return role === 'owner' || role === 'editor';
}
function kbIsOwner(kb: AIKnowledgeBase) {
  return ((kb as AIKnowledgeBase & { myRole?: string }).myRole ?? 'owner') === 'owner';
}

async function loadKbs() {
  try {
    const [mine, shared] = await Promise.all([
      aiKbExt.listMine({ scope: 'owned' }),
      aiKbExt.listMine({ scope: 'collaborating' })
    ]);
    myKbs.value = mine.items;
    sharedKbs.value = shared.items;
  } catch (e) {
    ElMessage.error((e as Error).message || '加载失败');
  }
}
async function loadAgents() {
  try {
    const res = await aiCenterAgentApi.listMine();
    agents.value = res.items ?? [];
  } catch (e) {
    ElMessage.error((e as Error).message || '加载失败');
  }
}

async function load() {
  loading.value = true;
  await Promise.all([loadKbs(), loadAgents()]);
  loading.value = false;
}

async function submitKb(id: string) {
  try {
    await aiKbExt.submit(id);
    ElMessage.success('已提交，等待管理员审核');
    loadKbs();
  } catch (e) {
    ElMessage.error((e as Error).message || '操作失败');
  }
}
async function unpublishKb(id: string) {
  try {
    await aiKbExt.unpublish(id);
    ElMessage.success('已下架');
    loadKbs();
  } catch (e) {
    ElMessage.error((e as Error).message || '操作失败');
  }
}
async function submitAgent(id: string) {
  if (acting.value) return;
  acting.value = true;
  try {
    const res = await aiAgentExt.submit(id);
    if (res.warnings && res.warnings.length > 0) {
      warnings.value = res.warnings;
      warningsDialog.value = true;
    } else {
      ElMessage.success('已提交，等待管理员审核');
    }
    loadAgents();
  } catch (e) {
    ElMessage.error((e as Error).message || '操作失败');
  } finally {
    acting.value = false;
  }
}
async function unpublishAgent(id: string) {
  try {
    await aiAgentExt.unpublish(id);
    ElMessage.success('已下架');
    loadAgents();
  } catch (e) {
    ElMessage.error((e as Error).message || '操作失败');
  }
}

function askDelete(kind: 'kb' | 'agent', id: string, name: string) {
  deleteTarget.value = { kind, id, name };
  deleteDialog.value = true;
}

async function doDelete() {
  if (!deleteTarget.value || acting.value) return;
  acting.value = true;
  try {
    if (deleteTarget.value.kind === 'kb') {
      await aiCenterKbApi.remove(deleteTarget.value.id);
    } else {
      await aiCenterAgentApi.remove(deleteTarget.value.id);
    }
    ElMessage.success('已删除');
    deleteDialog.value = false;
    deleteTarget.value = null;
    load();
  } catch (e) {
    ElMessage.error((e as Error).message || '操作失败');
  } finally {
    acting.value = false;
  }
}

onMounted(load);
</script>

<style scoped>
.studio-panel {
  background: #fff;
  border: 1px solid #e7e5e4;
  border-radius: 16px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.04);
  overflow: hidden;
}
.panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 24px;
  border-bottom: 1px solid #f0f0f0;
  flex-wrap: wrap;
}
.head-left {
  display: flex;
  align-items: center;
  gap: 16px;
}
.head-icon {
  width: 48px;
  height: 48px;
  border-radius: 16px;
  background: var(--el-color-primary-light-9);
  border: 1px solid var(--el-color-primary-light-7);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--el-color-primary);
  font-size: 24px;
  flex-shrink: 0;
}
.head-left h2 {
  font-size: 18px;
  font-weight: 700;
  margin: 0;
  color: #0f172a;
}
.head-left p {
  color: #64748b;
  font-size: 14px;
  margin: 4px 0 0;
}
.head-actions {
  display: flex;
  gap: 10px;
  flex-shrink: 0;
}
.panel-body {
  padding: 20px;
}
.loading-box,
.empty-box {
  text-align: center;
  color: #909399;
  font-size: 14px;
  padding: 40px 0;
}
.empty-box {
  border: 1px dashed #e4e7ed;
  border-radius: 16px;
}
.studio-grid {
  display: flex;
  gap: 20px;
  align-items: flex-start;
}
.donut-col {
  width: 220px;
  flex-shrink: 0;
}
.donut-card {
  background: #f8fafc;
  border: 1px solid #eef2f7;
  border-radius: 16px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.donut-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 700;
  color: #0f172a;
  margin-bottom: 12px;
  width: 100%;
}
.donut-center {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}
.donut-total {
  font-size: 18px;
  font-weight: 700;
  color: #0f172a;
  line-height: 1;
}
.donut-label {
  font-size: 11px;
  color: #64748b;
  margin-top: 4px;
}
.donut-legend {
  width: 100%;
  margin-top: 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.legend-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
}
.legend-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}
.legend-name {
  flex: 1;
  color: #475569;
}
.legend-value {
  font-weight: 600;
  color: #0f172a;
}
.cards-col {
  flex: 1;
  min-width: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 20px;
  align-content: start;
}
.studio-card {
  background: #fff;
  border: 1px solid #e7e5e4;
  border-radius: 16px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.04);
  transition: all 0.2s;
}
.studio-card:hover {
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.1);
  transform: translateY(-4px);
}
.card-cover {
  height: 96px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}
.cover-icon {
  font-size: 40px;
  color: rgba(255, 255, 255, 0.8);
}
.cover-emoji {
  font-size: 40px;
}
.cover-status {
  position: absolute;
  top: 12px;
  right: 12px;
}
.card-body {
  padding: 16px;
  flex: 1;
  display: flex;
  flex-direction: column;
}
.card-title {
  font-size: 15px;
  font-weight: 600;
  color: #1f2937;
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.card-desc {
  color: #9ca3af;
  font-size: 12px;
  margin: 4px 0 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.card-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 6px;
}
.reject-reason {
  color: #f56c6c;
  font-size: 12px;
  margin: 6px 0 0;
}
.card-stats {
  display: flex;
  gap: 16px;
  color: #9ca3af;
  font-size: 11px;
  padding: 10px 0;
  margin-top: 8px;
  border-bottom: 1px solid #f8fafc;
}
.card-stats span {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.card-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  padding-top: 10px;
}
.warn-sub {
  color: #909399;
  margin: 0 0 12px;
}
.warn-list {
  margin: 0;
  padding-left: 20px;
  color: #606266;
  font-size: 14px;
}
</style>
