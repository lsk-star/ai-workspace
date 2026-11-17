<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useWorkspaceStore } from '@/stores/workspace'

const router = useRouter()
const workspace = useWorkspaceStore()

function goEntry(): void {
  void router.push({ name: 'doc', params: { pathMatch: workspace.space.entry.split('/') } })
}
</script>

<template>
  <header class="hdr">
    <button class="brand" type="button" @click="goEntry">ai-workspace</button>
  </header>
</template>

<style scoped>
.hdr {
  height: var(--aw-header-h);
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  padding: 0 26px;
  background: #fff;
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
  color: #101114;
  line-height: 1;
}

.brand:hover {
  color: #000;
}

@media (max-width: 620px) {
  .hdr {
    padding: 0 16px;
  }

  .brand {
    font-size: 20px;
  }
}
</style>
