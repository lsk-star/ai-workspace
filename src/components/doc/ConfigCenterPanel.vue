<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { message } from 'ant-design-vue'
import {
  DeleteOutlined,
  PlusOutlined,
  SaveOutlined,
} from '@ant-design/icons-vue'
import { formatUpdated, useFileEditor } from '@/composables/useFileEditor'

/** workspace.json 里的一条工程登记 */
interface ProjectEntry {
  id: string
  name: string
  location: string
  description: string
}

const CONFIG_FILE = 'workspace.json'
const EMPTY_CONFIG = '{\n  "projects": []\n}'

const editor = useFileEditor([{ key: 'projects', file: CONFIG_FILE }])
const { loading, saving, updatedAt } = editor

const entries = ref<ProjectEntry[]>([])
/** 最近一次保存（或读取）到的序列化结果，用于脏检查 */
const savedSnapshot = ref('')

function normalize(raw: unknown): ProjectEntry {
  const item = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>
  return {
    id: typeof item.id === 'string' ? item.id.trim() : '',
    name: typeof item.name === 'string' ? item.name.trim() : '',
    location: typeof item.location === 'string' ? item.location.trim() : '',
    description: typeof item.description === 'string' ? item.description.trim() : '',
  }
}

function serialize(list: ProjectEntry[]): string {
  return `${JSON.stringify({ projects: list }, null, 2)}\n`
}

function parse(text: string): ProjectEntry[] {
  try {
    const data = JSON.parse(text) as { projects?: unknown }
    if (!Array.isArray(data.projects)) return []
    return data.projects.map(normalize)
  } catch {
    return []
  }
}

const dirty = computed(() => serialize(entries.value) !== savedSnapshot.value)

function addRow(): void {
  entries.value.push({ id: '', name: '', location: '', description: '' })
}

function removeRow(index: number): void {
  entries.value.splice(index, 1)
}

function validate(): string | null {
  const seen = new Set<string>()
  for (const [index, entry] of entries.value.entries()) {
    const row = index + 1
    if (!entry.id) return `第 ${row} 行缺少工程编号`
    if (!entry.location) return `第 ${row} 行缺少工程位置`
    const key = entry.id.toLowerCase()
    if (seen.has(key)) return `工程编号「${entry.id}」重复`
    seen.add(key)
  }
  return null
}

async function save(): Promise<void> {
  const error = validate()
  if (error) {
    message.error(error)
    return
  }
  const serialized = serialize(entries.value)
  const result = await editor.save('projects', serialized)
  if (result.ok) {
    savedSnapshot.value = serialized
    message.success(`已写入 ${CONFIG_FILE}`)
  } else {
    message.error(
      result.error
        ? `写入失败：${result.error}`
        : '当前环境不支持直接写入，请在仓库中直接编辑 workspace.json',
    )
  }
}

onMounted(async () => {
  await editor.loadAll({ projects: EMPTY_CONFIG })
  entries.value = parse(editor.contentOf('projects', EMPTY_CONFIG))
  savedSnapshot.value = serialize(entries.value)
})
</script>

