<template>
  <div class="knowledge-selector">
    <!-- 已选标签 -->
    <div v-if="selected.length > 0" class="selected-tags">
      <el-tag
        v-for="kp in selected"
        :key="kp.id"
        :type="kp.linked ? 'info' : 'primary'"
        effect="plain"
        closable
        class="kp-tag"
        @close="removeKp(kp.id)"
      >
        {{ kp.name }}
      </el-tag>
    </div>

    <el-button plain class="add-btn" @click="dialogOpen = true">
      <el-icon><Plus /></el-icon>
      添加知识点
    </el-button>

    <!-- 选择对话框 -->
    <el-dialog v-model="dialogOpen" title="添加知识点" width="1000px" top="6vh" append-to-body destroy-on-close>
      <div class="selector-body">
        <!-- 左：搜索结果 -->
        <div class="left-panel">
          <div class="search-row">
            <el-input v-model="kpSearch" placeholder="搜索知识点名称、描述或编码..." clearable class="search-input" @input="onSearchInput">
              <template #prefix><el-icon><Search /></el-icon></template>
            </el-input>
            <el-button type="primary" @click="openAddKp">＋ 新增知识点</el-button>
          </div>

          <div class="filter-row">
            <span class="filter-label">筛选</span>
            <el-radio-group v-model="filterMode" size="small">
              <el-radio-button value="all">全部</el-radio-button>
              <el-radio-button value="scene">按场景/任务</el-radio-button>
              <el-radio-button value="position">按岗位</el-radio-button>
            </el-radio-group>
            <span v-if="filterActive && !filterLoading" class="filter-count">
              筛选出 {{ filtered.length }} 条知识点
            </span>
          </div>

          <div v-if="!isSearching && filterMode === 'scene'" class="filter-selects">
            <span class="filter-label">场景</span>
            <el-select v-model="selectedSceneId" size="small" style="width: 160px" @change="onSceneChange">
              <el-option label="全部场景" value="all" />
              <el-option v-for="s in scenarios" :key="s.id" :label="s.name" :value="s.id" />
            </el-select>
            <template v-if="selectedSceneId !== 'all'">
              <span class="filter-label">任务</span>
              <el-select v-model="selectedTaskId" size="small" style="width: 160px" @change="onTaskChange">
                <el-option label="全部任务" value="all" />
                <el-option v-for="t in sceneTasks" :key="t.id" :label="t.name" :value="t.id" />
              </el-select>
            </template>
          </div>

          <div v-if="!isSearching && filterMode === 'position'" class="filter-selects">
            <span class="filter-label">岗位</span>
            <el-select v-model="selectedPositionId" size="small" style="width: 180px" @change="onPositionChange">
              <el-option label="全部岗位" value="all" />
              <el-option v-for="p in positions" :key="p.id" :label="p.name" :value="p.id" />
            </el-select>
            <span class="filter-tip">聚合该岗位下所有场景任务的知识点</span>
          </div>

          <div class="results">
            <el-empty
              v-if="!isSearching && !filterActive && filtered.length === 0"
              description="请输入关键词搜索知识点"
              :image-size="64"
            />
            <el-empty
              v-else-if="isSearching && searchLoading"
              description="搜索中..."
              :image-size="64"
            />
            <el-empty
              v-else-if="isSearching && !searchLoading && filtered.length === 0"
              :description="`未找到「${kpSearch}」相关的知识点`"
              :image-size="64"
            >
              <el-button size="small" @click="openAddKp">＋ 新增此知识点</el-button>
            </el-empty>
            <el-empty
              v-else-if="filterActive && filterLoading"
              description="筛选加载中..."
              :image-size="64"
            />
            <el-empty
              v-else-if="filterActive && !filterLoading && filtered.length === 0"
              description="该筛选条件下暂无知识点"
              :image-size="64"
            />
            <el-table v-else :data="filtered" size="small" max-height="420" class="kp-table">
              <el-table-column label="知识点名称" min-width="140">
                <template #default="{ row }">
                  <span class="kp-name">{{ row.name }}</span>
                </template>
              </el-table-column>
              <el-table-column label="知识点编码" width="120">
                <template #default="{ row }">
                  <el-tag v-if="row.code" size="small" type="info" disable-transitions>{{ row.code }}</el-tag>
                  <span v-else class="dash">-</span>
                </template>
              </el-table-column>
              <el-table-column label="知识点描述" min-width="180">
                <template #default="{ row }">
                  <span class="kp-desc" :title="row.description">{{ row.description }}</span>
                </template>
              </el-table-column>
              <el-table-column label="操作" width="190" align="right">
                <template #default="{ row }">
                  <el-button link type="primary" size="small" @click="openDetail(row.id)">详情</el-button>
                  <template v-if="isSelected(row.id)">
                    <el-button link size="small" @click="removeKp(row.id)">取消</el-button>
                  </template>
                  <template v-else>
                    <el-button link type="primary" size="small" @click="referenceKp(row)">引用</el-button>
                    <el-button link size="small" @click="openCloneKp(row)">克隆</el-button>
                  </template>
                </template>
              </el-table-column>
            </el-table>
          </div>
        </div>

        <!-- 右：已选知识点 -->
        <div class="right-panel">
          <p class="right-title">已选择知识点 ({{ selected.length }})</p>
          <div class="right-list">
            <el-empty v-if="selected.length === 0" description="从左侧搜索并选择知识点" :image-size="56" />
            <div
              v-for="kp in selected"
              :key="kp.id"
              class="selected-card"
              :class="{ reference: kp.linked }"
              @click="onCardClick(kp)"
            >
              <div class="card-head">
                <span class="card-name">{{ kp.name }}</span>
                <el-icon class="card-close" @click.stop="removeKp(kp.id)"><Close /></el-icon>
              </div>
              <p class="card-desc">{{ kp.description }}</p>
              <div v-if="kpGranularNames(kp).length > 0" class="card-gl">
                <el-tag v-for="(name, i) in kpGranularNames(kp).slice(0, 2)" :key="i" size="small" type="info" disable-transitions>{{ name }}</el-tag>
                <span v-if="kpGranularNames(kp).length > 2" class="gl-more">+{{ kpGranularNames(kp).length - 2 }}</span>
              </div>
              <span v-if="kp.linked" class="ref-corner">引用</span>
            </div>
          </div>
        </div>
      </div>
      <template #footer>
        <el-button @click="dialogOpen = false">关闭</el-button>
      </template>
    </el-dialog>

    <!-- 新增/克隆/编辑知识点 -->
    <el-dialog
      v-model="kpActionOpen"
      :title="kpActionTitle"
      width="520px"
      append-to-body
      destroy-on-close
    >
      <el-form label-width="100px">
        <el-form-item label="知识点名称" required>
          <el-input v-model="newKpForm.name" placeholder="输入知识点名称" maxlength="50" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="newKpForm.description" type="textarea" :rows="3" placeholder="输入知识点描述" />
        </el-form-item>
        <el-form-item label="编码">
          <el-input v-model="newKpForm.code" :disabled="kpActionMode !== 'edit'" placeholder="系统自动生成" />
          <p class="form-tip">{{ kpActionMode === 'edit' ? '可修改编码' : '系统自动生成，不可修改' }}</p>
        </el-form-item>
        <el-form-item label="关联颗粒课">
          <div class="gl-tags">
            <el-tag v-for="gid in newKpForm.granularLessons" :key="gid" closable class="gl-tag" @close="removeGlFromForm(gid)">
              {{ granularCourseName(gid) }}
            </el-tag>
          </div>
          <el-button size="small" plain @click="openGlSelect('new-kp')">
            <el-icon><Plus /></el-icon> 选择颗粒课
          </el-button>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="kpActionOpen = false">取消</el-button>
        <el-button type="primary" :disabled="!newKpForm.name.trim()" @click="saveKp">
          {{ kpActionMode === 'add' ? '新增并选中' : kpActionMode === 'clone' ? '克隆并选中' : '保存修改' }}
        </el-button>
      </template>
    </el-dialog>

    <!-- 颗粒课选择 -->
    <el-dialog v-model="glSelectOpen" :title="glTargetKp ? `为「${glTargetKp.name}」选择颗粒课` : '选择颗粒课'" width="820px" append-to-body>
      <div class="gl-dialog-body">
        <div class="gl-left">
          <el-input v-model="glSearch" placeholder="搜索颗粒课名称或编码..." clearable class="gl-search">
            <template #prefix><el-icon><Search /></el-icon></template>
          </el-input>
          <div class="gl-list">
            <el-empty v-if="glFiltered.length === 0" description="未找到匹配的颗粒课" :image-size="56" />
            <div
              v-for="gl in glFiltered"
              :key="gl.id"
              class="gl-item"
              :class="{ selected: glSelectedIds.includes(gl.id) }"
              @click="toggleGl(gl.id)"
            >
              <el-icon class="gl-check" :color="glSelectedIds.includes(gl.id) ? '#409eff' : '#c0c4cc'">
                <Check v-if="glSelectedIds.includes(gl.id)" />
                <CircleCheck v-else />
              </el-icon>
              <span class="gl-name">{{ gl.name }}</span>
              <el-tag v-if="gl.code" size="small" type="info" disable-transitions>{{ gl.code }}</el-tag>
              <p class="gl-desc">{{ gl.description }}</p>
            </div>
          </div>
        </div>
        <div class="gl-right">
          <p class="right-title">已选择 ({{ glSelectedIds.length }})</p>
          <div class="gl-selected-list">
            <div v-for="gid in glSelectedIds" :key="gid" class="gl-selected-item">
              <span class="gl-selected-name">{{ granularCourseName(gid) }}</span>
              <el-icon class="gl-selected-close" @click="toggleGl(gid)"><Close /></el-icon>
            </div>
          </div>
        </div>
      </div>
      <template #footer>
        <el-button type="primary" @click="glSelectOpen = false">确定</el-button>
      </template>
    </el-dialog>

    <!-- 知识点详情 -->
    <el-dialog v-model="kpDetailOpen" title="知识点详情" width="460px" append-to-body>
      <template v-if="detailKp">
        <div class="detail-head">
          <span class="detail-label">知识点名称</span>
          <el-tag v-if="detailKp.linked" size="small" type="info" disable-transitions>引用（不可编辑）</el-tag>
          <el-tag v-else size="small" type="primary" effect="plain" disable-transitions>自定义（可编辑）</el-tag>
        </div>
        <p class="detail-name">{{ detailKp.name }}</p>
        <div class="detail-row">
          <span class="detail-label">知识点描述</span>
          <p class="detail-text">{{ detailKp.description }}</p>
        </div>
        <div v-if="detailKp.code" class="detail-row">
          <span class="detail-label">编码</span>
          <p class="detail-text">{{ detailKp.code }}</p>
        </div>
        <div class="detail-row">
          <div class="detail-gl-head">
            <span class="detail-label">关联颗粒课</span>
            <el-button v-if="!detailKp.linked" link type="primary" size="small" @click="openGlSelectFromDetail">引用颗粒课</el-button>
          </div>
          <div class="detail-gl-tags">
            <el-tag v-for="gl in detailGranularLessons" :key="gl.id" size="small" type="info" disable-transitions>{{ gl.name }}</el-tag>
            <span v-if="detailGranularLessons.length === 0" class="detail-empty">暂无关联颗粒课</span>
          </div>
        </div>
      </template>
      <template #footer>
        <el-button @click="kpDetailOpen = false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { ElMessage } from 'element-plus';
