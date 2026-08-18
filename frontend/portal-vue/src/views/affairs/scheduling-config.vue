<template>
  <div class="config-page">
    <div class="page-header">
      <h2 class="page-title">场地与节次配置</h2>
      <p class="page-sub">维护学期、场地与节次，供排课使用</p>
    </div>

    <el-card shadow="never">
      <el-tabs v-model="activeTab">
        <!-- 学期管理 -->
        <el-tab-pane label="学期管理" name="term">
          <div class="tab-actions">
            <el-button type="primary" @click="openTerm()">新增学期</el-button>
          </div>
          <el-table v-loading="loading.term" :data="terms" stripe>
            <el-table-column label="名称" prop="name" min-width="140" />
            <el-table-column label="开始日期" prop="startDate" width="120" />
            <el-table-column label="结束日期" prop="endDate" width="120" />
            <el-table-column label="周数" prop="weeksCount" width="80" />
            <el-table-column label="当前学期" width="90">
              <template #default="{ row }">
                <el-tag v-if="row.isCurrent" type="success">当前</el-tag>
                <span v-else>-</span>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="130" align="right">
              <template #default="{ row }">
                <el-button size="small" @click="openTerm(row)">编辑</el-button>
                <el-button size="small" type="danger" @click="delTerm(row)">删除</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>

        <!-- 场地管理 -->
        <el-tab-pane label="场地管理" name="venue">
          <div class="tab-actions">
            <el-button type="primary" @click="openVenue()">新增场地</el-button>
          </div>
          <el-table v-loading="loading.venue" :data="venues" stripe>
            <el-table-column label="名称" prop="name" min-width="140" />
            <el-table-column label="类型" prop="type" width="120" />
            <el-table-column label="容量" prop="capacity" width="90">
              <template #default="{ row }">{{ row.capacity ?? '-' }}</template>
            </el-table-column>
            <el-table-column label="操作" width="130" align="right">
              <template #default="{ row }">
                <el-button size="small" @click="openVenue(row)">编辑</el-button>
                <el-button size="small" type="danger" @click="delVenue(row)">删除</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>

        <!-- 节次管理 -->
        <el-tab-pane label="节次管理" name="period">
          <div class="tab-actions">
            <el-button type="primary" @click="openPeriod()">新增节次</el-button>
          </div>
          <el-table v-loading="loading.period" :data="periods" stripe>
            <el-table-column label="名称" prop="name" width="140" />
            <el-table-column label="类型" prop="type" width="120" />
            <el-table-column label="排序" prop="sortOrder" width="80" />
            <el-table-column label="开始时间" prop="startTime" width="100" />
            <el-table-column label="结束时间" prop="endTime" width="100" />
            <el-table-column label="操作" width="130" align="right">
              <template #default="{ row }">
                <el-button size="small" @click="openPeriod(row)">编辑</el-button>
                <el-button size="small" type="danger" @click="delPeriod(row)">删除</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>
      </el-tabs>
    </el-card>

    <!-- 学期弹窗 -->
    <el-dialog v-model="termDialog" :title="termEditing ? '编辑学期' : '新增学期'" width="460px">
      <el-form label-width="90px">
        <el-form-item label="名称" required><el-input v-model="termForm.name" /></el-form-item>
        <el-form-item label="起止日期">
          <el-date-picker v-model="termForm.range" type="daterange" value-format="YYYY-MM-DD" start-placeholder="开始" end-placeholder="结束" style="width: 100%" />
        </el-form-item>
        <el-form-item label="周数"><span>{{ termWeeks }}</span></el-form-item>
        <el-form-item label="当前学期"><el-switch v-model="termForm.isCurrent" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="termDialog = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="saveTerm">保存</el-button>
      </template>
    </el-dialog>

    <!-- 场地弹窗 -->
    <el-dialog v-model="venueDialog" :title="venueEditing ? '编辑场地' : '新增场地'" width="440px">
      <el-form label-width="90px">
        <el-form-item label="名称" required><el-input v-model="venueForm.name" /></el-form-item>
        <el-form-item label="类型">
          <el-select v-model="venueForm.type" style="width: 100%">
            <el-option v-for="t in venueTypes" :key="t" :label="t" :value="t" />
          </el-select>
        </el-form-item>
        <el-form-item label="容量"><el-input-number v-model="venueForm.capacity" :min="1" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="venueDialog = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="saveVenue">保存</el-button>
      </template>
    </el-dialog>

    <!-- 节次弹窗 -->
    <el-dialog v-model="periodDialog" :title="periodEditing ? '编辑节次' : '新增节次'" width="440px">
      <el-form label-width="90px">
        <el-form-item label="名称" required><el-input v-model="periodForm.name" placeholder="如：第1节" /></el-form-item>
        <el-form-item label="类型">
          <el-select v-model="periodForm.type" style="width: 100%">
            <el-option label="上午" value="morning" />
            <el-option label="下午" value="afternoon" />
            <el-option label="晚自习" value="evening" />
            <el-option label="早自习" value="morning_self" />
          </el-select>
        </el-form-item>
        <el-form-item label="排序"><el-input-number v-model="periodForm.sortOrder" :min="0" /></el-form-item>
        <el-form-item label="开始时间"><el-time-picker v-model="periodForm.startTime" value-format="HH:mm" style="width: 100%" /></el-form-item>
        <el-form-item label="结束时间"><el-time-picker v-model="periodForm.endTime" value-format="HH:mm" style="width: 100%" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="periodDialog = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="savePeriod">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { termApi, venueApi, periodSlotApi } from '@/api/affairs';
