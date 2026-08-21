<template>
  <div class="list-page">
    <div class="page-head">
      <div class="page-title">合作权限管理</div>
      <div class="page-sub">为企业授予岗位/场景的编辑权限：授权后企业专家可登录企业服务台查看并编辑这些资源（编辑稿需学校审批后生效）。</div>
    </div>

    <el-card shadow="never">
      <template #header>
        <div class="card-header">
          <div class="card-title">选择企业</div>
          <div class="card-sub">仅可对本校已引入的企业授权</div>
        </div>
      </template>
      <el-select v-model="enterpriseId" placeholder="请选择企业" style="max-width: 420px" :disabled="entLoading" @change="onSelectEnterprise">
        <el-option v-for="e in enterprises" :key="e.id" :label="e.name" :value="e.id" />
      </el-select>
    </el-card>

    <el-card v-if="currentEnterpriseId" shadow="never" class="grant-card">
      <template #header>
        <div class="card-header">
          <div class="card-title">资源授权</div>
          <div class="card-sub">展示本校全部岗位/场景（含各状态与批次分组），勾选即授权该企业编辑权限，保存按类型整组生效。</div>
        </div>
      </template>

      <el-tabs v-model="activeType">
        <el-tab-pane label="岗位" name="position" />
        <el-tab-pane label="场景" name="scene" />
      </el-tabs>

      <div class="filters">
        <el-input
          v-model="search"
          :placeholder="activeType === 'position' ? '搜索岗位名称' : '搜索场景名称'"
          clearable
          style="flex: 1; min-width: 220px"
        />
        <el-select v-model="batchFilter" placeholder="按批次筛选" style="width: 180px">
          <el-option label="全部批次" value="__all__" />
          <el-option v-for="b in batches" :key="b.id" :label="b.name" :value="b.id" />
          <el-option v-if="uncategorized.length > 0" label="未分类" value="__none__" />
        </el-select>
        <el-select v-model="statusFilter" placeholder="按状态筛选" style="width: 130px">
          <el-option label="全部状态" value="__all__" />
          <el-option v-for="opt in STATUS_OPTIONS" :key="opt.value" :label="opt.label" :value="opt.value" />
        </el-select>
        <el-button @click="resetFilters">重置</el-button>
      </div>

      <div class="action-bar">
        <span class="selected-count">已勾选 {{ selectedCount }} 个{{ activeType === 'position' ? '岗位' : '场景' }}</span>
        <el-button v-if="filtered.length > 0" size="small" @click="toggleFilteredAll">
          {{ allFilteredChecked ? '取消当前筛选全选' : '全选当前筛选' }}
        </el-button>
        <div class="flex-1" />
        <el-button type="primary" size="small" :loading="saving" @click="saveCurrentType">
          保存{{ activeType === 'position' ? '岗位' : '场景' }}授权
        </el-button>
      </div>

      <div v-loading="optionsLoading">
        <el-empty v-if="filtered.length === 0" :description="`当前筛选条件下暂无${activeType === 'position' ? '岗位' : '场景'}`" />
        <div v-else class="groups">
          <div v-for="b in filteredBatches" :key="b.id" class="group-card">
            <div class="group-head clickable" @click="toggleBatch(b.id)">
              <div class="group-title">
                <span class="group-name">{{ b.name }}</span>
                <el-tag size="small" type="info">{{ b.items.length }}</el-tag>
              </div>
              <el-button size="small" text @click.stop="toggleGroupAll(b.items)">
                {{ groupAllChecked(b.items) ? '取消全选' : '全选' }}
              </el-button>
            </div>
            <div v-if="!collapsedBatches.has(b.id)" class="group-body">
              <div class="row-grid">
                <div v-for="o in b.items" :key="o.id" class="row-item" :class="{ checked: isChecked(o) }" @click="toggleOne(o)">
                  <el-checkbox :model-value="isChecked(o)" @click.stop @change="toggleOne(o)" />
                  <div class="row-main">
                    <div class="row-name">{{ o.name }}</div>
                    <div class="row-meta">
                      <span class="status-badge" :style="{ color: statusConfigOf(o.status).color, background: statusConfigOf(o.status).bg }">{{ statusConfigOf(o.status).label }}</span>
                      <span class="meta-text">{{ sourceLabel(o) }}</span>
                      <span v-if="o.batchName" class="meta-text">批次：{{ o.batchName }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div v-if="filteredUncategorized.length > 0" class="group-card uncategorized">
            <div class="group-head">
              <div class="group-title">
                <span class="group-name">未分类</span>
                <el-tag size="small" type="info">{{ filteredUncategorized.length }}</el-tag>
              </div>
              <el-button size="small" text @click="toggleGroupAll(filteredUncategorized)">
                {{ groupAllChecked(filteredUncategorized) ? '取消全选' : '全选' }}
              </el-button>
            </div>
            <div class="group-body">
              <div class="row-grid">
                <div v-for="o in filteredUncategorized" :key="o.id" class="row-item" :class="{ checked: isChecked(o) }" @click="toggleOne(o)">
                  <el-checkbox :model-value="isChecked(o)" @click.stop @change="toggleOne(o)" />
                  <div class="row-main">
                    <div class="row-name">{{ o.name }}</div>
                    <div class="row-meta">
                      <span class="status-badge" :style="{ color: statusConfigOf(o.status).color, background: statusConfigOf(o.status).bg }">{{ statusConfigOf(o.status).label }}</span>
                      <span class="meta-text">{{ sourceLabel(o) }}</span>
                      <span v-if="o.batchName" class="meta-text">批次：{{ o.batchName }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { portalRequest, buildQuery } from '@/api/http';
import { useAuthStore } from '@/stores/auth';
import { STATUS_OPTIONS, statusConfigOf } from './alliance-admin';
import type {
  AllianceEnterprise,
  GrantResourceOption,
  AllianceResourceGrant,
  ListResponse,
} from './alliance-admin';

type ResourceType = 'position' | 'scene';

interface BatchGroup {
  id: string;
  name: string;
  items: GrantResourceOption[];
}

const auth = useAuthStore();
const tenantId = computed(() => (auth.user?.tenantId as string) || '');

const enterprises = ref<AllianceEnterprise[]>([]);
const entLoading = ref(false);
const enterpriseId = ref('');
const activeType = ref<ResourceType>('position');
const checked = ref<Record<string, boolean>>({});
const saving = ref(false);

const search = ref('');
const statusFilter = ref('__all__');
const batchFilter = ref('__all__');
const collapsedBatches = ref<Set<string>>(new Set());

const options = ref<GrantResourceOption[]>([]);
const granted = ref<Set<string>>(new Set());
const optionsLoading = ref(false);

const currentEnterpriseId = computed(() => enterpriseId.value || enterprises.value[0]?.id || '');

const typeOptions = computed(() => options.value.filter((o) => o.type === activeType.value));

const batches = computed<BatchGroup[]>(() => {
  const map = new Map<string, { name: string; items: GrantResourceOption[] }>();
  typeOptions.value.forEach((o) => {
    if (!o.batchId || !o.batchName) return;
    if (!map.has(o.batchId)) map.set(o.batchId, { name: o.batchName, items: [] });
    map.get(o.batchId)!.items.push(o);
  });
  return [...map.entries()].map(([id, v]) => ({ id, ...v }));
});

const uncategorized = computed(() => typeOptions.value.filter((o) => !o.batchId || !o.batchName));

const filtered = computed(() => {
  const kw = search.value.trim().toLowerCase();
  return typeOptions.value.filter((o) => {
    if (kw && !o.name.toLowerCase().includes(kw)) return false;
    if (statusFilter.value !== '__all__' && o.status !== statusFilter.value) return false;
    if (batchFilter.value === '__all__') return true;
    if (batchFilter.value === '__none__') return !o.batchId || !o.batchName;
    return o.batchId === batchFilter.value;
  });
});

const filteredBatches = computed(() =>
  batches.value.filter((b) => filtered.value.some((o) => o.batchId === b.id)),
);

const filteredUncategorized = computed(() =>
  uncategorized.value.filter((o) => filtered.value.some((x) => x.id === o.id)),
);

function isChecked(o: GrantResourceOption): boolean {
  return checked.value[o.id] === undefined ? granted.value.has(o.id) : checked.value[o.id];
}

const allFilteredChecked = computed(
  () => filtered.value.length > 0 && filtered.value.every((o) => isChecked(o)),
);

const selectedCount = computed(() => typeOptions.value.filter((o) => isChecked(o)).length);

function groupAllChecked(items: GrantResourceOption[]): boolean {
  return items.length > 0 && items.every((o) => isChecked(o));
}

function sourceLabel(o: GrantResourceOption): string {
  if (o.source === 'school') return '本校自建';
  if (o.sourceEnterpriseId === currentEnterpriseId.value) return '该企业共建';
  return o.sourceEnterpriseName ? `${o.sourceEnterpriseName}共建` : '企业共建';
}

function toggleBatch(batchId: string) {
  const next = new Set(collapsedBatches.value);
  if (next.has(batchId)) next.delete(batchId);
  else next.add(batchId);
  collapsedBatches.value = next;
}

function toggleFilteredAll() {
  const next = { ...checked.value };
  filtered.value.forEach((o) => {
    next[o.id] = !allFilteredChecked.value;
  });
  checked.value = next;
}

function toggleGroupAll(items: GrantResourceOption[]) {
  const groupAll = groupAllChecked(items);
  const next = { ...checked.value };
  items.forEach((o) => {
    next[o.id] = !groupAll;
  });
  checked.value = next;
}

function toggleOne(o: GrantResourceOption) {
  checked.value = { ...checked.value, [o.id]: !isChecked(o) };
}

function resetFilters() {
  search.value = '';
  statusFilter.value = '__all__';
  batchFilter.value = '__all__';
}

async function loadEnterprises() {
  if (!tenantId.value) return;
  entLoading.value = true;
  try {
    const res = await portalRequest<ListResponse<AllianceEnterprise>>('/alliance/enterprises?limit=200');
    enterprises.value = res.items || [];
  } catch (e) {
    ElMessage.error((e as Error).message || '加载企业失败');
  } finally {
    entLoading.value = false;
  }
}

async function loadOptions() {
  if (!tenantId.value || !currentEnterpriseId.value) {
    options.value = [];
    granted.value = new Set();
    return;
  }
  optionsLoading.value = true;
  try {
    const [optRes, grantRes] = await Promise.all([
      portalRequest<ListResponse<GrantResourceOption>>(
        `/alliance/grants/resource-options${buildQuery({ enterpriseId: currentEnterpriseId.value })}`,
      ),
      portalRequest<{ enterpriseId: string; grants: AllianceResourceGrant[] }>(
        `/alliance/grants${buildQuery({ enterpriseId: currentEnterpriseId.value })}`,
      ),
    ]);
    const grantedSet = new Set<string>();
    (grantRes.grants || []).forEach((g) => g.resourceIds.forEach((id) => grantedSet.add(id)));
    options.value = optRes.items || [];
    granted.value = grantedSet;
  } catch (e) {
    ElMessage.error((e as Error).message || '加载资源失败');
  } finally {
    optionsLoading.value = false;
  }
}

function onSelectEnterprise() {
  checked.value = {};
  resetFilters();
  loadOptions();
}

async function saveCurrentType() {
  if (saving.value) return;
  saving.value = true;
  try {
    const ids = typeOptions.value.filter((o) => isChecked(o)).map((o) => o.id);
    await portalRequest('/alliance/grants', {
      method: 'PUT',
      body: JSON.stringify({
        enterpriseId: currentEnterpriseId.value,
        resourceType: activeType.value,
        resourceIds: ids,
      }),
    });
    ElMessage.success('授权已保存');
    checked.value = {};
    await loadOptions();
  } catch (e) {
    ElMessage.error((e as Error).message || '保存失败');
  } finally {
    saving.value = false;
  }
}

onMounted(async () => {
  await loadEnterprises();
  await loadOptions();
});
</script>

<style scoped>
.list-page { padding: 16px; display: flex; flex-direction: column; gap: 16px; }
.page-head { margin-bottom: 4px; }
.page-title { font-size: 20px; font-weight: 600; }
.page-sub { margin-top: 4px; font-size: 13px; color: #909399; }
.card-header { display: flex; align-items: center; gap: 8px; }
.card-title { font-size: 14px; font-weight: 600; }
.card-sub { font-size: 12px; color: #909399; }
.grant-card { min-height: 200px; }
.filters { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 12px; }
.action-bar { display: flex; align-items: center; gap: 8px; padding: 8px 0 12px; border-top: 1px solid #f1f5f9; }
.selected-count { font-size: 12px; color: #909399; }
.flex-1 { flex: 1; }
.groups { display: flex; flex-direction: column; gap: 12px; }
.group-card { border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden; }
.group-card.uncategorized { border-style: dashed; }
.group-head { display: flex; align-items: center; justify-content: space-between; padding: 10px 16px; background: #f8fafc; }
.group-head.clickable { cursor: pointer; }
.group-title { display: flex; align-items: center; gap: 8px; }
.group-name { font-weight: 600; color: #1f2937; }
.group-body { padding: 12px; }
.row-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.row-item { display: flex; align-items: flex-start; gap: 8px; padding: 8px 10px; border: 1px solid #f1f5f9; border-radius: 8px; cursor: pointer; }
.row-item.checked { border-color: #b3d8ff; background: #f0f7ff; }
.row-main { min-width: 0; flex: 1; }
.row-name { font-size: 13px; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.row-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin-top: 2px; }
.status-badge { font-size: 11px; padding: 1px 6px; border-radius: 4px; }
.meta-text { font-size: 11px; color: #909399; }
@media (max-width: 768px) {
  .row-grid { grid-template-columns: 1fr; }
}
</style>
