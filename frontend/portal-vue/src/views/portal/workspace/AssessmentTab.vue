<!--
  测评认证 Tab：岗位能力认定结果表 + 参与的日常考试与期末测评清单 + 能力点认定明细弹窗。
  对齐 React frontend/edu/app/portal/workspace/_components/assessment-tab.tsx
  （结果表 9 列含达成率/胜任度/认证得分；考试清单按 全部/待考/进行中/已完成 筛选；
   明细弹窗带请求序号守卫，避免连续点击后旧明细覆盖新选择）。
-->
<template>
  <div class="assessment-tab">
    <!-- ===== 岗位能力认定结果 ===== -->
    <SectionCard title="岗位能力认定结果" :icon="Trophy" icon-color="amber">
      <el-table :data="results" v-loading="resultsLoading" size="small" empty-text="暂无岗位能力认定结果">
        <el-table-column prop="positionName" label="岗位名称" min-width="140" />
        <el-table-column prop="studentName" label="姓名" width="100" />
        <el-table-column prop="studentId" label="学号" width="120" />
        <el-table-column label="所属院系" min-width="120">
          <template #default="{ row }">{{ row.department || '-' }}</template>
        </el-table-column>
        <el-table-column label="班级" min-width="110">
          <template #default="{ row }">{{ row.className || '-' }}</template>
        </el-table-column>
        <el-table-column label="岗位能力达成率" width="130">
          <template #default="{ row }">
            <strong>{{ achievementPercent(row) }}</strong>
          </template>
        </el-table-column>
        <el-table-column label="岗位胜任度" width="110">
          <template #default="{ row }">
            {{ row.positionCompetency != null ? `${row.positionCompetency.toFixed(1)}%` : '-' }}
          </template>
        </el-table-column>
        <el-table-column label="能力认证得分" width="120">
          <template #default="{ row }">
            {{ row.abilityCognitionScore != null ? row.abilityCognitionScore.toFixed(1) : '-' }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="110" align="right">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="openDetail(row.id)">
              <el-icon><View /></el-icon>查看明细
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </SectionCard>

    <!-- ===== 参与的考试/测评清单 ===== -->
    <SectionCard title="参与的日常考试与期末测评" :icon="DocumentChecked" icon-color="blue">
      <el-radio-group v-model="examFilter" size="small" class="filter-row">
        <el-radio-button value="all">全部</el-radio-button>
        <el-radio-button value="待考">待考</el-radio-button>
        <el-radio-button value="进行中">进行中</el-radio-button>
        <el-radio-button value="已完成">已完成</el-radio-button>
      </el-radio-group>

      <el-table :data="filteredExams" v-loading="loading" size="small" empty-text="暂无记录">
        <el-table-column label="序号" width="64">
          <template #default="{ $index }">{{ $index + 1 }}</template>
        </el-table-column>
        <el-table-column label="考试名称" min-width="200">
          <template #default="{ row }">
            <span class="exam-name">
              <el-icon><component :is="examTypeIcon(row.type)" /></el-icon>{{ row.name }}
            </span>
          </template>
        </el-table-column>
        <el-table-column prop="type" label="类型" width="120" />
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <span class="status-badge" :style="statusStyle(row.status)">
              {{ getStatusConfig(row.status).label }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="时间" min-width="200">
          <template #default="{ row }">
            <template v-if="row.startTime || row.endTime">
              {{ row.startTime || '-' }}{{ row.endTime ? ` ~ ${row.endTime}` : '' }}
            </template>
            <template v-else>-</template>
          </template>
        </el-table-column>
        <el-table-column label="时长" width="90">
          <template #default="{ row }">{{ row.duration }}分钟</template>
        </el-table-column>
        <el-table-column label="结果" width="100" align="right">
          <template #default="{ row }">
            <span v-if="row.score !== undefined" class="score">{{ row.score }}/{{ row.totalScore }}</span>
            <span v-else class="score-empty">-</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="90" align="right">
          <template #default="{ row }">
            <el-button
              link
              type="primary"
              size="small"
              @click="goExam(row)"
            >
              {{ row.status === '已完成' ? '查看' : '进入' }}
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </SectionCard>

    <!-- ===== 能力点认定明细弹窗 ===== -->
    <el-dialog v-model="detailOpen" title="能力点认定明细" width="720px">
      <p class="dialog-desc">
        {{ detail ? `${detail.studentName}（${detail.studentId}）· ${detail.positionName}` : '加载中...' }}
      </p>
      <div v-if="detailLoading" class="dialog-empty">加载中...</div>
      <template v-else-if="detail">
        <div class="detail-summary">
          <span>能力点达成 {{ detail.achievedAbilityPoints }}/{{ detail.totalAbilityPoints }}</span>
          <span>达标率 {{ (detail.achievementRate ?? 0).toFixed(1) }}%</span>
          <span>认定时间 {{ formatTime(detail.evaluationTime) }}</span>
        </div>
        <el-table
          v-if="detail.abilityPointDetails && detail.abilityPointDetails.length > 0"
          :data="detail.abilityPointDetails"
          size="small"
          max-height="50vh"
        >
          <el-table-column prop="abilityPointName" label="能力点" min-width="180" />
          <el-table-column label="得分" width="100">
            <template #default="{ row }">
              {{ row.maxScore != null ? `${row.score}/${row.maxScore}` : row.score }}
            </template>
          </el-table-column>
          <el-table-column label="档位" width="110">
            <template #default="{ row }">
              <el-tag
                v-if="row.levelLabel"
                size="small"
                :type="row.levelLabel === '未达标' ? 'danger' : 'primary'"
                effect="light"
              >
                {{ row.levelLabel }}
              </el-tag>
              <template v-else>-</template>
            </template>
          </el-table-column>
          <el-table-column label="权重" width="100">
            <template #default="{ row }">{{ row.weight != null ? `${row.weight}%` : '-' }}</template>
          </el-table-column>
          <el-table-column label="是否达成" width="110">
            <template #default="{ row }">
              <el-tag size="small" :type="row.achieved ? 'success' : 'danger'" effect="light">
                {{ row.achieved ? '已达成' : '未达成' }}
              </el-tag>
            </template>
          </el-table-column>
        </el-table>
        <div v-else class="dialog-empty">暂无能力点明细</div>
      </template>
      <div v-else class="dialog-empty">未找到结果明细</div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import type { Component } from 'vue';
import { DocumentChecked, School, Trophy, View } from '@element-plus/icons-vue';
import { jobAbilityResultApi } from '@/api/evaluation';
import type { JobAbilityResult } from '@/types/evaluation';
import SectionCard from './SectionCard.vue';
import { workspaceDashboardApi } from './workspace-api';
import type { WorkspaceExam } from './workspace-api';
import { examHref, getStatusConfig } from './workspace-utils';
import { formatDateTime } from '@/views/landing/evaluation-types';

const router = useRouter();

const TYPE_ICONS: Record<string, Component> = {
  随堂测: DocumentChecked,
  单元测试: DocumentChecked,
  在线测评: School,
  岗位能力认定: Trophy
};

const exams = ref<WorkspaceExam[]>([]);
const loading = ref(true);
const examFilter = ref('all');

const results = ref<JobAbilityResult[]>([]);
const resultsLoading = ref(true);
const detailOpen = ref(false);
const detailLoading = ref(false);
const detail = ref<JobAbilityResult | null>(null);
// 请求序号守卫：连续点击不同行时丢弃过期响应，避免旧明细覆盖新选择
let detailSeq = 0;

const filteredExams = computed(() =>
  examFilter.value === 'all' ? exams.value : exams.value.filter((e) => e.status === examFilter.value)
);

function examTypeIcon(type: string): Component {
  return TYPE_ICONS[type] || DocumentChecked;
}

function statusStyle(status: string) {
  const cfg = getStatusConfig(status);
  return { color: cfg.color, background: cfg.bg };
}

function achievementPercent(row: JobAbilityResult): string {
  return row.totalAbilityPoints > 0
    ? `${((row.achievedAbilityPoints / row.totalAbilityPoints) * 100).toFixed(0)}%`
    : '-';
}

function formatTime(value: string | Date | undefined): string {
  if (!value) return '-';
  return formatDateTime(value instanceof Date ? value.toISOString() : value);
}

function goExam(exam: WorkspaceExam) {
  // 试卷版本由作答页按 usage.examVersion 服务端解析，链接只带 usage
  if (!exam.examId) return;
  router.push(examHref(exam.examId, { usage: exam.id }));
}

async function openDetail(id: string) {
  const seq = ++detailSeq;
  detailOpen.value = true;
  detailLoading.value = true;
  detail.value = null;
  try {
    const res = await jobAbilityResultApi.get(id);
    if (seq !== detailSeq) return;
    detail.value = res;
  } catch {
    // 明细加载失败保持弹窗打开，展示兜底文案
  } finally {
    if (seq === detailSeq) detailLoading.value = false;
  }
}

onMounted(async () => {
  loading.value = true;
  try {
    const res = await workspaceDashboardApi.get({ role: 'student' });
    exams.value = res.exams || [];
  } catch {
    exams.value = [];
  } finally {
    loading.value = false;
  }

  // 岗位能力认定结果：学生仅可查看本人的认定结果（后端按角色过滤）
  resultsLoading.value = true;
  try {
    const res = await jobAbilityResultApi.list({ page: 1, limit: 50 });
    results.value = res.items || [];
  } catch {
    results.value = [];
  } finally {
    resultsLoading.value = false;
  }
});
</script>

<style scoped>
.assessment-tab {
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.filter-row {
  margin-bottom: 16px;
}
.exam-name {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-weight: 500;
}
.status-badge {
  display: inline-flex;
  align-items: center;
  border-radius: 4px;
  padding: 2px 6px;
  font-size: 10px;
  font-weight: 500;
}
.score {
  color: #059669;
  font-weight: 600;
}
.score-empty {
  color: #9ca3af;
}
.dialog-desc {
  margin: 0 0 12px;
  font-size: 13px;
  color: #6b7280;
}
.detail-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  margin-bottom: 16px;
  font-size: 13px;
  color: #6b7280;
}
.dialog-empty {
  padding: 40px 0;
  text-align: center;
  font-size: 14px;
  color: #9ca3af;
}
</style>