import type { AffairsTerm, Venue, PeriodSlot } from '@/types/affairs';

const venueTypes = ['教室', '机房', '实训室', '实验室', '校外基地'];
const activeTab = ref('term');
const loading = reactive({ term: false, venue: false, period: false });
const saving = ref(false);

const terms = ref<AffairsTerm[]>([]);
const venues = ref<Venue[]>([]);
const periods = ref<PeriodSlot[]>([]);

// 学期
const termDialog = ref(false);
const termEditing = ref<AffairsTerm | null>(null);
const termForm = reactive({ name: '', range: [] as string[], isCurrent: false });
const termWeeks = computed(() => {
  if (!termForm.range || termForm.range.length !== 2) return 0;
  const [from, to] = termForm.range.map((s) => new Date(s).getTime());
  const days = Math.round((to - from) / 86400000) + 1;
  return Math.max(1, Math.ceil(days / 7));
});

// 场地
const venueDialog = ref(false);
const venueEditing = ref<Venue | null>(null);
const venueForm = reactive({ name: '', type: '教室', capacity: undefined as number | undefined });

// 节次
const periodDialog = ref(false);
const periodEditing = ref<PeriodSlot | null>(null);
const periodForm = reactive({ name: '', type: 'morning', sortOrder: 0, startTime: '', endTime: '' });

async function loadTerms() {
  loading.term = true;
  try {
    const res = await termApi.list({ limit: 500 });
    terms.value = res.items;
  } catch (e) { ElMessage.error((e as Error).message || '加载学期失败'); } finally { loading.term = false; }
}
async function loadVenues() {
  loading.venue = true;
  try {
    const res = await venueApi.list({ limit: 500 });
    venues.value = res.items;
  } catch (e) { ElMessage.error((e as Error).message || '加载场地失败'); } finally { loading.venue = false; }
}
async function loadPeriods() {
  loading.period = true;
  try {
    const res = await periodSlotApi.list({ limit: 500 });
    periods.value = res.items;
  } catch (e) { ElMessage.error((e as Error).message || '加载节次失败'); } finally { loading.period = false; }
}

