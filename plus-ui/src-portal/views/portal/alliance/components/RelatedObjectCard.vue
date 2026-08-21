<template>
  <div class="roc">
    <router-link :to="href" class="roc-link">
      <div class="roc-cover" :style="coverStyle">
        <el-icon v-if="!item.coverImage" class="roc-icon"><component :is="icon" /></el-icon>
        <div class="roc-name">{{ item.name }}</div>
        <div v-if="item.code" class="roc-code">{{ codeLabel }}：{{ item.code }}</div>
      </div>
    </router-link>
    <slot />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { Briefcase, Grid, Reading, OfficeBuilding, Trophy, MagicStick } from '@element-plus/icons-vue';
import { coverGradientFor, type AllianceRelatedRef } from '../shared';

type RelatedKind = 'positions' | 'scenes' | 'courses' | 'brands' | 'enterprises' | 'achievements';

const props = defineProps<{ item: AllianceRelatedRef; kind: RelatedKind }>();

const KIND_META: Record<RelatedKind, { href: (id: string) => string; icon: any }> = {
  positions: { href: (id) => `/job/landing/${id}`, icon: Briefcase },
  scenes: { href: (id) => `/scene/landing/${id}`, icon: Grid },
  courses: { href: (id) => `/lesson/landing/${id}`, icon: Reading },
  brands: { href: (id) => `/portal/alliance/brands/${id}`, icon: MagicStick },
  enterprises: { href: (id) => `/portal/alliance/enterprises/${id}`, icon: OfficeBuilding },
  achievements: { href: (id) => `/portal/alliance/achievements/${id}`, icon: Trophy },
};

const meta = computed(() => KIND_META[props.kind]);
const href = computed(() => meta.value.href(props.item.id));
const icon = computed(() => meta.value.icon);
const coverStyle = computed(() =>
  props.item.coverImage
    ? { backgroundImage: `url('${props.item.coverImage}')` }
    : { background: coverGradientFor(props.item.id) },
);
const codeLabel = computed(() => {
  if (props.kind === 'positions') return '岗位编码';
  if (props.kind === 'scenes') return '场景编码';
  if (props.kind === 'courses') return '课程编码';
  return undefined;
});
</script>

<style scoped>
.roc { position: relative; background: #fff; border-radius: 16px; overflow: hidden; border: 1px solid #e7e5e4; transition: transform 0.3s, box-shadow 0.3s, border-color 0.3s; display: flex; flex-direction: column; }
.roc:hover { transform: translateY(-4px); box-shadow: 0 16px 40px rgba(0,0,0,0.1); border-color: rgba(64,158,255,0.3); }
.roc-link { display: block; text-decoration: none; color: inherit; }
.roc-cover { height: 112px; position: relative; background-size: cover; background-position: center; display: flex; flex-direction: column; justify-content: flex-end; padding: 12px; }
.roc-icon { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; color: rgba(255,255,255,0.85); }
.roc-name { position: relative; z-index: 10; font-size: 14px; font-weight: 700; line-height: 1.3; color: #fff; text-shadow: 0 1px 3px rgba(0,0,0,0.4); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.roc-code { position: relative; z-index: 10; font-size: 11px; color: rgba(255,255,255,0.85); text-shadow: 0 1px 2px rgba(0,0,0,0.3); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
</style>
