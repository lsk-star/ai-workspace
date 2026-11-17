<script setup lang="ts">
import { useRouter } from 'vue-router'
import { ArrowLeftOutlined } from '@ant-design/icons-vue'
import { entryDoc } from '@/lib/content'

const router = useRouter()

function goHome(): void {
  void router.push({ name: 'doc', params: { pathMatch: entryDoc().path.split('/') } })
}
</script>

<template>
  <div class="not-found">
    <div class="code">404</div>
    <h1>页面不存在</h1>
    <p>链接可能已经失效，或者文档已被移动。</p>
    <a-button type="primary" @click="goHome">
      <template #icon><ArrowLeftOutlined /></template>
      回到开始阅读
    </a-button>
  </div>
</template>

<style scoped>
.not-found {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 40px 24px;
  text-align: center;
  background: #fff;
}

.code {
  font-family: var(--aw-font-mono);
  font-size: 64px;
  font-weight: 600;
  line-height: 1;
  color: var(--aw-text-4);
  letter-spacing: -0.04em;
}

h1 {
  margin: 8px 0 0;
  font-size: 22px;
  font-weight: 600;
  color: var(--aw-text);
}

p {
  margin: 0 0 20px;
  font-size: 15px;
  color: var(--aw-text-3);
}
</style>
