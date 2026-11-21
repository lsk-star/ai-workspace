<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { message } from 'ant-design-vue'
import {
  CopyOutlined,
  DownloadOutlined,
  EditOutlined,
  PlusOutlined,
  SaveOutlined,
} from '@ant-design/icons-vue'
import MarkdownPreview from '@/components/doc/MarkdownPreview.vue'
import { useDocStore } from '@/stores/doc'
import { useMarkdownRender } from '@/composables/useMarkdownRender'
import { formatUpdated, useFileEditor } from '@/composables/useFileEditor'
import {
  fallbackContents,
  HARNESS_LIMIT,
  isValidRuleName,
  staticTargets,
  type RuleTarget,
} from '@/lib/harness'

type Mode = 'preview' | 'edit'

const targets = ref<RuleTarget[]>(staticTargets())
const targetKey = ref(targets.value[0]?.key ?? 'workspace')
const mode = ref<Mode>('preview')
const draft = ref('')

const editor = useFileEditor(targets)
const { contents, updatedAt, loading, saving } = editor
const doc = useDocStore()

/** 常用规则的说明；新建规则按文件名自述，不强制登记 */
const RULE_HINTS: Record<string, string> = {
  workspace: '所有项目通用：检索顺序、沉淀规则、禁止项',
  frontend: '前端技术栈、目录、代码风格与测试',
  backend: '后端分层、错误处理、数据与测试',
  design: '设计取舍、交互与视觉约定',
}

const current = computed(
  () => targets.value.find((item) => item.key === targetKey.value) ?? targets.value[0],
)
const limit = computed(() => current.value?.limit ?? 0)
const currentHint = computed(() => RULE_HINTS[current.value?.key ?? ''] ?? '')
const currentContent = computed(() => {
  const value = contents.value[targetKey.value]
  if (value !== undefined) return value
  return fallbackContents[targetKey.value] ?? ''
})
const emptyContent = computed(() => !currentContent.value.trim())
const dirty = computed(
  () => mode.value === 'edit' && draft.value !== contents.value[targetKey.value],
)
const previewOverLimit = computed(() => limit.value > 0 && currentContent.value.length > limit.value)
const draftOverLimit = computed(() => limit.value > 0 && draft.value.length > limit.value)
const sizeText = computed(() => {
  const length = mode.value === 'edit' ? draft.value.length : currentContent.value.length
  return limit.value ? `${length} / ${limit.value} 字符` : `${length} 字符`
})
const sizeOver = computed(() =>
  mode.value === 'edit' ? draftOverLimit.value : previewOverLimit.value,
)

const selectOptions = computed(() =>
  targets.value.map((item) => ({
    label: item.exists ? item.label : `${item.label}（暂无内容）`,
    value: item.key,
  })),
)

const rendered = useMarkdownRender(
  currentContent,
  computed(() => current.value?.file ?? ''),
)
const renderedHtml = rendered.html

watch(
  rendered.headings,
  (value) => doc.setHeadings(value),
  { immediate: true },
)

onMounted(async () => {
  // 服务端规则清单优先（本地 dev / preview 服务）；静态托管退回构建期清单
  const listed = await editor.loadTargetList()
  if (listed && listed.length) {
    targets.value = listed
    if (!listed.some((item) => item.key === targetKey.value)) {
      targetKey.value = listed[0]?.key ?? 'workspace'
    }
  }
  await editor.loadAll(fallbackContents)
  window.addEventListener('keydown', onKeydown)
})

watch(targetKey, () => {
  mode.value = 'preview'
  draft.value = ''
})

/** 受控下拉：切换失败（有未保存修改）时不更新 value，选项自动回弹 */
function selectTarget(key: unknown): void {
  const next = String(key)
  if (next === targetKey.value) return
  if (dirty.value) {
    message.warning('请先保存或取消当前修改')
    return
  }
  targetKey.value = next
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
  if (draftOverLimit.value) {
    message.error(
      `超过 ${limit.value} 字符上限：请把稳定的细节拆到附属文档，主文件只留清单`,
    )
    return
  }
  const result = await editor.save(targetKey.value, draft.value)
  if (result.ok) {
    mode.value = 'preview'
    if (current.value) current.value.exists = true
    message.success(`已写入 ${current.value?.file ?? ''}`)
  } else {
    message.error(
      result.error
        ? `写入失败：${result.error}`
        : '当前环境不支持直接写入，请复制或下载后手动保存',
    )
  }
}

function currentText(): string {
  return mode.value === 'edit' ? draft.value : currentContent.value
}

function copyContent(): void {
  void editor.copyText(currentText(), current.value?.file ?? '')
}

function download(): void {
  editor.downloadText(currentText(), current.value?.file ?? '')
}

function onKeydown(event: KeyboardEvent): void {
  const meta = event.metaKey || event.ctrlKey
  if (mode.value === 'edit' && meta && event.key.toLowerCase() === 's') {
    event.preventDefault()
    void save()
  }
}

const createOpen = ref(false)
const newName = ref('')

function openCreate(): void {
  if (dirty.value) {
    message.warning('请先保存或取消当前修改')
    return
  }
  newName.value = ''
  createOpen.value = true
}

function confirmCreate(): void {
  if (!createOpen.value) return
  const name = newName.value.trim()
  if (!name) {
    message.warning('请输入规则名')
    return
  }
  if (!isValidRuleName(name)) {
    message.error('名称只能包含中文、字母、数字、- 或 _，且不能包含空格和斜杠')
    return
  }
  if (targets.value.some((item) => item.key === name)) {
    message.error(`规则「${name}」已存在`)
    return
  }
  targets.value.push({
    key: name,
    file: `harness/${name}.md`,
    label: name,
    exists: false,
    limit: HARNESS_LIMIT,
  })
  targetKey.value = name
  createOpen.value = false
  // 等受控 watch 把模式复位后，直接进入编辑写第一版
  void nextTick(() => void startEdit())
}