import { courseApi, knowledgeApi } from '@/api/lesson';
import { positionApi } from '@/api/job';
import { scenarioApi, taskApi } from '@/api/scene';
import type { Course } from '@/types/lesson';
import { fetchAllPages, type KnowledgePointItem } from './lesson-edit-utils';

const props = defineProps<{
  selected: KnowledgePointItem[];
  pool: KnowledgePointItem[];
}>();

const emit = defineEmits<{
  (e: 'change', selected: KnowledgePointItem[]): void;
  (e: 'addCustom', name: string, description?: string): void;
}>();

function generateKpCode(): string {
  return `KP-${Date.now().toString().slice(-6)}-${Math.random().toString(36).slice(2, 7)}`;
}

/* ---------- 主对话框 ---------- */

const dialogOpen = ref(false);
const kpSearch = ref('');
const searchResults = ref<KnowledgePointItem[] | null>(null);
const searchLoading = ref(false);
let searchSeq = 0;

const filterMode = ref<'all' | 'scene' | 'position'>('all');
const positions = ref<{ id: string; name: string }[]>([]);
const scenarios = ref<{ id: string; name: string; careerPositionId?: string }[]>([]);
const sceneTasks = ref<{ id: string; name: string; knowledgePointIds?: string[] }[]>([]);
const selectedPositionId = ref('all');
const selectedSceneId = ref('all');
const selectedTaskId = ref('all');
const filterKpIds = ref<Set<string> | null>(null);
const sceneKpIdSet = ref<Set<string> | null>(null);
const filterLoading = ref(false);
const allKps = ref<KnowledgePointItem[] | null>(null);
let filterSeq = 0;

