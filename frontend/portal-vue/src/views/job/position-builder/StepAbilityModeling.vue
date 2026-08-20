<template>
  <!-- 步骤二：能力建模（逐项对齐 React components/job/position-builder/step-ability-modeling.tsx） -->
  <div class="ability-wrap">
    <div class="ability-layout">
      <!-- 左侧：工作职责 -->
      <div class="resp-pane">
        <div class="pane-head">
          <div>
            <h3 class="pane-title">工作职责</h3>
            <p class="pane-sub">{{ position.responsibilities.length }} 项职责，{{ totalBindings }} 个能力点</p>
          </div>
          <el-button type="primary" size="small" round @click="openAddRespDialog">
            <el-icon><Plus /></el-icon>
            添加
          </el-button>
        </div>
        <div class="resp-list">
          <el-empty
            v-if="position.responsibilities.length === 0"
            description="暂无工作职责"
            :image-size="56"
          />
          <template v-else>
            <div v-for="resp in position.responsibilities" :key="resp.id" class="resp-row-wrap">
              <div v-if="editingRespId === resp.id" class="resp-edit">
                <el-input
                  v-model="editRespName"
                  :data-resp-edit="resp.id"
                  size="small"
                  placeholder="输入职责名称..."
                  @keydown.enter.prevent="saveEditResp"
                  @keydown.esc.prevent="cancelEditResp"
                  @blur="onRespEditBlur"
                />
                <el-button text size="small" @click="saveEditResp">
                  <el-icon><Check /></el-icon>
                </el-button>
              </div>
              <div
                v-else
                class="resp-row"
                :class="{ active: resp.id === selectedRespId }"
                @click="scrollToResp(resp.id)"
              >
                <span class="dot" :style="{ background: getRespColor(resp.id) }" />
                <span class="resp-name" :class="{ unnamed: !resp.name }">{{ resp.name || '未命名' }}</span>
                <span class="count-badge" :class="{ zero: bindingCount(resp.id) === 0 }">{{ bindingCount(resp.id) }}</span>
                <el-tag v-if="bindingCount(resp.id) === 0" size="small" type="warning" effect="plain">未配置</el-tag>
                <span class="hover-actions">
                  <el-button text size="small" @click.stop="() => startEditResp(resp)">
                    <el-icon><EditPen /></el-icon>
                  </el-button>
                  <el-button text size="small" class="danger-btn" @click.stop="removeResponsibility(resp.id)">
                    <el-icon><Delete /></el-icon>
                  </el-button>
                </span>
              </div>
            </div>
          </template>
        </div>
      </div>

      <!-- 右侧：能力点列表（按职责分组） -->
      <div class="binding-pane">
        <div class="pane-head">
          <div class="pane-head-inline">
            <h3 class="pane-title">能力点列表</h3>
            <span class="pane-sub">共 {{ totalBindings }} 个能力点</span>
          </div>
        </div>

        <div ref="contentRef" class="binding-scroll">
          <el-empty
            v-if="position.responsibilities.length === 0"
            description="暂无工作职责和能力点，请先在左侧添加工作职责"
            :image-size="80"
          />
          <div v-else class="group-list">
            <div
              v-for="resp in position.responsibilities"
              :key="resp.id"
              :ref="(el) => setSectionRef(resp.id, el as HTMLElement | null)"
              class="group"
              :class="{ selected: resp.id === selectedRespId }"
            >
              <div class="group-head">
                <span class="dot" :style="{ background: getRespColor(resp.id) }" />
                <h4 class="group-title">{{ resp.name || '未命名职责' }}</h4>
                <span v-if="bindingCount(resp.id) > 0" class="count-badge">{{ bindingCount(resp.id) }}</span>
                <div class="flex-1" />
                <span class="group-actions">
                  <el-button type="primary" size="small" round @click="openAbilityPool(resp.id)">
                    <el-icon><Files /></el-icon>
                    从能力点库添加
                  </el-button>
                  <el-button size="small" round @click="openCreateAbility(resp.id)">
                    <el-icon><Plus /></el-icon>
                    新建能力点
                  </el-button>
                </span>
              </div>

              <el-empty
                v-if="bindingsOf(resp.id).length === 0"
                description="暂无能力点，点击上方按钮添加"
                :image-size="56"
                class="group-empty"
              />
              <div v-else class="binding-grid">
                <div v-for="binding in bindingsOf(resp.id)" :key="binding.id" class="binding-card">
                  <div class="binding-head">
                    <span class="dot" :style="{ background: getRespColor(binding.responsibilityId) }" />
                    <span class="binding-name">{{ binding.name }}</span>
                    <div class="flex-1" />
                    <el-button
                      text
                      size="small"
                      class="danger-btn hover-actions"
                      title="移除"
                      @click="removeBinding(binding.id)"
                    >
                      <el-icon><Delete /></el-icon>
                    </el-button>
                  </div>

                  <!-- 掌握程度五档滑轨（对齐 React 圆点 + 文案） -->
                  <div class="level-track">
                    <div class="track-bg" />
                    <div class="track-fill" :style="{ width: fillWidth(binding.level) }" />
                    <div class="track-dots">
                      <button
                        v-for="(level, idx) in COMPETENCY_LEVELS"
                        :key="level.value"
                        type="button"
                        class="track-dot"
                        :class="{
                          current: idx === levelIndex(binding.level),
                          reached: idx < levelIndex(binding.level)
                        }"
                        :title="level.description"
                        @click="updateBinding(binding.id, { level: level.value })"
                      />
                    </div>
                    <div class="track-labels">
                      <span
                        v-for="(level, idx) in COMPETENCY_LEVELS"
                        :key="level.value"
                        class="track-label"
                        :class="{
                          current: idx === levelIndex(binding.level),
                          reached: idx < levelIndex(binding.level)
                        }"
                      >
                        {{ level.label }}
                      </span>
                    </div>
                  </div>

                  <el-input
                    :model-value="binding.rubricDescription"
                    type="textarea"
                    :rows="2"
                    resize="none"
                    placeholder="胜任标准描述..."
                    class="rubric-input"
                    @update:model-value="(v: string) => updateBinding(binding.id, { rubricDescription: v })"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 批量添加工作职责 -->
    <el-dialog v-model="addRespDialog" title="添加工作职责" width="520px" @close="newRespNames = ['']">
      <p class="dialog-desc">输入职责名称，回车可继续添加，保存后批量插入</p>
      <div class="resp-input-list">
        <div v-for="(_, index) in newRespNames" :key="index" class="resp-input-row">
          <el-input
            v-model="newRespNames[index]"
            type="textarea"
            :rows="1"
            :autosize="{ minRows: 1, maxRows: 3 }"
            :data-new-resp="index"
            :placeholder="`工作职责 ${index + 1}`"
            @keydown.enter.exact="onEnterAddRespRow($event as KeyboardEvent)"
          />
          <el-button text :disabled="newRespNames.length === 1" class="danger-btn" @click="removeRespRow(index)">
            <el-icon><Close /></el-icon>
          </el-button>
        </div>
      </div>
      <template #footer>
        <el-button @click="addRespDialog = false">取消</el-button>
        <el-button
          type="primary"
          :disabled="!newRespNames.some((n) => n.trim())"
          @click="confirmAddResponsibilities"
        >
          保存
        </el-button>
      </template>
    </el-dialog>

    <!-- 新建能力点 -->
    <el-dialog v-model="createDialog" title="新建能力点" width="520px" @close="resetCreateDialog">
      <p class="dialog-desc">
        {{ selectedResp ? `为「${selectedResp.name || '未命名职责'}」新建岗位能力点` : '请先选择一项工作职责' }}
      </p>
      <template v-if="duplicateName">
        <el-alert type="warning" :closable="false" show-icon title="能力点已存在">
          公共能力点库中已存在「{{ duplicateName }}」，建议直接从库中引用，无需重复创建。
        </el-alert>
      </template>
      <template v-else>
        <el-form label-position="top">
          <el-form-item label="能力点名称" required>
            <el-input v-model="newAbilityName" placeholder="例如：微服务架构设计" />
          </el-form-item>
          <el-form-item label="能力属性">
            <div class="attr-row">
              <el-check-tag
                v-for="attr in ABILITY_ATTRIBUTES"
                :key="attr"
                :checked="newAbilityAttributes.includes(attr)"
                @change="toggleNewAbilityAttr(attr)"
              >
                {{ attr }}
              </el-check-tag>
            </div>
          </el-form-item>
        </el-form>
      </template>
      <template #footer>
        <template v-if="duplicateName">
          <el-button @click="cancelDuplicate">取消</el-button>
          <el-button type="primary" @click="addExistingFromPool">从库中引用</el-button>
          <el-button text @click="duplicateName = null">仍要新建</el-button>
        </template>
        <template v-else>
          <el-button @click="createDialog = false">取消</el-button>
          <el-button type="primary" :disabled="!newAbilityName.trim() || !selectedRespId" @click="createCustomAbility">
            创建并关联
          </el-button>
        </template>
      </template>
    </el-dialog>

    <!-- 能力点库 -->
    <el-dialog
      v-model="poolDialog"
      title="从能力点库添加"
      width="980px"
      top="6vh"
      @opened="focusPoolSearch"
      @close="resetPoolFilters"
    >
      <p class="dialog-desc">搜索能力点，添加到当前岗位的工作职责中</p>
      <div class="pool-filters">
        <el-input
          ref="poolSearchRef"
          v-model="poolSearch"
          placeholder="输入名称搜索能力点..."
          clearable
          :prefix-icon="Search"
          style="width: 280px"
        />
        <div class="filter-line">
          <span class="filter-label">能力属性</span>
          <el-check-tag
            v-for="attr in ABILITY_ATTRIBUTES"
            :key="attr"
            :checked="poolFilterAttr === attr"
            @change="poolFilterAttr = poolFilterAttr === attr ? null : attr"
          >
            {{ attr }}
          </el-check-tag>
          <el-button v-if="poolFilterAttr" text size="small" @click="poolFilterAttr = null">清空</el-button>
        </div>
        <div class="filter-line">
          <span class="filter-label">关联岗位</span>
          <el-select
            v-model="poolFilterPosition"
            filterable
            clearable
            placeholder="选择岗位"
            size="small"
            style="width: 220px"
          >
            <el-option v-for="p in poolPositions" :key="p.id" :label="p.name" :value="p.id" />
          </el-select>
          <el-button v-if="poolFilterPosition" text size="small" @click="poolFilterPosition = null">清空</el-button>
        </div>
      </div>

      <div class="pool-body">
        <div v-if="poolResults.length === 0" class="pool-empty">
          <el-empty description="暂无匹配的能力点" :image-size="72" />
          <el-button v-if="poolSearch.trim()" text type="primary" @click="createFromSearch">
            + 库中不存在，点击新建「{{ poolSearch.trim() }}」
          </el-button>
        </div>
        <el-table v-else :data="poolResults" height="420">
          <el-table-column label="能力点名称" min-width="220">
            <template #default="{ row }">
              <el-input
                v-if="editingAbilityId === row.id"
                v-model="editAbilityName"
                size="small"
                placeholder="能力点名称"
                @keydown.enter.prevent="saveEditAbility(row.id)"
                @keydown.esc.prevent="cancelEditAbility"
              />
              <span v-else>{{ row.name }}</span>
            </template>
          </el-table-column>
          <el-table-column label="能力点编码" width="130">
            <template #default="{ row }">
              <span class="dim">{{ row.code || '-' }}</span>
            </template>
          </el-table-column>
          <el-table-column label="能力属性" min-width="200">
            <template #default="{ row }">
              <div v-if="editingAbilityId === row.id" class="attr-row">
                <el-check-tag
                  v-for="attr in ABILITY_ATTRIBUTES"
                  :key="attr"
                  :checked="editAbilityAttributes.includes(attr)"
                  @change="toggleEditAbilityAttr(attr)"
                >
                  {{ attr }}
                </el-check-tag>
              </div>
              <template v-else>
                <el-tag
                  v-for="attr in row.attributes || []"
                  :key="attr"
                  size="small"
                  type="info"
                  effect="plain"
                  class="attr-tag"
                >
                  {{ attr }}
                </el-tag>
                <span v-if="(row.attributes || []).length === 0" class="dim">-</span>
              </template>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="230" align="right">
            <template #default="{ row }">
              <template v-if="editingAbilityId === row.id">
                <el-button type="primary" size="small" @click="saveEditAbility(row.id)">
                  <el-icon><Check /></el-icon>
                  保存
                </el-button>
                <el-button text size="small" @click="cancelEditAbility">取消</el-button>
              </template>
              <template v-else>
                <template v-if="selectedRespId">
                  <el-tag v-if="isAdded(row.id)" type="success" size="small" effect="plain">
                    <el-icon><Check /></el-icon>
                    已添加
                  </el-tag>
                  <el-button v-else size="small" round @click="addFromPool(row)">
                    <el-icon><Plus /></el-icon>
                    添加
                  </el-button>
                </template>
                <el-button text size="small" title="编辑" @click="startEditAbility(row)">
                  <el-icon><EditPen /></el-icon>
                </el-button>
                <el-button text size="small" class="danger-btn" title="删除" @click="deleteAbility(row.id)">
                  <el-icon><Delete /></el-icon>
                </el-button>
              </template>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </el-dialog>

  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import { ElMessage } from 'element-plus';
