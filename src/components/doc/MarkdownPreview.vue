<script setup lang="ts">
import { useRouter } from 'vue-router'

const props = defineProps<{
  html: string
}>()

const router = useRouter()

function onClick(event: MouseEvent): void {
  const anchor = (event.target as HTMLElement).closest('a')
  if (!anchor) return

  const mdPath = anchor.getAttribute('data-md-path')
  if (mdPath) {
    event.preventDefault()
    void router.push({ name: 'doc', params: { pathMatch: mdPath.split('/') } })
    return
  }

  const href = anchor.getAttribute('href') || ''
  if (href.startsWith('#')) {
    event.preventDefault()
    const id = decodeURIComponent(href.slice(1))
    const heading = document.getElementById(id)
    heading?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
}
</script>

<template>
  <article class="markdown-body" v-html="props.html" @click="onClick" />
</template>
