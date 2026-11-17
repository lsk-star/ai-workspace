<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { message } from 'ant-design-vue'
import {
  CopyOutlined,
  DownloadOutlined,
  EditOutlined,
  SaveOutlined,
} from '@ant-design/icons-vue'
import workspaceAgents from '/AGENTS.md?raw'
import frontendHarness from '/harness/frontend.md?raw'
import backendHarness from '/harness/backend.md?raw'
import MarkdownPreview from '@/components/doc/MarkdownPreview.vue'
import { useDocStore } from '@/stores/doc'
import { useMarkdownRender } from '@/composables/useMarkdownRender'

type TargetKey = 'workspace' | 'frontend' | 'backend'
type Mode = 'preview' | 'edit'

interface HarnessTarget {
  key: TargetKey
  label: string
  file: string
  hint: string
  fallback: string
}

const targets: HarnessTarget[] = [
  {
    key: 'workspace',
    label: '工作区 AGENTS.md',
    file: 'AGENTS.md',
    hint: '所有项目通用：检索顺序、沉淀规则、禁止项',
    fallback: workspaceAgents,
  },
  {
    key: 'frontend',
    label: '前端 harness',
    file: 'harness/frontend.md',
    hint: '前端技术栈、目录、代码风格与测试',
    fallback: frontendHarness,
  },
  {
    key: 'backend',
    label: '后端 harness',
    file: 'harness/backend.md',
    hint: '后端分层、错误处理、数据与测试',
    fallback: backendHarness,
  },
]

const doc = useDocStore()
const target = ref<TargetKey>('workspace')
const mode = ref<Mode>('preview')
const draft = ref('')
const contents = ref<Record<string, string>>({})
const updatedAt = ref<Record<string, string>>({})
const loading = ref(true)
const saving = ref(false)

const current = computed(() => targets.find((item) => item.key === target.value) ?? targets[0])
const currentContent = computed(
  () => contents.value[target.value] ?? current.value.fallback,
)
const dirty = computed(
  () => mode.value === 'edit' && draft.value !== contents.value[target.value],
)

const rendered = useMarkdownRender(
  currentContent,
  computed(() => current.value.file),
)
const renderedHtml = rendered.html

watch(
  rendered.headings,
  (value) => doc.setHeadings(value),
  { immediate: true },
)

function formatUpdated(value?: string): string {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`
}

async function loadTarget(item: HarnessTarget): Promise<void> {
  try {
    const response = await fetch(`/api/harness?target=${item.key}`)
    if (!response.ok) throw new Error('未提供写入服务')
    const payload = (await response.json()) as {
      ok?: boolean
      content?: string
      updated?: string
    }
    if (!payload.ok || typeof payload.content !== 'string') {
      throw new Error('读取失败')
    }
    contents.value = { ...contents.value, [item.key]: payload.content }
    if (payload.updated) {
      updatedAt.value = { ...updatedAt.value, [item.key]: payload.updated }
    }
  } catch {
    contents.value = { ...contents.value, [item.key]: item.fallback }
  }
}

onMounted(async () => {
  await Promise.all(targets.map(loadTarget))
  loading.value = false
})

watch(target, () => {
  mode.value = 'preview'
  draft.value = ''
})

function selectTarget(key: TargetKey): void {
  if (key === target.value) return
  if (dirty.value) {
    message.warning('请先保存或取消当前修改')
    return
  }
  target.value = key
}

async function startEdit(): Promise<void> {
  draft.value = currentContent.value
  mode.value = 'edit'
}

function cancelEdit(): void {
  if (dirty.value) message.info('已取消未保存的修改')
  mode.value = 'preview'
  draft.value = ''
}

async function save(): Promise<void> {
  if (!dirty.value) {
    mode.value = 'preview'
    return
  }
  saving.value = true
  try {
    const response = await fetch(`/api/harness?target=${target.value}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: draft.value }),
    })
    const payload = (await response.json()) as { ok?: boolean; error?: string }
    if (!response.ok || !payload.ok) {
      throw new Error(payload.error || '写入失败')
    }
    contents.value = { ...contents.value, [target.value]: draft.value }
    updatedAt.value = { ...updatedAt.value, [target.value]: new Date().toISOString() }
    mode.value = 'preview'
    message.success(`已写入 ${current.value.file}`)
  } catch {
    message.error('当前环境不支持直接写入，请复制或下载后手动保存')
  } finally {
    saving.value = false
  }
}

function currentText(): string {
  return mode.value === 'edit' ? draft.value : currentContent.value
}

async function copyContent(): Promise<void> {
  try {
    await navigator.clipboard.writeText(currentText())
    message.success(`已复制 ${current.value.file}`)
  } catch {
    message.warning('浏览器拒绝访问剪贴板')
  }
}

