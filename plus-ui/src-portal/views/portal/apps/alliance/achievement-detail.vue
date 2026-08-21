<template>
  <div class="detail-page">
    <el-card v-loading="loading" shadow="never">
      <template #header>
        <div class="card-header">
          <div class="card-header-left">
            <el-button link @click="router.push('/portal/apps/alliance/achievements')">
              <el-icon><ArrowLeft /></el-icon>
              返回列表
            </el-button>
            <div class="head-title">
              <span class="card-title">{{ achievement?.title || '' }}</span>
              <span class="head-sub">{{ typeLabel(achievement?.type) }}成果</span>
              <el-tag v-if="achievement" size="small" type="info">{{ statusLabel(achievement.status) }}</el-tag>
            </div>
          </div>
          <el-button v-if="achievement" type="primary" @click="router.push(`/portal/apps/alliance/achievements/${id}/edit`)">编辑</el-button>
        </div>
      </template>

      <el-empty v-if="!achievement && !loading" description="成果不存在" />

      <template v-else-if="achievement">
        <el-tabs v-model="activeTab">
          <el-tab-pane name="info">
            <template #label>基本信息</template>
            <div class="info-grid">
              <div class="info-card">
                <div class="info-card-title">基础信息</div>
                <div class="info-row"><span class="info-label">成果类型：</span>{{ typeLabel(achievement.type) }}</div>
                <div class="info-row"><span class="info-label">成果日期：</span>{{ achievement.achievementDate || '-' }}</div>
                <div class="info-row"><span class="info-label">状态：</span>{{ statusLabel(achievement.status) }}</div>
                <div class="info-row"><span class="info-label">前台展示：</span>{{ achievement.isPublic ? '是' : '否' }}</div>
                <div class="info-row"><span class="info-label">创建人：</span>{{ achievement.createdBy || '-' }}</div>
              </div>
              <div class="info-card">
                <div class="info-card-title">引用来源</div>
                <div class="info-row"><span class="info-label">引用理由：</span>{{ achievement.citationReason || '-' }}</div>
                <div v-if="achievement.ownerPersons && achievement.ownerPersons.length > 0" class="info-row">
                  <span class="info-label">成果归属人：</span>
                  <el-tag v-for="p in achievement.ownerPersons" :key="String(p)" size="small" class="info-tag">{{ personName(p) }}</el-tag>
                </div>
                <div v-if="achievement.coBuilders && achievement.coBuilders.length > 0" class="info-row">
                  <span class="info-label">成果共建人：</span>
                  <el-tag v-for="p in achievement.coBuilders" :key="String(p)" size="small" class="info-tag">{{ personName(p) }}</el-tag>
                </div>
              </div>
              <div v-if="achievement.coverImage" class="info-card">
                <div class="info-card-title">成果封面</div>
                <el-image :src="achievement.coverImage" fit="cover" class="cover-img" />
              </div>
              <div v-if="achievement.description" class="info-card info-card-full">
                <div class="info-card-title">成果简介</div>
                <p class="info-desc">{{ achievement.description }}</p>
              </div>
            </div>
          </el-tab-pane>

          <el-tab-pane name="attachments">
            <template #label>成果佐证材料 ({{ (achievement.attachments || []).length }})</template>
            <el-empty v-if="(achievement.attachments || []).length === 0" description="暂无佐证材料" />
            <div v-else class="attach-grid">
              <a v-for="(f, i) in achievement.attachments" :key="i" :href="attachSrc(f)" target="_blank" rel="noreferrer">
                <el-image :src="attachSrc(f)" fit="cover" class="attach-img" />
              </a>
            </div>
          </el-tab-pane>

          <el-tab-pane name="positions">
            <template #label>关联职业岗位 ({{ relatedItems('relatedPositions').length }})</template>
            <div class="related-panel">
              <div class="related-toolbar">
                <el-button size="small" @click="openPicker('positions')">
                  <el-icon><Plus /></el-icon>
                  添加岗位
                </el-button>
              </div>
              <el-empty v-if="relatedItems('relatedPositions').length === 0" description="暂无关联岗位" />
              <div v-else class="related-grid">
                <div v-for="ref in relatedItems('relatedPositions')" :key="ref.id" class="related-card">
                  <div class="related-name">{{ ref.name }}</div>
                  <div v-if="ref.code" class="related-code">{{ ref.code }}</div>
                  <el-button link type="danger" size="small" @click="removeRelated('relatedPositions', ref.id)">取消关联</el-button>
                </div>
              </div>
            </div>
          </el-tab-pane>

          <el-tab-pane name="scenes">
            <template #label>关联实践场景 ({{ relatedItems('relatedScenes').length }})</template>
            <div class="related-panel">
              <div class="related-toolbar">
                <el-button size="small" @click="openPicker('scenes')">
                  <el-icon><Plus /></el-icon>
                  添加场景
                </el-button>
              </div>
              <el-empty v-if="relatedItems('relatedScenes').length === 0" description="暂无关联场景" />
              <div v-else class="related-grid">
                <div v-for="ref in relatedItems('relatedScenes')" :key="ref.id" class="related-card">
                  <div class="related-name">{{ ref.name }}</div>
                  <div v-if="ref.code" class="related-code">{{ ref.code }}</div>
                  <el-button link type="danger" size="small" @click="removeRelated('relatedScenes', ref.id)">取消关联</el-button>
                </div>
              </div>
            </div>
          </el-tab-pane>

          <el-tab-pane name="courses">
            <template #label>关联数字课程 ({{ relatedItems('relatedCourses').length }})</template>
            <div class="related-panel">
              <div class="related-toolbar">
                <el-button size="small" @click="openPicker('courses')">
                  <el-icon><Plus /></el-icon>
                  添加课程
                </el-button>
              </div>
              <el-empty v-if="relatedItems('relatedCourses').length === 0" description="暂无关联课程" />
              <div v-else class="related-grid">
                <div v-for="ref in relatedItems('relatedCourses')" :key="ref.id" class="related-card">
                  <div class="related-name">{{ ref.name }}</div>
                  <div v-if="ref.code" class="related-code">{{ ref.code }}</div>
                  <el-button link type="danger" size="small" @click="removeRelated('relatedCourses', ref.id)">取消关联</el-button>
                </div>
              </div>
            </div>
          </el-tab-pane>
        </el-tabs>
      </template>
    </el-card>

    <!-- 添加关联岗位/场景/课程弹窗 -->
    <el-dialog v-model="pickOpen" :title="`添加关联${pickLabel}`" width="560px">
      <el-input v-model="keyword" :placeholder="`搜索${pickLabel}名称或编码`" clearable @input="onKeywordChange" />
      <div class="pick-list">
        <div v-if="searching" class="pick-state">搜索中...</div>
        <el-empty v-else-if="results.length === 0" :description="`暂无可选${pickLabel}`" />
        <div
          v-for="opt in results"
          :key="opt.id"
          class="pick-item"
          :class="{ 'is-active': selectedId === opt.id }"
          @click="selectedId = selectedId === opt.id ? '' : opt.id"
        >
          <span class="pick-name">{{ opt.name }}</span>
          <span v-if="opt.code" class="pick-code">{{ opt.code }}</span>
        </div>
      </div>
      <template #footer>
        <el-button @click="pickOpen = false">取消</el-button>
        <el-button type="primary" :loading="saving" :disabled="!selectedId" @click="addItem">添加</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { ArrowLeft, Plus } from '@element-plus/icons-vue';