import {
  Check,
  Close,
  Delete,
  EditPen,
  Files,
  Plus,
  Search
} from '@element-plus/icons-vue';
import { abilityApi, positionApi } from '@/api/job';
import {
  ABILITY_ATTRIBUTES,
  COMPETENCY_LEVELS,
  convertApiAbilityToLocal,
  getRespColor,
  localId,
  type LocalAbility,
  type LocalAbilityBinding,
  type LocalPosition,
  type LocalResponsibility
} from './types';

const props = defineProps<{ position: LocalPosition }>();
const emit = defineEmits<{ (e: 'update', data: Partial<LocalPosition>): void }>();

const abilities = ref<LocalAbility[]>([]);
const poolPositions = ref<{ id: string; name: string }[]>([]);
const selectedRespId = ref<string | null>(null);
const contentRef = ref<HTMLElement | null>(null);
const sectionRefs = new Map<string, HTMLElement>();

// 职责重命名
const editingRespId = ref<string | null>(null);
const editRespName = ref('');
let respEditCancelled = false;

// 批量添加职责
const addRespDialog = ref(false);
const newRespNames = ref<string[]>(['']);

// 新建能力点
const createDialog = ref(false);
const newAbilityName = ref('');
const newAbilityAttributes = ref<string[]>([]);
const duplicateName = ref<string | null>(null);

