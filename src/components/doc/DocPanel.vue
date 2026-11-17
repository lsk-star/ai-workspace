<script setup lang="ts">
import { computed, nextTick, onUnmounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { CopyOutlined } from '@ant-design/icons-vue'
import { message } from 'ant-design-vue'
import MarkdownPreview from '@/components/doc/MarkdownPreview.vue'
import HarnessPanel from '@/components/doc/HarnessPanel.vue'
import { useDocStore } from '@/stores/doc'
import { useWorkspaceStore } from '@/stores/workspace'
import { useMarkdownRender } from '@/composables/useMarkdownRender'
import { setDocScrollTarget } from '@/composables/useDocScroll'

const router = useRouter()
const doc = useDocStore()
const workspace = useWorkspaceStore()

const scrollEl = ref<HTMLElement | null>(null)
const crumbs = computed(() => doc.doc?.folderPath.split('/') ?? [])

const rendered = useMarkdownRender(
  computed(() => doc.doc?.body ?? ''),
  computed(() => doc.path),
)
const renderedHtml = rendered.html

watch(
  rendered.headings,
  (value) => doc.setHeadings(value),
  { immediate: true },
)

watch(scrollEl, (el) => setDocScrollTarget(el), { immediate: true })

watch(
  () => doc.path,
  async () => {
    await nextTick()
    if (scrollEl.value) scrollEl.value.scrollTop = 0
  },
)

onUnmounted(() => {
  setDocScrollTarget(null)
})

async function copyPath(): Promise<void> {
  if (!doc.path) return
  try {
    await navigator.clipboard.writeText(doc.path)
    message.success('已复制文档路径')
  } catch {
    message.warning('浏览器拒绝访问剪贴板')
  }
}

function backHome(): void {
  void router.push({ name: 'doc', params: { pathMatch: workspace.space.entry.split('/') } })
}
</script>

<template>
  <section class="doc-panel">
    <div v-if="doc.missing" class="doc-missing">
      <a-result
        status="404"
        title="没有找到这篇文档"
        :sub-title="doc.path ? `路径：${doc.path}` : '文档可能已被移动或重命名'"
      >
        <template #extra>
          <a-button type="primary" @click="backHome">回到开始阅读</a-button>
        </template>
      </a-result>
    </div>

    <template v-else-if="doc.doc">
      <div ref="scrollEl" class="doc-scroll">
        <div class="doc-inner">
          <div class="crumbs">
            <template v-for="(crumb, index) in crumbs" :key="crumb">
              <span>{{ crumb }}</span>
              <span v-if="index < crumbs.length - 1 || doc.doc.title" class="crumb-sep">›</span>
            </template>
            <span class="crumb-current">{{ doc.doc.title }}</span>
          </div>

          <HarnessPanel v-if="doc.doc.harness" />

          <template v-else>
            <img
              v-if="doc.doc.cover"
              class="cover"
              :src="doc.doc.cover"
              :alt="doc.doc.title"
            />

            <h1 class="doc-title">{{ doc.doc.title }}</h1>
            <p v-if="doc.doc.summary" class="doc-summary">{{ doc.doc.summary }}</p>

            <div class="doc-meta">
              <div class="meta-left">
                <span v-if="doc.doc.updated">更新于 {{ doc.doc.updated }}</span>
                <span v-if="doc.doc.folderPath" class="meta-sep">·</span>
                <span v-if="doc.doc.folderPath">{{ doc.doc.folderPath }}</span>
                <span v-for="tag in doc.doc.tags.slice(0, 3)" :key="tag" class="tag">
                  {{ tag }}
                </span>
              </div>

              <button class="path-btn" type="button" @click="copyPath">
                <CopyOutlined />
                复制路径
              </button>
            </div>

            <div v-if="doc.doc.notice" class="notice">
              <strong>{{ doc.doc.status || '当前维护' }}</strong>
              <span>{{ doc.doc.notice }}</span>
            </div>

            <div v-if="doc.doc.part" class="part-label">{{ doc.doc.part }}</div>

            <MarkdownPreview :html="renderedHtml" />
          </template>
        </div>
      </div>
    </template>
  </section>
</template>

<style scoped>
.doc-panel {
  height: 100%;
  display: flex;
  flex-direction: column;
  min-height: 0;
  background: #fff;
}

.doc-missing {
  flex: 1;
  display: grid;
  place-items: center;
  padding: 40px;
}

.crumbs {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 7px;
  margin-bottom: 18px;
  font-size: 13.5px;
  color: var(--aw-text-3);
}

.crumb-sep {
  color: var(--aw-text-4);
}

.crumb-current {
  color: var(--aw-text-2);
}

.doc-scroll {
  flex: 1;
  min-height: 0;
  overflow: auto;
  scroll-behavior: smooth;
  scrollbar-width: none;
}

.doc-scroll::-webkit-scrollbar {
  width: 0;
  height: 0;
  display: none;
}

.doc-inner {
  max-width: var(--aw-content-max);
  margin: 0 auto;
  padding: 20px 56px 72px;
}

.cover {
  display: block;
  width: 100%;
  height: auto;
  border-radius: 10px;
  border: 1px solid var(--aw-line);
  background: #0d0d0f;
  margin-bottom: 32px;
}

.doc-title {
  margin: 0 0 14px;
  font-size: 32px;
  line-height: 1.35;
  font-weight: 650;
  letter-spacing: -0.022em;
  color: var(--aw-text);
}

.doc-summary {
  margin: 0 0 16px;
  font-size: 16px;
  line-height: 1.8;
  color: var(--aw-text-2);
}

.doc-meta {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding-bottom: 20px;
  border-bottom: 1px solid var(--aw-line-soft);
  font-size: 13px;
  color: var(--aw-text-3);
}

.meta-left {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  min-width: 0;
}

.meta-sep {
  color: var(--aw-text-4);
}

.tag {
  font-size: 12px;
  line-height: 1;
  padding: 4px 8px;
  border-radius: 4px;
  background: var(--aw-bg-soft);
  border: 1px solid var(--aw-line);
  color: var(--aw-text-2);
}

.path-btn {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 28px;
  padding: 0 10px;
  border: 1px solid var(--aw-line);
  border-radius: 6px;
  background: #fff;
  color: var(--aw-text-2);
  font-size: 12.5px;
  cursor: pointer;
}

.path-btn:hover {
  border-color: #c9ccd3;
  color: var(--aw-text);
}

.notice {
  margin-top: 16px;
  display: flex;
  gap: 10px;
  padding: 10px 14px;
  border-radius: 8px;
  background: var(--aw-bg-soft);
  font-size: 13.5px;
  line-height: 1.7;
  color: var(--aw-text-2);
}

.notice strong {
  flex: 0 0 auto;
  font-weight: 600;
  color: var(--aw-text);
}

.part-label {
  margin: 44px 0 0;
  padding-top: 14px;
  border-top: 1px solid var(--aw-line);
  font-size: 12.5px;
  letter-spacing: 0.08em;
  color: var(--aw-text-3);
}

@media (max-width: 1023px) {
  .doc-inner {
    padding: 20px 28px 64px;
  }
}

@media (max-width: 620px) {
  .doc-inner {
    padding: 16px 18px 48px;
  }

  .doc-title {
    font-size: 26px;
  }

  .doc-summary {
    font-size: 15.5px;
  }

  .doc-meta {
    flex-direction: column;
    gap: 10px;
  }
}
</style>
