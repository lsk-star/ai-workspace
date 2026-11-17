import { shallowRef } from 'vue'

/** 当前预览滚动容器，供目录组件做滚动定位与高亮 */
const previewEl = shallowRef<HTMLElement | null>(null)

export function useDocScrollTarget() {
  return previewEl
}

export function setDocScrollTarget(el: HTMLElement | null | undefined): void {
  previewEl.value = el ?? null
}