onUnmounted(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <div class="harness">
    <header class="harness-head">
      <div class="head-copy">
        <span class="eyebrow">PERSONAL HARNESS</span>
        <h1>Harness 配置</h1>
        <p>下拉选择要编辑的规则：工作区规则对应根目录 <code>AGENTS.md</code>，其余规则是 <code>harness/</code> 下的规则文件。保存直接写文件，下一次 AI 会话即可生效；规则主文件上限 {{ HARNESS_LIMIT }} 字符，超出请拆分到附属文档。</p>
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

    <div class="target-bar">
      <a-select
        class="rule-select"
        :value="targetKey"
        size="large"
        show-search
        option-filter-prop="label"
        :options="selectOptions"
        @change="selectTarget"
      />
      <a-button size="large" @click="openCreate">
        <template #icon><PlusOutlined /></template>
        新建规则
      </a-button>
      <span v-if="currentHint" class="target-hint">{{ currentHint }}</span>
    </div>

    <div class="file-bar">
      <code>{{ current?.file }}</code>
      <span v-if="updatedAt[targetKey]" class="file-updated">
        更新于 {{ formatUpdated(updatedAt[targetKey]) }}
      </span>
      <span class="file-size" :class="{ over: sizeOver }">{{ sizeText }}</span>
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
      <div v-if="emptyContent" class="empty-rule">
        <p class="empty-title">该规则还没有内容</p>
        <p class="empty-desc">
          点「编辑配置」写入第一版；保存后创建
          <code>{{ current?.file }}</code>
          ，AI 在相关任务里读取。也可以先「新建规则」沉淀新的主题。
        </p>
      </div>
      <MarkdownPreview v-else :html="renderedHtml" />
    </div>

    <div v-else class="editor">
      <a-alert
        v-if="draftOverLimit"
        class="limit-alert"
        type="warning"
        show-icon
        :message="`当前 ${draft.length} 字符，超过 ${limit} 上限`"
        description="把稳定的细节拆到 harness/ 下按主题命名的附属文档（如 harness/frontend/），主文件只留「附属文档清单」；精简后再保存。"
      />
      <a-textarea
        v-model:value="draft"
        class="code-area"
        :rows="24"
        spellcheck="false"
        placeholder="填写配置内容……"
      />
      <div class="edit-foot">
        <span>保存后直接写入 <code>{{ current?.file }}</code>；也可复制或下载后手动提交。</span>
        <span :class="{ 'over-text': draftOverLimit }">
          {{ sizeText }} · ⌘/Ctrl+S 保存
        </span>
      </div>
    </div>

    <a-modal
      v-model:open="createOpen"
      title="新建规则"
      ok-text="创建"
      cancel-text="取消"
      @ok="confirmCreate"
    >
      <p class="modal-desc">
        规则保存为 <code>harness/规则名.md</code>，名称同时用于下拉显示与 AI 按任务读取。
      </p>
      <a-input
        v-model:value="newName"
        placeholder="如：测试规则、运维规则"
        @press-enter="confirmCreate"
      />
    </a-modal>
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

.harness-head code {
  font-family: var(--aw-font-mono);
  font-size: 12.5px;
  color: var(--aw-text);
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

.target-bar {
  margin-top: 26px;
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.rule-select {
  width: 240px;
}

.target-hint {
  font-size: 12.5px;
  color: var(--aw-text-3);
}

.file-bar {
  margin-top: 14px;
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  padding: 9px 12px;
  border: 1px solid var(--aw-line);
  border-bottom: 0;
  border-radius: 10px 10px 0 0;
  background: var(--aw-bg-soft);
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

.file-size {
  color: var(--aw-text-4);
  font-variant-numeric: tabular-nums;
}

.file-size.over {
  color: #d46b08;
  font-weight: 600;
}

.limit-alert {
  margin: 14px 18px 0;
}

.over-text {
  color: #d46b08;
  font-weight: 600;
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
  background: var(--aw-bg);
}

.preview {
  padding: 26px 30px 34px;
}

.editor {
  padding: 0;
  overflow: hidden;
}

.empty-rule {
  padding: 42px 24px;
  text-align: center;
}

.empty-title {
  margin: 0 0 8px;
  font-size: 15px;
  font-weight: 600;
  color: var(--aw-text-2);
}

.empty-desc {
  margin: 0 auto;
  max-width: 460px;
  font-size: 13px;
  line-height: 1.8;
  color: var(--aw-text-3);
}

.empty-desc code {
  font-family: var(--aw-font-mono);
  font-size: 12px;
  color: var(--aw-text-2);
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
  background: var(--aw-bg-soft);
  font-size: 12.5px;
  color: var(--aw-text-3);
}

.edit-foot code {
  font-family: var(--aw-font-mono);
  font-size: 11.5px;
  color: var(--aw-text-2);
}

.modal-desc {
  margin: 0 0 12px;
  font-size: 13px;
  line-height: 1.7;
  color: var(--aw-text-3);
}

.modal-desc code {
  font-family: var(--aw-font-mono);
  font-size: 12px;
  color: var(--aw-text-2);
}

.loading {
  padding: 24px;
  border: 1px solid var(--aw-line);
  border-radius: 0 0 10px 10px;
}

@media (max-width: 760px) {
  .rule-select {
    width: 100%;
  }

  .target-bar :deep(.ant-btn) {
    width: 100%;
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
