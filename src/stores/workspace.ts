import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { useLocalStorage } from '@vueuse/core'
import type { RecentDoc, SearchHit } from '@/types/content'
import { SPACE, ancestorPaths, categories, docs, searchDocs, snippetOf } from '@/lib/content'

const DEFAULT_EXPANDED = [
  '开始阅读',
  '技术空间',
  '技术空间/前端',
  '技术空间/后端',
  '空间配置',
]

export const useWorkspaceStore = defineStore('workspace', () => {
  const query = ref('')
  const scope = useLocalStorage<string>('aw2:scope', '全部资料')
  const expandedKeys = useLocalStorage<string[]>('aw2:expanded-v2', DEFAULT_EXPANDED)
  const activePath = ref('')
  const recent = useLocalStorage<RecentDoc[]>('aw2:recent', [])

  const categoryOptions = computed(() => [
    { label: `全部资料 · ${docs.length}`, value: '全部资料' },
    ...categories.map((category) => ({
      label: `${category} · ${docs.filter((doc) => doc.category === category).length}`,
      value: category,
    })),
  ])

  const results = computed<SearchHit[]>(() => {
    const keyword = query.value.trim()
    if (!keyword) return []
    return searchDocs(keyword, scope.value).map((doc) => ({
      doc,
      snippet: snippetOf(doc, keyword),
    }))
  })

  const searching = computed(() => query.value.trim().length > 0)

  const fileCount = computed(() =>
    docs.filter((doc) => scope.value === '全部资料' || doc.category === scope.value).length,
  )

  function remember(doc: { path: string; title: string }): void {
    const next = recent.value.filter((item) => item.path !== doc.path)
    next.unshift({ path: doc.path, title: doc.title, at: Date.now() })
    recent.value = next.slice(0, 8)
  }

  function setActive(path: string): void {
    activePath.value = path
    const ancestors = ancestorPaths(path)
    const merged = new Set([...expandedKeys.value, ...ancestors])
    if (merged.size !== expandedKeys.value.length) {
      expandedKeys.value = [...merged]
    }
  }

  function toggleExpanded(path: string): void {
    const set = new Set(expandedKeys.value)
    if (set.has(path)) set.delete(path)
    else set.add(path)
    expandedKeys.value = [...set]
  }

  function resetSearch(): void {
    query.value = ''
  }

  return {
    space: SPACE,
    query,
    scope,
    expandedKeys,
    activePath,
    recent,
    categoryOptions,
    results,
    searching,
    fileCount,
    remember,
    setActive,
    toggleExpanded,
    resetSearch,
  }
})
