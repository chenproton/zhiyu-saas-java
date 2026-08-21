<template>
  <div class="community-page">
    <!-- 统计 -->
    <el-row :gutter="16" class="stats-row">
      <el-col :span="6"><div class="stat"><div class="stat-value rose">{{ hotTotal || topics.length }}</div><div class="stat-label">热门话题</div></div></el-col>
      <el-col :span="6"><div class="stat"><div class="stat-value blue">{{ mineTotal }}</div><div class="stat-label">我的提问</div></div></el-col>
      <el-col :span="6"><div class="stat"><div class="stat-value green">{{ studyGroups.length }}</div><div class="stat-label">学习小组</div></div></el-col>
      <el-col :span="6"><div class="stat"><div class="stat-value amber">{{ mentors.length }}</div><div class="stat-label">我的导师</div></div></el-col>
    </el-row>

    <div class="header-row">
      <el-button type="primary" @click="postOpen = true" :disabled="!!detail">发起提问</el-button>
    </div>

    <div class="layout">
      <!-- 左侧：话题列表 / 详情 -->
      <div class="main-col">
        <el-card v-if="detail" shadow="never">
          <el-button link @click="closeDetail">← 返回列表</el-button>
          <div v-loading="detailLoading" class="detail-body">
            <template v-if="!detailLoading">
              <div class="detail-head">
                <h2 class="detail-title">
                  {{ detail.title }}
                  <el-tag v-if="detail.viewCount >= 50" type="danger" size="small">热门</el-tag>
                </h2>
                <div class="detail-meta">
                  <span class="author">{{ detail.authorName }}</span>
                  <el-tag v-if="detail.tag" size="small" type="info">{{ detail.tag }}</el-tag>
                  <span>{{ fmt(detail.createdAt) }}</span>
                  <span>{{ detail.replyCount }} 回复</span>
                  <span>{{ detail.viewCount }} 浏览</span>
                </div>
              </div>
              <div class="detail-content">{{ detail.content }}</div>

              <h3 class="reply-title">全部回复（{{ replies.length }}）</h3>
              <el-empty v-if="replies.length === 0" description="暂无回复，快来抢沙发～" :image-size="60" />
              <div v-for="r in replies" :key="r.id" class="reply-item">
                <div class="reply-meta">
                  <span class="author">{{ r.authorName }}</span>
                  <span v-if="r.parentAuthorName" class="reply-to">回复 @{{ r.parentAuthorName }}</span>
                  <span>{{ fmt(r.createdAt) }}</span>
                </div>
                <p class="reply-content">{{ r.content }}</p>
                <el-button link size="small" @click="replyingTo = r">回复</el-button>
              </div>

              <div class="reply-input">
                <div v-if="replyingTo" class="reply-hint">
                  <span>回复 @{{ replyingTo.authorName }} 的评论</span>
                  <el-button link size="small" @click="replyingTo = null">取消</el-button>
                </div>
                <div class="reply-box">
                  <el-input v-model="replyText" type="textarea" :rows="2" placeholder="写下你的回复..." />
                  <el-button type="primary" :disabled="!replyText.trim() || replySubmitting" @click="submitReply">回复</el-button>
                </div>
              </div>
            </template>
          </div>
        </el-card>

        <el-card v-else shadow="never">
          <el-tabs v-model="sort" @tab-change="onSort">
            <el-tab-pane label="热门话题" name="hot" />
            <el-tab-pane label="最新发布" name="latest" />
            <el-tab-pane label="我的提问" name="mine" />
          </el-tabs>

          <div v-loading="loading">
            <el-empty
              v-if="!loading && topics.length === 0"
              :description="sort === 'mine' ? '你还没有发起过提问' : '暂无话题，来发第一帖吧'"
            >
              <el-button type="primary" size="small" @click="postOpen = true">
                {{ sort === 'mine' ? '去提问' : '发起提问' }}
              </el-button>
            </el-empty>
            <div v-for="t in topics" :key="t.id" class="topic-item" @click="openDetail(t)">
              <div class="topic-main">
                <h3 class="topic-title">
                  {{ t.title }}
                  <el-tag v-if="t.viewCount >= 50" type="danger" size="small">热门</el-tag>
                </h3>
                <div class="topic-meta">
                  <span class="author">{{ t.authorName }}</span>
                  <el-tag v-if="t.tag" size="small" type="info">{{ t.tag }}</el-tag>
                </div>
                <div class="topic-stats">
                  <span>{{ t.replyCount }} 回复</span>
                  <span>{{ t.viewCount }} 浏览</span>
                  <span>{{ fmt(t.createdAt) }}</span>
                </div>
              </div>
            </div>
          </div>
        </el-card>
      </div>

      <!-- 右侧：学习小组 / 导师 / 规范 -->
      <div class="side-col">
        <el-card shadow="never">
          <template #header><span class="side-title">学习小组</span></template>
          <div v-for="g in studyGroups" :key="g.id" class="side-row">
            <div>
              <div class="side-name">{{ g.name }}</div>
              <div class="side-sub">{{ g.members }} 人</div>
            </div>
            <el-button size="small" :type="g.active ? 'primary' : 'default'">{{ g.active ? '加入' : '已满' }}</el-button>
          </div>
        </el-card>
        <el-card shadow="never">
          <template #header><span class="side-title">我的导师</span></template>
          <div v-for="m in mentors" :key="m.id" class="side-row">
            <div>
              <div class="side-name">{{ m.name }}</div>
              <div class="side-sub">{{ m.role }}</div>
            </div>
            <el-button size="small">咨询</el-button>
          </div>
        </el-card>
        <el-card shadow="never">
          <template #header><span class="side-title">社区规范</span></template>
          <ul class="rules">
            <li>请友善交流，尊重他人观点</li>
            <li>提问前建议先搜索已有话题</li>
            <li>鼓励分享学习笔记与实践经验</li>
            <li>禁止发布与教学无关的内容</li>
          </ul>
        </el-card>
      </div>
    </div>

    <!-- 发帖弹窗 -->
    <el-dialog v-model="postOpen" title="发起提问" width="520px">
      <el-form label-width="80px">
        <el-form-item label="标题"><el-input v-model="postTitle" maxlength="128" placeholder="一句话说清你的问题" /></el-form-item>
        <el-form-item label="标签"><el-input v-model="postTag" maxlength="32" placeholder="如：网络技术（选填）" /></el-form-item>
        <el-form-item label="内容"><el-input v-model="postContent" type="textarea" :rows="5" placeholder="补充详细描述，便于同学们解答" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="postOpen = false">取消</el-button>
        <el-button type="primary" :loading="postSubmitting" @click="submitPost">发布</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { portalCommunityApi } from '@/api/portal';
