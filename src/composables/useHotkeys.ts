import { onMounted, onUnmounted } from 'vue'
import { useUiStore } from '@/stores/ui'

/** 只读站点快捷键：聚焦搜索、折叠目录 */
export function useHotkeys(): void {
  const ui = useUiStore()

  function onKeydown(event: KeyboardEvent): void {
    const meta = event.metaKey || event.ctrlKey
    const key = event.key.toLowerCase()

    if (meta && key === 'k') {
      event.preventDefault()
      ui.focusSearch()
      return
    }

    if (meta && key === 'b') {
      event.preventDefault()
      ui.toggleLeft()
    }
  }

  onMounted(() => window.addEventListener('keydown', onKeydown))
  onUnmounted(() => window.removeEventListener('keydown', onKeydown))
}