import { useAuthStore } from '@/stores/auth';
import {
  achievementApi,
  searchRelated,
  allianceLabel,
  normalizeRelatedRefs,
  type AllianceAchievement,
  type AllianceRelatedRef,
  type RelatedKind,
} from './crud-shared';

type RelatedKey = 'relatedPositions' | 'relatedScenes' | 'relatedCourses';

const KIND_LABEL: Record<RelatedKind, string> = {
  positions: '岗位',
  scenes: '场景',
  courses: '课程',
};

const KIND_TO_KEY: Record<RelatedKind, RelatedKey> = {
  positions: 'relatedPositions',
  scenes: 'relatedScenes',
  courses: 'relatedCourses',
};

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const id = route.params.id as string;

const achievement = ref<AllianceAchievement | null>(null);
const loading = ref(true);
const saving = ref(false);
const activeTab = ref('info');

const pickOpen = ref(false);
const pickKind = ref<RelatedKind>('positions');
const keyword = ref('');
const searching = ref(false);
const results = ref<AllianceRelatedRef[]>([]);
const selectedId = ref('');
let searchTimer: ReturnType<typeof setTimeout> | undefined;
let searchSeq = 0;

const pickLabel = computed(() => KIND_LABEL[pickKind.value]);

function typeLabel(v?: string): string {
  return allianceLabel('achievementType', v);
}
function statusLabel(v?: string): string {
  return allianceLabel('achievementStatus', v);
}

function personName(p: unknown): string {
  if (typeof p === 'string') return p;
  if (p && typeof p === 'object' && 'name' in (p as Record<string, unknown>)) {
    return String((p as { name: unknown }).name);
  }
  return String(p);
}

