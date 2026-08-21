<template>
  <div class="mixed-tag-editor">
    <div class="tag-row">
      <el-input
        :model-value="props.text"
        size="small"
        class="name-input"
        :placeholder="placeholder || '输入评价维度'"
        @update:model-value="(v: string) => emit('change', { name: v })"
      />
      <el-tag
        v-for="kp in boundKnowledgePoints"
        :key="`kp-${kp.id}`"
        size="small"
        closable
        disable-transitions
        class="kp-tag"
        :title="kp.name"
        @close="removeKp(kp.id)"
      >
        {{ kp.name }}
      </el-tag>
      <el-tag
        v-for="ab in boundAbilityPoints"
        :key="`ab-${ab.id}`"
        size="small"
        closable
        disable-transitions
        type="warning"
        class="ab-tag"
        :title="ab.name"
        @close="removeAb(ab.id)"
      >
        {{ ab.name }}
      </el-tag>
    </div>
    <div class="link-row">
      <el-button link size="small" class="link-btn" @click="emit('open-kp')">关联考查知识点</el-button>
      <el-button link size="small" class="link-btn" @click="emit('open-ab')">关联考查能力点</el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * 评价维度名称 + 知识点/能力点标签混排编辑器。
 * 对齐 React @zhiyu/ui MixedTagEditor 的能力：编辑维度名称、展示/删除已绑定知识点与能力点标签、
 * 打开知识点/能力点关联弹窗。Vue 侧用 el-input + el-tag 组合替代 contentEditable 富文本混排，
 * 数据结构与回调语义完全一致（name / knowledgePointIds / abilityPointIds）。
 */
import { computed } from 'vue';

const props = defineProps<{
  text: string;
  knowledgePointIds?: string[];
  abilityPointIds?: string[];
  knowledgePoints: { id: string; name: string }[];
  abilityPoints: { id: string; name: string }[];
  placeholder?: string;
}>();

const emit = defineEmits<{
  (
    e: 'change',
    updates: { name?: string; knowledgePointIds?: string[]; abilityPointIds?: string[] }
  ): void;
  (e: 'open-kp'): void;
  (e: 'open-ab'): void;
}>();

function kpName(id: string): string {
  return props.knowledgePoints.find((k) => k.id === id)?.name || id;
}

function abName(id: string): string {
  return props.abilityPoints.find((a) => a.id === id)?.name || id;
}

// 与 React MixedTagEditor 一致：池中查不到的 id 不渲染标签（数据仍保留在配置里）
const boundKnowledgePoints = computed(() =>
  (props.knowledgePointIds || [])
    .map((id) => props.knowledgePoints.find((k) => k.id === id))
    .filter(Boolean) as { id: string; name: string }[]
);

const boundAbilityPoints = computed(() =>
  (props.abilityPointIds || [])
    .map((id) => props.abilityPoints.find((a) => a.id === id))
    .filter(Boolean) as { id: string; name: string }[]
);

function removeKp(id: string) {
  emit('change', { knowledgePointIds: (props.knowledgePointIds || []).filter((x) => x !== id) });
}

function removeAb(id: string) {
  emit('change', { abilityPointIds: (props.abilityPointIds || []).filter((x) => x !== id) });
}
</script>

<style scoped>
.mixed-tag-editor {
  border: 1px solid #dcdfe6;
  border-radius: 6px;
  padding: 6px;
  background: #fff;
}
.tag-row {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  align-items: center;
}
.name-input {
  flex: 1;
  min-width: 140px;
}
.name-input :deep(.el-input__wrapper) {
  box-shadow: none;
  padding: 0 4px;
}
.kp-tag,
.ab-tag {
  max-width: 140px;
}
.link-row {
  display: flex;
  gap: 8px;
  margin-top: 2px;
}
.link-btn {
  font-size: 11px;
  color: #909399;
}
.link-btn:hover {
  color: #409eff;
}
</style>