<template>
  <div class="config-center">
    <header class="cc-head">
      <div class="head-copy">
        <span class="eyebrow">CONFIG CENTER</span>
        <h1>配置中心</h1>
        <p>
          登记本项目的代码工程：编号、名称、位置与描述。这是<strong>可选配置</strong>——不填不影响工作区使用；填了以后，AI
          只需要以工作区目录为起点，读取根目录 <code>{{ CONFIG_FILE }}</code>
          就能定位所有代码工程，不用在对话里重复说明路径。
        </p>
      </div>
      <div class="head-actions">
        <a-button
          type="primary"
          size="large"
          class="primary-action"
          :loading="saving"
          :disabled="!dirty"
          @click="save"
        >
          <template #icon><SaveOutlined /></template>
          保存
        </a-button>
      </div>
    </header>

    <div class="file-bar">
      <code>{{ CONFIG_FILE }}</code>
      <span v-if="updatedAt.projects" class="file-updated">
        更新于 {{ formatUpdated(updatedAt.projects) }}
      </span>
      <span v-if="dirty" class="file-dirty">未保存</span>
    </div>

    <div v-if="loading" class="loading">
      <a-skeleton active :paragraph="{ rows: 4 }" />
    </div>

    <template v-else>
      <div v-if="entries.length" class="rows">
        <div class="row row-head">
          <span>编号</span>
          <span>名称</span>
          <span>位置</span>
          <span>描述</span>
          <span />
        </div>
        <div v-for="(entry, index) in entries" :key="index" class="row">
          <a-input v-model:value="entry.id" placeholder="如 web、api" />
          <a-input v-model:value="entry.name" placeholder="如 图书服务" />
          <a-input
            v-model:value="entry.location"
            class="row-loc"
            placeholder="相对工作区根目录，如 ../book-server"
          />
          <a-input v-model:value="entry.description" placeholder="一句话职责（可选）" />
          <button
            class="row-delete"
            type="button"
            title="删除该行"
            @click="removeRow(index)"
          >
            <DeleteOutlined />
          </button>
        </div>
      </div>

      <div v-else class="empty">
        <p class="empty-title">还没有登记工程</p>
        <p class="empty-desc">
          点「新增工程」逐行填写；位置推荐写相对工作区根目录的路径，例如 ../book-server。
        </p>
      </div>

      <div class="rows-foot">
        <a-button @click="addRow">
          <template #icon><PlusOutlined /></template>
          新增工程
        </a-button>
        <span class="foot-hint">
          编号是唯一标识，其他资料引用工程一律用编号；密钥、账号不写进本文件。纯静态托管时请在仓库中直接编辑
          <code>{{ CONFIG_FILE }}</code>。
        </span>
      </div>
    </template>
  </div>
</template>

<style scoped>
.config-center {
  padding-bottom: 24px;
}

.cc-head {
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

.cc-head h1 {
  margin: 8px 0 8px;
  font-size: 30px;
  font-weight: 650;
  letter-spacing: -0.02em;
  color: var(--aw-text);
}

.cc-head p {
  margin: 0;
  max-width: 560px;
  font-size: 14.5px;
  line-height: 1.8;
  color: var(--aw-text-2);
}

.cc-head code,
.foot-hint code {
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

.file-bar {
  margin-top: 26px;
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  padding: 9px 12px;
  border: 1px solid var(--aw-line);
  border-radius: 10px 10px 0 0;
  border-bottom: 0;
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

.file-dirty {
  color: var(--aw-tag-text);
  background: var(--aw-tag-bg);
  border: 1px solid var(--aw-tag-line);
  border-radius: 4px;
  padding: 1px 6px;
}

.loading,
.rows,
.empty {
  border: 1px solid var(--aw-line);
  border-radius: 0 0 10px 10px;
  background: var(--aw-bg);
}

.loading {
  padding: 24px;
}

.rows {
  padding: 14px 16px 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.row {
  display: grid;
  grid-template-columns: 130px 1fr 1.5fr 1.2fr 34px;
  gap: 8px;
  align-items: center;
}

.row-head {
  font-size: 12px;
  color: var(--aw-text-3);
  padding: 0 0 2px;
}

.row-loc :deep(input) {
  font-family: var(--aw-font-mono);
  font-size: 12.5px;
}

.row-delete {
  width: 30px;
  height: 30px;
  display: grid;
  place-items: center;
  border: 1px solid var(--aw-line);
  border-radius: 6px;
  background: transparent;
  color: var(--aw-text-3);
  cursor: pointer;
  transition: color var(--aw-transition), border-color var(--aw-transition);
}

.row-delete:hover {
  color: var(--aw-text);
  border-color: var(--aw-line-strong);
}

.empty {
  padding: 28px 20px;
}

.empty-title {
  margin: 0 0 6px;
  font-size: 14.5px;
  color: var(--aw-text-2);
}

.empty-desc {
  margin: 0;
  font-size: 13px;
  line-height: 1.7;
  color: var(--aw-text-3);
}

.rows-foot {
  margin-top: 14px;
  display: flex;
  align-items: flex-start;
  gap: 12px;
  flex-wrap: wrap;
}

.foot-hint {
  flex: 1;
  min-width: 260px;
  font-size: 12.5px;
  line-height: 1.7;
  color: var(--aw-text-3);
}

@media (max-width: 860px) {
  .row {
    grid-template-columns: 1fr 1fr;
  }

  .row-head {
    display: none;
  }

  .row-loc {
    grid-column: 1 / -1;
  }
}
</style>
