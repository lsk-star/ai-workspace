<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useMediaQuery, useDebounceFn } from '@vueuse/core'
import {
  FileTextOutlined,
  FolderOutlined,
  MenuFoldOutlined,
  SearchOutlined,
} from '@ant-design/icons-vue'
import type { DocMeta, FileNode } from '@/types/content'
import { buildTree } from '@/lib/content'
import { useWorkspaceStore } from '@/stores/workspace'
import { useDocStore } from '@/stores/doc'
import { useUiStore } from '@/stores/ui'

const router = useRouter()
const workspace = useWorkspaceStore()
const doc = useDocStore()
const ui = useUiStore()
const isNarrow = useMediaQuery('(max-width: 1023px)')

const searchInput = ref<{ focus: () => void } | null>(null)
const treeEl = ref<HTMLElement | null>(null)
const treeBodyEl = ref<HTMLElement | null>(null)
const scrollVisible = ref(false)
const thumbHeight = ref(0)
const thumbTop = ref(0)
const draggingThumb = ref(false)

let contentObserver: ResizeObserver | null = null

function updateScrollbar(): void {
  const el = treeEl.value
  if (!el) return
  const track = el.clientHeight - 24
  const range = el.scrollHeight - el.clientHeight
  if (range < 16 || track < 80) {
    scrollVisible.value = false
    return
  }
  const natural = Math.max(36, track * (el.clientHeight / el.scrollHeight))
  const height = Math.max(36, Math.min(track * 0.88, natural * 0.6))
  const maxTop = Math.max(0, track - height)
  thumbHeight.value = height
  thumbTop.value = 12 + (el.scrollTop / range) * maxTop
  scrollVisible.value = true
}

function startThumbDrag(event: PointerEvent): void {
  event.preventDefault()
  const el = treeEl.value
  if (!el) return
  draggingThumb.value = true
  const startY = event.clientY
  const startScroll = el.scrollTop
  const range = el.scrollHeight - el.clientHeight
  const available = Math.max(1, el.clientHeight - 24 - thumbHeight.value)

  const onMove = (moveEvent: PointerEvent): void => {
    const delta = moveEvent.clientY - startY
    el.scrollTop = startScroll + (delta / available) * range
  }
  const onUp = (): void => {
    draggingThumb.value = false
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
    window.removeEventListener('pointercancel', onUp)
    window.removeEventListener('blur', onUp)
    updateScrollbar()
  }

  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp)
  window.addEventListener('pointercancel', onUp)
  window.addEventListener('blur', onUp)
}

onMounted(() => {
  updateScrollbar()
  window.addEventListener('resize', updateScrollbar)
  if (treeBodyEl.value) {
    contentObserver = new ResizeObserver(() => updateScrollbar())
    contentObserver.observe(treeBodyEl.value)
  }
})

onUnmounted(() => {
  window.removeEventListener('resize', updateScrollbar)
  contentObserver?.disconnect()
  contentObserver = null
})

const allTree = buildTree()

interface AntNode {
  key: string
  title: string
  path: string
  kind: 'dir' | 'file'
  isLeaf: boolean
  children?: AntNode[]
}

function toAntNodes(nodes: FileNode[]): AntNode[] {
  return nodes.map((node) => ({
    key: node.key,
    title: node.name,
    path: node.path,
    kind: node.kind,
    isLeaf: node.kind === 'file',
    children: node.children ? toAntNodes(node.children) : undefined,
  }))
}

const treeData = computed(() => {
  const source =
    workspace.scope === '全部资料'
      ? allTree
      : allTree.filter((node) => node.path === workspace.scope)
  return toAntNodes(source)
})

function closeDrawer(): void {
  if (isNarrow.value) ui.mobileTreeOpen = false
}

async function onSelect(
  _keys: (string | number)[],
  info: { node: Record<string, unknown> },
): Promise<void> {
  const node = (info.node.dataRef ?? info.node) as unknown as {
    kind?: string
    path?: string
  }
  if (node.kind === 'dir') {
    if (node.path) workspace.toggleExpanded(node.path)
    return
  }
  if (!node.path) return
  await router.push({ name: 'doc', params: { pathMatch: node.path.split('/') } })
  closeDrawer()
}

async function openHit(hit: DocMeta): Promise<void> {
  workspace.query = ''
  await router.push({ name: 'doc', params: { pathMatch: hit.path.split('/') } })
  closeDrawer()
}

