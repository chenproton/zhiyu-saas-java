<template>
  <aside class="course-tree">
    <div class="tree-panel">
      <div class="tree-header">
        <span class="tree-title">
          <el-icon color="#409eff"><Reading /></el-icon>
          目录
        </span>
      </div>

      <div class="tree-body">
        <div
          v-for="item in flatTree"
          :key="item.node.id"
          class="tree-node"
          :class="{
            active: item.node.id === selectedNodeId,
            dragging: draggingId === item.node.id,
            'drop-before': isDropBefore(item.node.id),
            'drop-after': isDropAfter(item.node.id)
          }"
          :style="{ paddingLeft: 8 + item.level * 14 + 'px' }"
          draggable="true"
          @click="emit('select', item.node.id)"
          @dragstart="onDragStart($event, item.node.id)"
          @dragover="onDragOver($event, item.node.id)"
          @dragleave="onDragLeave($event)"
          @drop="onDrop($event, item.node.id)"
        >
          <span class="grip"><el-icon><Rank /></el-icon></span>
          <span class="seq">{{ item.seq }}</span>
          <span class="name" :title="item.node.name">{{ item.node.name }}</span>
          <el-tag
            v-if="item.node.type"
            size="small"
            :type="item.node.type === 'original' ? 'warning' : 'info'"
            class="node-type-tag"
            disable-transitions
          >
            {{ nodeTypeLabel(item.node.type) }}
          </el-tag>
          <el-dropdown trigger="click" @command="(cmd: string) => onMenuCommand(cmd, item.node)">
            <span class="more-btn" @click.stop><el-icon><MoreFilled /></el-icon></span>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="edit">✏ 编辑名称</el-dropdown-item>
                <el-dropdown-item command="addChild">+ 添加子节点</el-dropdown-item>
                <el-dropdown-item command="delete" divided>🗑 删除</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
        <div v-if="nodes.length === 0" class="tree-empty">暂无节点，请点击下方按钮添加</div>
      </div>

      <el-button class="add-btn" plain @click="openAddDialog(null)">＋ 添加节点</el-button>
      <p class="tree-tip">💡 拖拽节点可调整顺序</p>
    </div>

    <!-- 添加节点 -->
    <el-dialog
      v-model="addDialogOpen"
      :title="addParentId === null ? '添加节点' : '添加子节点'"
      width="420px"
      append-to-body
    >
      <p v-if="addParentId !== null && addParentNode" class="dialog-sub">
        将在「{{ addParentNode.name }}」下添加子节点
      </p>
      <el-form label-width="90px">
        <el-form-item label="节点名称" required>
          <el-input v-model="newNodeName" placeholder="请输入节点名称" maxlength="50" show-word-limit />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="addDialogOpen = false">取消</el-button>
        <el-button type="primary" :disabled="!newNodeName.trim()" @click="confirmAdd">确认添加</el-button>
      </template>
    </el-dialog>

    <!-- 编辑节点名称 -->
    <el-dialog v-model="editDialogOpen" title="编辑节点名称" width="420px" append-to-body>
      <el-form label-width="90px">
        <el-form-item label="节点名称" required>
          <el-input v-model="editNodeName" placeholder="请输入节点名称" maxlength="50" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editDialogOpen = false">取消</el-button>
        <el-button type="primary" :disabled="!editNodeName.trim()" @click="confirmEdit">保存</el-button>
      </template>
    </el-dialog>
  </aside>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { ElMessageBox } from 'element-plus';
import { NODE_REF_TYPE_LABELS, wouldCreateCycle, type SysNode } from './lesson-edit-utils';

const props = defineProps<{
  nodes: SysNode[];
  selectedNodeId: string | null;
}>();

const emit = defineEmits<{
  (e: 'select', nodeId: string): void;
  (e: 'addNode', parentId: string | null, name: string, order: number, type?: string, sourceId?: string, sourceName?: string): void;
  (e: 'updateNode', nodeId: string, updates: Partial<SysNode>): void;
  (e: 'deleteNode', nodeId: string): void;
  (e: 'reorderNodes', nodeId: string, targetNodeId: string, position: 'before' | 'after'): void;
}>();

interface TreeItem {
  node: SysNode;
  level: number;
  seq: string;
}

function nodeTypeLabel(type: string): string {
  return NODE_REF_TYPE_LABELS[type as keyof typeof NODE_REF_TYPE_LABELS] || type;
}

// 前序扁平化（按 order 排序，父子关系用 level 缩进表达）
const flatTree = computed<TreeItem[]>(() => {
  const sorted = [...props.nodes].sort((a, b) => a.order - b.order);
  const map = new Map<string, SysNode[]>();
  sorted.forEach((n) => {
    const key = n.parentId ?? '__root__';
    const list = map.get(key) || [];
    list.push(n);
    map.set(key, list);
  });
  const out: TreeItem[] = [];
  const walk = (parentId: string | null, level: number, prefix: string) => {
    const key = parentId ?? '__root__';
    const children = map.get(key) || [];
    children.forEach((node, idx) => {
      const seq = prefix ? `${prefix}.${idx + 1}` : String(idx + 1);
      out.push({ node, level, seq });
      walk(node.id, level + 1, seq);
    });
  };
  walk(null, 0, '');
  return out;
});

/* ---------- 添加/编辑对话框 ---------- */

const addDialogOpen = ref(false);
const addParentId = ref<string | null>(null);
const newNodeName = ref('');

const addParentNode = computed(() =>
  addParentId.value === null ? null : props.nodes.find((n) => n.id === addParentId.value) || null
);

