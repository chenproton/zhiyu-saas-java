<template>
  <div class="tags-page">
    <div class="stat-card">
      <div class="stat-count">{{ tags.length }}</div>
      <div class="stat-label">标签总数</div>
    </div>

    <el-card shadow="never">
      <template #header>
        <div class="card-header">
          <span class="card-title">标签管理</span>
          <el-button type="primary" @click="openDialog()">新建标签</el-button>
        </div>
      </template>

      <el-input
        v-model="searchQuery"
        placeholder="搜索标签..."
        clearable
        style="max-width: 320px; margin-bottom: 12px"
      />

      <el-table v-loading="loading" :data="filtered" stripe>
        <el-table-column label="标签" min-width="180">
          <template #default="{ row }">
            <TagBadge :tag="row" />
          </template>
        </el-table-column>
        <el-table-column label="颜色" width="130">
          <template #default="{ row }">
            <span class="color-text">{{ row.color }}</span>
          </template>
        </el-table-column>
        <el-table-column label="绑定资源数" width="120">
          <template #default="{ row }">{{ row.resourceCount ?? 0 }}</template>
        </el-table-column>
        <el-table-column label="操作" width="140" fixed="right">
          <template #default="{ row }">
            <el-button size="small" @click="openDialog(row)">编辑</el-button>
            <el-button size="small" type="danger" @click="confirmDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="dialog" :title="editing ? '编辑标签' : '新建标签'" width="460px">
      <p class="dialog-desc">标签可用于公共资源库各列表页的筛选，以及资源新增/编辑时的绑定</p>
      <el-form label-width="80px">
        <el-form-item label="标签名称">
          <el-input v-model="form.name" maxlength="64" placeholder="如：重点教材、精品课程" />
        </el-form-item>
        <el-form-item label="标签颜色">
          <div class="color-row">
            <el-color-picker v-model="form.color" />
            <div class="color-preview">
              <TagBadge :tag="previewTag" />
              <span class="color-text">{{ form.color }}</span>
            </div>
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialog = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="save">{{ editing ? '保存' : '创建' }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { tagApi } from '@/api/library';
import type { TagItem } from '@/types/library';
import TagBadge from './_components/TagBadge.vue';
import { useTags } from './_components/useTags';

const { tags, loading, reload } = useTags();

const searchQuery = ref('');
const dialog = ref(false);
const saving = ref(false);
const editing = ref<TagItem | null>(null);
const form = reactive({ name: '', color: '#6366f1' });

const filtered = computed(() => {
  const q = searchQuery.value.trim().toLowerCase();
  if (!q) return tags.value;
  return tags.value.filter((t) => t.name.toLowerCase().includes(q));
});

const previewTag = computed<TagItem>(() => ({
  id: 'preview',
  tenantId: '',
  name: form.name.trim() || '标签预览',
  color: form.color,
  createdAt: '',
  updatedAt: ''
}));

function randomColor(): string {
  return `#${Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0')}`;
}

function openDialog(row?: TagItem): void {
  editing.value = row || null;
  form.name = row?.name || '';
  form.color = row?.color || randomColor();
  dialog.value = true;
}

async function save(): Promise<void> {
  if (!form.name.trim()) {
    ElMessage.warning('标签名称不能为空');
    return;
  }
  saving.value = true;
  try {
    const payload = { name: form.name.trim(), color: form.color };
    if (editing.value) {
      await tagApi.update(editing.value.id, payload);
      ElMessage.success('更新成功');
    } else {
      await tagApi.create(payload);
      ElMessage.success('创建成功');
    }
    dialog.value = false;
    await reload();
  } catch (e) {
    ElMessage.error((e as Error).message || '保存失败');
  } finally {
    saving.value = false;
  }
}

async function confirmDelete(row: TagItem): Promise<void> {
  try {
    await ElMessageBox.confirm(
      '确定要删除该标签吗？关联资源的标签绑定将一并清除。',
      '确认删除',
      { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' }
    );
  } catch {
    return;
  }
  try {
    await tagApi.delete(row.id);
    ElMessage.success('删除成功');
    await reload();
  } catch (e) {
    ElMessage.error((e as Error).message || '删除失败');
  }
}
</script>

<style scoped>
.tags-page {
  padding: 16px;
}
.stat-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  margin-bottom: 16px;
  border-radius: 12px;
  background: linear-gradient(135deg, #eef2ff, #f5f7ff);
}
.stat-count {
  font-size: 24px;
  font-weight: 700;
  color: #303133;
}
.stat-label {
  font-size: 12px;
  color: #94a3b8;
}
.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.card-title {
  font-size: 16px;
  font-weight: 600;
}
.dialog-desc {
  margin: -8px 0 12px;
  font-size: 13px;
  color: #94a3b8;
}
.color-text {
  font-family: monospace;
  font-size: 13px;
  color: #94a3b8;
}
.color-row {
  display: flex;
  align-items: center;
  gap: 12px;
}
.color-preview {
  display: flex;
  align-items: center;
  gap: 8px;
}
</style>
