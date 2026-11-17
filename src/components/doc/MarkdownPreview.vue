<script setup lang="ts">
import { useRouter } from 'vue-router'

const props = defineProps<{
  html: string
}>()

const router = useRouter()

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
  <article class="markdown-body" v-html="props.html" @click="onClick" />
</template>
