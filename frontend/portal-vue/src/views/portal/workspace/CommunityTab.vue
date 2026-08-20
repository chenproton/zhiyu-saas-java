<!--
  学习社区 Tab（React community-tab 对位）。
  对齐原 React 版 community-tab.tsx：
  - 顶部 4 指标（热门话题 / 我的提问 / 学习小组 / 我的导师）；
  - 左 2/3 话题列表（热门话题/最新发布/我的提问）与详情（返回列表 / 回复流 / 楼中楼回复 / 回复框）；
  - 右 1/3 侧边栏（学习小组 / 我的导师 / 社区规范，需求明确保留演示数据）；
  - 发起提问弹窗（标题必填 128、标签选填 32、内容必填）；
  - 排序切换与详情加载均带请求序号守卫，丢弃过期响应。
  话题/回复接口沿用门户既有 api/portal.ts portalCommunityApi（同 React 契约）。
-->
<template>
  <div class="community-tab">
    <!-- 统计 -->
    <div class="stat-grid">
      <StatCard title="热门话题" :value="totalTopics" :icon="Sunny" trend="按阅读热度排序" color="rose" />
      <StatCard
        title="我的提问"
        :value="mineTotal"
        :icon="ChatDotSquare"
        :trend="mineTotal > 0 ? `${mineTotal} 个提问` : '暂未发起'"
        color="blue"
      />
      <StatCard title="学习小组" :value="STUDY_GROUPS.length" :icon="UserFilled" trend="3 个可加入" color="green" />
      <StatCard title="我的导师" :value="MENTORS.length" :icon="Medal" trend="可在线咨询" color="amber" />
    </div>

    <div class="post-row">
      <el-button type="primary" :disabled="!!detail" @click="postOpen = true">
        <el-icon><Plus /></el-icon>发起提问
      </el-button>
    </div>

    <div class="community-layout">
      <!-- 话题列表 / 详情 -->
      <div class="main-col">
        <div v-if="detail" class="detail-card">
          <button type="button" class="back-btn" @click="closeDetail">
            <el-icon><ArrowLeft /></el-icon>返回列表
          </button>

          <div v-if="detailLoading" class="loading-block">
            <el-icon class="is-loading"><Loading /></el-icon>加载中...
          </div>
          <template v-else>
            <div class="detail-head">
              <span class="avatar lg">{{ avatarChar(detail.authorName) }}</span>
              <div class="detail-head-body">
                <div class="detail-title-row">
                  <h2 class="detail-title">{{ detail.title }}</h2>
                  <span v-if="detail.viewCount >= 50" class="hot-badge">
                    <el-icon><Sunny /></el-icon>热门
                  </span>
                </div>
                <div class="detail-meta">
                  <span class="author">{{ detail.authorName }}</span>
                  <el-tag v-if="detail.tag" size="small" type="info" effect="plain">{{ detail.tag }}</el-tag>
                  <span>{{ formatDateTime(detail.createdAt) }}</span>
                  <span class="meta-cell"><el-icon><ChatDotSquare /></el-icon>{{ detail.replyCount }} 回复</span>
                  <span>{{ detail.viewCount }} 浏览</span>
                </div>
              </div>
            </div>

            <div class="detail-content">{{ detail.content }}</div>

            <!-- 回复流 -->
            <h3 class="reply-title">全部回复（{{ replies.length }}）</h3>
            <div class="reply-list">
              <el-empty v-if="replies.length === 0" description="暂无回复，快来抢沙发～" :image-size="60" />
              <div v-for="reply in replies" :key="reply.id" class="reply-item">
                <span class="avatar sm">{{ avatarChar(reply.authorName) }}</span>
                <div class="reply-body">
                  <div class="reply-meta">
                    <span class="author">{{ reply.authorName }}</span>
                    <span v-if="reply.parentAuthorName" class="reply-to">
                      回复 @{{ reply.parentAuthorName }}
                    </span>
                    <span>{{ formatDateTime(reply.createdAt) }}</span>
                  </div>
                  <p class="reply-content">{{ reply.content }}</p>
                  <button type="button" class="reply-btn" @click="replyingTo = reply">
                    <el-icon><ChatDotRound /></el-icon>回复
                  </button>
                </div>
              </div>
            </div>

            <!-- 回复输入 -->
            <div class="reply-input">
              <div v-if="replyingTo" class="reply-hint">
                <span>回复 @{{ replyingTo.authorName }} 的评论</span>
                <button type="button" class="cancel-btn" @click="replyingTo = null">取消</button>
              </div>
              <div class="reply-box">
                <el-input
                  v-model="replyText"
                  type="textarea"
                  :rows="2"
                  resize="none"
                  placeholder="写下你的回复..."
                />
                <el-button
                  type="primary"
                  :loading="replySubmitting"
                  :disabled="!replyText.trim() || replySubmitting"
                  @click="submitReply"
                >
                  <el-icon><Promotion /></el-icon>回复
                </el-button>
              </div>
            </div>
          </template>
        </div>

        <div v-else>
          <el-radio-group v-model="sort" class="sort-tabs" @change="onSortChange">
            <el-radio-button value="hot">热门话题</el-radio-button>
            <el-radio-button value="latest">最新发布</el-radio-button>
            <el-radio-button value="mine">我的提问</el-radio-button>
          </el-radio-group>

          <div v-if="loading" class="loading-block">
            <el-icon class="is-loading"><Loading /></el-icon>加载中...
          </div>
          <div v-else-if="topics.length === 0" class="topics-empty">
            <el-empty
              :description="sort === 'mine' ? '你还没有发起过提问' : '暂无话题，来发第一帖吧'"
            >
              <el-button type="primary" size="small" @click="postOpen = true">
                <el-icon><Plus /></el-icon>{{ sort === 'mine' ? '去提问' : '发起提问' }}
              </el-button>
            </el-empty>
          </div>
          <div v-else class="topic-list">
            <div v-for="topic in topics" :key="topic.id" class="topic-item" @click="openDetail(topic)">
              <span class="avatar lg">{{ avatarChar(topic.authorName) }}</span>
              <div class="topic-body">
                <div class="topic-title-row">
                  <h3 class="topic-title">{{ topic.title }}</h3>
                  <span v-if="topic.viewCount >= 50" class="hot-badge">
                    <el-icon><Sunny /></el-icon>热门
                  </span>
                </div>
                <div class="topic-meta">
                  <span class="author">{{ topic.authorName }}</span>
                  <el-tag v-if="topic.tag" size="small" type="info" effect="plain">{{ topic.tag }}</el-tag>
                </div>
                <div class="topic-stats">
                  <span class="meta-cell"><el-icon><ChatDotSquare /></el-icon>{{ topic.replyCount }} 回复</span>
                  <span>{{ topic.viewCount }} 浏览</span>
                  <span>{{ formatDateTime(topic.createdAt) }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 侧边栏 -->
      <div class="side-col">
        <SectionCard title="学习小组" :icon="UserFilled" icon-color="blue">
          <div class="side-list">
            <div v-for="group in STUDY_GROUPS" :key="group.id" class="side-row">
              <div>
                <p class="side-name">{{ group.name }}</p>
                <p class="side-sub">{{ group.members }} 人</p>
              </div>
              <el-button size="small" :type="group.active ? 'primary' : 'default'">
                {{ group.active ? '加入' : '已满' }}
              </el-button>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="我的导师" :icon="Medal" icon-color="amber">
          <div class="side-list">
            <div v-for="mentor in MENTORS" :key="mentor.id" class="side-row">
              <span class="avatar amber">{{ mentor.avatar }}</span>
              <div class="side-grow">
                <p class="side-name">{{ mentor.name }}</p>
                <p class="side-sub">{{ mentor.role }}</p>
              </div>
              <el-button size="small">咨询</el-button>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="社区规范" :icon="ChatRound" icon-color="green">
          <ul class="rules">
            <li>请友善交流，尊重他人观点</li>
            <li>提问前建议先搜索已有话题</li>
            <li>鼓励分享学习笔记与实践经验</li>
            <li>禁止发布与教学无关的内容</li>
          </ul>
        </SectionCard>
      </div>
    </div>

    <!-- 发帖弹窗 -->
    <el-dialog v-model="postOpen" title="发起提问" width="520px">
      <p class="dialog-desc">分享你的学习问题或经验，和同学们一起交流。</p>
      <div class="post-form">
        <div class="field-row">
          <label class="field-label">标题</label>
          <el-input v-model="postTitle" maxlength="128" placeholder="一句话说清你的问题" />
        </div>
        <div class="field-row">
          <label class="field-label">标签（选填）</label>
          <el-input v-model="postTag" maxlength="32" placeholder="如：网络技术" />
        </div>
        <div class="field-row">
          <label class="field-label">内容</label>
          <el-input v-model="postContent" type="textarea" :rows="5" placeholder="补充详细描述，便于同学们解答" />
        </div>
      </div>
      <template #footer>
        <el-button @click="postOpen = false">取消</el-button>
        <el-button type="primary" :loading="postSubmitting" @click="submitPost">发布</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { ElMessage } from 'element-plus';
import {
  ArrowLeft,
  ChatDotRound,
  ChatDotSquare,
  ChatRound,
  Loading,
  Medal,
  Plus,
  Promotion,
  Sunny,
  UserFilled
} from '@element-plus/icons-vue';
import { portalCommunityApi } from '@/api/portal';
import type { CommunityReply, CommunityTopic, CommunityTopicSort } from '@/types/portal';
import { formatDateTime } from '@/views/landing/evaluation-types';
import SectionCard from './SectionCard.vue';
import StatCard from './StatCard.vue';

// 右侧学习小组/导师保持演示数据（需求明确保留 mock）
const STUDY_GROUPS = [
  { id: 'g1', name: '网络技术学习小组', members: 28, active: true },
  { id: 'g2', name: 'Linux运维互助群', members: 16, active: true },
  { id: 'g3', name: '岗位面试经验分享', members: 45, active: false },
  { id: 'g4', name: '技能大赛备赛组', members: 12, active: true }
];
const MENTORS = [
  { id: 'm1', name: '王教授', role: '网络基础课程教师', avatar: '王' },
  { id: 'm2', name: '李老师', role: '企业导师 · 华为', avatar: '李' },
  { id: 'm3', name: '张老师', role: 'Linux系统管理教师', avatar: '张' }
];

const sort = ref<CommunityTopicSort>('latest');
const topics = ref<CommunityTopic[]>([]);
const hotTotal = ref(0);
const mineTotal = ref(0);
const loading = ref(true);
// 排序切换请求序号 / 详情加载序号：丢弃过期响应
let loadSeq = 0;
let detailSeq = 0;

const detail = ref<CommunityTopic | null>(null);
const replies = ref<CommunityReply[]>([]);
const detailLoading = ref(false);
const replyingTo = ref<CommunityReply | null>(null);
const replyText = ref('');
const replySubmitting = ref(false);

const postOpen = ref(false);
const postTitle = ref('');
const postTag = ref('');
const postContent = ref('');
const postSubmitting = ref(false);

const totalTopics = computed(() => hotTotal.value || topics.value.length);

function avatarChar(name?: string): string {
  return name ? name.charAt(0) : '?';
}

async function loadTopics(s: CommunityTopicSort) {
  const seq = ++loadSeq;
  loading.value = true;
  try {
    const [res, mineRes, hotRes] = await Promise.all([
      portalCommunityApi.listTopics({ sort: s, limit: 50 }),
      portalCommunityApi.listTopics({ sort: 'mine', limit: 1 }),
      portalCommunityApi.listTopics({ sort: 'hot', limit: 1 })
    ]);
    // 快速切换排序时丢弃过期响应，防止旧排序列表覆盖新排序
    if (seq !== loadSeq) return;
    topics.value = res.items;
    mineTotal.value = mineRes.total;
    hotTotal.value = hotRes.total;
  } catch (e) {
    if (seq !== loadSeq) return;
    ElMessage.error((e as Error).message || '加载学习社区话题失败');
    topics.value = [];
  } finally {
    if (seq === loadSeq) loading.value = false;
  }
}

function onSortChange() {
  loadTopics(sort.value);
}

async function openDetail(topic: CommunityTopic) {
  const seq = ++detailSeq;
  detail.value = topic;
  detailLoading.value = true;
  replies.value = [];
  replyingTo.value = null;
  replyText.value = '';
  try {
    const [topicDetail, replyRes] = await Promise.all([
      portalCommunityApi.getTopic(topic.id),
      portalCommunityApi.listReplies(topic.id)
    ]);
    if (seq !== detailSeq) return;
    detail.value = topicDetail;
    replies.value = replyRes.items;
  } catch (e) {
    if (seq !== detailSeq) return;
    ElMessage.error((e as Error).message || '加载话题详情失败');
    detail.value = null;
  } finally {
    if (seq === detailSeq) detailLoading.value = false;
  }
}

function closeDetail() {
  // 使进行中的详情请求过期，避免迟到的响应重新弹出详情
  detailSeq += 1;
  detail.value = null;
  replyingTo.value = null;
  replyText.value = '';
  loadTopics(sort.value);
}

async function submitPost() {
  const title = postTitle.value.trim();
  const content = postContent.value.trim();
  if (!title) {
    ElMessage.warning('请填写标题');
    return;
  }
  if (!content) {
    ElMessage.warning('请填写内容');
    return;
  }
  postSubmitting.value = true;
  try {
    await portalCommunityApi.createTopic({ title, content, tag: postTag.value.trim() || undefined });
    ElMessage.success('发布成功');
    postOpen.value = false;
    postTitle.value = '';
    postTag.value = '';
    postContent.value = '';
    await loadTopics(sort.value);
  } catch (e) {
    ElMessage.error((e as Error).message || '发布失败，请稍后重试');
  } finally {
    postSubmitting.value = false;
  }
}

async function submitReply() {
  const content = replyText.value.trim();
  if (!detail.value || !content) return;
  replySubmitting.value = true;
  try {
    await portalCommunityApi.createReply(detail.value.id, {
      content,
      parentId: replyingTo.value?.id
    });
    ElMessage.success('回复成功');
    replyText.value = '';
    replyingTo.value = null;
    const [topicDetail, replyRes] = await Promise.all([
      portalCommunityApi.getTopic(detail.value.id),
      portalCommunityApi.listReplies(detail.value.id)
    ]);
    detail.value = topicDetail;
    replies.value = replyRes.items;
  } catch (e) {
    ElMessage.error((e as Error).message || '回复失败');
  } finally {
    replySubmitting.value = false;
  }
}

onMounted(() => loadTopics(sort.value));
</script>

<style scoped>
.community-tab {
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.stat-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 16px;
}
@media (min-width: 640px) {
  .stat-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (min-width: 1024px) {
  .stat-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); }
}
.post-row {
  display: flex;
  justify-content: flex-end;
}
.community-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 20px;
}
@media (min-width: 1024px) {
  .community-layout { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .main-col { grid-column: span 2; }
}
.side-col {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

/* 头像 */
.avatar {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
  font-weight: 500;
}
.avatar.lg { width: 40px; height: 40px; font-size: 14px; }
.avatar.sm { width: 32px; height: 32px; font-size: 12px; background: #f3f4f6; color: #4b5563; }
.avatar.amber { width: 40px; height: 40px; font-size: 14px; background: #fffbeb; color: #d97706; }

/* 列表 */
.sort-tabs {
  margin-bottom: 16px;
}
.loading-block {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 64px 0;
  color: #9ca3af;
}
.topics-empty {
  padding: 32px;
  border: 1px solid #f3f4f6;
  border-radius: 12px;
  background: #fff;
}
.topic-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.topic-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 16px;
  border: 1px solid #f3f4f6;
  border-radius: 12px;
  background: #fff;
  cursor: pointer;
  transition: border-color 0.2s, box-shadow 0.2s;
}
.topic-item:hover {
  border-color: var(--el-color-primary-light-7);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}
.topic-body {
  flex: 1;
  min-width: 0;
}
.topic-title-row,
.detail-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}
.topic-title {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: #111827;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.hot-badge {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: 2px;
  font-size: 12px;
  padding: 1px 8px;
  border-radius: 999px;
  background: #fff1f2;
  color: #e11d48;
  border: 1px solid #ffe4e6;
}
.topic-meta,
.topic-stats,
.detail-meta,
.reply-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  font-size: 12px;
  color: #6b7280;
}
.topic-stats {
  margin-top: 8px;
  color: #9ca3af;
}
.meta-cell {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.author {
  font-weight: 500;
  color: #374151;
}

/* 详情 */
.detail-card {
  padding: 20px;
  border: 1px solid #f3f4f6;
  border-radius: 12px;
  background: #fff;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
}
.back-btn,
.reply-btn,
.cancel-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border: none;
  background: transparent;
  font-size: 12px;
  color: #6b7280;
  cursor: pointer;
  padding: 0;
}
.back-btn {
  margin-bottom: 16px;
}
.back-btn:hover,
.reply-btn:hover {
  color: var(--el-color-primary);
}
.detail-head {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}
.detail-head-body {
  flex: 1;
  min-width: 0;
}
.detail-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #111827;
}
.detail-content {
  white-space: pre-wrap;
  font-size: 14px;
  color: #374151;
  line-height: 1.8;
  background: #f9fafb;
  border-radius: 12px;
  padding: 16px;
  margin: 16px 0 20px;
}
.reply-title {
  margin: 0 0 12px;
  font-size: 14px;
  font-weight: 600;
  color: #111827;
}
.reply-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-bottom: 20px;
}
.reply-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}
.reply-body {
  flex: 1;
  min-width: 0;
}
.reply-to {
  color: #9ca3af;
}
.reply-content {
  margin: 4px 0 0;
  font-size: 14px;
  color: #374151;
  white-space: pre-wrap;
}
.reply-input {
  border: 1px solid #f3f4f6;
  border-radius: 12px;
  background: #f9fafb;
  padding: 12px;
}
.reply-hint {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 12px;
  color: #6b7280;
  margin-bottom: 8px;
}
.reply-box {
  display: flex;
  align-items: flex-end;
  gap: 8px;
}

/* 侧栏 */
.side-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.side-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px;
  border-radius: 12px;
  background: #f9fafb;
}
.side-grow {
  flex: 1;
  min-width: 0;
}
.side-name {
  margin: 0;
  font-size: 14px;
  font-weight: 500;
  color: #111827;
}
.side-sub {
  margin: 0;
  font-size: 12px;
  color: #6b7280;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.rules {
  margin: 0;
  padding-left: 16px;
  font-size: 12px;
  color: #6b7280;
}
.rules li {
  margin-bottom: 8px;
}

/* 弹窗 */
.dialog-desc {
  margin: 0 0 16px;
  font-size: 13px;
  color: #6b7280;
}
.post-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.field-row {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.field-label {
  font-size: 12px;
  font-weight: 500;
  color: #4b5563;
}
</style>