// 能力点库
const poolDialog = ref(false);
const poolSearch = ref('');
const poolSearchRef = ref<{ focus: () => void } | null>(null);
const poolFilterAttr = ref<string | null>(null);
const poolFilterPosition = ref<string | null>(null);
const poolFilterPositionAbilities = ref<Set<string>>(new Set());
let poolFilterSeq = 0;

// 能力点库内联编辑
const editingAbilityId = ref<string | null>(null);
const editAbilityName = ref('');
const editAbilityAttributes = ref<string[]>([]);

const totalBindings = computed(() => props.position.abilityBindings.length);
const selectedResp = computed(() =>
  props.position.responsibilities.find((r) => r.id === selectedRespId.value)
);

function bindingsOf(respId: string): LocalAbilityBinding[] {
  return props.position.abilityBindings.filter((b) => b.responsibilityId === respId);
}

function bindingCount(respId: string): number {
  return bindingsOf(respId).length;
}

function levelIndex(level: string): number {
  return COMPETENCY_LEVELS.findIndex((l) => l.value === level);
}

function fillWidth(level: string): string {
  const idx = Math.max(0, levelIndex(level));
  return `calc(${(idx / (COMPETENCY_LEVELS.length - 1)) * 100}% - 10px)`;
}

function setSectionRef(respId: string, el: HTMLElement | null) {
  if (el) sectionRefs.set(respId, el);
  else sectionRefs.delete(respId);
}