// 颗粒课（关联颗粒课选择）
const granularCourses = ref<Course[]>([]);
const glSearch = ref('');
const glSelectOpen = ref(false);
const glSelectTargetKp = ref<string | null>(null);

const kpDetailOpen = ref(false);
const selectedKpForDetail = ref<string | null>(null);

const kpActionOpen = ref(false);
const kpActionMode = ref<'add' | 'clone' | 'edit' | null>(null);
const kpActionTarget = ref<KnowledgePointItem | null>(null);
const newKpForm = ref<{ name: string; description: string; code: string; granularLessons: string[] }>({
  name: '',
  description: '',
  code: '',
  granularLessons: []
});

onMounted(() => {
  courseApi
    .list({ type: 'granular' })
    .then((res) => {
      granularCourses.value = res.items || [];
    })
    .catch(() => {
      granularCourses.value = [];
    });
  fetchAllPages(({ limit, offset }) => positionApi.list({ limit, offset }))
    .then((items) => {
      positions.value = items;
    })
    .catch(() => {
      positions.value = [];
    });
  fetchAllPages(({ limit, offset }) => scenarioApi.list({ limit, offset }))
    .then((items) => {
      scenarios.value = items;
    })
    .catch(() => {
      scenarios.value = [];
    });
});

/* ---------- 搜索（后端模糊搜索，debounce 300ms） ---------- */

