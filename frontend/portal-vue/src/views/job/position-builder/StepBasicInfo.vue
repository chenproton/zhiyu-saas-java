<template>
  <!-- 步骤一：岗位基础信息（逐项对齐 React components/job/position-builder/step-basic-info.tsx） -->
  <div class="step-basic">
    <!-- AI 辅助编写入口（仅 aiMode） -->
    <div v-if="aiMode" class="ai-entry">
      <div>
        <h2 class="ai-entry-title">岗位基础信息</h2>
        <p class="ai-entry-sub">填写基础信息后，点击「AI 辅助编写」让大模型帮您润色、补齐与条目化</p>
      </div>
      <el-button plain class="ai-btn" :disabled="pipeline.isRunning.value" @click="startAiAssist">
        <el-icon><MagicStick /></el-icon>
        AI 辅助编写
      </el-button>
    </div>

    <!-- AI 覆盖内容常驻撤销横幅 -->
    <div v-if="aiMode && updatedCount > 0" class="ai-banner">
      <div class="ai-banner-text">
        <el-icon><MagicStick /></el-icon>
        <span>AI 已更新 {{ updatedCount }} 项内容，可逐项恢复上版或全部撤销</span>
      </div>
      <el-button size="small" plain class="ai-btn" @click="handleRestoreAll">
        <el-icon><RefreshLeft /></el-icon>
        全部撤销
      </el-button>
    </div>

    <!-- 基本信息 -->
    <el-card shadow="never" class="block-card" :class="{ 'ai-flash': basicFlash }">
      <template #header><span class="card-title">基本信息</span></template>

      <div class="grid-2">
        <div class="field" :class="{ 'ai-flash': flashKey === 'name' }">
          <div class="field-label">
            <span>岗位名称</span>
            <span v-if="aiMode" class="field-ai">
              <template v-if="aiUpdated('name')">
                <el-tag size="small" class="ai-tag">已更新</el-tag>
                <el-button text size="small" class="ai-link" @click="restoreField('name')">
                  <el-icon><RefreshLeft /></el-icon>恢复上版
                </el-button>
              </template>
              <el-button
                text
                size="small"
                class="ai-link"
                title="AI 生成"
                :disabled="pipeline.isRunning.value"
                @click="handlePolishField('name')"
              >
                <el-icon :class="{ 'is-loading': polishRunning }"><MagicStick /></el-icon>
              </el-button>
            </span>
          </div>
          <el-input
            :model-value="position.name"
            placeholder="例如：Java 后端开发工程师"
            @update:model-value="(v: string) => emit('update', { name: v })"
          />
        </div>

        <div class="field" :class="{ 'ai-flash': flashKey === 'shortName' }">
          <div class="field-label">
            <span>岗位简称</span>
            <span v-if="aiMode" class="field-ai">
              <template v-if="aiUpdated('shortName')">
                <el-tag size="small" class="ai-tag">已更新</el-tag>
                <el-button text size="small" class="ai-link" @click="restoreField('shortName')">
                  <el-icon><RefreshLeft /></el-icon>恢复上版
                </el-button>
              </template>
              <el-button
                text
                size="small"
                class="ai-link"
                title="AI 生成"
                :disabled="pipeline.isRunning.value"
                @click="handlePolishField('shortName')"
              >
                <el-icon :class="{ 'is-loading': polishRunning }"><MagicStick /></el-icon>
              </el-button>
            </span>
          </div>
          <el-input
            :model-value="position.shortName"
            placeholder="例如：Java开发"
            @update:model-value="(v: string) => emit('update', { shortName: v })"
          />
        </div>
      </div>

      <div class="grid-2">
        <template v-if="showIndustryMajor">
          <div class="field">
            <div class="field-label"><span>面向行业</span></div>
            <el-select
              :model-value="position.industry || ''"
              filterable
              clearable
              :placeholder="optionsLoading ? '加载中...' : '选择行业'"
              style="width: 100%"
              @update:model-value="(v: string) => emit('update', { industry: v || '' })"
            >
              <el-option v-for="i in industries" :key="i.id" :label="i.name" :value="i.id" />
            </el-select>
          </div>
          <div class="field">
            <div class="field-label"><span>适用专业</span></div>
            <el-select
              :model-value="position.majors"
              multiple
              filterable
              collapse-tags
              collapse-tags-tooltip
              :placeholder="optionsLoading ? '加载中...' : '选择专业'"
              style="width: 100%"
              @update:model-value="(v: string[]) => emit('update', { majors: v })"
            >
              <el-option v-for="m in majors" :key="m.id" :label="m.name" :value="m.id" />
            </el-select>
          </div>
        </template>
        <div v-if="!hidePositionType" class="field">
          <div class="field-label"><span>岗位类型</span></div>
          <el-select
            :model-value="position.positionType"
            :disabled="lockedPositionType"
            style="width: 100%"
            @update:model-value="(v: PositionType) => emit('update', { positionType: v })"
          >
            <el-option label="企业岗位" value="enterprise" />
            <el-option label="教学岗位" value="teaching" />
          </el-select>
          <p v-if="lockedPositionType" class="field-hint">
            独立岗位固定为企业岗位，仅在本模块展示，不进入职业岗位库
          </p>
        </div>
      </div>

      <div class="field" :class="{ 'ai-flash': flashKey === 'salaryRange' }">
        <div class="field-label">
          <span>薪资范围（元/月）</span>
          <span v-if="aiMode" class="field-ai">
            <template v-if="aiUpdated('salaryRange')">
              <el-tag size="small" class="ai-tag">已更新</el-tag>
              <el-button text size="small" class="ai-link" @click="restoreField('salaryRange')">
                <el-icon><RefreshLeft /></el-icon>恢复上版
              </el-button>
            </template>
            <el-button
              text
              size="small"
              class="ai-link"
              title="AI 生成"
              :disabled="pipeline.isRunning.value"
              @click="handlePolishField('salaryRange')"
            >
              <el-icon :class="{ 'is-loading': polishRunning }"><MagicStick /></el-icon>
            </el-button>
          </span>
        </div>
        <div class="salary-row">
          <el-input
            :model-value="String(position.salaryRange[0] ?? 0)"
            type="number"
            placeholder="最低"
            class="salary-input"
            @update:model-value="(v: string) => emit('update', { salaryRange: [Number(v) || 0, position.salaryRange[1]] })"
          >
            <template #suffix>¥</template>
          </el-input>
          <span class="sep">-</span>
          <el-input
            :model-value="String(position.salaryRange[1] ?? 0)"
            type="number"
            placeholder="最高"
            class="salary-input"
            @update:model-value="(v: string) => emit('update', { salaryRange: [position.salaryRange[0], Number(v) || 0] })"
          >
            <template #suffix>¥</template>
          </el-input>
        </div>
      </div>

      <div class="field" :class="{ 'ai-flash': flashKey === 'description' }">
        <div class="field-label">
          <span>岗位背景介绍</span>
          <span v-if="aiMode" class="field-ai">
            <template v-if="aiUpdated('description')">
              <el-tag size="small" class="ai-tag">已更新</el-tag>
              <el-button text size="small" class="ai-link" @click="restoreField('description')">
                <el-icon><RefreshLeft /></el-icon>恢复上版
              </el-button>
            </template>
            <el-button
              text
              size="small"
              class="ai-link"
              title="AI 生成"
              :disabled="pipeline.isRunning.value"
              @click="handlePolishField('description')"
            >
              <el-icon :class="{ 'is-loading': polishRunning }"><MagicStick /></el-icon>
            </el-button>
          </span>
        </div>
        <el-input
          :model-value="position.description"
          type="textarea"
          :rows="4"
          placeholder="描述该岗位的主要工作内容和特点..."
          @update:model-value="(v: string) => emit('update', { description: v })"
        />
      </div>
    </el-card>

    <el-alert v-if="aiNotice" type="warning" :closable="false" show-icon class="ai-notice">
      {{ aiNotice }}
    </el-alert>

    <!-- 工作职责 -->
    <el-card shadow="never" class="block-card" :class="{ 'ai-flash': flashKey === 'responsibilities' }">
      <template #header>
        <div class="card-header">
          <span class="card-title">工作职责</span>
          <span v-if="aiMode" class="section-ai">
            <template v-if="aiUpdated('responsibilities')">
              <el-tag size="small" class="ai-tag">AI 已更新</el-tag>
              <el-button text size="small" class="ai-link" @click="restoreField('responsibilities')">
                <el-icon><RefreshLeft /></el-icon>恢复上版
              </el-button>
            </template>
            <el-button
              size="small"
              plain
              class="ai-btn"
              :disabled="pipeline.isRunning.value"
              @click="handleWriteResponsibilities"
            >
              <el-icon :class="{ 'is-loading': sectionRunning('responsibilities') }"><MagicStick /></el-icon>
              重新生成
            </el-button>
          </span>
        </div>
      </template>
      <div class="row-list">
        <div v-for="(item, index) in position.responsibilities" :key="item.id" class="row-item">
          <el-tag class="row-index" type="info" effect="plain">{{ index + 1 }}</el-tag>
          <el-input
            :model-value="item.name"
            type="textarea"
            :rows="1"
            :autosize="{ minRows: 1, maxRows: 4 }"
            :data-focus-id="item.id"
            @update:model-value="(v: string) => updateResponsibility(index, v)"
            @keydown.enter.exact="onEnterAdd($event as KeyboardEvent, 'resp')"
          />
          <el-button text class="row-del" @click="removeResponsibility(index)">
            <el-icon><Close /></el-icon>
          </el-button>
        </div>
        <el-button class="add-row" @click="addResponsibility()">
          <el-icon><Plus /></el-icon>
          添加工作职责
        </el-button>
      </div>
    </el-card>

    <!-- 任职要求 -->
    <el-card shadow="never" class="block-card" :class="{ 'ai-flash': flashKey === 'requirements' }">
      <template #header>
        <div class="card-header">
          <span class="card-title">任职要求</span>
          <span v-if="aiMode" class="section-ai">
            <template v-if="aiUpdated('requirements')">
              <el-tag size="small" class="ai-tag">AI 已更新</el-tag>
              <el-button text size="small" class="ai-link" @click="restoreField('requirements')">
                <el-icon><RefreshLeft /></el-icon>恢复上版
              </el-button>
            </template>
            <el-button
              size="small"
              plain
              class="ai-btn"
              :disabled="pipeline.isRunning.value"
              @click="handleWriteRequirements"
            >
              <el-icon :class="{ 'is-loading': sectionRunning('requirements') }"><MagicStick /></el-icon>
              重新生成
            </el-button>
          </span>
        </div>
      </template>
      <div class="row-list">
        <div v-for="(item, index) in position.requirements" :key="reqIds[index] ?? `req-fallback-${index}`" class="row-item">
          <el-tag class="row-index" type="info" effect="plain">{{ index + 1 }}</el-tag>
          <el-input
            :model-value="item"
            type="textarea"
            :rows="1"
            :autosize="{ minRows: 1, maxRows: 4 }"
            :data-focus-id="reqIds[index] ?? `req-fallback-${index}`"
            @update:model-value="(v: string) => updateRequirement(index, v)"
            @keydown.enter.exact="onEnterAdd($event as KeyboardEvent, 'req')"
          />
          <el-button text class="row-del" @click="removeRequirement(index)">
            <el-icon><Close /></el-icon>
          </el-button>
        </div>
        <el-button class="add-row" @click="addRequirement()">
          <el-icon><Plus /></el-icon>
          添加任职要求
        </el-button>
      </div>
    </el-card>

    <!-- 发展路径 -->
    <el-card shadow="never" class="block-card" :class="{ 'ai-flash': flashKey === 'careerPath' }">
      <template #header>
        <div class="card-header">
          <span class="card-title">发展路径</span>
          <span v-if="aiMode" class="section-ai">
            <template v-if="aiUpdated('careerPath')">
              <el-tag size="small" class="ai-tag">AI 已更新</el-tag>
              <el-button text size="small" class="ai-link" @click="restoreField('careerPath')">
                <el-icon><RefreshLeft /></el-icon>恢复上版
              </el-button>
            </template>
            <el-button
              size="small"
              plain
              class="ai-btn"
              :disabled="pipeline.isRunning.value"
              @click="handleWriteCareerPath"
            >
              <el-icon :class="{ 'is-loading': sectionRunning('careerPath') }"><MagicStick /></el-icon>
              重新生成
            </el-button>
          </span>
        </div>
      </template>
      <el-input
        :model-value="position.careerPath"
        type="textarea"
        :rows="6"
        placeholder="请描述该岗位的职业发展路径，如横向发展和纵向晋升方向..."
        @update:model-value="(v: string) => emit('update', { careerPath: v })"
      />
    </el-card>

    <!-- 相关证书 -->
    <el-card shadow="never" class="block-card" :class="{ 'ai-flash': flashKey === 'certificates' }">
      <template #header>
        <div class="card-header">
          <span class="card-title">相关证书</span>
          <span class="section-ai">
            <template v-if="aiMode">
              <template v-if="aiUpdated('certificates')">
                <el-tag size="small" class="ai-tag">AI 已更新</el-tag>
                <el-button text size="small" class="ai-link" @click="restoreField('certificates')">
                  <el-icon><RefreshLeft /></el-icon>恢复上版
                </el-button>
              </template>
              <el-button
                size="small"
                plain
                class="ai-btn"
                :disabled="pipeline.isRunning.value"
                @click="handleWriteCertificates"
              >
                <el-icon :class="{ 'is-loading': sectionRunning('certificates') }"><MagicStick /></el-icon>
                重新生成
              </el-button>
            </template>
            <template v-if="certificateLibraryEnabled">
              <el-button size="small" @click="openCertDialog">从证书库选择</el-button>
              <el-button size="small" @click="newCertDialog = true">
                <el-icon><Plus /></el-icon>
                新增证书
              </el-button>
            </template>
          </span>
        </div>
      </template>
      <el-empty v-if="position.certificates.length === 0" description="暂无相关证书" :image-size="72" />
      <div v-else class="cert-grid">
        <div v-for="cert in position.certificates" :key="cert.id" class="cert-card">
          <el-button circle size="small" class="cert-remove" @click="removeCertificate(cert.id)">
            <el-icon><Close /></el-icon>
          </el-button>
          <div class="cert-cover">
            <img v-if="isValidImageUrl(cert.image)" :src="cert.image" :alt="cert.name" />
            <el-icon v-else :size="36" class="cert-cover-icon"><Medal /></el-icon>
          </div>
          <div class="cert-body">
            <div class="cert-line">
              <span class="cert-key">证书名称：</span>
              <span class="cert-name">{{ cert.name }}</span>
            </div>
            <div v-if="cert.url" class="cert-line">
              <span class="cert-key">相关网站：</span>
              <a :href="cert.url" target="_blank" rel="noopener noreferrer" class="cert-url">{{ cert.url }}</a>
            </div>
            <div v-if="cert.description" class="cert-line">
              <span class="cert-key">证书介绍：</span>
              <span class="cert-desc">{{ cert.description }}</span>
            </div>
          </div>
        </div>
      </div>
    </el-card>

    <!-- 从证书库选择 -->
    <el-dialog v-model="certDialog" title="从证书库选择证书" width="920px" top="6vh">
      <p class="dialog-desc">选择与该岗位相关的职业资格证书</p>
      <el-input v-model="certSearchQuery" placeholder="搜索证书名称或描述..." clearable :prefix-icon="Search" />
      <div class="cert-pool">
        <el-empty v-if="filteredCertificates.length === 0" description="未找到匹配证书" :image-size="72" />
        <div v-else class="cert-grid">
          <div
            v-for="cert in filteredCertificates"
            :key="cert.id"
            class="cert-card selectable"
            :class="{ selected: selectedCertIds.includes(cert.id) }"
            @click="toggleCertificate(cert.id)"
          >
            <el-checkbox
              class="cert-check"
              :model-value="selectedCertIds.includes(cert.id)"
              @click.stop
              @change="() => toggleCertificate(cert.id)"
            />
            <div class="cert-cover">
              <img v-if="isValidImageUrl(cert.image)" :src="cert.image" :alt="cert.name" />
              <el-icon v-else :size="36" class="cert-cover-icon"><Medal /></el-icon>
            </div>
            <div class="cert-body">
              <div class="cert-line">
                <span class="cert-key">证书名称：</span>
                <span class="cert-name">{{ cert.name }}</span>
              </div>
              <div v-if="cert.url" class="cert-line">
                <span class="cert-key">相关网站：</span>
                <a :href="cert.url" target="_blank" rel="noopener noreferrer" class="cert-url" @click.stop>
                  {{ cert.url }}
                </a>
              </div>
              <div v-if="cert.description" class="cert-line">
                <span class="cert-key">证书介绍：</span>
                <span class="cert-desc">{{ cert.description }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      <template #footer>
        <el-button @click="certDialog = false">取消</el-button>
        <el-button type="primary" @click="confirmCertificates">确认选择</el-button>
      </template>
    </el-dialog>

    <!-- 新增证书 -->
    <el-dialog v-model="newCertDialog" title="新增证书" width="520px" @close="resetNewCert">
      <p class="dialog-desc">添加一个新的职业资格证书</p>
      <el-form label-position="top">
        <el-form-item label="证书名称">
          <el-input v-model="newCert.name" placeholder="例如：AWS 云从业者认证" />
        </el-form-item>
        <el-form-item label="相关网址">
          <el-input v-model="newCert.url" placeholder="https://..." />
        </el-form-item>
        <el-form-item label="证书介绍">
          <el-input v-model="newCert.description" type="textarea" :rows="3" placeholder="简要描述该证书..." />
        </el-form-item>
        <el-form-item label="证书图片">
          <div class="cert-upload" @click="pickCertImage">
            <img v-if="newCert.image" :src="newCert.image" alt="证书预览" class="cert-upload-img" />
            <template v-else>
              <el-icon :size="22"><Picture /></el-icon>
              <span class="cert-upload-tip">点击上传证书图片</span>
            </template>
          </div>
          <input ref="certFileInput" type="file" accept="image/*" style="display: none" @change="onCertImageChange" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="newCertDialog = false">取消</el-button>
        <el-button type="primary" :disabled="!newCert.name || certSubmitting" :loading="certSubmitting" @click="addNewCertificate">
          添加
        </el-button>
      </template>
    </el-dialog>

    <!-- 快速补全必填信息 -->
    <el-dialog v-model="quickFillOpen" title="快速补全必填信息" width="560px" top="8vh">
      <p class="dialog-desc">以下必填字段尚未填写，请补充后继续使用 AI 辅助编写。</p>
      <el-form label-position="top">
        <el-form-item v-if="!position.name.trim()" label="岗位名称" required>
          <el-input v-model="quickFill.name" placeholder="例如：Java 后端开发工程师" />
        </el-form-item>
        <el-form-item v-if="!position.industry.trim()" label="所属行业" required>
          <el-select v-model="quickFill.industry" filterable clearable placeholder="选择行业" style="width: 100%">
            <el-option v-for="i in industries" :key="i.id" :label="i.name" :value="i.id" />
          </el-select>
        </el-form-item>
        <el-form-item v-if="!position.description.trim()" label="岗位背景介绍" required>
          <el-input v-model="quickFill.description" type="textarea" :rows="3" placeholder="描述该岗位的主要工作内容和特点..." />
        </el-form-item>
        <el-form-item v-if="!position.responsibilities.some((r) => r.name.trim())" label="工作职责" required>
          <el-input v-model="quickFill.responsibilities" type="textarea" :rows="3" placeholder="每行一条，AI 将帮您拆解为专业条目..." />
        </el-form-item>
        <el-form-item v-if="!position.requirements.some((r) => r.trim())" label="任职要求" required>
          <el-input v-model="quickFill.requirements" type="textarea" :rows="3" placeholder="每行一条，AI 将帮您拆解为专业条目..." />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="quickFillOpen = false">取消</el-button>
        <el-button type="primary" class="ai-primary" :disabled="quickFillInvalid" @click="confirmQuickFillAndStartAi">
          <el-icon><MagicStick /></el-icon>
          开始 AI 辅助编写
        </el-button>
      </template>
    </el-dialog>

    <!-- 每次 AI 辅助编写前的意图确认 -->
    <el-dialog v-model="confirmRegenOpen" title="确认重新生成全部内容？" width="520px">
      <p class="dialog-desc">
        AI 将基于当前填写的岗位信息重新生成并直接覆盖：岗位名称、岗位简称、岗位简介、参考薪资、工作职责（{{
          position.responsibilities.filter((r) => r.name.trim()).length
        }} 条）、任职要求（{{ position.requirements.filter(Boolean).length }} 条）、晋升路径与证书推荐。每个字段均可单独「恢复上版」，也可全部撤销。
      </p>
      <template #footer>
        <el-button @click="confirmRegenOpen = false">取消</el-button>
        <el-button type="primary" class="ai-primary" @click="confirmRegenAndRun">
          <el-icon><MagicStick /></el-icon>
          确认生成
        </el-button>
      </template>
    </el-dialog>

    <!-- AI 辅助编写进度 -->
    <AiProgressDialog
      :open="pipeline.open.value"
      title="AI 辅助编写"
      description="大模型正在阅读岗位信息并生成润色、拆解与补齐结果"
      :steps="AI_ASSIST_STEPS"
      :current-step="pipeline.phase.value"
      :progress="pipeline.progress.value"
      @close="pipeline.handleClose"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue';
import { ElMessage } from 'element-plus';
import { Close, MagicStick, Medal, Picture, Plus, RefreshLeft, Search } from '@element-plus/icons-vue';
import { certificateLibraryApi } from '@/api/job';
import { industryApi, majorApi } from '@/api/system';
import { fileApi } from '@/api/import-export';
import type { PositionType } from '@/types/job';
import AiProgressDialog from './AiProgressDialog.vue';
import {
  isAiNotConfigured,
  positionAiAssist,
  useAiFieldWriter,
  useAiPipeline,
  type AIPositionAssistField,
  type AIPositionAssistResponse,
  type AIPositionAssistContext
} from './ai';
import { localId, type LocalCertificate, type LocalPosition } from './types';

/** AI 辅助编写一键流程的步骤（与字段顺序一一对应） */
const AI_ASSIST_STEPS = [
  '阅读岗位基础信息',
  '润色基础信息',
  '拆解工作职责',
  '拆解任职要求',
  '生成晋升路径',
  '推荐相关证书'
];

/** AI 可直接写入的字段键（基础信息 4 个 + 区块 4 个），各含 1 级撤销历史 */
type AiWriteKey =
  | 'name'
  | 'shortName'
  | 'description'
  | 'salaryRange'
  | 'responsibilities'
  | 'requirements'
  | 'careerPath'
  | 'certificates';

const AI_WRITE_KEYS: AiWriteKey[] = [
  'name',
  'shortName',
  'description',
  'salaryRange',
  'responsibilities',
  'requirements',
  'careerPath',
  'certificates'
];

type PolishFieldKey = 'name' | 'shortName' | 'description' | 'salaryRange';

interface PoolCertificate {
  id: string;
  name: string;
  url: string;
  description: string;
  image?: string;
}

const props = withDefaults(
  defineProps<{
    position: LocalPosition;
    aiMode?: boolean;
    showIndustryMajor?: boolean;
    certificateLibraryEnabled?: boolean;
    lockedPositionType?: boolean;
    hidePositionType?: boolean;
  }>(),
  {
    aiMode: false,
    showIndustryMajor: true,
    certificateLibraryEnabled: true,
    lockedPositionType: false,
    hidePositionType: false
  }
);

const emit = defineEmits<{ (e: 'update', data: Partial<LocalPosition>): void }>();

const industries = ref<{ id: string; name: string }[]>([]);
const majors = ref<{ id: string; name: string }[]>([]);
const optionsLoading = ref(false);
const aiNotice = ref<string | null>(null);
const certificateLibrary = ref<PoolCertificate[]>([]);

// ===== AI：字段级写入 + 串行流水线 =====
function snapshotField(key: AiWriteKey): Partial<LocalPosition> {
  const cur = props.position;
  switch (key) {
    case 'name':
      return { name: cur.name };
    case 'shortName':
      return { shortName: cur.shortName };
    case 'description':
      return { description: cur.description };
    case 'salaryRange':
      return { salaryRange: [cur.salaryRange[0], cur.salaryRange[1]] };
    case 'responsibilities':
      return { responsibilities: cur.responsibilities.map((r) => ({ ...r })) };
    case 'requirements':
      return { requirements: [...cur.requirements] };
    case 'careerPath':
      return { careerPath: cur.careerPath };
    case 'certificates':
      return { certificates: cur.certificates.map((c) => ({ ...c })) };
  }
}

const writer = useAiFieldWriter<AiWriteKey, Partial<LocalPosition>>(
  AI_WRITE_KEYS,
  (data) => emit('update', data),
  snapshotField
);
const { flashKey, aiUpdated, writeField, restoreField, restoreAll } = writer;
const updatedCount = computed(() => writer.updatedCount.value);
const basicFlash = computed(
  () => !!flashKey.value && ['name', 'shortName', 'description', 'salaryRange'].includes(flashKey.value)
);

// 快速补全值的一次性覆盖（首个 AI 请求使用后即清空）
let quickFillOverlay: Partial<AIPositionAssistContext> | null = null;

function resolveIndustryName(id: string): string {
  if (!id) return '';
  return industries.value.find((i) => i.id === id)?.name || id;
}

function resolveMajorNames(ids: string[]): string[] {
  return ids.map((id) => majors.value.find((m) => m.id === id)?.name || id);
}

function buildAiContext(): AIPositionAssistContext {
  const cur = props.position;
  return {
    name: cur.name,
    shortName: cur.shortName,
    industry: resolveIndustryName(cur.industry),
    majors: resolveMajorNames(cur.majors),
    salaryRange: [cur.salaryRange[0], cur.salaryRange[1]],
    description: cur.description,
    responsibilities: cur.responsibilities.map((r) => r.name),
    requirements: cur.requirements,
    careerPath: cur.careerPath
  };
}

const pipeline = useAiPipeline<undefined, AIPositionAssistResponse>({
  steps: () => AI_ASSIST_STEPS,
  request: (task, signal) => {
    // 每步实时构建上下文：后续字段的提示词可看到前序步骤的 AI 结果
    let ctx = buildAiContext();
    if (quickFillOverlay) {
      ctx = { ...ctx, ...quickFillOverlay };
      quickFillOverlay = null;
    }
    return positionAiAssist({ field: task.id as AIPositionAssistField, position: ctx }, signal);
  },
  onError: (err) => {
    if (isAiNotConfigured(err)) {
      ElMessage.warning('AI 未配置：请先在「系统管理 > 租户信息」配置 AI 服务后再使用 AI 辅助编写');
      return true;
    }
    ElMessage.error((err as Error).message || 'AI 生成失败');
    return false;
  }
});

const polishRunning = computed(() => pipeline.isRunning.value && pipeline.runningId.value === 'polish');
function sectionRunning(field: AIPositionAssistField): boolean {
  return pipeline.isRunning.value && pipeline.runningId.value === field;
}

const quickFillOpen = ref(false);
const quickFill = reactive({
  name: '',
  industry: '',
  description: '',
  responsibilities: '',
  requirements: ''
});
const confirmRegenOpen = ref(false);

// ===== 行业/专业字典 =====
async function loadOptions() {
  if (!props.showIndustryMajor) return;
  optionsLoading.value = true;
  try {
    const [indRes, majorRes] = await Promise.all([
      industryApi.list({ limit: 1000 }),
      majorApi.list({ limit: 1000 })
    ]);
    industries.value = (indRes.items || []).filter((i) => i.enabled).map((i) => ({ id: i.id, name: i.name }));
    majors.value = (majorRes.items || []).filter((m) => m.enabled).map((m) => ({ id: m.id, name: m.name }));
  } catch {
    industries.value = [];
    majors.value = [];
  } finally {
    optionsLoading.value = false;
  }
}

// ===== 证书库 =====
const certDialog = ref(false);
const newCertDialog = ref(false);
const certSearchQuery = ref('');
const selectedCertIds = ref<string[]>([]);
const certSubmitting = ref(false);
const certFileInput = ref<HTMLInputElement | null>(null);
const newCert = reactive({ name: '', url: '', description: '', image: '' });
let certImageFile: File | null = null;

async function loadCertificateLibrary() {
  if (!props.certificateLibraryEnabled) return;
  try {
    const res = await certificateLibraryApi.list({ limit: 1000 });
    certificateLibrary.value = (res.items || []).map((item) => ({
      id: item.id,
      name: item.name,
      url: item.url ?? '',
      description: item.description ?? '',
      image: item.imageUrl ?? ''
    }));
  } catch {
    certificateLibrary.value = [];
  }
}

function isValidImageUrl(url?: string): boolean {
  return !!url && !url.startsWith('blob:');
}

// 同步已选证书状态，防止异步加载/重新进入编辑页后选择框与保存数据不一致
watch(
  () => props.position.certificates,
  (list) => {
    selectedCertIds.value = (list || []).map((c) => c.libraryId || c.id);
  },
  { immediate: true, deep: true }
);

function openCertDialog() {
  selectedCertIds.value = (props.position.certificates || []).map((c) => c.libraryId || c.id);
  certSearchQuery.value = '';
  certDialog.value = true;
}

const filteredCertificates = computed(() => {
  const q = certSearchQuery.value.trim().toLowerCase();
  if (!q) return certificateLibrary.value;
  return certificateLibrary.value.filter(
    (c) => c.name.toLowerCase().includes(q) || (c.description?.toLowerCase().includes(q) ?? false)
  );
});

function toggleCertificate(certId: string) {
  selectedCertIds.value = selectedCertIds.value.includes(certId)
    ? selectedCertIds.value.filter((id) => id !== certId)
    : [...selectedCertIds.value, certId];
}

function confirmCertificates() {
  const existingCerts = props.position.certificates || [];
  const existingLibraryIds = new Set(existingCerts.map((c) => c.libraryId || c.id));
  // 保留仍被勾选的已关联证书
  const keptCerts = existingCerts.filter((c) => selectedCertIds.value.includes(c.libraryId || c.id));
  // 追加新勾选的证书库条目
  for (const libItem of certificateLibrary.value) {
    if (selectedCertIds.value.includes(libItem.id) && !existingLibraryIds.has(libItem.id)) {
      keptCerts.push({
        id: localId('cert-ref'),
        libraryId: libItem.id,
        name: libItem.name,
        url: libItem.url,
        description: libItem.description,
        image: libItem.image
      });
    }
  }
  emit('update', { certificates: keptCerts });
  certDialog.value = false;
}

function pickCertImage() {
  certFileInput.value?.click();
}

function revokeCertImage() {
  if (newCert.image.startsWith('blob:')) URL.revokeObjectURL(newCert.image);
}

function onCertImageChange(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;
  revokeCertImage();
  certImageFile = file;
  newCert.image = URL.createObjectURL(file);
}

function resetNewCert() {
  revokeCertImage();
  newCert.name = '';
  newCert.url = '';
  newCert.description = '';
  newCert.image = '';
  certImageFile = null;
}

async function addNewCertificate() {
  if (!newCert.name) return;
  certSubmitting.value = true;
  try {
    let imageUrl: string | undefined = newCert.image.startsWith('blob:') ? undefined : newCert.image || undefined;
    if (certImageFile) {
      const uploadRes = await fileApi.upload(certImageFile);
      imageUrl = uploadRes.url;
    }
    const created = await certificateLibraryApi.create({
      name: newCert.name,
      url: newCert.url || undefined,
      description: newCert.description || undefined,
      imageUrl
    });
    const poolItem: PoolCertificate = {
      id: created.id,
      name: created.name,
      url: created.url ?? '',
      description: created.description ?? '',
      image: created.imageUrl ?? ''
    };
    certificateLibrary.value = [poolItem, ...certificateLibrary.value];
    emit('update', {
      certificates: [
        ...(props.position.certificates || []),
        {
          id: localId('cert-ref'),
          libraryId: created.id,
          name: created.name,
          url: created.url ?? '',
          description: created.description ?? '',
          image: created.imageUrl ?? ''
        }
      ]
    });
    resetNewCert();
    newCertDialog.value = false;
  } catch {
    aiNotice.value = '新增证书失败，请稍后重试';
  } finally {
    certSubmitting.value = false;
  }
}

function removeCertificate(certId: string) {
  const cert = props.position.certificates?.find((c) => c.id === certId);
  emit('update', { certificates: (props.position.certificates || []).filter((c) => c.id !== certId) });
  if (cert) {
    selectedCertIds.value = selectedCertIds.value.filter((id) => id !== (cert.libraryId || cert.id));
  }
}

// ===== 职责 / 任职要求（回车新增行并聚焦） =====
let pendingFocusId: string | null = null;

function genReqId(): string {
  return localId('req');
}
const reqIds = ref<string[]>(props.position.requirements.map(() => genReqId()));
// 外部整体替换（AI/父级重置）导致数量不一致时重建 id 表
watch(
  () => props.position.requirements.length,
  (len) => {
    if (reqIds.value.length !== len) {
      reqIds.value = Array.from({ length: len }, () => genReqId());
    }
  }
);

async function focusPending() {
  if (!pendingFocusId) return;
  const target = pendingFocusId;
  await nextTick();
  const el = document.querySelector<HTMLTextAreaElement>(`textarea[data-focus-id="${target}"]`);
  if (el) {
    pendingFocusId = null;
    el.focus();
  }
}

/** 回车新增下一行：中文输入法确认键（composing）不触发，对齐 React isComposing 判断 */
function onEnterAdd(e: KeyboardEvent, kind: 'resp' | 'req') {
  if (e.isComposing) return;
  e.preventDefault();
  if (kind === 'resp') addResponsibility(true);
  else addRequirement(true);
}

function updateResponsibility(index: number, value: string) {
  const next = props.position.responsibilities.map((r, i) => (i === index ? { ...r, name: value } : r));
  emit('update', { responsibilities: next });
}

function addResponsibility(focusNew = false) {
  const newItem = { id: localId('resp'), name: '', description: '' };
  if (focusNew) pendingFocusId = newItem.id;
  emit('update', { responsibilities: [...props.position.responsibilities, newItem] });
  void focusPending();
}

function removeResponsibility(index: number) {
  emit('update', { responsibilities: props.position.responsibilities.filter((_, i) => i !== index) });
}

function updateRequirement(index: number, value: string) {
  emit('update', { requirements: props.position.requirements.map((r, i) => (i === index ? value : r)) });
}

function addRequirement(focusNew = false) {
  const newId = genReqId();
  reqIds.value = [...reqIds.value, newId];
  if (focusNew) pendingFocusId = newId;
  emit('update', { requirements: [...props.position.requirements, ''] });
  void focusPending();
}

function removeRequirement(index: number) {
  emit('update', { requirements: props.position.requirements.filter((_, i) => i !== index) });
  reqIds.value = reqIds.value.filter((_, i) => i !== index);
}

// ===== AI 应用逻辑（对齐 React apply* 系列） =====
function polishFieldLabel(key: PolishFieldKey): string {
  return { name: '岗位名称', shortName: '岗位简称', description: '岗位简介', salaryRange: '薪资范围' }[key];
}

function applyPolishTarget(res: AIPositionAssistResponse, target: PolishFieldKey) {
  const p = res.polish;
  if (!p) return;
  if (target === 'name' && p.name?.trim()) {
    writeField('name', { name: p.name.trim() });
    return;
  }
  if (target === 'shortName' && p.shortName?.trim()) {
    writeField('shortName', { shortName: p.shortName.trim() });
    return;
  }
  if (target === 'description' && p.description?.trim()) {
    writeField('description', { description: p.description.trim() });
    return;
  }
  if (target === 'salaryRange' && p.salaryMin > 0 && p.salaryMax >= p.salaryMin) {
    writeField('salaryRange', { salaryRange: [p.salaryMin, p.salaryMax] });
    return;
  }
  ElMessage.info(`AI 未生成${polishFieldLabel(target)}，已保留原内容`);
}

function applyPolishAll(res: AIPositionAssistResponse) {
  const p = res.polish;
  if (!p) return;
  const skipped: string[] = [];
  if (p.name?.trim()) writeField('name', { name: p.name.trim() });
  else skipped.push(polishFieldLabel('name'));
  if (p.shortName?.trim()) writeField('shortName', { shortName: p.shortName.trim() });
  else skipped.push(polishFieldLabel('shortName'));
  if (p.description?.trim()) writeField('description', { description: p.description.trim() });
  else skipped.push(polishFieldLabel('description'));
  if (p.salaryMin > 0 && p.salaryMax >= p.salaryMin) {
    writeField('salaryRange', { salaryRange: [p.salaryMin, p.salaryMax] });
  } else {
    skipped.push(polishFieldLabel('salaryRange'));
  }
  if (skipped.length > 0) {
    ElMessage.info(`AI 未生成：${skipped.join('、')}，已保留原内容`);
  }
}

function applyResponsibilities(res: AIPositionAssistResponse) {
  if (!res.responsibilities) return;
  writeField('responsibilities', {
    responsibilities: res.responsibilities.map((name) => ({
      id: localId('resp-ai'),
      name,
      description: ''
    }))
  });
}

/** 证书追加（按名称去重） */
function applyCertificates(res: AIPositionAssistResponse) {
  if (!res.certificates) return;
  const existing = props.position.certificates || [];
  const existingNames = new Set(existing.map((c) => c.name));
  const toAdd: LocalCertificate[] = res.certificates
    .filter((c) => !existingNames.has(c.name))
    .map((c) => ({
      id: localId('cert-ai'),
      name: c.name,
      url: c.url || '',
      description: c.description || ''
    }));
  if (toAdd.length > 0) {
    writeField('certificates', { certificates: [...existing, ...toAdd] });
  }
}

function handlePolishField(target: PolishFieldKey) {
  void pipeline.run([{ id: 'polish', meta: undefined, apply: (res) => applyPolishTarget(res, target) }], {
    showDialog: false
  });
}

function handleWriteResponsibilities() {
  void pipeline.run([{ id: 'responsibilities', meta: undefined, apply: applyResponsibilities }], {
    showDialog: false
  });
}

function handleWriteRequirements() {
  void pipeline.run(
    [
      {
        id: 'requirements',
        meta: undefined,
        apply: (res) => {
          if (res.requirements) writeField('requirements', { requirements: res.requirements });
        }
      }
    ],
    { showDialog: false }
  );
}

function handleWriteCareerPath() {
  void pipeline.run(
    [
      {
        id: 'careerPath',
        meta: undefined,
        apply: (res) => {
          if (res.careerPath) writeField('careerPath', { careerPath: res.careerPath });
        }
      }
    ],
    { showDialog: false }
  );
}

function handleWriteCertificates() {
  void pipeline.run([{ id: 'certificates', meta: undefined, apply: applyCertificates }], { showDialog: false });
}

function handleRestoreAll() {
  restoreAll(() => ElMessage.success('已全部恢复 AI 覆盖前的内容'));
}

/** 一键流程：按字段顺序逐个生成，进度弹窗逐步展示 */
function runAiAssist() {
  void pipeline.run([
    { id: 'polish', meta: undefined, apply: applyPolishAll },
    { id: 'responsibilities', meta: undefined, apply: applyResponsibilities },
    {
      id: 'requirements',
      meta: undefined,
      apply: (res) => {
        if (res.requirements) writeField('requirements', { requirements: res.requirements });
      }
    },
    {
      id: 'careerPath',
      meta: undefined,
      apply: (res) => {
        if (res.careerPath) writeField('careerPath', { careerPath: res.careerPath });
      }
    },
    { id: 'certificates', meta: undefined, apply: applyCertificates }
  ]);
}

function hasMissingFields(): boolean {
  const p = props.position;
  return (
    !p.name.trim() ||
    !p.industry.trim() ||
    !p.description.trim() ||
    !p.responsibilities.some((r) => r.name.trim()) ||
    !p.requirements.some((r) => r.trim())
  );
}

function startAiAssist() {
  if (hasMissingFields()) {
    quickFill.name = props.position.name;
    quickFill.industry = props.position.industry;
    quickFill.description = props.position.description;
    quickFill.responsibilities = props.position.responsibilities
      .map((r) => r.name)
      .filter(Boolean)
      .join('\n');
    quickFill.requirements = props.position.requirements.filter(Boolean).join('\n');
    quickFillOpen.value = true;
    return;
  }
  // 每次点击均先弹确认，明确「将重新生成全部内容」的意图
  confirmRegenOpen.value = true;
}

const quickFillInvalid = computed(() => {
  const p = props.position;
  return (
    (!p.name.trim() && !quickFill.name.trim()) ||
    (!p.industry.trim() && !quickFill.industry.trim()) ||
    (!p.description.trim() && !quickFill.description.trim()) ||
    (!p.responsibilities.some((r) => r.name.trim()) && !quickFill.responsibilities.trim()) ||
    (!p.requirements.some((r) => r.trim()) && !quickFill.requirements.trim())
  );
});

function confirmQuickFillAndStartAi() {
  const respItems = quickFill.responsibilities
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
  const reqItems = quickFill.requirements
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
  emit('update', {
    name: quickFill.name,
    industry: quickFill.industry,
    description: quickFill.description,
    responsibilities: respItems.map((name) => ({ id: localId('resp-ai'), name, description: '' })),
    requirements: reqItems
  });
  // 快速补全值作为首个请求的上下文覆盖（position 状态此时可能尚未刷新）
  quickFillOverlay = {
    name: quickFill.name,
    industry: resolveIndustryName(quickFill.industry),
    description: quickFill.description,
    responsibilities: respItems,
    requirements: reqItems
  };
  quickFillOpen.value = false;
  runAiAssist();
}

function confirmRegenAndRun() {
  confirmRegenOpen.value = false;
  runAiAssist();
}

onMounted(() => {
  void loadOptions();
  void loadCertificateLibrary();
});
</script>

<style scoped>
.step-basic {
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.ai-entry {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}
.ai-entry-title {
  margin: 0;
  font-size: 17px;
  font-weight: 600;
  color: #303133;
}
.ai-entry-sub {
  margin: 4px 0 0;
  font-size: 13px;
  color: #909399;
}
.ai-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 16px;
  border: 1px solid #e0d0ff;
  border-radius: 8px;
  background: #f8f4ff;
}
.ai-banner-text {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #6d3fc0;
}
.ai-btn {
  border-color: #d9c8ff;
  color: #7c3aed;
}
.ai-primary {
  background: #7c3aed;
  border-color: #7c3aed;
}
.ai-link {
  color: #7c3aed;
  padding: 0 4px;
}
.ai-tag {
  background: #f6f2ff;
  border-color: #e0d0ff;
  color: #7c3aed;
}
.block-card {
  border-radius: 10px;
}
.card-title {
  font-size: 15px;
  font-weight: 600;
  color: #303133;
}
.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}
.section-ai,
.field-ai {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.grid-2 {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
  margin-bottom: 16px;
}
.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 16px;
  padding: 2px;
  border-radius: 6px;
}
.grid-2 .field {
  margin-bottom: 0;
}
.field-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 500;
  color: #606266;
}
.field-hint {
  margin: 0;
  font-size: 12px;
  color: #909399;
}
.salary-row {
  display: flex;
  align-items: center;
  gap: 12px;
}
.salary-input {
  width: 160px;
}
.sep {
  color: #909399;
}
.ai-notice {
  border-radius: 8px;
}
.row-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.row-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}
.row-index {
  width: 32px;
  flex-shrink: 0;
  text-align: center;
}
.row-del {
  flex-shrink: 0;
  color: #c0c4cc;
}
.row-del:hover {
  color: #f56c6c;
}
.add-row {
  border-style: dashed;
  width: 100%;
}
.cert-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
  gap: 16px;
}
.cert-card {
  position: relative;
  display: flex;
  flex-direction: column;
  border: 1px solid #ebeef5;
  border-radius: 10px;
  overflow: hidden;
  background: #fff;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);
}
.cert-card.selectable {
  cursor: pointer;
  border-width: 2px;
  transition: all 0.2s;
}
.cert-card.selectable:hover {
  border-color: #c0c4cc;
}
.cert-card.selected {
  border-color: #409eff;
}
.cert-remove {
  position: absolute;
  top: 6px;
  right: 6px;
  z-index: 2;
}
.cert-check {
  position: absolute;
  top: 8px;
  right: 10px;
  z-index: 2;
}
.cert-cover {
  position: relative;
  aspect-ratio: 16 / 9;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f5f7fa;
  overflow: hidden;
}
.cert-cover img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.cert-cover-icon {
  color: #c0c4cc;
}
.cert-body {
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 5px;
  flex: 1;
}
.cert-line {
  display: flex;
  align-items: flex-start;
  gap: 2px;
  min-width: 0;
}
.cert-key {
  flex-shrink: 0;
  font-size: 11px;
  color: #909399;
}
.cert-name {
  font-size: 13px;
  font-weight: 600;
  color: #303133;
  word-break: break-all;
}
.cert-url {
  font-size: 12px;
  color: #409eff;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.cert-desc {
  font-size: 12px;
  color: #909399;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.cert-pool {
  margin-top: 14px;
  max-height: 56vh;
  overflow: auto;
  padding-right: 4px;
}
.cert-upload {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 100%;
  height: 96px;
  border: 1px dashed #dcdfe6;
  border-radius: 8px;
  color: #909399;
  cursor: pointer;
  position: relative;
  overflow: hidden;
}
.cert-upload:hover {
  background: #f5f7fa;
}
.cert-upload-img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.cert-upload-tip {
  font-size: 12px;
}
.dialog-desc {
  margin: 0 0 12px;
  font-size: 13px;
  color: #909399;
}
/* AI 写入高亮（对齐 React ai-write-flash） */
.ai-flash {
  animation: ai-flash 1.4s ease-out;
}
@keyframes ai-flash {
  0% {
    background-color: rgba(139, 92, 246, 0.16);
  }
  100% {
    background-color: transparent;
  }
}
</style>