function scrollToResp(respId: string) {
  selectedRespId.value = respId;
  const el = sectionRefs.get(respId);
  const container = contentRef.value;
  if (el && container) {
    const y = container.scrollTop + (el.getBoundingClientRect().top - container.getBoundingClientRect().top) - 16;
    container.scrollTo({ top: y, behavior: 'smooth' });
  }
}

// ===== 数据加载 =====
async function loadAbilities() {
  try {
    const res = await abilityApi.list({ limit: 1000, isPublic: true });
    abilities.value = (res.items || []).map(convertApiAbilityToLocal);
  } catch {
    abilities.value = [];
  }
}

async function loadPoolPositions() {
  try {
    const res = await positionApi.list({ limit: 1000 });
    poolPositions.value = (res.items || []).map((p) => ({ id: p.id, name: p.name }));
  } catch {
    poolPositions.value = [];
  }
}

// 岗位过滤：请求序号丢弃过期响应，避免过滤结果与当前岗位不一致
watch(poolFilterPosition, async (positionId) => {
  const seq = ++poolFilterSeq;
  if (!positionId) {
    poolFilterPositionAbilities.value = new Set();
    return;
  }
  try {
    const res = await abilityApi.listBindings({ careerPositionId: positionId });
    if (seq !== poolFilterSeq) return;
    const ids = new Set<string>();
    (res.items || []).forEach((b) => {
      if (b.abilityPointId) ids.add(b.abilityPointId);
    });
    poolFilterPositionAbilities.value = ids;
  } catch {
    if (seq === poolFilterSeq) poolFilterPositionAbilities.value = new Set();
  }
});