const isSearching = computed(() => kpSearch.value.trim().length > 0);
const filterActive = computed(() => filterKpIds.value !== null && !isSearching.value);

let debounceTimer: ReturnType<typeof setTimeout> | undefined;

function onSearchInput() {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    void runSearch();
  }, 300);
}

async function runSearch() {
  const kw = kpSearch.value.trim();
  const seq = ++searchSeq;
  if (!kw) {
    searchResults.value = null;
    searchLoading.value = false;
    return;
  }
  searchLoading.value = true;
  try {
    const res = await knowledgeApi.list({ search: kw, limit: 200 });
    if (seq !== searchSeq) return;
    searchResults.value = (res.items || []).map((k) => ({
      id: k.id,
      name: k.name,
      code: k.code,
      description: k.description,
      linked: k.linked,
      granularLessons: k.granularLessonIds || []
    }));
  } catch {
    if (seq !== searchSeq) return;
    searchResults.value = [];
  } finally {
    if (seq === searchSeq) searchLoading.value = false;
  }
}

const filtered = computed<KnowledgePointItem[]>(() => {
  if (isSearching.value) return searchResults.value || [];
  if (filterActive.value) {
    return (allKps.value || []).filter((kp) => filterKpIds.value!.has(kp.id));
  }
  return props.pool;
});

