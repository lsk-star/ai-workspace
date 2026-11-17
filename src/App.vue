<script setup lang="ts">
import { computed } from 'vue'
import zhCN from 'ant-design-vue/es/locale/zh_CN'
import { antdTheme } from '@/theme/antd'
import AppHeader from '@/components/AppHeader.vue'
import { useHotkeys } from '@/composables/useHotkeys'

const locale = computed(() => zhCN)

useHotkeys()
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