const poolResults = computed(() =>
  abilities.value.filter((a) => {
    if (poolSearch.value.trim() && !a.name.toLowerCase().includes(poolSearch.value.trim().toLowerCase())) {
      return false;
    }
    if (poolFilterAttr.value && !(a.attributes || []).includes(poolFilterAttr.value)) return false;
    if (
      poolFilterPosition.value &&
      poolFilterPositionAbilities.value.size > 0 &&
      !poolFilterPositionAbilities.value.has(a.id)
    ) {
      return false;
    }
    return true;
  })
);

// 首个职责默认选中，只初始化一次（对齐 React isInitialized 语义）
let respInitialized = false;
watch(
  () => props.position.responsibilities.length,
  (len) => {
    if (!respInitialized && len > 0) {
      selectedRespId.value = props.position.responsibilities[0].id;
      respInitialized = true;
    }
  },
  { immediate: true }
);

// ===== 能力绑定增删改 =====
function updateBinding(bindingId: string, updates: Partial<LocalAbilityBinding>) {
  emit('update', {
    abilityBindings: props.position.abilityBindings.map((b) => (b.id === bindingId ? { ...b, ...updates } : b))
  });
}

function removeBinding(bindingId: string) {
  emit('update', { abilityBindings: props.position.abilityBindings.filter((b) => b.id !== bindingId) });
}

function isAdded(abilityId: string): boolean {
  return (
    !!selectedRespId.value &&
    props.position.abilityBindings.some(
      (b) => b.responsibilityId === selectedRespId.value && b.publicAbilityId === abilityId
    )
  );
}

function addFromPool(ability: LocalAbility) {
  if (!selectedRespId.value) return;
  const exists = props.position.abilityBindings.some(
    (b) => b.responsibilityId === selectedRespId.value && b.publicAbilityId === ability.id
  );
  if (exists) {
    ElMessage.error('该能力点已添加到当前职责');
    return;
  }
  const newBinding: LocalAbilityBinding = {
    id: localId('bind'),
    responsibilityId: selectedRespId.value,
    source: 'public',
    publicAbilityId: ability.id,
    abilityPointId: ability.id,
    name: ability.name,
    level: 'understand',
    rubricDescription: '',
    description: '',
    attributes: ability.attributes || []
  };
  emit('update', { abilityBindings: [...props.position.abilityBindings, newBinding] });
}

function openAbilityPool(respId: string) {
  selectedRespId.value = respId;
  poolSearch.value = '';
  poolFilterAttr.value = null;
  poolFilterPosition.value = null;
  poolDialog.value = true;
}

/** 打开能力点库弹窗后聚焦搜索框（对齐 React SearchInput autoFocus） */
function focusPoolSearch() {
  poolSearchRef.value?.focus();
}

function resetPoolFilters() {
  poolSearch.value = '';
  poolFilterAttr.value = null;
  poolFilterPosition.value = null;
  cancelEditAbility();
}

function openCreateAbility(respId: string) {
  selectedRespId.value = respId;
  duplicateName.value = null;
  newAbilityName.value = '';
  newAbilityAttributes.value = [];
  createDialog.value = true;
}

function resetCreateDialog() {
  duplicateName.value = null;
  newAbilityName.value = '';
  newAbilityAttributes.value = [];
}

