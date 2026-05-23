import { createRouter, createWebHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('../views/Login.vue')
  },
  {
    path: '/',
    name: 'Home',
    component: () => import('../views/Home.vue'),
    meta: { requiresAuth: true }
  },
  
  {
    path: '/tasks',
    name: 'Tasks',
    component: () => import('../views/Tasks.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/code-review',
    name: 'CodeReview',
    component: () => import('../views/CodeReview.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/deploy',
    name: 'Deploy',
    component: () => import('../views/Deploy.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/preview',
    name: 'Preview',
    component: () => import('../views/Preview.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/settings',
    name: 'Settings',
    component: () => import('../views/Settings.vue'),
    meta: { requiresAuth: true }
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach(async (to, _from, next) => {
  const requiresAuth = to.meta.requiresAuth

  if (requiresAuth) {
    const { useUserStore } = await import('@/stores/user')
    const userStore = useUserStore()
    const isAuthenticated = await userStore.checkAuth()

    if (isAuthenticated) {
      next()
    } else {
      next('/login')
    }
  } else {
    next()
  }
})

export default router
