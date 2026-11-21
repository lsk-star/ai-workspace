import { computed, ref, toValue } from 'vue'
import type { MaybeRefOrGetter } from 'vue'
import { message } from 'ant-design-vue'
import { normalizeTargets, type FileEditorTarget, type RuleTarget } from '@/lib/harness'

export interface SaveResult {
  ok: boolean
  /** 写入失败原因；为空表示当前环境不支持写入（静态托管） */
  error?: string
}

/**
 * 页面内编辑本地配置文件的通用逻辑（开发 / 预览服务的 /api/harness 通道）。
 * 静态托管没有写接口：读取退化为内置模板，保存交由调用方提示复制 / 下载。
 * targets 支持响应式清单（Harness 规则下拉会动态增删）。
 */
export function useFileEditor(targets: MaybeRefOrGetter<FileEditorTarget[]>) {
  const targetList = computed(() => toValue(targets))
  const contents = ref<Record<string, string>>({})
  const updatedAt = ref<Record<string, string>>({})
  const loading = ref(true)
  const saving = ref(false)

  function limitOf(key: string): number {
    return targetList.value.find((target) => target.key === key)?.limit ?? 0
  }

  function contentOf(key: string, fallback: string): string {
    return contents.value[key] ?? fallback
  }

  /** 枚举服务端规则清单（本地 dev / preview 服务）；静态托管返回 null，由调用方兜底 */
  async function loadTargetList(): Promise<RuleTarget[] | null> {
    try {
      const response = await fetch('/api/harness?target=list')
      if (!response.ok) throw new Error('未提供写入服务')
      const payload = (await response.json()) as { ok?: boolean; targets?: unknown }
      if (!payload.ok) throw new Error('读取失败')
      const listed = normalizeTargets(payload.targets)
      if (!listed.length) throw new Error('清单为空')
      return listed
    } catch {
      return null
    }
  }

  async function loadTarget(key: string, fallback: string): Promise<void> {
    try {
      const response = await fetch(`/api/harness?target=${encodeURIComponent(key)}`)
      if (!response.ok) throw new Error('未提供写入服务')
      const payload = (await response.json()) as {
        ok?: boolean
        content?: string
        updated?: string
      }
      if (!payload.ok || typeof payload.content !== 'string') {
        throw new Error('读取失败')
      }
      // 文件尚不存在的规则返回空内容：dev 下以服务端为准，不再退回构建期模板
      contents.value = { ...contents.value, [key]: payload.content }
      if (payload.updated) {
        updatedAt.value = { ...updatedAt.value, [key]: payload.updated }
      }
    } catch {
      contents.value = { ...contents.value, [key]: fallback }
    }
  }

  async function loadAll(fallbacks: Record<string, string>): Promise<void> {
    await Promise.all(
      targetList.value.map((target) => loadTarget(target.key, fallbacks[target.key] ?? '')),
    )
    loading.value = false
  }

  async function save(key: string, content: string): Promise<SaveResult> {
    const limit = limitOf(key)
    if (!content.trim()) return { ok: false, error: '内容不能为空' }
    if (limit && content.length > limit) {
      return { ok: false, error: `超过 ${limit} 字符上限` }
    }
    saving.value = true
    try {
      const response = await fetch(`/api/harness?target=${encodeURIComponent(key)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      })
      const payload = (await response.json()) as { ok?: boolean; error?: string }
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || '写入失败')
      }
      contents.value = { ...contents.value, [key]: content }
      updatedAt.value = { ...updatedAt.value, [key]: new Date().toISOString() }
      return { ok: true }
    } catch (error) {
      const detail =
        error instanceof Error && !(error instanceof TypeError) ? error.message : ''
      return { ok: false, error: detail }
    } finally {
      saving.value = false
    }
  }

  async function copyText(text: string, file: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text)
      message.success(`已复制 ${file}`)
    } catch {
      message.warning('浏览器拒绝访问剪贴板')
    }
  }

  function downloadText(text: string, file: string): void {
    const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = file.split('/').pop() || 'config.md'
    link.click()
    URL.revokeObjectURL(url)
    message.success('已下载配置文件')
  }

  return {
    targets: targetList,
    contents,
    updatedAt,
    loading,
    saving,
    contentOf,
    loadTargetList,
    loadTarget,
    loadAll,
    save,
    copyText,
    downloadText,
  }
}

export function formatUpdated(value?: string): string {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`
}