import type { CommunityTopic, CommunityReply, CommunityTopicSort } from '@/types/portal';

const studyGroups = [
  { id: 'g1', name: '网络技术学习小组', members: 28, active: true },
  { id: 'g2', name: 'Linux运维互助群', members: 16, active: true },
  { id: 'g3', name: '岗位面试经验分享', members: 45, active: false },
  { id: 'g4', name: '技能大赛备赛组', members: 12, active: true }
];
const mentors = [
  { id: 'm1', name: '王教授', role: '网络基础课程教师' },
  { id: 'm2', name: '李老师', role: '企业导师 · 华为' },
  { id: 'm3', name: '张老师', role: 'Linux系统管理教师' }
];

const sort = ref<CommunityTopicSort>('latest');
const topics = ref<CommunityTopic[]>([]);
const hotTotal = ref(0);
const mineTotal = ref(0);
const loading = ref(true);

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

function fmt(d?: string) {
  return d ? new Date(d).toLocaleString() : '-';
}

async function loadTopics() {
  loading.value = true;
  try {
    const [res, mineRes, hotRes] = await Promise.all([
      portalCommunityApi.listTopics({ sort: sort.value, limit: 50 }),
      portalCommunityApi.listTopics({ sort: 'mine', limit: 1 }),
      portalCommunityApi.listTopics({ sort: 'hot', limit: 1 })
    ]);
    topics.value = res.items;
    mineTotal.value = mineRes.total;
    hotTotal.value = hotRes.total;
  } catch (e) {
    ElMessage.error((e as Error).message || '加载话题失败');
    topics.value = [];
  } finally {
    loading.value = false;
  }
}

function onSort() {
  loadTopics();
}