// 学期
function openTerm(row?: AffairsTerm) {
  termEditing.value = row || null;
  termForm.name = row?.name || '';
  termForm.range = row ? [row.startDate, row.endDate] : [];
  termForm.isCurrent = row?.isCurrent || false;
  termDialog.value = true;
}
async function saveTerm() {
  if (!termForm.name.trim()) { ElMessage.warning('名称必填'); return; }
  saving.value = true;
  try {
    const payload = {
      name: termForm.name.trim(),
      startDate: termForm.range[0] || '',
      endDate: termForm.range[1] || '',
      weeksCount: termWeeks.value,
      isCurrent: termForm.isCurrent
    };
    if (termEditing.value) await termApi.update(termEditing.value.id, payload);
    else await termApi.create(payload);
    ElMessage.success('保存成功');
    termDialog.value = false;
    loadTerms();
  } catch (e) { ElMessage.error((e as Error).message || '保存失败'); } finally { saving.value = false; }
}
async function delTerm(row: AffairsTerm) {
  try { await ElMessageBox.confirm(`确定删除学期「${row.name}」吗？`, '确认删除', { type: 'warning' }); } catch { return; }
  try { await termApi.delete(row.id); ElMessage.success('删除成功'); loadTerms(); } catch (e) { ElMessage.error((e as Error).message || '删除失败'); }
}

// 场地
function openVenue(row?: Venue) {
  venueEditing.value = row || null;
  venueForm.name = row?.name || '';
  venueForm.type = row?.type || '教室';
  venueForm.capacity = row?.capacity;
  venueDialog.value = true;
}
async function saveVenue() {
  if (!venueForm.name.trim()) { ElMessage.warning('名称必填'); return; }
  saving.value = true;
  try {
    const payload = { name: venueForm.name.trim(), type: venueForm.type, capacity: venueForm.capacity };
    if (venueEditing.value) await venueApi.update(venueEditing.value.id, payload);
    else await venueApi.create(payload);
    ElMessage.success('保存成功');
    venueDialog.value = false;
    loadVenues();
  } catch (e) { ElMessage.error((e as Error).message || '保存失败'); } finally { saving.value = false; }
}
async function delVenue(row: Venue) {
  try { await ElMessageBox.confirm(`确定删除场地「${row.name}」吗？`, '确认删除', { type: 'warning' }); } catch { return; }
  try { await venueApi.delete(row.id); ElMessage.success('删除成功'); loadVenues(); } catch (e) { ElMessage.error((e as Error).message || '删除失败'); }
}

// 节次
function openPeriod(row?: PeriodSlot) {
  periodEditing.value = row || null;
  periodForm.name = row?.name || '';
  periodForm.type = row?.type || 'morning';
  periodForm.sortOrder = row?.sortOrder ?? 0;
  periodForm.startTime = row?.startTime || '';
  periodForm.endTime = row?.endTime || '';
  periodDialog.value = true;
}
async function savePeriod() {
  if (!periodForm.name.trim()) { ElMessage.warning('名称必填'); return; }
  saving.value = true;
  try {
    const payload = {
      name: periodForm.name.trim(),
      type: periodForm.type,
      sortOrder: periodForm.sortOrder,
      startTime: periodForm.startTime,
      endTime: periodForm.endTime
    };
    if (periodEditing.value) await periodSlotApi.update(periodEditing.value.id, payload);
    else await periodSlotApi.create(payload);
    ElMessage.success('保存成功');
    periodDialog.value = false;
    loadPeriods();
  } catch (e) { ElMessage.error((e as Error).message || '保存失败'); } finally { saving.value = false; }
}
async function delPeriod(row: PeriodSlot) {
  try { await ElMessageBox.confirm(`确定删除节次「${row.name}」吗？`, '确认删除', { type: 'warning' }); } catch { return; }
  try { await periodSlotApi.delete(row.id); ElMessage.success('删除成功'); loadPeriods(); } catch (e) { ElMessage.error((e as Error).message || '删除失败'); }
}

onMounted(() => {
  loadTerms();
  loadVenues();
  loadPeriods();
});
</script>

<style scoped>
.config-page { padding: 16px; }
.page-header { margin-bottom: 16px; }
.page-title { font-size: 20px; font-weight: 700; margin: 0; }
.page-sub { color: #909399; margin: 8px 0 0; }
.tab-actions { margin-bottom: 12px; display: flex; justify-content: flex-end; }
</style>
