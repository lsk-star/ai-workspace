<script setup lang="ts">
import { computed, nextTick, onUnmounted, ref, watch } from 'vue'
import { ArrowUpOutlined } from '@ant-design/icons-vue'
import { useDocStore } from '@/stores/doc'
import { useDocScrollTarget } from '@/composables/useDocScroll'

const doc = useDocStore()
const scrollTarget = useDocScrollTarget()

const activeId = ref('')
let frame = 0

const items = computed(() => {
  const multiLevel = doc.headings.filter((heading) => heading.level >= 2)
  const source = multiLevel.length ? multiLevel : doc.headings
  return source.map((heading) => ({
    ...heading,
    depth: Math.max(0, Math.min(2, heading.level - 2)),
  }))
})

function updateActive(): void {
  const container = scrollTarget.value
  if (!container || !items.value.length) return
  const containerTop = container.getBoundingClientRect().top
  let current = items.value[0]?.id ?? ''
  for (const item of items.value) {
    const element = container.querySelector<HTMLElement>(`#${CSS.escape(item.id)}`)
    if (!element) continue
    const offset = element.getBoundingClientRect().top - containerTop
    if (offset <= 110) current = item.id
    else break
  }
  activeId.value = current
}

function onScroll(): void {
  if (frame) return
  frame = requestAnimationFrame(() => {
    frame = 0
    updateActive()
  })
}

watch(
  scrollTarget,
  (container, previous) => {
    if (previous) previous.removeEventListener('scroll', onScroll)
    if (container) {
      container.addEventListener('scroll', onScroll, { passive: true })
      void nextTick(updateActive)
    }
  },
  { immediate: true },
)

watch(
  () => items.value,
  async () => {
    await nextTick()
    updateActive()
  },
)

onUnmounted(() => {
  scrollTarget.value?.removeEventListener('scroll', onScroll)
  if (frame) cancelAnimationFrame(frame)
})

function goTo(id: string, event: MouseEvent): void {
  event.preventDefault()
  activeId.value = id
  const container = scrollTarget.value
  if (!container) return
  const element = container.querySelector<HTMLElement>(`#${CSS.escape(id)}`)
  if (!element) return
  const top =
    element.getBoundingClientRect().top -
    container.getBoundingClientRect().top +
    container.scrollTop -
    32
  container.scrollTo({ top: Math.max(0, top), behavior: 'smooth' })
}

function backToTop(): void {
  scrollTarget.value?.scrollTo({ top: 0, behavior: 'smooth' })
}
</script>

<template>
  <aside class="toc">
    <div class="toc-title">本页目录</div>

    <nav v-if="items.length" class="toc-nav">
      <div class="toc-items">
        <a
          v-for="item in items"
          :key="item.id"
          class="toc-item"
          :class="{ active: activeId === item.id }"
          :style="{ paddingLeft: `${14 + item.depth * 12}px` }"
          :href="`#${item.id}`"
          :title="item.text"
          @click="goTo(item.id, $event)"
        >
          {{ item.text }}
        </a>
      </div>
    </nav>

    <div v-else class="toc-empty">当前文档没有二级标题</div>

    <button class="back-top" type="button" @click="backToTop">
      <ArrowUpOutlined />
      回到顶部
    </button>
  </aside>
</template>

<style scoped>
.toc {
  height: 100%;
  display: flex;
  flex-direction: column;
  min-width: 0;
  padding: 26px 24px 20px 26px;
  background: #fff;
}

.toc-title {
  font-size: 14.5px;
  font-weight: 600;
  color: var(--aw-text);
  margin-bottom: 12px;
  letter-spacing: 0.01em;
}

.toc-nav {
  flex: 1;
  min-height: 0;
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 1px;
  padding: 2px 0;
  scrollbar-width: none;
}

.toc-nav::-webkit-scrollbar {
  display: none;
}

.toc-items {
  border-left: 1px solid var(--aw-line);
  display: flex;
  flex-direction: column;
  gap: 1px;
  padding: 2px 0;
}

.toc-item {
  display: block;
  padding: 6px 0 6px 14px;
  font-size: 13.5px;
  line-height: 1.55;
  color: var(--aw-text-3);
  transition: color var(--aw-transition);
}

.toc-item:hover {
  color: var(--aw-text);
}

.toc-item.active {
  color: var(--aw-text);
  font-weight: 600;
}

.toc-empty {
  flex: 1;
  font-size: 13px;
  color: var(--aw-text-4);
  line-height: 1.7;
}

.back-top {
  flex: 0 0 auto;
  margin-top: 18px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: 0;
  background: transparent;
  padding: 0;
  color: var(--aw-text-3);
  font-size: 13px;
  cursor: pointer;
}

.back-top:hover {
  color: var(--aw-text);
}
</style>