// 筛选命中时懒加载全量知识点
watch(filterActive, (active) => {
  if (active && allKps.value === null) {
    fetchAllPages(({ limit, offset }) => knowledgeApi.list({ limit, offset }))
      .then((items) => {
        allKps.value = items.map((k) => ({
          id: k.id,
          name: k.name,
          code: k.code,
          description: k.description,
          linked: k.linked,
          granularLessons: k.granularLessonIds || []
        }));
      })
      .catch(() => {
        allKps.value = [];
      });
  }
});

/* ---------- 筛选切换 ---------- */

function onFilterModeChange(mode: 'all' | 'scene' | 'position') {
  filterMode.value = mode;
  selectedSceneId.value = 'all';
  selectedTaskId.value = 'all';
  selectedPositionId.value = 'all';
  sceneTasks.value = [];
  sceneKpIdSet.value = null;
  filterKpIds.value = null;
  filterLoading.value = false;
}

watch(filterMode, (m) => onFilterModeChange(m));

async function loadTasksForScene(sid: string): Promise<{ id: string; name: string; knowledgePointIds?: string[] }[]> {
  const res = await taskApi.list({ scenarioId: sid, limit: 200 });
  return res.items || [];
}

async function onSceneChange(sid: string) {
  selectedTaskId.value = 'all';
  if (sid === 'all') {
    sceneTasks.value = [];
    sceneKpIdSet.value = null;
    filterKpIds.value = null;
    return;
  }
  filterLoading.value = true;
  filterKpIds.value = new Set();
  const seq = ++filterSeq;
  try {
    const tasks = await loadTasksForScene(sid);
    if (seq !== filterSeq) return;
    sceneTasks.value = tasks;
    const ids = new Set<string>();
    tasks.forEach((t) => (t.knowledgePointIds || []).forEach((id) => ids.add(id)));
    sceneKpIdSet.value = ids;
    filterKpIds.value = ids;
  } catch {
    if (seq !== filterSeq) return;
    sceneTasks.value = [];
    filterKpIds.value = new Set();
  } finally {
    if (seq === filterSeq) filterLoading.value = false;
  }
}

function onTaskChange(tid: string) {
  if (tid === 'all') {
    filterKpIds.value = sceneKpIdSet.value;
  } else {
    const task = sceneTasks.value.find((t) => t.id === tid);
    filterKpIds.value = new Set(task?.knowledgePointIds || []);
  }
}

async function onPositionChange(pid: string) {
  selectedSceneId.value = 'all';
  selectedTaskId.value = 'all';
  sceneTasks.value = [];
  sceneKpIdSet.value = null;
  if (pid === 'all') {
    filterKpIds.value = null;
    return;
  }
  const posScenarios = scenarios.value.filter((s) => s.careerPositionId === pid);
  filterLoading.value = true;
  filterKpIds.value = new Set();
  const seq = ++filterSeq;
  try {
    const results = await Promise.all(posScenarios.map((s) => loadTasksForScene(s.id)));
    if (seq !== filterSeq) return;
    const ids = new Set<string>();
    results.forEach((tasks) =>
      tasks.forEach((t) => (t.knowledgePointIds || []).forEach((id) => ids.add(id)))
    );
    filterKpIds.value = ids;
  } catch {
    if (seq !== filterSeq) return;
    filterKpIds.value = new Set();
  } finally {
    if (seq === filterSeq) filterLoading.value = false;
  }
}

/* ---------- 选中/移除/详情 ---------- */

