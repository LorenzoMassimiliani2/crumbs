import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { describe, expect, it } from 'vitest'

import BottomTabs from './BottomTabs.vue'

function testRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'today', component: { template: '<div>Oggi</div>' } },
      { path: '/weight', name: 'weight', component: { template: '<div>Peso</div>' } },
      { path: '/profile', name: 'profile', component: { template: '<div>Profilo</div>' } },
    ],
  })
}

describe('BottomTabs', () => {
  it('shows Peso, Oggi and Profilo in order and marks Oggi by default', async () => {
    const router = testRouter()
    await router.push('/')
    await router.isReady()

    const wrapper = mount(BottomTabs, { global: { plugins: [router] } })
    const links = wrapper.findAll('a')

    expect(links.map((link) => link.text())).toEqual(['Peso', 'Oggi', 'Profilo'])
    expect(links[1]!.attributes('aria-current')).toBe('page')
    expect(links[0]!.attributes('aria-current')).toBeUndefined()
    expect(links[2]!.attributes('aria-current')).toBeUndefined()
  })

  it('switches to the weight view when Peso is tapped', async () => {
    const router = testRouter()
    await router.push('/')
    await router.isReady()

    const wrapper = mount(BottomTabs, { global: { plugins: [router] } })
    await wrapper.findAll('a')[0]!.trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.name).toBe('weight')
    expect(wrapper.findAll('a')[0]!.attributes('aria-current')).toBe('page')
    expect(wrapper.findAll('a')[1]!.attributes('aria-current')).toBeUndefined()
  })

  it('switches to the profile view when Profilo is tapped', async () => {
    const router = testRouter()
    await router.push('/')
    await router.isReady()

    const wrapper = mount(BottomTabs, { global: { plugins: [router] } })
    await wrapper.findAll('a')[2]!.trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.name).toBe('profile')
    expect(wrapper.findAll('a')[2]!.attributes('aria-current')).toBe('page')
    expect(wrapper.findAll('a')[1]!.attributes('aria-current')).toBeUndefined()
  })
})
