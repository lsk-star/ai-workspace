import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { DocMeta, Heading } from '@/types/content'
import { docMap, entryDoc } from '@/lib/content'
import { useWorkspaceStore } from '@/stores/workspace'

export const useDocStore = defineStore('doc', () => {
  const workspace = useWorkspaceStore()

  const path = ref('')
  const headings = ref<Heading[]>([])
  const missing = ref(false)

  const doc = computed<DocMeta | null>(() => docMap.get(path.value) ?? null)
  const title = computed(() => doc.value?.title ?? '')

  function open(target: string): void {
    const clean = target.replace(/^\/+/, '').replace(/\.md$/i, '')
    path.value = clean
    headings.value = []
    const found = docMap.get(clean)
    missing.value = !found
    if (found) {
      workspace.setActive(found.path)
      workspace.remember(found)
    }
  }

  function openEntry(): void {
    open(entryDoc().path)
  }

  function setHeadings(next: Heading[]): void {
    headings.value = next
  }

  function reset(): void {
    path.value = ''
    headings.value = []
    missing.value = false
  }

  return {
    path,
    headings,
    missing,
    doc,
    title,
    open,
    openEntry,
    setHeadings,
    reset,
  }
})
