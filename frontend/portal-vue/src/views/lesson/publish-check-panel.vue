<template>
  <aside class="publish-panel">
    <div class="panel-body">
      <template v-if="!node">
        <div v-if="!hideEval" class="check-item" :class="evalCheck.passed ? '' : 'warn'">
          <span class="check-icon" :class="evalCheck.passed ? 'ok' : 'warn'">
            <el-icon v-if="evalCheck.passed" color="#67c23a"><CircleCheckFilled /></el-icon>
            <el-icon v-else color="#e6a23c"><WarningFilled /></el-icon>
          </span>
          <div class="check-text">
            <p class="check-label">节点评价规则</p>
            <p class="check-status" :class="evalCheck.passed ? 'ok-text' : 'warn-text'">{{ evalCheck.statusText }}</p>
          </div>
        </div>
        <p class="no-node-tip">请选择一个节点查看完整检查</p>
      </template>

      <template v-else>
        <div class="panel-head">
          <h3 class="panel-title">
            <el-icon color="#e6a23c"><CircleCheck /></el-icon>
            发布检查
          </h3>
          <span class="panel-count">共 {{ total }} 项</span>
        </div>
        <div class="check-list">
          <div v-for="item in results" :key="item.key" class="check-item" :class="item.passed ? '' : 'warn'">
            <span class="check-icon" :class="item.passed ? 'ok' : 'warn'">
              <el-icon v-if="item.passed" color="#67c23a"><CircleCheckFilled /></el-icon>
              <el-icon v-else color="#e6a23c"><WarningFilled /></el-icon>
            </span>
            <div class="check-text">
              <p class="check-label">{{ item.label }}</p>
              <p class="check-status" :class="item.passed ? 'ok-text' : 'warn-text'">{{ item.statusText }}</p>
            </div>
          </div>
        </div>
        <div class="panel-foot">
          <div class="progress-row">
            <span class="progress-dot" :class="allDone ? 'ok' : 'warn'" />
            <span class="progress-text">{{ completed }}/{{ total }} 项已完成</span>
          </div>
          <div class="progress-bar">
            <div class="progress-inner" :class="allDone ? 'ok' : 'warn'" :style="{ width: percent + '%' }" />
          </div>
          <p class="progress-tip">
            {{ allDone ? '💡 所有检查项已完成，可以发布课程' : `💡 建议完善${emptyLabels}，提升课程规划准确性` }}
          </p>
        </div>
      </template>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { SysNode } from './lesson-edit-utils';

const props = withDefaults(
  defineProps<{
    node: SysNode | undefined;
    hideEval?: boolean;
    hideDetailedDescription?: boolean;
  }>(),
  { node: undefined, hideEval: false, hideDetailedDescription: false }
);

interface CheckResult {
  key: string;
  label: string;
  passed: boolean;
  statusText: string;
}

const evalMethods = computed<string[]>(() => {
  if (!props.node) return [];
  const nodeEvalData = (props.node.evalData || {}) as {
    methods?: string[];
    evalRuleConfig?: Record<string, any>;
  };
  return (
    nodeEvalData.methods ||
    nodeEvalData.evalRuleConfig?.evaluationMethods ||
    []
  );
});

const evalCheck = computed<CheckResult>(() => {
  const passed = evalMethods.value.length > 0;
  return {
    key: 'nodeEval',
    label: '节点评价规则',
    passed,
    statusText: passed
      ? `已配置：${evalMethods.value.length} 种测评方式`
      : '未配置节点评价规则'
  };
});