function isSelected(id: string): boolean {
  return props.selected.some((s) => s.id === id);
}

function referenceKp(kp: KnowledgePointItem) {
  if (isSelected(kp.id)) return;
  emit('change', [...props.selected, kp]);
}

function removeKp(kpId: string) {
  emit('change', props.selected.filter((s) => s.id !== kpId));
}

function onCardClick(kp: KnowledgePointItem) {
  if (kp.linked) {
    openDetail(kp.id);
  } else {
    openEditKp(kp);
  }
}

const detailKp = computed<KnowledgePointItem | null>(() => {
  const id = selectedKpForDetail.value;
  if (!id) return null;
  return (
    props.selected.find((s) => s.id === id) ||
    props.pool.find((p) => p.id === id) ||
    (searchResults.value || []).find((p) => p.id === id) ||
    null
  );
});

function openDetail(id: string) {
  selectedKpForDetail.value = id;
  kpDetailOpen.value = true;
}

/* ---------- 新增/克隆/编辑 ---------- */

const kpActionTitle = computed(() =>
  kpActionMode.value === 'add' ? '新增知识点' : kpActionMode.value === 'clone' ? '克隆知识点' : '编辑知识点'
);

function openAddKp() {
  newKpForm.value = { name: kpSearch.value, description: '', code: generateKpCode(), granularLessons: [] };
  kpActionMode.value = 'add';
  kpActionTarget.value = null;
  kpActionOpen.value = true;
}

function openCloneKp(kp: KnowledgePointItem) {
  newKpForm.value = {
    name: `${kp.name}-copy`,
    description: kp.description || '',
    code: generateKpCode(),
    granularLessons: kp.granularLessons || []
  };
  kpActionMode.value = 'clone';
  kpActionTarget.value = kp;
  kpActionOpen.value = true;
}

function openEditKp(kp: KnowledgePointItem) {
  newKpForm.value = {
    name: kp.name,
    description: kp.description || '',
    code: kp.code || generateKpCode(),
    granularLessons: kp.granularLessons || []
  };
  kpActionMode.value = 'edit';
  kpActionTarget.value = kp;
  kpActionOpen.value = true;
}

function findNameCollision(name: string, excludeId?: string): KnowledgePointItem | undefined {
  const kw = name.trim();
  return (
    props.pool.find((p) => p.id !== excludeId && p.name.trim() === kw) ||
    (searchResults.value || []).find((p) => p.id !== excludeId && p.name.trim() === kw) ||
    props.selected.find((s) => s.id !== excludeId && s.name.trim() === kw)
  );
}

function saveKp() {
  const name = newKpForm.value.name.trim();
  if (!name) return;
  const excludeId = kpActionMode.value === 'edit' ? kpActionTarget.value?.id : undefined;
  const collision = findNameCollision(name, excludeId);
  if (collision) {
    ElMessage.warning(`已存在同名知识点「${collision.name}」，请选择已有知识点或使用其他名称`);
    return;
  }
  if (kpActionMode.value === 'edit' && kpActionTarget.value) {
    const updated = props.selected.map((s) =>
      s.id === kpActionTarget.value!.id
        ? {
            ...s,
            name,
            description: newKpForm.value.description.trim(),
            code: newKpForm.value.code,
            granularLessons: newKpForm.value.granularLessons
          }
        : s
    );
    emit('change', updated);
    if (searchResults.value) {
      searchResults.value = searchResults.value.map((p) =>
        p.id === kpActionTarget.value!.id
          ? {
              ...p,
              name,
              description: newKpForm.value.description.trim(),
              code: newKpForm.value.code,
              granularLessons: newKpForm.value.granularLessons
            }
          : p
      );
    }
    allKps.value = null;
    kpActionOpen.value = false;
    return;
  }
  const newId = `kp-custom-${Date.now()}`;
  const newKp: KnowledgePointItem = {
    id: newId,
    name,
    description: newKpForm.value.description.trim(),
    code: newKpForm.value.code,
    linked: false,
    granularLessons: newKpForm.value.granularLessons
  };
  emit('addCustom', newKp.name, newKp.description);
  emit('change', [...props.selected, newKp]);
  allKps.value = null;
  kpActionOpen.value = false;
  kpSearch.value = '';
}

