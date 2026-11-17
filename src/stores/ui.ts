import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useLocalStorage, useMediaQuery } from '@vueuse/core'

export const DEFAULT_LEFT_WIDTH = 262
export const MIN_LEFT_WIDTH = 240
export const MAX_LEFT_WIDTH = 440

export const useUiStore = defineStore('ui', () => {
  const leftCollapsed = useLocalStorage<boolean>('aw2:leftCollapsed', false)
  const leftWidth = useLocalStorage<number>('aw2:leftWidth', DEFAULT_LEFT_WIDTH)
  const mobileTreeOpen = ref(false)
  const searchPending = ref(false)
  const isNarrow = useMediaQuery('(max-width: 1023px)')

  if (leftWidth.value < MIN_LEFT_WIDTH || leftWidth.value > MAX_LEFT_WIDTH) {
    leftWidth.value = DEFAULT_LEFT_WIDTH
  }

  function toggleLeft(): void {
    leftCollapsed.value = !leftCollapsed.value
    mobileTreeOpen.value = false
  }

  function setLeftWidth(width: number): void {
    leftWidth.value = Math.min(MAX_LEFT_WIDTH, Math.max(MIN_LEFT_WIDTH, Math.round(width)))
  }

  function focusSearch(): void {
    if (leftCollapsed.value) leftCollapsed.value = false
    // 窄屏下目录是抽屉，必须打开才能聚焦搜索框；宽屏忽略该状态
    if (isNarrow.value) mobileTreeOpen.value = true
    searchPending.value = true
  }

  /** 取走一次聚焦请求，避免抽屉每次重新挂载都抢焦点 */
  function consumeSearchFocus(): boolean {
    if (!searchPending.value) return false
    searchPending.value = false
    return true
  }

  return {
    leftCollapsed,
    leftWidth,
    mobileTreeOpen,
    searchPending,
    toggleLeft,
    setLeftWidth,
    focusSearch,
    consumeSearchFocus,
  }
})