const baseItems = computed<CheckResult[]>(() => {
  if (!props.node) return [];
  const n = props.node;
  const items: CheckResult[] = [
    {
      key: 'name',
      label: '节点名称',
      passed: !!n.name?.trim(),
      statusText: n.name?.trim() ? `已填写：${n.name}` : '未设置节点名称'
    },
    {
      key: 'goals',
      label: '学习目标',
      passed: !!n.teachingGoals?.trim(),
      statusText: (() => {
        const lines = (n.teachingGoals || '').split('\n').filter((l) => l.trim());
        return lines.length > 0 ? `已填写：${lines.length} 条目标` : '未设置学习目标';
      })()
    },
    {
      key: 'knowledge',
      label: '涉及知识点',
      passed: (n.knowledgePoints?.length ?? 0) > 0,
      statusText: `已关联：${n.knowledgePoints?.length ?? 0} 个知识点`
    },
    {
      key: 'duration',
      label: '预估课时',
      passed: typeof n.duration === 'number' && n.duration > 0,
      statusText: `已设置：${n.duration ?? 0} 课时`
    },
    {
      key: 'resources',
      label: '课程资源',
      passed: (n.resources?.length ?? 0) > 0,
      statusText: `已上传：${n.resources?.length ?? 0} 个文件`
    }
  ];
  if (!props.hideDetailedDescription) {
    items.push({
      key: 'detailedDescription',
      label: '详细描述',
      passed: !!n.detailedDescription?.trim(),
      statusText: n.detailedDescription?.trim()
        ? `已填写：${n.detailedDescription.length} 字符`
        : '未填写详细描述'
    });
  }
  return items;
});

const results = computed<CheckResult[]>(() => {
  const list = [...baseItems.value];
  if (!props.hideEval) list.push(evalCheck.value);
  return list;
});

const completed = computed(() => results.value.filter((r) => r.passed).length);
const total = computed(() => results.value.length);
const allDone = computed(() => completed.value === total.value && total.value > 0);
const percent = computed(() => (total.value > 0 ? Math.round((completed.value / total.value) * 100) : 0));
const emptyLabels = computed(() => results.value.filter((r) => !r.passed).map((r) => r.label).join('、'));
</script>

<style scoped>
.publish-panel {
  width: 250px;
  flex-shrink: 0;
}
.panel-body {
  background: #fff;
  border: 1px solid #f0f0f0;
  border-radius: 12px;
  padding: 16px;
  position: sticky;
  top: 12px;
}
.panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}
.panel-title {
  font-size: 14px;
  font-weight: 500;
  color: #303133;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 6px;
}
.panel-count {
  font-size: 12px;
  color: #c0c4cc;
}
.check-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.check-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 8px;
  border-radius: 8px;
}
.check-item.warn {
  background: #fdf6ec;
}
.check-icon {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  margin-top: 1px;
}
.check-icon.ok {
  background: #f0f9eb;
}
.check-icon.warn {
  background: #fdf6ec;
}
.check-text {
  flex: 1;
  min-width: 0;
}
.check-label {
  font-size: 12px;
  color: #303133;
  margin: 0;
}
.check-status {
  font-size: 10px;
  margin: 2px 0 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ok-text {
  color: #67c23a;
}
.warn-text {
  color: #e6a23c;
}
.no-node-tip {
  font-size: 13px;
  color: #c0c4cc;
  text-align: center;
  padding: 16px 0 8px;
  margin: 8px 0 0;
}
.panel-foot {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid #f0f0f0;
}
.progress-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}
.progress-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}
.progress-dot.ok {
  background: #67c23a;
}
.progress-dot.warn {
  background: #e6a23c;
}
.progress-text {
  font-size: 12px;
  color: #606266;
}
.progress-bar {
  height: 6px;
  background: #f5f7fa;
  border-radius: 3px;
  overflow: hidden;
}
.progress-inner {
  height: 100%;
  border-radius: 3px;
  transition: width 0.3s;
}
.progress-inner.ok {
  background: #67c23a;
}
.progress-inner.warn {
  background: #e6a23c;
}
.progress-tip {
  font-size: 10px;
  color: #c0c4cc;
  margin: 8px 0 0;
  line-height: 1.6;
}
</style>
