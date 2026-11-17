import { createRouter, createWebHashHistory } from 'vue-router'
import { entryDoc } from '@/lib/content'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      redirect: () => ({ name: 'doc', params: { pathMatch: entryDoc().path.split('/') } }),
    },
    {
      path: '/doc/:pathMatch(.*)*',
      name: 'doc',
      component: () => import('@/views/WorkspaceView.vue'),
    },
    {
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      component: () => import('@/views/NotFoundView.vue'),
    },
  ],
  scrollBehavior() {
    return { top: 0 }
  },
})

export default router
