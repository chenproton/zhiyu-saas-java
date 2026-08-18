<template>
  <div class="dict-page">
    <div class="page-head">
      <h1 class="page-title">字典管理</h1>
      <p class="page-desc">维护联盟业务字典，供各模块下拉使用</p>
    </div>

    <el-tabs v-model="activeType" class="dict-tabs">
      <el-tab-pane v-for="tab in tabs" :key="tab.dictType" :name="tab.dictType" :label="tab.label" />
    </el-tabs>

    <div class="card">
      <h2 class="card-title">{{ activeLabel }}字典</h2>
      <p class="card-desc">{{ activeDesc }}</p>

      <div class="dict-toolbar">
        <el-button type="primary" size="small" @click="openCreate">
          <el-icon class="mr-4"><Plus /></el-icon>
          新增
        </el-button>
        <span class="dict-count">共 {{ items.length }} 项</span>
      </div>

      <div class="table-card">
        <el-table v-loading="loading" :data="items" style="width: 100%">
          <el-table-column label="编码" min-width="160">
            <template #default="{ row }">
              <span class="cell-mono">{{ row.code }}</span>
            </template>
          </el-table-column>
          <el-table-column label="名称" min-width="200">
            <template #default="{ row }">{{ row.name }}</template>
          </el-table-column>
          <el-table-column label="排序" width="100">
            <template #default="{ row }">{{ row.sortOrder }}</template>
          </el-table-column>
          <el-table-column label="操作" width="160" align="right">
            <template #default="{ row }">
              <el-button link type="primary" size="small" @click="openEdit(row)">编辑</el-button>
              <el-button link type="danger" size="small" @click="confirmDelete(row)">删除</el-button>
            </template>
          </el-table-column>
          <template #empty>
            <el-empty description="暂无" :image-size="60" />
          </template>
        </el-table>
      </div>
    </div>

    <el-dialog v-model="dialogOpen" :title="editId ? '编辑字典项' : '新增字典项'" width="420px">
      <el-form :model="form" label-width="60px">
        <el-form-item label="编码" required>
          <el-input v-model="form.code" :disabled="!!editId" placeholder="编码" />
        </el-form-item>
        <el-form-item label="名称" required>
          <el-input v-model="form.name" placeholder="名称" />
        </el-form-item>
        <el-form-item label="排序">
          <el-input v-model.number="form.sortOrder" type="number" placeholder="排序" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogOpen = false">取消</el-button>
        <el-button type="primary" :loading="saving" :disabled="!form.code || !form.name" @click="save">
          保存
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Plus } from '@element-plus/icons-vue';
import { portalRequest } from '@/api/http';
import { useAuthStore } from '@/stores/auth';
import type { AllianceDictionary } from './shared';

const auth = useAuthStore();
const tenantId = () => (auth.user?.tenantId as string) || '';

const tabs = [
  { dictType: 'cooperation_type', label: '合作类型', desc: '校企合作类型字典（人才培养/实习实训/技术研发等）' },
  { dictType: 'cooperation_rating', label: '合作评级', desc: '企业合作评级字典（战略合作/深度合作/一般合作）' },
  { dictType: 'enterprise_status', label: '合作状态', desc: '企业合作状态字典（洽谈中/合作中/已暂停/已终止）' },
  { dictType: 'achievement_type', label: '成果类型', desc: '合作成果类型字典（岗位/场景/课程/自定义）' },
  { dictType: 'agreement_type', label: '协议类型', desc: '合作协议类型字典' },
  { dictType: 'agreement_status', label: '协议状态', desc: '合作协议状态字典' },
  { dictType: 'expert_rating', label: '专家评级', desc: '专家评级字典（金牌/银牌/铜牌）' },
  { dictType: 'project_type', label: '项目类型', desc: '合作项目类型字典' },
];

const activeType = ref(tabs[0].dictType);
const activeLabel = computed(() => tabs.find((t) => t.dictType === activeType.value)?.label ?? '');
const activeDesc = computed(() => tabs.find((t) => t.dictType === activeType.value)?.desc ?? '');

const items = ref<AllianceDictionary[]>([]);
const loading = ref(false);
const dialogOpen = ref(false);
const editId = ref<string | null>(null);
const saving = ref(false);
const form = ref({ code: '', name: '', sortOrder: 0 });

async function load() {
  if (!tenantId()) return;
  loading.value = true;
  try {
    const data = await portalRequest<{ items: AllianceDictionary[] }>(
      `/alliance/dictionaries/${activeType.value}`,
    );
    items.value = data.items || [];
  } catch (e) {
    ElMessage.error((e as Error).message || '加载失败');
  } finally {
    loading.value = false;
  }
}

function openCreate() {
  form.value = { code: '', name: '', sortOrder: items.value.length };
  editId.value = null;
  dialogOpen.value = true;
}

function openEdit(row: AllianceDictionary) {
  form.value = { code: row.code, name: row.name, sortOrder: row.sortOrder };
  editId.value = row.id;
  dialogOpen.value = true;
}

async function save() {
  saving.value = true;
  try {
    const body = JSON.stringify(form.value);
    if (editId.value) {
      await portalRequest(`/alliance/dictionaries/${activeType.value}/${editId.value}`, {
        method: 'PUT',
        body,
      });
    } else {
      await portalRequest(`/alliance/dictionaries/${activeType.value}`, {
        method: 'POST',
        body,
      });
    }
    ElMessage.success('已保存');
    dialogOpen.value = false;
    editId.value = null;
    await load();
  } catch (e) {
    ElMessage.error((e as Error).message || '保存失败');
  } finally {
    saving.value = false;
  }
}

async function confirmDelete(row: AllianceDictionary) {
  try {
    await ElMessageBox.confirm(`确定要删除「${row.name}」吗？`, '确认删除', {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning',
    });
  } catch {
    return;
  }
  try {
    await portalRequest(`/alliance/dictionaries/${activeType.value}/${row.id}`, { method: 'DELETE' });
    ElMessage.success('已删除');
    await load();
  } catch (e) {
    ElMessage.error((e as Error).message || '删除失败');
  }
}

watch(activeType, () => {
  load();
});

onMounted(load);
</script>

<style scoped>
.dict-page {
  min-height: 100%;
}
.page-head {
  margin-bottom: 20px;
}
.page-title {
  font-size: 20px;
  font-weight: 600;
  color: #0f172a;
  margin: 0;
}
.page-desc {
  margin-top: 4px;
  font-size: 13px;
  color: #64748b;
}
.dict-tabs {
  margin-bottom: 16px;
}
.card {
  border: 1px solid #e7e5e4;
  border-radius: 12px;
  background: #fff;
  padding: 20px;
}
.card-title {
  font-size: 16px;
  font-weight: 600;
  color: #0f172a;
  margin: 0 0 4px;
}
.card-desc {
  font-size: 13px;
  color: #64748b;
  margin: 0 0 16px;
}
.dict-toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}
.dict-count {
  font-size: 13px;
  color: #64748b;
}
.mr-4 {
  margin-right: 4px;
}
.table-card {
  border: 1px solid #f1f5f9;
  border-radius: 8px;
  overflow: hidden;
}
.cell-mono {
  font-family: monospace;
  font-size: 13px;
}
</style>
