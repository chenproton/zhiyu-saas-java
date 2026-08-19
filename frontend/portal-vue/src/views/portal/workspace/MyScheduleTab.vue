<!--
  我的课表 Tab（学生/教师工作台共用，当前学期已发布课表）。
  对齐 React frontend/edu/app/portal/workspace/_components/my-schedule-tab.tsx
  （学期信息条 + 网格；后端 404「尚未配置学期」按空态处理；
   学生场景课跳场景学习并带排课 resourceVersion，教师跳场景/课程测评结果）。
-->
<template>
  <div class="my-schedule-tab">
    <!-- 学期信息 -->
    <div class="term-bar">
      <div>
        <h3 class="term-title">{{ term ? `${term.name}课表` : '我的课表' }}</h3>
        <p class="term-sub">
          <template v-if="term">
            {{ term.startDate }} 至 {{ term.endDate }} · 共 {{ term.weeksCount }} 周 · 仅显示已发布课表
          </template>
          <template v-else>仅显示当前学期已发布的课表</template>
        </p>
      </div>
      <span class="term-hint">
        {{ role === 'student' ? '带「场景」徽标的课程可点击进入场景学习' : '带「场景」徽标的课程可点击进入场景测评' }}
      </span>
    </div>

    <!-- 课表网格 -->
    <div class="grid-panel">
      <div v-if="empty" class="empty-block">
        <el-icon :size="40"><Calendar /></el-icon>
        <span>
          {{
            noTerm
              ? '学校尚未配置学期，课表发布后这里会展示你的课表'
              : '当前学期暂无已发布的课表，发布后即可查看'
          }}
        </span>
      </div>
      <ScheduleGrid
        v-else
        :entries="entries"
        :period-slots="periodSlots"
        :loading="loading"
        empty-text="当前学期暂无已发布的课表"
        :get-entry-href="getEntryHref"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { Calendar } from '@element-plus/icons-vue';
import { periodSlotApi } from '@/api/affairs';
import type { AffairsTerm, PeriodSlot, ScheduleEntry } from '@/types/affairs';
import ScheduleGrid from './ScheduleGrid.vue';
import { myScheduleApi } from './workspace-api';
import { lessonLandingHref, sceneLandingHref } from './workspace-utils';

const props = withDefaults(defineProps<{ role?: 'student' | 'teacher' }>(), { role: 'student' });

const loading = ref(true);
const noTerm = ref(false);
const term = ref<AffairsTerm | null>(null);
const entries = ref<ScheduleEntry[]>([]);
const periodSlots = ref<PeriodSlot[]>([]);

const empty = computed(() => !loading.value && (noTerm.value || entries.value.length === 0));

function getEntryHref(entry: ScheduleEntry): string | undefined {
  if (entry.type === 'scene' && entry.scenarioId) {
    // 学生入口带排课 stamp 的 resourceVersion（?v=），按班级绑定版本读快照
    return props.role === 'student'
      ? sceneLandingHref(entry.scenarioId, entry.resourceVersion)
      : '/evaluation/scene-results';
  }
  if (entry.type === 'traditional' && entry.courseId) {
    return props.role === 'student'
      ? lessonLandingHref(entry.courseId, entry.resourceVersion)
      : `/evaluation/lesson-results?courseId=${entry.courseId}`;
  }
  return undefined;
}

onMounted(async () => {
  loading.value = true;
  try {
    const [scheduleRes, slotRes] = await Promise.all([
      myScheduleApi.get(),
      periodSlotApi.list({ limit: 100 }).catch(() => ({ items: [] as PeriodSlot[], total: 0 }))
    ]);
    term.value = scheduleRes.term ?? null;
    entries.value = scheduleRes.items || [];
    periodSlots.value = slotRes.items || [];
  } catch (e) {
    // 后端 404：尚未配置学期，按空态处理；其余错误统一提示
    const msg = (e as Error).message || '';
    if (msg.includes('学期') || msg.includes('404')) {
      noTerm.value = true;
      term.value = null;
      entries.value = [];
      periodSlots.value = [];
    } else {
      ElMessage.error(msg || '加载课表失败');
    }
  } finally {
    loading.value = false;
  }
});
</script>

<style scoped>
.my-schedule-tab {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.term-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 16px;
  background: #fff;
  border: 1px solid #f3f4f6;
  border-radius: 12px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
}
.term-title {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: #111827;
}
.term-sub {
  margin: 2px 0 0;
  font-size: 12px;
  color: #6b7280;
}
.term-hint {
  font-size: 12px;
  color: #9ca3af;
}
.grid-panel {
  background: #fff;
  border: 1px solid #f3f4f6;
  border-radius: 12px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
  padding: 12px;
}
.empty-block {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 64px 0;
  font-size: 14px;
  color: #9ca3af;
}
</style>