function download(): void {
  const blob = new Blob([currentText()], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = current.value.file.split('/').pop() || 'AGENTS.md'
  link.click()
  URL.revokeObjectURL(url)
  message.success('已下载配置文件')
}

function onKeydown(event: KeyboardEvent): void {
  const meta = event.metaKey || event.ctrlKey
  if (mode.value === 'edit' && meta && event.key.toLowerCase() === 's') {
    event.preventDefault()
    void save()
  }
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onUnmounted(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <div class="harness">
    <header class="harness-head">
      <div class="head-copy">
        <span class="eyebrow">PERSONAL HARNESS</span>
        <h1>Harness 配置</h1>
        <p>工作区、前端、后端的个人规则。保存后直接写入对应文件，下一次 AI 会话即可生效。</p>
      </div>

      <div class="head-actions">
        <a-button
          v-if="mode === 'preview'"
          type="primary"
          size="large"
          class="primary-action"
          @click="startEdit"
        >
          <template #icon><EditOutlined /></template>
          编辑配置
        </a-button>
        <template v-else>
          <a-button size="large" @click="cancelEdit">取消</a-button>
          <a-button
            type="primary"
            size="large"
            class="primary-action"
            :loading="saving"
            @click="save"
          >
            <template #icon><SaveOutlined /></template>
            保存配置
          </a-button>
        </template>
      </div>
    </header>

    <div class="target-tabs" role="tablist">
      <button
        v-for="item in targets"
        :key="item.key"
        class="target"
        :class="{ active: target === item.key }"
        type="button"
        role="tab"
        :aria-selected="target === item.key"
        @click="selectTarget(item.key)"
      >
        <span class="target-label">{{ item.label }}</span>
        <span class="target-hint">{{ item.hint }}</span>
      </button>
    </div>

    <div class="file-bar">
      <code>{{ current.file }}</code>
      <span v-if="updatedAt[target]" class="file-updated">
        更新于 {{ formatUpdated(updatedAt[target]) }}
      </span>
      <span v-if="dirty" class="file-dirty">未保存</span>
      <div class="file-actions">
        <a-button size="small" @click="copyContent">
          <template #icon><CopyOutlined /></template>
          复制
        </a-button>
        <a-button size="small" @click="download">
          <template #icon><DownloadOutlined /></template>
          下载
        </a-button>
      </div>
    </div>

    <div v-if="loading" class="loading">
      <a-skeleton active :paragraph="{ rows: 10 }" />
    </div>

    <div v-else-if="mode === 'preview'" class="preview">
      <MarkdownPreview :html="renderedHtml" />
    </div>

    <div v-else class="editor">
      <a-textarea
        v-model:value="draft"
        class="code-area"
        :rows="24"
        spellcheck="false"
        placeholder="填写配置内容……"
      />
      <div class="edit-foot">
        <span>保存后直接写入 <code>{{ current.file }}</code>；也可复制或下载后手动提交。</span>
        <span>{{ draft.length }} 字符 · ⌘/Ctrl+S 保存</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.harness {
  padding-bottom: 24px;
}

.harness-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 24px;
  flex-wrap: wrap;
}

.eyebrow {
  font-size: 11px;
  letter-spacing: 0.14em;
  font-weight: 600;
  color: var(--aw-text-4);
}

.harness-head h1 {
  margin: 8px 0 8px;
  font-size: 30px;
  font-weight: 650;
  letter-spacing: -0.02em;
  color: var(--aw-text);
}

.harness-head p {
  margin: 0;
  max-width: 560px;
  font-size: 14.5px;
  line-height: 1.8;
  color: var(--aw-text-2);
}

.head-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-top: 18px;
  flex-wrap: wrap;
}

.primary-action {
  height: 40px;
  padding: 0 18px;
  font-size: 14.5px;
}

.target-tabs {
  margin-top: 26px;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

.target {
  display: flex;
  flex-direction: column;
  gap: 5px;
  padding: 13px 15px;
  border: 1px solid var(--aw-line);
  border-radius: 10px;
  background: #fff;
  text-align: left;
  cursor: pointer;
  transition: border-color var(--aw-transition), background var(--aw-transition);
}

.target:hover {
  border-color: #c9ccd3;
  background: #fcfcfd;
}

.target.active {
  border-color: #b9bcc4;
  background: var(--aw-bg-soft);
}

.target-label {
  font-size: 14px;
  font-weight: 600;
  color: var(--aw-text);
}

.target-hint {
  font-size: 12px;
  line-height: 1.55;
  color: var(--aw-text-3);
}

.file-bar {
  margin-top: 18px;
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  padding: 9px 12px;
  border: 1px solid var(--aw-line);
  border-bottom: 0;
  border-radius: 10px 10px 0 0;
  background: #fdfdfe;
  font-size: 12.5px;
  color: var(--aw-text-3);
}

.file-bar code {
  font-family: var(--aw-font-mono);
  font-size: 12px;
  color: var(--aw-text-2);
}

.file-updated {
  color: var(--aw-text-4);
}

.file-dirty {
  color: var(--aw-tag-text);
  background: var(--aw-tag-bg);
  border: 1px solid var(--aw-tag-line);
  border-radius: 4px;
  padding: 1px 6px;
}

.file-actions {
  margin-left: auto;
  display: flex;
  gap: 6px;
}

.preview,
.editor {
  border: 1px solid var(--aw-line);
  border-radius: 0 0 10px 10px;
  background: #fff;
}

.preview {
  padding: 26px 30px 34px;
}

.editor {
  padding: 0;
  overflow: hidden;
}

.code-area {
  border: 0 !important;
  border-radius: 0 !important;
  box-shadow: none !important;
  padding: 18px 20px;
  font-family: var(--aw-font-mono);
  font-size: 13px;
  line-height: 1.85;
  resize: vertical;
}

.edit-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  padding: 12px 18px;
  border-top: 1px solid var(--aw-line-soft);
  background: #fdfdfe;
  font-size: 12.5px;
  color: var(--aw-text-3);
}

.edit-foot code {
  font-family: var(--aw-font-mono);
  font-size: 11.5px;
  color: var(--aw-text-2);
}

.loading {
  padding: 24px;
  border: 1px solid var(--aw-line);
  border-radius: 0 0 10px 10px;
}

@media (max-width: 760px) {
  .target-tabs {
    grid-template-columns: 1fr;
  }

  .harness-head h1 {
    font-size: 26px;
  }

  .head-actions {
    padding-top: 0;
    width: 100%;
  }

  .head-actions :deep(.ant-btn) {
    flex: 1;
  }

  .preview {
    padding: 20px 18px 26px;
  }

  .file-actions {
    margin-left: 0;
  }
}
</style>
