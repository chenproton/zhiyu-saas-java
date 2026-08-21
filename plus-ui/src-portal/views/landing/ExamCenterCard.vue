<template>
  <div class="cc-card">
    <!-- 封面 -->
    <div class="cc-cover" :style="coverStyle">
      <el-icon v-if="!coverImage" class="cc-cover-icon"><Notebook /></el-icon>
      <span class="cc-status-badge" :style="{ color: meta.color }">
        <span class="cc-status-dot" :style="{ background: meta.dot }" />
        {{ meta.label }}
      </span>
    </div>
    <div class="cc-body">
      <h3 class="cc-name" :title="item.usageName">{{ item.usageName }}</h3>
      <p class="cc-exam-name" :title="item.examName">试卷：{{ item.examName }}</p>
      <div class="cc-meta">
        <span class="cc-meta-item">
          <el-icon><Document /></el-icon>{{ item.questionCount }} 题
        </span>
        <span class="cc-meta-item">
          <el-icon><Clock /></el-icon>{{ item.duration ? `${item.duration} 分钟` : '不限时' }}
        </span>
        <span class="cc-meta-item cc-meta-time" :title="timeText">
          <el-icon><Calendar /></el-icon>{{ timeText }}
        </span>
      </div>
      <div class="cc-action">
        <div v-if="item.submitted" class="cc-submitted">
          <span>已交卷</span>
          <span v-if="item.score != null" class="cc-score">{{ item.score }}/{{ item.totalScore }} 分</span>
        </div>
        <router-link v-if="canEnter" :to="entryHref" class="cc-btn cc-btn-primary">
          <el-icon><VideoPlay /></el-icon>开始考试
        </router-link>
        <router-link v-else-if="item.submitted" :to="entryHref" class="cc-btn cc-btn-result">
          <el-icon><CircleCheck /></el-icon>查看结果
        </router-link>
        <button v-else class="cc-btn cc-btn-disabled" type="button" disabled>
          <el-icon><Lock /></el-icon>{{ disabledReason }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { EXAM_CENTER_STATUS_META, coverGradientFor, formatDate } from './evaluation-types';
import type { ExamCenterItem } from './evaluation-types';

const props = defineProps<{
  item: ExamCenterItem;
  coverImage?: string;
}>();

const meta = computed(
  () =>
    EXAM_CENTER_STATUS_META[props.item.status] || {
      label: props.item.status,
      color: '#64748b',
      dot: '#94a3b8'
    }
);

const coverStyle = computed(() =>
  props.coverImage
    ? {
        backgroundImage: `url('${props.coverImage}')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center'
      }
    : { background: coverGradientFor(props.item.id) }
);

const timeText = computed(() => {
  const it = props.item;
  if (it.startTime) {
    return it.endTime ? `${formatDate(it.startTime)} ~ ${formatDate(it.endTime)}` : formatDate(it.startTime);
  }
  return '不限时间';
});

const canEnter = computed(
  () => props.item.participatable && !props.item.submitted && props.item.status !== 'finished'
);

const disabledReason = computed(() => {
  const it = props.item;
  if (it.status === 'finished') return '考试已结束';
  if (!it.participatable && it.studentView) return '仅指定班级可参加';
  if (!it.participatable && !it.studentView) return '仅学生可参加';
  return '不可参加';
});

// 试卷版本由作答页按 usage.examVersion 服务端解析，链接只带 usage（对齐 React examHref）
const entryHref = computed(() => `/evaluation/landing/exams/${props.item.examId}?usage=${encodeURIComponent(props.item.id)}`);
</script>

<style scoped>
.cc-card {
  background: #fff;
  border: 1px solid #e7e5e4;
  border-radius: 14px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.04);
  transition: all 0.25s;
}
.cc-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.1);
}
.cc-cover {
  height: 96px;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  flex-shrink: 0;
}
.cc-cover-icon {
  font-size: 40px;
  color: rgba(255, 255, 255, 0.85);
}
.cc-status-badge {
  position: absolute;
  top: 12px;
  right: 12px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: rgba(255, 255, 255, 0.92);
  backdrop-filter: blur(4px);
  border: 1px solid rgba(255, 255, 255, 0.4);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 500;
}
.cc-status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}
.cc-body {
  padding: 14px;
  flex: 1;
  display: flex;
  flex-direction: column;
}
.cc-name {
  font-size: 14px;
  font-weight: 600;
  color: #1e293b;
  margin: 0 0 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.cc-exam-name {
  font-size: 12px;
  color: #94a3b8;
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.cc-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 14px;
  font-size: 11px;
  color: #94a3b8;
  padding: 10px 0;
  margin-top: 4px;
  border-bottom: 1px solid #f8fafc;
}
.cc-meta-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}
.cc-meta-item .el-icon {
  font-size: 12px;
}
.cc-meta-time {
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.cc-action {
  padding-top: 10px;
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  gap: 8px;
}
.cc-submitted {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: #64748b;
}
.cc-score {
  font-weight: 600;
  color: #16a34a;
}
.cc-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  width: 100%;
  height: 34px;
  border-radius: 10px;
  font-size: 12px;
  border: none;
  cursor: pointer;
  text-decoration: none;
  box-sizing: border-box;
}
.cc-btn-primary {
  background: linear-gradient(90deg, var(--el-color-primary), var(--el-color-primary-light-1));
  color: #fff;
  box-shadow: 0 2px 8px rgba(64, 158, 255, 0.25);
}
.cc-btn-primary:hover {
  opacity: 0.92;
}
.cc-btn-result {
  background: #fff;
  color: #16a34a;
  border: 1px solid #bbf7d0;
}
.cc-btn-result:hover {
  background: #f0fdf4;
}
.cc-btn-disabled {
  background: #f1f5f9;
  color: #94a3b8;
  cursor: not-allowed;
}
</style>
