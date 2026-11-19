<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useWorkspaceStore } from '@/stores/workspace'
import { useUiStore, type ThemeMode } from '@/stores/ui'

const router = useRouter()
const workspace = useWorkspaceStore()
const ui = useUiStore()

function goEntry(): void {
  void router.push({ name: 'doc', params: { pathMatch: workspace.space.entry.split('/') } })
}

const themeLabel = computed(
  () =>
    ({ system: '跟随系统', light: '浅色', dark: '深色' })[ui.themeMode] ?? '跟随系统',
)

function onThemeSelect({ key }: { key: string | number }): void {
  ui.themeMode = key as ThemeMode
}
</script>

<template>
  <header class="hdr">
    <button class="brand" type="button" @click="goEntry">ai-workspace</button>

    <a-dropdown placement="bottomRight" trigger="click">
      <button class="theme-btn" type="button" :title="`主题：${themeLabel}`">
        <svg
          v-if="ui.isDark"
          class="theme-icon"
          viewBox="0 0 24 24"
          width="15"
          height="15"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2" />
          <path d="M12 20v2" />
          <path d="m4.93 4.93 1.41 1.41" />
          <path d="m17.66 17.66 1.41 1.41" />
          <path d="M2 12h2" />
          <path d="M20 12h2" />
          <path d="m6.34 17.66-1.41 1.41" />
          <path d="m19.07 4.93-1.41 1.41" />
        </svg>
        <svg
          v-else
          class="theme-icon"
          viewBox="0 0 24 24"
          width="15"
          height="15"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
        </svg>
        <span class="theme-text">{{ themeLabel }}</span>
      </button>
      <template #overlay>
        <a-menu :selected-keys="[ui.themeMode]" @click="onThemeSelect">
          <a-menu-item key="system">跟随系统</a-menu-item>
          <a-menu-item key="light">浅色</a-menu-item>
          <a-menu-item key="dark">深色</a-menu-item>
        </a-menu>
      </template>
    </a-dropdown>
  </header>
</template>

<style scoped>
.hdr {
  height: var(--aw-header-h);
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  padding: 0 26px;
  background: var(--aw-bg);
  border-bottom: 1px solid var(--aw-line);
  position: relative;
  z-index: 30;
}

.brand {
  border: 0;
  background: transparent;
  padding: 4px 2px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 20px;
  font-weight: 650;
  letter-spacing: -0.02em;
  color: var(--aw-strong);
  line-height: 1;
}

.brand:hover {
  color: var(--aw-accent-hover);
}

.theme-btn {
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  gap: 7px;
  height: 30px;
  padding: 0 10px;
  border: 1px solid var(--aw-line);
  border-radius: 7px;
  background: transparent;
  color: var(--aw-text-3);
  font-size: 12.5px;
  cursor: pointer;
  transition: color var(--aw-transition), border-color var(--aw-transition);
}

.theme-btn:hover {
  color: var(--aw-text);
  border-color: var(--aw-line-strong);
}

.theme-icon {
  flex: 0 0 auto;
}

.theme-text {
  line-height: 1;
}

@media (max-width: 620px) {
  .hdr {
    padding: 0 16px;
  }

  .brand {
    font-size: 20px;
  }

  .theme-text {
    display: none;
  }

  .theme-btn {
    padding: 0 8px;
  }
}
</style>
