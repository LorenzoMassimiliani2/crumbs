import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { describe, expect, it } from 'vitest'

import BottomTabs from './BottomTabs.vue'

function testRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'today', component: { template: '<div>Oggi</div>' } },
      { path: '/profile', name: 'profile', component: { template: '<div>Profilo</div>' } },
    ],
  })
}

describe('BottomTabs', () => {
  it('shows both tabs and marks the current one', async () => {
    const router = testRouter()
    await router.push('/')
    await router.isReady()

    const wrapper = mount(BottomTabs, { global: { plugins: [router] } })
    const links = wrapper.findAll('a')

    expect(links.map((link) => link.text())).toEqual(['Oggi', 'Profilo'])
    expect(links[0]!.attributes('aria-current')).toBe('page')
    expect(links[1]!.attributes('aria-current')).toBeUndefined()
  })

  it('switches to the profile view when Profilo is tapped', async () => {
    const router = testRouter()
    await router.push('/')
    await router.isReady()

    const wrapper = mount(BottomTabs, { global: { plugins: [router] } })
    await wrapper.findAll('a')[1]!.trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.name).toBe('profile')
    expect(wrapper.findAll('a')[1]!.attributes('aria-current')).toBe('page')
    expect(wrapper.findAll('a')[0]!.attributes('aria-current')).toBeUndefined()
  })
})
