<template>
  <div>
    <div v-if="certificates.length === 0" class="cc-empty">
      <el-icon :size="40"><Trophy /></el-icon>
      <p>暂无相关证书</p>
    </div>
    <template v-else>
      <div class="cc-count">共涉及 {{ certificates.length }} 个相关证书</div>
      <div class="cc-grid">
        <div v-for="(cert, i) in certificates" :key="cert.id" class="cc-card">
          <div
            class="cc-cover"
            :class="{ clickable: !!cert.imageUrl }"
            :style="cert.imageUrl ? { backgroundImage: `url('${cert.imageUrl}')` } : { background: GRADIENTS[i % GRADIENTS.length] }"
            @click="cert.imageUrl && openImage(cert.imageUrl)"
          >
            <div v-if="cert.imageUrl" class="cc-zoom"><el-icon><ZoomIn /></el-icon> 点击放大</div>
            <el-icon v-else :size="40" color="rgba(255,255,255,0.6)"><Trophy /></el-icon>
          </div>
          <div class="cc-body">
            <div class="cc-name">{{ cert.name }}</div>
            <div class="cc-meta"><el-icon><OfficeBuilding /></el-icon>{{ cert.description ? cert.description.slice(0, 20) : '官方认证' }}</div>
            <div v-if="cert.description" class="cc-desc">
              <p :class="['cc-desc-text', { clamped: !expanded[cert.id] }]">{{ cert.description }}</p>
              <button type="button" class="cc-toggle" @click="expanded[cert.id] = !expanded[cert.id]">
                {{ expanded[cert.id] ? '收起' : '展示' }}
              </button>
            </div>
            <a v-if="cert.url" :href="cert.url" target="_blank" rel="noreferrer" class="cc-link">查看证书详情</a>
            <span v-else class="cc-link disabled">暂无详情链接</span>
          </div>
        </div>
      </div>
    </template>

    <el-dialog v-model="imageDialogVisible" width="80%" align-center>
      <img :src="selectedImage || ''" alt="证书放大图" class="cc-preview-img" />
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue';
import { Trophy, ZoomIn, OfficeBuilding } from '@element-plus/icons-vue';
import type { PositionCertificate } from '../shared';

defineProps<{ certificates: PositionCertificate[] }>();

const GRADIENTS = [
  'linear-gradient(135deg, #3b82f6 0%, #60a5fa 100%)',
  'linear-gradient(135deg, #52c41a 0%, #73d13d 100%)',
  'linear-gradient(135deg, #f59e0b 0%, #ffc53d 100%)',
];

const expanded = reactive<Record<string, boolean>>({});
const selectedImage = ref<string | null>(null);
const imageDialogVisible = ref(false);

function openImage(url: string) {
  selectedImage.value = url;
  imageDialogVisible.value = true;
}
</script>

<style scoped>
.cc-empty { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 48px 0; color: #94a3b8; }
.cc-count { font-size: 14px; color: #64748b; margin-bottom: 20px; }
.cc-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
.cc-card { background: #fff; border-radius: 16px; border: 1px solid #f5f5f4; overflow: hidden; transition: box-shadow 0.3s, border-color 0.3s; }
.cc-card:hover { box-shadow: 0 4px 12px rgba(0,0,0,0.08); border-color: #d9d9d9; }
.cc-cover { height: 160px; display: flex; align-items: center; justify-content: center; color: #fff; background-size: cover; background-position: center; position: relative; }
.cc-cover.clickable { cursor: pointer; }
.cc-zoom { position: absolute; top: 8px; right: 8px; display: flex; align-items: center; gap: 4px; padding: 4px 6px; background: rgba(0,0,0,0.4); color: #fff; border-radius: 4px; font-size: 12px; pointer-events: none; }
.cc-body { padding: 20px; }
.cc-name { font-size: 16px; font-weight: 600; color: #1f2937; margin-bottom: 8px; }
.cc-meta { display: flex; align-items: center; gap: 8px; font-size: 13px; color: #64748b; margin-bottom: 12px; }
.cc-desc { position: relative; margin-bottom: 12px; }
.cc-desc-text { font-size: 13px; color: #64748b; line-height: 1.7; }
.cc-desc-text.clamped { display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
.cc-toggle { font-size: 12px; color: #409eff; font-weight: 500; background: none; border: none; cursor: pointer; padding: 0; margin-top: 4px; }
.cc-toggle:hover { text-decoration: underline; }
.cc-link { display: inline-flex; align-items: center; gap: 6px; padding: 6px 14px; border-radius: 6px; background: rgba(64,158,255,0.05); color: #409eff; font-size: 13px; text-decoration: none; transition: all 0.2s; }
.cc-link:hover { background: #409eff; color: #fff; }
.cc-link.disabled { background: #f5f5f5; color: #bfbfbf; cursor: not-allowed; }
.cc-preview-img { width: 100%; max-height: 80vh; object-fit: contain; }
@media (max-width: 992px) { .cc-grid { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 640px) { .cc-grid { grid-template-columns: 1fr; } }
</style>
