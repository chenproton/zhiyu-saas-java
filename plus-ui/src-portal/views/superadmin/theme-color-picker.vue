<template>
  <div class="theme-picker">
    <div class="tp-presets">
      <button
        v-for="preset in THEME_PRESETS"
        :key="preset"
        type="button"
        class="tp-swatch"
        :class="{ 'is-active': color.toLowerCase() === preset.toLowerCase() }"
        :style="{ backgroundColor: preset }"
        :title="preset"
        @click="emit('update:color', preset)"
      />
      <label class="tp-custom" title="自定义颜色">
        <input
          type="color"
          :value="valid ? color : '#000000'"
          class="tp-native-color"
          @input="onNativeColor"
        />
        +
      </label>
      <el-input
        :model-value="color"
        class="tp-hex"
        placeholder="#RRGGBB"
        @update:model-value="emit('update:color', $event)"
      />
      <span class="tp-hint">自定义色值</span>
    </div>

    <div class="tp-preview">
      <span class="tp-preview-label">预览：</span>
      <el-button size="small" :disabled="!valid" :style="{ backgroundColor: valid ? color : undefined }">
        主要按钮
      </el-button>
      <el-button size="small" plain :disabled="!valid" :style="valid ? { color } : undefined">
        次要按钮
      </el-button>
      <span class="tp-tag" :style="{ backgroundColor: valid ? color : '#909399' }">标签</span>
      <span class="tp-current">当前色值：<span class="tp-mono">{{ color }}</span></span>
    </div>

    <div class="tp-actions">
      <el-button size="small" type="primary" :loading="submitting" :disabled="!valid" @click="emit('submit', color)">
        {{ submitLabel || '保存并应用' }}
      </el-button>
      <el-button
        v-for="(item, idx) in secondary"
        :key="item.label"
        size="small"
        :disabled="item.disabled || submitting"
        @click="emit('secondary', idx)"
      >
        {{ item.label }}
      </el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { isHexColor } from '@/api/superadmin';

interface ThemeSecondaryAction {
  label: string;
  disabled?: boolean;
}

const props = withDefaults(
  defineProps<{
    color: string;
    submitting?: boolean;
    submitLabel?: string;
    secondary?: ThemeSecondaryAction[];
  }>(),
  { submitting: false, submitLabel: '', secondary: () => [] }
);

const emit = defineEmits<{
  (e: 'update:color', value: string): void;
  (e: 'submit', value: string): void;
  (e: 'secondary', index: number): void;
}>();

const THEME_PRESETS = ['#4862e4', '#1677ff', '#0b5bd0', '#0ea5e9', '#7c3aed', '#059669', '#ea580c'];

const valid = computed(() => isHexColor(props.color));

function onNativeColor(e: Event) {
  emit('update:color', (e.target as HTMLInputElement).value);
}
</script>

<style scoped>
.theme-picker {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.tp-presets {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}
.tp-swatch {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: none;
  cursor: pointer;
  transition: transform 0.15s ease;
}
.tp-swatch:hover {
  transform: scale(1.1);
}
.tp-swatch.is-active {
  box-shadow: 0 0 0 2px #fff, 0 0 0 4px rgba(0, 0, 0, 0.25);
}
.tp-custom {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 1px dashed #d0d5dd;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: #909399;
  font-size: 14px;
  position: relative;
}
.tp-custom:hover {
  border-color: #4862e4;
  color: #4862e4;
}
.tp-native-color {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  cursor: pointer;
}
.tp-hex {
  width: 120px;
}
.tp-hint {
  font-size: 12px;
  color: #909399;
}
.tp-preview {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border-radius: 8px;
  background: #f5f7fa;
}
.tp-preview-label {
  font-size: 12px;
  color: #909399;
}
.tp-tag {
  display: inline-flex;
  align-items: center;
  padding: 2px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 500;
  color: #fff;
}
.tp-current {
  font-size: 12px;
  color: #909399;
}
.tp-mono {
  font-family: monospace;
}
.tp-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}
</style>
