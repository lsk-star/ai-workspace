import { onScopeDispose, ref, watch } from 'vue'
import type { Ref } from 'vue'
import type { Heading } from '@/types/content'
import { renderMarkdown } from '@/lib/markdown'
import { dirname, normalizePath, resolveAssetPath } from '@/lib/paths'

/**
 * 只读内容渲染：图片直接映射到 public 目录，无需文件系统授权。
 */
export function useMarkdownRender(source: Ref<string>, docPath: Ref<string>) {
  const html = ref('')
  const headings = ref<Heading[]>([])
  const error = ref('')

  let generation = 0
  let timer: ReturnType<typeof setTimeout> | undefined

  async function resolveAsset(target: string): Promise<string | null> {
    if (/^(https?:|data:|blob:)/i.test(target)) return target
    const resolved = resolveAssetPath(dirname(docPath.value), target)
    if (!resolved) return null
    return `/${normalizePath(resolved)}`
  }

  async function renderNow(): Promise<void> {
    const current = ++generation
    const text = source.value
    if (!text) {
      html.value = ''
      headings.value = []
      return
    }
    try {
      const result = await renderMarkdown(text, {
        docPath: docPath.value,
        resolveAsset,
      })
      if (current !== generation) return
      html.value = result.html
      headings.value = result.headings
      error.value = ''
    } catch (err) {
      if (current === generation) {
        error.value = err instanceof Error ? err.message : 'Markdown 渲染失败'
      }
    }
  }

  watch(
    [source, docPath],
    () => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => void renderNow(), 0)
    },
    { immediate: true },
  )

  onScopeDispose(() => {
    generation += 1
    if (timer) clearTimeout(timer)
  })

  return { html, headings, error }
}
