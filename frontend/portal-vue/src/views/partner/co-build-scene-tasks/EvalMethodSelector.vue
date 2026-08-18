<template>
  <div class="eval-method-selector">
    <div class="primary-tabs">
      <el-button
        v-for="tab in primaryTabs"
        :key="tab.key"
        size="small"
        :type="primaryTab === tab.key ? 'primary' : 'default'"
        :plain="primaryTab !== tab.key"
        @click="primaryTab = tab.key; secondaryTab = '全部'"
      >
        {{ tab.label }}
      </el-button>
    </div>
    <div class="secondary-tabs">
      <el-button
        v-for="tab in secondaryTabs"
        :key="tab"
        size="small"
        :type="secondaryTab === tab ? 'primary' : 'default'"
        :plain="secondaryTab !== tab"
        @click="secondaryTab = tab"
      >
        {{ tab }}
      </el-button>
    </div>

    <div class="method-grid">
      <div
        v-for="m in filteredMethods"
        :key="m.key"
        class="method-card"
        :class="[!m.available ? 'disabled' : '', isEnabled(m.key) ? 'enabled' : '']"
        @click="toggle(m.key)"
      >
        <div v-if="!m.available" class="unavailable-mask">未开通</div>
        <div class="method-head">
          <div class="method-icon" :style="{ background: m.colorBg, color: m.color }">
            <el-icon :size="20"><component :is="m.icon" /></el-icon>
          </div>
          <div class="method-text">
            <p class="method-label">{{ m.label }}</p>
            <p class="method-desc">{{ m.desc }}</p>
          </div>
          <div class="method-state">
            <span v-if="isEnabled(m.key)" class="enabled-badge">
              <el-icon color="#409eff"><CircleCheckFilled /></el-icon> 已开通
            </span>
            <el-tag v-if="!m.available" size="small" type="info" disable-transitions>未开通</el-tag>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { evaluationMethodOptions } from './tasks-logic';

const props = defineProps<{
  value?: string[];
}>();
const emit = defineEmits<{
  (e: 'change', methods: string[]): void;
}>();

const primaryTab = ref<'platform' | 'industry'>('platform');
const secondaryTab = ref('全部');

const primaryTabs: { key: 'platform' | 'industry'; label: string }[] = [
  { key: 'platform', label: '平台通用' },
  { key: 'industry', label: '行业专属' }
];
const secondaryTabsMap: Record<string, string[]> = {
  platform: ['全部', '知识评价', '过程评价', '成果评价'],
  industry: ['全部', '智慧物流', '网络安全']
};

const secondaryTabs = computed(() => secondaryTabsMap[primaryTab.value]);
const filteredMethods = computed(() =>
  evaluationMethodOptions.filter((m) => {
    if (m.primaryCategory !== primaryTab.value) return false;
    if (secondaryTab.value === '全部') return true;
    return m.secondaryCategory === secondaryTab.value;
  })
);

function isEnabled(key: string): boolean {
  return (props.value || []).includes(key);
}

function toggle(key: string) {
  const opt = evaluationMethodOptions.find((o) => o.key === key);
  if (!opt || !opt.available) return;
  const enabled = isEnabled(key);
  const next = enabled
    ? (props.value || []).filter((m) => m !== key)
    : [...(props.value || []), key];
  emit('change', next);
}
</script>

<style scoped>
.primary-tabs {
  display: flex;
  gap: 8px;
  border-bottom: 1px solid #ebeef5;
  padding-bottom: 12px;
  margin-bottom: 12px;
}
.secondary-tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}
.method-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
}
.method-card {
  position: relative;
  overflow: hidden;
  border: 1px solid #dcdfe6;
  border-radius: 8px;
  padding: 10px;
  cursor: pointer;
  transition: all 0.2s;
  background: #fff;
}
.method-card.enabled {
  border-color: #409eff;
  box-shadow: 0 0 0 1px rgba(64, 158, 255, 0.2);
}
.method-card.disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.unavailable-mask {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 20;
  font-size: 20px;
  font-weight: bold;
  color: rgba(200, 200, 200, 0.7);
  transform: rotate(-12deg);
  border: 2px solid rgba(200, 200, 200, 0.4);
  border-radius: 4px;
  padding: 2px 12px;
}
.method-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  position: relative;
  z-index: 10;
}
.method-icon {
  padding: 8px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.method-text {
  flex: 1;
  min-width: 0;
}
.method-label {
  font-size: 14px;
  font-weight: 600;
  margin: 0;
}
.method-desc {
  font-size: 11px;
  color: #999;
  margin: 2px 0 0;
}
.enabled-badge {
  display: flex;
  align-items: center;
  gap: 4px;
  color: #409eff;
  font-size: 12px;
  font-weight: 500;
  background: #ecf5ff;
  padding: 2px 8px;
  border-radius: 999px;
  white-space: nowrap;
}
</style>