/* ---------- 颗粒课关联 ---------- */

function granularCourseName(gid: string): string {
  return granularCourses.value.find((g) => g.id === gid)?.name || gid;
}

const glFiltered = computed(() => {
  const kw = glSearch.value.trim();
  return granularCourses.value.filter(
    (g) => !kw || g.name.includes(kw) || (g.code && g.code.includes(kw))
  );
});

const glTargetKp = computed(() =>
  glSelectTargetKp.value === 'new-kp'
    ? null
    : props.selected.find((s) => s.id === glSelectTargetKp.value) || null
);

const glSelectedIds = computed(() =>
  glSelectTargetKp.value === 'new-kp'
    ? newKpForm.value.granularLessons
    : glTargetKp.value?.granularLessons || []
);

function openGlSelect(target: string) {
  glSelectTargetKp.value = target;
  glSearch.value = '';
  glSelectOpen.value = true;
}

function openGlSelectFromDetail() {
  if (!detailKp.value) return;
  kpDetailOpen.value = false;
  openGlSelect(detailKp.value.id);
}

function toggleGl(gid: string) {
  if (glSelectTargetKp.value === 'new-kp') {
    const current = newKpForm.value.granularLessons;
    newKpForm.value.granularLessons = current.includes(gid)
      ? current.filter((x) => x !== gid)
      : [...current, gid];
  } else if (glSelectTargetKp.value) {
    const updated = props.selected.map((s) => {
      if (s.id !== glSelectTargetKp.value) return s;
      const current = s.granularLessons || [];
      const next = current.includes(gid) ? current.filter((x) => x !== gid) : [...current, gid];
      return { ...s, granularLessons: next };
    });
    emit('change', updated);
  }
}

function removeGlFromForm(gid: string) {
  newKpForm.value.granularLessons = newKpForm.value.granularLessons.filter((x) => x !== gid);
}

function kpGranularNames(kp: KnowledgePointItem): string[] {
  return (kp.granularLessons || [])
    .map((gid) => granularCourses.value.find((g) => g.id === gid)?.name)
    .filter((n): n is string => !!n);
}

const detailGranularLessons = computed(() => {
  const kp = detailKp.value;
  if (!kp) return [];
  return (kp.granularLessons || [])
    .map((gid) => granularCourses.value.find((g) => g.id === gid))
    .filter((g): g is Course => !!g);
});
</script>

