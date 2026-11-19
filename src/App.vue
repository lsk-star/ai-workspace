<script setup lang="ts">
import { computed, watchEffect } from 'vue'
import zhCN from 'ant-design-vue/es/locale/zh_CN'
import { buildAntdTheme } from '@/theme/antd'
import AppHeader from '@/components/AppHeader.vue'
import { useHotkeys } from '@/composables/useHotkeys'
import { useUiStore } from '@/stores/ui'

const ui = useUiStore()
const locale = computed(() => zhCN)
const antdTheme = computed(() => buildAntdTheme(ui.isDark))

useHotkeys()

// 深色阅读模式：驱动 CSS 变量与 antd 算法两套主题
watchEffect(() => {
  document.documentElement.classList.toggle('dark', ui.isDark)
})
</script>

<template>
  <a-config-provider :theme="antdTheme" :locale="locale">
    <div class="app-shell">
      <AppHeader />
      <main class="app-main">
        <router-view />
      </main>
    </div>
  </a-config-provider>
</template>
