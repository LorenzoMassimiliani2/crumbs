import { createRouter, createWebHistory } from 'vue-router'

import HomeView from '@/views/HomeView.vue'
import ProfileView from '@/views/ProfileView.vue'
import TrendView from '@/views/TrendView.vue'
import WeightView from '@/views/WeightView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'today',
      component: HomeView,
    },
    {
      path: '/weight',
      name: 'weight',
      component: WeightView,
    },
    {
      path: '/profile',
      name: 'profile',
      component: ProfileView,
    },
    {
      path: '/trend',
      name: 'trend',
      component: TrendView,
    },
  ],
})

export default router