function toggleNewAbilityAttr(attr: string) {
  newAbilityAttributes.value = newAbilityAttributes.value.includes(attr)
    ? newAbilityAttributes.value.filter((a) => a !== attr)
    : [...newAbilityAttributes.value, attr];
}

function createCustomAbility() {
  if (!selectedRespId.value || !newAbilityName.value.trim()) return;
  const trimmed = newAbilityName.value.trim();
  const existing = abilities.value.find((a) => a.name.toLowerCase() === trimmed.toLowerCase());
  if (existing) {
    duplicateName.value = existing.name;
    return;
  }
  const existsInBindings = props.position.abilityBindings.some(
    (b) => b.responsibilityId === selectedRespId.value && b.name.toLowerCase() === trimmed.toLowerCase()
  );
  if (existsInBindings) {
    ElMessage.error('当前职责已存在同名能力点');
    return;
  }
  const newBinding: LocalAbilityBinding = {
    id: localId('bind'),
    responsibilityId: selectedRespId.value,
    source: 'custom',
    name: trimmed,
    level: 'understand',
    rubricDescription: '',
    description: '',
    domain: undefined,
    attributes: [...newAbilityAttributes.value]
  };
  emit('update', { abilityBindings: [...props.position.abilityBindings, newBinding] });
  newAbilityName.value = '';
  newAbilityAttributes.value = [];
  createDialog.value = false;
  duplicateName.value = null;
}

function addExistingFromPool() {
  if (!duplicateName.value || !selectedRespId.value) return;
  const existing = abilities.value.find((a) => a.name.toLowerCase() === duplicateName.value!.toLowerCase());
  if (existing) {
    addFromPool(existing);
    newAbilityName.value = '';
    createDialog.value = false;
    duplicateName.value = null;
  }
}

function cancelDuplicate() {
  duplicateName.value = null;
  newAbilityName.value = '';
}

function createFromSearch() {
  newAbilityName.value = poolSearch.value.trim();
  newAbilityAttributes.value = [];
  duplicateName.value = null;
  createDialog.value = true;
}

// ===== 职责增删改 =====
function openAddRespDialog() {
  newRespNames.value = [''];
  addRespDialog.value = true;
}

/** 回车追加一行：中文输入法确认键不触发（对齐 React isComposing 判断） */
function onEnterAddRespRow(e: KeyboardEvent) {
  if (e.isComposing) return;
  e.preventDefault();
  void addRespRow();
}

async function addRespRow() {
  const next = [...newRespNames.value, ''];
  newRespNames.value = next;
  await nextTick();
  const el = document.querySelector<HTMLTextAreaElement>(`textarea[data-new-resp="${next.length - 1}"]`);
  el?.focus();
}

function removeRespRow(index: number) {
  newRespNames.value = newRespNames.value.filter((_, i) => i !== index);
}

function confirmAddResponsibilities() {
  const names = newRespNames.value.map((n) => n.trim()).filter(Boolean);
  if (names.length === 0) return;
  const newResps: LocalResponsibility[] = names.map((name) => ({
    id: localId('resp'),
    name,
    description: ''
  }));
  emit('update', { responsibilities: [...props.position.responsibilities, ...newResps] });
  selectedRespId.value = newResps[newResps.length - 1].id;
  addRespDialog.value = false;
  newRespNames.value = [''];
  ElMessage.success(`已添加 ${newResps.length} 条工作职责`);
}

function removeResponsibility(respId: string) {
  const remaining = props.position.responsibilities.filter((r) => r.id !== respId);
  emit('update', {
    responsibilities: remaining,
    // 删除职责时同步清理其能力绑定，避免孤儿绑定
    abilityBindings: props.position.abilityBindings.filter((b) => b.responsibilityId !== respId)
  });
  if (selectedRespId.value === respId) {
    selectedRespId.value = remaining.length > 0 ? remaining[0].id : null;
  }
}

async function startEditResp(resp: LocalResponsibility) {
  editingRespId.value = resp.id;
  editRespName.value = resp.name;
  respEditCancelled = false;
  await nextTick();
  document.querySelector<HTMLInputElement>(`input[data-resp-edit="${resp.id}"]`)?.focus();
}

