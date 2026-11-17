import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useLocalStorage } from '@vueuse/core'

export const DEFAULT_LEFT_WIDTH = 262
export const MIN_LEFT_WIDTH = 240
export const MAX_LEFT_WIDTH = 440

export const useUiStore = defineStore('ui', () => {
  const leftCollapsed = useLocalStorage<boolean>('aw2:leftCollapsed', false)
  const leftWidth = useLocalStorage<number>('aw2:leftWidth', DEFAULT_LEFT_WIDTH)
  const mobileTreeOpen = ref(false)
  const searchTick = ref(0)

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
    mobileTreeOpen.value = false
    searchTick.value += 1
  }

  return {
    leftCollapsed,
    leftWidth,
    mobileTreeOpen,
    searchTick,
    toggleLeft,
    setLeftWidth,
    focusSearch,
  }
})
