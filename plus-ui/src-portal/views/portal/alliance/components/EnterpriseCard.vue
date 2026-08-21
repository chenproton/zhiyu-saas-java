<template>
  <router-link :to="`/portal/alliance/enterprises/${enterprise.id}`" class="acard">
    <div class="acard-cover">
      <img v-if="enterprise.coverImage" :src="enterprise.coverImage" :alt="enterprise.name" class="cover-img" />
      <GradientPlaceholder v-else :seed="enterprise.industry" :label="enterprise.name" class="cover-img" />
      <div class="cover-overlay" />
      <div class="cover-body">
        <div class="cover-logo">
          <img v-if="enterprise.logoUrl" :src="enterprise.logoUrl" :alt="enterprise.name" />
          <span v-else class="cover-logo-fallback">{{ getInitials(enterprise.name) }}</span>
        </div>
        <div class="cover-text">
          <h4 class="cover-title">{{ enterprise.name }}</h4>
          <p class="cover-sub">{{ subline }}</p>
        </div>
      </div>
    </div>
    <div class="acard-content">
      <p class="acard-desc">{{ enterprise.description || '暂无企业简介' }}</p>
      <div class="acard-stats">
        <div class="stat"><p class="stat-v">{{ enterprise.projectCount ?? 0 }}</p><p class="stat-l">合作项目</p></div>
        <div class="stat"><p class="stat-v">{{ enterprise.agreementCount ?? 0 }}</p><p class="stat-l">合作协议</p></div>
        <div class="stat"><p class="stat-v">{{ enterprise.achievementCount ?? 0 }}</p><p class="stat-l">合作成果</p></div>
      </div>
    </div>
  </router-link>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import GradientPlaceholder from './GradientPlaceholder.vue';
import { getInitials, type AllianceEnterprise } from '../shared';

const props = defineProps<{ enterprise: AllianceEnterprise }>();

const subline = computed(() => {
  return [props.enterprise.industry, props.enterprise.region].filter(Boolean).join(' · ') || '合作企业';
});
</script>

<style scoped>
.acard {
  display: flex;
  flex-direction: column;
  background: #fff;
  border: 1px solid #e7e5e4;
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  transition: transform 0.3s, box-shadow 0.3s, border-color 0.3s;
  text-decoration: none;
  color: inherit;
  height: 100%;
}
.acard:hover {
  transform: translateY(-8px);
  box-shadow: 0 20px 48px rgba(0, 0, 0, 0.1);
  border-color: rgba(64, 158, 255, 0.3);
}
.acard-cover { position: relative; aspect-ratio: 16 / 9; overflow: hidden; background: #1e293b; }
.cover-img { width: 100%; height: 100%; object-fit: cover; transition: transform 0.5s; }
.acard:hover .cover-img { transform: scale(1.05); }
.cover-overlay { position: absolute; inset: 0; background: linear-gradient(to top, rgba(0,0,0,0.7), rgba(0,0,0,0.2), transparent); }
.cover-body { position: absolute; bottom: 16px; left: 16px; right: 16px; display: flex; align-items: center; gap: 12px; }
.cover-logo { width: 48px; height: 48px; border-radius: 12px; border: 2px solid rgba(255,255,255,0.8); background: #fff; box-shadow: 0 2px 8px rgba(0,0,0,0.15); overflow: hidden; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.cover-logo img { width: 100%; height: 100%; object-fit: cover; }
.cover-logo-fallback { font-weight: 700; font-size: 14px; color: #1e293b; }
.cover-text { min-width: 0; flex: 1; }
.cover-title { font-weight: 600; color: #fff; font-size: 16px; line-height: 1.2; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.cover-sub { color: rgba(255,255,255,0.85); font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.acard-content { padding: 20px; flex: 1; display: flex; flex-direction: column; }
.acard-desc { font-size: 14px; color: #475569; line-height: 1.6; margin-bottom: 16px; min-height: 2.6em; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.acard-stats { margin-top: auto; display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; padding-top: 14px; border-top: 1px solid #f1f5f9; }
.stat { text-align: center; min-width: 0; }
.stat-v { font-size: 16px; font-weight: 700; color: #1e293b; line-height: 1.2; }
.stat-l { font-size: 11px; color: #94a3b8; margin-top: 2px; }
</style>
