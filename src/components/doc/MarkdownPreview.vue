<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useUiStore } from '@/stores/ui'

type MermaidAPI = typeof import('mermaid')['default']

const props = defineProps<{
  html: string
}>()

const router = useRouter()
const ui = useUiStore()
const root = ref<HTMLElement | null>(null)

let mermaid: MermaidAPI | null = null
/** 已按哪个主题初始化过 mermaid，切换主题时重新着色 */
let initializedTheme = ''
/** 渲染代数：html 快速变化时丢弃过期渲染结果 */
let generation = 0

async function ensureMermaid(theme: 'default' | 'dark'): Promise<MermaidAPI | null> {
  try {
    if (!mermaid) mermaid = (await import('mermaid')).default
    if (initializedTheme !== theme) {
      mermaid.initialize({
        startOnLoad: false,
        theme,
        securityLevel: 'strict',
        fontFamily: 'inherit',
      })
      initializedTheme = theme
    }
    return mermaid
  } catch {
    // 动态加载失败：保留源码块展示
    return null
  }
}

/** 把一个占位块渲染成 SVG；源码节点保留为隐藏副本，失败时回退展示 */
async function renderBlock(instance: MermaidAPI, block: HTMLElement, index: number): Promise<void> {
  const sourceEl = block.querySelector('pre.mermaid-source')
  const source = (sourceEl?.textContent || '').trim()
  if (!source || !sourceEl) return

  try {
    const { svg } = await instance.render(`mermaid-${Date.now()}-${index}`, source)
    block.classList.remove('mermaid-failed')
    block.innerHTML = `<div class="mermaid-figure">${svg}</div>`
    block.prepend(sourceEl)
  } catch (error) {
    block.classList.add('mermaid-failed')
    const reason = error instanceof Error ? error.message.split('\n')[0] : '渲染失败'
    block.innerHTML = `<div class="mermaid-error">图表渲染失败：${reason}</div>`
    block.prepend(sourceEl)
  }
}

/** 渲染容器内所有 mermaid 占位块（跳过已有图形或已标记失败的块） */
async function renderMermaid(): Promise<void> {
  const container = root.value
  if (!container) return
  const blocks = Array.from(container.querySelectorAll<HTMLElement>('.mermaid-block')).filter(
    (block) => !block.querySelector('.mermaid-figure') && !block.classList.contains('mermaid-failed'),
  )
  if (!blocks.length) return

  const current = ++generation
  const instance = await ensureMermaid(ui.isDark ? 'dark' : 'default')
  if (!instance || current !== generation) return

  for (const [index, block] of blocks.entries()) {
    if (current !== generation) return
    await renderBlock(instance, block, index)
  }
}

/** 深浅色切换：清掉旧图，用保留的源码按新主题重渲 */
function resetForThemeChange(): void {
  initializedTheme = ''
  root.value
    ?.querySelectorAll<HTMLElement>('.mermaid-block')
    .forEach((block) => {
      block.classList.remove('mermaid-failed')
      block.querySelectorAll('.mermaid-figure, .mermaid-error').forEach((el) => el.remove())
    })
  void renderMermaid()
}

watch(
  () => props.html,
  () => {
    const current = ++generation
    void nextTick(() => {
      if (current === generation) void renderMermaid()
    })
  },
  { immediate: true },
)

watch(
  () => ui.isDark,
  () => {
    void nextTick(resetForThemeChange)
  },
)

onBeforeUnmount(() => {
  generation += 1
})

function anchorId(hash: string): string {
  if (!hash) return ''
  const raw = hash.replace(/^#/, '')
  try {
    return decodeURIComponent(raw)
  } catch {
    return raw
  }
}

/** 目标文档渲染是异步的，短时间内重试等锚点出现 */
async function scrollToAnchor(id: string): Promise<void> {
  for (let i = 0; i < 20; i += 1) {
    const element = document.getElementById(id)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' })
      return
    }
    await new Promise((resolve) => setTimeout(resolve, 50))
  }
}

function onClick(event: MouseEvent): void {
  const anchor = (event.target as HTMLElement).closest('a')
  if (!anchor) return

  const mdPath = anchor.getAttribute('data-md-path')
  if (mdPath) {
    event.preventDefault()
    const id = anchorId(anchor.getAttribute('data-md-hash') || '')
    void router
      .push({ name: 'doc', params: { pathMatch: mdPath.split('/') } })
      .then(() => {
        if (id) void scrollToAnchor(id)
      })
      .catch(() => undefined)
    return
  }

  const href = anchor.getAttribute('href') || ''
  if (href.startsWith('#')) {
    event.preventDefault()
    const id = anchorId(href)
    if (id) void scrollToAnchor(id)
  }
}
</script>

<template>
  <article ref="root" class="markdown-body" v-html="props.html" @click="onClick" />
</template>