function saveEditResp() {
  const editingId = editingRespId.value;
  if (!editingId) return;
  const trimmed = editRespName.value.trim();
  if (!trimmed) {
    // 名称清空视为删除职责，并同步清理其能力绑定
    const remaining = props.position.responsibilities.filter((r) => r.id !== editingId);
    emit('update', {
      responsibilities: remaining,
      abilityBindings: props.position.abilityBindings.filter((b) => b.responsibilityId !== editingId)
    });
    if (selectedRespId.value === editingId) {
      selectedRespId.value = remaining.length > 0 ? remaining[0].id : null;
    }
    editingRespId.value = null;
    editRespName.value = '';
    return;
  }
  emit('update', {
    responsibilities: props.position.responsibilities.map((r) =>
      r.id === editingId ? { ...r, name: trimmed } : r
    )
  });
  editingRespId.value = null;
  editRespName.value = '';
}

function cancelEditResp() {
  // Escape 取消编辑（不再保存，避免清空名称误删职责）
  respEditCancelled = true;
  editingRespId.value = null;
  editRespName.value = '';
}

function onRespEditBlur() {
  if (respEditCancelled) {
    respEditCancelled = false;
    return;
  }
  saveEditResp();
}

// ===== 公共能力点编辑/删除（写库） =====
function startEditAbility(ability: LocalAbility) {
  editingAbilityId.value = ability.id;
  editAbilityName.value = ability.name;
  editAbilityAttributes.value = [...(ability.attributes || [])];
}

function cancelEditAbility() {
  editingAbilityId.value = null;
  editAbilityName.value = '';
  editAbilityAttributes.value = [];
}

function toggleEditAbilityAttr(attr: string) {
  editAbilityAttributes.value = editAbilityAttributes.value.includes(attr)
    ? editAbilityAttributes.value.filter((a) => a !== attr)
    : [...editAbilityAttributes.value, attr];
}

function arrayEquals(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sortedA = [...a].sort();
  const sortedB = [...b].sort();
  return sortedA.every((v, i) => v === sortedB[i]);
}

async function saveEditAbility(abilityId: string) {
  const trimmed = editAbilityName.value.trim();
  if (!trimmed) return;
  const current = abilities.value.find((a) => a.id === abilityId);
  const same =
    trimmed === (current?.name || '') && arrayEquals(editAbilityAttributes.value, current?.attributes || []);
  if (same) {
    cancelEditAbility();
    return;
  }
  try {
    await abilityApi.update(abilityId, { name: trimmed, attributes: [...editAbilityAttributes.value] });
    abilities.value = abilities.value.map((a) =>
      a.id === abilityId ? { ...a, name: trimmed, attributes: [...editAbilityAttributes.value] } : a
    );
    ElMessage.success('能力点已更新');
  } catch (e) {
    ElMessage.error((e as Error).message || '更新失败');
  }
  cancelEditAbility();
}

async function deleteAbility(abilityId: string) {
  try {
    await abilityApi.delete(abilityId);
    abilities.value = abilities.value.filter((a) => a.id !== abilityId);
    ElMessage.success('能力点已删除');
  } catch (e) {
    ElMessage.error((e as Error).message || '删除失败');
  }
}

onMounted(() => {
  void loadAbilities();
  void loadPoolPositions();
});
</script>

