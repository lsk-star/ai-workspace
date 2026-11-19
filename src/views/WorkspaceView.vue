<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useMediaQuery } from '@vueuse/core'
import { MenuUnfoldOutlined } from '@ant-design/icons-vue'
import FileTreePanel from '@/components/tree/FileTreePanel.vue'
import DocPanel from '@/components/doc/DocPanel.vue'
import TocPanel from '@/components/doc/TocPanel.vue'
import { useDocStore } from '@/stores/doc'
import { useWorkspaceStore } from '@/stores/workspace'
import { DEFAULT_LEFT_WIDTH, useUiStore } from '@/stores/ui'

const route = useRoute()
const router = useRouter()
const doc = useDocStore()
const workspace = useWorkspaceStore()
const ui = useUiStore()

const isNarrow = useMediaQuery('(max-width: 1023px)')
const isWide = useMediaQuery('(min-width: 1280px)')
const resizing = ref(false)

const leftVisible = computed(() => !ui.leftCollapsed && (!isNarrow.value || ui.mobileTreeOpen))
const rightVisible = computed(() => isWide.value)

function routePath(): string {
  const raw = route.params.pathMatch
  const segments = Array.isArray(raw) ? raw : raw ? [raw] : []
  return segments
    .map((segment) => String(segment))
    .filter(Boolean)
    .join('/')
}

function sync(): void {
  const target = routePath()
  if (!target) {
    void router.replace({
      name: 'doc',
      params: { pathMatch: workspace.space.entry.split('/') },
    })
    return
  }
  doc.open(target)
}

onMounted(sync)

watch(
  () => route.fullPath,
  () => {
    sync()
    if (isNarrow.value) ui.mobileTreeOpen = false
  },
)

watch(
  () => isNarrow.value,
  (narrow) => {
    if (!narrow) ui.mobileTreeOpen = false
  },
)

function startResize(event: PointerEvent): void {
  event.preventDefault()
  resizing.value = true
  const startX = event.clientX
  const startWidth = ui.leftWidth
  document.body.classList.add('aw-resizing')

  const onMove = (moveEvent: PointerEvent): void => {
    ui.setLeftWidth(startWidth + moveEvent.clientX - startX)
  }
  const onUp = (): void => {
    resizing.value = false
    document.body.classList.remove('aw-resizing')
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
    window.removeEventListener('pointercancel', onUp)
    window.removeEventListener('blur', onUp)
  }

  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp)
  window.addEventListener('pointercancel', onUp)
  window.addEventListener('blur', onUp)
}

function resetWidth(): void {
  ui.setLeftWidth(DEFAULT_LEFT_WIDTH)
}
</script>

<template>
  <div class="workspace" :class="{ narrow: isNarrow }">
    <aside
      v-if="leftVisible"
      class="pane-left"
      :style="isNarrow ? undefined : { width: `${ui.leftWidth}px` }"
    >
      <FileTreePanel />
    </aside>

    <div
      v-if="leftVisible && !isNarrow"
      class="resizer"
      :class="{ active: resizing }"
      title="拖动调整目录宽度，双击复位"
      @pointerdown="startResize"
      @dblclick="resetWidth"
    />

    <div v-if="isNarrow && ui.mobileTreeOpen" class="scrim" @click="ui.mobileTreeOpen = false" />

    <div class="main-shell">
      <main class="pane-center">
        <DocPanel />
      </main>

      <aside v-if="rightVisible" class="pane-right">
        <TocPanel />
      </aside>
    </div>

    <button
      v-if="!leftVisible"
      class="edge-btn"
      type="button"
      title="展开目录"
      @click="isNarrow ? (ui.mobileTreeOpen = true) : ui.toggleLeft()"
    >
      <MenuUnfoldOutlined />
    </button>
  </div>
</template>

<style scoped>
.workspace {
  height: 100%;
  display: flex;
  min-height: 0;
  position: relative;
  overflow: hidden;
  background: var(--aw-bg);
}

.pane-left {
  flex: 0 0 auto;
  height: 100%;
  min-width: 0;
}

.resizer {
  flex: 0 0 5px;
  cursor: col-resize;
  position: relative;
  z-index: 6;
}

.resizer::after {
  content: '';
  position: absolute;
  inset: 0 2px;
  border-radius: 2px;
  background: transparent;
  transition: background 150ms ease;
}

.resizer:hover::after,
.resizer.active::after {
  background: var(--aw-line-strong);
}

.main-shell {
  flex: 1 1 auto;
  min-width: 0;
  height: 100%;
  display: flex;
  align-items: stretch;
  gap: 44px;
  padding: 0 40px 0 56px;
  overflow: hidden;
}

.pane-center {
  flex: 0 1 var(--aw-content-max);
  min-width: 0;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.pane-right {
  flex: 0 0 var(--aw-right-w);
  width: var(--aw-right-w);
  height: 100%;
  min-width: 0;
}

.scrim {
  position: absolute;
  inset: 0;
  background: rgba(23, 24, 27, 0.26);
  z-index: 40;
}

.edge-btn {
  position: absolute;
  top: 16px;
  left: 0;
  width: 24px;
  height: 44px;
  display: grid;
  place-items: center;
  border: 1px solid var(--aw-line);
  border-left: 0;
  border-radius: 0 8px 8px 0;
  background: var(--aw-bg);
  color: var(--aw-text-3);
  cursor: pointer;
  z-index: 12;
  box-shadow: var(--aw-shadow-xs);
  font-size: 12px;
}

.edge-btn:hover {
  color: var(--aw-text);
  background: var(--aw-bg-soft);
}

.workspace.narrow .pane-left {
  position: absolute;
  inset: 0 auto 0 0;
  width: min(84vw, 300px) !important;
  z-index: 50;
  box-shadow: 0 24px 60px rgba(17, 20, 28, 0.18);
}

@media (max-width: 1279px) {
  .main-shell {
    gap: 0;
    padding-right: 56px;
  }

  .pane-center {
    flex: 1 1 auto;
    max-width: var(--aw-content-max);
  }
}

@media (max-width: 1023px) {
  .main-shell {
    padding: 0 28px;
  }

  .pane-center {
    max-width: none;
  }
}
</style>