<style scoped>
.selected-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}
.kp-tag {
  font-weight: normal;
}
.add-btn {
  width: 100%;
  border-style: dashed;
}
.selector-body {
  display: flex;
  gap: 16px;
  min-height: 480px;
}
.left-panel {
  width: 60%;
  display: flex;
  flex-direction: column;
  border: 1px solid #ebeef5;
  border-radius: 12px;
  padding: 12px;
}
.search-row {
  display: flex;
  gap: 8px;
  margin-bottom: 10px;
}
.search-input {
  flex: 1;
}
.filter-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}
.filter-label {
  font-size: 12px;
  color: #909399;
  flex-shrink: 0;
}
.filter-count {
  font-size: 10px;
  color: #c0c4cc;
}
.filter-selects {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}
.filter-tip {
  font-size: 10px;
  color: #c0c4cc;
}
.results {
  flex: 1;
  overflow: hidden;
}
.kp-table {
  width: 100%;
}
.kp-name {
  font-size: 13px;
  font-weight: 500;
  color: #303133;
}
.kp-desc {
  font-size: 12px;
  color: #909399;
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dash {
  color: #c0c4cc;
}
.right-panel {
  width: 40%;
  border: 1px solid #ebeef5;
  border-radius: 12px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  min-height: 0;
}
.right-title {
  font-size: 14px;
  font-weight: 500;
  color: #606266;
  margin: 0 0 12px;
}
.right-list {
  flex: 1;
  overflow-y: auto;
}
.selected-card {
  position: relative;
  padding: 8px 10px;
  border-radius: 8px;
  border: 1px solid #d9ecff;
  background: #ecf5ff;
  margin-bottom: 8px;
  cursor: pointer;
  overflow: hidden;
  transition: background 0.15s;
}
.selected-card:hover {
  background: #d9ecff;
}
.selected-card.reference {
  border-color: #e4e7ed;
  background: #f5f7fa;
}
.card-head {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 4px;
}
.card-name {
  font-size: 13px;
  font-weight: 500;
  color: #303133;
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.card-close {
  color: #c0c4cc;
  cursor: pointer;
  flex-shrink: 0;
}
.card-close:hover {
  color: #f56c6c;
}
.card-desc {
  font-size: 11px;
  color: #909399;
  margin: 0 0 6px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.card-gl {
  display: flex;
  gap: 4px;
  align-items: center;
  flex-wrap: wrap;
}
.gl-more {
  font-size: 9px;
  color: #c0c4cc;
}
.ref-corner {
  position: absolute;
  bottom: 0;
  right: 0;
  background: #e4e7ed;
  color: #909399;
  font-size: 9px;
  padding: 2px 6px;
  border-radius: 6px 0 0 0;
}
.form-tip {
  font-size: 12px;
  color: #c0c4cc;
  margin: 4px 0 0;
}
.gl-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 8px;
}
.gl-tag {
  font-weight: normal;
}
.gl-dialog-body {
  display: flex;
  gap: 16px;
  height: 60vh;
}
.gl-left {
  width: 60%;
  display: flex;
  flex-direction: column;
  border: 1px solid #ebeef5;
  border-radius: 12px;
  padding: 12px;
}
.gl-search {
  margin-bottom: 10px;
}
.gl-list {
  flex: 1;
  overflow-y: auto;
}
.gl-item {
  position: relative;
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid #e4e7ed;
  margin-bottom: 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  transition: all 0.15s;
}
.gl-item:hover {
  border-color: #a0cfff;
}
.gl-item.selected {
  border-color: #409eff;
  background: #ecf5ff;
}
.gl-check {
  flex-shrink: 0;
}
.gl-name {
  font-size: 14px;
  font-weight: 500;
  color: #303133;
}
.gl-desc {
  width: 100%;
  font-size: 12px;
  color: #909399;
  margin: 4px 0 0 24px;
}
.gl-right {
  width: 40%;
  border: 1px solid #ebeef5;
  border-radius: 12px;
  padding: 12px;
  display: flex;
  flex-direction: column;
}
.gl-selected-list {
  flex: 1;
  overflow-y: auto;
}
.gl-selected-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border: 1px solid #ebeef5;
  border-radius: 8px;
  background: #f5f7fa;
  margin-bottom: 8px;
}
.gl-selected-name {
  flex: 1;
  font-size: 13px;
  color: #303133;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.gl-selected-close {
  color: #c0c4cc;
  cursor: pointer;
  flex-shrink: 0;
}
.gl-selected-close:hover {
  color: #f56c6c;
}
.detail-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}
.detail-label {
  font-size: 12px;
  color: #909399;
}
.detail-name {
  font-size: 15px;
  font-weight: 500;
  color: #303133;
  margin: 0 0 16px;
}
.detail-row {
  margin-bottom: 14px;
}
.detail-text {
  font-size: 13px;
  color: #606266;
  margin: 6px 0 0;
}
.detail-gl-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.detail-gl-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
}
.detail-empty {
  font-size: 13px;
  color: #c0c4cc;
}
</style>