function openAddDialog(parentId: string | null) {
  const siblings = props.nodes.filter((n) => n.parentId === parentId);
  const nextOrder = siblings.length > 0 ? Math.max(...siblings.map((n) => n.order)) + 1 : 1;
  addParentId.value = parentId;
  newNodeName.value = '';
  nextOrderRef.value = nextOrder;
  addDialogOpen.value = true;
}

const nextOrderRef = ref(1);

function confirmAdd() {
  if (!newNodeName.value.trim()) return;
  emit('addNode', addParentId.value, newNodeName.value.trim(), nextOrderRef.value, 'normal');
  addDialogOpen.value = false;
}

const editDialogOpen = ref(false);
const editNodeId = ref<string | null>(null);
const editNodeName = ref('');

function openEditDialog(nodeId: string) {
  const node = props.nodes.find((n) => n.id === nodeId);
  if (!node) return;
  editNodeId.value = nodeId;
  editNodeName.value = node.name;
  editDialogOpen.value = true;
}

function confirmEdit() {
  if (!editNodeId.value || !editNodeName.value.trim()) return;
  emit('updateNode', editNodeId.value, { name: editNodeName.value.trim() });
  editDialogOpen.value = false;
  editNodeId.value = null;
}

function onMenuCommand(cmd: string, node: SysNode) {
  if (cmd === 'edit') openEditDialog(node.id);
  else if (cmd === 'addChild') openAddDialog(node.id);
  else if (cmd === 'delete') void confirmDelete(node);
}

async function confirmDelete(node: SysNode) {
  try {
    await ElMessageBox.confirm('确定删除该节点吗？删除后其所有子节点也将被删除。', '删除节点', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消'
    });
  } catch {
    return;
  }
  emit('deleteNode', node.id);
}

/* ---------- 拖拽排序 ---------- */

const draggingId = ref<string | null>(null);
const dragOverState = ref<{ nodeId: string; position: 'before' | 'after' } | null>(null);

function onDragStart(e: DragEvent, nodeId: string) {
  draggingId.value = nodeId;
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', nodeId);
  }
}

function onDragOver(e: DragEvent, nodeId: string) {
  e.preventDefault();
  e.stopPropagation();
  if (!draggingId.value || draggingId.value === nodeId) return;
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
  const position: 'before' | 'after' = e.clientY < rect.top + rect.height / 2 ? 'before' : 'after';
  if (!dragOverState.value || dragOverState.value.nodeId !== nodeId || dragOverState.value.position !== position) {
    dragOverState.value = { nodeId, position };
  }
}

function onDragLeave(e: DragEvent) {
  const current = e.currentTarget as HTMLElement;
  if (!current.contains(e.relatedTarget as Node)) {
    if (dragOverState.value) dragOverState.value = null;
  }
}

function onDrop(e: DragEvent, targetId: string) {
  e.preventDefault();
  e.stopPropagation();
  const dragging = draggingId.value;
  if (
    dragging &&
    dragging !== targetId &&
    !wouldCreateCycle(props.nodes, dragging, targetId) &&
    dragOverState.value?.nodeId === targetId
  ) {
    emit('reorderNodes', dragging, targetId, dragOverState.value.position);
  }
  draggingId.value = null;
  dragOverState.value = null;
}

function isDropBefore(nodeId: string): boolean {
  return dragOverState.value?.nodeId === nodeId && dragOverState.value.position === 'before';
}
function isDropAfter(nodeId: string): boolean {
  return dragOverState.value?.nodeId === nodeId && dragOverState.value.position === 'after';
}
</script>

<style scoped>
.course-tree {
  width: 260px;
  flex-shrink: 0;
}
.tree-panel {
  background: #fff;
  border: 1px solid #f0f0f0;
  border-radius: 12px;
  padding: 12px;
  position: sticky;
  top: 12px;
}
.tree-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}
.tree-title {
  font-size: 14px;
  font-weight: 500;
  color: #303133;
  display: flex;
  align-items: center;
  gap: 6px;
}
.tree-body {
  max-height: calc(100vh - 320px);
  overflow-y: auto;
}
.tree-node {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 5px 6px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  color: #606266;
  transition: all 0.15s;
  user-select: none;
  border-left: 2px solid transparent;
}
.tree-node:hover {
  background: #f5f7fa;
}
.tree-node.active {
  background: #ecf5ff;
  color: #409eff;
  border-left-color: #409eff;
}
.tree-node.dragging {
  opacity: 0.4;
}
.tree-node.drop-before {
  border-top: 2px solid #409eff;
}
.tree-node.drop-after {
  border-bottom: 2px solid #409eff;
}
.grip {
  color: #c0c4cc;
  cursor: grab;
  display: flex;
  align-items: center;
  opacity: 0;
  transition: opacity 0.15s;
}
.tree-node:hover .grip {
  opacity: 1;
}
.seq {
  color: #c0c4cc;
  font-size: 12px;
  width: 20px;
  flex-shrink: 0;
}
.name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.node-type-tag {
  flex-shrink: 0;
  transform: scale(0.85);
}
.more-btn {
  color: #c0c4cc;
  display: flex;
  align-items: center;
  padding: 2px;
  flex-shrink: 0;
}
.more-btn:hover {
  color: #606266;
}
.tree-empty {
  color: #c0c4cc;
  font-size: 12px;
  text-align: center;
  padding: 16px 0;
}
.add-btn {
  width: 100%;
  margin-top: 12px;
  font-size: 12px;
}
.tree-tip {
  margin: 12px 0 0;
  padding-top: 12px;
  border-top: 1px solid #f0f0f0;
  font-size: 12px;
  color: #c0c4cc;
}
.dialog-sub {
  font-size: 12px;
  color: #909399;
  margin: 0 0 12px;
}
</style>
