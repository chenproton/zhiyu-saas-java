<template>
  <div class="list-page">
    <div class="page-header">
      <h2 class="page-title">合作学校</h2>
      <p class="page-sub">已引入本企业的学校列表；企业可确认、暂停或终止合作，合作评级由学校侧维护。</p>
    </div>

    <el-card shadow="never">
      <el-input v-model="keyword" placeholder="搜索学校名称..." clearable style="max-width: 300px; margin-bottom: 12px" />
      <el-table v-loading="loading" :data="filteredSchools" stripe>
        <el-table-column label="学校名称" prop="schoolName" min-width="160" />
        <el-table-column label="合作状态" width="110">
          <template #default="{ row }">{{ statusLabel(row.status) }}</template>
        </el-table-column>
        <el-table-column label="合作评级" width="100">
          <template #default="{ row }">{{ ratingLabel(row.rating) }}</template>
        </el-table-column>
        <el-table-column label="学校前台展示" width="110">
          <template #default="{ row }">{{ row.isPublic ? '是' : '否' }}</template>
        </el-table-column>
        <el-table-column label="引入时间" width="120">
          <template #default="{ row }">{{ fmt(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="200" align="right">
          <template #default="{ row }">
            <el-button v-if="row.status === 'negotiating'" size="small" @click="updateStatus(row, 'active')">确认合作</el-button>
            <el-button v-if="row.status === 'active'" size="small" @click="updateStatus(row, 'paused')">暂停合作</el-button>
            <el-button v-if="row.status === 'paused'" size="small" @click="updateStatus(row, 'active')">恢复合作</el-button>
            <el-button v-if="row.status !== 'terminated'" size="small" type="danger" @click="confirmTerminate(row)">终止合作</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="terminateDialog" title="终止合作" width="440px">
      <p>确定要终止与 {{ terminateTarget?.schoolName }} 的合作吗？终止后不可恢复。</p>
      <template #footer>
        <el-button @click="terminateDialog = false">取消</el-button>
        <el-button type="danger" :loading="acting" @click="doTerminate">终止合作</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { partnerSchoolApi } from '@/api/partner';
import type { PartnerSchool } from '@/types/partner';

const schools = ref<PartnerSchool[]>([]);
const keyword = ref('');
const loading = ref(true);
const acting = ref(false);
const terminateDialog = ref(false);
const terminateTarget = ref<PartnerSchool | null>(null);

const filteredSchools = computed(() => {
  const q = keyword.value.trim().toLowerCase();
  if (!q) return schools.value;
  return schools.value.filter((s) => s.schoolName.toLowerCase().includes(q));
});

function statusLabel(s: string) {
  const labels: Record<string, string> = { negotiating: '洽谈中', active: '合作中', paused: '已暂停', terminated: '已终止' };
  return labels[s] || s;
}
function ratingLabel(r?: string) {
  const labels: Record<string, string> = { a: 'A 级', b: 'B 级', c: 'C 级', d: 'D 级' };
  return r ? labels[r.toLowerCase()] || r : '-';
}
function fmt(d?: string) {
  return d ? String(d).slice(0, 10) : '-';
}

async function load() {
  loading.value = true;
  try {
    const res = await partnerSchoolApi.list({ limit: 200 });
    schools.value = res.items || [];
  } catch (e) {
    ElMessage.error((e as Error).message || '加载失败');
  } finally {
    loading.value = false;
  }
}

async function updateStatus(row: PartnerSchool, status: 'active' | 'paused' | 'terminated') {
  acting.value = true;
  try {
    await partnerSchoolApi.updateStatus(row.tenantId, status);
    ElMessage.success('合作状态已更新');
    load();
  } catch (e) {
    ElMessage.error((e as Error).message || '操作失败');
  } finally {
    acting.value = false;
  }
}

function confirmTerminate(row: PartnerSchool) {
  terminateTarget.value = row;
  terminateDialog.value = true;
}
async function doTerminate() {
  if (!terminateTarget.value) return;
  acting.value = true;
  try {
    await partnerSchoolApi.updateStatus(terminateTarget.value.tenantId, 'terminated');
    ElMessage.success('合作已终止');
    terminateDialog.value = false;
    terminateTarget.value = null;
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
.list-page { padding: 16px; }
.page-header { margin-bottom: 16px; }
.page-title { font-size: 20px; font-weight: 700; margin: 0; }
.page-sub { color: #909399; margin: 8px 0 0; }
</style>