function attachSrc(f: unknown): string {
  if (typeof f === 'string') return f;
  if (f && typeof f === 'object') {
    const o = f as { url?: unknown; name?: unknown };
    return String(o.url ?? o.name ?? '');
  }
  return '';
}

function relatedItems(key: RelatedKey): AllianceRelatedRef[] {
  return normalizeRelatedRefs((achievement.value as any)?.[key]);
}

async function load() {
  if (!id) return;
  loading.value = true;
  try {
    achievement.value = await achievementApi.get(id);
  } catch (e) {
    ElMessage.error((e as Error).message || '加载失败');
  } finally {
    loading.value = false;
  }
}

async function saveRelated(key: RelatedKey, items: AllianceRelatedRef[]) {
  if (!achievement.value) return;
  saving.value = true;
  try {
    const updated = { ...achievement.value, [key]: items } as AllianceAchievement;
    await achievementApi.update(id, updated);
    achievement.value = updated;
    ElMessage.success('已保存');
  } catch (e) {
    ElMessage.error((e as Error).message || '保存失败');
  } finally {
    saving.value = false;
  }
}

async function runSearch(kind: RelatedKind, kw: string) {
  const seq = ++searchSeq;
  searching.value = true;
  try {
    const items = await searchRelated(kind, kw);
    if (seq !== searchSeq) return;
    const linked = new Set(relatedItems(KIND_TO_KEY[kind]).map((x) => x.id));
    results.value = items.filter((x) => !linked.has(x.id));
    selectedId.value = '';
  } catch {
    if (seq !== searchSeq) return;
    results.value = [];
    ElMessage.error('搜索失败');
  } finally {
    if (seq === searchSeq) searching.value = false;
  }
}

function openPicker(kind: RelatedKind) {
  pickKind.value = kind;
  keyword.value = '';
  results.value = [];
  selectedId.value = '';
  pickOpen.value = true;
  runSearch(kind, '');
}

function onKeywordChange(v: string) {
  keyword.value = v;
  if (searchTimer) clearTimeout(searchTimer);
  searchTimer = setTimeout(() => runSearch(pickKind.value, v), 300);
}

async function addItem() {
  const opt = results.value.find((o) => o.id === selectedId.value);
  if (!opt) return;
  const key = KIND_TO_KEY[pickKind.value];
  await saveRelated(key, [...relatedItems(key), opt]);
  pickOpen.value = false;
}

async function removeRelated(key: RelatedKey, refId: string) {
  const items = relatedItems(key).filter((x) => x.id !== refId);
  await saveRelated(key, items);
}

onMounted(async () => {
  if (!auth.user) {
    try {
      await auth.fetchMe();
    } catch {
      // 忽略
    }
  }
  load();
});

onUnmounted(() => {
  if (searchTimer) clearTimeout(searchTimer);
});
</script>

<style scoped>
.detail-page { padding: 16px; }
.card-header { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.card-header-left { display: flex; align-items: center; gap: 12px; }
.head-title { display: flex; align-items: center; gap: 8px; }
.card-title { font-size: 18px; font-weight: 600; }
.head-sub { font-size: 13px; color: #909399; }
.info-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; }
.info-card { border: 1px solid #ebeef5; border-radius: 8px; padding: 16px; }
.info-card-full { grid-column: span 2; }
.info-card-title { font-size: 14px; font-weight: 600; margin-bottom: 12px; }
.info-row { font-size: 13px; color: #303133; margin-bottom: 8px; }
.info-label { color: #909399; }
.info-tag { margin-right: 6px; }
.info-desc { margin: 0; font-size: 13px; white-space: pre-wrap; }
.cover-img { width: 100%; max-height: 200px; border-radius: 8px; }
.attach-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
.attach-img { width: 100%; aspect-ratio: 4 / 3; border-radius: 8px; border: 1px solid #ebeef5; }
.pick-list { max-height: 45vh; overflow-y: auto; margin-top: 12px; }
.pick-state { text-align: center; padding: 24px 0; color: #909399; }
.pick-item { display: flex; align-items: center; gap: 8px; padding: 8px 12px; border: 1px solid #ebeef5; border-radius: 6px; margin-bottom: 6px; cursor: pointer; }
.pick-item.is-active { border-color: #409eff; background: #ecf5ff; }
.pick-name { font-weight: 500; }
.pick-code { font-size: 12px; color: #909399; }
.related-panel { padding: 4px 0; }
.related-toolbar { display: flex; justify-content: flex-end; margin-bottom: 12px; }
.related-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
.related-card { border: 1px solid #ebeef5; border-radius: 8px; padding: 12px; }
.related-name { font-weight: 500; font-size: 13px; }
.related-code { font-size: 12px; color: #909399; margin-top: 4px; }
</style>