const focusSearch = useDebounceFn(async () => {
  // 窄屏抽屉刚打开时组件才挂载，聚焦要等输入框出现
  for (let i = 0; i < 10; i += 1) {
    await nextTick()
    if (searchInput.value) {
      searchInput.value.focus()
      return
    }
    await new Promise((resolve) => setTimeout(resolve, 20))
  }
}, 30)

watch(
  () => ui.searchPending,
  (pending) => {
    // immediate 兜住“窄屏抽屉打开时才挂载、错过触发”的情况
    if (pending && ui.consumeSearchFocus()) void focusSearch()
  },
  { immediate: true },
)
</script>

<template>
  <div class="tree-wrap">
    <aside ref="treeEl" class="tree" @scroll.passive="updateScrollbar">
      <div class="tree-head">
      <span class="tree-title">文档</span>
    </div>

    <div class="tree-search">
      <a-input
        ref="searchInput"
        v-model:value="workspace.query"
        allow-clear
        placeholder="搜索标题、标签或正文"
        class="search-input"
      >
        <template #prefix><SearchOutlined class="search-icon" /></template>
      </a-input>
    </div>

    <div class="scope-row">
      <span class="scope-label">资料范围</span>
      <a-select
        v-model:value="workspace.scope"
        :options="workspace.categoryOptions"
        size="small"
        class="scope-select"
        :popup-match-select-width="false"
      />
    </div>

    <p class="scope-hint">
      个人工作区。搜索支持标题、标签与正文；引用前先看文档状态与更新时间。
    </p>

    <div ref="treeBodyEl" class="tree-body">
      <div v-if="workspace.searching" class="results">
        <div class="results-head">
          搜索结果 · {{ workspace.results.length }} 篇
        </div>
        <div v-if="!workspace.results.length" class="empty">
          <p class="empty-title">没有匹配的文档</p>
          <p class="empty-desc">换个关键词，或把资料范围切到「全部资料」。</p>
        </div>
        <button
          v-for="hit in workspace.results"
          :key="hit.doc.path"
          class="hit"
          :class="{ active: hit.doc.path === doc.path }"
          type="button"
          @click="openHit(hit.doc)"
        >
          <span class="hit-title">{{ hit.doc.title }}</span>
          <span class="hit-category">{{ hit.doc.folderPath }}</span>
          <span class="hit-snippet">{{ hit.snippet }}</span>
        </button>
      </div>

      <a-tree
        v-else
        v-model:expandedKeys="workspace.expandedKeys"
        :tree-data="treeData"
        :selected-keys="doc.path ? [doc.path] : []"
        :expand-action="false"
        block-node
        :indent-size="18"
        @select="onSelect"
      >
        <template #title="slotProps">
          <span
            class="node"
            :class="{ 'is-dir': (slotProps.kind ?? slotProps.dataRef?.kind) === 'dir' }"
          >
            <component
              :is="
                (slotProps.kind ?? slotProps.dataRef?.kind) === 'dir'
                  ? FolderOutlined
                  : FileTextOutlined
              "
              class="node-icon"
            />
            <span class="node-name">{{ slotProps.title }}</span>
          </span>
        </template>
      </a-tree>
    </div>

    <div class="tree-foot">
      <span class="foot-count">{{ workspace.fileCount }} 篇文档</span>
      <span class="foot-dot" />
      <span class="foot-readonly">阅读模式</span>
      <button class="foot-btn" type="button" title="收起目录" @click="ui.toggleLeft()">
        <MenuFoldOutlined />
      </button>
    </div>
    </aside>

    <div
      v-if="scrollVisible"
      class="scroll-thumb"
      :class="{ dragging: draggingThumb }"
      :style="{ height: `${thumbHeight}px`, top: `${thumbTop}px` }"
      @pointerdown="startThumbDrag"
    />
  </div>
</template>

<style scoped>
.tree-wrap {
  height: 100%;
  position: relative;
  min-width: 0;
}

.tree {
  height: 100%;
  display: flex;
  flex-direction: column;
  min-width: 0;
  background: #fff;
  border-right: 1px solid var(--aw-line);
  overflow-y: auto;
  overflow-x: hidden;
  scrollbar-width: none;
}

.tree::-webkit-scrollbar {
  width: 0;
  height: 0;
  display: none;
}

.scroll-thumb {
  position: absolute;
  right: 3px;
  width: 4px;
  border-radius: 999px;
  background: #d6d8de;
  opacity: 0.45;
  pointer-events: auto;
  transition: opacity 150ms ease, background 150ms ease;
  z-index: 5;
  cursor: grab;
}