<style scoped>
.ability-wrap {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.ability-layout {
  display: flex;
  height: calc(100vh - 260px);
  min-height: 520px;
  border: 1px solid #ebeef5;
  border-radius: 12px;
  background: #fff;
  overflow: hidden;
}
.resp-pane {
  width: 36%;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  border-right: 1px solid #ebeef5;
  background: #fafbfc;
}
.binding-pane {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  background: #fafbfc;
}
.pane-head {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 16px;
  background: #fff;
  border-bottom: 1px solid #ebeef5;
}
.pane-head-inline {
  display: flex;
  align-items: center;
  gap: 10px;
}
.pane-title {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: #303133;
}
.pane-sub {
  margin: 2px 0 0;
  font-size: 11px;
  color: #a8abb2;
}
.resp-list {
  flex: 1;
  overflow: auto;
  padding: 8px;
}
.resp-row-wrap {
  margin-bottom: 2px;
}
.resp-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 6px 10px 12px;
  border-radius: 10px;
  cursor: pointer;
  font-size: 13px;
  border: 1px solid transparent;
  transition: all 0.15s;
}
.resp-row:hover {
  background: #fff;
}
.resp-row.active {
  background: #fff;
  border-color: #e4e7ed;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
}
.resp-edit {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 10px;
}
.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}
.resp-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #303133;
}
.resp-name.unnamed {
  color: #c0c4cc;
  font-style: italic;
}
.count-badge {
  flex-shrink: 0;
  padding: 1px 7px;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 500;
  background: #f0f2f5;
  color: #606266;
}
.count-badge.zero {
  background: transparent;
  color: #c0c4cc;
}
.hover-actions {
  opacity: 0;
  transition: opacity 0.15s;
  flex-shrink: 0;
  display: inline-flex;
}
.resp-row:hover .hover-actions,
.binding-card:hover .hover-actions {
  opacity: 1;
}
.danger-btn {
  color: #c0c4cc;
}
.danger-btn:hover {
  color: #f56c6c;
}
.binding-scroll {
  flex: 1;
  overflow: auto;
  padding: 16px;
}
.group-list {
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.group {
  padding: 12px 14px;
  border-radius: 14px;
}
.group.selected {
  background: rgba(64, 158, 255, 0.05);
}
.group-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}
.group-title {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  color: #606266;
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.flex-1 {
  flex: 1;
}
.group-actions {
  display: inline-flex;
  gap: 6px;
  opacity: 0;
  transition: opacity 0.15s;
}
.group:hover .group-actions {
  opacity: 1;
}
.group-empty {
  border: 1px dashed #e4e7ed;
  border-radius: 12px;
  background: #fafafa;
}
.binding-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}
.binding-card {
  border: 1px solid #ebeef5;
  border-radius: 14px;
  background: #fff;
  padding: 16px;
  transition: all 0.2s;
}
.binding-card:hover {
  border-color: rgba(64, 158, 255, 0.35);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
}
.binding-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 14px;
}
.binding-name {
  font-size: 13px;
  font-weight: 600;
  color: #303133;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.level-track {
  position: relative;
  height: 38px;
  margin: 0 4px 10px;
}
.track-bg {
  position: absolute;
  top: 8px;
  left: 5px;
  right: 5px;
  height: 8px;
  background: #f0f2f5;
  border-radius: 4px;
}
.track-fill {
  position: absolute;
  top: 8px;
  left: 5px;
  height: 8px;
  border-radius: 4px;
  background: linear-gradient(90deg, #6366f1, #a78bfa);
  transition: width 0.3s;
}
.track-dots,
.track-labels {
  position: absolute;
  left: 0;
  right: 0;
  display: flex;
  justify-content: space-between;
  padding: 0 5px;
}
.track-dots {
  top: 4px;
}
.track-labels {
  bottom: 0;
}
.track-dot {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 2px solid #dcdfe6;
  background: #fff;
  cursor: pointer;
  padding: 0;
  transition: all 0.2s;
}
.track-dot.reached {
  border-color: rgba(99, 102, 241, 0.35);
  background: rgba(99, 102, 241, 0.15);
}
.track-dot.current {
  border-color: #6366f1;
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.18);
  transform: scale(1.1);
}
.track-label {
  font-size: 10px;
  font-weight: 500;
  color: #dcdfe6;
}
.track-label.reached {
  color: rgba(99, 102, 241, 0.7);
}
.track-label.current {
  color: #6366f1;
}
.rubric-input :deep(textarea) {
  font-size: 11px;
  background: #fafbfc;
  border-radius: 10px;
}
.dialog-desc {
  margin: 0 0 12px;
  font-size: 13px;
  color: #909399;
}
.resp-input-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 50vh;
  overflow: auto;
}
.resp-input-row {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}
.attr-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.attr-tag {
  margin-right: 4px;
}
.pool-filters {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px;
  border: 1px solid #ebeef5;
  border-radius: 10px;
  background: #fafbfc;
}
.filter-line {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.filter-label {
  font-size: 12px;
  font-weight: 500;
  color: #909399;
}
.pool-body {
  margin-top: 12px;
}
.pool-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 24px 0;
}
.dim {
  color: #a8abb2;
}
</style>