async function openDetail(topic: CommunityTopic) {
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
    detail.value = topicDetail;
    replies.value = replyRes.items;
  } catch (e) {
    ElMessage.error((e as Error).message || '加载话题详情失败');
    detail.value = null;
  } finally {
    detailLoading.value = false;
  }
}

async function closeDetail() {
  detail.value = null;
  replyingTo.value = null;
  replyText.value = '';
  loadTopics();
}

async function submitPost() {
  if (!postTitle.value.trim()) { ElMessage.warning('请填写标题'); return; }
  if (!postContent.value.trim()) { ElMessage.warning('请填写内容'); return; }
  postSubmitting.value = true;
  try {
    await portalCommunityApi.createTopic({
      title: postTitle.value.trim(),
      content: postContent.value.trim(),
      tag: postTag.value.trim() || undefined
    });
    ElMessage.success('发布成功');
    postOpen.value = false;
    postTitle.value = '';
    postTag.value = '';
    postContent.value = '';
    await loadTopics();
  } catch (e) {
    ElMessage.error((e as Error).message || '发布失败');
  } finally {
    postSubmitting.value = false;
  }
}

async function submitReply() {
  const content = replyText.value.trim();
  if (!detail.value || !content) return;
  replySubmitting.value = true;
  try {
    await portalCommunityApi.createReply(detail.value.id, { content, parentId: replyingTo.value?.id });
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

onMounted(loadTopics);
</script>

<style scoped>
.community-page { padding: 16px; }
.stats-row { margin-bottom: 16px; }
.stat { background: #fff; border-radius: 8px; padding: 16px; text-align: center; }
.stat-value { font-size: 24px; font-weight: 700; }
.stat-value.rose { color: #f56c6c; }
.stat-value.blue { color: #409eff; }
.stat-value.green { color: #67c23a; }
.stat-value.amber { color: #e6a23c; }
.stat-label { color: #909399; font-size: 13px; margin-top: 4px; }
.header-row { display: flex; justify-content: flex-end; margin-bottom: 16px; }
.layout { display: flex; gap: 16px; align-items: flex-start; }
.main-col { flex: 1; min-width: 0; }
.side-col { width: 300px; flex-shrink: 0; display: flex; flex-direction: column; gap: 16px; }
.side-title { font-weight: 600; }
.side-row { display: flex; align-items: center; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f0f2f5; }
.side-row:last-child { border-bottom: none; }
.side-name { font-weight: 500; }
.side-sub { color: #909399; font-size: 12px; }
.rules { margin: 0; padding-left: 16px; color: #606266; font-size: 13px; }
.rules li { margin-bottom: 6px; }
.topic-item { padding: 12px; border-bottom: 1px solid #f0f2f5; cursor: pointer; }
.topic-item:hover { background: #f5f7fa; }
.topic-title { font-size: 14px; font-weight: 600; margin: 0 0 6px; }
.topic-meta, .topic-stats { display: flex; gap: 8px; align-items: center; color: #909399; font-size: 12px; }
.topic-stats { margin-top: 4px; }
.author { color: #606266; font-weight: 500; }
.detail-body { margin-top: 12px; }
.detail-title { font-size: 16px; font-weight: 600; margin: 0 0 8px; }
.detail-meta { display: flex; gap: 8px; align-items: center; color: #909399; font-size: 12px; flex-wrap: wrap; }
.detail-content { white-space: pre-wrap; background: #f5f7fa; border-radius: 8px; padding: 16px; margin: 16px 0; color: #303133; line-height: 1.8; }
.reply-title { font-size: 14px; font-weight: 600; margin: 16px 0 8px; }
.reply-item { padding: 10px 0; border-bottom: 1px solid #f0f2f5; }
.reply-meta { display: flex; gap: 8px; align-items: center; color: #909399; font-size: 12px; }
.reply-to { color: #c0c4cc; }
.reply-content { margin: 6px 0; color: #303133; white-space: pre-wrap; }
.reply-input { margin-top: 16px; background: #f5f7fa; border-radius: 8px; padding: 12px; }
.reply-hint { display: flex; justify-content: space-between; align-items: center; color: #909399; font-size: 12px; margin-bottom: 8px; }
.reply-box { display: flex; gap: 8px; align-items: flex-end; }
</style>