.tree-wrap:hover .scroll-thumb,
.scroll-thumb.dragging {
  opacity: 1;
  pointer-events: auto;
}

.scroll-thumb:hover {
  background: #b9bcc4;
}

.scroll-thumb.dragging {
  background: #a8abb4;
  cursor: grabbing;
}

.tree-head {
  height: 54px;
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  padding: 0 14px 0 22px;
}

.tree-title {
  font-size: 14.5px;
  font-weight: 600;
  color: var(--aw-text);
  letter-spacing: 0.01em;
  flex: 1;
}

.tree-search {
  padding: 0 16px;
}

.search-input {
  height: 38px;
  border-radius: 7px;
}

.search-input :deep(input) {
  font-size: 14px;
}

.search-icon {
  color: var(--aw-text-4);
  font-size: 14px;
}

.scope-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 18px 0;
}

.scope-label {
  font-size: 13.5px;
  color: var(--aw-text-3);
  flex: 0 0 auto;
}

.scope-select {
  flex: 1;
  min-width: 0;
}

.scope-select :deep(.ant-select-selector) {
  border-radius: 6px !important;
  font-size: 13.5px;
}

.scope-hint {
  margin: 10px 18px 4px;
  font-size: 12.5px;
  line-height: 1.75;
  color: var(--aw-text-3);
}

.tree-body {
  flex: 0 0 auto;
  padding: 8px 10px 20px;
}

:deep(.ant-tree) {
  background: transparent;
  font-size: 14px;
  width: 100%;
  min-width: 0;
}

:deep(.ant-tree-treenode) {
  padding: 1px 0;
  width: 100%;
  min-width: 0;
}

:deep(.ant-tree-list-holder-inner) {
  display: block;
  min-width: 0;
}

:deep(.ant-tree-node-content-wrapper) {
  border-radius: 7px;
  padding: 0 6px !important;
  transition: background var(--aw-transition);
  height: 34px;
  line-height: 34px;
  min-height: 34px;
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
}

:deep(.ant-tree-title) {
  display: block;
  min-width: 0;
  overflow: hidden;
}

:deep(.ant-tree-node-content-wrapper:hover) {
  background: var(--aw-bg-hover);
}

:deep(.ant-tree-node-selected) {
  background: var(--aw-sel) !important;
}

:deep(.ant-tree-node-selected .node-name) {
  color: var(--aw-text);
  font-weight: 600;
}

:deep(.ant-tree-switcher) {
  width: 18px;
  color: var(--aw-text-4);
}

:deep(.ant-tree-indent-unit) {
  width: 18px;
}

.node {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  width: 100%;
  height: 34px;
  color: var(--aw-text-2);
}

.node-icon {
  flex: 0 0 auto;
  font-size: 14px;
  color: var(--aw-text-4);
}

.node.is-dir {
  color: var(--aw-text);
  font-weight: 500;
}

.node.is-dir .node-icon {
  color: #a6a9b1;
}

.node-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.results {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.results-head {
  font-size: 12.5px;
  color: var(--aw-text-3);
  padding: 6px 10px 8px;
}

.hit {
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 9px 10px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  text-align: left;
  cursor: pointer;
}

.hit:hover {
  background: var(--aw-bg-hover);
}

.hit.active {
  background: var(--aw-sel);
}

.hit-title {
  font-size: 14px;
  color: var(--aw-text);
  font-weight: 500;
}

.hit-category {
  font-size: 12px;
  color: var(--aw-text-3);
}

.hit-snippet {
  font-size: 12.5px;
  line-height: 1.6;
  color: var(--aw-text-3);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.empty {
  padding: 22px 12px;
}

.empty-title {
  margin: 0 0 6px;
  font-size: 14px;
  color: var(--aw-text-2);
}

.empty-desc {
  margin: 0;
  font-size: 12.5px;
  line-height: 1.7;
  color: var(--aw-text-3);
}

.tree-foot {
  position: sticky;
  bottom: 0;
  z-index: 2;
  flex: 0 0 auto;
  margin-top: auto;
  height: 48px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 14px 0 22px;
  border-top: 1px solid var(--aw-line-soft);
  background: #fff;
  font-size: 12.5px;
  color: var(--aw-text-3);
}

.foot-dot {
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: var(--aw-text-4);
}

.foot-btn {
  margin-left: auto;
  width: 26px;
  height: 26px;
  display: grid;
  place-items: center;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--aw-text-3);
  cursor: pointer;
}

.foot-btn:hover {
  background: var(--aw-bg-soft);
  color: var(--aw-text);
}
</style>
