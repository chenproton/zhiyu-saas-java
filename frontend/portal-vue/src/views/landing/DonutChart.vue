<template>
  <div class="donut" :style="{ width: size + 'px', height: size + 'px' }">
    <div class="donut-body" :style="bodyStyle">
      <div class="donut-hole" :style="holeStyle">
        <slot />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

export interface DonutSlice {
  name: string;
  value: number;
  color: string;
}

const props = withDefaults(
  defineProps<{
    data: DonutSlice[];
    size?: number;
    thickness?: number;
  }>(),
  { size: 140, thickness: 18 }
);

// 用 conic-gradient 绘制环形图，避免引入 echarts 等新依赖；
// 数据为空时渲染浅灰圆环。
const bodyStyle = computed(() => {
  const total = props.data.reduce((s, d) => s + d.value, 0);
  if (total <= 0) {
    return { background: '#f1f5f9' };
  }
  let acc = 0;
  const stops: string[] = [];
  for (const d of props.data) {
    const start = (acc / total) * 100;
    acc += d.value;
    const end = (acc / total) * 100;
    stops.push(`${d.color} ${start}% ${end}%`);
  }
  return { background: `conic-gradient(${stops.join(',')})` };
});

const holeStyle = computed(() => {
  const hole = Math.max(0, props.size - props.thickness * 2);
  return { width: hole + 'px', height: hole + 'px' };
});
</script>

<style scoped>
.donut {
  display: flex;
  align-items: center;
  justify-content: center;
}
.donut-body {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}
.donut-hole {
  border-radius: 50%;
  background: #fff;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}
</style>
